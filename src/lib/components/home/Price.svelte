<script>
import { onMount } from "svelte";
import { pb } from '$lib/pocketbase';

import {
    priceInfo, modal, selectedPlan
} from "$lib/stores";

let precios = $state({});
let loading = $state(true);

let isMobileStack = $state(false);
let wrapperEl;
let cardEls = $state([]);
let rafId = null;

// Abre el modal con el plan seleccionado (misma lógica que el botón "Me interesa")
function openPlan(plan) {
    selectedPlan.set(plan);
    $modal = true;
}

// Función para formatear números con puntos de miles
const formatNumber = (value) => {
    if (!value) return '';
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

function applyStack() {
    if (!wrapperEl) return;
    const rect = wrapperEl.getBoundingClientRect();
    const vh = window.innerHeight;
    const totalScroll = Math.max(1, rect.height - vh);
    const scrolled = Math.max(0, Math.min(totalScroll, -rect.top));
    const n = cardEls.length || 1;

    // Índice activo entero: cada "paso" cubre un tramo igual del scroll total.
    // Con un pequeño umbral (0.5) para que el cambio se sienta a mitad de paso.
    const rawProgress = n > 1 ? (scrolled / totalScroll) * (n - 1) : 0;
    const activeIndex = Math.max(0, Math.min(n - 1, Math.round(rawProgress)));

    for (let i = 0; i < cardEls.length; i++) {
        const el = cardEls[i];
        if (!el) continue;

        const rank = i - activeIndex;
        let ty, scale, opacity, z;

        if (rank === 0) {
            // Tarjeta actual, al frente y en su posición correcta
            ty = -50;
            scale = 1;
            opacity = 1;
            z = 1000;
        } else if (rank > 0) {
            // Próximas: apiladas detrás, asomando desde abajo
            const r = Math.min(rank, 3);
            ty = -50 + r * 6;
            scale = 1 - r * 0.06;
            opacity = 1;
            z = 1000 - rank;
        } else {
            // Pasadas: apiladas detrás, asomando desde arriba (espejo de las próximas)
            const r = Math.min(-rank, 3);
            ty = -50 - r * 6;
            scale = 1 - r * 0.06;
            opacity = 1;
            z = 1000 + rank;
        }

        el.style.transform = `translate(-50%, ${ty}%) scale(${scale})`;
        el.style.opacity = String(opacity);
        el.style.zIndex = String(z);
    }
}

function clearStackStyles() {
    for (const el of cardEls) {
        if (!el) continue;
        el.style.transform = '';
        el.style.opacity = '';
        el.style.zIndex = '';
    }
}

function scheduleUpdate() {
    if (rafId != null) return;
    rafId = requestAnimationFrame(() => {
        rafId = null;
        if (isMobileStack) applyStack();
    });
}

onMount(async () => {
    try {
        const record = await pb.collection('precios').getFirstListItem('');
        if (record) {
            precios = {
                home: formatNumber(record.home),
                fast: formatNumber(record.fast),
                power: formatNumber(record.power),
                gamer: formatNumber(record.gamer),
                worker: formatNumber(record.worker),
                max: formatNumber(record.max),
            };
        }
    } catch (error) {
        console.error('Error cargando precios desde PocketBase:', error);
        precios = {};
    } finally {
        loading = false;
    }

    const mq = window.matchMedia('(max-width: 879px)');
    const handleMq = () => {
        const next = mq.matches;
        if (next === isMobileStack) return;
        isMobileStack = next;
        if (!isMobileStack) {
            clearStackStyles();
        } else {
            requestAnimationFrame(applyStack);
        }
    };
    handleMq();
    mq.addEventListener('change', handleMq);

    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate, { passive: true });
    if (isMobileStack) {
        requestAnimationFrame(applyStack);
    } else {
        clearStackStyles();
    }

    return () => {
        window.removeEventListener('scroll', scheduleUpdate);
        window.removeEventListener('resize', scheduleUpdate);
        mq.removeEventListener('change', handleMq);
        if (rafId != null) cancelAnimationFrame(rafId);
    };
});
</script>

