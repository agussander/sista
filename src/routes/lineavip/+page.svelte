<!--
  /lineavip — la grilla de Línea VIP tal cual sale del Excel del tarifario.

  Reemplaza al flujo manual que describe la celda A20 de la pestaña
  "Linea VIP - Tarifas Web": copiar el rango A1:J18, pegarlo en Word, guardarlo
  como "página web filtrada" y subir el .htm renombrado a index.php. Esta página
  es esa misma grilla, con los mismos textos, el mismo orden y los mismos
  formatos de celda, pero servida desde el sitio.

  A diferencia de /telefonia (que lee el tarifario importado y lo re-maqueta),
  acá los valores son una copia fija de la version del Excel indicada en
  `VERSION`. Al publicar un tarifario nuevo hay que actualizar `VIGENCIA`,
  `VERSION` y los numeros de `PLANES`.
-->
<script>
	import { MetaTags } from 'svelte-meta-tags';
	import { formatearFecha } from '$lib/tarifario/formato.js';

	// Fuente: docs/Tarifario V26.09  (09-2026).xlsx, pestaña
	// "Linea VIP - Tarifas Web", rango A1:J18.
	const VIGENCIA = '2026-09-01'; // J2
	const VERSION = 26.09; // J9

	// Filas 5 a 8. `cargoInicial` es número en Radio y el texto "--" en Fibra,
	// igual que en el Excel.
	const PLANES = [
		{
			nombre: 'Linea VIP R11',
			clientes: 'Radio',
			numeroLocal: 'AMBA 011',
			cargoInicial: 800,
			abonoMensual: 21451.380500642037,
			minutosLocales: 500,
			excedenteLocal: 30.04025988144986
		},
		{
			nombre: 'Linea VIP R221',
			clientes: 'Radio',
			numeroLocal: 'LP 0221',
			cargoInicial: 800,
			abonoMensual: 10181.007070018002,
			minutosLocales: 500,
			excedenteLocal: 30.04025988144986
		},
		{
			nombre: 'Linea VIP 11',
			clientes: 'Fibra',
			numeroLocal: 'AMBA 011',
			cargoInicial: '--',
			abonoMensual: 21451.380500642037,
			minutosLocales: 500,
			excedenteLocal: 30.04025988144986
		},
		{
			nombre: 'Linea VIP 221',
			clientes: 'Fibra',
			numeroLocal: 'LP 0221',
			cargoInicial: '--',
			abonoMensual: 10181.007070018002,
			minutosLocales: 500,
			excedenteLocal: 30.04025988144986
		}
	];

	// H5:H8 y J5:J8 estan combinadas en el Excel: un solo valor para los cuatro
	// planes.
	const LLAMADAS_CELULARES = 239.63344364310535; // H5
	const EXCEDENTE_NACIONAL = 29.850532772151535; // J5

	const APARATO = 'Aparato telefonico (Opcional): Ver ofertas de vitrina'; // B10
	const NOTA_INTERNACIONAL =
		'El precio de las llamadas internacionales se expresa en U$S según el Cuadro Tarifario Internacional vigente'; // B12
	const NOTAS = [
		'Valores en Pesos ($)', // B14
		'Incluye IVA, del 21 %', // B15
		'Para cada abonado de fibra, se puede incorporar hasta 2 líneas VIP 11 o VIP 221, las dos iguales o una y una', // B17
		'Para cada abonado de ATA se puede incorporar una línea VIP R11 o VIP R221' // B18
	];

	const pesos0 = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
	const pesos2 = new Intl.NumberFormat('es-AR', {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	});

	/**
	 * Formato "$ #.##0" del Excel (numFmt 165). Si el valor es texto —el "--" de
	 * los planes de fibra— se muestra tal cual.
	 *
	 * @param {number | string} value
	 */
	function moneda0(value) {
		return typeof value === 'number' ? `$ ${pesos0.format(value)}` : value;
	}

	/**
	 * Formato "$ #.##0,00" del Excel (numFmt 166).
	 *
	 * @param {number} value
	 */
	function moneda2(value) {
		return `$ ${pesos2.format(value)}`;
	}

	const vigencia = formatearFecha(VIGENCIA);
</script>

<!--
  `robots={false}`: sin esto `svelte-meta-tags` emite un `index,follow` que
  chocaria con el `noindex` que el layout pone para las rutas de `RUTAS_INTERNAS`.
-->
<MetaTags
	title="Línea VIP · Cuadro tarifario | Sista"
	description="Cuadro tarifario vigente de Línea VIP de Sista: cargo inicial, abono mensual, minutos locales incluidos y precio de los minutos excedentes."
	robots={false}
/>

