<script>
import { onMount, tick } from "svelte";
import { slide } from "svelte/transition";
import { pb } from '$lib/pocketbase';
import { priceInfo } from "$lib/stores";
import PlanDetails from "./PlanDetails.svelte";
import SimetricoModal from "$lib/components/elegirplan/SimetricoModal.svelte";

let precios = $state({});
let loading = $state(true);

let openIndex = $state(null);
let showSimetrico = $state(false);
let isDesktop = $state(false);

// FLIP (desktop): caja de inicio (posición/tamaño de la tarjeta clickeada) y
// flag que dispara la transición hacia inset:0 del contenedor.
let flip = $state({ t: 0, l: 0, w: 0, h: 0 });
let animating = $state(false);

let contEl;
let overlayEl = $state();
let closeEl = $state();
let cardEls = $state([]);
let lastFocused = null;

const formatNumber = (value) => {
    if (!value) return '';
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

function priceLabel(key) {
    if (loading) return 'Cargando...';
    return precios[key] ? `$${precios[key]}` : '-';
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
});

onMount(() => {
    const mql = window.matchMedia('(min-width: 1024px)');
    isDesktop = mql.matches;
    const onChange = (e) => {
        isDesktop = e.matches;
        // Al cambiar de layout, cerramos cualquier tarjeta abierta para evitar
        // estados inconsistentes entre overlay y acordeón.
        openIndex = null;
        animating = false;
    };
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
});

async function open(idx) {
    // Toca la misma tarjeta abierta -> cerrar.
    if (openIndex === idx) {
        close();
        return;
    }
    lastFocused = cardEls[idx];

    if (!isDesktop) {
        openIndex = idx; // acordeón: el slide se encarga de la animación
        return;
    }

    // Desktop: medir la caja de la tarjeta relativa al contenedor (FLIP "First").
    const c = contEl.getBoundingClientRect();
    const r = cardEls[idx].getBoundingClientRect();
    flip = { t: r.top - c.top, l: r.left - c.left, w: r.width, h: r.height };
    openIndex = idx;
    await tick();
    // Dos rAF para garantizar que el overlay pintó en la caja de inicio antes
    // de transicionar a inset:0.
    requestAnimationFrame(() => requestAnimationFrame(() => {
        animating = true;
        closeEl?.focus();
    }));
}

function close() {
    if (openIndex === null) return;
    const ret = lastFocused;

    if (!isDesktop) {
        openIndex = null;
        ret?.focus?.();
        return;
    }

    // Desktop: revertir la transición y desmontar al terminar.
    animating = false;
    setTimeout(() => {
        openIndex = null;
        ret?.focus?.();
    }, 300);
}

function onKey(e) {
    if (e.key === 'Escape') close();
}
</script>

<svelte:window onkeydown={onKey} />

<h2 id='planes'>Planes a tu medida</h2>

