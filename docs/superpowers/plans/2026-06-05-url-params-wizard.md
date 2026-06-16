# URL params en wizard `elegirplan` / `elegirtv` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reflejar cada paso y selección del wizard en la URL (query params), de modo que copiar/pegar un enlace reabra el wizard en ese paso con esas selecciones.

**Architecture:** Las funciones puras de serialización (`buildPlanParams`), parseo (`parsePlanParams`) y clamp (`clampStep`) viven en `data.js` y se testean con Vitest. `wizardState.svelte.js` agrega glue runes-aware (`hydrateFromParams`, `toSearchString`). `ElegirPlanWizard.svelte` corre dos `$effect`: uno hidrata el estado desde `$page.url` (cubre paste / Back / Forward), otro serializa el estado a la URL vía `goto` (push si cambió el paso, replace si sólo cambió una selección). Guard bidireccional comparando query strings canónicas para evitar el loop. `/tv/elegirtv` deriva el modal abierto (`openKey`) directamente de `?tv=`.

**Tech Stack:** SvelteKit 2.9 (adapter-static), Svelte 5 runes, Vitest (nuevo), `$app/stores` + `$app/navigation`.

---

## File Structure

- `vite.config.js` — **modificar**: agregar bloque `test` de Vitest (reusa `sveltekit()` para el alias `$lib`).
- `package.json` — **modificar**: dep `vitest` + scripts `test` / `test:watch`.
- `src/lib/components/elegirplan/data.js` — **modificar**: constantes de claves (`STEP_KEYS`, `PLAN_KEYS`, `TV_KEYS`, `ADDON_KEYS`) + `clampStep`, `buildPlanParams`, `parsePlanParams` (puras).
- `src/lib/components/elegirplan/data.test.js` — **crear**: tests de las 3 funciones puras.
- `src/lib/components/elegirplan/wizardState.svelte.js` — **modificar**: `hydrateFromParams(searchParams)` y `toSearchString(w)`; `resetWizard` se mantiene pero deja de llamarse en mount.
- `src/lib/components/elegirplan/ElegirPlanWizard.svelte` — **modificar**: dos `$effect` (hidratar / serializar) + quitar `resetWizard()` del `onMount`.
- `src/routes/tv/elegirtv/+page.svelte` — **modificar**: `openKey` pasa a `$derived` de `?tv=`; abrir/cerrar modal navega.

---

## Task 1: Setup de Vitest

**Files:**
- Modify: `package.json`
- Modify: `vite.config.js`
- Test: `src/lib/components/elegirplan/data.test.js` (test temporal de smoke)

- [ ] **Step 1: Instalar Vitest**

Run:
```bash
npm install -D vitest
```
Expected: agrega `vitest` a `devDependencies`, sin errores.

- [ ] **Step 2: Configurar el bloque `test` en `vite.config.js`**

Reemplazar el contenido completo de `vite.config.js` por:
```js
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		environment: 'node'
	}
});
```
(El import de `defineConfig` cambia de `'vite'` a `'vitest/config'`; el plugin `sveltekit()` provee el alias `$lib` a los tests.)

- [ ] **Step 3: Agregar scripts de test en `package.json`**

En el bloque `"scripts"`, agregar:
```json
		"test": "vitest run",
		"test:watch": "vitest"
```
(Queda: `dev`, `build`, `preview`, `test`, `test:watch`.)

- [ ] **Step 4: Escribir un test de smoke que importa por alias `$lib`**

Crear `src/lib/components/elegirplan/data.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { formatPrice } from '$lib/components/elegirplan/data.js';

describe('vitest setup', () => {
	it('resuelve el alias $lib e importa data.js', () => {
		expect(formatPrice(1000)).toBe('$1.000');
	});
});
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `npm test`
Expected: PASS (1 test). Confirma que Vitest corre y `$lib` resuelve.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vite.config.js src/lib/components/elegirplan/data.test.js
git commit -m "chore: setup de Vitest para helpers del wizard

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: `clampStep` — clamp al paso válido más lejano

**Files:**
- Modify: `src/lib/components/elegirplan/data.js`
- Test: `src/lib/components/elegirplan/data.test.js`

- [ ] **Step 1: Escribir los tests de `clampStep` (fallan)**

Agregar a `src/lib/components/elegirplan/data.test.js` (debajo del smoke test, dentro del archivo):
```js
import { clampStep } from '$lib/components/elegirplan/data.js';

