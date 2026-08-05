/**
 * Traduce el nombre crudo de una conexion (`plan.name` de IspCube) al
 * lenguaje que usan los asesores, y la categoriza para el color del chip.
 *
 * IspCube no tiene endpoint de catalogo de planes: los nombres cortos salen
 * de reglas de texto armadas a mano contra los nombres reales que devuelve
 * la API, no de un diccionario por id.
 */

const PLANES_INTERNET = ['HOME', 'FAST', 'POWER', 'GAMER', 'WORKER', 'MAX'];

const RE_INTERNET = new RegExp(
	`servicio de internet b[aá]sico\\s+(${PLANES_INTERNET.join('|')})\\b`,
	'i'
);
const RE_PACK_FUTBOL = /pack\s*f[uú]tbol/i;
const RE_TV_GIGARED = /servicio\s*tv\s*b[aá]sico\s*gigared/i;
const RE_TV_OTT = /servicio\s*tv\s*b[aá]sico\s*ott/i;
// A diferencia de Gigared/OTT, los planes DGO no dicen "servicio tv basico":
// arrancan directo con "DGO " (confirmado contra el catalogo real de
// IspCube, `GET /api/plans/plans_list`: "DGO Lite", "DGO Plus", "DGO Full",
// etc.).
const RE_DGO = /^dgo\b/i;
const RE_TELEFONIA = /telefonia/i;

/**
 * @param {string} texto
 * @returns {string}
 */
function capitalizar(texto) {
	return texto[0].toUpperCase() + texto.slice(1).toLowerCase();
}

/**
 * @param {string|null|undefined} nombreCompleto nombre crudo que devuelve IspCube
 * @returns {{etiqueta: string, categoria: 'internet'|'tv'|'telefonia'|'otro'}}
 */
export function describirConexion(nombreCompleto) {
	const n = typeof nombreCompleto === 'string' ? nombreCompleto : '';

	const internet = n.match(RE_INTERNET);
	if (internet) return { etiqueta: capitalizar(internet[1]), categoria: 'internet' };

	if (RE_PACK_FUTBOL.test(n)) return { etiqueta: 'Pack fútbol', categoria: 'tv' };
	if (RE_TV_GIGARED.test(n)) return { etiqueta: 'Gigared', categoria: 'tv' };
	if (RE_TV_OTT.test(n)) return { etiqueta: 'Antina', categoria: 'tv' };
	if (RE_DGO.test(n)) return { etiqueta: 'DGO', categoria: 'tv' };

	if (RE_TELEFONIA.test(n)) return { etiqueta: 'Telefonía', categoria: 'telefonia' };

	return { etiqueta: n, categoria: 'otro' };
}
