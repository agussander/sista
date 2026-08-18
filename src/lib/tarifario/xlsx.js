/**
 * Lector minimo de archivos .xlsx, sin dependencias.
 *
 * Un .xlsx es un ZIP de XML. Se descomprime con `DecompressionStream`, que es
 * API de plataforma: no hace falta SheetJS (la version de npm quedo congelada
 * en 0.18.5, con CVE) ni ExcelJS, que pesan cientos de KB para leer una grilla.
 *
 * Lee valores, no formulas. Excel guarda junto a cada formula su ultimo valor
 * calculado, y eso es lo que se lee. Un archivo generado por una herramienta
 * que no cachee valores va a leerse vacio; de eso avisa quien lo consume.
 */

/** Formatos de fecha que Excel trae de fabrica y no declara en `styles.xml`. */
const FORMATOS_FECHA = new Set([14, 15, 16, 17, 22, 27, 30, 36, 45, 46, 47, 50, 57]);

/**
 * Serial de Excel -> `YYYY-MM-DD`.
 *
 * 25569 es el 1970-01-01 en la numeracion de Excel. La cuenta vale para todo
 * serial >= 61 (o sea, desde el 1900-03-01): antes de esa fecha habria que
 * compensar el 29 de febrero de 1900, que Excel cree que existio y no existio.
 *
 * @param {number} serial
 */
export function serialAFecha(serial) {
	return new Date(Math.round((serial - 25569) * 86400000)).toISOString().slice(0, 10);
}

/** @param {string} texto */
function desescapar(texto) {
	return texto
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
		.replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
		.replace(/&amp;/g, '&'); // ultimo: si no, "&amp;lt;" se convertiria en "<"
}

/**
 * Celdas de una hoja, indexadas por referencia (`'B6'`).
 *
 * @param {string} xml Contenido de `xl/worksheets/sheetN.xml`.
 * @param {{ shared?: string[], esFecha?: (estilo: number) => boolean }} [opciones]
 * @returns {Map<string, string | number | boolean>}
 */
export function leerCeldas(xml, { shared = [], esFecha = () => false } = {}) {
	/** @type {Map<string, string | number | boolean>} */
	const celdas = new Map();

	// Los atributos van NO codiciosos a proposito. Con `[^>]*` codicioso, una
	// celda auto-cerrada (`<c r="F6" s="214"/>`) se traga la barra, cae en la
	// rama `>` y su "contenido" pasa a ser todo hasta el `</c>` de la celda
	// SIGUIENTE, que asi desaparece.
	for (const m of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
		const atributos = m[1];
		const contenido = m[2];
		if (contenido === undefined) continue; // celda sin valor, solo estilo

		const ref = atributos.match(/r="([A-Z]+\d+)"/)?.[1];
		if (!ref) continue;

		const tipo = atributos.match(/t="([^"]+)"/)?.[1] ?? 'n';
		const estilo = Number(atributos.match(/s="(\d+)"/)?.[1] ?? -1);

		if (tipo === 'inlineStr') {
			const partes = [...contenido.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]);
			celdas.set(ref, desescapar(partes.join('')));
			continue;
		}

		// `<v xml:space="preserve">` lleva atributos: los espacios iniciales de
		// "   Pack Futbol (DGo)" marcan los packs como sub-items, y sin `\b[^>]*`
		// esas filas se pierden enteras.
		const crudo = contenido.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1];
		if (crudo === undefined) continue;

		if (tipo === 's') celdas.set(ref, shared[Number(crudo)] ?? '');
		else if (tipo === 'str') celdas.set(ref, desescapar(crudo));
		else if (tipo === 'b') celdas.set(ref, crudo === '1');
		else if (tipo === 'e') celdas.set(ref, desescapar(crudo));
		else celdas.set(ref, esFecha(estilo) ? serialAFecha(Number(crudo)) : Number(crudo));
	}

	return celdas;
}

const FIRMA_FIN_DIRECTORIO = 0x06054b50;

/** 22 bytes de cabecera final + hasta 65535 de comentario. */
const COLA_MAXIMA = 22 + 0xffff;

/**
 * Indice de las entradas del ZIP, leido del directorio central.
 *
 * Se usa el directorio central y no las cabeceras locales porque estas ultimas
 * pueden traer los tamanos en cero cuando el archivo se escribio en streaming.
 *
 * @param {DataView} vista
 */
function leerDirectorio(vista) {
	let fin = -1;
	const tope = Math.max(0, vista.byteLength - COLA_MAXIMA);
	for (let i = vista.byteLength - 22; i >= tope; i--) {
		if (vista.getUint32(i, true) === FIRMA_FIN_DIRECTORIO) {
			fin = i;
			break;
		}
	}
	if (fin === -1) throw new Error('El archivo no es un .xlsx válido: no se encontró el fin del ZIP.');

	const cantidad = vista.getUint16(fin + 10, true);
	let p = vista.getUint32(fin + 16, true);

	/** @type {Map<string, {metodo: number, comprimido: number, offset: number}>} */
	const entradas = new Map();
	const decoder = new TextDecoder();

	for (let i = 0; i < cantidad; i++) {
		const largoNombre = vista.getUint16(p + 28, true);
		const largoExtra = vista.getUint16(p + 30, true);
		const largoComentario = vista.getUint16(p + 32, true);
		const nombre = decoder.decode(
			new Uint8Array(vista.buffer, vista.byteOffset + p + 46, largoNombre)
		);
		entradas.set(nombre, {
			metodo: vista.getUint16(p + 10, true),
			comprimido: vista.getUint32(p + 20, true),
			offset: vista.getUint32(p + 42, true)
		});
		p += 46 + largoNombre + largoExtra + largoComentario;
	}

	return entradas;
}

