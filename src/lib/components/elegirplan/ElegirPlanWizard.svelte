<script>
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { pb } from '$lib/pocketbase';

	import ProgressBar from './ProgressBar.svelte';
	import TvCheckModal from './TvCheckModal.svelte';
	import Step1Tipo from './steps/Step1Tipo.svelte';
	import Step2Promo from './steps/Step2Promo.svelte';
	import Step3Internet from './steps/Step3Internet.svelte';
	import Step4TV from './steps/Step4TV.svelte';
	import Step5Adicionales from './steps/Step5Adicionales.svelte';
	import Step6Resumen from './steps/Step6Resumen.svelte';

	import { STEP_TITLES, getFlow, computeTotal, formatPrice, tvByKey } from './data.js';
	import {
		wizard,
		prev,
		confirmTv,
		cancelTvCheck,
		hydrateFromParams,
		toSearchString
	} from './wizardState.svelte.js';

	let flow = $derived(getFlow(wizard));
	let currentIndex = $derived(flow.indexOf(wizard.step));
	let showBack = $derived(currentIndex > 0 && !wizard.showRecom && !wizard.tvCheck);

	// Total parcial visible desde que hay un plan elegido (transparencia de precio)
	let runningTotal = $derived(computeTotal(wizard));
	let showTotal = $derived(
		wizard.internetPlan && wizard.step !== 'tipo' && wizard.step !== 'resumen' && runningTotal > 0
	);

	let cardEl;
	let mounted = false;

	onMount(async () => {
		hydrateFromParams($page.url.searchParams);
		try {
			const record = await pb.collection('precios').getFirstListItem('');
			if (record) wizard.precios = record;
		} catch (e) {
			console.error('Error cargando precios desde PocketBase:', e);
			wizard.error = true;
		} finally {
			wizard.loading = false;
		}
		mounted = true;
	});

	// URL → estado: cubre paste, Back y Forward. Guard: si la URL ya coincide con
	// el estado serializado, no hace nada (corta el loop URL→estado→URL).
	$effect(() => {
		const incoming = $page.url.searchParams; // dependencia reactiva
		if (!browser) return;
		if (incoming.toString() === toSearchString()) return;
		hydrateFromParams(incoming);
	});

	// estado → URL: push si cambió el paso (Back = paso anterior), replace si sólo
	// cambió una selección. Guard: si ya coincide, no navega.
	let lastStep = wizard.step;
	$effect(() => {
		const target = toSearchString(); // depende de step + selecciones
		if (!browser) return;
		if (target === $page.url.searchParams.toString()) return;
		const stepChanged = wizard.step !== lastStep;
		lastStep = wizard.step;
		goto('?' + target, { replaceState: !stepChanged, noScroll: true, keepFocus: true });
	});

	// Al cambiar de paso, llevar la tarjeta a la vista (mejor en mobile)
	$effect(() => {
		wizard.step; // dependencia
		if (mounted && cardEl) {
			cardEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	});
</script>

<section class="wizard-section">
	<div class="card" bind:this={cardEl}>
		{#if wizard.loading}
			<div class="loading">
				<span class="spinner" aria-hidden="true"></span>
				<p>Cargando precios…</p>
			</div>
		{:else}
			<div class="topbar">
				{#if showBack}
					<button class="back" onclick={() => prev()} aria-label="Volver">
						<svg viewBox="0 0 24 24" width="18" height="18"><path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
						Volver
					</button>
				{:else}
					<span></span>
				{/if}
				{#if showTotal}
					<span class="total-pill">Total aprox. <strong>{formatPrice(runningTotal)}</strong>/mes</span>
				{/if}
			</div>

			<ProgressBar current={currentIndex} total={flow.length} title={STEP_TITLES[wizard.step]} />

			{#key wizard.step}
				<div class="step" in:fly={{ y: 12, duration: 250 }}>
					{#if wizard.step === 'tipo'}
						<Step1Tipo />
					{:else if wizard.step === 'promo'}
						<Step2Promo />
					{:else if wizard.step === 'internet'}
						<Step3Internet />
					{:else if wizard.step === 'tv'}
						<Step4TV />
					{:else if wizard.step === 'adicionales'}
						<Step5Adicionales />
					{:else if wizard.step === 'resumen'}
						<Step6Resumen />
					{/if}
				</div>
			{/key}
		{/if}
	</div>
</section>

{#if wizard.tvCheck}
	<TvCheckModal
		platform={tvByKey(wizard.tvCheck)}
		onconfirm={() => confirmTv()}
		oncancel={() => cancelTvCheck()}
	/>
{/if}

<style>
	.wizard-section {
		display: flex;
		justify-content: center;
		/* padding-top alto para no quedar tapado por el nav flotante (position:fixed, top:1em) */
		padding: 6.5rem 1rem 4rem;
		background: linear-gradient(170deg, #faf8fb 0%, var(--background) 60%);
		min-height: 70vh;
	}
	.card {
		width: 100%;
		max-width: 30rem;
		background: #fff;
		border-radius: 1.4rem;
		padding: 1.5rem 1.4rem 1.75rem;
		box-shadow: 0 10px 40px rgba(102, 37, 124, 0.1);
		scroll-margin-top: 1rem;
	}

	.topbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		min-height: 1.75rem;
		margin-bottom: 0.75rem;
	}
	.back {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		background: none;
		border: none;
		color: var(--violeta1);
		font-weight: 600;
		font-size: 0.85rem;
		cursor: pointer;
		padding: 0.25rem 0.1rem;
	}
	.back:hover {
		opacity: 0.75;
	}
	.total-pill {
		font-size: 0.78rem;
		color: #6b6b6b;
		background: #f0e7f4;
		padding: 0.3rem 0.7rem;
		border-radius: 999px;
		white-space: nowrap;
	}
	.total-pill strong {
		color: var(--violeta1);
	}

	.step {
		min-height: 1px;
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
</style>
