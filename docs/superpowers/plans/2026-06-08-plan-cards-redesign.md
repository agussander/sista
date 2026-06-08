# Plan Cards Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar las tarjetas de planes en el home por tarjetas más delgadas (nombre + mb + descripción + precio), eliminar la animación de stack en mobile, y agregar un único CTA "Solicitar ahora" → WhatsApp debajo de la grilla.

**Architecture:** Se modifican dos archivos: `stores.js` recibe un campo `desc` por plan y actualiza los `items`; `Price.svelte` se reescribe eliminando toda la lógica de stack (scroll, matchMedia, rAF) y rediseñando el template y los estilos. La clase global `btn-whatsapp` se reutiliza para el CTA.

**Tech Stack:** Svelte 5 (runes), PocketBase, CSS scoped

---

## Archivos

| Archivo | Cambio |
|---------|--------|
| `src/lib/stores.js` | Agregar `desc` a cada plan; reemplazar variantes de "Wifi Dual Band" por "Ilimitado" en `items` |
| `src/lib/components/home/Price.svelte` | Reescribir script (eliminar stack), template (nueva estructura), y estilos |

---

### Task 1: Actualizar datos en `stores.js`

**Files:**
- Modify: `src/lib/stores.js:16-46`

- [ ] **Step 1: Reemplazar el bloque `priceInfo`**

Reemplazar desde la línea 16 (`export const priceInfo = readable([{`) hasta la línea 46 (`]);`) con el siguiente bloque:

```js
export const priceInfo = readable([{
    plan: 'home',
    mb: '75',
    desc: 'Uso básico',
    items: ['Wi-Fi', 'Navegación sin fronteras'],
},
{
    plan: 'fast',
    mb: '150',
    desc: 'Ideal para streaming y trabajo',
    items: ['Ilimitado', 'Alta velocidad'],
},
{
    plan: 'power',
    mb: '300',
    desc: 'Mayor velocidad, más dispositivos',
    items: ['Ilimitado', 'Mayor velocidad', 'Más dispositivos'],
},
{
    plan: 'gamer',
    mb: '300',
    desc: 'Tráfico simétrico para gaming',
    items: ['Tráfico simétrico', 'Ilimitado', 'Cableado a tu dispositivo'],
},
{
    plan: 'worker',
    mb: '200',
    desc: 'Simétrico para trabajo remoto',
    items: ['Tráfico simétrico', 'Ilimitado', 'Cableado a tu puesto de trabajo'],
},
{
    plan: 'max',
    mb: '1000',
    desc: 'El máximo rendimiento disponible',
    items: ['Tráfico simétrico', 'Ilimitado', 'Máximo rendimiento'],
},
]);
```

- [ ] **Step 2: Verificar que PlanDetails.svelte sigue funcionando**

Abrir `src/lib/components/ui/PlanDetails.svelte` y confirmar que accede a `i.items` (no a `i.desc`). No debe requerir cambios.

- [ ] **Step 3: Commit**

```bash
git add src/lib/stores.js
git commit -m "feat: agregar desc a planes y reemplazar Wifi Dual Band por Ilimitado"
```

---

### Task 2: Reescribir el `<script>` de `Price.svelte`

**Files:**
- Modify: `src/lib/components/home/Price.svelte:1-143`

- [ ] **Step 1: Reemplazar todo el bloque `<script>`**

Reemplazar el contenido del `<script>` (líneas 1–143) con:

```svelte
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
```

Cambios respecto al original:
- Eliminados: `isMobileStack`, `wrapperEl`, `cardEls`, `rafId`, `applyStack`, `clearStackStyles`, `scheduleUpdate`
- Eliminados: imports de `modal` y `selectedPlan`
- Eliminada: función `openPlan`
- Eliminados: todos los listeners de `scroll`, `resize`, `matchMedia`

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/home/Price.svelte
git commit -m "refactor: eliminar lógica de stack de Price.svelte"
```

---

### Task 3: Reescribir el template de `Price.svelte`

**Files:**
- Modify: `src/lib/components/home/Price.svelte` (sección HTML entre `</script>` y `<style>`)

- [ ] **Step 1: Reemplazar el bloque de template**

Reemplazar todo el HTML entre `</script>` y `<style>` con:

```svelte
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
        <div class="card shadow">
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
```

Cambios respecto al original:
- Eliminados: `class:stack-mode`, `style:--n`, `bind:this={wrapperEl}`
- Eliminados: `role="button"`, `tabindex`, `onclick`, `onkeydown`, `bind:this={cardEls[idx]}` de cada tarjeta
- Reemplazada la estructura interna de la card (antes: `h3` + `ul` + botón; ahora: `card-top` + `card-bottom`)
- Agregado: bloque `<div class="cta-wrap">` con el link de WhatsApp

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/home/Price.svelte
git commit -m "feat: nuevo template de tarjetas de planes"
```

---

### Task 4: Reescribir los estilos de `Price.svelte`

**Files:**
- Modify: `src/lib/components/home/Price.svelte` (bloque `<style>`)

- [ ] **Step 1: Reemplazar el bloque `<style>` completo**

Reemplazar todo el contenido de `<style>` ... `</style>` con:

```css
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
```

- [ ] **Step 2: Verificar en el navegador**

Correr `npm run dev` y abrir la página de inicio. Verificar:
- Desktop (≥1024px): 3 columnas de tarjetas delgadas con nombre, precio, mb y descripción
- Mobile (<1024px): columna única, sin animación de scroll
- CTA "Solicitar ahora" aparece debajo de la grilla
- Hover: leve elevación, sin scale
- El link del CTA abre WhatsApp

- [ ] **Step 3: Commit final**

```bash
git add src/lib/components/home/Price.svelte
git commit -m "feat: rediseño estilos tarjetas de planes — slim, 3col desktop, col única mobile"
```
