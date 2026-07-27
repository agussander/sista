<script>
	// Overlay full-screen scrolleable que muestra la grilla de un servicio.
	// La grilla (<ChannelGrid/>) ya es una tarjeta autocontenida (fondo, borde,
	// sombra y radio propios), así que se despliega directamente sobre el
	// backdrop, sin panel/header extra, con una sola X flotante arriba a la
	// derecha. DGO / Gigared / Antina → <ChannelGrid/>. Otros → imagen.
	import { fade, fly } from 'svelte/transition';
	import ChannelGrid from '$lib/components/features/ChannelGrid.svelte';

	let { service, onclose } = $props();

	function onKey(e) {
		if (e.key === 'Escape') onclose?.();
	}
</script>

<svelte:window onkeydown={onKey} />

<div class="backdrop" transition:fade={{ duration: 150 }} onclick={() => onclose?.()} role="presentation">
	<div
		class="viewer"
		role="dialog"
		aria-modal="true"
		aria-label={`Canales de ${service.label}`}
		transition:fly={{ y: 24, duration: 220 }}
		onclick={(e) => e.stopPropagation()}
	>
		<button class="close" onclick={() => onclose?.()} aria-label="Cerrar">✕</button>

		{#if service.grilla.type === 'channelgrid'}
			<ChannelGrid
				channels={service.grilla.channels}
				accent={service.grilla.accent}
				categoryPrices={service.grilla.categoryPrices ?? {}}
			/>
		{:else}
			<img class="grilla-img" src={service.grilla.src} alt={service.grilla.alt} />
		{/if}
	</div>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		background: rgba(43, 18, 53, 0.6);
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding: 1.5rem 1rem;
		z-index: 1100;
		overflow-y: auto;
	}
	.viewer {
		position: relative;
		width: 100%;
		max-width: 72em;
		margin: auto;
	}
	/* La grilla ya trae margen superior pensado para las páginas; dentro del
	   modal lo anulamos y le dejamos espacio arriba para la X flotante. */
	.viewer :global(.channel-grid) {
		margin: 0;
		padding-top: 3.5em;
	}
	.close {
		position: absolute;
		top: 0.9rem;
		right: 0.9rem;
		z-index: 2;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.4rem;
		height: 2.4rem;
		font-size: 1rem;
		color: #4a4a52;
		background: #fff;
		border: 1px solid rgba(0, 0, 0, 0.08);
		border-radius: 999px;
		cursor: pointer;
		box-shadow: 0 0.25rem 0.75rem rgba(0, 0, 0, 0.18);
		transition: background 0.15s ease, transform 0.15s ease;
	}
	.close:hover {
		background: #f1f1f1;
		transform: scale(1.05);
	}
	.grilla-img {
		display: block;
		width: 100%;
		height: auto;
		border-radius: 0.8rem;
		box-shadow: 0 0.75em 2.5em rgba(0, 0, 0, 0.25);
	}
</style>
