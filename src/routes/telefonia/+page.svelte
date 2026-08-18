<script>
import { onMount } from 'svelte';
import { MetaTags } from 'svelte-meta-tags';
import ContactButtons from '$lib/components/ui/ContactButtons.svelte';
import Spinner from '$lib/components/ui/Spinner.svelte';
import { fetchTarifario } from '$lib/tarifario/fetchTarifario.js';
import { formatearFecha } from '$lib/tarifario/formato.js';

/** @type {import('$lib/tarifario/parseTarifario.js').LineaVip | null} */
let data = $state(null);
let loading = $state(true);
let error = $state(null);

onMount(async () => {
	try {
		data = (await fetchTarifario()).lineaVip;
	} catch (e) {
		error = e instanceof Error ? e.message : 'Error al cargar los precios.';
		console.error('Linea VIP precios:', e);
	} finally {
		loading = false;
	}
});

const vigencia = $derived(formatearFecha(data?.vigencia));

/**
 * Precio en pesos, estilo argentino: miles con punto y decimales con coma.
 *
 * Antes el símbolo venía pegado al dato ("$ 9 588"), porque el valor salía de
 * scrapear el HTML que exportaba Word. Ahora el tarifario guarda números y el
 * símbolo lo pone la página.
 *
 * @param {number | null | undefined} value
 * @param {number} [decimales]
 */
function formatPrecio(value, decimales = 0) {
	if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
	const [entera, decimal] = value.toFixed(decimales).split('.');
	const miles = entera.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
	return `$ ${decimal ? `${miles},${decimal}` : miles}`;
}

/** @param {string[]} footnotes */
function displayFootnotes(footnotes) {
	let ivaUpdated = false;

	return footnotes
		.filter((note) => !/Valores en Pesos/i.test(note))
		.filter((note) => !/llamadas internacionales/i.test(note))
		.map((note) => {
			if (/Incluye IVA/i.test(note) && !ivaUpdated) {
				ivaUpdated = true;
				return `${note} No incluye aparato telefónico.`;
			}

			if (/abonado de fibra/i.test(note)) {
				const match = note.match(/^(.+?l[ií]neas)/i);
				return match ? match[1] : note;
			}

			return note;
		});
}
</script>

<MetaTags
	title="Precios de Telefonía · Línea de teléfono fijo | Sista"
	description="Consultá los precios vigentes de la línea de teléfono fijo de Sista: abono mensual, minutos incluidos y tarifas de llamadas."
/>

