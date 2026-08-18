<script>
/**
 * Importador del Excel del tarifario.
 *
 * Reemplaza el circuito manual que estaba escrito dentro del propio Excel
 * ("copiar rango B5:C34, pegarlo en Word, guardarlo como pagina web
 * filtrada..."). El archivo se parsea en el navegador y se escribe directo a
 * PocketBase, igual que el resto del panel.
 *
 * Publica en un solo paso, pero nunca a ciegas: primero muestra el diff contra
 * los precios que estan hoy en el sitio. Es una operacion mensual que toca los
 * precios de todas las paginas comerciales.
 */
import { onMount } from 'svelte';
import { pb } from '$lib/pocketbase';
import Spinner from '$lib/components/ui/Spinner.svelte';
import { leerLibro } from '$lib/tarifario/xlsx.js';
import { parseTarifario } from '$lib/tarifario/parseTarifario.js';
import { calcularPrecios } from '$lib/tarifario/mapeoPrecios.js';

/** @type {import('$lib/tarifario/parseTarifario.js').Tarifario | null} */
let tarifario = $state(null);
/** @type {File | null} */
let archivo = $state(null);
/** @type {import('$lib/tarifario/mapeoPrecios.js').ResultadoPrecios | null} */
let resultado = $state(null);
let preciosActuales = $state({});
let preciosId = $state(null);
let tarifarioId = $state(null);
let vigenteVersion = $state(null);

let leyendo = $state(false);
let publicando = $state(false);
let error = $state('');
let mensaje = $state('');

onMount(async () => {
	try {
		const record = await pb.collection('precios').getFirstListItem('', { requestKey: null });
		preciosId = record.id;
		preciosActuales = { ...record };
	} catch (e) {
		console.error('No se pudieron leer los precios actuales:', e);
	}
	try {
		const record = await pb.collection('tarifario').getFirstListItem('', { requestKey: null });
		tarifarioId = record.id;
		vigenteVersion = record.version ?? null;
	} catch {
		// Todavia no hay tarifario publicado: es el primer import.
	}
});

const diff = $derived.by(() => {
	if (!resultado) return [];
	return Object.entries(resultado.valores).map(([campo, nuevo]) => {
		const actual = Number(preciosActuales?.[campo] ?? NaN);
		return {
			campo,
			actual: Number.isFinite(actual) ? actual : null,
			nuevo,
			cambia: !Number.isFinite(actual) || actual !== nuevo
		};
	});
});

const cambios = $derived(diff.filter((d) => d.cambia).length);

