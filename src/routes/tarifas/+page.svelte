<script>
/**
 * Tarifario publico, generado desde el Excel importado en el panel.
 *
 * Replica la tabla que hasta ahora se armaba a mano pegando el rango B5:D34 en
 * Word y renombrando el .htm a index.php. Mismo orden, mismas dos columnas y
 * misma sangria de los packs; lo unico que cambia es que sale sola.
 */
import { onMount } from 'svelte';
import { MetaTags } from 'svelte-meta-tags';
import ContactButtons from '$lib/components/ui/ContactButtons.svelte';
import Spinner from '$lib/components/ui/Spinner.svelte';
import { fetchTarifario, mensajeDeError } from '$lib/tarifario/fetchTarifario.js';
import { formatearFecha } from '$lib/tarifario/formato.js';

/** @type {import('$lib/tarifario/fetchTarifario.js').TarifarioPublicado | null} */
let data = $state(null);
let loading = $state(true);
let error = $state(null);

onMount(async () => {
	try {
		data = await fetchTarifario();
	} catch (e) {
		error = mensajeDeError(e);
		console.error('Tarifario:', e);
	} finally {
		loading = false;
	}
});

/**
 * Formato del Word: entero, miles separados con espacio. `$ 20 787`.
 * @param {number | null} valor
 */
function pesos(valor) {
	if (typeof valor !== 'number' || !Number.isFinite(valor)) return '—';
	return `$ ${Math.round(valor).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`;
}

const filas = $derived(data?.tarifasWeb?.filas ?? []);
const vigencia = $derived(formatearFecha(data?.vigencia));
</script>

<MetaTags
	title="Tarifas vigentes | Sista"
	description="Cuadro tarifario vigente de Sista: abonos mensuales de internet, TV y telefonía, con y sin impuestos nacionales."
/>

<section class="page">
	<header class="hero">
		<h1>Tarifas</h1>
		{#if vigencia}
			<p class="vigencia">Vigentes desde el {vigencia}</p>
		{/if}
	</header>

	{#if loading}
		<div class="state">
			<Spinner size={48} label="Cargando tarifas…" />
		</div>
	{:else if error}
		<div class="state state--error">
			<p>{error}</p>
			<p class="hint">Los valores se actualizan desde el tarifario oficial de Sista.</p>
		</div>
	{:else if filas.length}
		<div class="card">
			<div class="table-wrap">
				<table>
					<thead>
						<tr>
							<th class="th-plan"></th>
							<th class="th-precio">Sin impuestos nacionales</th>
							<th class="th-precio">Abono Mensual</th>
						</tr>
					</thead>
					<tbody>
						{#each filas as fila (fila.label)}
							<tr class:sub={fila.nivel === 1}>
								<th scope="row">{fila.label}</th>
								<td>{pesos(fila.sinImpuestos)}</td>
								<td>{pesos(fila.precioFinal)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			{#if data?.version}
				<p class="version">{data.version}</p>
			{/if}
		</div>
	{:else}
		<div class="state state--error">
			<p>Todavía no hay un tarifario publicado.</p>
		</div>
	{/if}

	<ContactButtons text="¿Querés contratar?" />
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

.state--error p:first-child {
	margin: 0;
	text-align: center;
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

.card {
	background: white;
	border-radius: 1rem;
	box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
	padding: 0.5rem 0.5rem 0.75rem;
	margin-bottom: 2rem;
}

.table-wrap {
	overflow-x: auto;
}

table {
	width: 100%;
	border-collapse: collapse;
	font-size: 0.95rem;
}

thead th {
	font-size: 0.7rem;
	font-weight: 700;
	text-transform: uppercase;
	letter-spacing: 0.05em;
	color: var(--violeta1);
	opacity: 0.7;
	padding: 0.7rem 0.75rem;
	text-align: right;
	white-space: nowrap;
}

thead .th-plan {
	text-align: left;
}

tbody th {
	text-align: left;
	font-weight: 600;
	color: #333;
}

tbody th,
tbody td {
	padding: 0.6rem 0.75rem;
	border-top: 1px solid #f0f0f0;
}

tbody td {
	text-align: right;
	white-space: nowrap;
	font-variant-numeric: tabular-nums;
	color: var(--violeta1);
}

tbody td:last-child {
	font-weight: 700;
}

/* Los packs son sub-items del servicio de arriba: en el Excel eso se ve como
   sangria y aca se mantiene. */
tr.sub th {
	padding-left: 2rem;
	font-weight: 500;
	color: #666;
}

.version {
	margin: 0.75rem 0.75rem 0;
	text-align: right;
	font-size: 0.75rem;
	color: #aaa;
}
</style>
