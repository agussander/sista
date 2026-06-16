<script>
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { MetaTags } from 'svelte-meta-tags';
	import { pb } from '$lib/pocketbase';

	import { formatPrice, WHATSAPP_PHONE } from '$lib/components/elegirplan/data.js';
	import { TV_SERVICES, serviceByKey } from '$lib/components/tv/tvData.js';
	import TvServiceCard from '$lib/components/tv/TvServiceCard.svelte';
	import TvServiceModal from '$lib/components/tv/TvServiceModal.svelte';
	import GrillaViewer from '$lib/components/tv/GrillaViewer.svelte';
	import TvCompatInfo from '$lib/components/tv/TvCompatInfo.svelte';
	import AyudameElegirTv from '$lib/components/tv/AyudameElegirTv.svelte';

	let precios = $state({});
	let loading = $state(true);

	let grillaKey = $state(null); // servicio con grilla abierta (efímero, no en URL)

	// El modal abierto se sincroniza con ?tv= en la URL (sólo en el browser;
	// durante el pre-render SSR el valor es null, lo cual es correcto).
	let openKey = $state(null);
	$effect(() => {
		if (!browser) return;
		const tv = $page.url.searchParams.get('tv');
		openKey = serviceByKey(tv) ? tv : null;
	});

	let openService = $derived(openKey ? serviceByKey(openKey) : null);
	let grillaService = $derived(grillaKey ? serviceByKey(grillaKey) : null);

	// Abrir/cerrar el modal = navegar (push), así Back cierra el modal.
	function openModal(key) {
		const sp = new URLSearchParams($page.url.searchParams);
		sp.set('tv', key);
		goto('?' + sp.toString(), { noScroll: true, keepFocus: true });
	}
	function closeModal() {
		const sp = new URLSearchParams($page.url.searchParams);
		sp.delete('tv');
		goto('?' + sp.toString(), { noScroll: true, keepFocus: true });
	}

	// Arma el mensaje de WhatsApp con el servicio + adicionales elegidos (lo que
	// antes vivía dentro de TvServiceModal). Se pasa como onConfirm del modal.
	function buildTvWhatsappUrl(service, chosenAddons) {
		const tvVal = Number(precios[service.priceField]) || 0;
		const lineLabel = (v) => (v > 0 ? `${formatPrice(v)}/mes` : 'Consultar');
		const items = [
			{ label: service.label, value: tvVal },
			...chosenAddons.map((a) => ({ label: a.label, value: Number(precios[a.field]) || 0 }))
		];
		const total = items.reduce((s, it) => s + it.value, 0);
		const lines = [`Me interesa el servicio de TV ${service.label} (${lineLabel(tvVal)})`];
		if (chosenAddons.length) lines.push(`Adicionales: ${chosenAddons.map((a) => a.label).join(', ')}`);
		lines.push(`Total: ${total > 0 ? `${formatPrice(total)}/mes` : 'a consultar'}`);
		return `https://api.whatsapp.com/send?phone=${WHATSAPP_PHONE}&text=${encodeURIComponent(lines.join('\n'))}`;
	}

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
				url: 'https://sista.com.ar/images/tv/tv-meta-img.png',
				width: 600,
				height: 600,
				alt: 'TV de Sista'
			}
		]
	}}
	twitter={{
		cardType: 'summary',
		image: 'https://sista.com.ar/images/tv/tv-meta-img.png',
		imageAlt: 'TV de Sista'
	}}
/>

<main>
	<header class="intro">
		<h1>Elegí tu plan de TV</h1>
		<p>Tenemos 3 servicios de TV. Tocá cada uno para ver cómo funciona, qué canales trae y sumarle adicionales.</p>
	</header>

	<TvCompatInfo cardsId="cards" />

	{#if loading}
		<div class="loading">
			<span class="spinner" aria-hidden="true"></span>
			<p>Cargando precios…</p>
		</div>
	{:else}
		<div class="ayuda">
			<AyudameElegirTv {precios} onPick={(key) => openModal(key)} />
		</div>

		<div id="cards" class="cards">
			{#each TV_SERVICES as service (service.key)}
				<TvServiceCard
					{service}
					{precios}
					onOpen={() => openModal(service.key)}
					onGrilla={() => (grillaKey = service.key)}
				/>
			{/each}
		</div>
	{/if}
</main>

{#if openService}
	<TvServiceModal
		service={openService}
		{precios}
		onGrilla={() => (grillaKey = openService.key)}
		onConfirm={(service, addons) => window.open(buildTvWhatsappUrl(service, addons), '_blank', 'noopener')}
		onclose={() => closeModal()}
	/>
{/if}

{#if grillaService}
	<GrillaViewer service={grillaService} onclose={() => (grillaKey = null)} />
{/if}

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

	.cards {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		scroll-margin-top: 1.25rem;
	}

	.ayuda {
		max-width: 30rem;
		margin: 0 auto 2rem;
	}

	.loading {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 4rem 0;
		color: #9a9a9a;
	}
	.spinner {
		width: 2.25rem;
		height: 2.25rem;
		border: 3px solid #ececec;
		border-top-color: var(--violeta1);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (min-width: 768px) {
		.intro h1 {
			font-size: 3rem;
		}
		.cards {
			flex-direction: row;
			align-items: stretch;
		}
		.cards > :global(*) {
			flex: 1;
		}
	}
</style>
