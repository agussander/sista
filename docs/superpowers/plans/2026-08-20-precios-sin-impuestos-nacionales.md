# Mostrar el precio sin impuestos nacionales — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar el spec [2026-08-20-precios-sin-impuestos-nacionales-design.md](../specs/2026-08-20-precios-sin-impuestos-nacionales-design.md): link a `/tarifas` en el home, y un texto chico "Sin impuestos nacionales: $X" en las tarjetas de plan (home y wizard) y en el total del resumen del wizard.

**Architecture:** Una función pura nueva (`sinImpuestosPorCampo`) en `src/lib/tarifario/mapeoPrecios.js` reutiliza el dato real que ya trae el tarifario (mismo criterio que `/tarifas`), mapeado a los campos de la colección `precios` con el `CAMPOS_POR_ETIQUETA` que ya existe. Tres puntos de UI (home, wizard, resumen) hacen cada uno su propio fetch de `fetchTarifario()` y consumen esa función — si el fetch falla, la línea chica simplemente no se muestra, sin romper nada.

**Tech Stack:** SvelteKit 5 (runes), Vitest, JSDoc (`svelte-check` vía `jsconfig.json`).

---

## Antes de empezar

Confirmar que el árbol de trabajo está limpio en los archivos que vamos a tocar:

```bash
git status --short src/lib/tarifario/ src/lib/components/home/Price.svelte src/lib/components/elegirplan/
```

Expected: sin salida. Si hay algo, es trabajo ajeno — no pisarlo, preguntar antes de seguir.

---

### Task 1: `sinImpuestosPorCampo` — función pura + tests

**Files:**
- Modify: `src/lib/tarifario/mapeoPrecios.js` (agregar función al final del archivo)
- Modify: `src/lib/tarifario/mapeoPrecios.test.js` (agregar describe al final)
- Modify: `src/lib/tarifario/parseTarifario.test.js` (agregar test dentro del describe `mapeo contra el Excel real`)

- [ ] **Step 1: Escribir los tests unitarios (van a fallar: la función no existe)**

En `src/lib/tarifario/mapeoPrecios.test.js`, cambiar el import de la línea 2:

```js
import { calcularPrecios, sinImpuestosPorCampo } from './mapeoPrecios.js';
```

Y agregar al final del archivo, después del `});` que cierra `describe('calcularPrecios', ...)`:

```js

describe('sinImpuestosPorCampo', () => {
	const FILAS = [
		{ label: 'HOME F111', sinImpuestos: 20787.04 },
		{ label: 'FAST F121', sinImpuestos: 25667.82 },
		{ label: 'ANTINA PLAY +', sinImpuestos: 16438.02 },
		{ label: 'LINEA VIP 56-221', sinImpuestos: 8240.99 }
	];

	it('mapea las etiquetas a los campos y redondea', () => {
		const valores = sinImpuestosPorCampo(FILAS);

		expect(valores.home).toBe(20787);
		expect(valores.fast).toBe(25668);
		expect(valores.antina).toBe(16438);
		expect(valores.telefono).toBe(8241);
	});

	it('normaliza espacios de mas y mayusculas al buscar la etiqueta', () => {
		const valores = sinImpuestosPorCampo([
			{ label: 'max   f161   (NUEVO)', sinImpuestos: 45197.42 }
		]);
		expect(valores.max).toBe(45197);
	});

	it('no incluye una etiqueta que no esta en las filas', () => {
		const valores = sinImpuestosPorCampo([{ label: 'HOME F111', sinImpuestos: 20787.04 }]);

		expect('home' in valores).toBe(true);
		expect('gamer' in valores).toBe(false);
	});

	it('descarta valores no numericos o no positivos', () => {
		const valores = sinImpuestosPorCampo([
			{ label: 'HOME F111', sinImpuestos: 0 },
			{ label: 'FAST F121', sinImpuestos: null },
			{ label: 'POWER F131', sinImpuestos: -5 }
		]);

		expect('home' in valores).toBe(false);
		expect('fast' in valores).toBe(false);
		expect('power' in valores).toBe(false);
	});

	it('sin filas, devuelve un objeto vacio', () => {
		expect(sinImpuestosPorCampo([])).toEqual({});
		expect(sinImpuestosPorCampo(undefined)).toEqual({});
	});
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npm run test -- mapeoPrecios.test.js`
Expected: FAIL — `sinImpuestosPorCampo is not a function` (o `is not exported`).

