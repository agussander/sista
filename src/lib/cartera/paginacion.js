/**
 * Que numeros de pagina dibujar debajo de la lista.
 *
 * Vive aparte de `orden.js` porque no tiene nada que ver con ordenar, y aparte
 * del componente porque sus casos borde son reales: menos paginas que huecos,
 * la pagina actual pegada a un extremo, y un solo numero salteado (donde poner
 * "…" en lugar del numero ocuparia lo mismo y diria menos).
 */

/** Clientes por pagina. */
export const POR_PAGINA = 20;

/**
 * Hasta cuantas paginas se muestran enteras, sin elipsis. Siete es lo que entra
 * comodo: primera, ultima, la actual, sus dos vecinas y las dos elipsis.
 */
const SIN_ELIPSIS = 7;

/**
 * @param {number} actual Pagina actual, 1-based
 * @param {number} total Cantidad de paginas
 * @returns {(number | '…')[]}
 */
export function paginasVisibles(actual, total) {
	if (total <= 0) return [];
	if (total <= SIN_ELIPSIS) return Array.from({ length: total }, (_, i) => i + 1);

	const numeros = [...new Set([1, actual - 1, actual, actual + 1, total])]
		.filter((n) => n >= 1 && n <= total)
		.sort((a, b) => a - b);

	/** @type {(number | '…')[]} */
	const salida = [];
	let anterior = 0;
	for (const n of numeros) {
		// Un solo numero salteado no se reemplaza por "…": ocuparia lo mismo y
		// escondería una pagina a la que se podria ir de un click.
		if (n - anterior === 2) salida.push(anterior + 1);
		else if (n - anterior > 2) salida.push('…');
		salida.push(n);
		anterior = n;
	}
	return salida;
}
