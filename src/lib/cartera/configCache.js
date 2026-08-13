/**
 * Cache de `cartera_config` en el sessionStorage del navegador.
 *
 * La config se leia en cada apertura de la Cartera: un request a PocketBase
 * para traer algo que no cambia. Los dias de corte son los que son.
 *
 * Sin TTL a proposito. La invalidacion es explicita, desde la pantalla que la
 * edita. El hueco conocido: si un asesor guarda un cambio, otro asesor que ya
 * tenga la Cartera abierta sigue viendo la config vieja hasta que recargue.
 * Como la config no cambia, ese hueco no se paga casi nunca; si algun dia
 * empieza a cambiar seguido, la respuesta es ponerle un TTL corto, no
 * invalidacion cruzada.
 *
 * Todo degrada a "no hay cache" ante cualquier problema: sin `sessionStorage`
 * (SSR, o Safari en modo privado, donde tocarlo tira), o con un JSON roto de
 * una version anterior. El costo de degradar es un request; el costo de
 * propagar la excepcion seria que `cargarConfig` caiga en su catch y la
 * Cartera trabaje con los dias de corte por defecto, mostrando alertas de mora
 * equivocadas.
 */

const CLAVE = 'cartera_config_v1';

/**
 * El `sessionStorage` del navegador, o `null` si no hay.
 *
 * @returns {Storage | null}
 */
export function almacenDeSesion() {
	try {
		return typeof sessionStorage === 'undefined' ? null : sessionStorage;
	} catch {
		return null;
	}
}

/**
 * @param {Storage | null} almacen
 * @returns {any | null} La config cacheada, o `null` si no hay o no sirve
 */
export function leerConfigCache(almacen) {
	if (!almacen) return null;
	try {
		const crudo = almacen.getItem(CLAVE);
		return crudo ? JSON.parse(crudo) : null;
	} catch {
		return null;
	}
}

/**
 * @param {Storage | null} almacen
 * @param {any} config
 */
export function guardarConfigCache(almacen, config) {
	if (!almacen) return;
	try {
		almacen.setItem(CLAVE, JSON.stringify(config));
	} catch {
		// Sin cache se sigue funcionando: es solo un request de mas.
	}
}

/** @param {Storage | null} almacen */
export function olvidarConfigCache(almacen) {
	if (!almacen) return;
	try {
		almacen.removeItem(CLAVE);
	} catch {
		// Idem: si no se puede borrar es porque tampoco se pudo guardar.
	}
}
