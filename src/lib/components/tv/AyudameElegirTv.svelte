<script>
	// AyudameElegirTv.svelte — Recomendador inline para /tv/elegirtv.
	// Espejo del patrón de /elegirplan (ayuda-card → recomendador): 4 preguntas en
	// chips y recomienda el servicio más barato que cumple lo pedido.
	import { TV_SERVICES } from './tvData.js';

	let { precios = {}, onPick = () => {} } = $props();

	// Capacidades de cada servicio para el match (no viven en tvData: son la
	// traducción de sus features a condiciones booleanas del recomendador).
	const CAPS = {
		gigared: { maxTv: 2, tn13: false, fullHd: false, mundialCompleto: false },
		antina: { maxTv: 2, tn13: true, fullHd: false, mundialCompleto: false },
		dgo: { maxTv: 4, tn13: true, fullHd: true, mundialCompleto: true }
	};
	// Orden de preferencia: del más barato al premium.
	const ORDER = ['gigared', 'antina', 'dgo'];

	let expanded = $state(false);
	let a = $state({ tv: null, tn13: null, fullhd: null, mundial: null }); // mundial: 'arg' | 'full'

	let answered = $derived(
		a.tv !== null && a.tn13 !== null && a.fullhd !== null && a.mundial !== null
	);

	let recoKey = $derived.by(() => {
		if (!answered) return null;
		const need = {
			maxTv: a.tv,
			tn13: a.tn13 === true,
			fullHd: a.fullhd === true,
			mundialCompleto: a.mundial === 'full'
		};
		const ok = (key) => {
			const c = CAPS[key];
			return (
				c.maxTv >= need.maxTv &&
				(!need.tn13 || c.tn13) &&
				(!need.fullHd || c.fullHd) &&
				(!need.mundialCompleto || c.mundialCompleto)
			);
		};
		return ORDER.find(ok) ?? 'dgo'; // DGO siempre califica
	});

	let recoService = $derived(recoKey ? TV_SERVICES.find((s) => s.key === recoKey) : null);

	// Motivo dinámico según qué condición mandó la recomendación.
	let recoReason = $derived.by(() => {
		if (!recoKey) return '';
		if (recoKey === 'dgo') {
			const drivers = [];
			if (a.tv >= 3) drivers.push('hasta 4 TV');
			if (a.fullhd === true) drivers.push('Full HD');
			if (a.mundial === 'full') drivers.push('el Mundial completo (104 partidos)');
			return drivers.length
				? `Es el único con ${joinEs(drivers)}.`
				: 'Es el servicio más completo para lo que buscás.';
		}
		if (recoKey === 'antina') {
			return 'Incluye el 13 y TN y te alcanza para lo que buscás, sin pagar de más.';
		}
		return 'La opción más económica que cumple con todo lo que buscás.';
	});

	function joinEs(arr) {
		if (arr.length <= 1) return arr[0] ?? '';
		return arr.slice(0, -1).join(', ') + ' y ' + arr[arr.length - 1];
	}

	function priceFor(service) {
		const v = precios?.[service.priceField];
		return v ? `$${Number(v).toLocaleString('es-AR')}` : 'Consultar';
	}

	function reset() {
		a = { tv: null, tn13: null, fullhd: null, mundial: null };
	}
</script>

{#if !expanded}
	<button class="ayuda-card" onclick={() => (expanded = true)}>
		<span class="ayuda-ico" aria-hidden="true">✨</span>
		<span class="ayuda-text">
			<strong>¿Te ayudamos a elegir?</strong>
			<small>Respondé 4 preguntas y te recomendamos el servicio ideal</small>
		</span>
		<span class="ayuda-arrow" aria-hidden="true">→</span>
	</button>
{:else}
	<div class="panel">
		<button class="back-link" onclick={() => { expanded = false; reset(); }}>← Volver</button>

		<h2 class="panel-title">Ayudame a elegir</h2>
		<p class="panel-sub">Respondé estas preguntas y te sugerimos el servicio ideal.</p>

		<fieldset>
			<legend>¿Cuántos TV querés usar?</legend>
			<div class="chips">
				{#each [1, 2, 3, 4] as n}
					<button class="chip" class:active={a.tv === n} onclick={() => (a.tv = n)}>{n}</button>
				{/each}
			</div>
		</fieldset>

		<fieldset>
			<legend>¿Te importa que tenga el 13 y TN?</legend>
			<div class="chips">
				<button class="chip" class:active={a.tn13 === true} onclick={() => (a.tn13 = true)}>Sí</button>
				<button class="chip" class:active={a.tn13 === false} onclick={() => (a.tn13 = false)}>No</button>
			</div>
		</fieldset>

		<fieldset>
			<legend>¿Te importa que sea Full HD?</legend>
			<div class="chips">
				<button class="chip" class:active={a.fullhd === true} onclick={() => (a.fullhd = true)}>Sí</button>
				<button class="chip" class:active={a.fullhd === false} onclick={() => (a.fullhd = false)}>No</button>
			</div>
		</fieldset>

		<fieldset>
			<legend>¿Querés ver todos los partidos del Mundial?</legend>
			<div class="chips">
				<button class="chip" class:active={a.mundial === 'arg'} onclick={() => (a.mundial = 'arg')}>
					Solo Argentina y algunos
				</button>
				<button class="chip" class:active={a.mundial === 'full'} onclick={() => (a.mundial = 'full')}>
					Mundial completo (104 partidos)
				</button>
			</div>
		</fieldset>

		{#if answered && recoService}
			<div class="reco-card">
				<span class="badge">Mejor opción para vos</span>
				<div class="reco-top">
					<div class="reco-name">
						<img src={recoService.logo} alt={recoService.label} class="reco-logo" />
						<strong>{recoService.label}</strong>
					</div>
					<span class="reco-price">{priceFor(recoService)}<small>/mes</small></span>
				</div>
				<p class="reco-reason">{recoReason}</p>
				<button class="btn-primary btn-sm btn-full" onclick={() => onPick(recoService.key)}>
					Ver {recoService.label}
				</button>
			</div>
		{:else}
			<p class="hint">Respondé las 4 preguntas para ver tu recomendación.</p>
		{/if}
	</div>
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

	.panel {
		background: linear-gradient(135deg, #f0e7f4, #faf0f4);
		border: 2px solid var(--violeta1);
		border-radius: 0.9rem;
		padding: 1.25rem 1.25rem 1.4rem;
	}
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
	.panel-title {
		color: var(--violeta1);
		font-size: 1.25rem;
		font-weight: 800;
		margin: 0 0 0.2rem;
	}
	.panel-sub {
		color: #6b6b6b;
		font-size: 0.85rem;
		font-weight: 300;
		margin: 0 0 1.25rem;
	}

	fieldset {
		border: none;
		padding: 0;
		margin: 0 0 1.1rem;
	}
	legend {
		font-size: 0.92rem;
		font-weight: 700;
		color: var(--violeta1);
		padding: 0;
		margin-bottom: 0.55rem;
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

	.reco-card {
		border: 2px solid var(--violeta1);
		border-radius: 0.9rem;
		padding: 0.9rem 1rem;
		background: #fff;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 0.5rem;
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
	.reco-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}
	.reco-name {
		display: flex;
		align-items: center;
		gap: 0.55rem;
	}
	.reco-logo {
		height: 1.6rem;
		width: auto;
		object-fit: contain;
	}
	.reco-name strong {
		font-size: 1.05rem;
		color: var(--violeta1);
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
