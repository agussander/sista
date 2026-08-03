/**
 * Validacion y normalizacion de `cartera_config`.
 *
 * Vive separado del store para poder testearlo sin PocketBase. Un dia de
 * corte invalido no puede colarse silencioso: `alertas.js` lo usa tal cual
 * llega (`hoy.dia > corte1`), y un corte en 0 hace que esa comparacion sea
 * verdadera TODOS los dias del mes, para TODOS los clientes de la cartera.
 */

/** @type {{entidades_tarjeta: number[], areas_soporte: number[], estados_cerrados: number[], dia_corte_1: number, dia_corte_2: number, dia_corte_tarjeta: number}} */
export const CONFIG_DEFAULT = Object.freeze({
	entidades_tarjeta: [],
	areas_soporte: [],
	estados_cerrados: [],
	dia_corte_1: 10,
	dia_corte_2: 20,
	dia_corte_tarjeta: 21
});

/**
 * Si `v` es un dia de corte valido: entero entre 1 y 31.
 *
 * `Number.isInteger` descarta `NaN`, strings, `undefined` y decimales de
 * una sola pasada, sin necesitar un `??` que trate `0` como "sin dato" (no
 * lo es: es un numero invalido para un dia del mes, pero un numero al fin,
 * y `0 ?? 10` da `0`, no `10`).
 *
 * @param {unknown} v
 * @returns {boolean}
 */
export function diaCorteValido(v) {
	return Number.isInteger(v) && v >= 1 && v <= 31;
}

/**
 * Un dia de corte crudo (puede venir como string, `NaN`, `0`, `undefined`,
 * fuera de rango...) al numero validado, o `porDefecto` si no vale.
 *
 * @param {unknown} v
 * @param {number} porDefecto
 * @returns {number}
 */
export function diaCorteONormal(v, porDefecto) {
	const n = Number(v);
	return diaCorteValido(n) ? n : porDefecto;
}

/**
 * Normaliza un registro crudo de `cartera_config` (lo que devuelve
 * PocketBase, o `undefined`/`null` si todavia no existe) contra los
 * defaults. Los tres dias de corte pasan por `diaCorteONormal`; el resto de
 * los campos se toma tal cual si esta presente.
 *
 * Es lo que hace que un registro roto (creado a mano en PocketBase con los
 * campos numericos vacios, o un `dia_corte_1: 0` que quedo de un guardado
 * viejo sin la validacion de `CarteraConfig.svelte`) no vuelva a colarse: el
 * store llama a esto en cada carga de config, asi que un dato invalido que
 * ya este guardado se corrige en lectura, no solo en el formulario que lo
 * escribe.
 *
 * @param {any} raw
 * @returns {typeof CONFIG_DEFAULT}
 */
export function normalizarConfig(raw) {
	return {
		...CONFIG_DEFAULT,
		...raw,
		dia_corte_1: diaCorteONormal(raw?.dia_corte_1, CONFIG_DEFAULT.dia_corte_1),
		dia_corte_2: diaCorteONormal(raw?.dia_corte_2, CONFIG_DEFAULT.dia_corte_2),
		dia_corte_tarjeta: diaCorteONormal(raw?.dia_corte_tarjeta, CONFIG_DEFAULT.dia_corte_tarjeta)
	};
}
