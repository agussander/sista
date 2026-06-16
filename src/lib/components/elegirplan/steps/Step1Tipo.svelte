<script>
	import StepHeader from '$lib/components/elegirplan/StepHeader.svelte';
	import OptionCard from '$lib/components/elegirplan/OptionCard.svelte';
	import { STEP_TITLES } from '$lib/components/elegirplan/data.js';
	import { wizard, setTipo, next } from '$lib/components/elegirplan/wizardState.svelte.js';
</script>

<StepHeader title={STEP_TITLES.tipo} subtitle="Empecemos por lo principal." />

<div class="cards">
	<OptionCard
		title="Solo Internet"
		subtitle="Fibra óptica, elegís la velocidad"
		showCheck={false}
		selected={wizard.tipo === 'internet'}
		onclick={() => { setTipo('internet'); next(); }}
	/>
	<OptionCard
		title="Internet + TV"
		subtitle="El combo completo · hay promo"
		showCheck={false}
		selected={wizard.tipo === 'tv'}
		onclick={() => { setTipo('tv'); next(); }}
	/>
</div>

<style>
	.cards {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-bottom: 1.5rem;
	}
</style>
