<script>
	import StepHeader from '$lib/components/elegirplan/StepHeader.svelte';
	import { STEP_TITLES, PROMO, planByKey, tvByKey, formatPrice, speedLabel } from '$lib/components/elegirplan/data.js';
	import { wizard, confirmPromo, chooseArmar } from '$lib/components/elegirplan/wizardState.svelte.js';

	import { serviceByKey } from '$lib/components/tv/tvData.js';
	import TvServiceModal from '$lib/components/tv/TvServiceModal.svelte';
	import GrillaViewer from '$lib/components/tv/GrillaViewer.svelte';

	let plan = planByKey(PROMO.plan);
	let tv = tvByKey(PROMO.tvGratis);
	let promoPrice = $derived(formatPrice(wizard.precios[PROMO.plan]));
	let tvListPrice = $derived(formatPrice(wizard.precios[tv.field]));
	let tvHasPrice = $derived(Number(wizard.precios[tv.field]) > 0);

	// Modal completo de Gigared (mismo componente que elegirtv / Step4TV).
	let showGigared = $state(false);
	let grillaKey = $state(null);

	let gigaredService = serviceByKey(PROMO.tvGratis);
	let grillaService = $derived(grillaKey ? serviceByKey(grillaKey) : null);

	// Internet de la promo (Power) para el total combinado del modal.
	let internetLabel = $derived(`Internet ${plan.label} ${speedLabel(plan.mb)}`);
	let internetPrice = $derived(Number(wizard.precios[PROMO.plan]) || 0);

	// Siembra de adicionales desde el estado (persiste al reabrir).
	let initialSelected = $derived({
		pack_futbol: wizard.addons.pack_futbol,
		cine: wizard.addons.cine
	});

	// Confirmó la promo desde el modal (tras el chequeo de instalación embebido).
	function onConfirm(service, chosenAddons) {
		confirmPromo(chosenAddons.map((a) => a.key));
		showGigared = false;
	}
</script>

<StepHeader title={STEP_TITLES.promo} subtitle="Lo más elegido para arrancar con todo." />

<div class="promo">
	<span class="badge">Promo Internet + TV</span>
	<div class="combo">
		<strong>{plan.label} {speedLabel(plan.mb)}</strong>
		<span class="plus">+</span>
		<strong>{tv.label}</strong>
	</div>
	<p class="free">{tv.label} <em>gratis {PROMO.mesesGratis} meses</em></p>
	<p class="after">
		{#if tvHasPrice}
			Después, {tv.label} a {tvListPrice}/mes (precio de lista)
		{:else}
			Después, {tv.label} a precio de lista
		{/if}
	</p>
	<div class="price">
		<strong>{promoPrice}</strong><span class="per">/mes</span>
	</div>
	<button class="btn-primary btn-full" onclick={() => (showGigared = true)}>Elegir la promo</button>
	<p class="promo-note">Solo para nuevos clientes/nuevos domicilios</p>
</div>

<div class="or"><span>o armalo a tu medida</span></div>

<button class="btn-primary btn-full" onclick={() => chooseArmar()}>Ver otras opciones</button>

{#if showGigared}
	<TvServiceModal
		service={gigaredService}
		precios={wizard.precios}
		{initialSelected}
		ctaLabel="Elegir la promo"
		ctaClass="btn-primary"
		{internetLabel}
		{internetPrice}
		promoMonths={PROMO.mesesGratis}
		onGrilla={() => (grillaKey = gigaredService.key)}
		onConfirm={onConfirm}
		onclose={() => (showGigared = false)}
	/>
{/if}

{#if grillaService}
	<GrillaViewer service={grillaService} onclose={() => (grillaKey = null)} />
{/if}

<style>
	.promo {
		background: #faf8fb;
		border: 2px solid var(--violeta1);
		border-radius: 1rem;
		padding: 1.25rem;
		text-align: center;
		box-shadow: 0 4px 16px rgba(102, 37, 124, 0.12);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.6rem;
	}
	.badge {
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: #fff;
		background: var(--magenta);
		padding: 0.25rem 0.75rem;
		border-radius: 999px;
	}
	.combo {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
		justify-content: center;
		color: var(--violeta1);
		font-size: 1.1rem;
	}
	.combo .plus {
		color: var(--magenta);
		font-weight: 800;
	}
	.free {
		margin: 0;
		font-size: 0.9rem;
		color: #6b6b6b;
		font-weight: 300;
	}
	.free em {
		color: var(--magenta);
		font-style: normal;
		font-weight: 700;
	}
	.after {
		margin: -0.3rem 0 0;
		font-size: 0.75rem;
		color: #9a9a9a;
		font-weight: 300;
	}
	.price {
		display: flex;
		align-items: baseline;
		gap: 0.15rem;
	}
	.price strong {
		font-size: 2rem;
		font-weight: 800;
		color: var(--violeta1);
	}
	.price .per {
		font-size: 0.85rem;
		color: #9a9a9a;
	}
	.promo .btn-primary {
		margin-top: 0.4rem;
	}
	.promo-note {
		margin: 0;
		font-size: 0.72rem;
		color: #9a9a9a;
		font-weight: 300;
	}
	.or {
		display: flex;
		align-items: center;
		text-align: center;
		margin: 1.25rem 0;
		color: #9a9a9a;
		font-size: 0.82rem;
	}
	.or::before,
	.or::after {
		content: '';
		flex: 1;
		height: 1px;
		background: #e2e2e2;
	}
	.or span {
		padding: 0 0.75rem;
	}
</style>
