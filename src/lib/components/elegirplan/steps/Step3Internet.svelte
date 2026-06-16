<script>
	import StepHeader from '$lib/components/elegirplan/StepHeader.svelte';
	import OptionCard from '$lib/components/elegirplan/OptionCard.svelte';
	import Step3bRecomendador from '$lib/components/elegirplan/steps/Step3bRecomendador.svelte';
	import SimetricoModal from '$lib/components/elegirplan/SimetricoModal.svelte';
	import { STEP_TITLES, INTERNET_PLANS, speedLabel, formatPrice } from '$lib/components/elegirplan/data.js';
	import { wizard, setInternetPlan, openRecom, next } from '$lib/components/elegirplan/wizardState.svelte.js';

	let showSimetrico = $state(false);

	// Planes simétricos: los que tienen "Tráfico simétrico" entre sus features
	// (Gamer, Worker, MAX). Muestran el link "¿Qué es simétrico?" en el detalle.
	const isSymmetric = (plan) => plan.features.some((f) => f.toLowerCase().includes('simétric'));
</script>

{#if wizard.showRecom}
	<Step3bRecomendador />
{:else}
	<StepHeader title={STEP_TITLES.internet} />

	<button class="ayuda-card" onclick={() => openRecom()}>
		<span class="ayuda-ico" aria-hidden="true">✨</span>
		<span class="ayuda-text">
			<strong>¿No sabés cuál elegir?</strong>
			<small>Respondé 2 preguntas y te recomendamos los planes ideales</small>
		</span>
		<span class="ayuda-arrow" aria-hidden="true">→</span>
	</button>

	<div class="cards">
		{#each INTERNET_PLANS as plan}
			<OptionCard
				title={plan.label}
				subtitle={speedLabel(plan.mb)}
				subtitleStrong={true}
				tag={plan.tag}
				price={formatPrice(wizard.precios[plan.key])}
				details={plan.features}
				showCheck={false}
				onSymmetricInfo={isSymmetric(plan) ? () => (showSimetrico = true) : null}
				selected={wizard.internetPlan === plan.key}
				onclick={() => { setInternetPlan(plan.key); next(); }}
			/>
		{/each}
	</div>
{/if}

{#if showSimetrico}
	<SimetricoModal onclose={() => (showSimetrico = false)} />
{/if}

<style>
	.ayuda-card {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		text-align: left;
		background: linear-gradient(135deg, #f0e7f4, #faf0f4);
		border: 2px solid var(--violeta1);
		border-radius: 0.9rem;
		padding: 0.85rem 1rem;
		margin-bottom: 1.1rem;
		cursor: pointer;
	}
	.ayuda-card:hover {
		transform: translateY(-1px);
		box-shadow: 0 4px 14px rgba(102, 37, 124, 0.15);
	}
	.ayuda-ico {
		flex-shrink: 0;
		width: 2.4rem;
		height: 2.4rem;
		border-radius: 999px;
		background: var(--violeta1);
		color: #fff;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.2rem;
	}
	.ayuda-text {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}
	.ayuda-text strong {
		color: var(--violeta1);
		font-size: 0.98rem;
	}
	.ayuda-text small {
		color: #6b6b6b;
		font-size: 0.78rem;
		font-weight: 300;
	}
	.ayuda-arrow {
		flex-shrink: 0;
		color: var(--magenta);
		font-size: 1.3rem;
		font-weight: 700;
	}
	.cards {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		margin-bottom: 1.5rem;
	}
</style>