<h2 id='planes'>Planes a tu medida</h2>
<div
    class="cont-outer"
    class:stack-mode={isMobileStack}
    style:--n={$priceInfo.length}
    bind:this={wrapperEl}
>
    <div class="cont">
        {#each $priceInfo as i, idx}
        <div
            class="card shadow"
            role="button"
            tabindex="0"
            bind:this={cardEls[idx]}
            onclick={() => openPlan(i.plan)}
            onkeydown={(e) => {
                if (e.key === 'Enter') {
                    openPlan(i.plan);
                } else if (e.key === ' ') {
                    e.preventDefault();
                    openPlan(i.plan);
                }
            }}
        >
            <div>
                <h3>{i.plan}</h3>
                <strong class="mb">{i.mb}mb</strong>
            </div>
            <ul>
                {#each i.items as item}
                <li>{item}</li>
                {/each}
            </ul>
            <div>
                {#if loading}
                <strong class="precio">Cargando...</strong>
                {:else if precios[i.plan]}
                <strong class="precio">${precios[i.plan]}</strong>
                {:else}
                <strong class="precio">-</strong>
                {/if}
                <button onclick={() => openPlan(i.plan)} class="btn-secondary btn-full btn-card">Me interesa</button>
            </div>
        </div>
        {/each}
    </div>
</div>
<p><a href='/precios' target="_blank">Ver precios completos</a></p>

<style>
p{
    text-align: center;
}

.cont-outer {
    position: relative;
}

.cont {
    display: flex;
    flex-flow: row wrap;
    justify-content: center;
    min-width: 100vw!important;
}

.card {
    display: flex;
    box-sizing: border-box;
    background: white;
    text-align: center;
    color: var(--text);
    flex-flow: column nowrap;
    width: 15em;
    height: 20em;
    margin: 0 .5em 2em .5em;
    border-radius: 1rem;
    padding: 1.2em 1em;
    justify-content: space-between;
    box-shadow: 0px 0px .5em rgba(0, 0, 0, .2);
    transition: all ease-in-out 300ms;
    cursor: pointer;
}

.card:hover {
    transform: scale(1.08);
}

h3 {
    font-size: 1.8em;
}

ul {
    list-style: none;
    padding: 0;
}

.precio {
    color: var(--magenta);
    padding-left: .5em;
    font-size: 1.1em;
}

button {
    margin-top: .6em;
}

.btn-card {
    padding: 0.5rem 1.75rem;
    font-weight: 500;
    border-width: 1.5px;
}

.mb {
    font-weight: 500;
}

@media (min-width: 650px) {
    .cont {
        max-width: 40rem;
    }
}

@media (min-width: 880px) {
    .cont {
        max-width: 53rem;
    }
}

/* Desktop: grid 3×3 centrado */
@media (min-width: 1024px) {
    .cont-outer {
        display: flex;
        justify-content: center;
    }

    .cont {
        display: grid;
        grid-template-columns: repeat(3, 15em);
        gap: 2em;
        min-width: auto !important;
        max-width: none;
        width: fit-content;
        margin: 0 auto;
    }

    .card {
        width: 15em;
        margin: 0;
    }
}

/* Modo "stack" (apilado) en mobile: scroll sticky con animación de tarjetas */
.cont-outer.stack-mode {
    /* Altura total = 1 viewport para tener la stage sticky + 65vh por cada
       transición entre tarjetas (N-1 transiciones). */
    height: calc(100vh + (var(--n, 1) - 1) * 65vh);
}

.stack-mode .cont {
    position: sticky;
    top: 0;
    height: 100vh;
    min-width: 0 !important;
    max-width: none;
    display: block;
    padding: 0;
    overflow: visible;
}

.stack-mode .card {
    position: absolute;
    left: 50%;
    top: 50%;
    width: min(22em, 85vw);
    height: 22em;
    margin: 0;
    transform: translate(-50%, -50%);
    transform-origin: center center;
    transition: transform 0.45s cubic-bezier(.22,.61,.36,1),
                opacity 0.3s ease-out;
    will-change: transform, opacity;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18);
}
</style>
