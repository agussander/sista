<script>
import { onMount } from 'svelte';
import { MetaTags } from 'svelte-meta-tags';
import ContactButtons from '$lib/components/ui/ContactButtons.svelte';
import Spinner from '$lib/components/ui/Spinner.svelte';
import { fetchTarifario, mensajeDeError } from '$lib/tarifario/fetchTarifario.js';
import { formatearFecha } from '$lib/tarifario/formato.js';

/** @type {import('$lib/tarifario/parseTarifario.js').Internacional | null} */
let data = $state(null);
let loading = $state(true);
let error = $state(null);
let query = $state('');

onMount(async () => {
	try {
		data = (await fetchTarifario()).internacional;
	} catch (e) {
		error = mensajeDeError(e);
		console.error('Tarifas internacionales:', e);
	} finally {
		loading = false;
	}
});

/**
 * Precio por minuto en dólares, con coma decimal. El símbolo lo pone la página:
 * el tarifario guarda números, no el "U$S 0.5" que traía el scrapeo del Word.
 *
 * @param {number | null} value
 */
function formatUSD(value) {
	if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
	return `U$S ${String(value).replace('.', ',')}`;
}

const destinos = $derived(data?.destinos ?? []);
const vigencia = $derived(formatearFecha(data?.vigencia));

const filtered = $derived.by(() => {
	const q = query.trim().toLowerCase();
	if (!q) return destinos;
	return destinos.filter((d) => d.destino.toLowerCase().includes(q));
});
</script>

<MetaTags
	title="Tarifas de llamadas internacionales | Sista"
	description="Consultá el precio por minuto de las llamadas internacionales desde tu línea de teléfono fijo Sista, por país y destino fijo o móvil."
/>

<section class="page">
	<header class="hero">
		<a href="/telefonia" class="back">← Telefonía</a>
		<h1>Llamadas internacionales</h1>
		<p class="lead">Precio del minuto por país, en dólares (U$S).</p>
		{#if vigencia}
			<p class="vigencia">Vigente desde el {vigencia}</p>
		{/if}
	</header>

	{#if loading}
		<div class="state">
			<Spinner size={48} label="Cargando tarifas…" />
		</div>
	{:else if error}
		<div class="state state--error">
			<p>{error}</p>
			<p class="hint">Los valores se actualizan desde la fuente oficial de Sista.</p>
		</div>
	{:else if data}
		<div class="search">
			<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
				<circle cx="11" cy="11" r="8" />
				<line x1="21" y1="21" x2="16.65" y2="16.65" />
			</svg>
			<input
				type="search"
				placeholder="Buscar país o destino…"
				bind:value={query}
				aria-label="Buscar destino"
			/>
		</div>

		<div class="card">
			<div class="table-wrap">
				<table>
					<thead>
						<tr>
							<th class="th-dest">Destino</th>
							<th class="th-precio">Fijo</th>
							<th class="th-precio">Móvil</th>
						</tr>
					</thead>
					<tbody>
						{#each filtered as d (d.destino)}
							<tr>
								<th scope="row">{d.destino}</th>
								<td>{formatUSD(d.fijo)}</td>
								<td>{formatUSD(d.movil)}</td>
							</tr>
						{:else}
							<tr>
								<td class="empty" colspan="3">No encontramos destinos para “{query}”.</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>

		<p class="note">Valores expresados en dólares (U$S) por minuto, IVA incluido.</p>
	{/if}

	<ContactButtons text="¿Querés sumar telefonía?" />
</section>

<style>
.page {
	padding: 6em 1em 2em;
	max-width: 56rem;
	margin: 0 auto;
}

.hero {
	text-align: center;
	margin-bottom: 1.75rem;
}

.back {
	display: inline-block;
	margin-bottom: 0.75rem;
	font-size: 0.85rem;
	font-weight: 600;
	color: var(--celeste);
	text-decoration: none;
}
.back:hover {
	text-decoration: underline;
}

h1 {
	margin: 0;
	color: var(--violeta1);
}

.lead {
	margin: 0.6rem 0 0;
	color: #555;
	font-size: 0.95rem;
}

.vigencia {
	margin: 0.3rem 0 0;
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

/* ── Buscador ── */
.search {
	display: flex;
	align-items: center;
	gap: 0.6rem;
	max-width: 26rem;
	margin: 0 auto 1.25rem;
	padding: 0.65rem 1rem;
	background: white;
	border-radius: 999px;
	box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
	color: var(--violeta1);
}

.search input {
	flex: 1;
	border: none;
	outline: none;
	background: none;
	font: inherit;
	font-size: 0.95rem;
	color: var(--violeta1);
}

.search input::placeholder {
	color: #aaa;
}

/* ── Tabla ── */
.card {
	background: white;
	border-radius: 1rem;
	box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
	padding: 0.5rem;
	overflow: hidden;
}

.table-wrap {
	max-height: 32rem;
	overflow-y: auto;
	-webkit-overflow-scrolling: touch;
}

table {
	width: 100%;
	border-collapse: collapse;
	font-size: 0.92rem;
}

thead th {
	position: sticky;
	top: 0;
	z-index: 1;
	background: var(--violeta1);
	color: white;
	font-weight: 700;
	text-transform: uppercase;
	font-size: 0.7rem;
	letter-spacing: 0.04em;
	padding: 0.7rem 0.9rem;
	text-align: left;
}

.th-precio {
	text-align: right;
	width: 6rem;
}

tbody th,
tbody td {
	padding: 0.6rem 0.9rem;
	border-bottom: 1px solid #efeaf2;
}

tbody th {
	text-align: left;
	font-weight: 600;
	color: var(--violeta1);
}

tbody td {
	text-align: right;
	font-variant-numeric: tabular-nums;
	color: #444;
}

tbody tr:last-child th,
tbody tr:last-child td {
	border-bottom: none;
}

tbody tr:nth-child(even) th,
tbody tr:nth-child(even) td {
	background: #faf8fb;
}

.empty {
	text-align: center !important;
	color: #888;
	padding: 2rem 1rem;
}

.note {
	margin: 1rem 0 2rem;
	font-size: 0.82rem;
	color: #777;
	text-align: center;
}

@media (min-width: 768px) {
	.th-precio {
		width: 8rem;
	}
}
</style>
