<script>
	// Barra de progreso del wizard. `current` es el índice 0-based dentro del flujo.
	let { current = 0, total = 1 } = $props();

	let pct = $derived(Math.round(((current + 1) / Math.max(1, total)) * 100));
</script>

<div class="progress">
	<div class="track" role="progressbar" aria-valuenow={current + 1} aria-valuemin="1" aria-valuemax={total}>
		<div class="fill" style:width="{pct}%"></div>
	</div>
</div>

<style>
	.progress {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-bottom: 1.25rem;
	}
	.track {
		width: 100%;
		height: 6px;
		background: #ececec;
		border-radius: 999px;
		overflow: hidden;
	}
	.fill {
		height: 100%;
		background: #9a9a9a;
		border-radius: 999px;
		transition: width 0.4s cubic-bezier(0.22, 0.61, 0.36, 1);
	}
</style>
