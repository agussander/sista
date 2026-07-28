/** @typedef {{
 *   destino: string;
 *   fijo: string | null;
 *   movil: string | null;
 * }} DestinoInternacional */

/** @typedef {{
 *   vigencia: string | null;
 *   unidad: string;
 *   destinos: DestinoInternacional[];
 * }} InternacionalData */

/** @param {string} fragment */
function stripHtml(fragment) {
	return fragment
		.replace(/<[^>]+>/g, ' ')
		.replace(/&nbsp;/gi, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Parsea el HTML (Word export) de /internacional. La fuente trae una fila por
 * prefijo telefónico (miles de filas), por lo que agrupamos por destino y nos
 * quedamos con el precio de Fijo y de Móvil de cada país.
 * @param {string} html
 * @returns {InternacionalData}
 */
export function parseInternacionalHtml(html) {
	const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];

	/** @type {string | null} */
	let vigencia = null;

	/** @type {Map<string, DestinoInternacional>} */
	const map = new Map();
	/** @type {DestinoInternacional[]} */
	const destinos = [];

	for (const row of rows) {
		const cells = [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) =>
			stripHtml(m[1])
		);

		if (!vigencia) {
			const vidx = cells.findIndex((c) => /Vigencia a partir del/i.test(c));
			if (vidx !== -1) {
				const next = cells.slice(vidx + 1).find((c) => /\d/.test(c));
				if (next) vigencia = next;
			}
		}

		// Fila de datos: [..., prefijo, destino, tipo, precio]. Anclamos en el
		// precio (única celda con "U$S") y leemos hacia atrás.
		const precioIdx = cells.findIndex((c) => /U\$S/i.test(c));
		if (precioIdx < 3) continue;

		const precio = cells[precioIdx];
		const tipo = cells[precioIdx - 1];
		const destino = cells[precioIdx - 2];
		const prefijo = cells[precioIdx - 3];

		// Salteamos el encabezado ("Prefijo") y filas sin prefijo numérico.
		if (!/^\d/.test(prefijo) || !destino) continue;

		let entry = map.get(destino);
		if (!entry) {
			entry = { destino, fijo: null, movil: null };
			map.set(destino, entry);
			destinos.push(entry);
		}

		if (/fij/i.test(tipo)) entry.fijo = precio;
		else if (/m[oó]vil/i.test(tipo)) entry.movil = precio;
	}

	return { vigencia, unidad: 'U$S', destinos };
}
