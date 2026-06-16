<script>
	// Encabezado de cada paso (título + subtítulo opcional).
	let { title, subtitle = '' } = $props();
</script>

<header class="sh">
	<h2>{title}</h2>
	{#if subtitle}<p>{subtitle}</p>{/if}
</header>

<style>
	.sh {
		margin-bottom: 1.1rem;
	}
	h2 {
		font-size: 1.5rem;
		font-weight: 800;
		color: var(--violeta1);
		text-transform: none;
		text-align: left;
		margin: 0;
		line-height: 1.15;
	}
	p {
		margin: 0.35rem 0 0;
		font-size: 0.92rem;
		color: #6b6b6b;
		font-weight: 300;
	}
</style>
