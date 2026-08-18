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

export { FORMATOS_FECHA };