describe('clampStep', () => {
	it('sin selecciones, cualquier paso pedido cae en "tipo"', () => {
		expect(clampStep({}, 'resumen')).toBe('tipo');
		expect(clampStep({ tipo: null }, 'internet')).toBe('tipo');
	});

	it('combo TV+promo completo permite "resumen"', () => {
		const w = { tipo: 'tv', promo: true, internetPlan: 'power', tvPlatform: 'gigared' };
		expect(clampStep(w, 'resumen')).toBe('resumen');
	});

	it('rama internet sin plan no pasa de "internet"', () => {
		const w = { tipo: 'internet', internetPlan: null };
		expect(clampStep(w, 'resumen')).toBe('internet');
	});

	it('rama internet con plan permite "adicionales"', () => {
		const w = { tipo: 'internet', internetPlan: 'home' };
		expect(clampStep(w, 'adicionales')).toBe('adicionales');
	});

	it('rama TV "armar" sin plan no pasa de "internet"', () => {
		const w = { tipo: 'tv', promo: false, internetPlan: null };
		expect(clampStep(w, 'tv')).toBe('internet');
	});

	it('rama TV con plan pero sin plataforma no pasa de "tv"', () => {
		const w = { tipo: 'tv', promo: false, internetPlan: 'power', tvPlatform: null };
		expect(clampStep(w, 'resumen')).toBe('tv');
	});

	it('paso pedido fuera del flow cae al paso válido más lejano', () => {
		// "tv" no existe en el flow de internet → cae a "internet" (plan presente)
		const w = { tipo: 'internet', internetPlan: 'home' };
		expect(clampStep(w, 'tv')).toBe('internet');
	});
});
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `npm test`
Expected: FAIL — `clampStep is not a function` / no exportada.

- [ ] **Step 3: Implementar `clampStep` en `data.js`**

Al final de `data.js` (después de `getFlow`), agregar:
```js
// Requisito para "pasar" cada paso (estar más allá de él). promo/adicionales/
// resumen no bloquean: la rama ya quedó codificada en tipo/promo.
const STEP_REQUIREMENT = {
	tipo: (w) => !!w.tipo,
	internet: (w) => !!w.internetPlan,
	tv: (w) => !!w.tvPlatform
};

// Devuelve el paso válido más lejano: nunca más allá de un requisito sin cumplir.
// Si requestedStep no está en el flow vigente, cae al paso más lejano alcanzable.
export function clampStep(w, requestedStep) {
	const flow = getFlow(w);
	let furthest = 0;
	for (let i = 0; i < flow.length; i++) {
		furthest = i;
		const req = STEP_REQUIREMENT[flow[i]];
		if (req && !req(w)) break; // se puede estar EN i, no pasar de i
	}
	const reqIdx = flow.indexOf(requestedStep);
	const target = reqIdx < 0 ? furthest : Math.min(reqIdx, furthest);
	return flow[target];
}
```

- [ ] **Step 4: Correr y verificar que pasan**

Run: `npm test`
Expected: PASS (todos los tests de `clampStep` + smoke).

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/elegirplan/data.js src/lib/components/elegirplan/data.test.js
git commit -m "feat: clampStep para deep-link al paso válido más lejano

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: `buildPlanParams` — estado → URLSearchParams

**Files:**
- Modify: `src/lib/components/elegirplan/data.js`
- Test: `src/lib/components/elegirplan/data.test.js`

- [ ] **Step 1: Escribir los tests de `buildPlanParams` (fallan)**

