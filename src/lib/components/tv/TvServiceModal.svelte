<script>
	// Modal explicativo de un servicio de TV. Permite tildar adicionales y arma
	// el mensaje de WhatsApp con el servicio + adicionales (estilo wizard).
	import { fade, scale } from 'svelte/transition';
	import { formatPrice } from '$lib/components/elegirplan/data.js';
	import TvCheckModal from '$lib/components/elegirplan/TvCheckModal.svelte';
	import { INCOMPATIBLES } from './tvData.js';

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

	// Selección de adicionales (estado local, sembrado desde initialSelected; se
	// reinicia con cada apertura porque el modal se monta de nuevo por el {#if} del padre).
	let selected = $state({ ...initialSelected });
	// Logos de incompatibles que fallan al cargar → fallback a chip.
	let failed = $state({});
	// Paso del modal: 'detalle' (servicio + adicionales) → 'total' (resumen).
	let view = $state('detalle');
	// Chequeo de instalación (mismo gate que el wizard) antes de la acción final.
	let showInstall = $state(false);

	let price = $derived(formatPrice(precios[service.priceField]));
	let consultar = $derived(price === 'Consultar');

	function onKey(e) {
		// Si está abierto el chequeo de instalación, que él maneje su propio Escape.
		if (e.key === 'Escape' && !showInstall) onclose?.();
	}

	// Confirmó "La instalé, funciona" → delega la acción final al contenedor
	// (abrir WhatsApp en elegirtv, o commitear + avanzar en el wizard).
	function confirmInstall() {
		onConfirm?.(service, chosenAddons);
		showInstall = false;
	}

	function toggle(key) {
		selected[key] = !selected[key];
	}

	let chosenAddons = $derived(service.addons.filter((a) => selected[a.key]));

	// Ítems del resumen (servicio + adicionales elegidos) con su valor numérico.
	let items = $derived([
		{ label: service.label, value: Number(precios[service.priceField]) || 0 },
		...chosenAddons.map((a) => ({ label: a.label, value: Number(precios[a.field]) || 0 }))
	]);
	let total = $derived(items.reduce((s, it) => s + it.value, 0));
	// ¿Algún ítem sin precio cargado (0)? → el total es parcial / a confirmar.
	let hasConsultar = $derived(items.some((it) => it.value <= 0));

	// "+$X/mes" para el resumen (todo se SUMA a internet); "Consultar" si no hay precio.
	function plusLabel(value) {
		return value > 0 ? `+${formatPrice(value)}/mes` : 'Consultar';
	}
</script>

<svelte:window onkeydown={onKey} />

