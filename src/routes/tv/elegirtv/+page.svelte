<script>
	import { onMount } from 'svelte';
	import { MetaTags } from 'svelte-meta-tags';
	import { pb } from '$lib/pocketbase';

	import { TV_SERVICES, serviceByKey } from '$lib/components/tv/tvData.js';
	import TvServiceCard from '$lib/components/tv/TvServiceCard.svelte';
	import TvServiceModal from '$lib/components/tv/TvServiceModal.svelte';
	import GrillaViewer from '$lib/components/tv/GrillaViewer.svelte';
	import InfoModal from '$lib/components/tv/InfoModal.svelte';
	import AyudameElegirTv from '$lib/components/tv/AyudameElegirTv.svelte';

	const TV_BOX_URL = 'https://tiendasista.mitiendanube.com/productos/bvs-android-tv-caja-adaptadora/';

	let precios = $state({});
	let loading = $state(true);

	let openKey = $state(null); // servicio con modal abierto
	let grillaKey = $state(null); // servicio con grilla abierta
	let info = $state(null); // aviso abierto: 'nosmart' | 'compat' | null

	let openService = $derived(openKey ? serviceByKey(openKey) : null);
	let grillaService = $derived(grillaKey ? serviceByKey(grillaKey) : null);

	function goToServices() {
		info = null;
		setTimeout(() => {
			document.getElementById('cards')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}, 50);
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
/>

<main>
	<header class="intro">
		<h1>Elegí tu plan de TV</h1>
		<p>Tenemos 3 servicios de TV. Tocá cada uno para ver cómo funciona, qué canales trae y sumarle adicionales.</p>
	</header>

	<div class="notice">
		<p>
			Estos servicios <strong>no son por cable ni incluyen deco</strong>. Son
			<strong>aplicaciones</strong> que se descargan en tu Smart TV, TV Box, Chromecast, etc.
		</p>
		<div class="notice-actions">
			<button class="btn-secondary btn-sm" onclick={() => (info = 'nosmart')}>Mi TV no es smart</button>
			<button class="btn-secondary btn-sm" onclick={() => (info = 'compat')}>¿Es compatible mi TV?</button>
		</div>
	</div>

	{#if loading}
		<div class="loading">
			<span class="spinner" aria-hidden="true"></span>
			<p>Cargando precios…</p>
		</div>
	{:else}
		<div id="cards" class="cards">
			{#each TV_SERVICES as service (service.key)}
				<TvServiceCard
					{service}
					{precios}
					onOpen={() => (openKey = service.key)}
					onGrilla={() => (grillaKey = service.key)}
				/>
			{/each}
		</div>

		<div class="ayuda">
			<AyudameElegirTv {precios} onPick={(key) => (openKey = key)} />
		</div>
	{/if}
</main>

{#if openService}
	<TvServiceModal
		service={openService}
		{precios}
		onGrilla={() => (grillaKey = openService.key)}
		onclose={() => (openKey = null)}
	/>
{/if}

{#if grillaService}
	<GrillaViewer service={grillaService} onclose={() => (grillaKey = null)} />
{/if}

{#if info === 'nosmart'}
	<InfoModal title="Mi TV no es smart" onclose={() => (info = null)}>
		<p>
			No hay problema. Podés usar un <strong>TV Box</strong>: un aparatito que se enchufa a tu TV por
			HDMI y la convierte en smart, lista para descargar las apps.
		</p>
		<p>Es compatible con los 3 servicios. Lo conseguís en nuestra tienda online.</p>
		<a class="btn-primary btn-full" href={TV_BOX_URL} target="_blank" rel="noopener noreferrer">
			Ver TV Box en la tienda
		</a>
	</InfoModal>
{:else if info === 'compat'}
	<InfoModal title="¿Es compatible mi TV?" onclose={() => (info = null)}>
		<p>Como cada servicio es una <strong>app</strong>, lo más seguro es probarlo en tu Smart TV:</p>
		<p>
			Buscá la app (<strong>DGO</strong>, <strong>Antina Play</strong> o
			<strong>Gigared Play</strong>) en la tienda de aplicaciones de tu TV, instalala y abrila. Si
			abre bien, es compatible.
		</p>
		<p>Si no aparece en la tienda de tu TV, podés usar un TV Box.</p>
		<button class="btn-secondary btn-full" onclick={goToServices}>
			Ver servicios
		</button>
	</InfoModal>
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

	.notice {
		max-width: 38rem;
		margin: 0 auto 2rem;
		background: #f0e7f4;
		border: 1px solid color-mix(in srgb, var(--violeta1) 18%, transparent);
		border-radius: 1rem;
		padding: 1.1rem 1.25rem;
		text-align: center;
	}
	.notice p {
		margin: 0 0 0.85rem;
		font-size: 0.92rem;
		line-height: 1.5;
		color: var(--violeta1);
		font-weight: 300;
	}
	.notice strong {
		font-weight: 700;
	}
	.notice-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
		justify-content: center;
	}

	.cards {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		scroll-margin-top: 1.25rem;
	}

	.ayuda {
		max-width: 30rem;
		margin: 2rem auto 0;
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