Agregar a `data.test.js`:
```js
import { buildPlanParams } from '$lib/components/elegirplan/data.js';

describe('buildPlanParams', () => {
	it('estado default sólo serializa el paso', () => {
		const w = { step: 'tipo', tipo: null, internetPlan: null, tvPlatform: null, promo: false, addons: {} };
		expect(buildPlanParams(w).toString()).toBe('paso=tipo');
	});

	it('combo completo serializa todos los params en orden', () => {
		const w = {
			step: 'adicionales',
			tipo: 'tv',
			internetPlan: 'power',
			tvPlatform: 'gigared',
			promo: true,
			addons: { pack_futbol: false, cine: true, telefono: false }
		};
		// URLSearchParams codifica la coma como %2C
		expect(decodeURIComponent(buildPlanParams(w).toString())).toBe(
			'paso=adicionales&tipo=tv&plan=power&tv=gigared&promo=1&add=cine'
		);
	});

	it('promo false se omite; varios adicionales van separados por coma', () => {
		const w = {
			step: 'adicionales',
			tipo: 'internet',
			internetPlan: 'home',
			tvPlatform: null,
			promo: false,
			addons: { pack_futbol: true, cine: false, telefono: true }
		};
		expect(decodeURIComponent(buildPlanParams(w).toString())).toBe(
			'paso=adicionales&tipo=internet&plan=home&add=pack_futbol,telefono'
		);
	});
});
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `npm test`
Expected: FAIL — `buildPlanParams is not a function`.

- [ ] **Step 3: Implementar constantes de claves + `buildPlanParams`**

En `data.js`, debajo de la definición de `ADDONS` (línea ~34) agregar las constantes de claves:
```js
// Claves válidas para los params de URL (orden canónico de serialización).
export const STEP_KEYS = ['tipo', 'promo', 'internet', 'tv', 'adicionales', 'resumen'];
export const PLAN_KEYS = INTERNET_PLANS.map((p) => p.key);
export const TV_KEYS = ['gigared', 'antina', 'dgo'];
export const ADDON_KEYS = ADDONS.map((a) => a.key); // pack_futbol, cine, telefono
```

Al final de `data.js` agregar:
```js
// Estado → URLSearchParams canónica. Params omitidos = no seleccionado.
export function buildPlanParams(w) {
	const sp = new URLSearchParams();
	if (w.step) sp.set('paso', w.step);
	if (w.tipo) sp.set('tipo', w.tipo);
	if (w.internetPlan) sp.set('plan', w.internetPlan);
	if (w.tvPlatform) sp.set('tv', w.tvPlatform);
	if (w.promo) sp.set('promo', '1');
	const adds = ADDON_KEYS.filter((k) => w.addons?.[k]);
	if (adds.length) sp.set('add', adds.join(','));
	return sp;
}
```

- [ ] **Step 4: Correr y verificar que pasan**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/elegirplan/data.js src/lib/components/elegirplan/data.test.js
git commit -m "feat: buildPlanParams + constantes de claves de URL

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: `parsePlanParams` — URLSearchParams → estado plano

**Files:**
- Modify: `src/lib/components/elegirplan/data.js`
- Test: `src/lib/components/elegirplan/data.test.js`

- [ ] **Step 1: Escribir los tests de `parsePlanParams` (fallan)**

Agregar a `data.test.js`:
```js
import { parsePlanParams } from '$lib/components/elegirplan/data.js';

describe('parsePlanParams', () => {
	it('URL vacía devuelve defaults (paso "tipo", todo null/false)', () => {
		const r = parsePlanParams(new URLSearchParams(''));
		expect(r).toEqual({
			step: 'tipo',
			tipo: null,
			internetPlan: null,
			tvPlatform: null,
			promo: false,
			addons: { pack_futbol: false, cine: false, telefono: false }
		});
	});

	it('parsea un combo completo', () => {
		const r = parsePlanParams(
			new URLSearchParams('paso=adicionales&tipo=tv&plan=power&tv=gigared&promo=1&add=cine,telefono')
		);
		expect(r).toEqual({
			step: 'adicionales',
			tipo: 'tv',
			internetPlan: 'power',
			tvPlatform: 'gigared',
			promo: true,
			addons: { pack_futbol: false, cine: true, telefono: true }
		});
	});

	it('descarta valores inválidos', () => {
		const r = parsePlanParams(
			new URLSearchParams('paso=zzz&tipo=foo&plan=ultra&tv=netflix&add=hack')
		);
		expect(r.step).toBe('tipo'); // paso inválido → default
		expect(r.tipo).toBeNull();
		expect(r.internetPlan).toBeNull();
		expect(r.tvPlatform).toBeNull();
		expect(r.addons).toEqual({ pack_futbol: false, cine: false, telefono: false });
	});
});
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `npm test`
Expected: FAIL — `parsePlanParams is not a function`.

- [ ] **Step 3: Implementar `parsePlanParams`**

