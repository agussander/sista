<!--
  /internacional — el cuadro tarifario internacional tal cual sale del Excel.

  Gemela de /lineavip. La celda G5 de la pestaña "Internacional" describe el
  flujo que reemplaza: "Copiar las 4 columnas, pegar en Word como texto,
  agregarle las tabulaciones y guardar como 'página web filtrada' y nombre
  'index.php'". Esta página es esa misma copia: las columnas B a E enteras, una
  fila por prefijo, en el orden del Excel.

  La columna G no se copia. Ahí están el instructivo y la nota del margen sobre
  el costo mayorista: son internas y no salen publicadas.

  Los valores viven en `$lib/tarifario/hojaInternacional.js` y se comparten con
  el endpoint /api/internacional. Ni esta página ni /lineavip se indexan (ver
  `RUTAS_INTERNAS` en `$lib/tracking.js`): se llega sólo por link.
-->
<script>
	import { MetaTags } from 'svelte-meta-tags';
	import { formatearFecha } from '$lib/tarifario/formato.js';
	import {
		TITULO,
		ETIQUETA_VIGENCIA,
		VIGENCIA,
		ENCABEZADOS,
		FILAS
	} from '$lib/tarifario/hojaInternacional.js';

	const precio = new Intl.NumberFormat('es-AR', {
		minimumFractionDigits: 1,
		maximumFractionDigits: 1
	});

	/**
	 * Formato "U$S #,##0.0" del Excel (numFmt 178).
	 *
	 * @param {number} value
	 */
	function moneda(value) {
		return `U$S ${precio.format(value)}`;
	}

	const vigencia = formatearFecha(VIGENCIA);
</script>

<MetaTags
	title="Cuadro Tarifario Internacional | Sista"
	description="Precio del minuto de llamadas internacionales de Sista, por prefijo y destino."
	robots={false}
/>

<div class="hoja">
	<div class="grilla">
		<p class="titulo">{TITULO}</p>

		<p class="vigencia">
			<span class="vigencia-etiqueta">{ETIQUETA_VIGENCIA}</span>
			<span class="vigencia-fecha">{vigencia}</span>
		</p>

		<table>
			<!-- Anchos de las columnas B a E del Excel, en la misma proporción. -->
			<colgroup>
				<col style="width: 84px" />
				<col style="width: 195px" />
				<col style="width: 76px" />
				<col style="width: 76px" />
			</colgroup>
			<thead>
				<tr>
					{#each ENCABEZADOS as encabezado}
						<th>{encabezado}</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each FILAS as [prefijo, destino, tipo, valor]}
					<tr>
						<td>{prefijo}</td>
						<td class="destino">{destino}</td>
						<td>{tipo}</td>
						<td>{moneda(valor)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>

<style>
/*
  Igual que /lineavip: la hoja imita la salida de Word, en Arial y con tamaños
  en pt, y se sirve sin nav ni footer (ver `hideChrome` en el layout raíz).
*/
.hoja {
	min-height: 100vh;
	padding: 2em 1em 3em;
	background: white;
	overflow-x: auto;
}

/*
  `global.css` pinta todo el sitio con la tipografía 'nexa' y el violeta de
  marca. Acá no: la hoja tiene que leerse como el Excel, en Arial y negro.
*/
.hoja p,
.hoja span,
.hoja th,
.hoja td {
	font-family: Arial, Helvetica, sans-serif;
	color: black;
}

.grilla {
	width: 431px; /* la suma de las cuatro columnas */
	margin: 0 auto;
}

/* B2: 12 pt y en negrita. */
.titulo {
	margin: 0 0 0.5em;
	font-size: 12pt;
	font-weight: bold;
}

/* Fila 3: la etiqueta cae sobre la columna D y la fecha sobre la E. */
.vigencia {
	display: flex;
	margin: 0 0 0.2em;
	font-size: 8pt;
}

/*
  En el Excel la etiqueta vive en D3 pero se desborda sobre las celdas vacías de
  la izquierda, así que se lee en una sola línea. `nowrap` reproduce eso.
*/
.vigencia-etiqueta {
	margin-left: auto;
	white-space: nowrap;
	padding-right: 4px;
}

.vigencia-fecha {
	width: 76px;
	text-align: left;
	padding-left: 4px;
}

table {
	border-collapse: collapse;
	table-layout: fixed;
	width: 431px;
	font-size: 8pt;
}

th,
td {
	border: 1px solid black;
	padding: 1px 3px;
	text-align: center;
	vertical-align: middle;
	overflow-wrap: break-word;
}

/* Fila 4: encabezados en 10 pt y en negrita. */
th {
	font-size: 10pt;
	font-weight: bold;
	height: 25.5pt;
}

/* La columna del destino no está centrada en el Excel. */
.destino {
	text-align: left;
}
</style>
