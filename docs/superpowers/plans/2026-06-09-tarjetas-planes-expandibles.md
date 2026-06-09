# Tarjetas de planes expandibles — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer que las 6 tarjetas de planes de la home se abran (desktop: crecen tipo FLIP hasta llenar el contenedor; mobile: acordeón), mostrando características + botón de WhatsApp, con etiqueta "Simétrico" y link "¿Qué es simétrico?" que reusa el modal existente.

**Architecture:** `Price.svelte` orquesta el estado (`openIndex`, `showSimetrico`) y decide desktop-FLIP vs mobile-acordeón vía `matchMedia`. Un componente nuevo `PlanDetails.svelte` renderiza el contenido revelado (reusado por ambos modos). Dos helpers puros en `planCard.js` (testeables con vitest). Se reusa `SimetricoModal.svelte`.

**Tech Stack:** SvelteKit + Svelte 5 (runes), Vitest (env node, sólo lógica pura), CSS transitions para la animación FLIP, transición `slide` de Svelte para el acordeón.

**Spec:** `docs/superpowers/specs/2026-06-09-planes-tarjetas-expandibles-design.md`

---

## File Structure

- **Create** `src/lib/components/home/planCard.js` — helpers puros: `capitalizePlan`, `planWhatsappUrl`.
- **Create** `src/lib/components/home/planCard.test.js` — tests vitest de los helpers.
- **Create** `src/lib/components/home/PlanDetails.svelte` — contenido revelado (features + link simétrico + botón WhatsApp).
- **Modify** `src/lib/stores.js` — agregar `symmetric: true` a gamer/worker/max.
- **Create** `src/lib/stores.test.js` — test de los flags simétricos.
- **Modify** `src/lib/components/home/Price.svelte` — reescritura: estado, botones, chip, FLIP desktop, acordeón mobile, modal.

Se reusa tal cual: `src/lib/components/elegirplan/SimetricoModal.svelte`.

---

## Task 1: Helpers de tarjeta de plan (TDD)

**Files:**
- Create: `src/lib/components/home/planCard.js`
- Test: `src/lib/components/home/planCard.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/home/planCard.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { capitalizePlan, planWhatsappUrl } from '$lib/components/home/planCard.js';

describe('capitalizePlan', () => {
	it('capitaliza la primera letra', () => {
		expect(capitalizePlan('gamer')).toBe('Gamer');
	});
	it('string vacío o nulo devuelve vacío', () => {
		expect(capitalizePlan('')).toBe('');
		expect(capitalizePlan(undefined)).toBe('');
	});
});

describe('planWhatsappUrl', () => {
	it('arma el link con el plan capitalizado y los mb', () => {
		const url = planWhatsappUrl('gamer', '300');
		expect(url).toContain('phone=5492213541906');
		expect(decodeURIComponent(url)).toContain('Hola! Quiero contratar el plan Gamer (300mb)');
	});
	it('el texto va URL-encodeado (sin espacios crudos en la URL)', () => {
		const url = planWhatsappUrl('worker', '200');
		expect(url).not.toContain(' ');
		expect(url).toContain('text=');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- planCard`
Expected: FAIL — no se puede resolver `$lib/components/home/planCard.js` (módulo inexistente).

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/components/home/planCard.js`:

```js
// Helpers puros para las tarjetas de planes (testeables sin DOM).

const WHATSAPP_PHONE = '5492213541906';

// Los nombres de plan vienen en minúscula desde el store; los mostramos
// capitalizados en el mensaje de WhatsApp.
export function capitalizePlan(name) {
	if (!name) return '';
	return name.charAt(0).toUpperCase() + name.slice(1);
}

