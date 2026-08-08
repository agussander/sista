<script>
	import { SITE_ORIGIN } from '$lib/seo.js';
	import { onMount } from 'svelte';
	import { MetaTags } from 'svelte-meta-tags';
	import { pb } from '$lib/pocketbase';

	import TvServicesSection from '$lib/components/tv/TvServicesSection.svelte';

	let precios = $state({});
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

	<TvServicesSection {precios} {loading} />
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
