<script>
	// TvPriceSummary.svelte — resumen compacto del servicio para el encabezado de
	// cada página (/dgo, /antinaplay, /gigaredplay). El logo ya va arriba en la
	// página, así que acá sólo mostramos el precio y los dispositivos simultáneos.
	import { formatPrice } from '$lib/components/elegirplan/data.js';

	let { service, precios = {} } = $props();

	let price = $derived(formatPrice(precios[service.priceField]));
	let consultar = $derived(price === 'Consultar');
</script>

<div class="summary">
	<div class="price" class:consultar>
		{#if consultar}
			<span class="price-consultar">Consultar precio</span>
		{:else}
			<strong>{price}</strong><span class="per">/mes</span>
		{/if}
	</div>

	{#if service.devices?.label}
		<p class="tvs">{service.devices.label}</p>
	{/if}
</div>

<style>
	.summary {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.35rem;
		margin: 0 auto 2.5em;
	}
	.price {
		display: flex;
		align-items: baseline;
		justify-content: center;
		gap: 0.25rem;
	}
	.price strong {
		color: var(--magenta);
		font-size: 2.4rem;
		font-weight: 800;
		line-height: 1;
	}
	.price .per {
		font-size: 0.95rem;
		color: #9a9a9a;
	}
	.price-consultar {
		color: #9a6cb0;
		font-weight: 600;
		font-style: italic;
		font-size: 1.2rem;
	}
	.tvs {
		margin: 0;
		color: var(--violeta1);
		font-weight: 600;
		font-size: 1.05rem;
	}
</style>