Al final de `data.js`:
```js
// URLSearchParams → objeto plano validado (sin clamp del paso; eso lo hace
// clampStep una vez que el estado tiene tipo/promo). Valores inválidos → null.
export function parsePlanParams(sp) {
	const oneOf = (val, allowed) => (allowed.includes(val) ? val : null);
	const addRaw = (sp.get('add') || '').split(',').filter(Boolean);
	return {
		step: oneOf(sp.get('paso'), STEP_KEYS) || 'tipo',
		tipo: oneOf(sp.get('tipo'), ['internet', 'tv']),
		internetPlan: oneOf(sp.get('plan'), PLAN_KEYS),
		tvPlatform: oneOf(sp.get('tv'), TV_KEYS),
		promo: sp.get('promo') === '1',
		addons: {
			pack_futbol: addRaw.includes('pack_futbol'),
			cine: addRaw.includes('cine'),
			telefono: addRaw.includes('telefono')
		}
	};
}
```

- [ ] **Step 4: Correr y verificar que pasan**

Run: `npm test`
Expected: PASS (suite completa de `data.test.js`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/elegirplan/data.js src/lib/components/elegirplan/data.test.js
git commit -m "feat: parsePlanParams con validación de valores

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Glue en `wizardState.svelte.js`

**Files:**
- Modify: `src/lib/components/elegirplan/wizardState.svelte.js`

(Sin unit test: estas funciones mutan el singleton `$state`; se verifican vía build + navegador en Tasks 6–8.)

- [ ] **Step 1: Actualizar imports de `data.js`**

En `wizardState.svelte.js`, la línea 10 actual:
```js
import { getFlow, PROMO } from './data.js';
```
reemplazar por:
```js
import { getFlow, PROMO, clampStep, buildPlanParams, parsePlanParams } from './data.js';
```

- [ ] **Step 2: Agregar `toSearchString` y `hydrateFromParams`**

Al final de `wizardState.svelte.js` (después de `resetWizard`), agregar:
```js
// --- Sincronización con la URL --------------------------------------------

// Query string canónica del estado actual (para el guard del loop y para goto).
export function toSearchString() {
	return buildPlanParams({
		step: wizard.step,
		tipo: wizard.tipo,
		internetPlan: wizard.internetPlan,
		tvPlatform: wizard.tvPlatform,
		promo: wizard.promo,
		addons: wizard.addons
	}).toString();
}

// Hidrata el estado desde los params de la URL. Aplica las selecciones válidas
// y clampea el paso al más lejano permitido. Resetea overlays transitorios
// (reemplaza a resetWizard en el mount). `precios`/`loading` se conservan.
export function hydrateFromParams(searchParams) {
	const p = parsePlanParams(searchParams);
	wizard.tipo = p.tipo;
	wizard.internetPlan = p.internetPlan;
	wizard.tvPlatform = p.tvPlatform;
	wizard.promo = p.promo;
	wizard.addons.pack_futbol = p.addons.pack_futbol;
	wizard.addons.cine = p.addons.cine;
	wizard.addons.telefono = p.addons.telefono;
	// overlays efímeros (no viven en la URL)
	wizard.showRecom = false;
	wizard.tvCheck = null;
	wizard.pendingPromo = false;
	wizard.recom.usos = [];
	wizard.recom.personas = null;
	// el paso, clampeado contra el estado ya aplicado
	wizard.step = clampStep(wizard, p.step);
}
```

- [ ] **Step 3: Verificar que el proyecto compila**

Run: `npm run build`
Expected: build OK (sin errores de import/sintaxis).

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/elegirplan/wizardState.svelte.js
git commit -m "feat: hydrateFromParams y toSearchString en wizardState

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Sincronización bidireccional en `ElegirPlanWizard.svelte`

**Files:**
- Modify: `src/lib/components/elegirplan/ElegirPlanWizard.svelte`

- [ ] **Step 1: Agregar imports de navegación**

En el `<script>` de `ElegirPlanWizard.svelte`, debajo de `import { fly } from 'svelte/transition';` (línea 3), agregar:
```js
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
```
Y en el import de `wizardState.svelte.js` (líneas 16–22), agregar `hydrateFromParams` y `toSearchString` a la lista de imports:
```js
	import {
		wizard,
		resetWizard,
		prev,
		confirmTv,
		cancelTvCheck,
		hydrateFromParams,
		toSearchString
	} from './wizardState.svelte.js';
```

- [ ] **Step 2: Reemplazar `resetWizard()` por hidratación inicial en `onMount`**

En el `onMount` actual (líneas 37–49), reemplazar la línea `resetWizard();` por:
```js
		hydrateFromParams($page.url.searchParams);
```
(El resto del `onMount` —fetch de precios desde PB, `mounted = true`— queda igual. `resetWizard` sigue exportada/importada para uso futuro pero ya no se llama acá.)

- [ ] **Step 3: Agregar los dos `$effect` de sincronización**

Inmediatamente después del `onMount` (antes del `$effect` de scroll en la línea ~52), agregar:
```js
	// URL → estado: cubre paste, Back y Forward. Guard: si la URL ya coincide con
	// el estado serializado, no hace nada (corta el loop URL→estado→URL).
	$effect(() => {
		const incoming = $page.url.searchParams; // dependencia reactiva
		if (!browser) return;
		if (incoming.toString() === toSearchString()) return;
		hydrateFromParams(incoming);
	});

	// estado → URL: push si cambió el paso (Back = paso anterior), replace si sólo
	// cambió una selección. Guard: si ya coincide, no navega.
	let lastStep = wizard.step;
	$effect(() => {
		const target = toSearchString(); // depende de step + selecciones
		if (!browser) return;
		if (target === $page.url.searchParams.toString()) return;
		const stepChanged = wizard.step !== lastStep;
		lastStep = wizard.step;
		goto('?' + target, { replaceState: !stepChanged, noScroll: true, keepFocus: true });
	});
```

- [ ] **Step 4: Verificar build**

Run: `npm run build`
Expected: build OK.

- [ ] **Step 5: Verificar en el navegador**

Run: `npm run dev` (dejar corriendo) y abrir `http://localhost:5173/elegirplan`.
Verificar manualmente:
1. Al cargar, la URL se normaliza a `?paso=tipo`.
2. Elegir "Solo Internet" → `?paso=internet&tipo=internet` (paso nuevo = entrada de historial).
3. Elegir un plan → `&plan=...` se agrega **sin** nueva entrada (replace).
4. Avanzar a adicionales → `?paso=adicionales`; el botón **Atrás del navegador** vuelve a `internet` con el plan seleccionado.
5. Pegar `http://localhost:5173/elegirplan?paso=resumen` en una pestaña nueva → aterriza en `tipo` (clamp).
6. Pegar `http://localhost:5173/elegirplan?paso=adicionales&tipo=internet&plan=home` → aterriza en `adicionales` con Home elegido.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/elegirplan/ElegirPlanWizard.svelte
git commit -m "feat: sincronizar wizard elegirplan con la URL (paso + selecciones)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: `?tv=` en `/tv/elegirtv`

**Files:**
- Modify: `src/routes/tv/elegirtv/+page.svelte`

- [ ] **Step 1: Agregar imports de navegación**

En el `<script>` de `src/routes/tv/elegirtv/+page.svelte`, debajo de `import { onMount } from 'svelte';` (línea 1), agregar:
```js
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
```

- [ ] **Step 2: Derivar `openKey` desde `?tv=` y navegar al abrir/cerrar**

Reemplazar las líneas 17–21 actuales:
```js
	let openKey = $state(null); // servicio con modal abierto
	let grillaKey = $state(null); // servicio con grilla abierta

	let openService = $derived(openKey ? serviceByKey(openKey) : null);
	let grillaService = $derived(grillaKey ? serviceByKey(grillaKey) : null);
```
por:
```js
	let grillaKey = $state(null); // servicio con grilla abierta (efímero, no en URL)

	// El modal abierto es función de la URL: ?tv=dgo|antina|gigared.
	let openKey = $derived.by(() => {
		const tv = $page.url.searchParams.get('tv');
		return serviceByKey(tv) ? tv : null;
	});
	let openService = $derived(openKey ? serviceByKey(openKey) : null);
	let grillaService = $derived(grillaKey ? serviceByKey(grillaKey) : null);

	// Abrir/cerrar el modal = navegar (push), así Back cierra el modal.
	function openModal(key) {
		const sp = new URLSearchParams($page.url.searchParams);
		sp.set('tv', key);
		goto('?' + sp.toString(), { noScroll: true, keepFocus: true });
	}
	function closeModal() {
		const sp = new URLSearchParams($page.url.searchParams);
		sp.delete('tv');
		goto('?' + sp.toString(), { noScroll: true, keepFocus: true });
	}
```

- [ ] **Step 3: Conectar las tarjetas, el recomendador y el modal a las nuevas funciones**

En el markup, reemplazar `onOpen={() => (openKey = service.key)}` (línea ~76) por:
```svelte
					onOpen={() => openModal(service.key)}
```
Reemplazar `onPick={(key) => (openKey = key)}` (línea ~83, dentro de `<AyudameElegirTv>`) por:
```svelte
			<AyudameElegirTv {precios} onPick={(key) => openModal(key)} />
```
Reemplazar `onclose={() => (openKey = null)}` del `<TvServiceModal>` (línea ~94) por:
```svelte
		onclose={() => closeModal()}
```
(El `onConfirm` de WhatsApp y todo lo de `grillaKey`/`GrillaViewer` queda igual.)

- [ ] **Step 4: Verificar build**

Run: `npm run build`
Expected: build OK.

- [ ] **Step 5: Verificar en el navegador**

Con `npm run dev` corriendo, abrir `http://localhost:5173/tv/elegirtv`.
1. Tocar una tarjeta (ej. DGO) → URL pasa a `?tv=dgo` y el modal abre.
2. **Atrás del navegador** → URL vuelve sin `tv` y el modal cierra.
3. Pegar `http://localhost:5173/tv/elegirtv?tv=antina` en pestaña nueva → abre el modal de Antina al cargar.
4. `?tv=zzz` (inválido) → no abre ningún modal.

- [ ] **Step 6: Commit**

```bash
git add src/routes/tv/elegirtv/+page.svelte
git commit -m "feat: ?tv= abre/comparte el modal de servicio en /tv/elegirtv

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Verificación final del flujo completo

**Files:** (ninguno — verificación)

- [ ] **Step 1: Correr la suite de tests**

Run: `npm test`
Expected: PASS (smoke + clampStep + buildPlanParams + parsePlanParams).

- [ ] **Step 2: Build de producción**

Run: `npm run build`
Expected: build OK, sin warnings nuevos relevantes.

- [ ] **Step 3: Verificación end-to-end en el navegador (rama TV+promo)**

Con `npm run dev`, en `/elegirplan`:
1. Elegir "Internet + TV" → `?paso=promo&tipo=tv`.
2. Confirmar la promo (pasa por TvCheckModal) → `?paso=adicionales&tipo=tv&promo=1&plan=power&tv=gigared`.
3. Copiar esa URL, abrir en pestaña nueva → aterriza en `adicionales` con Power + Gigared + promo aplicada y total correcto.
4. Tildar un adicional → la URL suma `&add=...` sin nueva entrada de historial.
5. Avanzar a `resumen`, verificar que el combo y el total coinciden con la selección de la URL.
6. Recargar la página en `resumen` → se mantiene el estado.

- [ ] **Step 4: Confirmar que no hay loop de navegación**

En cualquier paso, observar que la URL se estabiliza tras cada acción (no parpadea ni queda navegando en bucle) y que la consola del navegador no muestra warnings de `goto`/efectos en loop.

- [ ] **Step 5: Commit final (si quedó algún ajuste)**

```bash
git add -A
git commit -m "test: verificación end-to-end de URL params en el wizard

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```
(Si no hubo cambios, omitir este commit.)

---

## Notas de verificación / riesgos

- **`$app/stores` vs `$app/state`:** se usa `$app/stores` (`page`) por compatibilidad con SvelteKit ^2.9 (`$app/state` recién aparece en 2.12). El acceso `$page.url` es reactivo dentro de `$effect`.
- **Guard del loop:** ambos `$effect` comparan `toSearchString()` contra `$page.url.searchParams.toString()` antes de actuar; la sincronización se estabiliza en una pasada. Es el punto más delicado: verificarlo explícitamente en Task 8 Step 4.
- **`resetWizard`** queda definida y exportada (puede usarse a futuro / botón "empezar de nuevo") pero ya no se invoca en mount; la hidratación desde URL cumple su rol.
- **Adapter estático + SSR:** los `$effect`/`onMount` corren sólo en cliente; el guard `if (!browser) return` es defensivo.