- [ ] **Step 3: Implementar `sinImpuestosPorCampo` en `mapeoPrecios.js`**

Agregar al final de `src/lib/tarifario/mapeoPrecios.js` (después del `}` que cierra `calcularPrecios`, línea 143):

```js

/**
 * Precio sin impuestos nacionales por campo de `precios`, a partir de las
 * filas de la pestaña "Tarifas Web" (mismo dato que ya publica /tarifas).
 *
 * A diferencia de `calcularPrecios`, es un dato decorativo que no se escribe
 * en PocketBase: sin avisos ni `sinCampo`, una etiqueta que falta simplemente
 * no aparece en el resultado, y quien lo consume no muestra esa línea.
 *
 * @param {{ label?: unknown, sinImpuestos?: unknown }[] | undefined} filas
 * @returns {Record<string, number>}
 */
export function sinImpuestosPorCampo(filas) {
	/** @type {Map<string, { label?: unknown, sinImpuestos?: unknown }>} */
	const porEtiqueta = new Map();
	for (const fila of Array.isArray(filas) ? filas : []) {
		const clave = normalizar(fila?.label);
		if (clave && !porEtiqueta.has(clave)) porEtiqueta.set(clave, fila);
	}

	/** @type {Record<string, number>} */
	const valores = {};
	for (const [etiqueta, campo] of Object.entries(CAMPOS_POR_ETIQUETA)) {
		const fila = porEtiqueta.get(normalizar(etiqueta));
		if (fila && positivo(fila.sinImpuestos)) {
			valores[campo] = Math.round(/** @type {number} */ (fila.sinImpuestos));
		}
	}
	return valores;
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm run test -- mapeoPrecios.test.js`
Expected: PASS (todos los tests de `mapeoPrecios.test.js`, incluidos los de `calcularPrecios`).

- [ ] **Step 5: Agregar el test de integración contra el Excel real**

En `src/lib/tarifario/parseTarifario.test.js`, cambiar el import de la línea 4:

```js
import { calcularPrecios, sinImpuestosPorCampo } from './mapeoPrecios.js';
```

Y agregar, dentro de `describe('mapeo contra el Excel real', ...)` (después del `it('resuelve los 17 campos sin avisos', ...)`, antes del `});` que cierra el describe):

```js

	it('calcula el precio sin impuestos para los 15 campos de Tarifas Web', () => {
		const valores = sinImpuestosPorCampo(parseTarifario(libro).tarifasWeb.filas);

		expect(valores).toMatchObject({
			home: 20787,
			fast: 25668,
			power: 26616,
			gamer: 34695,
			worker: 37850,
			max: 45197,
			antina: 16438,
			antina_futbol: 24380,
			dgo_full: 28967,
			dgo_futbol: 21165,
			dgo_paramount: 7550,
			dgo_universal: 12496,
			gigared: 10826,
			gigared_futbol: 21165,
			telefono: 8241
		});
	});
```

- [ ] **Step 6: Correr todos los tests de tarifario y verificar que pasan**

Run: `npm run test -- src/lib/tarifario`
Expected: PASS (todos).

- [ ] **Step 7: Commit**

```bash
git add src/lib/tarifario/mapeoPrecios.js src/lib/tarifario/mapeoPrecios.test.js src/lib/tarifario/parseTarifario.test.js
git commit -m "feat(tarifario): agregar sinImpuestosPorCampo para el precio sin impuestos nacionales"
```

---

### Task 2: Wizard — estado compartido `sinImpuestos`

**Files:**
- Modify: `src/lib/components/elegirplan/wizardState.svelte.js:25-28`
- Modify: `src/lib/components/elegirplan/ElegirPlanWizard.svelte:1-45`

- [ ] **Step 1: Agregar el campo al estado del wizard**

En `src/lib/components/elegirplan/wizardState.svelte.js`, reemplazar:

```js
	// datos / carga
	precios: {},
	loading: true,
	error: false,
```

por:

```js
	// datos / carga
	precios: {},
	sinImpuestos: {},
	loading: true,
	error: false,
```

- [ ] **Step 2: Poblarlo en el `onMount` del wizard**

En `src/lib/components/elegirplan/ElegirPlanWizard.svelte`, agregar los imports (después de la línea 7, `import { pb } from '$lib/pocketbase';`):