<div class="hoja">
	<div class="grilla">
		<div class="encabezado">
			<span class="titulo">Sista s.a. - LINEA VIP</span>
			{#if vigencia}<span class="vigencia">{vigencia}</span>{/if}
		</div>

		<table>
			<!-- Anchos de las columnas B a J del Excel, en la misma proporción. -->
			<colgroup>
				<col style="width: 107px" />
				<col style="width: 78px" />
				<col style="width: 78px" />
				<col style="width: 71px" />
				<col style="width: 81px" />
				<col style="width: 71px" />
				<col style="width: 84px" />
				<col style="width: 116px" />
				<col style="width: 116px" />
			</colgroup>
			<thead>
				<tr>
					<th rowspan="2">Nombre</th>
					<th rowspan="2">Clientes</th>
					<th rowspan="2">Número Local</th>
					<th rowspan="2">Cargo Inicial</th>
					<th rowspan="2">Abono Mensual</th>
					<th rowspan="2">Minutos Locales Incluidos</th>
					<th rowspan="2">Llamadas a Celulares</th>
					<th colspan="2">Precio de los Minutos Excedentes</th>
				</tr>
				<tr>
					<th class="sub">Destino Local</th>
					<th class="sub">Destino Nacional</th>
				</tr>
			</thead>
			<tbody>
				{#each PLANES as plan, i}
					<tr>
						<td>{plan.nombre}</td>
						<td>{plan.clientes}</td>
						<td>{plan.numeroLocal}</td>
						<td>{moneda0(plan.cargoInicial)}</td>
						<td>{moneda0(plan.abonoMensual)}</td>
						<td>{plan.minutosLocales}</td>
						{#if i === 0}
							<td rowspan={PLANES.length} class="combinada">{moneda2(LLAMADAS_CELULARES)}</td>
						{/if}
						<td>{moneda2(plan.excedenteLocal)}</td>
						{#if i === 0}
							<td rowspan={PLANES.length} class="combinada">{moneda2(EXCEDENTE_NACIONAL)}</td>
						{/if}
					</tr>
				{/each}
			</tbody>
		</table>

		<p class="version">{pesos2.format(VERSION)}</p>
		<p class="aparato">{APARATO}</p>
		<p class="nota">{NOTA_INTERNACIONAL}</p>
		<!-- G13: el Excel escribe la URL, así que apunta al cuadro crudo. -->
		<p class="link">
			<a href="/internacional">www.sista.ar/internacional</a>
		</p>
		{#each NOTAS as nota}
			<p class="nota-final">{nota}</p>
		{/each}
	</div>
</div>

<style>
/*
  La hoja imita la salida de Word: Arial, tamaños en pt y una tabla con recuadro
  exterior grueso y líneas internas finas, igual que el rango del Excel.
*/
.hoja {
	/* La página se sirve sin nav ni footer (ver `hideChrome` en el layout raíz),
	   igual que la hoja suelta que publicaba Word. */
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
.hoja td,
.hoja a {
	font-family: Arial, Helvetica, sans-serif;
	color: black;
}

.grilla {
	width: max-content;
	min-width: 100%;
	margin: 0 auto;
}

.encabezado {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 2em;
	height: 19.35pt;
}

.titulo {
	font-size: 10pt;
	font-weight: bold;
}

/* En el Excel la vigencia es la celda J2: 8 pt y roja. */
.hoja .vigencia {
	font-size: 8pt;
	color: red;
}

table {
	border-collapse: collapse;
	table-layout: fixed;
	font-size: 10pt;
	border: 2px solid black;
}

th,
td {
	border: 1px solid black;
	padding: 0 4px;
	text-align: center;
	vertical-align: middle;
	height: 18.6pt;
	overflow-wrap: break-word;
}

th {
	font-weight: bold;
	height: 30pt;
}

.sub {
	height: auto;
}

/* H5:H8 y J5:J8: celdas combinadas, a 12 pt en el Excel. */
.combinada {
	font-size: 12pt;
}

/* La columna del nombre del plan no está centrada en el Excel. */
tbody td:first-child {
	text-align: left;
}

/* J9: el número de versión del tarifario, 8 pt, debajo de la tabla. */
.version {
	margin: 0;
	font-size: 8pt;
	text-align: right;
	height: 13.35pt;
	line-height: 13.35pt;
}

/* B10: azul y en negrita, como en el Excel. */
.hoja .aparato {
	margin: 0;
	font-size: 10pt;
	font-weight: bold;
	color: #191ef7;
}

.nota {
	margin: 1em 0 0;
	font-size: 9pt;
}

.link {
	margin: 0;
	font-size: 9pt;
	padding-left: 415px; /* la celda del Excel es G13: arranca donde la columna G */
}

/* Hipervínculo con el color del tema del Excel (hlink 0563C1). */
.hoja .link a {
	color: #0563c1;
	text-decoration: underline;
}

.nota-final {
	margin: 0;
	font-size: 10pt;
}

/* La fila 16 del Excel está vacía: separa la nota de fibra de las anteriores. */
.nota-final:nth-of-type(7) {
	margin-top: 1em;
}

@media (max-width: 600px) {
	.hoja {
		padding-left: 0.5em;
		padding-right: 0.5em;
	}

	.link {
		padding-left: 0;
	}
}
</style>
