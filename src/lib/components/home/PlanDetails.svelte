<script>
	// Contenido que se revela al abrir una tarjeta de plan. Reusado tanto por el
	// overlay de desktop como por el acordeón de mobile.
	import { planWhatsappUrl } from '$lib/components/home/planCard.js';

	let { plan, onSimetrico } = $props();

	let waUrl = $derived(planWhatsappUrl(plan.plan, plan.mb));
</script>

<div class="details">
	<ul class="features">
		{#each plan.items as item}
			<li>
				<svg class="check" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
					<path d="M5 13l4 4L19 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
				</svg>
				<span>{item}</span>
			</li>
		{/each}
	</ul>

	{#if plan.symmetric}
		<button type="button" class="simetrico-link" onclick={onSimetrico}>
			¿Qué es simétrico?
		</button>
	{/if}

	<a class="pedir" href={waUrl} target="_blank" rel="noopener noreferrer">
		<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
			<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
		</svg>
		Pedir este plan
	</a>
</div>

<style>
	.details {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		width: 100%;
		max-width: 26rem;
		margin: 0 auto;
		text-align: left;
	}

	.features {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.features li {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		font-size: 0.95rem;
		font-weight: 400;
		color: var(--violeta1);
	}
	.check {
		flex-shrink: 0;
		color: #1ba37a;
	}

	.simetrico-link {
		align-self: flex-start;
		background: none;
		border: none;
		padding: 0;
		width: auto;
		color: var(--violeta1);
		font-weight: 600;
		font-size: 0.85rem;
		text-decoration: underline;
		text-underline-offset: 3px;
		cursor: pointer;
	}
	.simetrico-link:hover {
		opacity: 0.75;
	}

	.pedir {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.55rem;
		align-self: stretch;
		background: #25d366;
		color: #fff;
		font-weight: 700;
		font-size: 1rem;
		text-decoration: none;
		border-radius: 0.7rem;
		padding: 0.8rem 1.2rem;
		transition: filter 150ms ease, transform 150ms ease;
	}
	.pedir:hover {
		filter: brightness(0.95);
		transform: translateY(-1px);
	}
	.pedir:active {
		transform: scale(0.98);
	}
</style>
