# Merge de elegirtv en el paso de TV del wizard — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer que el paso de TV del wizard `/elegirplan` muestre la estructura rica de `/tv/elegirtv` (aviso, tarjetas con features, grilla, recomendador, modal de detalle con adicionales), pero continuando el flujo del wizard en vez de ir directo a WhatsApp.

**Architecture:** Se promueven los componentes de TV a `$lib/components/tv/` (una sola fuente de verdad). `TvServiceModal` se vuelve flow-agnóstico vía un callback `onConfirm`. La página `/tv/elegirtv` pasa un `onConfirm` que abre WhatsApp; el paso `Step4TV` del wizard pasa un `onConfirm` que commitea la TV + adicionales al estado del wizard y avanza. `TV_SERVICES` queda como única fuente de datos de TV; `tvByKey` en `data.js` se vuelve un adaptador sobre `serviceByKey`.

**Tech Stack:** SvelteKit 2 + Svelte 5 (runes), Vite 6, PocketBase. **No hay test runner** en el proyecto: el gate automático por tarea es `npm run build` (catchea errores de import/sintaxis) + chequeo manual con `npm run dev`.

---

## Estructura de archivos

**Crear (mover) — `$lib/components/tv/`:**
- `tvData.js` (desde `src/routes/tv/elegirtv/tvData.js`)
- `TvServiceCard.svelte` (íd.) — se le agrega prop opcional `selected`
- `TvServiceModal.svelte` (íd.) — parametrizado con `onConfirm` / `initialSelected` / `ctaLabel` / `ctaClass`
- `GrillaViewer.svelte` (íd.)
- `InfoModal.svelte` (íd.)
- `AyudameElegirTv.svelte` (íd.)

**Modificar:**
- `src/routes/tv/elegirtv/+page.svelte` — imports a `$lib/components/tv/...` + `onConfirm` con `buildTvWhatsappUrl`
- `src/lib/components/elegirplan/data.js` — drop `TV_PLATFORMS`, `tvByKey` adaptador, `ADDONS` con `tvAddon` + `cine`, `summaryItems` step de TV-addons
- `src/lib/components/elegirplan/wizardState.svelte.js` — `cine` en addons + `chooseTvService`
- `src/lib/components/elegirplan/steps/Step4TV.svelte` — reconstruido
- `src/lib/components/elegirplan/steps/Step5Adicionales.svelte` — filtra `tvAddon`

**Sin cambios (verificar que siguen funcionando):** `ElegirPlanWizard.svelte` (usa `tvByKey` adaptado), `Step2Promo.svelte` (usa `tvByKey` adaptado), `Step6Resumen.svelte` (usa `editItem`, ya cubre `step:'tv'`), `TvCheckModal.svelte`.

---

## Task 1: Mover los componentes de TV a `$lib/components/tv/`

**Files:**
- Create (move): `src/lib/components/tv/{tvData.js,TvServiceCard.svelte,TvServiceModal.svelte,GrillaViewer.svelte,InfoModal.svelte,AyudameElegirTv.svelte}`
- Modify: `src/routes/tv/elegirtv/+page.svelte` (imports)

Los archivos están sin trackear, así que se mueven con `mv` plano. Los imports internos `./tvData.js` y `$lib/...` siguen siendo válidos tras el movimiento (misma carpeta / rutas absolutas). Solo cambian los imports `./X` del `+page.svelte`.

- [ ] **Step 1: Crear la carpeta y mover los archivos**

```bash
cd "$(git rev-parse --show-toplevel)"
mkdir -p src/lib/components/tv
mv src/routes/tv/elegirtv/tvData.js src/lib/components/tv/tvData.js
mv src/routes/tv/elegirtv/TvServiceCard.svelte src/lib/components/tv/TvServiceCard.svelte
mv src/routes/tv/elegirtv/TvServiceModal.svelte src/lib/components/tv/TvServiceModal.svelte
mv src/routes/tv/elegirtv/GrillaViewer.svelte src/lib/components/tv/GrillaViewer.svelte
mv src/routes/tv/elegirtv/InfoModal.svelte src/lib/components/tv/InfoModal.svelte
mv src/routes/tv/elegirtv/AyudameElegirTv.svelte src/lib/components/tv/AyudameElegirTv.svelte
```

