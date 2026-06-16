<script>
	import StepHeader from '$lib/components/elegirplan/StepHeader.svelte';
	import {
		USO_OPTIONS,
		PERSONAS_OPTIONS,
		recommendPlans,
		planByKey,
		speedLabel,
		formatPrice
	} from '$lib/components/elegirplan/data.js';
	import {
		wizard,
		setInternetPlan,
		toggleUso,
		closeRecom,
		next
	} from '$lib/components/elegirplan/wizardState.svelte.js';

	let recs = $derived(recommendPlans(wizard.recom.usos, wizard.recom.personas));

	// Elegir una recomendación: fija el plan, cierra el recomendador y avanza
	// (mismo comportamiento que tocar una card en la lista).
	function usarPlan(key) {
		setInternetPlan(key);
		closeRecom();
		next();
	}
</script>

<button class="back-link" onclick={() => closeRecom()}>← Volver a la lista</button>

<StepHeader title="Ayudame a elegir" subtitle="Contanos cómo lo usás y te sugerimos los planes ideales." />

<fieldset>
	<legend>¿Para qué lo usás? <span class="multi-hint">elegí las que quieras</span></legend>
	<div class="chips">
		{#each USO_OPTIONS as opt}
			<button
				class="chip"
				class:active={wizard.recom.usos.includes(opt.key)}
				onclick={() => toggleUso(opt.key)}
			>
				{opt.label}
			</button>
		{/each}
	</div>
</fieldset>

<fieldset>
	<legend>¿Cuántas personas en casa?</legend>
	<div class="chips">
		{#each PERSONAS_OPTIONS as opt}
			<button
				class="chip"
				class:active={wizard.recom.personas === opt.key}
				onclick={() => (wizard.recom.personas = opt.key)}
			>
				{opt.label}
			</button>
		{/each}
	</div>
</fieldset>

{#if recs.length}
	<div class="reco-list">
		<p class="reco-title">Te recomendamos:</p>
		{#each recs as r, i (r.key)}
			{@const plan = planByKey(r.key)}
			<div class="reco-card" class:primary={i === 0}>
				<div class="reco-top">
					<div class="reco-name">
						{#if i === 0}<span class="badge">Mejor opción</span>{/if}
						<strong>{plan.label} {speedLabel(plan.mb)}</strong>
					</div>
					<span class="reco-price">{formatPrice(wizard.precios[r.key])}<small>/mes</small></span>
				</div>
				<p class="reco-reason">{r.reason}</p>
				<button class="btn-primary btn-sm btn-full" onclick={() => usarPlan(r.key)}>
					Elegir {plan.label}
				</button>
			</div>
		{/each}
	</div>
{:else}
	<p class="hint">Elegí al menos un uso y la cantidad de personas para ver las recomendaciones.</p>
{/if}

<style>
	.back-link {
		background: none;
		border: none;
		color: #9a6cb0;
		font-weight: 600;
		font-size: 0.85rem;
		padding: 0;
		margin-bottom: 0.85rem;
		cursor: pointer;
	}
	.back-link:hover {
		opacity: 0.75;
	}
	fieldset {
		border: none;
		padding: 0;
		margin: 0 0 1.25rem;
	}
	legend {
		font-size: 0.95rem;
		font-weight: 700;
		color: var(--violeta1);
		padding: 0;
		margin-bottom: 0.6rem;
	}
	.multi-hint {
		font-size: 0.72rem;
		font-weight: 400;
		color: #9a9a9a;
		text-transform: none;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.chip {
		background: #fff;
		border: 2px solid #ececec;
		border-radius: 999px;
		padding: 0.5rem 1rem;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--violeta1);
		cursor: pointer;
	}
	.chip:hover {
		border-color: color-mix(in srgb, var(--violeta1) 40%, #ececec);
	}
	.chip.active {
		background: var(--violeta1);
		color: #fff;
		border-color: var(--violeta1);
	}

	.reco-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-top: 0.5rem;
	}
	.reco-title {
		font-size: 0.95rem;
		font-weight: 700;
		color: var(--violeta1);
		margin: 0;
	}
	.reco-card {
		border: 2px solid #ececec;
		border-radius: 0.9rem;
		padding: 0.9rem 1rem;
		background: #fff;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.reco-card.primary {
		border-color: var(--violeta1);
		background: #f0e7f4;
	}
	.reco-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}
	.reco-name {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}
	.reco-name strong {
		font-size: 1.05rem;
		color: var(--violeta1);
	}
	.badge {
		align-self: flex-start;
		font-size: 0.62rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: #fff;
		background: var(--magenta);
		padding: 0.15rem 0.5rem;
		border-radius: 999px;
	}
	.reco-price {
		color: var(--magenta);
		font-weight: 700;
		font-size: 1.05rem;
		white-space: nowrap;
	}
	.reco-price small {
		font-size: 0.7rem;
		color: #9a9a9a;
		font-weight: 400;
	}
	.reco-reason {
		margin: 0;
		font-size: 0.82rem;
		color: #6b6b6b;
		font-weight: 300;
	}
	.hint {
		font-size: 0.85rem;
		color: #9a9a9a;
		font-weight: 300;
		text-align: center;
		margin: 0.5rem 0 0;
	}
</style>
