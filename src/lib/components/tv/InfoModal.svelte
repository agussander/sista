<script>
	// Modal informativo simple (título + contenido libre). Cierra con ✕ / Escape /
	// click en el backdrop. Usado para "Mi TV no es smart" y "¿Es compatible?".
	import { fade, scale } from 'svelte/transition';

	let { title, onclose, children } = $props();

	function onKey(e) {
		if (e.key === 'Escape') onclose?.();
	}
</script>

<svelte:window onkeydown={onKey} />

<div class="backdrop" transition:fade={{ duration: 150 }} onclick={() => onclose?.()} role="presentation">
	<div
		class="modal"
		role="dialog"
		aria-modal="true"
		aria-label={title}
		transition:scale={{ duration: 200, start: 0.95 }}
		onclick={(e) => e.stopPropagation()}
	>
		<button class="close" onclick={() => onclose?.()} aria-label="Cerrar">✕</button>
		<h3>{title}</h3>
		<div class="content">{@render children?.()}</div>
	</div>
</div>

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
		max-width: 24rem;
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
	h3 {
		font-size: 1.2rem;
		color: var(--violeta1);
		text-transform: none;
		margin: 0 0 0.85rem;
		padding-right: 1.5rem;
	}
	.content :global(p) {
		font-size: 0.92rem;
		line-height: 1.5;
		color: #6b6b6b;
		font-weight: 300;
		margin: 0 0 1rem;
	}
	.content :global(p:last-of-type) {
		margin-bottom: 1.25rem;
	}
	.content :global(strong) {
		color: var(--violeta1);
		font-weight: 600;
	}
</style>