- [ ] **Step 2: Actualizar los imports en `/tv/elegirtv/+page.svelte`**

En `src/routes/tv/elegirtv/+page.svelte`, reemplazar el bloque de imports (líneas ~6-11):

```svelte
	import { TV_SERVICES, serviceByKey } from '$lib/components/tv/tvData.js';
	import TvServiceCard from '$lib/components/tv/TvServiceCard.svelte';
	import TvServiceModal from '$lib/components/tv/TvServiceModal.svelte';
	import GrillaViewer from '$lib/components/tv/GrillaViewer.svelte';
	import InfoModal from '$lib/components/tv/InfoModal.svelte';
	import AyudameElegirTv from '$lib/components/tv/AyudameElegirTv.svelte';
```

- [ ] **Step 3: Build para verificar que no hay imports rotos**

Run: `npm run build`
Expected: build exitoso (sin errores de "Could not resolve import").

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/tv src/routes/tv/elegirtv/+page.svelte
git commit -m "refactor: mover componentes de TV a \$lib/components/tv"
```

---

## Task 2: Parametrizar `TvServiceModal` y mover el WhatsApp al page de elegirtv

**Files:**
- Modify: `src/lib/components/tv/TvServiceModal.svelte`
- Modify: `src/routes/tv/elegirtv/+page.svelte`

El modal deja de armar la URL de WhatsApp; ahora llama a `onConfirm(service, chosenAddons)` tras confirmar el chequeo de instalación. El armado de WhatsApp se mueve al `+page.svelte` de elegirtv (evita el ciclo de imports tvData.js ↔ data.js, porque `buildTvWhatsappUrl` vive en el componente de página que ya importa `data.js`).

- [ ] **Step 1: Cambiar las props del modal**

En `src/lib/components/tv/TvServiceModal.svelte`, reemplazar la línea de props (línea ~9):

```svelte
	let {
		service,
		precios = {},
		onGrilla,
		onclose,
		onConfirm,
		initialSelected = {},
		ctaLabel = 'Lo quiero',
		ctaClass = 'btn-whatsapp'
	} = $props();
```

- [ ] **Step 2: Sembrar la selección inicial y quitar el armado de WhatsApp**

En el mismo archivo, reemplazar la inicialización del estado `selected` (línea ~13):

```svelte
	let selected = $state({ ...initialSelected });
```

Eliminar por completo el bloque `whatsappUrl` derivado (líneas ~59-67, el `let whatsappUrl = $derived.by(() => { ... });`). El import de `WHATSAPP_PHONE` ya no se usa: en la línea de import (línea ~5) dejar solo:

```svelte
	import { formatPrice } from '$lib/components/elegirplan/data.js';
```

- [ ] **Step 3: Cambiar `confirmInstall` para delegar en `onConfirm`**

Reemplazar la función `confirmInstall` (líneas ~30-33):

```svelte
	// Confirmó "La instalé, funciona" → delega la acción final al contenedor.
	function confirmInstall() {
		onConfirm?.(service, chosenAddons);
		showInstall = false;
	}
```

- [ ] **Step 4: Parametrizar el botón CTA**

En el bloque de la vista `total`, reemplazar el botón "Lo quiero" (línea ~193):

```svelte
			<button class="btn-full cta {ctaClass}" onclick={() => (showInstall = true)}>
				{ctaLabel}
			</button>