<div class="cont-outer">
    <div class="cont" class:has-open={openIndex !== null && isDesktop} bind:this={contEl}>
        {#each $priceInfo as i, idx}
        <div class="row">
            <button
                class="card"
                type="button"
                bind:this={cardEls[idx]}
                onclick={() => open(idx)}
                aria-expanded={openIndex === idx}
            >
                <span class="eyebrow">
                    <span class="plan-name">{i.plan}</span>
                    {#if i.symmetric}<span class="chip">Simétrico</span>{/if}
                </span>
                <span class="figures">
                    <span class="speed">{i.mb}<span class="unit">mb</span></span>
                    <span class="precio">{priceLabel(i.plan)}{#if !loading && precios[i.plan]}<span class="per">/mes</span>{/if}</span>
                </span>
                <span class="desc">{i.desc}</span>
            </button>

            {#if openIndex === idx && !isDesktop}
                <div class="inline-details" transition:slide={{ duration: 250 }}>
                    <PlanDetails plan={i} onSimetrico={() => (showSimetrico = true)} />
                </div>
            {/if}
        </div>
        {/each}

        {#if openIndex !== null && isDesktop}
            <div class="dim" class:open={animating} onclick={close} role="presentation"></div>
            <div
                class="overlay"
                class:open={animating}
                bind:this={overlayEl}
                style="--t:{flip.t}px;--l:{flip.l}px;--w:{flip.w}px;--h:{flip.h}px;"
                role="dialog"
                aria-modal="true"
                aria-label="Detalle del plan {$priceInfo[openIndex].plan}"
            >
                <button class="close" type="button" onclick={close} bind:this={closeEl} aria-label="Cerrar">✕</button>
                <div class="panel-body">
                    <div class="panel-head">
                        <span class="eyebrow">
                            <span class="plan-name">{$priceInfo[openIndex].plan}</span>
                            {#if $priceInfo[openIndex].symmetric}<span class="chip">Simétrico</span>{/if}
                        </span>
                        <span class="panel-figures">
                            <span class="panel-speed">{$priceInfo[openIndex].mb}<span class="unit">mb</span></span>
                            <span class="panel-price">{priceLabel($priceInfo[openIndex].plan)}{#if !loading && precios[$priceInfo[openIndex].plan]}<span class="per">/mes</span>{/if}</span>
                        </span>
                    </div>
                    <PlanDetails plan={$priceInfo[openIndex]} onSimetrico={() => (showSimetrico = true)} />
                </div>
            </div>
        {/if}
    </div>
</div>

<a href="/elegirplan" class="ayuda-card">
    <span class="ayuda-text">
        <strong>Calculá tu plan</strong>
    </span>
    <span class="ayuda-arrow" aria-hidden="true">→</span>
</a>

<div class="cta-wrap">
    <a
        href="https://api.whatsapp.com/send?phone=5492213541906&text=Hola!%20Quisiera%20información%20sobre%20los%20planes"
        target="_blank"
        rel="noopener noreferrer"
        class="btn-whatsapp"
    >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
        </svg>
        Solicitar ahora
    </a>
</div>

{#if showSimetrico}
    <SimetricoModal onclose={() => (showSimetrico = false)} />
{/if}

<style>
/* ── Ayuda card ── */
.ayuda-card {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: calc(100% - 2rem);
    max-width: 40rem;
    margin: 1.5rem auto 0;
    text-align: left;
    background: white;
    border-radius: 0.9rem;
    padding: 0.85rem 1.25rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    cursor: pointer;
    text-decoration: none;
    transition: transform ease 150ms, box-shadow ease 150ms;
}
.ayuda-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.13);
}
.ayuda-text {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
}
.ayuda-text strong {
    color: var(--violeta1);
    font-size: 1.05rem;
}
.ayuda-arrow {
    flex-shrink: 0;
    color: var(--magenta);
    font-size: 1.4rem;
    font-weight: 700;
}

/* ── Contenedor ── */
.cont-outer {
    display: flex;
    justify-content: center;
    width: 100%;
}

/* Mobile: una sola tarjeta, planes separados por líneas finas */
.cont {
    width: calc(100% - 2rem);
    max-width: 40rem;
    margin: 0 auto;
    box-sizing: border-box;
    background: white;
    border-radius: 0.9rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    overflow: hidden;
}

/* ── Cada plan = una fila ── */
.row {
    border-bottom: 1px solid #ececec;
}
.row:last-child {
    border-bottom: none;
}

/* La tarjeta es un botón: reseteamos estilos por defecto y alineamos a la izq. */
.card {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.45rem;
    width: 100%;
    padding: 0.9rem 1.25rem;
    box-sizing: border-box;
    background: none;
    border: none;
    font: inherit;
    color: inherit;
    text-align: left;
    cursor: pointer;
}

.eyebrow {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

/* Nombre del plan = etiqueta secundaria (eyebrow), no protagonista. */
.plan-name {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #9b8aa6;
}

/* Velocidad (izq) + precio (der) compartiendo la misma línea base. */
.figures {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75rem;
    width: 100%;
}

/* Velocidad = número protagonista (más importante que el nombre). */
.speed {
    display: flex;
    align-items: baseline;
    gap: 0.15rem;
    font-size: 1.5rem;
    font-weight: 800;
    line-height: 1;
    color: var(--violeta1);
}
.unit {
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--violeta1);
    opacity: 0.55;
}

/* Precio = peso medium (de-enfatizado), mantiene el acento magenta. */
.precio {
    display: flex;
    align-items: baseline;
    gap: 0.13rem;
    font-size: 1.1rem;
    font-weight: 500;
    color: var(--magenta);
    white-space: nowrap;
}
.per {
    font-size: 0.72rem;
    font-weight: 400;
    color: #9a9a9a;
}

.desc {
    text-align: left;
    font-size: 0.85rem;
    color: #777;
    font-weight: 400;
}

/* ── Chip "Simétrico" (gris, acento sutil) ── */
.chip {
    flex-shrink: 0;
    font-size: 0.6rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #7a7a7a;
    background: #ededed;
    padding: 0.12rem 0.45rem;
    border-radius: 999px;
    line-height: 1.5;
}

.inline-details {
    padding: 0.25rem 1.25rem 1.1rem;
}

/* ── CTA ── */
.cta-wrap {
    display: flex;
    justify-content: center;
    margin-top: 2rem;
}

/* ── Overlay desktop (FLIP): oculto por defecto en mobile ── */
.dim,
.overlay {
    display: none;
}

/* ── Desktop: 3 columnas (tarjetas individuales) ── */
@media (min-width: 1024px) {
    .cont {
        position: relative;
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 1rem;
        max-width: 62rem;
        padding: 0 1.5rem;
        background: none;
        box-shadow: none;
        border-radius: 0;
        overflow: visible;
    }
    .row {
        border-bottom: none;
    }
    .card {
        height: 100%;
        background: white;
        border-radius: 0.9rem;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        padding: 1rem 1.2rem;
        transition: transform 150ms ease, box-shadow 150ms ease;
    }
    .card:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.13);
    }
    .card:active {
        transform: scale(0.99);
    }
    .card:focus-visible {
        outline: 2px solid var(--violeta1);
        outline-offset: 2px;
    }

    .dim {
        display: block;
        position: absolute;
        inset: 0;
        z-index: 20;
        background: rgba(43, 18, 53, 0.18);
        opacity: 0;
        transition: opacity 280ms ease;
        cursor: pointer;
        border-radius: 0.9rem;
    }
    .dim.open {
        opacity: 1;
    }

    .overlay {
        display: block;
        position: absolute;
        top: var(--t);
        left: var(--l);
        width: var(--w);
        height: var(--h);
        z-index: 30;
        background: #fff;
        border-radius: 0.9rem;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
        overflow: auto;
        transition:
            top 300ms cubic-bezier(0.23, 1, 0.32, 1),
            left 300ms cubic-bezier(0.23, 1, 0.32, 1),
            width 300ms cubic-bezier(0.23, 1, 0.32, 1),
            height 300ms cubic-bezier(0.23, 1, 0.32, 1);
    }
    .overlay.open {
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
    }

    .close {
        position: absolute;
        top: 0.85rem;
        right: 0.95rem;
        z-index: 2;
        background: none;
        border: none;
        font-size: 1rem;
        color: #9a9a9a;
        cursor: pointer;
        padding: 0.25rem;
        width: auto;
        line-height: 1;
    }
    .close:hover {
        color: var(--violeta1);
    }

    .panel-body {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1rem;
        min-height: 100%;
        padding: 1.5rem 2rem;
        box-sizing: border-box;
        opacity: 0;
        transition: opacity 150ms ease;
    }
    .overlay.open .panel-body {
        opacity: 1;
        transition: opacity 220ms ease 120ms;
    }

    .panel-head {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        text-align: center;
    }
    .panel-figures {
        display: flex;
        align-items: baseline;
        gap: 0.85rem;
    }
    /* Misma jerarquía que la tarjeta, en grande: velocidad protagonista. */
    .panel-speed {
        display: flex;
        align-items: baseline;
        gap: 0.2rem;
        font-size: 2rem;
        font-weight: 800;
        line-height: 1;
        color: var(--violeta1);
    }
    .panel-price {
        display: flex;
        align-items: baseline;
        gap: 0.15rem;
        font-size: 1.25rem;
        font-weight: 500;
        color: var(--magenta);
    }
}
</style>