// Link de WhatsApp con mensaje prellenado para contratar un plan puntual.
export function planWhatsappUrl(planName, mb) {
	const text = `Hola! Quiero contratar el plan ${capitalizePlan(planName)} (${mb}mb)`;
	return `https://api.whatsapp.com/send?phone=${WHATSAPP_PHONE}&text=${encodeURIComponent(text)}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- planCard`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/home/planCard.js src/lib/components/home/planCard.test.js
git commit -m "feat: helpers planCard (capitalize + link WhatsApp por plan)"
```

---

## Task 2: Flag `symmetric` en el store (TDD)

**Files:**
- Modify: `src/lib/stores.js:34-51` (entradas gamer, worker, max del `priceInfo`)
- Test: `src/lib/stores.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/lib/stores.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import { priceInfo } from '$lib/stores.js';

describe('priceInfo flags simétricos', () => {
	it('gamer, worker y max son simétricos', () => {
		const sym = get(priceInfo).filter((p) => p.symmetric).map((p) => p.plan);
		expect(sym.sort()).toEqual(['gamer', 'max', 'worker']);
	});
	it('home, fast y power NO son simétricos', () => {
		const asym = get(priceInfo).filter((p) => !p.symmetric).map((p) => p.plan);
		expect(asym.sort()).toEqual(['fast', 'home', 'power']);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- stores`
Expected: FAIL — el filtro `p.symmetric` devuelve `[]` porque el flag aún no existe.

- [ ] **Step 3: Add the `symmetric` flag**

In `src/lib/stores.js`, add `symmetric: true,` to the gamer, worker and max entries. The block becomes:

```js
{
    plan: 'gamer',
    mb: '300',
    desc: 'Tráfico simétrico para gaming',
    symmetric: true,
    items: ['Tráfico simétrico', 'Ilimitado', 'Cableado a tu dispositivo'],
},
{
    plan: 'worker',
    mb: '200',
    desc: 'Simétrico para trabajo remoto',
    symmetric: true,
    items: ['Tráfico simétrico', 'Ilimitado', 'Cableado a tu puesto de trabajo'],
},
{
    plan: 'max',
    mb: '1000',
    desc: 'El máximo rendimiento disponible',
    symmetric: true,
    items: ['Tráfico simétrico', 'Ilimitado', 'Máximo rendimiento'],
},
```

(home, fast y power quedan sin el flag.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- stores`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores.js src/lib/stores.test.js
git commit -m "feat: flag symmetric en planes gamer/worker/max"
```

---

## Task 3: Componente `PlanDetails.svelte`

**Files:**
- Create: `src/lib/components/home/PlanDetails.svelte`

Contenido revelado al abrir una tarjeta: lista de características (`plan.items`), link "¿Qué es simétrico?" (sólo si `plan.symmetric`) y botón "Pedir este plan" a WhatsApp. El precio NO se muestra acá (lo muestra la cabecera de la fila/overlay).

- [ ] **Step 1: Create the component**

Create `src/lib/components/home/PlanDetails.svelte`:

```svelte
<script>
	// Contenido que se revela al abrir una tarjeta de plan. Reusado tanto por el
	// overlay de desktop como por el acordeón de mobile.
	import { planWhatsappUrl } from '$lib/components/home/planCard.js';

	let { plan, onSimetrico } = $props();

	let waUrl = $derived(planWhatsappUrl(plan.plan, plan.mb));
</script>

<div class="details">
	<ul class="features">
		{#each plan.items as item}
			<li>
				<svg class="check" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
					<path d="M5 13l4 4L19 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
				</svg>
				<span>{item}</span>
			</li>
		{/each}
	</ul>

	{#if plan.symmetric}
		<button type="button" class="simetrico-link" onclick={onSimetrico}>
			¿Qué es simétrico?
		</button>
	{/if}

	<a class="pedir" href={waUrl} target="_blank" rel="noopener noreferrer">
		<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
			<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
		</svg>
		Pedir este plan
	</a>
</div>

<style>
	.details {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		width: 100%;
		max-width: 26rem;
		margin: 0 auto;
		text-align: left;
	}

	.features {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.features li {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		font-size: 0.95rem;
		font-weight: 400;
		color: var(--violeta1);
	}
	.check {
		flex-shrink: 0;
		color: #1ba37a;
	}

	.simetrico-link {
		align-self: flex-start;
		background: none;
		border: none;
		padding: 0;
		width: auto;
		color: var(--violeta1);
		font-weight: 600;
		font-size: 0.85rem;
		text-decoration: underline;
		text-underline-offset: 3px;
		cursor: pointer;
	}
	.simetrico-link:hover {
		opacity: 0.75;
	}

	.pedir {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.55rem;
		align-self: stretch;
		background: #25d366;
		color: #fff;
		font-weight: 700;
		font-size: 1rem;
		text-decoration: none;
		border-radius: 0.7rem;
		padding: 0.8rem 1.2rem;
		transition: filter 150ms ease, transform 150ms ease;
	}
	.pedir:hover {
		filter: brightness(0.95);
		transform: translateY(-1px);
	}
</style>
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run build`
Expected: build OK, sin errores de compilación de Svelte. (`PlanDetails` aún no se usa, pero debe compilar.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/home/PlanDetails.svelte
git commit -m "feat: componente PlanDetails (features + simetrico + CTA WhatsApp)"
```

---

## Task 4: Reescritura de `Price.svelte` (estado, chip, FLIP desktop, acordeón mobile, modal)

**Files:**
- Modify: `src/lib/components/home/Price.svelte` (reescritura completa)

Mantiene: la carga de precios desde PocketBase, el `<h2>`, la `.ayuda-card` y el `.cta-wrap`. Agrega: tarjetas como `<button>`, chip "Simétrico", estado `openIndex`/`showSimetrico`, detección `isDesktop` por `matchMedia`, overlay FLIP en desktop, acordeón `slide` en mobile, y el `SimetricoModal`.

- [ ] **Step 1: Replace the entire file**

Overwrite `src/lib/components/home/Price.svelte` with:

```svelte
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
                <div class="card-top">
                    <span class="name-wrap">
                        <span class="plan-name">{i.plan}</span>
                        {#if i.symmetric}<span class="chip">Simétrico</span>{/if}
                    </span>
                    <span class="precio">{priceLabel(i.plan)}</span>
                </div>
                <div class="card-bottom">
                    <span class="mb">{i.mb}mb</span>
                    <span class="desc">{i.desc}</span>
                </div>
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
                        <span class="panel-name">{$priceInfo[openIndex].plan}</span>
                        {#if $priceInfo[openIndex].symmetric}<span class="chip">Simétrico</span>{/if}
                        <span class="panel-price">{priceLabel($priceInfo[openIndex].plan)}</span>
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

/* La tarjeta es un botón: reseteamos estilos por defecto. */
.card {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
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

.card-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.6rem;
}

.name-wrap {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
}

.card-bottom {
    display: flex;
    align-items: baseline;
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
    white-space: nowrap;
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

/* ── Chip "Simétrico" ── */
.chip {
    flex-shrink: 0;
    font-size: 0.62rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: #fff;
    background: var(--magenta);
    padding: 0.15rem 0.5rem;
    border-radius: 999px;
    line-height: 1.4;
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

/* ── Overlay desktop (FLIP) ── */
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
        padding: 0.85rem 1.1rem;
        transition: transform 150ms ease, box-shadow 150ms ease;
    }
    .card:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.13);
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
            top 300ms cubic-bezier(0.2, 0.7, 0.2, 1),
            left 300ms cubic-bezier(0.2, 0.7, 0.2, 1),
            width 300ms cubic-bezier(0.2, 0.7, 0.2, 1),
            height 300ms cubic-bezier(0.2, 0.7, 0.2, 1);
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
        align-items: center;
        gap: 0.6rem;
    }
    .panel-name {
        font-weight: 700;
        font-size: 1.6rem;
        text-transform: capitalize;
        color: var(--text);
    }
    .panel-price {
        font-weight: 800;
        font-size: 1.4rem;
        color: var(--magenta);
    }
}
</style>
```

- [ ] **Step 2: Verify the build compiles**

Run: `npm run build`
Expected: build OK, sin errores. (Confirma que `bind:this` en array, runes, imports y CSS son válidos.)

- [ ] **Step 3: Verify existing tests still pass**

Run: `npm run test`
Expected: PASS — `planCard`, `stores` y los tests previos (`data.test.js`) sin regresiones.

- [ ] **Step 4: Manual visual verification (dev server)**

> El preview MCP está roto en este entorno (TCC sobre ~/Documents). Verificación manual por el usuario con `npm run dev`.

Run: `npm run dev` y abrir la home. Checklist:
- [ ] Desktop (≥1024px): click en una tarjeta → crece desde su posición hasta llenar el contenedor de las 6 tarjetas, con el resto atenuado. Se ven las características y el botón "Pedir este plan".
- [ ] Cierra con ✕, Escape y click en el fondo atenuado; vuelve a su lugar.
- [ ] Las tarjetas gamer/worker/max muestran el chip "Simétrico". Al abrirlas, el link "¿Qué es simétrico?" abre el `SimetricoModal`.
- [ ] "Pedir este plan" abre WhatsApp con el mensaje del plan correcto.
- [ ] Mobile (<1024px): tocar un plan lo despliega en acordeón (slide), muestra características + botón; tocar otro cierra el anterior.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/home/Price.svelte
git commit -m "feat: tarjetas de planes expandibles (FLIP desktop, acordeón mobile, chip simétrico)"
```

---

## Self-Review

**Spec coverage:**
- §1 Datos / símetrico → Task 2 (flag) + chip render en Task 4. ✅
- §2 Estructura de componentes → Task 3 (PlanDetails) + Task 4 (Price orquestador) + reuso SimetricoModal. ✅
- §3 FLIP desktop sin reflow → Task 4 overlay separado + medición de rect + transición top/left/width/height. ✅
- §4 Acordeón mobile → Task 4 `{#if ... && !isDesktop}` con `transition:slide`. ✅
- §5 Chip simétrico → Task 4 (chip en `.card-top` y en `.panel-head`). ✅
- §6 CTA WhatsApp por plan → Task 1 (`planWhatsappUrl`) usado en PlanDetails (Task 3). ✅
- §7 Accesibilidad → Task 4 (`<button>`, `aria-expanded`, Escape, foco a close y retorno a la tarjeta, `role="dialog"`). ✅

**Placeholder scan:** sin TBD/TODO; todo el código está completo.

**Type/identifier consistency:** `planWhatsappUrl(planName, mb)` y `capitalizePlan(name)` definidos en Task 1 y usados en Task 3. `PlanDetails` props `{ plan, onSimetrico }` consistentes entre Task 3 y los dos usos en Task 4. `priceLabel`, `open`, `close`, `flip`, `animating`, `isDesktop`, `cardEls`, `contEl`, `overlayEl`, `closeEl` definidos y usados coherentemente en Task 4.
```