```

- [ ] **Step 5: Pasar `onConfirm` desde el page de elegirtv**

En `src/routes/tv/elegirtv/+page.svelte`, dentro del `<script>`, agregar el helper de WhatsApp (debajo de los `import`, usando `WHATSAPP_PHONE` y `formatPrice` de `data.js`):

```svelte
	import { formatPrice, WHATSAPP_PHONE } from '$lib/components/elegirplan/data.js';

	function buildTvWhatsappUrl(service, chosenAddons) {
		const tvVal = Number(precios[service.priceField]) || 0;
		const lineLabel = (v) => (v > 0 ? `${formatPrice(v)}/mes` : 'Consultar');
		const items = [
			{ label: service.label, value: tvVal },
			...chosenAddons.map((a) => ({ label: a.label, value: Number(precios[a.field]) || 0 }))
		];
		const total = items.reduce((s, it) => s + it.value, 0);
		const lines = [`Me interesa el servicio de TV ${service.label} (${lineLabel(tvVal)})`];
		if (chosenAddons.length) lines.push(`Adicionales: ${chosenAddons.map((a) => a.label).join(', ')}`);
		lines.push(`Total: ${total > 0 ? `${formatPrice(total)}/mes` : 'a consultar'}`);
		return `https://api.whatsapp.com/send?phone=${WHATSAPP_PHONE}&text=${encodeURIComponent(lines.join('\n'))}`;
	}
```

En el markup, actualizar el `<TvServiceModal>` (línea ~91) para pasar `onConfirm`:

```svelte
	<TvServiceModal
		service={openService}
		{precios}
		onGrilla={() => (grillaKey = openService.key)}
		onConfirm={(service, addons) => window.open(buildTvWhatsappUrl(service, addons), '_blank', 'noopener')}
		onclose={() => (openKey = null)}
	/>
```

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: build exitoso.

- [ ] **Step 7: Chequeo manual de elegirtv**

Run: `npm run dev` y abrir `http://localhost:5173/tv/elegirtv`
Expected: abrir una tarjeta → Continuar → "Lo quiero" → chequeo de instalación → "La instalé, funciona" abre WhatsApp con el mensaje del servicio + adicionales (mismo texto que antes).

- [ ] **Step 8: Commit**

```bash
git add src/lib/components/tv/TvServiceModal.svelte src/routes/tv/elegirtv/+page.svelte
git commit -m "refactor: TvServiceModal flow-agnostico via onConfirm"
```

---

## Task 3: `data.js` — TV_SERVICES como única fuente, ADDONS con `tvAddon` + Cine

**Files:**
- Modify: `src/lib/components/elegirplan/data.js`

- [ ] **Step 1: Importar `serviceByKey` y eliminar `TV_PLATFORMS`**

En `src/lib/components/elegirplan/data.js`, al inicio (después del comentario de cabecera, antes de `WHATSAPP_PHONE`), agregar el import:

```js
import { serviceByKey } from '$lib/components/tv/tvData.js';
```

Eliminar por completo el bloque `export const TV_PLATFORMS = [ ... ];` (líneas ~25-33, incluyendo su comentario).

- [ ] **Step 2: Convertir `tvByKey` en adaptador sobre `serviceByKey`**

Reemplazar la función `tvByKey` (líneas ~107-109):

```js
// Adaptador: normaliza un servicio de TV_SERVICES a la forma que esperan los
// consumidores legacy (Step2Promo, TvCheckModal, summaryItems): { key, label,
// logo, field, warnMagisXuper }. Única fuente de datos de TV: TV_SERVICES.
export function tvByKey(key) {
	const s = serviceByKey(key);
	if (!s) return null;
	return {
		key: s.key,
		label: s.label,
		logo: s.logo,
		field: s.priceField,
		warnMagisXuper: s.warnMagisXuper
	};
}
```

- [ ] **Step 3: Redefinir `ADDONS` con flag `tvAddon` + Cine**

Reemplazar el bloque `export const ADDONS = [ ... ];` (líneas ~37-40, con su comentario):

