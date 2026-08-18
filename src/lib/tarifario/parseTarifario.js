/**
 * Parser del Tarifario de Sista.
 *
 * A diferencia de `xlsx.js`, que no sabe de tarifas, este modulo conoce *este*
 * libro: que hojas mirar, que columnas tienen que datos y donde arranca cada
 * bloque.
 *
 * Ninguna fila se lee por numero fijo: se escanea desde el encabezado hasta el
 * primer hueco en la columna de etiquetas. Asi, agregar o sacar un plan entre
 * versiones no rompe nada, y las celdas de instrucciones para Word (que estan
 * mas abajo, despues del hueco) nunca se alcanzan.
 */

export const HOJA_TARIFAS = 'Tarifas Web';
export const HOJA_MOSTRADOR = 'Precios Mostrador';
export const HOJA_VIP = 'Linea VIP - Tarifas Web';
export const HOJA_INTERNACIONAL = 'Internacional';

/**
 * @param {Map<string, Map<string, any>>} libro
 * @param {string} nombre
 */
export function hoja(libro, nombre) {
	const h = libro.get(nombre);
	if (!h) throw new Error(`El Excel no tiene la pestaña "${nombre}".`);
	return h;
}

/**
 * Texto de una celda, o `null`. No recorta: la sangría es información.
 *
 * @param {Map<string, any>} h
 * @param {string} ref
 * @returns {string | null}
 */
export function texto(h, ref) {
	const v = h.get(ref);
	if (v === undefined || v === null) return null;
	const s = String(v);
	return s.trim() === '' ? null : s;
}

/**
 * Número finito de una celda, o `null`.
 *
 * @param {Map<string, any>} h
 * @param {string} ref
 * @returns {number | null}
 */
export function numero(h, ref) {
	const v = h.get(ref);
	return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * Números de fila con etiqueta, desde `desde` hasta el primer hueco.
 *
 * @param {Map<string, any>} h
 * @param {string} columna
 * @param {number} desde
 * @param {number} [tope] Corte duro, por si una hoja viniera sin huecos.
 */
export function filasConEtiqueta(h, columna, desde, tope = 10000) {
	const filas = [];
	for (let f = desde; f < desde + tope; f++) {
		if (texto(h, `${columna}${f}`) === null) break;
		filas.push(f);
	}
	return filas;
}

/**
 * @typedef {{ label: string, nivel: 0 | 1, sinImpuestos: number | null, precioFinal: number | null }} FilaTarifa
 * @typedef {{ filas: FilaTarifa[], alicuota: number | null }} TarifasWeb
 */

/**
 * Pestaña "Tarifas Web": lo que se publica en /tarifas.
 *
 * @param {Map<string, Map<string, any>>} libro
 * @returns {TarifasWeb}
 */
export function parseTarifasWeb(libro) {
	const h = hoja(libro, HOJA_TARIFAS);

	const filas = filasConEtiqueta(h, 'B', 6).map((f) => {
		const crudo = texto(h, `B${f}`) ?? '';
		return {
			// La sangria del Excel es lo unico que distingue un pack de su
			// servicio padre; se guarda como `nivel` y la etiqueta va limpia.
			label: crudo.trim(),
			nivel: /^\s/.test(crudo) ? 1 : 0,
			sinImpuestos: numero(h, `C${f}`),
			precioFinal: numero(h, `D${f}`)
		};
	});

	return { filas, alicuota: numero(h, 'D42') };
}
