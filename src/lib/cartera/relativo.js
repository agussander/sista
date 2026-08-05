/**
 * Cuanto hace que paso un instante, en la unidad mas grande que todavia se
 * lee bien.
 *
 * Vive aparte de `fechas.js` a proposito. Ese modulo tiene PROHIBIDO construir
 * un `Date` a partir de un string, porque las fechas de IspCube no documentan
 * su zona horaria y `new Date(str)` corre el dia. Aca la entrada es
 * `sincronizado`, que lo escribe el propio navegador con `toISOString()` (UTC,
 * con sufijo `Z`), asi que `Date.parse` es exacto. Son dos contratos distintos
 * y no conviene que compartan archivo.
 */

/**
 * @param {unknown} iso Instante ISO 8601 escrito por nosotros, o vacio
 * @param {number} ahora Milisegundos desde epoch (`Date.now()`)
 * @returns {string}
 */
export function desdeCuando(iso, ahora) {
	if (typeof iso !== 'string' || iso === '') return 'nunca';

	const ms = ahora - Date.parse(iso);
	// `Date.parse` de algo que no es una fecha da NaN, y NaN se propaga a `ms`.
	if (!Number.isFinite(ms)) return 'nunca';

	// Un `ms` negativo es el reloj del servidor adelantado respecto del
	// navegador, no un error: cae solo en "recien", que es lo que corresponde,
	// en vez de mostrar "hace -3 min".
	const minutos = Math.floor(ms / 60_000);
	if (minutos < 1) return 'recién';
	if (minutos < 60) return `hace ${minutos} min`;

	const horas = Math.floor(minutos / 60);
	if (horas < 24) return `hace ${horas} h`;

	return `hace ${Math.floor(horas / 24)} d`;
}
