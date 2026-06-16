<script>
	// Tarjeta seleccionable reutilizable (pasos 1, 3, 4, 5).
	// Soporta media (logo o icono), título, subtítulo, features, precio, tag y
	// estado seleccionado. `multi` muestra indicador tipo checkbox (adicionales).
	// `details` (array) habilita un botón "Más información" que expande la tarjeta
	// sin disparar el onclick. `showCheck=false` oculta el indicador (radio/check).
	import { slide } from 'svelte/transition';

	let {
		title,
		subtitle = '',
		subtitleStrong = false,
		price = '',
		tag = '',
		logo = '',
		icon = '',
		features = [],
		details = [],
		selected = false,
		multi = false,
		showCheck = true,
		disabled = false,
		onclick,
		// Si se pasa, dentro del expandible aparece un link "¿Qué es simétrico?"
		// que dispara este callback (sin avanzar la tarjeta).
		onSymmetricInfo = null
	} = $props();

	let consultar = $derived(price === 'Consultar');
	let expanded = $state(false);

	function handleKey(e) {
		if (disabled) return;
		// Ignorar teclas originadas en controles internos (ej. botón "Más información").
		if (e.target !== e.currentTarget) return;
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			onclick?.();
		}
	}

	function toggleDetails(e) {
		e.stopPropagation();
		expanded = !expanded;
	}
</script>

<div
	class="opt"
	class:selected
	class:disabled
	role="button"
	tabindex={disabled ? -1 : 0}
	aria-pressed={selected}
	aria-disabled={disabled}
	onclick={() => !disabled && onclick?.()}
	onkeydown={handleKey}
>
	<div class="row">
		{#if logo}
			<div class="media"><img src={logo} alt={title} /></div>
		{:else if icon}
			<div class="media icon" aria-hidden="true">{icon}</div>
		{/if}

		<div class="body">
			<div class="title-row">
				<span class="title">{title}</span>
				{#if tag}<span class="tag" class:tag--rec={tag === 'recomendado'}>{tag}</span>{/if}
			</div>
			{#if subtitle}<span class="subtitle" class:strong={subtitleStrong}>{subtitle}</span>{/if}
			{#if features.length}
				<ul class="features">
					{#each features as f}<li>{f}</li>{/each}
				</ul>
			{/if}
			{#if details.length}
				<button
					class="more-info"
					type="button"
					aria-expanded={expanded}
					onclick={toggleDetails}
				>
					{expanded ? 'Menos información' : 'Más información'}
					<svg class="chev" class:open={expanded} viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
				</button>
			{/if}
		</div>

		{#if price !== '' && price !== null}
			<div class="price" class:consultar>
				{#if consultar}
					<span class="price-consultar">Consultar</span>
				{:else}
					<strong>{price}</strong><span class="per">/mes</span>
				{/if}
			</div>
		{/if}

		{#if showCheck}
			<span class="check" class:multi aria-hidden="true">
				{#if selected}
					<svg viewBox="0 0 24 24" width="14" height="14"><path d="M5 13l4 4L19 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
				{/if}
			</span>
		{/if}
	</div>

	{#if details.length && expanded}
		<div class="details" transition:slide={{ duration: 200 }}>
			<ul class="detail-list">
				{#each details as d}<li>{d}</li>{/each}
			</ul>
			{#if onSymmetricInfo}
				<button
					class="sym-link"
					type="button"
					onclick={(e) => { e.stopPropagation(); onSymmetricInfo(); }}
				>
					¿Qué es simétrico?
				</button>
			{/if}
		</div>
	{/if}
</div>

<style>
	.opt {
		display: flex;
		flex-direction: column;
		width: 100%;
		text-align: left;
		background: #fff;
		border: 2px solid #ececec;
		border-radius: 0.9rem;
		padding: 0.85rem 1rem;
		cursor: pointer;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
	}
	.opt:hover:not(.disabled) {
		border-color: color-mix(in srgb, var(--violeta1) 40%, #ececec);
		transform: translateY(-1px);
	}
	.opt.selected {
		border-color: var(--violeta1);
		background: #f0e7f4;
		box-shadow: 0 2px 10px rgba(102, 37, 124, 0.18);
	}
	.opt.disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		width: 100%;
	}

	.media {
		flex-shrink: 0;
		width: 3rem;
		height: 3rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #faf9f6;
		border-radius: 0.6rem;
		overflow: hidden;
	}
	.media img {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
	}
	.media.icon {
		font-size: 1.5rem;
		color: var(--violeta1);
	}

	.body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}
	.title-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.title {
		font-weight: 700;
		color: var(--violeta1);
		font-size: 1.05rem;
	}
	.tag {
		font-size: 0.65rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		color: var(--violeta1);
		background: #efe6f3;
		padding: 0.15rem 0.5rem;
		border-radius: 999px;
	}
	.tag--rec {
		color: #fff;
		background: var(--magenta);
	}
	.subtitle {
		font-size: 0.85rem;
		color: #6b6b6b;
		font-weight: 300;
	}
	.subtitle.strong {
		font-size: 1.05rem;
		font-weight: 800;
		color: var(--violeta1);
	}
	.features {
		list-style: none;
		margin: 0.3rem 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}
	.features li {
		font-size: 0.78rem;
		color: #6b6b6b;
		font-weight: 300;
	}

	.more-info {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		margin-top: 0.3rem;
		padding: 0.1rem 0;
		background: none;
		border: none;
		width: auto;
		cursor: pointer;
		font-size: 0.75rem;
		font-weight: 400;
		color: #9a9a9a;
	}
	.more-info:hover {
		color: var(--violeta1);
	}
	.chev {
		transition: transform 0.2s ease;
	}
	.chev.open {
		transform: rotate(180deg);
	}

	.details {
		margin: 0.75rem 0 0;
		padding: 0.75rem 0 0;
		border-top: 1px solid #ececec;
	}
	.detail-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}
	.detail-list li {
		position: relative;
		padding-left: 1rem;
		font-size: 0.82rem;
		line-height: 1.35;
		color: #6b6b6b;
		font-weight: 300;
	}
	.detail-list li::before {
		content: '';
		position: absolute;
		left: 0;
		top: 0.5rem;
		width: 0.35rem;
		height: 0.35rem;
		border-radius: 999px;
		background: var(--violeta1);
		opacity: 0.5;
	}
	.sym-link {
		margin-top: 0.6rem;
		padding: 0;
		background: none;
		border: none;
		width: auto;
		cursor: pointer;
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--magenta);
		text-decoration: underline;
		text-underline-offset: 2px;
	}
	.sym-link:hover {
		opacity: 0.8;
	}

	.price {
		flex-shrink: 0;
		text-align: right;
		white-space: nowrap;
	}
	.price strong {
		color: var(--magenta);
		font-size: 1.1rem;
		font-weight: 700;
	}
	.price .per {
		display: block;
		font-size: 0.7rem;
		color: #9a9a9a;
	}
	.price-consultar {
		color: #9a6cb0;
		font-size: 0.85rem;
		font-weight: 600;
		font-style: italic;
	}

	.check {
		flex-shrink: 0;
		width: 1.4rem;
		height: 1.4rem;
		border-radius: 999px;
		border: 2px solid #d4d4d4;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #fff;
	}
	.check.multi {
		border-radius: 0.4rem;
	}
	.selected .check {
		background: var(--violeta1);
		border-color: var(--violeta1);
	}
</style>
