<script>
	// TvServicesSection.svelte — cuerpo reutilizable de /tv/elegirtv:
	// aviso de compatibilidad + recomendador ("¿Te ayudamos a elegir?") + las 3
	// tarjetas de servicio + modal explicativo + visor de grilla.
	//
	// Se usa tal cual en /tv/elegirtv y también como bloque "Ver otras opciones"
	// al pie de cada página de servicio (/dgo, /antinaplay, /gigaredplay).
	//
	// Los precios se reciben por props (la página los carga una sola vez y los
	// comparte con la tarjeta estática del encabezado).
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	import { formatPrice, WHATSAPP_PHONE } from '$lib/components/elegirplan/data.js';
	import { TV_SERVICES, serviceByKey } from '$lib/components/tv/tvData.js';
	import TvServiceCard from './TvServiceCard.svelte';
	import TvServiceModal from './TvServiceModal.svelte';
	import GrillaViewer from './GrillaViewer.svelte';
	import TvCompatInfo from './TvCompatInfo.svelte';
	import AyudameElegirTv from './AyudameElegirTv.svelte';

	let { precios = {}, loading = false, cardsId = 'cards' } = $props();

	let grillaKey = $state(null); // servicio con grilla abierta (efímero, no en URL)

	// Switch "Con Pack Fútbol" de cada tarjeta (efímero, no en URL). Se comparte
	// con el modal para que abrir/cerrar no pierda ni desincronice la selección.
	let futbolOn = $state({}); // { [serviceKey]: boolean }
	function toggleFutbol(key) {
		futbolOn[key] = !futbolOn[key];
	}

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

	// Arma el mensaje de WhatsApp con el servicio + adicionales elegidos.
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
</script>

<TvCompatInfo {cardsId} />

{#if loading}
	<div class="loading">
		<span class="spinner" aria-hidden="true"></span>
		<p>Cargando precios…</p>
	</div>
{:else}
	<div class="ayuda">
		<AyudameElegirTv
			{precios}
			onPick={(key) => openModal(key)}
			onGrilla={(key) => (grillaKey = key)}
		/>
	</div>

	<div id={cardsId} class="cards">
		{#each TV_SERVICES as service (service.key)}
			<TvServiceCard
				{service}
				{precios}
				futbolOn={!!futbolOn[service.key]}
				onToggleFutbol={() => toggleFutbol(service.key)}
				onOpen={() => openModal(service.key)}
				onGrilla={() => (grillaKey = service.key)}
			/>
		{/each}
	</div>
{/if}

{#if openService}
	<TvServiceModal
		service={openService}
		{precios}
		initialSelected={{ pack_futbol: !!futbolOn[openService.key] }}
		onToggle={(key, value) => {
			if (key === 'pack_futbol') futbolOn[openService.key] = value;
		}}
		onGrilla={() => (grillaKey = openService.key)}
		onConfirm={(service, addons) => window.open(buildTvWhatsappUrl(service, addons), '_blank', 'noopener')}
		onclose={() => closeModal()}
	/>
{/if}

{#if grillaService}
	<GrillaViewer service={grillaService} onclose={() => (grillaKey = null)} />
{/if}

<style>
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
		.cards {
			flex-direction: row;
			align-items: stretch;
		}
		.cards > :global(*) {
			flex: 1;
		}
	}
</style>
