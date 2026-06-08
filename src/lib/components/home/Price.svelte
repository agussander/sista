<script>
import { onMount } from "svelte";
import { pb } from '$lib/pocketbase';
import { priceInfo } from "$lib/stores";

let precios = $state({});
let loading = $state(true);

const formatNumber = (value) => {
    if (!value) return '';
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

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
</script>

<h2 id='planes'>Planes a tu medida</h2>
<a href="/elegirplan" class="ayuda-card">
    <span class="ayuda-ico" aria-hidden="true">✨</span>
    <span class="ayuda-text">
        <strong>¿No sabés cuál elegir?</strong>
        <small>Te ayudamos a elegir el mejor plan para vos</small>
    </span>
    <span class="ayuda-arrow" aria-hidden="true">→</span>
</a>

<div class="cont-outer">
    <div class="cont">
        {#each $priceInfo as i}
        <div class="card">
            <div class="card-top">
                <span class="plan-name">{i.plan}</span>
                <span class="precio">
                    {#if loading}
                        Cargando...
                    {:else if precios[i.plan]}
                        ${precios[i.plan]}
                    {:else}
                        -
                    {/if}
                </span>
            </div>
            <div class="card-bottom">
                <span class="mb">{i.mb}mb</span>
                <span class="desc">{i.desc}</span>
            </div>
        </div>
        {/each}
    </div>
</div>

<div class="cta-wrap">
    <a
        href="https://api.whatsapp.com/send?phone=5492213541906&text=Hola!%20Quisiera%20información%20sobre%20los%20planes"
        target="_blank"
        rel="noopener noreferrer"
        class="btn-whatsapp"
    >
        Solicitar ahora
    </a>
</div>

<style>
/* ── Ayuda card (sin cambios) ── */
.ayuda-card {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    max-width: 40rem;
    margin: 0 auto 2.5em;
    text-align: left;
    background: linear-gradient(135deg, #f0e7f4, #faf0f4);
    border: 2px solid var(--violeta1);
    border-radius: 0.9rem;
    padding: 0.85rem 1.25rem;
    cursor: pointer;
    text-decoration: none;
    transition: transform ease 150ms, box-shadow ease 150ms;
}
.ayuda-card:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 14px rgba(102, 37, 124, 0.15);
}
.ayuda-ico {
    flex-shrink: 0;
    width: 2.6rem;
    height: 2.6rem;
    border-radius: 999px;
    background: var(--violeta1);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.3rem;
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
.ayuda-text small {
    color: #6b6b6b;
    font-size: 0.85rem;
    font-weight: 300;
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

.cont {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 100%;
    max-width: 28rem;
    padding: 0 1rem;
    box-sizing: border-box;
}

/* ── Tarjeta ── */
.card {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    background: white;
    border-radius: 0.9rem;
    padding: 0.85rem 1.1rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    transition: transform 150ms ease, box-shadow 150ms ease;
    box-sizing: border-box;
}
.card:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.13);
}

.card-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.card-bottom {
    display: flex;
    align-items: center;
    gap: 0.6rem;
}

.plan-name {
    font-weight: 600;
    font-size: 1.15rem;
    text-transform: capitalize;
    color: var(--text);
}

.precio {
    font-weight: 700;
    font-size: 1.05rem;
    color: var(--magenta);
}

.mb {
    font-weight: 700;
    font-size: 0.95rem;
    color: var(--violeta1);
    white-space: nowrap;
}

.desc {
    font-size: 0.83rem;
    color: #777;
    font-weight: 400;
}

/* ── CTA ── */
.cta-wrap {
    display: flex;
    justify-content: center;
    margin-top: 2rem;
}

/* ── Desktop: 3 columnas ── */
@media (min-width: 1024px) {
    .cont {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 1rem;
        max-width: 62rem;
        padding: 0 1.5rem;
    }
}
</style>
