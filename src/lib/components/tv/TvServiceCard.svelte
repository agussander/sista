<script>
	// Tarjeta grande de un servicio de TV (full-width en mobile, columna en desktop).
	// Tocar el cuerpo abre el modal explicativo; "Ver canales" abre la grilla.
	import { formatPrice } from '$lib/components/elegirplan/data.js';
	import { futbolAddonFor } from './tvData.js';

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

	function handleKey(e) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			onOpen?.();
		}
	}

	// El botón "Ver canales" no debe disparar la apertura del modal.
	function grilla(e) {
		e.stopPropagation();
		onGrilla?.();
	}

	// El switch de Pack Fútbol no debe disparar la apertura del modal.
	function stop(e) {
		e.stopPropagation();
	}
</script>

<div
	class="card"
	class:selected
	role="button"
	tabindex="0"
	onclick={() => onOpen?.()}
	onkeydown={handleKey}
>
	{#if service.badge}
		<span class="badge">
			{#if service.badgeIcon}
				<img class="badge-icon" src={service.badgeIcon} alt={service.label} />
			{/if}
			<span class="badge-text">{service.badge}</span>
		</span>
	{/if}

	<div class="logo-wrap">
		<img src={service.logo} alt={service.label} />
	</div>

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

	{#if futbolAddon}
		<label class="futbol-switch" onclick={stop} onkeydown={stop}>
			<input
				type="checkbox"
				checked={futbolOn}
				onclick={stop}
				onchange={() => onToggleFutbol?.()}
			/>
			<span class="switch-track" aria-hidden="true"></span>
			<span class="switch-label">
				{futbolAddon.label}
				<small>{futbolPrice > 0 ? `+${formatPrice(futbolPrice)}/mes` : '(a confirmar)'}</small>
			</span>
		</label>
	{/if}

	<button class="grilla-link" type="button" onclick={grilla}>
		<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
			<rect x="3" y="4" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2" />
			<path d="M8 20h8" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
		</svg>
		Ver canales
	</button>

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

	<span class="more">Ver más detalles ›</span>
</div>

<style>
	.card {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		width: 100%;
		background: #fff;
		border: 2px solid #ececec;
		border-radius: 1.2rem;
		padding: 1.6rem 1.4rem;
		cursor: pointer;
		box-shadow: 0 6px 24px rgba(102, 37, 124, 0.08);
		transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
		text-align: center;
	}

	/* Destacado: chip celeste montado sobre el borde
	   superior derecho — mitad afuera, mitad adentro de la tarjeta. */
	.badge {
		position: absolute;
		top: -0.7rem;
		left: 1rem;
		z-index: 2;
		max-width: 11rem;
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.35rem 0.7rem;
		background: var(--celeste);
		color: #fff;
		font-size: 0.73rem;
		font-weight: 500;
		line-height: 1.2;
		text-align: left;
		border-radius: 0.8rem;
		box-shadow: 0 5px 14px rgba(32, 94, 150, 0.35);
	}
	.badge-icon {
		flex-shrink: 0;
		width: 1.4rem;
		height: 1.4rem;
		object-fit: contain;
		border-radius: 0.25rem;
	}
	.card:focus-visible {
		border-color: color-mix(in srgb, var(--violeta1) 45%, #ececec);
		transform: translateY(-2px);
		box-shadow: 0 10px 30px rgba(102, 37, 124, 0.16);
		outline: none;
	}
	.card.selected {
		border-color: var(--violeta1);
		box-shadow: 0 10px 30px rgba(102, 37, 124, 0.16);
	}
	@media (hover: hover) {
		.card:hover {
			border-color: color-mix(in srgb, var(--violeta1) 45%, #ececec);
			transform: translateY(-2px);
			box-shadow: 0 10px 30px rgba(102, 37, 124, 0.16);
			outline: none;
		}
	}

	.logo-wrap {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 3.5rem;
	}
	.logo-wrap img {
		max-height: 100%;
		max-width: 12rem;
		object-fit: contain;
	}

	.price {
		display: flex;
		align-items: baseline;
		justify-content: center;
		gap: 0.25rem;
	}
	.price strong {
		color: var(--magenta);
		font-size: 1.9rem;
		font-weight: 800;
		line-height: 1;
	}
	.price .per {
		font-size: 0.85rem;
		color: #9a9a9a;
	}
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

	.futbol-switch {
		align-self: center;
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		cursor: pointer;
		padding: 0.3rem 0.4rem;
	}
	.futbol-switch input {
		position: absolute;
		width: 1px;
		height: 1px;
		opacity: 0;
	}
	.switch-track {
		flex-shrink: 0;
		width: 2.15rem;
		height: 1.25rem;
		border-radius: 999px;
		background: #dcdcdc;
		position: relative;
		transition: background 0.2s ease;
	}
	.switch-track::after {
		content: '';
		position: absolute;
		top: 0.15rem;
		left: 0.15rem;
		width: 0.95rem;
		height: 0.95rem;
		border-radius: 50%;
		background: #fff;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
		transition: transform 0.2s ease;
	}
	.futbol-switch input:checked + .switch-track {
		background: var(--violeta1);
	}
	.futbol-switch input:checked + .switch-track::after {
		transform: translateX(0.9rem);
	}
	.futbol-switch input:focus-visible + .switch-track {
		outline: 2px solid var(--violeta1);
		outline-offset: 2px;
	}
	.switch-label {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--violeta1);
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.3rem;
	}
	.switch-label small {
		font-size: 0.72rem;
		font-weight: 400;
		color: var(--magenta);
	}

	.grilla-link {
		align-self: center;
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		background: none;
		border: none;
		color: var(--violeta1);
		font-weight: 600;
		font-size: 0.85rem;
		cursor: pointer;
		padding: 0.15rem 0.4rem;
		width: auto;
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.grilla-link:hover {
		opacity: 0.75;
	}

	.features {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		text-align: left;
	}

	@media (min-width: 768px) {
		.features {
			flex: 1;
		}
	}
	.features li {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		font-size: 0.95rem;
		color: var(--violeta1);
		font-weight: 300;
	}
	.features li.pos {
		font-weight: 600;
	}
	.features li.neg .txt {
		color: #6f6f6f;
	}
	.ico {
		flex-shrink: 0;
		width: 1.4rem;
		height: 1.4rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.pos .ico {
		color: #1ba37a;
	}
	.neg .ico {
		color: #9a9a9a;
	}
	.dot {
		width: 0.4rem;
		height: 0.4rem;
		border-radius: 999px;
		background: var(--violeta1);
	}

	.more {
		margin-top: 0.25rem;
		font-size: 0.85rem;
		font-weight: 700;
		color: var(--magenta);
		text-transform: uppercase;
		letter-spacing: 0.02em;
	}
</style>
