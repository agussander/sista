# Precio sin impuestos en las tarjetas de TV — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extender la feature "sin impuestos nacionales" (ver [2026-08-20-precios-sin-impuestos-nacionales-design.md](../specs/2026-08-20-precios-sin-impuestos-nacionales-design.md)) a las tarjetas de TV: plataformas (Gigared/Antina/DGO), adicionales (Pack Fútbol/Cine) dentro del modal, el recomendador, y las páginas sueltas `/tv/elegirtv`, `/dgo`, `/antinaplay`, `/gigaredplay`.

**Architecture:** Toda la data ya existe — `sinImpuestosPorCampo` (de la feature anterior) ya cubre todos los campos de TV, incluida la derivación de `antina_cine`. Este plan es pura plomería de UI: agregar un prop `sinImpuestos` a cada componente de tarjeta/tarjeta-de-adicional de TV (mismo patrón que `OptionCard`'s `subPrice`), y en el wizard reutilizar `wizard.sinImpuestos` (ya cargado); en las 4 páginas sueltas agregar el mismo fetch decorativo ya usado en `Price.svelte`/`ElegirPlanWizard.svelte`.

**Tech Stack:** SvelteKit 5 (runes). Sin tests nuevos (no hay lógica nueva, es wiring de props — se verifica con `svelte-check` + navegador, mismo criterio que el resto de esta feature).

**Aprendizaje de la ronda anterior:** cualquier caption nueva que se agregue DENTRO de un contenedor flex con `white-space: nowrap` (ej. `.addon-price` en `TvServiceModal`) tiene que ir en un `<span>`/bloque propio con `white-space: normal`, o va a superponerse con el elemento vecino en mobile — ya pasó una vez con `OptionCard`'s `.sub-price` (ver commit `2a69b30`). Los captions que van DEBAJO del bloque de precio (no adentro) no tienen este problema.

---

## Antes de empezar

```bash
git status --short src/lib/components/tv/ src/lib/components/elegirplan/steps/Step4TV.svelte src/lib/components/elegirplan/TvServiceModal.svelte src/routes/tv/ src/routes/dgo/ src/routes/antinaplay/ src/routes/gigaredplay/
```

Expected: sin salida. `TvServiceModal.svelte` vive en `src/lib/components/tv/`, no en `elegirplan/` (corregido acá; el resto de este plan usa la ruta correcta).

---

### Task 1: `TvServiceCard.svelte` — caption bajo el precio de cada plataforma

**Files:**
- Modify: `src/lib/components/tv/TvServiceCard.svelte`

- [ ] **Step 1: Prop + cálculo**

Reemplazar (líneas 7-21):

```js
	let {
		service,
		precios = {},
		selected = false,
		futbolOn = false,
		onOpen,
		onGrilla,
		onToggleFutbol
	} = $props();

	let futbolAddon = $derived(futbolAddonFor(service));
	let basePrice = $derived(Number(precios[service.priceField]) || 0);
	let futbolPrice = $derived(futbolAddon ? Number(precios[futbolAddon.field]) || 0 : 0);
	let consultar = $derived(basePrice <= 0);
	let price = $derived(formatPrice(basePrice + (futbolOn ? futbolPrice : 0)));
```

por:

```js
	let {
		service,
		precios = {},
		sinImpuestos = {},
		selected = false,
		futbolOn = false,
		onOpen,
		onGrilla,
		onToggleFutbol
	} = $props();

	let futbolAddon = $derived(futbolAddonFor(service));
	let basePrice = $derived(Number(precios[service.priceField]) || 0);
	let futbolPrice = $derived(futbolAddon ? Number(precios[futbolAddon.field]) || 0 : 0);
	let consultar = $derived(basePrice <= 0);
	let price = $derived(formatPrice(basePrice + (futbolOn ? futbolPrice : 0)));

	let baseSinImpuestos = $derived(Number(sinImpuestos[service.priceField]) || 0);
	let futbolSinImpuestos = $derived(futbolAddon ? Number(sinImpuestos[futbolAddon.field]) || 0 : 0);
	let sinImpuestosTotal = $derived(baseSinImpuestos + (futbolOn ? futbolSinImpuestos : 0));
```

- [ ] **Step 2: Markup — caption debajo de `.price`, no adentro (evita el problema de nowrap)**

Reemplazar (líneas 63-69):

```svelte
	<div class="price" class:consultar>
		{#if consultar}
			<span class="price-consultar">Consultar precio</span>
		{:else}
			<strong>{price}</strong><span class="per">/mes</span>
		{/if}
	</div>
```

por:

```svelte
	<div class="price" class:consultar>
		{#if consultar}
			<span class="price-consultar">Consultar precio</span>
		{:else}
			<strong>{price}</strong><span class="per">/mes</span>
		{/if}
	</div>
	{#if !consultar && sinImpuestosTotal > 0}
		<p class="sub-price">Sin impuestos nacionales: {formatPrice(sinImpuestosTotal)}</p>
	{/if}
```

- [ ] **Step 3: CSS**

Reemplazar:

```css
	.price-consultar {
		color: #9a6cb0;
		font-weight: 600;
		font-style: italic;
		font-size: 1.05rem;
	}
```

por:

```css
	.price-consultar {
		color: #9a6cb0;
		font-weight: 600;
		font-style: italic;
		font-size: 1.05rem;
	}
	.sub-price {
		margin: -0.4rem 0 0;
		text-align: center;
		font-size: 0.72rem;
		font-weight: 400;
		color: #9a9a9a;
	}
```

- [ ] **Step 4: Verificar tipos**

Run: `npm run check`
Expected: sin errores nuevos en `TvServiceCard.svelte`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/tv/TvServiceCard.svelte
git commit -m "feat(tv): mostrar el precio sin impuestos en la tarjeta de plataforma"
```

---

### Task 2: `TvServiceModal.svelte` — caption en el header, los adicionales y el total

**Files:**
- Modify: `src/lib/components/tv/TvServiceModal.svelte`

- [ ] **Step 1: Props**

Reemplazar (líneas 9-29):

```js
	let {
		service,
		precios = {},
		onGrilla,
		onclose,
		onConfirm,
		initialSelected = {},
		// Notifica cada toggle de un adicional en vivo (no solo al confirmar), para
		// que el padre mantenga sincronizado el switch de la tarjeta cerrada.
		onToggle,
		ctaLabel = 'Lo quiero',
		ctaClass = 'btn-whatsapp',
		// Cuando se usa dentro del wizard (Step4TV), se pasa el precio e
		// internet ya elegido para mostrar el total combinado en el resumen.
		// null = contexto standalone (sin internet seleccionado).
		internetPrice = null,
		internetLabel = 'Internet',
		// Contexto promo (Step2Promo): meses gratis del servicio. > 0 muestra el
		// precio de lista + un chip "Gratis N meses" y una nota en el resumen.
		promoMonths = 0
	} = $props();
```

por:

```js
	let {
		service,
		precios = {},
		sinImpuestos = {},
		onGrilla,
		onclose,
		onConfirm,
		initialSelected = {},
		// Notifica cada toggle de un adicional en vivo (no solo al confirmar), para
		// que el padre mantenga sincronizado el switch de la tarjeta cerrada.
		onToggle,
		ctaLabel = 'Lo quiero',
		ctaClass = 'btn-whatsapp',
		// Cuando se usa dentro del wizard (Step4TV), se pasa el precio e
		// internet ya elegido para mostrar el total combinado en el resumen.
		// null = contexto standalone (sin internet seleccionado).
		internetPrice = null,
		internetLabel = 'Internet',
		// Idem internetPrice, pero el valor sin impuestos (null si no aplica).
		internetSinImpuestos = null,
		// Contexto promo (Step2Promo): meses gratis del servicio. > 0 muestra el
		// precio de lista + un chip "Gratis N meses" y una nota en el resumen.
		promoMonths = 0
	} = $props();
```

- [ ] **Step 2: Cálculos — caption del header + total sin impuestos**

Reemplazar (línea 41-42):

```js
	let price = $derived(formatPrice(precios[service.priceField]));
	let consultar = $derived(price === 'Consultar');
```

por:

```js
	let price = $derived(formatPrice(precios[service.priceField]));
	let consultar = $derived(price === 'Consultar');
	let serviceSinImpuestos = $derived(Number(sinImpuestos[service.priceField]) || 0);
```

Reemplazar (líneas 69-82, los `$derived` de `tvItems`/`items`/`total`/`hasConsultar`):

```js
	// Ítems del resumen (servicio + adicionales elegidos) con su valor numérico.
	let tvItems = $derived([
		{ label: service.label, value: Number(precios[service.priceField]) || 0 },
		...chosenAddons.map((a) => ({ label: a.label, value: Number(precios[a.field]) || 0 }))
	]);
	// En contexto de wizard, antepone la línea de internet para mostrar el total combinado.
	let items = $derived(
		hasInternetContext
			? [{ label: internetLabel, value: internetPrice ?? 0 }, ...tvItems]
			: tvItems
	);
	let total = $derived(items.reduce((s, it) => s + it.value, 0));
	// ¿Algún ítem sin precio cargado (0)? → el total es parcial / a confirmar.
	let hasConsultar = $derived(items.some((it) => it.value <= 0));
```

por:

```js
	// Ítems del resumen (servicio + adicionales elegidos) con su valor numérico.
	let tvItems = $derived([
		{ label: service.label, value: Number(precios[service.priceField]) || 0, sinImpuestos: serviceSinImpuestos },
		...chosenAddons.map((a) => ({
			label: a.label,
			value: Number(precios[a.field]) || 0,
			sinImpuestos: Number(sinImpuestos[a.field]) || 0
		}))
	]);
	// En contexto de wizard, antepone la línea de internet para mostrar el total combinado.
	let items = $derived(
		hasInternetContext
			? [{ label: internetLabel, value: internetPrice ?? 0, sinImpuestos: internetSinImpuestos ?? 0 }, ...tvItems]
			: tvItems
	);
	let total = $derived(items.reduce((s, it) => s + it.value, 0));
	// ¿Algún ítem sin precio cargado (0)? → el total es parcial / a confirmar.
	let hasConsultar = $derived(items.some((it) => it.value <= 0));
	let totalSinImpuestos = $derived(items.reduce((s, it) => s + (it.sinImpuestos || 0), 0));
```

- [ ] **Step 3: Markup — caption del header (debajo de `.price`, no adentro)**

Reemplazar (líneas 104-118):

```svelte
			<div>
				<h3>{service.label}</h3>
				<div class="price" class:consultar>
					{#if consultar}
						<span class="price-consultar">Consultar precio</span>
					{:else}
						<strong>{price}</strong><span class="per">/mes</span>
					{/if}
				</div>
				{#if promoMonths > 0}
					<span class="promo-chip">Gratis {promoMonths} meses</span>
				{/if}
			</div>
```

por:

```svelte
			<div>
				<h3>{service.label}</h3>
				<div class="price" class:consultar>
					{#if consultar}
						<span class="price-consultar">Consultar precio</span>
					{:else}
						<strong>{price}</strong><span class="per">/mes</span>
					{/if}
				</div>
				{#if !consultar && serviceSinImpuestos > 0}
					<p class="sub-price">Sin impuestos nacionales: {formatPrice(serviceSinImpuestos)}</p>
				{/if}
				{#if promoMonths > 0}
					<span class="promo-chip">Gratis {promoMonths} meses</span>
				{/if}
			</div>
```

- [ ] **Step 4: Markup — adicionales (Pack Fútbol / Cine), caption en su propia línea**

Reemplazar (líneas 171-203, el bloque completo de `.addons`):

```svelte
		{#if service.addons?.length}
			<div class="addons">
				<h4>Sumale adicionales</h4>
				{#each service.addons as a}
					{@const addonPrice = formatPrice(precios[a.field])}
					<button
						class="addon"
						class:on={selected[a.key]}
						type="button"
						aria-pressed={selected[a.key]}
						onclick={() => toggle(a.key)}
					>
						<span class="check" aria-hidden="true">
							{#if selected[a.key]}
								<svg viewBox="0 0 24 24" width="13" height="13"><path d="M5 13l4 4L19 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
							{/if}
						</span>
						<span class="addon-body">
							<span class="addon-title">{a.label}</span>
							{#if a.detail}<span class="addon-detail">{a.detail}</span>{/if}
							{#if a.notes?.length}
								<ul class="addon-notes">
									{#each a.notes as note}<li>{note}</li>{/each}
								</ul>
							{/if}
						</span>
						<span class="addon-price" class:consultar={addonPrice === 'Consultar'}>
							{addonPrice === 'Consultar' ? 'Consultar' : `+${addonPrice}/mes`}
						</span>
					</button>
				{/each}
			</div>
		{/if}
```

por:

```svelte
		{#if service.addons?.length}
			<div class="addons">
				<h4>Sumale adicionales</h4>
				{#each service.addons as a}
					{@const addonPrice = formatPrice(precios[a.field])}
					{@const addonSinImpuestos = Number(sinImpuestos[a.field]) || 0}
					<button
						class="addon"
						class:on={selected[a.key]}
						type="button"
						aria-pressed={selected[a.key]}
						onclick={() => toggle(a.key)}
					>
						<span class="check" aria-hidden="true">
							{#if selected[a.key]}
								<svg viewBox="0 0 24 24" width="13" height="13"><path d="M5 13l4 4L19 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
							{/if}
						</span>
						<span class="addon-body">
							<span class="addon-title">{a.label}</span>
							{#if a.detail}<span class="addon-detail">{a.detail}</span>{/if}
							{#if a.notes?.length}
								<ul class="addon-notes">
									{#each a.notes as note}<li>{note}</li>{/each}
								</ul>
							{/if}
						</span>
						<span class="addon-price" class:consultar={addonPrice === 'Consultar'}>
							{addonPrice === 'Consultar' ? 'Consultar' : `+${addonPrice}/mes`}
							{#if addonPrice !== 'Consultar' && addonSinImpuestos > 0}
								<span class="addon-sin-impuestos">Sin imp.: +{formatPrice(addonSinImpuestos)}</span>
							{/if}
						</span>
					</button>
				{/each}
			</div>
		{/if}
```

- [ ] **Step 5: Markup — total (vista "resumen")**

Reemplazar (líneas 217-226, el bloque `.summary-total`):

```svelte
			<div class="summary-total">
				<span>Total</span>
				<strong class:consultar={total <= 0}>
					{#if total > 0}
						{hasInternetContext ? `${formatPrice(total)}/mes` : `+${formatPrice(total)}/mes`}
					{:else}
						A consultar
					{/if}
				</strong>
			</div>
```

por:

```svelte
			<div class="summary-total">
				<span>Total</span>
				<strong class:consultar={total <= 0}>
					{#if total > 0}
						{hasInternetContext ? `${formatPrice(total)}/mes` : `+${formatPrice(total)}/mes`}
					{:else}
						A consultar
					{/if}
				</strong>
			</div>
			{#if totalSinImpuestos > 0}
				<p class="summary-sin-impuestos">Sin impuestos nacionales: {formatPrice(totalSinImpuestos)}</p>
			{/if}
```

- [ ] **Step 6: CSS**

Reemplazar:

```css
	.price-consultar {
		color: #9a6cb0;
		font-weight: 600;
		font-style: italic;
		font-size: 0.95rem;
	}
```

por:

```css
	.price-consultar {
		color: #9a6cb0;
		font-weight: 600;
		font-style: italic;
		font-size: 0.95rem;
	}
	.sub-price {
		margin: 0.1rem 0 0;
		font-size: 0.68rem;
		font-weight: 400;
		color: #9a9a9a;
	}
```

Reemplazar:

```css
	.addon-price {
		flex-shrink: 0;
		font-size: 0.8rem;
		font-weight: 700;
		color: var(--magenta);
		white-space: nowrap;
	}
```

por:

```css
	.addon-price {
		flex-shrink: 0;
		max-width: 40%;
		text-align: right;
		font-size: 0.8rem;
		font-weight: 700;
		color: var(--magenta);
		white-space: nowrap;
	}
	.addon-sin-impuestos {
		display: block;
		white-space: normal;
		font-size: 0.65rem;
		font-weight: 400;
		color: #9a9a9a;
	}
```

Reemplazar:

```css
	.summary-note {
		margin: 0.6rem 0 0;
		font-size: 0.78rem;
		color: #8a8a8a;
		font-weight: 300;
		line-height: 1.35;
	}
```

por:

```css
	.summary-note {
		margin: 0.6rem 0 0;
		font-size: 0.78rem;
		color: #8a8a8a;
		font-weight: 300;
		line-height: 1.35;
	}
	.summary-sin-impuestos {
		margin: -0.5rem 0 0;
		font-size: 0.75rem;
		color: #9a9a9a;
		font-weight: 300;
		text-align: right;
	}
```

- [ ] **Step 7: Verificar tipos**

Run: `npm run check`
Expected: sin errores nuevos en `TvServiceModal.svelte`.

- [ ] **Step 8: Commit**

```bash
git add src/lib/components/tv/TvServiceModal.svelte
git commit -m "feat(tv): mostrar el precio sin impuestos en el modal de servicio y sus adicionales"
```

---

### Task 3: `AyudameElegirTv.svelte` — caption en la tarjeta de recomendación

**Files:**
- Modify: `src/lib/components/tv/AyudameElegirTv.svelte`

- [ ] **Step 1: Prop + helper**

Reemplazar (línea 14):

```js
	let { precios = {}, onPick = () => {}, onGrilla = () => {} } = $props();
```

por:

```js
	let { precios = {}, sinImpuestos = {}, onPick = () => {}, onGrilla = () => {} } = $props();
```

Reemplazar (líneas 30-33):

```js
	function priceFor(service) {
		const v = precios?.[service.priceField];
		return v ? `$${Number(v).toLocaleString('es-AR')}` : 'Consultar';
	}
```

por:

```js
	function priceFor(service) {
		const v = precios?.[service.priceField];
		return v ? `$${Number(v).toLocaleString('es-AR')}` : 'Consultar';
	}

	function sinImpuestosFor(service) {
		const v = Number(sinImpuestos?.[service.priceField]) || 0;
		return v > 0 ? `$${v.toLocaleString('es-AR')}` : '';
	}
```

- [ ] **Step 2: Markup**

Reemplazar (líneas 87-93):

```svelte
					<div class="reco-top">
						<div class="reco-name">
							<img src={recoService.logo} alt={recoService.label} class="reco-logo" />
							<strong>{recoService.label}</strong>
						</div>
						<span class="reco-price">{priceFor(recoService)}<small>/mes</small></span>
					</div>
					<p class="reco-reason">{reco.motivo}</p>
```

por:

```svelte
					<div class="reco-top">
						<div class="reco-name">
							<img src={recoService.logo} alt={recoService.label} class="reco-logo" />
							<strong>{recoService.label}</strong>
						</div>
						<span class="reco-price">{priceFor(recoService)}<small>/mes</small></span>
					</div>
					{#if sinImpuestosFor(recoService)}
						<p class="reco-sin-impuestos">Sin impuestos nacionales: {sinImpuestosFor(recoService)}</p>
					{/if}
					<p class="reco-reason">{reco.motivo}</p>
```

- [ ] **Step 3: CSS**

Reemplazar:

```css
	.reco-reason {
		margin: 0;
		font-size: 0.82rem;
		color: #6b6b6b;
		font-weight: 300;
	}
```

por:

```css
	.reco-sin-impuestos {
		margin: -0.2rem 0 0;
		font-size: 0.72rem;
		color: #9a9a9a;
		font-weight: 400;
		text-align: right;
	}
	.reco-reason {
		margin: 0;
		font-size: 0.82rem;
		color: #6b6b6b;
		font-weight: 300;
	}
```

- [ ] **Step 4: Verificar tipos**

Run: `npm run check`
Expected: sin errores nuevos en `AyudameElegirTv.svelte`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/tv/AyudameElegirTv.svelte
git commit -m "feat(tv): mostrar el precio sin impuestos en la tarjeta del recomendador"
```

---

### Task 4: Wizard (`Step4TV.svelte`) y `TvServicesSection.svelte` — pasar el prop

**Files:**
- Modify: `src/lib/components/elegirplan/steps/Step4TV.svelte`
- Modify: `src/lib/components/tv/TvServicesSection.svelte`

`wizard.sinImpuestos` ya existe (cargado en `ElegirPlanWizard.svelte` desde la feature anterior) — acá solo se pasa hacia abajo. `TvServicesSection` es el componente compartido por `/tv/elegirtv` y el bloque "Ver otras opciones" de `/dgo`, `/antinaplay`, `/gigaredplay` — recibe `sinImpuestos` igual que ya recibe `precios`, sin fetch propio (lo hace quien la usa).

- [ ] **Step 1: `Step4TV.svelte` — precio sin impuestos del internet ya elegido**

Reemplazar (línea 16):

```js
	let internetPrice = $derived(wizard.internetPlan ? Number(wizard.precios?.[wizard.internetPlan]) || 0 : null);
```

por:

```js
	let internetPrice = $derived(wizard.internetPlan ? Number(wizard.precios?.[wizard.internetPlan]) || 0 : null);
	let internetSinImpuestos = $derived(wizard.internetPlan ? Number(wizard.sinImpuestos?.[wizard.internetPlan]) || 0 : null);
```

- [ ] **Step 2: `Step4TV.svelte` — pasar `sinImpuestos` a las 3 tarjetas, al recomendador y al modal**

Reemplazar (líneas 53-59):

```svelte
<div class="ayuda">
	<AyudameElegirTv
		precios={wizard.precios}
		onPick={(key) => (openKey = key)}
		onGrilla={(key) => (grillaKey = key)}
	/>
</div>
```

por:

```svelte
<div class="ayuda">
	<AyudameElegirTv
		precios={wizard.precios}
		sinImpuestos={wizard.sinImpuestos}
		onPick={(key) => (openKey = key)}
		onGrilla={(key) => (grillaKey = key)}
	/>
</div>
```

Reemplazar (líneas 61-73):

```svelte
<div id="tv-cards" class="cards">
	{#each TV_SERVICES as service (service.key)}
		<TvServiceCard
			{service}
			precios={wizard.precios}
			selected={wizard.tvPlatform === service.key}
			futbolOn={isFutbolOn(service.key)}
			onToggleFutbol={() => toggleFutbol(service.key)}
			onOpen={() => (openKey = service.key)}
			onGrilla={() => (grillaKey = service.key)}
		/>
	{/each}
</div>
```

por:

```svelte
<div id="tv-cards" class="cards">
	{#each TV_SERVICES as service (service.key)}
		<TvServiceCard
			{service}
			precios={wizard.precios}
			sinImpuestos={wizard.sinImpuestos}
			selected={wizard.tvPlatform === service.key}
			futbolOn={isFutbolOn(service.key)}
			onToggleFutbol={() => toggleFutbol(service.key)}
			onOpen={() => (openKey = service.key)}
			onGrilla={() => (grillaKey = service.key)}
		/>
	{/each}
</div>
```

Reemplazar (líneas 79-95):

```svelte
{#if openService}
	<TvServiceModal
		service={openService}
		precios={wizard.precios}
		{initialSelected}
		onToggle={(key, value) => {
			if (key === 'pack_futbol' && openKey) futbolOn[openKey] = value;
		}}
		ctaLabel="Elegir y continuar"
		ctaClass="btn-primary"
		{internetLabel}
		{internetPrice}
		onGrilla={() => (grillaKey = openService.key)}
		onConfirm={confirmTv}
		onclose={() => (openKey = null)}
	/>
{/if}
```

por:

```svelte
{#if openService}
	<TvServiceModal
		service={openService}
		precios={wizard.precios}
		sinImpuestos={wizard.sinImpuestos}
		{initialSelected}
		onToggle={(key, value) => {
			if (key === 'pack_futbol' && openKey) futbolOn[openKey] = value;
		}}
		ctaLabel="Elegir y continuar"
		ctaClass="btn-primary"
		{internetLabel}
		{internetPrice}
		{internetSinImpuestos}
		onGrilla={() => (grillaKey = openService.key)}
		onConfirm={confirmTv}
		onclose={() => (openKey = null)}
	/>
{/if}
```

- [ ] **Step 3: `TvServicesSection.svelte` — aceptar y repartir el prop**

Reemplazar (línea 23):

```js
	let { precios = {}, loading = false, cardsId = 'cards' } = $props();
```

por:

```js
	let { precios = {}, sinImpuestos = {}, loading = false, cardsId = 'cards' } = $props();
```

Reemplazar (líneas 82-88):

```svelte
	<div class="ayuda">
		<AyudameElegirTv
			{precios}
			onPick={(key) => openModal(key)}
			onGrilla={(key) => (grillaKey = key)}
		/>
	</div>
```

por:

```svelte
	<div class="ayuda">
		<AyudameElegirTv
			{precios}
			{sinImpuestos}
			onPick={(key) => openModal(key)}
			onGrilla={(key) => (grillaKey = key)}
		/>
	</div>
```

Reemplazar (líneas 90-101):

```svelte
	<div id={cardsId} class="cards">
		{#each TV_SERVICES as service (service.key)}
			<TvServiceCard
				{service}
				{precios}
				futbolOn={!!futbolOn[service.key]}
				onToggleFutbol={() => toggleFutbol(service.key)}
				onOpen={() => openModal(service.key)}
				onGrilla={() => (grillaKey = service.key)}
			/>
		{/each}
	</div>
```

por:

```svelte
	<div id={cardsId} class="cards">
		{#each TV_SERVICES as service (service.key)}
			<TvServiceCard
				{service}
				{precios}
				{sinImpuestos}
				futbolOn={!!futbolOn[service.key]}
				onToggleFutbol={() => toggleFutbol(service.key)}
				onOpen={() => openModal(service.key)}
				onGrilla={() => (grillaKey = service.key)}
			/>
		{/each}
	</div>
```

Reemplazar (líneas 104-116):

```svelte
{#if openService}
	<TvServiceModal
		service={openService}
		{precios}
		initialSelected={{ pack_futbol: !!futbolOn[openService.key] }}
		onToggle={(key, value) => {
			if (key === 'pack_futbol') futbolOn[openService.key] = value;
		}}
		onGrilla={() => (grillaKey = openService.key)}
		onConfirm={(service, addons) => window.open(buildTvWhatsappUrl(service, addons), '_blank', 'noopener')}
		onclose={() => closeModal()}
	/>
{/if}
```

por:

```svelte
{#if openService}
	<TvServiceModal
		service={openService}
		{precios}
		{sinImpuestos}
		initialSelected={{ pack_futbol: !!futbolOn[openService.key] }}
		onToggle={(key, value) => {
			if (key === 'pack_futbol') futbolOn[openService.key] = value;
		}}
		onGrilla={() => (grillaKey = openService.key)}
		onConfirm={(service, addons) => window.open(buildTvWhatsappUrl(service, addons), '_blank', 'noopener')}
		onclose={() => closeModal()}
	/>
{/if}
```

- [ ] **Step 4: Verificar tipos**

Run: `npm run check`
Expected: sin errores nuevos en `Step4TV.svelte` ni en `TvServicesSection.svelte`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/elegirplan/steps/Step4TV.svelte src/lib/components/tv/TvServicesSection.svelte
git commit -m "feat(tv): pasar el precio sin impuestos a las tarjetas de TV del wizard"
```

---

### Task 5: `TvPriceSummary.svelte` + las 4 páginas sueltas — fetch propio y wiring

**Files:**
- Modify: `src/lib/components/tv/TvPriceSummary.svelte`
- Modify: `src/routes/tv/elegirtv/+page.svelte`
- Modify: `src/routes/dgo/+page.svelte`
- Modify: `src/routes/antinaplay/+page.svelte`
- Modify: `src/routes/gigaredplay/+page.svelte`

Estas 4 páginas hoy NO piden el tarifario (solo `precios`, con impuestos). Cada una necesita el mismo fetch decorativo ya usado en `Price.svelte`/`ElegirPlanWizard.svelte`: si falla, la página sigue funcionando igual, solo sin las líneas de "sin impuestos".

- [ ] **Step 1: `TvPriceSummary.svelte` — prop + caption**

Reemplazar (línea 7):

```js
	let { service, precios = {} } = $props();
```

por:

```js
	let { service, precios = {}, sinImpuestos = {} } = $props();
```

Reemplazar (línea 9-10):

```js
	let price = $derived(formatPrice(precios[service.priceField]));
	let consultar = $derived(price === 'Consultar');
```

por:

```js
	let price = $derived(formatPrice(precios[service.priceField]));
	let consultar = $derived(price === 'Consultar');
	let servicioSinImpuestos = $derived(Number(sinImpuestos[service.priceField]) || 0);
```

Reemplazar (líneas 13-24):

```svelte
<div class="summary">
	<div class="price" class:consultar>
		{#if consultar}
			<span class="price-consultar">Consultar precio</span>
		{:else}
			<strong>{price}</strong><span class="per">/mes</span>
		{/if}
	</div>

	{#if service.devices?.label}
		<p class="tvs">{service.devices.label}</p>
	{/if}
</div>
```

por:

```svelte
<div class="summary">
	<div class="price" class:consultar>
		{#if consultar}
			<span class="price-consultar">Consultar precio</span>
		{:else}
			<strong>{price}</strong><span class="per">/mes</span>
		{/if}
	</div>
	{#if !consultar && servicioSinImpuestos > 0}
		<p class="sub-price">Sin impuestos nacionales: {formatPrice(servicioSinImpuestos)}</p>
	{/if}

	{#if service.devices?.label}
		<p class="tvs">{service.devices.label}</p>
	{/if}
</div>
```

CSS — reemplazar:

```css
	.price-consultar {
		color: #9a6cb0;
		font-weight: 600;
		font-style: italic;
		font-size: 1.2rem;
	}
```

por:

```css
	.price-consultar {
		color: #9a6cb0;
		font-weight: 600;
		font-style: italic;
		font-size: 1.2rem;
	}
	.sub-price {
		margin: -0.15rem 0 0;
		font-size: 0.78rem;
		font-weight: 400;
		color: #9a9a9a;
	}
```

- [ ] **Step 2: `src/routes/tv/elegirtv/+page.svelte`**

Reemplazar (líneas 1-21, todo el `<script>`):

```svelte
<script>
	import { SITE_ORIGIN } from '$lib/seo.js';
	import { onMount } from 'svelte';
	import { MetaTags } from 'svelte-meta-tags';
	import { pb } from '$lib/pocketbase';

	import TvServicesSection from '$lib/components/tv/TvServicesSection.svelte';

	let precios = $state({});
	let loading = $state(true);

	onMount(async () => {
		try {
			const record = await pb.collection('precios').getFirstListItem('');
			if (record) precios = record;
		} catch (e) {
			console.error('Error cargando precios desde PocketBase:', e);
		} finally {
			loading = false;
		}
	});
</script>
```

por:

```svelte
<script>
	import { SITE_ORIGIN } from '$lib/seo.js';
	import { onMount } from 'svelte';
	import { MetaTags } from 'svelte-meta-tags';
	import { pb } from '$lib/pocketbase';
	import { fetchTarifario } from '$lib/tarifario/fetchTarifario.js';
	import { sinImpuestosPorCampo } from '$lib/tarifario/mapeoPrecios.js';

	import TvServicesSection from '$lib/components/tv/TvServicesSection.svelte';

	let precios = $state({});
	let sinImpuestos = $state({});
	let loading = $state(true);

	onMount(async () => {
		try {
			const record = await pb.collection('precios').getFirstListItem('');
			if (record) precios = record;
		} catch (e) {
			console.error('Error cargando precios desde PocketBase:', e);
		} finally {
			loading = false;
		}
	});

	onMount(async () => {
		// Decorativo: si falla, la página sigue mostrando el precio final igual
		// que hoy, solo sin la línea de "sin impuestos nacionales".
		try {
			const { tarifasWeb } = await fetchTarifario();
			sinImpuestos = sinImpuestosPorCampo(tarifasWeb.filas);
		} catch (error) {
			console.error('Error cargando el tarifario desde PocketBase:', error);
		}
	});
</script>
```

Reemplazar (línea 52):

```svelte
	<TvServicesSection {precios} {loading} />
```

por:

```svelte
	<TvServicesSection {precios} {sinImpuestos} {loading} />
```

- [ ] **Step 3: `src/routes/dgo/+page.svelte`**

Reemplazar (líneas 1-26, todo el `<script>`):

```svelte
<script>
	import { SITE_ORIGIN } from '$lib/seo.js';
    import { onMount } from 'svelte';
    import { MetaTags } from 'svelte-meta-tags';
    import { pb } from '$lib/pocketbase';
    import ChannelGrid from '$lib/components/features/ChannelGrid.svelte';
    import { serviceByKey } from '$lib/components/tv/tvData.js';
    import TvPriceSummary from '$lib/components/tv/TvPriceSummary.svelte';
    import TvServicesSection from '$lib/components/tv/TvServicesSection.svelte';

    const service = serviceByKey('dgo');

    let precios = $state({});
    let loading = $state(true);

    onMount(async () => {
        try {
            const record = await pb.collection('precios').getFirstListItem('');
            if (record) precios = record;
        } catch (e) {
            console.error('Error cargando precios desde PocketBase:', e);
        } finally {
            loading = false;
        }
    });
</script>
```

por:

```svelte
<script>
	import { SITE_ORIGIN } from '$lib/seo.js';
    import { onMount } from 'svelte';
    import { MetaTags } from 'svelte-meta-tags';
    import { pb } from '$lib/pocketbase';
    import { fetchTarifario } from '$lib/tarifario/fetchTarifario.js';
    import { sinImpuestosPorCampo } from '$lib/tarifario/mapeoPrecios.js';
    import ChannelGrid from '$lib/components/features/ChannelGrid.svelte';
    import { serviceByKey } from '$lib/components/tv/tvData.js';
    import TvPriceSummary from '$lib/components/tv/TvPriceSummary.svelte';
    import TvServicesSection from '$lib/components/tv/TvServicesSection.svelte';

    const service = serviceByKey('dgo');

    let precios = $state({});
    let sinImpuestos = $state({});
    let loading = $state(true);

    onMount(async () => {
        try {
            const record = await pb.collection('precios').getFirstListItem('');
            if (record) precios = record;
        } catch (e) {
            console.error('Error cargando precios desde PocketBase:', e);
        } finally {
            loading = false;
        }
    });

    onMount(async () => {
        try {
            const { tarifasWeb } = await fetchTarifario();
            sinImpuestos = sinImpuestosPorCampo(tarifasWeb.filas);
        } catch (error) {
            console.error('Error cargando el tarifario desde PocketBase:', error);
        }
    });
</script>
```

Reemplazar (línea 61):

```svelte
    <TvPriceSummary {service} {precios} />
```

por:

```svelte
    <TvPriceSummary {service} {precios} {sinImpuestos} />
```

Reemplazar (línea 84):

```svelte
        <TvServicesSection {precios} {loading} cardsId="otras-cards" />
```

por:

```svelte
        <TvServicesSection {precios} {sinImpuestos} {loading} cardsId="otras-cards" />
```

- [ ] **Step 4: `src/routes/antinaplay/+page.svelte`**

Mismo patrón que Step 3 (mismo bloque de `<script>` salvo el import de `TvAvailability`/`antinaChannels` y `serviceByKey('antina')`, que quedan igual). Reemplazar el `<script>` completo (líneas 1-28):

```svelte
<script>
	import { SITE_ORIGIN } from '$lib/seo.js';
    import { onMount } from 'svelte';
    import { MetaTags } from 'svelte-meta-tags';
    import { pb } from '$lib/pocketbase';
    import ChannelGrid from '$lib/components/features/ChannelGrid.svelte';
    import antinaChannels from '$lib/data/antina-channels.json';
    import { serviceByKey } from '$lib/components/tv/tvData.js';
    import TvPriceSummary from '$lib/components/tv/TvPriceSummary.svelte';
    import TvAvailability from '$lib/components/tv/TvAvailability.svelte';
    import TvServicesSection from '$lib/components/tv/TvServicesSection.svelte';

    const service = serviceByKey('antina');

    let precios = $state({});
    let loading = $state(true);

    onMount(async () => {
        try {
            const record = await pb.collection('precios').getFirstListItem('');
            if (record) precios = record;
        } catch (e) {
            console.error('Error cargando precios desde PocketBase:', e);
        } finally {
            loading = false;
        }
    });
</script>
```

por:

```svelte
<script>
	import { SITE_ORIGIN } from '$lib/seo.js';
    import { onMount } from 'svelte';
    import { MetaTags } from 'svelte-meta-tags';
    import { pb } from '$lib/pocketbase';
    import { fetchTarifario } from '$lib/tarifario/fetchTarifario.js';
    import { sinImpuestosPorCampo } from '$lib/tarifario/mapeoPrecios.js';
    import ChannelGrid from '$lib/components/features/ChannelGrid.svelte';
    import antinaChannels from '$lib/data/antina-channels.json';
    import { serviceByKey } from '$lib/components/tv/tvData.js';
    import TvPriceSummary from '$lib/components/tv/TvPriceSummary.svelte';
    import TvAvailability from '$lib/components/tv/TvAvailability.svelte';
    import TvServicesSection from '$lib/components/tv/TvServicesSection.svelte';

    const service = serviceByKey('antina');

    let precios = $state({});
    let sinImpuestos = $state({});
    let loading = $state(true);

    onMount(async () => {
        try {
            const record = await pb.collection('precios').getFirstListItem('');
            if (record) precios = record;
        } catch (e) {
            console.error('Error cargando precios desde PocketBase:', e);
        } finally {
            loading = false;
        }
    });

    onMount(async () => {
        try {
            const { tarifasWeb } = await fetchTarifario();
            sinImpuestos = sinImpuestosPorCampo(tarifasWeb.filas);
        } catch (error) {
            console.error('Error cargando el tarifario desde PocketBase:', error);
        }
    });
</script>
```

Reemplazar (línea 54):

```svelte
    <TvPriceSummary {service} {precios} />
```

por:

```svelte
    <TvPriceSummary {service} {precios} {sinImpuestos} />
```

Reemplazar (línea 73):

```svelte
        <TvServicesSection {precios} {loading} cardsId="otras-cards" />
```

por:

```svelte
        <TvServicesSection {precios} {sinImpuestos} {loading} cardsId="otras-cards" />
```

- [ ] **Step 5: `src/routes/gigaredplay/+page.svelte`**

Mismo patrón. Reemplazar el `<script>` completo (líneas 1-28):

```svelte
<script>
	import { SITE_ORIGIN } from '$lib/seo.js';
    import { onMount } from 'svelte';
    import { MetaTags } from 'svelte-meta-tags';
    import { pb } from '$lib/pocketbase';
    import ChannelGrid from '$lib/components/features/ChannelGrid.svelte';
    import gigaredplayChannels from '$lib/data/gigaredplay-channels.json';
    import { serviceByKey } from '$lib/components/tv/tvData.js';
    import TvPriceSummary from '$lib/components/tv/TvPriceSummary.svelte';
    import TvAvailability from '$lib/components/tv/TvAvailability.svelte';
    import TvServicesSection from '$lib/components/tv/TvServicesSection.svelte';

    const service = serviceByKey('gigared');

    let precios = $state({});
    let loading = $state(true);

    onMount(async () => {
        try {
            const record = await pb.collection('precios').getFirstListItem('');
            if (record) precios = record;
        } catch (e) {
            console.error('Error cargando precios desde PocketBase:', e);
        } finally {
            loading = false;
        }
    });
</script>
```

por:

```svelte
<script>
	import { SITE_ORIGIN } from '$lib/seo.js';
    import { onMount } from 'svelte';
    import { MetaTags } from 'svelte-meta-tags';
    import { pb } from '$lib/pocketbase';
    import { fetchTarifario } from '$lib/tarifario/fetchTarifario.js';
    import { sinImpuestosPorCampo } from '$lib/tarifario/mapeoPrecios.js';
    import ChannelGrid from '$lib/components/features/ChannelGrid.svelte';
    import gigaredplayChannels from '$lib/data/gigaredplay-channels.json';
    import { serviceByKey } from '$lib/components/tv/tvData.js';
    import TvPriceSummary from '$lib/components/tv/TvPriceSummary.svelte';
    import TvAvailability from '$lib/components/tv/TvAvailability.svelte';
    import TvServicesSection from '$lib/components/tv/TvServicesSection.svelte';

    const service = serviceByKey('gigared');

    let precios = $state({});
    let sinImpuestos = $state({});
    let loading = $state(true);

    onMount(async () => {
        try {
            const record = await pb.collection('precios').getFirstListItem('');
            if (record) precios = record;
        } catch (e) {
            console.error('Error cargando precios desde PocketBase:', e);
        } finally {
            loading = false;
        }
    });

    onMount(async () => {
        try {
            const { tarifasWeb } = await fetchTarifario();
            sinImpuestos = sinImpuestosPorCampo(tarifasWeb.filas);
        } catch (error) {
            console.error('Error cargando el tarifario desde PocketBase:', error);
        }
    });
</script>
```

Reemplazar (línea 63):

```svelte
    <TvPriceSummary {service} {precios} />
```

por:

```svelte
    <TvPriceSummary {service} {precios} {sinImpuestos} />
```

Reemplazar (línea 78):

```svelte
        <TvServicesSection {precios} {loading} cardsId="otras-cards" />
```

por:

```svelte
        <TvServicesSection {precios} {sinImpuestos} {loading} cardsId="otras-cards" />
```

- [ ] **Step 6: Verificar tipos**

Run: `npm run check`
Expected: sin errores nuevos en ninguno de los 5 archivos.

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/tv/TvPriceSummary.svelte src/routes/tv/elegirtv/+page.svelte src/routes/dgo/+page.svelte src/routes/antinaplay/+page.svelte src/routes/gigaredplay/+page.svelte
git commit -m "feat(tv): cargar y mostrar el precio sin impuestos en las paginas sueltas de TV"
```

---

### Task 6: Verificación manual en el navegador

- [ ] **Step 1:** `npm run dev`, abrir `/elegirplan`, elegir "TV" (con o sin promo, `?sinpromo=1` para llegar directo a `Step4TV`). Confirmar: cada tarjeta de plataforma (Gigared/Antina/DGO) muestra "Sin impuestos nacionales: $X" bajo el precio. Tocar una tarjeta: el modal debe mostrar la misma línea bajo el precio del header, y bajo cada adicional (Pack Fútbol, y Cine en Antina) sin superponerse con el texto del adicional en mobile (375px). Avanzar hasta la vista de resumen del modal: confirmar el total sin impuestos combinado (internet + TV + adicionales).
- [ ] **Step 2:** Abrir el recomendador ("¿Te ayudamos a elegir?"), responder las 3 preguntas: la tarjeta de recomendación debe mostrar el precio sin impuestos.
- [ ] **Step 3:** Abrir `/tv/elegirtv`, `/dgo`, `/antinaplay`, `/gigaredplay` — confirmar que el precio del encabezado (`TvPriceSummary`, en las 3 páginas de servicio) y las tarjetas de "Ver otras opciones" muestran la línea sin impuestos.
- [ ] **Step 4:** `npm run check` sin errores nuevos.
