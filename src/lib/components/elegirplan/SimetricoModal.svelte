<script>
	// Modal gráfico que explica la diferencia entre internet simétrico y
	// asimétrico (bajada vs subida). Cierra con ✕ / Escape / click en backdrop.
	import { fade, scale } from 'svelte/transition';

	let { onclose } = $props();

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
		aria-label="¿Qué es internet simétrico?"
		transition:scale={{ duration: 200, start: 0.95 }}
		onclick={(e) => e.stopPropagation()}
	>
		<button class="close" onclick={() => onclose?.()} aria-label="Cerrar">✕</button>

		<h3>¿Qué es internet simétrico?</h3>
		<p class="lead">Es la relación entre tu velocidad de <strong>bajada</strong> (descargar) y de <strong>subida</strong> (subir archivos, video de tus videollamadas, etc.).</p>

		<!-- Asimétrico -->
		<div class="cmp">
			<div class="cmp-head">
				<span class="cmp-name">Asimétrico</span>
				<span class="cmp-tag">lo común</span>
			</div>
			<div class="rate">
				<span class="dir"><span class="ico down" aria-hidden="true">↓</span> Bajada</span>
				<span class="bar"><span class="fill down" style:width="100%"></span></span>
				<span class="val">rápida</span>
			</div>
			<div class="rate">
				<span class="dir"><span class="ico up" aria-hidden="true">↑</span> Subida</span>
				<span class="bar"><span class="fill up" style:width="25%"></span></span>
				<span class="val muted">lenta</span>
			</div>
		</div>

		<!-- Simétrico -->
		<div class="cmp cmp--on">
			<div class="cmp-head">
				<span class="cmp-name">Simétrico</span>
				<span class="cmp-tag tag--on">Gamer · Worker</span>
			</div>
			<div class="rate">
				<span class="dir"><span class="ico down" aria-hidden="true">↓</span> Bajada</span>
				<span class="bar"><span class="fill down" style:width="100%"></span></span>
				<span class="val">rápida</span>
			</div>
			<div class="rate">
				<span class="dir"><span class="ico up" aria-hidden="true">↑</span> Subida</span>
				<span class="bar"><span class="fill up" style:width="100%"></span></span>
				<span class="val">igual</span>
			</div>
		</div>

		<p class="note">Con <strong>simétrico</strong> subís a la misma velocidad que bajás. Mejor para <strong>videollamadas, teletrabajo, gaming</strong> y subir archivos a la nube.</p>
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
		z-index: 1100;
		overflow-y: auto;
	}
	.modal {
		position: relative;
		background: #fff;
		border-radius: 1.2rem;
		padding: 1.75rem 1.4rem 1.5rem;
		width: 100%;
		max-width: 25rem;
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
		margin: 0 0 0.6rem;
		padding-right: 1.5rem;
	}
	.lead {
		font-size: 0.88rem;
		line-height: 1.45;
		color: #6b6b6b;
		font-weight: 300;
		margin: 0 0 1.1rem;
	}
	.lead strong {
		color: var(--violeta1);
		font-weight: 700;
	}

	.cmp {
		border: 2px solid #ececec;
		border-radius: 0.9rem;
		padding: 0.85rem 0.95rem;
		margin-bottom: 0.85rem;
	}
	.cmp--on {
		border-color: var(--violeta1);
		background: #f7f2fa;
	}
	.cmp-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin-bottom: 0.7rem;
	}
	.cmp-name {
		font-weight: 800;
		color: var(--violeta1);
		font-size: 1rem;
	}
	.cmp-tag {
		font-size: 0.62rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		color: #9a9a9a;
		background: #f1f1f1;
		padding: 0.15rem 0.5rem;
		border-radius: 999px;
	}
	.cmp-tag.tag--on {
		color: #fff;
		background: var(--magenta);
	}

	.rate {
		display: grid;
		grid-template-columns: 4.6rem 1fr 3.5rem;
		align-items: center;
		gap: 0.55rem;
		margin-top: 0.4rem;
	}
	.dir {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--violeta1);
		white-space: nowrap;
	}
	.ico {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.05rem;
		height: 1.05rem;
		border-radius: 999px;
		font-size: 0.72rem;
		font-weight: 800;
		color: #fff;
	}
	.ico.down {
		background: var(--celeste, #2e9bdb);
	}
	.ico.up {
		background: var(--magenta);
	}
	.bar {
		height: 0.6rem;
		background: #ececec;
		border-radius: 999px;
		overflow: hidden;
	}
	.fill {
		display: block;
		height: 100%;
		border-radius: 999px;
	}
	.fill.down {
		background: var(--celeste, #2e9bdb);
	}
	.fill.up {
		background: var(--magenta);
	}
	.val {
		font-size: 0.72rem;
		font-weight: 600;
		color: var(--violeta1);
		white-space: nowrap;
	}
	.val.muted {
		color: #9a9a9a;
		font-weight: 400;
	}

	.note {
		font-size: 0.82rem;
		line-height: 1.45;
		color: #6b6b6b;
		font-weight: 300;
		background: #faf8fb;
		border-radius: 0.6rem;
		padding: 0.75rem 0.85rem;
		margin: 0.25rem 0 0;
	}
	.note strong {
		color: var(--violeta1);
		font-weight: 700;
	}
</style>
