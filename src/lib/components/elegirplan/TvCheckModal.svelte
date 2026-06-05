<script>
	import { fade, scale } from 'svelte/transition';
	import { INCOMPATIBLES } from './data.js';

	// platform: servicio de TV_SERVICES o su adaptador tvByKey (label, logo, warnMagisXuper).
	let { platform, onconfirm, oncancel } = $props();

	// Logos de servicios incompatibles que fallan al cargar → fallback a chip
	let failed = $state({});

	function onKey(e) {
		if (e.key === 'Escape') oncancel?.();
	}
</script>

<svelte:window onkeydown={onKey} />

<div class="backdrop" transition:fade={{ duration: 150 }} onclick={() => oncancel?.()} role="presentation">
	<div
		class="modal"
		role="dialog"
		aria-modal="true"
		aria-label={`Antes de elegir ${platform.label}`}
		transition:scale={{ duration: 200, start: 0.95 }}
		onclick={(e) => e.stopPropagation()}
	>
		<button class="close" onclick={() => oncancel?.()} aria-label="Cerrar">✕</button>

		<header class="head">
			{#if platform.logo}
				<img class="plat-logo" src={platform.logo} alt={platform.label} />
			{/if}
			<h3>Antes de elegir {platform.label}</h3>
		</header>

		{#if platform.warnMagisXuper}
			<!-- Antina / Gigared: aviso Magis / Xuper -->
			<div class="warn">
				<span class="warn-ico" aria-hidden="true">!</span>
				<p>No va a funcionar si tuviste <strong>Magis</strong> o <strong>Xuper</strong> en esa TV.</p>
			</div>
			<div class="logos">
				{#each INCOMPATIBLES as inc}
					{#if failed[inc.label]}
						<span class="chip">{inc.label}</span>
					{:else}
						<img src={inc.logo} alt={inc.label} onerror={() => (failed[inc.label] = true)} />
					{/if}
				{/each}
			</div>
		{/if}

		<!-- Chequeo de instalación de la app (las 3 plataformas) -->
		<p class="lead">Confirmá que la app funcione en tu Smart TV:</p>
		<ol class="steps">
			<li><span class="n">1</span> <span class="txt">Buscá <strong>{platform.label}</strong> en la tienda de apps de tu TV</span></li>
			<li><span class="n">2</span> <span class="txt">Instalá</span></li>
			<li><span class="n">3</span> <span class="txt">Si abre bien, es compatible</span></li>
		</ol>

		<p class="note">Si ya la bajaste, no te crees una cuenta: nosotros te pasamos todo.</p>

		<div class="actions">
			<button class="btn-primary btn-full" onclick={() => onconfirm?.()}>La instalé, funciona</button>
			<a class="btn-text" href="/tv" target="_blank" rel="noopener">Ver TVs compatibles</a>
		</div>
	</div>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		background: rgba(43, 18, 53, 0.55);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.25rem;
		z-index: 1000;
	}
	.modal {
		position: relative;
		background: #fff;
		border-radius: 1.1rem;
		padding: 1.6rem 1.4rem 1.4rem;
		width: 100%;
		max-width: 24rem;
		box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
	}
	.close {
		position: absolute;
		top: 0.75rem;
		right: 0.85rem;
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
		gap: 0.75rem;
		margin-bottom: 1rem;
	}
	.plat-logo {
		width: 2.5rem;
		height: 2.5rem;
		object-fit: contain;
		flex-shrink: 0;
	}
	h3 {
		font-size: 1.15rem;
		color: var(--violeta1);
		text-transform: none;
		margin: 0;
	}
	.lead {
		font-size: 0.9rem;
		color: #6b6b6b;
		margin: 0 0 1rem;
	}
	.steps {
		list-style: none;
		padding: 0;
		margin: 0 0 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}
	.steps li {
		display: flex;
		align-items: flex-start;
		gap: 0.6rem;
		font-size: 0.92rem;
		color: var(--violeta1);
		font-weight: 300;
	}
	.steps .txt {
		line-height: 1.5rem;
	}
	.steps .txt strong {
		font-weight: 700;
		white-space: nowrap;
	}
	.steps .n {
		flex-shrink: 0;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 999px;
		background: #f0e7f4;
		color: var(--violeta1);
		font-weight: 700;
		font-size: 0.8rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.note {
		font-size: 0.82rem;
		color: #6b6b6b;
		font-weight: 300;
		background: #faf8fb;
		border-radius: 0.6rem;
		padding: 0.7rem 0.85rem;
		margin: 0 0 1.25rem;
	}
	.warn {
		display: flex;
		align-items: flex-start;
		gap: 0.65rem;
		background: #fff4f7;
		border: 1px solid #f6d2de;
		border-radius: 0.7rem;
		padding: 0.85rem;
		margin-bottom: 1rem;
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
		font-size: 0.9rem;
		color: var(--violeta1);
		font-weight: 300;
	}
	.logos {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1.25rem;
		margin-bottom: 1.25rem;
		min-height: 2.5rem;
	}
	.logos img {
		height: 2.2rem;
		max-width: 7rem;
		object-fit: contain;
		filter: grayscale(0.2);
		opacity: 0.85;
	}
	.chip {
		font-weight: 700;
		color: #9a9a9a;
		background: #f1f1f1;
		border: 1px dashed #cfcfcf;
		border-radius: 0.5rem;
		padding: 0.35rem 0.85rem;
		font-size: 0.95rem;
	}
	.actions {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.4rem;
	}
</style>
