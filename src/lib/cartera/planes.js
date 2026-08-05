/**
 * Nombres cortos para los planes mas comunes, por `plan_id` de IspCube.
 *
 * Arranca vacio; se completa con el tiempo a medida que aparecen planes
 * nuevos en produccion. Vive en codigo, sin UI de administracion: lo
 * mantiene quien toca codigo.
 *
 * @type {Record<number, string>}
 */
export const NOMBRES_PLAN = {
	// 27: 'Power',
};

/**
 * @param {number|string|null} planId
 * @param {string} nombreCompleto
 * @returns {string}
 */
export function nombreCortoPlan(planId, nombreCompleto) {
	return NOMBRES_PLAN[planId] ?? nombreCompleto;
}
