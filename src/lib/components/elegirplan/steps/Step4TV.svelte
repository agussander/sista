<script>
	import StepHeader from '$lib/components/elegirplan/StepHeader.svelte';
	import { STEP_TITLES } from '$lib/components/elegirplan/data.js';
	import { wizard, chooseTvService, next } from '$lib/components/elegirplan/wizardState.svelte.js';

	import { TV_SERVICES, serviceByKey } from '$lib/components/tv/tvData.js';
	import TvServiceCard from '$lib/components/tv/TvServiceCard.svelte';
	import TvServiceModal from '$lib/components/tv/TvServiceModal.svelte';
	import GrillaViewer from '$lib/components/tv/GrillaViewer.svelte';
	import InfoModal from '$lib/components/tv/InfoModal.svelte';
	import AyudameElegirTv from '$lib/components/tv/AyudameElegirTv.svelte';

	const TV_BOX_URL = 'https://tiendasista.mitiendanube.com/productos/bvs-android-tv-caja-adaptadora/';

	let openKey = $state(null); // servicio con modal abierto
	let grillaKey = $state(null); // servicio con grilla abierta
	let info = $state(null); // aviso abierto: 'nosmart' | 'compat' | null

	let openService = $derived(openKey ? serviceByKey(openKey) : null);
	let grillaService = $derived(grillaKey ? serviceByKey(grillaKey) : null);

	// Siembra de adicionales del modal desde el estado del wizard (persiste la
	// selección previa al reabrir).
	let initialSelected = $derived({
		pack_futbol: wizard.addons.pack_futbol,
		cine: wizard.addons.cine
	});

	function goToServices() {
		info = null;
		setTimeout(() => {
			document.getElementById('tv-cards')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}, 50);
	}

	// Commit desde el modal: fija TV + adicionales y avanza el wizard.
	function confirmTv(service, chosenAddons) {
		chooseTvService(service.key, chosenAddons.map((a) => a.key));
		openKey = null;
	}
</script>

<StepHeader title={STEP_TITLES.tv} subtitle="Tocá un servicio para ver cómo funciona, sus canales y adicionales." />

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

<div id="tv-cards" class="cards">
	{#each TV_SERVICES as service (service.key)}
		<TvServiceCard
			{service}
			precios={wizard.precios}
			selected={wizard.tvPlatform === service.key}
			onOpen={() => (openKey = service.key)}
			onGrilla={() => (grillaKey = service.key)}
		/>
	{/each}
</div>

<div class="ayuda">
	<AyudameElegirTv precios={wizard.precios} onPick={(key) => (openKey = key)} />
</div>

{#if wizard.tvPlatform}
	<button class="btn-primary btn-full continuar" onclick={() => next()}>Continuar</button>
{/if}

{#if openService}
	<TvServiceModal
		service={openService}
		precios={wizard.precios}
		{initialSelected}
		ctaLabel="Elegir y continuar"
		ctaClass="btn-primary"
		onGrilla={() => (grillaKey = openService.key)}
		onConfirm={confirmTv}
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
		<button class="btn-secondary btn-full" onclick={goToServices}>Ver servicios</button>
	</InfoModal>
{/if}

<style>
	.notice {
		background: #f0e7f4;
		border: 1px solid color-mix(in srgb, var(--violeta1) 18%, transparent);
		border-radius: 1rem;
		padding: 1.1rem 1.25rem;
		text-align: center;
		margin-bottom: 1.25rem;
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
		gap: 1rem;
		scroll-margin-top: 1.25rem;
		margin-bottom: 1.25rem;
	}
	.ayuda {
		margin-bottom: 1.25rem;
	}
	.continuar {
		margin-top: 0.25rem;
	}
</style>
