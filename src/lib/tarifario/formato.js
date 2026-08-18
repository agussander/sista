/**
 * Formateo compartido del tarifario.
 *
 * El dinero lo formatea cada pagina, porque no todas lo muestran igual:
 * /tarifas replica el formato del Word (miles con espacio) y /telefonia usa el
 * estilo local (miles con punto). La fecha, en cambio, se lee igual en todas.
 */

/**
 * `2026-08-01` -> `01/08/2026`.
 *
 * Se parte el string en vez de construir un `Date`: `new Date('2026-08-01')` es
 * medianoche UTC, y en Argentina (UTC-3) eso se leeria como el 31 de julio.
 *
 * @param {string | null | undefined} iso
 * @returns {string | null}
 */
export function formatearFecha(iso) {
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? '').trim());
	return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
}
