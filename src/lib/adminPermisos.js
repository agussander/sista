/**
 * Catalogo de permisos del panel de administracion.
 *
 * Cada valor es una seccion del panel, y son los mismos valores que ya usa
 * `Sidebar.svelte` en su campo `content` para decidir que renderiza
 * `Content.svelte` (ver ese archivo, no se toca aca): no se inventa
 * vocabulario nuevo, se declara el que ya existe para que el guardia del
 * servidor y -mas adelante- el filtro del sidebar hablen del mismo catalogo.
 *
 * `encuestas` cubre las dos entradas de encuesta de calidad del sidebar
 * (`formulario_calidad` y `formulario_calidad_2`): son una sola funcion de
 * negocio para el cliente, no dos permisos.
 *
 * Sin imports a proposito: lo usa tanto el servidor (`adminAuth.js`) como,
 * mas adelante, el navegador (el filtro del sidebar), y ninguno de los dos
 * lados debe arrastrar codigo pensado para el otro.
 */

/** @type {readonly string[]} */
export const PERMISOS = [
	'precios',
	'novedades',
	'trabajos',
	'tecnicos',
	'llamenme',
	'encuestas',
	'ruleta',
	'conectarlaciudad',
	'tolosano',
	'cartera'
];

/**
 * Si el usuario tiene el permiso `clave` cargado.
 *
 * Un usuario sin permisos cargados no tiene acceso a nada: por eso, ante
 * cualquier `permisos` que no sea un array (null, undefined, un string, un
 * objeto), el resultado es `false`. Tratar "sin permisos" como "todos los
 * permisos" reabriria el agujero que este archivo existe para cerrar.
 *
 * @param {unknown} permisos Valor crudo del campo `permisos` del record de PocketBase.
 * @param {string} clave Uno de los valores de `PERMISOS`.
 * @returns {boolean}
 */
export function tienePermiso(permisos, clave) {
	if (!Array.isArray(permisos)) return false;
	return permisos.includes(clave);
}

/**
 * Mapa de cada seccion navegable del panel (el valor `content` de
 * `Sidebar.svelte`, tambien el que termina en `selected`/`Content.svelte`) a
 * la clave de `PERMISOS` que la habilita.
 *
 * `formulario_calidad` y `formulario_calidad_2` — las dos entradas de la
 * encuesta de calidad — comparten `encuestas`: son una sola funcion de
 * negocio, no dos permisos. `sorteo-conectarlaciudad` no tiene boton propio en
 * el sidebar (se llega por la ruta real `/admin/sorteo-conectarlaciudad`) pero
 * comparte el permiso de `conectarlaciudad` porque es la misma seccion.
 *
 * @type {Readonly<Record<string, string>>}
 */
export const PERMISO_POR_SECCION = Object.freeze({
	precios: 'precios',
	novedades: 'novedades',
	trabajos: 'trabajos',
	tecnicos: 'tecnicos',
	llamenme: 'llamenme',
	formulario_calidad: 'encuestas',
	formulario_calidad_2: 'encuestas',
	ruleta: 'ruleta',
	conectarlaciudad: 'conectarlaciudad',
	'sorteo-conectarlaciudad': 'conectarlaciudad',
	tolosano: 'tolosano',
	cartera: 'cartera'
});

/**
 * Si el usuario puede ver la seccion `seccion` del panel.
 *
 * Fail closed en los dos sentidos: una seccion que no figura en
 * `PERMISO_POR_SECCION` (typo, seccion nueva sin declarar) no tiene permiso
 * asociado y por lo tanto no se muestra, en vez de mostrarse "porque no se
 * sabe que pedirle".
 *
 * Esto es conveniencia de interfaz, no seguridad: el servidor vuelve a
 * chequear el permiso en cada endpoint de `/api/cartera`, y las reglas de
 * coleccion de PocketBase rigen todo lo demas. Que esto devuelva `true` no
 * autoriza nada por si solo.
 *
 * @param {unknown} seccion
 * @param {unknown} permisos Valor crudo del campo `permisos` del record de PocketBase.
 * @returns {boolean}
 */
export function seccionPermitida(seccion, permisos) {
	if (typeof seccion !== 'string') return false;
	const clave = PERMISO_POR_SECCION[seccion];
	if (!clave) return false;
	return tienePermiso(permisos, clave);
}

/**
 * Si `seccion` es una de las claves declaradas en `PERMISO_POR_SECCION`,
 * sin mirar permisos (a diferencia de `seccionPermitida`).
 *
 * Para distinguir "la URL trae una seccion que no existe" (typo, link viejo a
 * algo que se saco) de "la seccion existe pero al usuario no le toca" — el
 * primer caso no es un problema de permisos y no deberia mostrarse como tal.
 *
 * @param {unknown} seccion
 * @returns {boolean}
 */
export function seccionExiste(seccion) {
	return typeof seccion === 'string' && seccion in PERMISO_POR_SECCION;
}
