<script>
	// Overlay full-screen scrolleable con la grilla de canales de un servicio.
	// DGO / Gigared → componente interactivo <ChannelGrid/>. Antina → imagen.
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
		class="panel"
		role="dialog"
		aria-modal="true"
		aria-label={`Canales de ${service.label}`}
		transition:fly={{ y: 24, duration: 220 }}
		onclick={(e) => e.stopPropagation()}
	>
		<header class="head">
			<div class="title">
				<img class="logo" src={service.logo} alt={service.label} />
				<span>Canales de {service.label}</span>
			</div>
			<button class="close" onclick={() => onclose?.()} aria-label="Cerrar">✕</button>
		</header>

		<div class="content">
			{#if service.grilla.type === 'channelgrid'}
				<ChannelGrid channels={service.grilla.channels} accent={service.grilla.accent} />
			{:else}
				<img class="grilla-img" src={service.grilla.src} alt={service.grilla.alt} />
			{/if}
		</div>
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
	.panel {
		position: relative;
		background: #fff;
		border-radius: 1.2rem;
		width: 100%;
		max-width: 60rem;
		margin: auto;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
		overflow: hidden;
	}
	.head {
		position: sticky;
		top: 0;
		z-index: 1;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1rem 1.25rem;
		background: #fff;
		border-bottom: 1px solid #ececec;
	}
	.title {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		font-weight: 700;
		color: var(--violeta1);
	}
	.logo {
		height: 1.8rem;
		max-width: 6rem;
		object-fit: contain;
	}
	.close {
		flex-shrink: 0;
		background: #f1f1f1;
		border: none;
		border-radius: 999px;
		width: 2rem;
		height: 2rem;
		font-size: 0.9rem;
		color: #6b6b6b;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.close:hover {
		background: #e6e6e6;
	}
	.content {
		padding: 1.25rem;
	}
	.grilla-img {
		display: block;
		width: 100%;
		height: auto;
		border-radius: 0.6rem;
	}
</style>