/**
 * Contenido de texto de una entrada del ZIP, o `null` si no está.
 *
 * @param {Uint8Array} bytes
 * @param {DataView} vista
 * @param {Map<string, {metodo: number, comprimido: number, offset: number}>} entradas
 * @param {string} nombre
 * @returns {Promise<string | null>}
 */
async function leerEntrada(bytes, vista, entradas, nombre) {
	const entrada = entradas.get(nombre);
	if (!entrada) return null;

	// La cabecera local repite nombre y extra, con largos propios que pueden
	// diferir de los del directorio central.
	const largoNombre = vista.getUint16(entrada.offset + 26, true);
	const largoExtra = vista.getUint16(entrada.offset + 28, true);
	const desde = entrada.offset + 30 + largoNombre + largoExtra;
	const crudo = bytes.subarray(desde, desde + entrada.comprimido);

	if (entrada.metodo === 0) return new TextDecoder().decode(crudo);
	if (entrada.metodo !== 8) {
		throw new Error(`Método de compresión ZIP no soportado: ${entrada.metodo}`);
	}

	const flujo = new Blob([crudo]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
	return await new Response(flujo).text();
}

/**
 * Decide si un indice de estilo corresponde a un formato de fecha. Hace falta
 * porque en el XML una fecha es un numero pelado: lo unico que la distingue de
 * un precio es el formato con el que se muestra.
 *
 * @param {(nombre: string) => Promise<string | null>} leer
 */
async function construirDetectorDeFechas(leer) {
	const estilosXml = await leer('xl/styles.xml');
	if (!estilosXml) return () => false;

	const formatos = new Map(
		[...estilosXml.matchAll(/<numFmt\b([^>]*)\/>/g)].map((m) => [
			Number(m[1].match(/numFmtId="(\d+)"/)?.[1]),
			m[1].match(/formatCode="([^"]*)"/)?.[1] ?? ''
		])
	);

	const bloque = estilosXml.match(/<cellXfs\b[\s\S]*?<\/cellXfs>/)?.[0] ?? '';
	const porEstilo = [...bloque.matchAll(/<xf\b([^>]*)/g)].map((m) =>
		Number(m[1].match(/numFmtId="(\d+)"/)?.[1] ?? 0)
	);

	return (estilo) => {
		const id = porEstilo[estilo];
		if (id === undefined) return false;
		if (FORMATOS_FECHA.has(id)) return true;
		// Formato propio: es fecha si su patron tiene letras de fecha/hora, sin
		// contar lo que este entre corchetes o entre comillas (texto literal).
		const codigo = formatos.get(id);
		return !!codigo && /[dmyhs]/.test(codigo.replace(/\[[^\]]*\]/g, '').replace(/"[^"]*"/g, ''));
	};
}

/**
 * Lee un `.xlsx` completo.
 *
 * @param {ArrayBuffer | Uint8Array} archivo
 * @returns {Promise<Map<string, Map<string, string | number | boolean>>>}
 *   Nombre de hoja -> celdas. El orden es el del libro.
 */
export async function leerLibro(archivo) {
	const bytes = archivo instanceof Uint8Array ? archivo : new Uint8Array(archivo);
	if (bytes.byteLength < 22) throw new Error('El archivo no es un .xlsx válido: está vacío.');
	const vista = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

	const entradas = leerDirectorio(vista);
	/** @param {string} nombre */
	const leer = (nombre) => leerEntrada(bytes, vista, entradas, nombre);

	const libroXml = await leer('xl/workbook.xml');
	const relsXml = await leer('xl/_rels/workbook.xml.rels');
	if (!libroXml || !relsXml) throw new Error('El archivo no es un .xlsx válido: falta el workbook.');

	const destinos = new Map(
		[...relsXml.matchAll(/<Relationship\b([^>]*)>/g)].map((m) => [
			m[1].match(/Id="([^"]+)"/)?.[1],
			m[1].match(/Target="([^"]+)"/)?.[1]
		])
	);

	// Cadena de textos compartidos: las celdas `t="s"` guardan un indice a esto.
	const compartidasXml = (await leer('xl/sharedStrings.xml')) ?? '';
	const shared = [...compartidasXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
		desescapar([...m[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join(''))
	);

	const esFecha = await construirDetectorDeFechas(leer);

	/** @type {Map<string, Map<string, string | number | boolean>>} */
	const hojas = new Map();
	for (const m of libroXml.matchAll(/<sheet\b([^>]*)>/g)) {
		const nombre = m[1].match(/name="([^"]+)"/)?.[1];
		const destino = destinos.get(m[1].match(/r:id="([^"]+)"/)?.[1]);
		if (!nombre || !destino) continue;
		const xml = await leer(`xl/${destino.replace(/^\/?xl\//, '')}`);
		hojas.set(desescapar(nombre), xml ? leerCeldas(xml, { shared, esFecha }) : new Map());
	}

	return hojas;
}

export { FORMATOS_FECHA };
