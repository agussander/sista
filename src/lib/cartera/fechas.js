/**
 * Fechas de IspCube, parseadas como texto.
 *
 * La API devuelve dos formatos: `"2022-07-15 03:20:21"` y
 * `"2022-07-15T03:20:21.000000Z"`. Pasarlos por `new Date()` y leer
 * `getDate()` CORRE EL DIA segun la zona horaria del proceso: en Argentina
 * (UTC-3), `new Date("2022-07-15T01:00:00.000000Z").getDate()` devuelve 14.
 *
 * Un pago del dia 10 leido como del 9 mueve un punto de verde a amarillo y
 * puede disparar una alerta de mora falsa. Por eso nada de este modulo
 * construye un `Date` a partir de los strings de la API.
 */

/**
 * @typedef {{anio: number, mes: number, dia: number}} Partes
 */

/** Dias de cada mes; febrero se corrige aparte. */
const DIAS_POR_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** @param {number} anio */
function esBisiesto(anio) {
	return (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
}

/**
 * @param {number} anio
 * @param {number} mes 1-12
 */
export function diasDelMes(anio, mes) {
	if (mes === 2 && esBisiesto(anio)) return 29;
	return DIAS_POR_MES[mes - 1];
}

/**
 * Extrae anio, mes y dia de una fecha de IspCube.
 *
 * @param {unknown} valor
 * @returns {Partes | null} `null` si no tiene forma de fecha
 */
export function partesFecha(valor) {
	if (typeof valor !== 'string') return null;
	const m = valor.match(/^(\d{4})-(\d{2})-(\d{2})/);
	if (!m) return null;
	return { anio: Number(m[1]), mes: Number(m[2]), dia: Number(m[3]) };
}

/**
 * Clave de mes, `"2026-03"`. Es la que agrupa los pagos del snapshot.
 *
 * @param {Partes | null} partes
 * @returns {string | null}
 */
export function claveMes(partes) {
	if (!partes) return null;
	return `${partes.anio}-${String(partes.mes).padStart(2, '0')}`;
}

/**
 * Suma meses recortando el dia si el mes destino es mas corto: el 31 de enero
 * mas un mes es el 28 (o 29) de febrero, no el 3 de marzo.
 *
 * @param {Partes} partes
 * @param {number} n
 * @returns {Partes}
 */
export function sumarMeses(partes, n) {
	const total = partes.anio * 12 + (partes.mes - 1) + n;
	const anio = Math.floor(total / 12);
	const mes = (total % 12) + 1;
	return { anio, mes, dia: Math.min(partes.dia, diasDelMes(anio, mes)) };
}

/**
 * Las `cantidad` claves de mes que terminan en el mes de `hasta`, de la mas
 * vieja a la mas nueva.
 *
 * @param {Partes} hasta
 * @param {number} cantidad
 * @returns {string[]}
 */
export function mesesEntre(hasta, cantidad) {
	const claves = [];
	for (let i = cantidad - 1; i >= 0; i--) {
		claves.push(claveMes(sumarMeses(hasta, -i)));
	}
	return claves;
}

/**
 * Compara dos fechas por sus partes. Devuelve <0, 0 o >0.
 *
 * @param {Partes} a
 * @param {Partes} b
 */
export function compararFechas(a, b) {
	if (a.anio !== b.anio) return a.anio - b.anio;
	if (a.mes !== b.mes) return a.mes - b.mes;
	return a.dia - b.dia;
}
