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
 * Mensaje para el visitante a partir del error crudo de PocketBase.
 *
 * PocketBase contesta en ingles y contando de mas ("Only superusers can perform
 * this action"): eso no puede terminar impreso en /tarifas. Aca se traduce a
 * algo que le sirva a quien esta mirando la pagina, y el error original queda
 * en la consola para quien la este arreglando.
 *
 * @param {unknown} error
 * @returns {string}
 */
export function mensajeDeError(error) {
	// getFirstListItem tira 404 cuando la coleccion existe pero no hay registro.
	const status = /** @type {{status?: unknown}} */ (error)?.status;
	if (status === 404) return 'Todavía no hay un tarifario publicado.';
	return 'No pudimos cargar el tarifario. Probá de nuevo en un rato.';
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
