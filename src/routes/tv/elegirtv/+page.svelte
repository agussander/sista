<script>
	import { SITE_ORIGIN } from '$lib/seo.js';
	import { onMount } from 'svelte';
	import { MetaTags } from 'svelte-meta-tags';
	import { pb } from '$lib/pocketbase';
	import { fetchTarifario } from '$lib/tarifario/fetchTarifario.js';
	import { sinImpuestosPorCampo } from '$lib/tarifario/mapeoPrecios.js';

	import TvServicesSection from '$lib/components/tv/TvServicesSection.svelte';

	let precios = $state({});
	let sinImpuestos = $state({});
	let loading = $state(true);

	onMount(async () => {
		try {
			const record = await pb.collection('precios').getFirstListItem('');
			if (record) precios = record;
		} catch (e) {
			console.error('Error cargando precios desde PocketBase:', e);
		} finally {
			loading = false;
		}
	});

	onMount(async () => {
		// Decorativo: si falla, la página sigue mostrando el precio final igual
		// que hoy, solo sin la línea de "sin impuestos nacionales".
		try {
			const { tarifasWeb } = await fetchTarifario();
			sinImpuestos = sinImpuestosPorCampo(tarifasWeb.filas);
		} catch (error) {
			console.error('Error cargando el tarifario desde PocketBase:', error);
		}
	});
</script>

<MetaTags
	title="Elegí tu TV · Sista"
	description="Conocé los 3 servicios de TV de Sista: Gigared Play, Antina Play y DGO. Canales, precios y adicionales."
	robots="noindex, nofollow"
	openGraph={{
		type: 'website',
		images: [
			{
				url: `${SITE_ORIGIN}/images/tv/tv-meta-img.png`,
				width: 600,
				height: 600,
				alt: 'TV de Sista'
			}
		]
	}}
	twitter={{
		cardType: 'summary',
		image: `${SITE_ORIGIN}/images/tv/tv-meta-img.png`,
		imageAlt: 'TV de Sista'
	}}
/>

<main>
	<header class="intro">
		<h1>Elegí tu plan de TV</h1>
		<p>Tenemos 3 servicios de TV. Tocá cada uno para ver cómo funciona, qué canales trae y sumarle adicionales.</p>
	</header>

	<TvServicesSection {precios} {sinImpuestos} {loading} />
</main>

<style>
	main {
		max-width: 64rem;
		margin: 0 auto;
		padding: 6.5rem 1rem 4rem;
	}

	.intro {
		text-align: center;
		margin-bottom: 2rem;
	}
	.intro h1 {
		color: var(--violeta1);
		font-size: 2.2rem;
		font-weight: 800;
		margin: 0 0 0.5rem;
	}
	.intro p {
		max-width: 34rem;
		margin: 0 auto;
		color: #6b6b6b;
		font-size: 1rem;
		line-height: 1.5;
	}

	@media (min-width: 768px) {
		.intro h1 {
			font-size: 3rem;
		}
	}
</style>