<div class="backdrop" transition:fade={{ duration: 150 }} onclick={() => onclose?.()} role="presentation">
	<div
		class="modal"
		role="dialog"
		aria-modal="true"
		aria-label={service.label}
		transition:scale={{ duration: 200, start: 0.95 }}
		onclick={(e) => e.stopPropagation()}
	>
		<button class="close" onclick={() => onclose?.()} aria-label="Cerrar">✕</button>

		<header class="head">
			<img class="plat-logo" src={service.logo} alt={service.label} />
			<div>
				<h3>{service.label}</h3>
				<div class="price" class:consultar>
					{#if consultar}
						<span class="price-consultar">Consultar precio</span>
					{:else}
						<strong>{price}</strong><span class="per">/mes</span>
					{/if}
				</div>
			</div>
		</header>

		{#if view === 'detalle'}
		<p class="intro">{service.intro}</p>

		<ul class="features">
			{#each service.features as f}
				<li class={f.type}>
					<span class="ico" aria-hidden="true">
						{#if f.type === 'pos'}
							<svg viewBox="0 0 24 24" width="16" height="16"><path d="M5 13l4 4L19 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
						{:else if f.type === 'neg'}
							<svg viewBox="0 0 24 24" width="16" height="16"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>
						{:else}
							<span class="dot"></span>
						{/if}
					</span>
					<span class="txt">{f.text}</span>
				</li>
			{/each}
		</ul>

		<button class="btn-secondary btn-sm grilla-btn" onclick={() => onGrilla?.()}>
			¿Qué canales tiene?
		</button>

		{#if service.warnMagisXuper}
			<div class="warn">
				<span class="warn-ico" aria-hidden="true">!</span>
				<p>No va a funcionar si tuviste <strong>Magis</strong> o <strong>Xuper</strong> en esa TV/dispositivo.</p>
			</div>
			<div class="inc-logos">
				{#each INCOMPATIBLES as inc}
					{#if failed[inc.label]}
						<span class="inc-chip">{inc.label}</span>
					{:else}
						<img src={inc.logo} alt={inc.label} onerror={() => (failed[inc.label] = true)} />
					{/if}
				{/each}
			</div>
		{/if}

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

		<button class="btn-primary btn-full" onclick={() => (view = 'total')}>Continuar</button>
		{:else}
		<!-- Paso total: resumen del servicio + adicionales elegidos -->
		<div class="summary">
			<ul class="summary-items">
				{#each items as it}
					<li>
						<span class="summary-label">{it.label}</span>
						<span class="summary-value" class:consultar={it.value <= 0}>{plusLabel(it.value)}</span>
					</li>
				{/each}
			</ul>
			<div class="summary-total">
				<span>Total</span>
				<strong class:consultar={total <= 0}>{total > 0 ? `+${formatPrice(total)}/mes` : 'A consultar'}</strong>
			</div>
			<p class="summary-internet">Esto se suma a lo que ya pagás de internet.</p>
			{#if hasConsultar}
				<p class="summary-note">Algún ítem todavía no tiene precio cargado: lo confirmamos por WhatsApp.</p>
			{/if}
		</div>

		<button class="btn-full cta {ctaClass}" onclick={() => (showInstall = true)}>
			{ctaLabel}
		</button>
		<button class="btn-text btn-sm back-step" onclick={() => (view = 'detalle')}>← Volver al detalle</button>
		{/if}
	</div>
</div>

{#if showInstall}
	<TvCheckModal platform={service} onconfirm={confirmInstall} oncancel={() => (showInstall = false)} />
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		background: rgba(43, 18, 53, 0.55);
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding: 1.5rem 1rem;
		z-index: 1000;
		overflow-y: auto;
	}
	.modal {
		position: relative;
		background: #fff;
		border-radius: 1.2rem;
		padding: 1.75rem 1.4rem 1.5rem;
		width: 100%;
		max-width: 26rem;
		margin: auto;
		box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
	}
	.close {
		position: absolute;
		top: 0.85rem;
		right: 0.9rem;
		background: none;
		border: none;
		font-size: 1rem;
		color: #9a9a9a;
		cursor: pointer;
		padding: 0.25rem;
		width: auto;
	}

	.head {
		display: flex;
		align-items: center;
		gap: 0.9rem;
		margin-bottom: 1rem;
	}
	.plat-logo {
		width: 3.2rem;
		height: 3.2rem;
		object-fit: contain;
		flex-shrink: 0;
	}
	h3 {
		font-size: 1.25rem;
		color: var(--violeta1);
		text-transform: none;
		margin: 0 0 0.15rem;
	}
	.price {
		display: flex;
		align-items: baseline;
		gap: 0.2rem;
	}
	.price strong {
		color: var(--magenta);
		font-size: 1.3rem;
		font-weight: 800;
		line-height: 1;
	}
	.price .per {
		font-size: 0.78rem;
		color: #9a9a9a;
	}
	.price-consultar {
		color: #9a6cb0;
		font-weight: 600;
		font-style: italic;
		font-size: 0.95rem;
	}

	.intro {
		font-size: 0.92rem;
		line-height: 1.5;
		color: #6b6b6b;
		font-weight: 300;
		margin: 0 0 1rem;
	}

	.features {
		list-style: none;
		margin: 0 0 1rem;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.features li {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		font-size: 0.92rem;
		color: var(--violeta1);
		font-weight: 300;
	}
	.features li.pos {
		font-weight: 600;
	}
	.features li.neg .txt {
		color: #9a9a9a;
	}
	.ico {
		flex-shrink: 0;
		width: 1.3rem;
		height: 1.3rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.pos .ico {
		color: #1ba37a;
	}
	.neg .ico {
		color: #c9c9c9;
	}
	.dot {
		width: 0.4rem;
		height: 0.4rem;
		border-radius: 999px;
		background: var(--violeta1);
		opacity: 0.5;
	}

	.grilla-btn {
		width: 100%;
		margin-bottom: 1rem;
	}

	.warn {
		display: flex;
		align-items: flex-start;
		gap: 0.65rem;
		background: #fff4f7;
		border: 1px solid #f6d2de;
		border-radius: 0.7rem;
		padding: 0.85rem;
		margin-bottom: 0.75rem;
	}
	.warn-ico {
		flex-shrink: 0;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 999px;
		background: var(--magenta);
		color: #fff;
		font-weight: 800;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.9rem;
	}
	.warn p {
		margin: 0;
		font-size: 0.88rem;
		color: var(--violeta1);
		font-weight: 300;
	}
	.inc-logos {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1.25rem;
		margin-bottom: 1.25rem;
		min-height: 2.2rem;
	}
	.inc-logos img {
		height: 2rem;
		max-width: 6rem;
		object-fit: contain;
		filter: grayscale(0.2);
		opacity: 0.85;
	}
	.inc-chip {
		font-weight: 700;
		color: #9a9a9a;
		background: #f1f1f1;
		border: 1px dashed #cfcfcf;
		border-radius: 0.5rem;
		padding: 0.35rem 0.85rem;
		font-size: 0.9rem;
	}

	.addons {
		margin-bottom: 1.25rem;
	}
	.addons h4 {
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		color: #9a9a9a;
		margin: 0 0 0.6rem;
	}
	.addon {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		width: 100%;
		text-align: left;
		background: #fff;
		border: 2px solid #ececec;
		border-radius: 0.8rem;
		padding: 0.7rem 0.85rem;
		cursor: pointer;
		margin-bottom: 0.5rem;
	}
	.addon:last-child {
		margin-bottom: 0;
	}
	.addon.on {
		border-color: var(--violeta1);
		background: #f0e7f4;
	}
	.check {
		flex-shrink: 0;
		width: 1.3rem;
		height: 1.3rem;
		border-radius: 0.4rem;
		border: 2px solid #d4d4d4;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #fff;
	}
	.addon.on .check {
		background: var(--violeta1);
		border-color: var(--violeta1);
	}
	.addon-body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.addon-title {
		font-weight: 700;
		color: var(--violeta1);
		font-size: 0.92rem;
	}
	.addon-detail {
		font-size: 0.75rem;
		color: #6b6b6b;
		font-weight: 300;
	}
	.addon-notes {
		list-style: none;
		margin: 0.35rem 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}
	.addon-notes li {
		display: flex;
		align-items: flex-start;
		gap: 0.35rem;
		font-size: 0.72rem;
		line-height: 1.25;
		color: #8a8a8a;
		font-weight: 300;
	}
	.addon-notes li::before {
		content: 'ⓘ';
		flex-shrink: 0;
		color: var(--violeta1);
		opacity: 0.55;
		font-size: 0.72rem;
	}
	.addon-price {
		flex-shrink: 0;
		font-size: 0.8rem;
		font-weight: 700;
		color: var(--magenta);
		white-space: nowrap;
	}
	.addon-price.consultar {
		color: #9a6cb0;
		font-style: italic;
		font-weight: 600;
	}

	.summary {
		margin: 0.25rem 0 1.25rem;
	}
	.summary-items {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.summary-items li {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.6rem 0;
		border-bottom: 1px solid #f0f0f0;
	}
	.summary-label {
		color: var(--violeta1);
		font-size: 0.95rem;
	}
	.summary-value {
		flex-shrink: 0;
		font-weight: 700;
		color: var(--violeta1);
		font-size: 0.92rem;
		white-space: nowrap;
	}
	.summary-value.consultar {
		color: #9a6cb0;
		font-style: italic;
		font-weight: 600;
	}
	.summary-total {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		padding-top: 0.85rem;
		font-size: 1.05rem;
		font-weight: 700;
		color: var(--violeta1);
	}
	.summary-total strong {
		color: var(--magenta);
		font-size: 1.35rem;
		font-weight: 800;
	}
	.summary-total strong.consultar {
		color: #9a6cb0;
		font-style: italic;
		font-size: 1.05rem;
	}
	.summary-internet {
		margin: 0.85rem 0 0;
		font-size: 0.82rem;
		line-height: 1.35;
		color: var(--violeta1);
		font-weight: 600;
		text-align: left;
	}
	.summary-note {
		margin: 0.6rem 0 0;
		font-size: 0.78rem;
		color: #8a8a8a;
		font-weight: 300;
		line-height: 1.35;
	}
	.back-step {
		display: block;
		margin: 0.5rem auto 0;
		color: #9a9a9a;
		width: auto;
	}

	.cta {
		margin-top: 0.25rem;
	}
	.wsp-icon {
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2366257C'%3E%3Cpath d='M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z'/%3E%3C/svg%3E");
		background-size: cover;
		width: 1.4rem;
		height: 1.4rem;
		display: inline-block;
	}
</style>
