/**
 * Coerciona listas de ids (areas de soporte, estados cerrados) a numeros,
 * descartando lo que no lo sea. Compartido por el query string de
 * `cliente/[code]` (que llega como `"6,9"`) y por el body JSON de `sync`
 * (que llega como array).
 *
 * `Number(x)` puede lanzar `TypeError` en vez de devolver `NaN`: pasa cuando
 * `x` es un objeto sin `toString` ni `valueOf` invocables, algo que
 * `JSON.parse` puede producir sin trucos raros -basta con
 * `{"toString": 1, "valueOf": 2}"`, porque esas propiedades tapan a las del
 * prototipo. Un id de mas o de menos no cambia el resultado del filtro (un
 * area que no matchea ningun ticket no hace nada), asi que un id hostil se
 * descarta en vez de tirar abajo el pedido entero.
 */

/**
 * @param {unknown[]} valores
 * @returns {number[]}
 */
export function idsFinitos(valores) {
	const salida = [];
	for (const v of valores) {
		let n;
		try {
			n = Number(v);
		} catch {
			continue;
		}
		if (Number.isFinite(n)) salida.push(n);
	}
	return salida;
}

/**
 * `"6,9"` -> `[6, 9]`. Una lista vacia significa "sin filtro".
 *
 * @param {string | null} valor
 * @returns {number[]}
 */
export function parseIds(valor) {
	if (!valor) return [];
	return idsFinitos(valor.split(',').map((v) => v.trim()));
}