const miles = (n) => (n === null ? '—' : n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'));

/** @param {File | undefined} file */
async function tomarArchivo(file) {
	if (!file) return;
	leyendo = true;
	error = '';
	mensaje = '';
	tarifario = null;
	resultado = null;

	try {
		const libro = await leerLibro(await file.arrayBuffer());
		const parsed = parseTarifario(libro);
		if (!parsed.tarifasWeb.filas.length) {
			throw new Error('La pestaña "Tarifas Web" no trajo ninguna fila.');
		}
		tarifario = parsed;
		resultado = calcularPrecios(parsed.mostrador);
		archivo = file;
	} catch (e) {
		error = e instanceof Error ? e.message : 'No se pudo leer el archivo.';
		console.error('Importar tarifario:', e);
	} finally {
		leyendo = false;
	}
}

async function publicar() {
	if (!tarifario || !archivo || !resultado) return;
	publicando = true;
	error = '';
	mensaje = '';

	try {
		const datos = new FormData();
		datos.append('version', tarifario.version ?? '');
		datos.append('vigencia', tarifario.vigencia ?? '');
		datos.append('tarifas_web', JSON.stringify(tarifario.tarifasWeb));
		datos.append('linea_vip', JSON.stringify(tarifario.lineaVip));
		datos.append('internacional', JSON.stringify(tarifario.internacional));
		datos.append('importado_por', pb.authStore.record?.id ?? '');
		datos.append('archivo', archivo);

		const record = tarifarioId
			? await pb.collection('tarifario').update(tarifarioId, datos)
			: await pb.collection('tarifario').create(datos);
		tarifarioId = record.id;
		vigenteVersion = record.version ?? null;

		const aplicados = cambios;
		if (preciosId && Object.keys(resultado.valores).length) {
			await pb.collection('precios').update(preciosId, resultado.valores);
			preciosActuales = { ...preciosActuales, ...resultado.valores };
		}

		mensaje = `Tarifario ${tarifario.version} publicado. ${aplicados} precio(s) actualizados.`;
		tarifario = null;
		resultado = null;
		archivo = null;
	} catch (e) {
		error = e instanceof Error ? e.message : 'No se pudo publicar.';
		console.error('Publicar tarifario:', e);
	} finally {
		publicando = false;
	}
}
</script>

<section class="importar">
	<header>
		<h3>Importar tarifario</h3>
		{#if vigenteVersion}
			<span class="vigente">Vigente: versión {vigenteVersion}</span>
		{/if}
	</header>

	<label class="dropzone">
		<input
			type="file"
			accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
			onchange={(e) => tomarArchivo(e.currentTarget.files?.[0])}
			disabled={leyendo || publicando}
		/>
		{#if leyendo}
			<Spinner size={32} borderWidth={3} label="Leyendo el Excel…" />
		{:else}
			<span class="titulo">Subí el Excel del tarifario</span>
			<span class="ayuda">Archivo .xlsx, con las pestañas de siempre</span>
		{/if}
	</label>

	{#if error}
		<p class="alerta error">{error}</p>
	{/if}
	{#if mensaje}
		<p class="alerta ok">{mensaje}</p>
	{/if}

	{#if tarifario && resultado}
		<div class="resumen">
			<div><strong>Versión</strong><span>{tarifario.version ?? '—'}</span></div>
			<div><strong>Vigencia</strong><span>{tarifario.vigencia ?? '—'}</span></div>
			<div><strong>Tarifas Web</strong><span>{tarifario.tarifasWeb.filas.length} filas</span></div>
			<div><strong>Línea VIP</strong><span>{tarifario.lineaVip.planes.length} planes</span></div>
			<div>
				<strong>Internacional</strong><span>{tarifario.internacional.destinos.length} destinos</span>
			</div>
			<div><strong>Mostrador</strong><span>{tarifario.mostrador.length} filas</span></div>
		</div>

		<table class="diff">
			<thead>
				<tr><th>Campo</th><th>Actual</th><th>Nuevo</th></tr>
			</thead>
			<tbody>
				{#each diff as fila (fila.campo)}
					<tr class:cambia={fila.cambia}>
						<th scope="row">{fila.campo}</th>
						<td>{miles(fila.actual)}</td>
						<td>{miles(fila.nuevo)}</td>
					</tr>
				{/each}
			</tbody>
		</table>

		{#if resultado.valores.antina_cine}
			<p class="nota">
				<code>antina_cine</code> es un adicional y el Excel publica el total: se deriva restando
				“ANTINA PLAY +” de “Básico + Cine”.
			</p>
		{/if}

		{#if resultado.avisos.length}
			<ul class="avisos">
				{#each resultado.avisos as aviso}
					<li>{aviso}</li>
				{/each}
			</ul>
		{/if}

		{#if resultado.sinCampo.length}
			<details class="sin-campo">
				<summary>{resultado.sinCampo.length} filas del Excel sin precio propio en el sitio</summary>
				<p>{resultado.sinCampo.join(' · ')}</p>
			</details>
		{/if}

		<div class="acciones">
			<button type="button" onclick={publicar} disabled={publicando}>
				{publicando ? 'Publicando…' : `Publicar (${cambios} cambio${cambios === 1 ? '' : 's'})`}
			</button>
		</div>
	{/if}
</section>

<style>
.importar {
	background: white;
	padding: 2em;
	border-radius: 1em;
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
	margin-bottom: 2em;
}

header {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: 1em;
	margin-bottom: 1.2em;
}

h3 {
	margin: 0;
	font-size: 1.1em;
	color: var(--violeta2);
}

.vigente {
	font-size: 0.85em;
	color: #888;
}

.dropzone {
	display: grid;
	place-items: center;
	gap: 0.35em;
	padding: 2em 1em;
	border: 2px dashed #d0d0d0;
	border-radius: 0.5em;
	cursor: pointer;
	transition: all 0.2s ease;
	text-align: center;
}

.dropzone:hover {
	border-color: var(--violeta2);
	background: #f9f9ff;
}

.dropzone input {
	display: none;
}

.titulo {
	font-weight: 600;
	color: #666;
}

.ayuda {
	font-size: 0.85em;
	color: #999;
}

.alerta {
	margin: 1em 0 0;
	padding: 0.8em 1.2em;
	border-radius: 0.5em;
}

.alerta.error {
	background: #ffebee;
	color: #c62828;
}

.alerta.ok {
	background: #e8f5e9;
	color: #2e7d32;
}

.resumen {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
	gap: 0.8em;
	margin: 1.5em 0;
}

.resumen div {
	display: flex;
	flex-direction: column;
	gap: 0.2em;
	padding: 0.7em 0.9em;
	background: #f7f7fb;
	border-radius: 0.5em;
}

.resumen strong {
	font-size: 0.7em;
	text-transform: uppercase;
	letter-spacing: 0.05em;
	color: var(--violeta2);
}

.diff {
	width: 100%;
	border-collapse: collapse;
	font-size: 0.92em;
}

.diff th,
.diff td {
	padding: 0.5em 0.7em;
	border-bottom: 1px solid #eee;
	text-align: left;
}

.diff thead th {
	font-size: 0.72em;
	text-transform: uppercase;
	letter-spacing: 0.05em;
	color: #888;
}

.diff td {
	text-align: right;
	font-variant-numeric: tabular-nums;
}

.diff tr.cambia {
	background: #fff8e1;
}

.diff tr.cambia td:last-child {
	font-weight: 700;
	color: var(--magenta);
}

.nota,
.avisos {
	margin: 1em 0 0;
	font-size: 0.88em;
	color: #666;
}

.avisos {
	padding-left: 1.2em;
	display: grid;
	gap: 0.35em;
	color: #b26a00;
}

.sin-campo {
	margin-top: 1em;
	font-size: 0.85em;
	color: #777;
}

.acciones {
	display: flex;
	justify-content: flex-end;
	margin-top: 1.5em;
}

.acciones button {
	background: linear-gradient(135deg, var(--violeta1) 0%, var(--violeta2) 100%);
	color: white;
	border: none;
	padding: 0.8em 1.5em;
	border-radius: 0.5em;
	font-size: 1em;
	font-weight: 600;
	cursor: pointer;
}

.acciones button:disabled {
	opacity: 0.6;
	cursor: not-allowed;
}
</style>