```js
	import { fetchTarifario } from '$lib/tarifario/fetchTarifario.js';
	import { sinImpuestosPorCampo } from '$lib/tarifario/mapeoPrecios.js';
```

Y reemplazar el `onMount` (líneas 33-45):

```js
	onMount(async () => {
		hydrateFromParams($page.url.searchParams);
		try {
			const record = await pb.collection('precios').getFirstListItem('');
			if (record) wizard.precios = record;
		} catch (e) {
			console.error('Error cargando precios desde PocketBase:', e);
			wizard.error = true;
		} finally {
			wizard.loading = false;
		}
		mounted = true;
	});
```

por:

```js
	onMount(async () => {
		hydrateFromParams($page.url.searchParams);
		try {
			const record = await pb.collection('precios').getFirstListItem('');
			if (record) wizard.precios = record;
		} catch (e) {
			console.error('Error cargando precios desde PocketBase:', e);
			wizard.error = true;
		} finally {
			wizard.loading = false;
		}
		mounted = true;

		// Decorativo: si falla, el wizard sigue andando sin las líneas de
		// "sin impuestos nacionales" (no bloquea wizard.loading).
		try {
			const { tarifasWeb } = await fetchTarifario();
			wizard.sinImpuestos = sinImpuestosPorCampo(tarifasWeb.filas);
		} catch (e) {
			console.error('Error cargando el tarifario desde PocketBase:', e);
		}
	});
```

- [ ] **Step 3: Verificar tipos**

