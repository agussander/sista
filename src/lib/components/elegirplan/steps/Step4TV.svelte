<script>
	import StepHeader from '$lib/components/elegirplan/StepHeader.svelte';
	import { STEP_TITLES, planByKey, speedLabel } from '$lib/components/elegirplan/data.js';
	import { wizard, chooseTvService, next } from '$lib/components/elegirplan/wizardState.svelte.js';

	import { TV_SERVICES, serviceByKey } from '$lib/components/tv/tvData.js';
	import TvServiceCard from '$lib/components/tv/TvServiceCard.svelte';
	import TvServiceModal from '$lib/components/tv/TvServiceModal.svelte';
	import GrillaViewer from '$lib/components/tv/GrillaViewer.svelte';
	import TvCompatInfo from '$lib/components/tv/TvCompatInfo.svelte';
	import AyudameElegirTv from '$lib/components/tv/AyudameElegirTv.svelte';

	// Plan de internet ya elegido — para mostrar el total combinado en el modal de TV.
	let internetPlan = $derived(planByKey(wizard.internetPlan));
	let internetLabel = $derived(internetPlan ? `Internet ${internetPlan.label} ${speedLabel(internetPlan.mb)}` : 'Internet');
	let internetPrice = $derived(wizard.internetPlan ? Number(wizard.precios?.[wizard.internetPlan]) || 0 : null);

	let openKey = $state(null); // servicio con modal abierto
	let grillaKey = $state(null); // servicio con grilla abierta

	let openService = $derived(openKey ? serviceByKey(openKey) : null);
	let grillaService = $derived(grillaKey ? serviceByKey(grillaKey) : null);

	// Switch "Con Pack Fútbol" de cada tarjeta (efímero, independiente por
	// servicio). Arranca en lo ya confirmado para la plataforma elegida, así
	// reabrir/cambiar de tarjeta no pierde la selección previa.
	let futbolOn = $state({}); // { [serviceKey]: boolean }
	function isFutbolOn(key) {
		if (key in futbolOn) return futbolOn[key];
		return wizard.tvPlatform === key && wizard.addons.pack_futbol;
	}
	function toggleFutbol(key) {
		futbolOn[key] = !isFutbolOn(key);
	}

	// Siembra de adicionales del modal desde el estado local de la tarjeta.
	let initialSelected = $derived({
		pack_futbol: openKey ? isFutbolOn(openKey) : false,
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

<div class="ayuda">
	<AyudameElegirTv
		precios={wizard.precios}
		onPick={(key) => (openKey = key)}
		onGrilla={(key) => (grillaKey = key)}
	/>
</div>

<div id="tv-cards" class="cards">
	{#each TV_SERVICES as service (service.key)}
		<TvServiceCard
			{service}
			precios={wizard.precios}
			selected={wizard.tvPlatform === service.key}
			futbolOn={isFutbolOn(service.key)}
			onToggleFutbol={() => toggleFutbol(service.key)}
			onOpen={() => (openKey = service.key)}
			onGrilla={() => (grillaKey = service.key)}
		/>
	{/each}
</div>

{#if wizard.tvPlatform}
	<button class="btn-primary btn-full continuar" onclick={() => next()}>Continuar</button>
{/if}

{#if openService}
	<TvServiceModal
		service={openService}
		precios={wizard.precios}
		{initialSelected}
		onToggle={(key, value) => {
			if (key === 'pack_futbol' && openKey) futbolOn[openKey] = value;
		}}
		ctaLabel="Elegir y continuar"
		ctaClass="btn-primary"
		{internetLabel}
		{internetPrice}
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
