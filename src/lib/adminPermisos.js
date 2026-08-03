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
