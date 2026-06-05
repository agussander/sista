<script>
	import StepHeader from '$lib/components/elegirplan/StepHeader.svelte';
	import OptionCard from '$lib/components/elegirplan/OptionCard.svelte';
	import { STEP_TITLES, ADDONS, formatPrice } from '$lib/components/elegirplan/data.js';
	import { wizard, toggleAddon, next } from '$lib/components/elegirplan/wizardState.svelte.js';

	// Pack Fútbol y Cine se eligen en el modal de TV (tvAddon). Acá solo Telefonía.
	let visibles = $derived(ADDONS.filter((a) => !a.tvAddon));
</script>

<StepHeader title={STEP_TITLES.adicionales} subtitle="Opcional. Podés sumar y sacar lo que quieras." />

<div class="cards">
	{#each visibles as addon}
		<OptionCard
			title={addon.label}
			subtitle={addon.subtitle}
			price={formatPrice(wizard.precios[addon.field])}
			multi={true}
			selected={wizard.addons[addon.key]}
			onclick={() => toggleAddon(addon.key)}
		/>
	{/each}
</div>

<button class="btn-primary btn-full" onclick={() => next()}>Ver resumen</button>

<style>
	.cards {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		margin-bottom: 1.5rem;
	}
</style>
