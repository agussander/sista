/**
 * IspCube devuelve `name` en mayusculas y en un solo campo
 * ("TALONE SANDRA ELIZABETH"), sin separar nombre de apellido.
 *
 * Se muestra capitalizado para que la pantalla sea legible, pero NO se intenta
 * partir el nombre: la heuristica "la primera palabra es el apellido" falla con
 * los apellidos compuestos ("DE LA TORRE JUAN") y con las razones sociales de
 * los clientes empresa. Mostrar el nombre completo tal como lo tiene el ISP
 * ademas sirve mejor al proposito de la pantalla: que el comercio confirme que
 * escaneo al cliente correcto.
 */

/**
 * @param {unknown} value Valor del campo `name` de IspCube
 * @returns {string} El nombre con la inicial de cada palabra en mayuscula
 */
export function toTitleCase(value) {
	if (typeof value !== 'string') return '';

	return value
		.trim()
		.split(/\s+/)
		.filter((word) => word !== '')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(' ');
}