Run: `npm run check`
Expected: sin errores nuevos en `wizardState.svelte.js` ni en `ElegirPlanWizard.svelte`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/elegirplan/wizardState.svelte.js src/lib/components/elegirplan/ElegirPlanWizard.svelte
git commit -m "feat(elegirplan): cargar el precio sin impuestos nacionales en el estado del wizard"
```

---

### Task 3: `OptionCard` — prop `subPrice`

**Files:**
- Modify: `src/lib/components/elegirplan/OptionCard.svelte`

- [ ] **Step 1: Agregar el prop**

En `src/lib/components/elegirplan/OptionCard.svelte`, reemplazar la desestructuración de props (líneas 11-35):

```js
	let {
		title,
		subtitle = '',
		subtitleStrong = false,
		price = '',
		tag = '',
```

por:

```js
	let {
		title,
		subtitle = '',
		subtitleStrong = false,
		price = '',
		subPrice = '',
		tag = '',
```

(el resto de la desestructuración, líneas 16-35, queda igual).

- [ ] **Step 2: Renderizarlo debajo de "/mes"**

Reemplazar el bloque de precio (líneas 104-112):

```svelte
		{#if price !== '' && price !== null}
			<div class="price" class:consultar>
				{#if consultar}
					<span class="price-consultar">Consultar</span>
				{:else}
					<strong>{price}</strong><span class="per">/mes</span>
				{/if}
			</div>
		{/if}
```

por:

```svelte
		{#if price !== '' && price !== null}
			<div class="price" class:consultar>
				{#if consultar}
					<span class="price-consultar">Consultar</span>
				{:else}
					<strong>{price}</strong><span class="per">/mes</span>
					{#if subPrice}<span class="sub-price">{subPrice}</span>{/if}
				{/if}
			</div>
		{/if}
```

- [ ] **Step 3: Agregar el estilo**

En el bloque `<style>`, reemplazar:

```css
	.price .per {
		display: block;
		font-size: 0.7rem;
		color: #9a9a9a;
	}
```

por:

```css
	.price .per {
		display: block;
		font-size: 0.7rem;
		color: #9a9a9a;
	}
	.sub-price {
		display: block;
		font-size: 0.7rem;
		color: #9a9a9a;
	}
```

- [ ] **Step 4: Verificar tipos**

Run: `npm run check`
Expected: sin errores nuevos en `OptionCard.svelte`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/elegirplan/OptionCard.svelte
git commit -m "feat(elegirplan): agregar subPrice opcional a OptionCard"
```

---

### Task 4: Paso Internet del wizard — pasar `subPrice`

**Files:**
- Modify: `src/lib/components/elegirplan/steps/Step3Internet.svelte:34-48`

- [ ] **Step 1: Pasar el precio sin impuestos a cada `OptionCard`**

Reemplazar:

```svelte
			<OptionCard
				title={plan.label}
				subtitle={speedLabel(plan.mb)}
				subtitleStrong={true}
				tag={plan.tag}
				price={formatPrice(wizard.precios[plan.key])}
				details={plan.features}
```

por:

```svelte
			<OptionCard
				title={plan.label}
				subtitle={speedLabel(plan.mb)}
				subtitleStrong={true}
				tag={plan.tag}
				price={formatPrice(wizard.precios[plan.key])}
				subPrice={wizard.sinImpuestos[plan.key] ? `Sin impuestos nacionales: ${formatPrice(wizard.sinImpuestos[plan.key])}` : ''}
				details={plan.features}
```

(el resto de las props, `showCheck`, `onSymmetricInfo`, etc., quedan igual).

- [ ] **Step 2: Verificar tipos**

Run: `npm run check`
Expected: sin errores nuevos en `Step3Internet.svelte`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/elegirplan/steps/Step3Internet.svelte
git commit -m "feat(elegirplan): mostrar el precio sin impuestos en las tarjetas de plan de Internet"
```

---

### Task 5: `data.js` — total sin impuestos del resumen

**Files:**
- Modify: `src/lib/components/elegirplan/data.js:182-237`

- [ ] **Step 1: Escribir el test (va a fallar: `computeTotalSinImpuestos` no existe)**

No existe `data.test.js` en el proyecto — `data.js` no tiene tests unitarios propios (se verifica hoy vía `svelte-check` + prueba manual, igual que el resto del wizard). Se mantiene esa convención: este task no agrega un archivo de test nuevo, pasa directo a la implementación y se verifica en Task 6 con el navegador.

- [ ] **Step 2: Extender `summaryItems` para que cada ítem lleve `sinImpuestos`**

Reemplazar la función completa (líneas 182-227):

```js
// Ítems seleccionados (para resumen y WhatsApp). value=0 → "Consultar".
export function summaryItems(w) {
	const p = w.precios || {};
	const items = [];

	if (w.internetPlan) {
		const plan = planByKey(w.internetPlan);
		if (plan) {
			items.push({
				step: 'internet',
				label: `Internet ${plan.label} ${speedLabel(plan.mb)}`,
				value: Number(p[plan.key]) || 0
			});
		}
	}

	if (w.tvPlatform) {
		const tv = tvByKey(w.tvPlatform);
		if (tv) {
			const free = w.promo && w.tvPlatform === PROMO.tvGratis;
			const listValue = Number(p[tv.field]) || 0;
			items.push({
				step: 'tv',
				label: `TV · ${tv.label}`,
				value: free ? 0 : listValue,
				listValue,
				free
			});
		}
	}

	for (const addon of ADDONS) {
		if (w.addons?.[addon.key]) {
			const field = addon.fieldFor ? addon.fieldFor(w) : addon.field;
			const value = field ? Number(p[field]) || 0 : 0;
			items.push({
				step: addon.tvAddon ? 'tv' : 'adicionales',
				label: addon.label,
				value,
				listValue: value
			});
		}
	}

	return items;
}
```

por:

```js
// Ítems seleccionados (para resumen y WhatsApp). value=0 → "Consultar".
export function summaryItems(w) {
	const p = w.precios || {};
	const si = w.sinImpuestos || {};
	const items = [];

	if (w.internetPlan) {
		const plan = planByKey(w.internetPlan);
		if (plan) {
			items.push({
				step: 'internet',
				label: `Internet ${plan.label} ${speedLabel(plan.mb)}`,
				value: Number(p[plan.key]) || 0,
				sinImpuestos: Number(si[plan.key]) || 0
			});
		}
	}

	if (w.tvPlatform) {
		const tv = tvByKey(w.tvPlatform);
		if (tv) {
			const free = w.promo && w.tvPlatform === PROMO.tvGratis;
			const listValue = Number(p[tv.field]) || 0;
			items.push({
				step: 'tv',
				label: `TV · ${tv.label}`,
				value: free ? 0 : listValue,
				listValue,
				free,
				sinImpuestos: Number(si[tv.field]) || 0
			});
		}
	}

	for (const addon of ADDONS) {
		if (w.addons?.[addon.key]) {
			const field = addon.fieldFor ? addon.fieldFor(w) : addon.field;
			const value = field ? Number(p[field]) || 0 : 0;
			items.push({
				step: addon.tvAddon ? 'tv' : 'adicionales',
				label: addon.label,
				value,
				listValue: value,
				sinImpuestos: field ? Number(si[field]) || 0 : 0
			});
		}
	}

	return items;
}
```

- [ ] **Step 3: Agregar `computeTotalSinImpuestos`**

Reemplazar:

```js
// Total mensual (excluye lo "gratis" de la promo)
export function computeTotal(w) {
	return summaryItems(w).reduce((sum, it) => sum + (it.free ? 0 : it.value), 0);
}

// Total a precio de lista (incluye lo "gratis" a su precio sin promo)
export function computeListTotal(w) {
	return summaryItems(w).reduce((sum, it) => sum + (it.listValue ?? it.value), 0);
}
```

por:

```js
// Total mensual (excluye lo "gratis" de la promo)
export function computeTotal(w) {
	return summaryItems(w).reduce((sum, it) => sum + (it.free ? 0 : it.value), 0);
}

// Total a precio de lista (incluye lo "gratis" a su precio sin promo)
export function computeListTotal(w) {
	return summaryItems(w).reduce((sum, it) => sum + (it.listValue ?? it.value), 0);
}

// Total mensual sin impuestos nacionales (mismo criterio que computeTotal:
// excluye lo "gratis" de la promo)
export function computeTotalSinImpuestos(w) {
	return summaryItems(w).reduce((sum, it) => sum + (it.free ? 0 : it.sinImpuestos || 0), 0);
}
```

- [ ] **Step 4: Verificar tipos**

Run: `npm run check`
Expected: sin errores nuevos en `data.js`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/elegirplan/data.js
git commit -m "feat(elegirplan): agregar computeTotalSinImpuestos"
```

---

### Task 6: Resumen del wizard — mostrar el total sin impuestos

**Files:**
- Modify: `src/lib/components/elegirplan/steps/Step6Resumen.svelte`

- [ ] **Step 1: Importar y calcular el total**

Reemplazar el import de `data.js` (líneas 3-11):

```js
	import {
		STEP_TITLES,
		PROMO,
		summaryItems,
		computeTotal,
		hasConsultar,
		formatPrice,
		computeListTotal
	} from '$lib/components/elegirplan/data.js';
```

por:

```js
	import {
		STEP_TITLES,
		PROMO,
		summaryItems,
		computeTotal,
		computeTotalSinImpuestos,
		hasConsultar,
		formatPrice,
		computeListTotal
	} from '$lib/components/elegirplan/data.js';
```

Y agregar, después de la línea `let showPromoTotals = $derived(...)` (línea 20):

```js
	let totalSinImpuestos = $derived(computeTotalSinImpuestos(wizard));
```

- [ ] **Step 2: Mostrarlo bajo el total**

Reemplazar el bloque de totales + nota (líneas 54-75):

```svelte
	{#if showPromoTotals}
		<div class="total total-lista">
			<span>Total precio de lista</span>
			<s>{formatPrice(listTotal)}/mes</s>
		</div>
		<div class="total total-promo">
			<div class="promo-label">
				<span>Total con promo</span>
				<small>primeros {PROMO.mesesGratis} meses</small>
			</div>
			<strong>{formatPrice(total)}{parcial ? '*' : ''}<em>/mes</em></strong>
		</div>
	{:else}
		<div class="total">
			<span>Total mensual</span>
			<strong>{total > 0 ? formatPrice(total) : 'Consultar'}{parcial && total > 0 ? '*' : ''}</strong>
		</div>
	{/if}

	{#if parcial}
		<p class="consultar-note">* Algunos ítems se confirman al contratar.</p>
	{/if}
```

por:

```svelte
	{#if showPromoTotals}
		<div class="total total-lista">
			<span>Total precio de lista</span>
			<s>{formatPrice(listTotal)}/mes</s>
		</div>
		<div class="total total-promo">
			<div class="promo-label">
				<span>Total con promo</span>
				<small>primeros {PROMO.mesesGratis} meses</small>
			</div>
			<strong>{formatPrice(total)}{parcial ? '*' : ''}<em>/mes</em></strong>
		</div>
	{:else}
		<div class="total">
			<span>Total mensual</span>
			<strong>{total > 0 ? formatPrice(total) : 'Consultar'}{parcial && total > 0 ? '*' : ''}</strong>
		</div>
	{/if}

	{#if totalSinImpuestos > 0}
		<p class="sin-impuestos-note">Sin impuestos nacionales: {formatPrice(totalSinImpuestos)}</p>
	{/if}

	{#if parcial}
		<p class="consultar-note">* Algunos ítems se confirman al contratar.</p>
	{/if}
```

- [ ] **Step 3: Agregar el estilo**

En el bloque `<style>`, reemplazar:

```css
	.consultar-note {
		margin: 0.4rem 0 0;
		font-size: 0.75rem;
		color: #9a6cb0;
		font-weight: 300;
	}
```

por:

```css
	.sin-impuestos-note {
		margin: 0.4rem 0 0;
		font-size: 0.75rem;
		color: #9a9a9a;
		font-weight: 300;
	}
	.consultar-note {
		margin: 0.4rem 0 0;
		font-size: 0.75rem;
		color: #9a6cb0;
		font-weight: 300;
	}
```

- [ ] **Step 4: Verificar tipos**

Run: `npm run check`
Expected: sin errores nuevos en `Step6Resumen.svelte`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/elegirplan/steps/Step6Resumen.svelte
git commit -m "feat(elegirplan): mostrar el total sin impuestos nacionales en el resumen"
```

---

### Task 7: Home — fetch de `sinImpuestos` + link a `/tarifas`

**Files:**
- Modify: `src/lib/components/home/Price.svelte`

- [ ] **Step 1: Importar y agregar el estado**

Reemplazar los imports (líneas 1-7):

```js
import { onMount, tick } from "svelte";
import { slide } from "svelte/transition";
import { pb } from '$lib/pocketbase';
import { priceInfo } from "$lib/stores";
import PlanDetails from "./PlanDetails.svelte";
import SimetricoModal from "$lib/components/elegirplan/SimetricoModal.svelte";
```

por:

```js
import { onMount, tick } from "svelte";
import { slide } from "svelte/transition";
import { pb } from '$lib/pocketbase';
import { priceInfo } from "$lib/stores";
import { fetchTarifario } from '$lib/tarifario/fetchTarifario.js';
import { sinImpuestosPorCampo } from '$lib/tarifario/mapeoPrecios.js';
import PlanDetails from "./PlanDetails.svelte";
import SimetricoModal from "$lib/components/elegirplan/SimetricoModal.svelte";
```

Y agregar, después de `let precios = $state({});` (línea 9):

```js
let sinImpuestos = $state({});
```

- [ ] **Step 2: Cargar el tarifario en su propio `onMount`**

Agregar, después del `onMount` que carga `precios` (después del `});` de la línea 78):

```js

onMount(async () => {
    // Decorativo: si falla, las tarjetas siguen mostrando el precio final
    // igual que hoy, solo sin la línea de "sin impuestos nacionales".
    try {
        const { tarifasWeb } = await fetchTarifario();
        sinImpuestos = sinImpuestosPorCampo(tarifasWeb.filas);
    } catch (error) {
        console.error('Error cargando el tarifario desde PocketBase:', error);
    }
});
```

- [ ] **Step 3: Mostrar la línea chica en la tarjeta (fila, mobile + desktop cerrada)**

Reemplazar (líneas 201-205):

```svelte
                <span class="figures">
                    <span class="speed">{i.mb}<span class="unit">mb</span></span>
                    <span class="precio">{priceLabel(i.plan)}{#if !loading && precios[i.plan]}<span class="per">/mes</span>{/if}</span>
                </span>
                <span class="desc">{i.desc}</span>
```

por:

```svelte
                <span class="figures">
                    <span class="speed">{i.mb}<span class="unit">mb</span></span>
                    <span class="precio">{priceLabel(i.plan)}{#if !loading && precios[i.plan]}<span class="per">/mes</span>{/if}</span>
                </span>
                {#if sinImpuestos[i.plan]}
                    <span class="sin-impuestos">Sin impuestos nacionales: ${formatNumber(sinImpuestos[i.plan])}</span>
                {/if}
                <span class="desc">{i.desc}</span>
```

- [ ] **Step 4: Mostrar la misma línea en el panel abierto (desktop)**

Reemplazar (líneas 230-238):

```svelte
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
```

por:

```svelte
                    <div class="panel-head">
                        <span class="eyebrow">
                            <span class="plan-name">{$priceInfo[openIndex].plan}</span>
                            {#if $priceInfo[openIndex].symmetric}<span class="chip">Simétrico</span>{/if}
                        </span>
                        <span class="panel-figures">
                            <span class="panel-speed">{$priceInfo[openIndex].mb}<span class="unit">mb</span></span>
                            <span class="panel-price">{priceLabel($priceInfo[openIndex].plan)}{#if !loading && precios[$priceInfo[openIndex].plan]}<span class="per">/mes</span>{/if}</span>
                        </span>
                        {#if sinImpuestos[$priceInfo[openIndex].plan]}
                            <span class="sin-impuestos">Sin impuestos nacionales: ${formatNumber(sinImpuestos[$priceInfo[openIndex].plan])}</span>
                        {/if}
                    </div>
```

- [ ] **Step 5: Agregar el estilo de la línea chica**

En el bloque `<style>`, reemplazar:

```css
.desc {
    text-align: left;
    font-size: 0.85rem;
    color: #777;
    font-weight: 400;
}
```

por:

```css
.sin-impuestos {
    display: block;
    text-align: left;
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
```

- [ ] **Step 6: Agregar el link "Ver precios sin impuestos nacionales"**

Reemplazar (línea 267):

```svelte
<a href="/elegirplan" class="calcula-link">Calculá tu plan →</a>
```

por:

```svelte
<div class="calcula-links">
    <a href="/elegirplan" class="calcula-link">Calculá tu plan →</a>
    <a href="/tarifas" class="calcula-link calcula-link--secundario">Ver precios sin impuestos nacionales</a>
</div>
```

- [ ] **Step 7: Ajustar el estilo (mover el margen al contenedor nuevo)**

Reemplazar:

```css
.calcula-link {
    display: block;
    width: fit-content;
    margin: 1rem auto 0;
    color: var(--violeta1);
    font-size: 0.95rem;
    font-weight: 600;
    text-align: center;
    text-decoration: none;
}
.calcula-link:hover {
    color: var(--magenta);
}
```

por:

```css
.calcula-links {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
    margin: 1rem auto 0;
    width: fit-content;
}
.calcula-link {
    display: block;
    color: var(--violeta1);
    font-size: 0.95rem;
    font-weight: 600;
    text-align: center;
    text-decoration: none;
}
.calcula-link:hover {
    color: var(--magenta);
}
.calcula-link--secundario {
    font-size: 0.8rem;
    font-weight: 500;
    color: #9a9a9a;
}
.calcula-link--secundario:hover {
    color: var(--violeta1);
}
```

- [ ] **Step 8: Verificar tipos**

Run: `npm run check`
Expected: sin errores nuevos en `Price.svelte`.

- [ ] **Step 9: Commit**

```bash
git add src/lib/components/home/Price.svelte
git commit -m "feat(home): link a /tarifas y precio sin impuestos nacionales en las tarjetas de plan"
```

---

### Task 8: Verificación manual en el navegador

No hay infraestructura de test de componentes en este proyecto para `.svelte` (se verifica con `svelte-check` + prueba manual, mismo criterio que el resto del wizard y del home). Antes de dar la tarea por terminada:

- [ ] **Step 1: Levantar el server de desarrollo**

Run: `npm run dev`

- [ ] **Step 2: Verificar el home**

- Abrir `/`. Junto a "Calculá tu plan →" debe aparecer, más chico, "Ver precios sin impuestos nacionales" → al clickearlo, navega a `/tarifas`.
- Click en cualquier tarjeta de plan (ej. Home): debajo del precio debe aparecer "Sin impuestos nacionales: $20.787" (u otro valor, según el tarifario vigente). Confirmar en mobile (acordeón) y en desktop ancho (≥1024px, overlay).

- [ ] **Step 3: Verificar el wizard**

- Abrir `/elegirplan`, elegir "Solo Internet" (o el camino que lleve al paso de Internet). Cada tarjeta de plan debe mostrar, debajo de "/mes", "Sin impuestos nacionales: $X".
- Avanzar hasta el resumen final: debajo del total mensual (o del total con promo) debe aparecer "Sin impuestos nacionales: $X" con el total sumado.

- [ ] **Step 4: Confirmar que no rompe si el tarifario no carga**

- En las devtools, con la pestaña Network, bloquear temporalmente la request a la colección `tarifario` de PocketBase (o cortar la red un instante durante la carga) y recargar `/` y `/elegirplan`. Las tarjetas y el resumen deben seguir mostrando el precio final normalmente, solo sin las líneas de "sin impuestos nacionales" — nada debe romperse ni quedar en loading infinito.

- [ ] **Step 5: Correr toda la suite y el chequeo de tipos una vez más, de punta a punta**

Run: `npm run test && npm run check`
Expected: PASS / sin errores.