```js
// --- Adicionales ------------------------------------------------------------
// `tvAddon: true` → se elige dentro del modal de TV (Pack Fútbol, Cine), no en
// el paso de adicionales. Telefonía (tvAddon:false) sí vive en ese paso.
export const ADDONS = [
	{ key: 'pack_futbol', field: 'pack_futbol', label: 'Pack Fútbol',    subtitle: 'ESPN Premium · TNT Sports', tvAddon: true },
	{ key: 'cine',        field: 'cine',        label: 'Cine',           subtitle: 'Canales HBO y Universal',   tvAddon: true },
	{ key: 'telefono',    field: 'telefono',    label: 'Telefonía fija', subtitle: 'Portabilidad numérica',     tvAddon: false }
];
```

- [ ] **Step 4: `summaryItems` — step correcto para TV-addons**

En `summaryItems`, reemplazar el loop de adicionales (líneas ~193-197):

```js
	for (const addon of ADDONS) {
		if (w.addons?.[addon.key]) {
			items.push({
				step: addon.tvAddon ? 'tv' : 'adicionales',
				label: addon.label,
				value: Number(p[addon.field]) || 0
			});
		}
	}
```

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: build exitoso (verifica que ningún consumidor importaba `TV_PLATFORMS`; `Step4TV` aún lo usa pero se reescribe en Task 5 — si el build falla por eso, continuar igual y arreglarlo en Task 5, o ejecutar Task 5 antes de buildear). **Nota:** ejecutar Task 5 inmediatamente después; `Step4TV` actual rompe el build hasta entonces.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/elegirplan/data.js
git commit -m "refactor: data.js usa TV_SERVICES como fuente unica + Cine addon"
```

---

## Task 4: `wizardState` — `cine` en addons + `chooseTvService`

**Files:**
- Modify: `src/lib/components/elegirplan/wizardState.svelte.js`

- [ ] **Step 1: Agregar `cine` al estado de addons**

En `src/lib/components/elegirplan/wizardState.svelte.js`, en el `$state` inicial, reemplazar la línea de `addons` (línea ~23):

```js
	addons: { pack_futbol: false, cine: false, telefono: false },
```

- [ ] **Step 2: Resetear `cine` en `resetWizard`**

En `resetWizard`, debajo de `wizard.addons.pack_futbol = false;` (línea ~137), agregar:

```js
	wizard.addons.cine = false;
```

- [ ] **Step 3: Agregar la acción `chooseTvService`**

Después de la función `requestTv` / `confirmTv` / `cancelTvCheck` (después de la línea ~111), agregar:

```js
// Commit de la TV desde el modal del paso de TV (Step4TV): fija la plataforma,
// sincroniza los TV-addons elegidos (Pack Fútbol / Cine) — limpiando los que el
// servicio no ofrece, porque chosenAddonKeys solo trae los tildados — y avanza.
export function chooseTvService(serviceKey, chosenAddonKeys = []) {
	wizard.tvPlatform = serviceKey;
	wizard.addons.pack_futbol = chosenAddonKeys.includes('pack_futbol');
	wizard.addons.cine = chosenAddonKeys.includes('cine');
	next();
}
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build exitoso (puede seguir fallando por `Step4TV` legacy → se arregla en Task 5).

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/elegirplan/wizardState.svelte.js
git commit -m "feat: chooseTvService y addon cine en el estado del wizard"
```

---

## Task 5: Reconstruir `Step4TV` con la estructura de elegirtv

**Files:**
- Modify: `src/lib/components/elegirplan/steps/Step4TV.svelte` (reescritura completa)
- Modify: `src/lib/components/tv/TvServiceCard.svelte` (prop opcional `selected`)

- [ ] **Step 1: Agregar prop `selected` a `TvServiceCard`**

En `src/lib/components/tv/TvServiceCard.svelte`, reemplazar la línea de props (línea ~6):

```svelte
	let { service, precios = {}, selected = false, onOpen, onGrilla } = $props();
```

En el markup, agregar `class:selected` al div de la tarjeta (línea ~26):

```svelte
	<div
		class="card"
		class:selected
		role="button"
		tabindex="0"
		onclick={() => onOpen?.()}
		onkeydown={handleKey}
	>
```

En el `<style>`, agregar después de la regla `.card:focus-visible { ... }` (después de la línea ~92):

```css
	.card.selected {
		border-color: var(--violeta1);
		box-shadow: 0 10px 30px rgba(102, 37, 124, 0.16);
	}
