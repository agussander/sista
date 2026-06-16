<script>
	import StepHeader from '$lib/components/elegirplan/StepHeader.svelte';
	import {
		STEP_TITLES,
		PROMO,
		summaryItems,
		computeTotal,
		hasConsultar,
		formatPrice,
		computeListTotal
	} from '$lib/components/elegirplan/data.js';
	import { wizard, goTo, resetWizard } from '$lib/components/elegirplan/wizardState.svelte.js';
	import { buildWhatsappUrl } from '$lib/components/elegirplan/data.js';

	let items = $derived(summaryItems(wizard));
	let total = $derived(computeTotal(wizard));
	let listTotal = $derived(computeListTotal(wizard));
	let parcial = $derived(hasConsultar(wizard));
	// La promo aplica un descuento real (TV gratis): mostrar precio de lista y con promo.
	let showPromoTotals = $derived(wizard.promo && listTotal > total && total > 0);

	function itemPrice(it) {
		return it.value > 0 ? formatPrice(it.value) : 'Consultar';
	}

	// Editar un ítem: si es promo, los cambios de internet/TV vuelven al paso de promo.
	function editItem(step) {
		if (wizard.promo && (step === 'internet' || step === 'tv')) goTo('promo');
		else goTo(step);
	}

	function enviar() {
		window.open(buildWhatsappUrl(wizard), '_blank');
	}
</script>

<StepHeader title={STEP_TITLES.resumen} subtitle="Revisá y mandánoslo por WhatsApp." />

<div class="ticket">
	{#each items as it}
		<button class="line" onclick={() => editItem(it.step)}>
			<span class="line-label">{it.label} <span class="edit">editar</span></span>
			{#if it.free}
				<span class="line-price free">
					{#if it.listValue > 0}<s>{formatPrice(it.listValue)}/mes</s>{/if}
					<span class="free-tag">gratis {PROMO.mesesGratis} meses</span>
				</span>
			{:else}
				<span class="line-price">{itemPrice(it)}</span>
			{/if}
		</button>
	{/each}

	{#if showPromoTotals}
		<div class="total total-lista">
			<span>Total precio de lista</span>
			<s>{formatPrice(listTotal)}/mes</s>
		</div>
		<div class="total total-promo">
			<div class="promo-label">
				<span>Total con promo</span>
				<small>primeros {PROMO.mesesGratis} meses</small>
			</div>
			<strong>{formatPrice(total)}{parcial ? '*' : ''}<em>/mes</em></strong>
		</div>
	{:else}
		<div class="total">
			<span>Total mensual</span>
			<strong>{total > 0 ? formatPrice(total) : 'Consultar'}{parcial && total > 0 ? '*' : ''}</strong>
		</div>
	{/if}

	{#if parcial}
		<p class="consultar-note">* Algunos ítems se confirman al contratar.</p>
	{/if}
</div>

<button class="btn-whatsapp btn-full enviar" onclick={enviar}>
	<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.2-.2.3-.7.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1.1 2.8 1.2 3c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.3zM12 2a10 10 0 00-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1012 2z"/></svg>
	Enviar combo por WhatsApp
</button>

<button class="reset" onclick={() => resetWizard()}>Empezar de nuevo</button>

<style>
	.ticket {
		background: #fff;
		border: 1px solid #ececec;
		border-radius: 1rem;
		padding: 0.5rem 1.1rem 1.1rem;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
		margin-bottom: 1.25rem;
	}
	.line {
		width: 100%;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.75rem;
		background: none;
		border: none;
		border-bottom: 1px dashed #ececec;
		padding: 0.85rem 0;
		cursor: pointer;
		text-align: left;
	}
	.line:hover .edit {
		opacity: 1;
	}
	.line-label {
		color: var(--violeta1);
		font-weight: 500;
		font-size: 0.95rem;
	}
	.edit {
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		color: #9a6cb0;
		opacity: 0;
		margin-left: 0.35rem;
		transition: opacity 0.2s;
	}
	.line-price {
		color: var(--magenta);
		font-weight: 700;
		font-size: 0.95rem;
		white-space: nowrap;
	}
	.line-price.free {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.1rem;
	}
	.line-price.free s {
		color: #9a9a9a;
		font-weight: 600;
		font-size: 0.8rem;
		text-decoration-thickness: 1.5px;
	}
	.line-price.free .free-tag {
		color: var(--magenta);
		font-weight: 700;
		font-size: 0.82rem;
	}
	.total {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		padding: 1rem 0 0.4rem;
	}
	.total span {
		font-weight: 700;
		color: var(--violeta1);
		text-transform: uppercase;
		font-size: 0.8rem;
		letter-spacing: 0.03em;
	}
	.total strong {
		font-size: 1.7rem;
		font-weight: 800;
		color: var(--violeta1);
	}
	.total-lista {
		padding-bottom: 0;
	}
	.total-lista s {
		font-size: 1.05rem;
		font-weight: 600;
		color: #9a9a9a;
		text-decoration-thickness: 1.5px;
	}
	.total-promo {
		align-items: center;
		padding-top: 0.2rem;
	}
	.promo-label {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}
	.promo-label small {
		font-size: 0.68rem;
		font-weight: 600;
		color: var(--magenta);
		text-transform: none;
		letter-spacing: 0;
	}
	.total-promo strong {
		color: var(--magenta);
	}
	.total-promo strong em {
		font-size: 0.9rem;
		font-weight: 600;
		font-style: normal;
		color: #9a9a9a;
		margin-left: 0.1rem;
	}
	.consultar-note {
		margin: 0.4rem 0 0;
		font-size: 0.75rem;
		color: #9a6cb0;
		font-weight: 300;
	}
	.enviar svg {
		width: 1.25rem;
		height: 1.25rem;
	}
	.reset {
		display: block;
		margin: 0.85rem auto 0;
		background: none;
		border: none;
		color: #9a9a9a;
		font-size: 0.82rem;
		font-weight: 500;
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.reset:hover {
		color: var(--violeta1);
	}
</style>
