/**
 * De las respuestas crudas de IspCube a la forma que guarda `cartera_clientes`.
 *
 * El cliente de IspCube trae ~80 campos; el snapshot guarda ocho. Esta capa
 * existe para que ni la UI ni las alertas sepan como es el JSON de la API.
 */
import { toTitleCase } from '$lib/formatName.js';

/**
 * Un cliente de `GET /api/customer`, reducido a lo que usa la Cartera.
 *
 * @param {any} crudo
 * @returns {{code: string, nombre: string, estado: string, start_date: string,
 *   entity_id: number | null, entity_nombre: string, debt: number, duedebt: number}}
 */
export function normalizarCliente(crudo) {
	const c = crudo ?? {};

	return {
		code: typeof c.code === 'string' ? c.code : '',
		nombre: typeof c.name === 'string' ? toTitleCase(c.name) : '',
		estado: typeof c.status === 'string' ? c.status : '',
		// `start_date` viene como "2026-05-01 00:00:00"; el snapshot guarda la
		// fecha sola porque la hora nunca es significativa.
		start_date: typeof c.start_date === 'string' ? c.start_date.slice(0, 10) : '',
		entity_id: c.entity_id ?? null,
		entity_nombre: typeof c.entity?.name === 'string' ? c.entity.name : '',
		debt: Number(c.debt) || 0,
		duedebt: Number(c.duedebt) || 0
	};
}

/**
 * Medio de pago del cliente.
 *
 * En IspCube no hay campo `payment_method`: el medio de pago ES la entidad de
 * cobranza (`entity_id`). Que entidades son tarjeta se configura en
 * `cartera_config`, no se adivina.
 *
 * Con la lista vacia todos caen en `ventanilla`. Es deliberado: el panel
 * funciona antes de configurarse, solo que sin distinguir tarjetas.
 *
 * @param {unknown} entityId
 * @param {unknown[]} entidadesTarjeta
 * @returns {'ventanilla' | 'tarjeta'}
 */
export function perfilDe(entityId, entidadesTarjeta) {
	if (entityId === null || entityId === undefined) return 'ventanilla';
	if (!Array.isArray(entidadesTarjeta) || entidadesTarjeta.length === 0) return 'ventanilla';

	// Los ids pueden venir como number de la API y como string de la config.
	const id = String(entityId);
	return entidadesTarjeta.some((e) => String(e) === id) ? 'tarjeta' : 'ventanilla';
}

/**
 * Resumen de los tickets de un cliente.
 *
 * @param {unknown} tickets Respuesta de `getTickets`
 * @param {{areasSoporte: unknown[], estadosCerrados: unknown[]}} opciones
 *   `areasSoporte` vacio significa "todas las areas" — el default antes de que
 *   alguien configure `cartera_config`.
 * @returns {{abiertos: number, cerrados: number, ultimo: {id: unknown, fecha: string, categoria: unknown, estado: unknown} | null}}
 */
export function resumenTickets(tickets, { areasSoporte, estadosCerrados }) {
	if (!Array.isArray(tickets)) return { abiertos: 0, cerrados: 0, ultimo: null };

	const filtraArea = Array.isArray(areasSoporte) && areasSoporte.length > 0;
	const areas = filtraArea ? areasSoporte.map(String) : [];
	const cerrados = (Array.isArray(estadosCerrados) ? estadosCerrados : []).map(String);

	let nAbiertos = 0;
	let nCerrados = 0;
	/** @type {any} */
	let ultimo = null;

	for (const t of tickets) {
		if (!t || t.deleted_at) continue;
		if (filtraArea && !areas.includes(String(t.ticket_area_id))) continue;

		if (cerrados.includes(String(t.ticket_status_id))) nCerrados++;
		else nAbiertos++;

		const fecha = typeof t.created_at === 'string' ? t.created_at : '';
		if (fecha && (!ultimo || fecha > ultimo.fecha)) {
			ultimo = {
				id: t.id,
				fecha,
				categoria: t.ticket_category_id ?? null,
				estado: t.ticket_status_id ?? null
			};
		}
	}

	return { abiertos: nAbiertos, cerrados: nCerrados, ultimo };
}
