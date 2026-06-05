<script>
	import StepHeader from '$lib/components/elegirplan/StepHeader.svelte';
	import { STEP_TITLES } from '$lib/components/elegirplan/data.js';
	import { wizard, chooseTvService, next } from '$lib/components/elegirplan/wizardState.svelte.js';

	import { TV_SERVICES, serviceByKey } from '$lib/components/tv/tvData.js';
	import TvServiceCard from '$lib/components/tv/TvServiceCard.svelte';
	import TvServiceModal from '$lib/components/tv/TvServiceModal.svelte';
	import GrillaViewer from '$lib/components/tv/GrillaViewer.svelte';
	import TvCompatInfo from '$lib/components/tv/TvCompatInfo.svelte';
	import AyudameElegirTv from '$lib/components/tv/AyudameElegirTv.svelte';

	let openKey = $state(null); // servicio con modal abierto
	let grillaKey = $state(null); // servicio con grilla abierta

	let openService = $derived(openKey ? serviceByKey(openKey) : null);
	let grillaService = $derived(grillaKey ? serviceByKey(grillaKey) : null);

	// Siembra de adicionales del modal desde el estado del wizard (persiste la
	// selección previa al reabrir).
	let initialSelected = $derived({
		pack_futbol: wizard.addons.pack_futbol,
		cine: wizard.addons.cine
	});

	// Commit desde el modal: fija TV + adicionales y avanza el wizard.
	function confirmTv(service, chosenAddons) {
		chooseTvService(service.key, chosenAddons.map((a) => a.key));
		openKey = null;
	}
</script>

<StepHeader title={STEP_TITLES.tv} subtitle="Tocá un servicio para ver cómo funciona, sus canales y adicionales." />

<TvCompatInfo cardsId="tv-cards" />

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

<style>
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