```

- [ ] **Step 2: Reescribir `Step4TV.svelte`**

Reemplazar **todo** el contenido de `src/lib/components/elegirplan/steps/Step4TV.svelte` por:

```svelte
<script>
	import StepHeader from '$lib/components/elegirplan/StepHeader.svelte';
	import { STEP_TITLES } from '$lib/components/elegirplan/data.js';
	import { wizard, chooseTvService, next } from '$lib/components/elegirplan/wizardState.svelte.js';

	import { TV_SERVICES, serviceByKey } from '$lib/components/tv/tvData.js';
	import TvServiceCard from '$lib/components/tv/TvServiceCard.svelte';
	import TvServiceModal from '$lib/components/tv/TvServiceModal.svelte';
	import GrillaViewer from '$lib/components/tv/GrillaViewer.svelte';
	import InfoModal from '$lib/components/tv/InfoModal.svelte';
	import AyudameElegirTv from '$lib/components/tv/AyudameElegirTv.svelte';

	const TV_BOX_URL = 'https://tiendasista.mitiendanube.com/productos/bvs-android-tv-caja-adaptadora/';

	let openKey = $state(null); // servicio con modal abierto
	let grillaKey = $state(null); // servicio con grilla abierta
	let info = $state(null); // aviso abierto: 'nosmart' | 'compat' | null

	let openService = $derived(openKey ? serviceByKey(openKey) : null);
	let grillaService = $derived(grillaKey ? serviceByKey(grillaKey) : null);

	// Siembra de adicionales del modal desde el estado del wizard (persiste la
	// selección previa al reabrir).
	let initialSelected = $derived({
		pack_futbol: wizard.addons.pack_futbol,
		cine: wizard.addons.cine
	});

	function goToServices() {
		info = null;
		setTimeout(() => {
			document.getElementById('tv-cards')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}, 50);
	}

	// Commit desde el modal: fija TV + adicionales y avanza el wizard.
	function confirmTv(service, chosenAddons) {
		chooseTvService(service.key, chosenAddons.map((a) => a.key));
		openKey = null;
	}
</script>

<StepHeader title={STEP_TITLES.tv} subtitle="Tocá un servicio para ver cómo funciona, sus canales y adicionales." />

<div class="notice">
	<p>
		Estos servicios <strong>no son por cable ni incluyen deco</strong>. Son
		<strong>aplicaciones</strong> que se descargan en tu Smart TV, TV Box, Chromecast, etc.
	</p>
	<div class="notice-actions">
		<button class="btn-secondary btn-sm" onclick={() => (info = 'nosmart')}>Mi TV no es smart</button>
		<button class="btn-secondary btn-sm" onclick={() => (info = 'compat')}>¿Es compatible mi TV?</button>
	</div>
</div>

