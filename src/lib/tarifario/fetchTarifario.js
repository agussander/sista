/**
 * Lectura del tarifario vigente desde PocketBase.
 *
 * Reemplaza a `$lib/telefonia/fetchLineaVip.js` y `fetchInternacional.js`, que
 * se bajaban las paginas de Word de sista.com.ar y las desarmaban con regex.
 *
 * Unico modulo de `tarifario/` que sabe de la base: el parseo y el mapeo son
 * funciones puras y se testean sin red.
 */
import { pb } from '$lib/pocketbase';

/** @typedef {import('./parseTarifario.js').TarifasWeb} TarifasWeb */
/** @typedef {import('./parseTarifario.js').LineaVip} LineaVip */
/** @typedef {import('./parseTarifario.js').Internacional} Internacional */

/**
 * @typedef {{
 *   id: string, version: string, vigencia: string,
 *   tarifasWeb: TarifasWeb, lineaVip: LineaVip, internacional: Internacional
 * }} TarifarioPublicado
 */

/**
 * Los campos json de PocketBase vuelven como objeto, pero si la coleccion los
 * declara como texto vuelven como string. Se acepta cualquiera de las dos.
 *
 * @param {unknown} valor
 * @param {unknown} porDefecto
 */
function json(valor, porDefecto) {
	if (valor === null || valor === undefined || valor === '') return porDefecto;
	if (typeof valor !== 'string') return valor;
	try {
		return JSON.parse(valor);
	} catch {
		return porDefecto;
	}
}

/**
 * Tarifario vigente.
 *
 * @param {{ requestKey?: string | null }} [opciones] `requestKey: null` evita la
 *   auto-cancelacion cuando dos componentes de la misma pagina lo piden a la vez.
 * @returns {Promise<TarifarioPublicado>}
 */
export async function fetchTarifario({ requestKey } = {}) {
	const record = await pb
		.collection('tarifario')
		.getFirstListItem('', requestKey === undefined ? {} : { requestKey });

	return {
		id: record.id,
		version: record.version ?? '',
		vigencia: record.vigencia ?? '',
		tarifasWeb: json(record.tarifas_web, { filas: [], alicuota: null }),
		lineaVip: json(record.linea_vip, { vigencia: null, planes: [], aparato: null, notas: [] }),
		internacional: json(record.internacional, { vigencia: null, unidad: 'U$S', destinos: [] })
	};
}