<section class="page">
	<header class="hero">
		<h1>Línea de teléfono fijo</h1>
		{#if vigencia}
			<p class="vigencia">Precios vigentes desde el {vigencia}</p>
		{/if}
	</header>

	{#if loading}
		<div class="state">
			<Spinner size={48} label="Cargando precios…" />
		</div>
	{:else if error}
		<div class="state state--error">
			<p>{error}</p>
			<p class="hint">Los valores se actualizan desde la fuente oficial de Sista.</p>
		</div>
	{:else if data}
		{@const plan = data.planes.find((p) => /221/i.test(p.nombre) && /fibra/i.test(p.clientes ?? '')) ?? data.planes[0]}
		{#if plan}
			<div class="detail">
				<!-- Identidad de la línea: número local destacado -->
				<div class="hero-card">
					<span class="hero-eyebrow">
						<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
							<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>
						</svg>
						Tu número local
					</span>
					<span class="hero-number">221-***-****</span>
					<span class="hero-badge">
						<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
							<polyline points="20 6 9 17 4 12"/>
						</svg>
						Podés traer tu número actual
					</span>
				</div>

				<!-- Cifras clave del plan -->
				<div class="highlights">
					<div class="highlight-card">
						<span class="field-label">Abono mensual</span>
						<span class="highlight-value highlight-value--price">
							{formatPrecio(plan.abonoMensual)}<span class="per">/mes</span>
						</span>
					</div>
					<div class="highlight-card">
						<span class="highlight-value highlight-value--mins">{plan.minutosLocales}</span>
						<span class="field-label">Minutos locales incluidos</span>
					</div>
				</div>

				<!-- Tarifas por minuto: detalle secundario agrupado -->
				<div class="rates">
					<h2 class="rates-title">Costo por minuto</h2>
					<dl class="rates-list">
						<div class="rate-row">
							<dt>Llamadas a celulares</dt>
							<dd>{formatPrecio(plan.llamadasCelulares, 2)}<span class="per-min">/min</span></dd>
						</div>
						<div class="rate-row">
							<dt>Excedente · destino local</dt>
							<dd>{formatPrecio(plan.excedenteLocal, 2)}<span class="per-min">/min</span></dd>
						</div>
						<div class="rate-row">
							<dt>Excedente · destino nacional</dt>
							<dd>{formatPrecio(plan.excedenteNacional, 2)}<span class="per-min">/min</span></dd>
						</div>
					</dl>
				</div>
			</div>
		{/if}

		<ul class="footnotes">
			<li>
				Precio de llamadas internacionales:
				<a href="/telefonia/internacional">ver tarifas por país</a>
			</li>
			{#each displayFootnotes(data.notas) as note}
				<li>{note}</li>
			{/each}
		</ul>
	{/if}

	<ContactButtons text="¿Querés sumar telefonía?" />
</section>

<style>
.page {
	padding: 6em 1em 2em;
	max-width: 72rem;
	margin: 0 auto;
}

.hero {
	text-align: center;
	margin-bottom: 2rem;
}

h1 {
	margin: 0;
	color: var(--violeta1);
}

.vigencia {
	margin: 0.5rem 0 0;
	font-size: 0.8rem;
	color: var(--violeta1);
	font-weight: 500;
	opacity: 0.85;
}

.state {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	min-height: 16rem;
	gap: 0.75rem;
}

.state--error p {
	margin: 0;
	text-align: center;
}

.state--error p:first-child {
	color: #c62828;
	font-weight: 700;
	background: #ffebee;
	padding: 1rem 1.25rem;
	border-radius: var(--border-radius);
}

.hint {
	font-size: 0.95rem;
	opacity: 0.85;
}

.detail {
	max-width: 44rem;
	margin: 0 auto 2rem;
	display: grid;
	gap: 1rem;
}

/* Etiqueta secundaria reutilizable (eyebrow). */
.field-label {
	font-size: 0.72rem;
	font-weight: 700;
	text-transform: uppercase;
	letter-spacing: 0.05em;
	color: var(--violeta1);
	opacity: 0.7;
}

/* ── Hero: identidad de la línea ── */
.hero-card {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: 0.6rem;
	padding: 1.6rem 1.75rem;
	border-radius: 1rem;
	background: linear-gradient(135deg, var(--violeta1), color-mix(in srgb, var(--violeta1) 65%, var(--magenta)));
	color: white;
	box-shadow: 0 8px 22px color-mix(in srgb, var(--violeta1) 30%, transparent);
}

.hero-eyebrow {
	display: inline-flex;
	align-items: center;
	gap: 0.45rem;
	font-size: 0.72rem;
	font-weight: 700;
	text-transform: uppercase;
	letter-spacing: 0.06em;
	opacity: 0.9;
}

.hero-number {
	font-size: clamp(1.9rem, 7vw, 2.6rem);
	font-weight: 800;
	line-height: 1;
	letter-spacing: 0.02em;
}

.hero-badge {
	display: inline-flex;
	align-items: center;
	gap: 0.4rem;
	font-size: 0.82rem;
	font-weight: 600;
	padding: 0.3rem 0.7rem;
	border-radius: 999px;
	background: rgba(255, 255, 255, 0.18);
	border: 1px solid rgba(255, 255, 255, 0.3);
}

.hero-badge svg {
	color: var(--verde);
}

/* ── Cifras clave ── */
.highlights {
	display: grid;
	grid-template-columns: 1fr;
	gap: 1rem;
}

.highlight-card {
	display: flex;
	flex-direction: column;
	gap: 0.35rem;
	background: white;
	border-radius: 1rem;
	box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
	padding: 1.25rem 1.5rem;
	border-left: 4px solid var(--violeta1);
}

.highlight-value {
	display: flex;
	align-items: baseline;
	gap: 0.2rem;
	font-size: 2rem;
	font-weight: 800;
	line-height: 1;
	color: var(--violeta1);
}

.highlight-value--price {
	color: var(--magenta);
	font-weight: 500;
}

.highlight-card:has(.highlight-value--price) {
	border-left-color: var(--magenta);
}

.highlight-card:has(.highlight-value--mins) {
	border-left-color: var(--celeste);
}

.highlight-value--mins {
	color: var(--celeste);
}

.per {
	font-size: 0.85rem;
	font-weight: 500;
	color: #9a9a9a;
}

/* ── Tarifas por minuto (secundario) ── */
.rates {
	background: white;
	border-radius: 1rem;
	box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
	padding: 1.25rem 1.5rem;
}

.rates-title {
	margin: 0 0 0.5rem;
	font-size: 0.72rem;
	font-weight: 700;
	text-transform: uppercase;
	letter-spacing: 0.05em;
	color: var(--violeta1);
	opacity: 0.7;
	text-align: left;
}

.rates-list {
	margin: 0;
}

.rate-row {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: 1rem;
	padding: 0.7rem 0;
	border-bottom: 1px solid #ececec;
}

.rate-row:last-child {
	border-bottom: none;
}

.rate-row dt {
	font-size: 0.92rem;
	color: #555;
}

.rate-row dd {
	margin: 0;
	font-size: 1.05rem;
	font-weight: 500;
	color: var(--violeta1);
	white-space: nowrap;
}

.per-min {
	font-size: 0.7rem;
	font-weight: 400;
	color: #9a9a9a;
	margin-left: 0.1rem;
}

.footnotes {
	margin: 0 0 2rem;
	padding-left: 1.2rem;
	display: grid;
	gap: 0.55rem;
}

.footnotes li {
	font-size: 0.92rem;
	line-height: 1.45;
}

.footnotes a {
	color: var(--celeste);
	font-weight: 600;
	text-decoration: underline;
	text-underline-offset: 3px;
}

@media (min-width: 640px) {
	.highlights {
		grid-template-columns: 1fr 1fr;
	}
}
</style>