<div id="tv-cards" class="cards">
	{#each TV_SERVICES as service (service.key)}
		<TvServiceCard
			{service}
			precios={wizard.precios}
			selected={wizard.tvPlatform === service.key}
			onOpen={() => (openKey = service.key)}
			onGrilla={() => (grillaKey = service.key)}
		/>
	{/each}
</div>

<div class="ayuda">
	<AyudameElegirTv precios={wizard.precios} onPick={(key) => (openKey = key)} />
</div>

{#if wizard.tvPlatform}
	<button class="btn-primary btn-full continuar" onclick={() => next()}>Continuar</button>
{/if}

{#if openService}
	<TvServiceModal
		service={openService}
		precios={wizard.precios}
		{initialSelected}
		ctaLabel="Elegir y continuar"
		ctaClass="btn-primary"
		onGrilla={() => (grillaKey = openService.key)}
		onConfirm={confirmTv}
		onclose={() => (openKey = null)}
	/>
{/if}

{#if grillaService}
	<GrillaViewer service={grillaService} onclose={() => (grillaKey = null)} />
{/if}

{#if info === 'nosmart'}
	<InfoModal title="Mi TV no es smart" onclose={() => (info = null)}>
		<p>
			No hay problema. Podés usar un <strong>TV Box</strong>: un aparatito que se enchufa a tu TV por
			HDMI y la convierte en smart, lista para descargar las apps.
		</p>
		<p>Es compatible con los 3 servicios. Lo conseguís en nuestra tienda online.</p>
		<a class="btn-primary btn-full" href={TV_BOX_URL} target="_blank" rel="noopener noreferrer">
			Ver TV Box en la tienda
		</a>
	</InfoModal>
{:else if info === 'compat'}
	<InfoModal title="¿Es compatible mi TV?" onclose={() => (info = null)}>
		<p>Como cada servicio es una <strong>app</strong>, lo más seguro es probarlo en tu Smart TV:</p>
		<p>
			Buscá la app (<strong>DGO</strong>, <strong>Antina Play</strong> o
			<strong>Gigared Play</strong>) en la tienda de aplicaciones de tu TV, instalala y abrila. Si
			abre bien, es compatible.
		</p>
		<p>Si no aparece en la tienda de tu TV, podés usar un TV Box.</p>
		<button class="btn-secondary btn-full" onclick={goToServices}>Ver servicios</button>
	</InfoModal>
{/if}

<style>
	.notice {
		background: #f0e7f4;
		border: 1px solid color-mix(in srgb, var(--violeta1) 18%, transparent);
		border-radius: 1rem;
		padding: 1.1rem 1.25rem;
		text-align: center;
		margin-bottom: 1.25rem;
	}
	.notice p {
		margin: 0 0 0.85rem;
		font-size: 0.92rem;
		line-height: 1.5;
		color: var(--violeta1);
		font-weight: 300;
	}
	.notice strong {
		font-weight: 700;
	}
	.notice-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
		justify-content: center;
	}
	.cards {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		scroll-margin-top: 1.25rem;
		margin-bottom: 1.25rem;
	}
	.ayuda {
		margin-bottom: 1.25rem;
	}
	.continuar {
		margin-top: 0.25rem;
	}
</style>
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build exitoso (ya no quedan referencias a `TV_PLATFORMS`).

- [ ] **Step 4: Chequeo manual del paso de TV**

Run: `npm run dev` → `http://localhost:5173/elegirplan`
Pasos: Tipo "Internet + TV" → "Armar a medida" → elegir un Internet → llegar al paso de TV.
Expected:
- Se ve el aviso "no es por cable" con los dos botones (abren InfoModal).
- Se ven 3 tarjetas ricas (features, "Ver canales" → grilla).
- El recomendador "¿No sabés cuál elegir?" funciona y su "Ver [servicio]" abre el modal.
- Abrir un servicio → Continuar → total → "Elegir y continuar" (violeta) → chequeo de instalación → "La instalé, funciona" → el modal cierra y el wizard avanza al paso de adicionales.
- Si se vuelve atrás al paso de TV, la tarjeta elegida aparece seleccionada y aparece el botón "Continuar".

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/elegirplan/steps/Step4TV.svelte src/lib/components/tv/TvServiceCard.svelte
git commit -m "feat: paso de TV del wizard con la estructura de elegirtv"
```

---

## Task 6: `Step5Adicionales` — solo adicionales no-TV

**Files:**
- Modify: `src/lib/components/elegirplan/steps/Step5Adicionales.svelte`

- [ ] **Step 1: Filtrar por `tvAddon`**

En `src/lib/components/elegirplan/steps/Step5Adicionales.svelte`, reemplazar la línea de `visibles` (líneas ~7-8):

```svelte
	// Pack Fútbol y Cine se eligen en el modal de TV (tvAddon). Acá solo Telefonía.
	let visibles = $derived(ADDONS.filter((a) => !a.tvAddon));
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: build exitoso.

- [ ] **Step 3: Chequeo manual**

En el wizard, llegar al paso "¿Sumás algo más?": debe mostrar **solo Telefonía fija** (ya no Pack Fútbol).

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/elegirplan/steps/Step5Adicionales.svelte
git commit -m "refactor: paso de adicionales muestra solo Telefonia"
```

---

## Task 7: Verificación integral (resumen, promo, WhatsApp, elegirtv)

**Files:** ninguno (solo verificación). Si algo falla, volver a la task correspondiente.

- [ ] **Step 1: Build final**

Run: `npm run build`
Expected: build exitoso, sin warnings de imports.

- [ ] **Step 2: Flujo combo Internet + TV con adicionales (manual)**

Run: `npm run dev` → `/elegirplan`
Pasos: Internet+TV → Armar a medida → Internet (ej. Power) → TV (ej. Antina) → en el modal tildar Pack Fútbol y/o Cine → "Elegir y continuar" → instalación → adicionales (Telefonía opcional) → resumen.
Expected en el **resumen**:
- Línea de Internet, línea de TV (label "Antina Play"), y líneas de Pack Fútbol / Cine como ítems propios.
- "editar" sobre la línea de Pack Fútbol o Cine vuelve al **paso de TV**.
- El total mensual suma todo; el pill "Total aprox." del header se mantuvo consistente durante el flujo.
- "Enviar combo por WhatsApp" arma el mensaje con todas las líneas (Internet + TV + adicionales).

- [ ] **Step 3: Flujo de promo (no romper)**

Pasos: Internet+TV → "Elegir la promo" → chequeo de GigaredPlay → confirmar.
Expected: el modal de chequeo muestra el logo y label de Gigared Play (vía `tvByKey` adaptado), aplica Power + GigaredPlay gratis y avanza a adicionales. El resumen muestra la TV gratis los 6 meses.

- [ ] **Step 4: Página elegirtv standalone (no romper)**

Run: abrir `/tv/elegirtv`
Expected: tarjetas, grilla, recomendador y modal funcionan; "Lo quiero" → instalación → WhatsApp con el mensaje del servicio + adicionales (texto idéntico al original).

- [ ] **Step 5: Commit (si hubo fixes)**

```bash
git add -A
git commit -m "test: verificacion integral del merge elegirtv-wizard"
```

---

## Notas de verificación final (self-review del plan)

- **Cobertura del spec:** §1 librería compartida → Task 1. §2 modal parametrizado → Task 2. §3 elegirtv page → Tasks 1-2. §4 Step4TV → Task 5. §5 estado (cine, chooseTvService) → Task 4. §6 data.js (drop TV_PLATFORMS, ADDONS tvAddon+cine, summaryItems step) → Task 3. §7 Step5Adicionales → Task 6. §8 modal de promo → cubierto por `tvByKey` adaptador (Task 3), sin tocar `ElegirPlanWizard.svelte`.
- **Desviación intencional vs spec §8:** en vez de cambiar `tvByKey → serviceByKey` en `ElegirPlanWizard.svelte` y `Step2Promo.svelte`, se reimplementa `tvByKey` como adaptador sobre `serviceByKey`. Logra la "fuente única = TV_SERVICES" con menos churn y sin tocar esos dos consumidores. Cambio de copy menor: la TV de la promo pasa a mostrarse como "Gigared Play" (antes "GigaredPlay").
- **Consistencia de tipos:** `chooseTvService(serviceKey, chosenAddonKeys)` recibe keys; `Step4TV.confirmTv` mapea `chosenAddons.map((a) => a.key)`. `onConfirm(service, chosenAddons)` pasa objetos addon; ambos consumidores (page elegirtv y Step4TV) los manejan. `tvByKey` devuelve `{ key, label, logo, field, warnMagisXuper }` — `field` consumido por `Step2Promo` (`tv.field`) y `summaryItems` (`p[tv.field]`).
- **Orden de ejecución:** Tasks 3-4 dejan el build roto temporalmente (Step4TV legacy aún importa `TV_PLATFORMS`); Task 5 lo arregla. Ejecutar 3 → 4 → 5 sin verificar build entre medio, o aceptar el fallo esperado.
