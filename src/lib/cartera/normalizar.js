/**
 * De las respuestas crudas de IspCube a la forma que guarda `cartera_clientes`.
 *
 * El cliente de IspCube trae ~80 campos; el snapshot guarda ocho. Esta capa
 * existe para que ni la UI ni las alertas sepan como es el JSON de la API.
 */
import { toTitleCase } from '../formatName.js';
import { partesFechaHora, compararFechaHora } from './fechas.js';

/**
 * Conexiones y promos de un cliente, extraidas de `crudo.connections`.
 *
 * Un cliente puede tener mas de una conexion (por ejemplo internet + TV), cada
 * una con su propio plan y, opcionalmente, su propia promo. Las dos listas
 * salen de un solo recorrido con un solo filtro de "conexion viva": evita que
 * `connections` y `promos` puedan desincronizarse sobre que cuenta como dada
 * de baja.
 *
 * @param {any} crudo
 * @param {Map<number, string>} [nombrePorId] Catalogo de `/api/plans/plans_list`
 *   (`getPlanCatalog`), para resolver `plan_nombre` cuando la conexion no
 *   trae `plan` anidado.
 * @returns {{
 *   connections: {plan_id: number|null, plan_nombre: string}[],
 *   promos: {conexion_id: number, plan_nombre: string, promo_nombre: string,
 *     beneficio: string, inicio: string, fin: string}[]
 * }}
 */
function conexionesDe(crudo, nombrePorId) {
	const vivas = (Array.isArray(crudo?.connections) ? crudo.connections : []).filter(
		(c) => c && !c.delete_date && !c.deleted_in_provider
	);

	// Solo las conexiones de internet (conntype "pppoe") traen `plan` anidado
	// con `name`. Las de TV/telefonia por reventa (conntype "nc") solo traen
	// `plan_id`, y sin el catalogo como respaldo el chip queda en blanco -asi
	// se detecto este caso, con una conexion de TV real (cliente 015387).
	const nombreDe = (c) =>
		(typeof c?.plan?.name === 'string' && c.plan.name) || nombrePorId?.get(c?.plan_id) || '';

	const connections = vivas.map((c) => ({
		plan_id: c?.plan_id ?? null,
		plan_nombre: nombreDe(c)
	}));

	const promos = vivas
		.filter((c) => c?.promotion_id)
		.map((c) => ({
			conexion_id: c.id,
			plan_nombre: nombreDe(c),
			promo_nombre: typeof c.promotion?.name === 'string' ? c.promotion.name : '',
			beneficio: typeof c.promotion?.bill_detail === 'string' ? c.promotion.bill_detail : '',
			inicio: typeof c.promotion_start_date === 'string' ? c.promotion_start_date.slice(0, 10) : '',
			fin: typeof c.promotion_end_date === 'string' ? c.promotion_end_date.slice(0, 10) : ''
		}))
		.filter((p) => p.promo_nombre && p.fin);

	return { connections, promos };
}

/**
 * Un cliente de `GET /api/customer`, reducido a lo que usa la Cartera.
 *
 * @param {any} crudo
 * @param {Map<number, string>} [nombrePorId] Ver `conexionesDe`.
 * @returns {{code: string, nombre: string, estado: string, start_date: string,
 *   entity_id: number | null, entity_nombre: string,
 *   doc_number: string, ciudad: string, comercial_activity: string,
 *   debt: number, duedebt: number,
 *   connections: {plan_id: number|null, plan_nombre: string}[],
 *   promos: {conexion_id: number, plan_nombre: string, promo_nombre: string,
 *     beneficio: string, inicio: string, fin: string}[]}}
 */
export function normalizarCliente(crudo, nombrePorId) {
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
		// Documento y ciudad se guardan CRUDOS, tal como los manda IspCube. El
		// documento lo interpreta `edad.js` (puede ser un DNI o un CUIL) y la
		// ciudad la muestra la lista pasada por `toTitleCase`. Normalizar aca
		// haria que el snapshot y la API dejaran de coincidir sin que quede
		// registrado donde se transformo.
		doc_number: typeof c.doc_number === 'string' ? c.doc_number : '',
		ciudad: typeof c.city?.name === 'string' ? c.city.name : '',
		// Campo de texto libre de "datos personales" en IspCube. Normalmente es
		// la actividad comercial real, pero para debito automatico con tarjeta
		// se usa como marca: ver `perfilDe`.
		comercial_activity: typeof c.comercial_activity === 'string' ? c.comercial_activity : '',
		debt: Number(c.debt) || 0,
		duedebt: Number(c.duedebt) || 0,
		...conexionesDe(c, nombrePorId)
	};
}

/**
 * Marca que usa IspCube en `comercial_activity` para debito automatico con
 * tarjeta. No es la actividad comercial real del cliente: es un valor fijo
 * que carga administracion (sondeado en el cliente 003566).
 */
const MARCA_DEBITO_AUTOMATICO = 'FACTURA EN DEBITO AUTOMATICO';

/**
 * Medio de pago del cliente.
 *
 * En IspCube no hay campo `payment_method`: el medio de pago ES la entidad de
 * cobranza (`entity_id`). Que entidades son tarjeta se configura en
 * `cartera_config`, no se adivina.
 *
 * Con la lista vacia todos caen en `ventanilla` por entidad. Es deliberado: el
 * panel funciona antes de configurarse, solo que sin distinguir tarjetas.
 *
 * Ademas de la entidad, `comercial_activity` puede marcar debito automatico
 * (`MARCA_DEBITO_AUTOMATICO`) sin que la entidad este configurada como
 * tarjeta: alcanza con cualquiera de las dos senales. Vacio no cuenta.
 *
 * @param {unknown} entityId
 * @param {unknown[]} entidadesTarjeta
 * @param {unknown} [comercialActivity]
 * @returns {'ventanilla' | 'tarjeta'}
 */
export function perfilDe(entityId, entidadesTarjeta, comercialActivity) {
	if (comercialActivity === MARCA_DEBITO_AUTOMATICO) return 'tarjeta';

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
		const partes = partesFechaHora(fecha);
		// Comparar por partes en vez de `fecha > ultimo.fecha`: si algun
		// created_at llegara con espacio en vez de "T", el string ordena mal
		// (el espacio va antes que la T) e invierte el resultado. Si `fecha`
		// no tiene forma de fecha, `partes` es null y se descarta como
		// candidato a ultimo (igual que antes, cuando una `fecha` vacia no
		// entraba).
		if (partes && (!ultimo || compararFechaHora(partes, partesFechaHora(ultimo.fecha)) > 0)) {
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

/**
 * Categoria del ticket de reserva de NAP en IspCube: "ALTA RESERVA DE NAP".
 * Sondeado en vivo el 2026-08-06 contra `GET /api/tickets/category_list`.
 * Hardcodeado a proposito -no configurable como `areas_soporte`-: el nombre
 * del proceso no va a cambiar en mucho tiempo, y si algun dia cambia, se
 * actualiza aca.
 */
const CATEGORIA_ALTA_NAP = 69;

/**
 * Categoria del ticket de instalacion por radio en IspCube: "INSTALACION DE
 * RADIO". Sondeado en vivo el 2026-08-20 contra
 * `GET /api/tickets/category_list`.
 */
const CATEGORIA_INSTALACION_RADIO = 50;

const RE_SPRINT_BANDA = /sprint\s*banda/i;

/**
 * Variantes de "Sprint Banda" que el catalogo de IspCube marca como FIBRA, no
 * radio -sondeado el 2026-08-20 contra `GET /api/plans/plans_list`-. Siguen
 * chequeando la categoria de NAP, no la de radio.
 */
const SPRINT_BANDA_FIBRA = ['SPRINT BANDA F101-(EMPRESA)', 'SPRINT BANDA F104'];

/**
 * Que categoria de ticket de instalacion hay que chequear para este cliente:
 * RADIO si alguna conexion viva es un plan "Sprint Banda" (salvo las
 * variantes de fibra de `SPRINT_BANDA_FIBRA`), NAP en cualquier otro caso.
 *
 * @param {{plan_nombre?: string}[]} connections
 * @returns {number}
 */
export function categoriaInstalacionDe(connections) {
	const esRadio = (Array.isArray(connections) ? connections : []).some((c) => {
		const nombre = typeof c?.plan_nombre === 'string' ? c.plan_nombre : '';
		if (!RE_SPRINT_BANDA.test(nombre)) return false;
		return !SPRINT_BANDA_FIBRA.some((f) => f.toUpperCase() === nombre.toUpperCase());
	});
	return esRadio ? CATEGORIA_INSTALACION_RADIO : CATEGORIA_ALTA_NAP;
}

/**
 * Estado "ANULADO" de un ticket en IspCube. Sondeado el 2026-08-06 contra
 * `GET /api/tickets/status_list`. Distinto de `estados_cerrados`
 * (`cartera_config`): un ticket anulado no es lo mismo que uno cerrado, y la
 * Cartera necesita distinguirlos para la alerta `nap_anulado`.
 */
const ESTADO_ANULADO = 8;

/**
 * Estado del ticket de "ALTA RESERVA DE NAP" mas reciente de un cliente.
 *
 * De aca sale la fecha real de instalacion (`closed_date`, NO `start_date`
 * del cliente: son fechas distintas, ver el spec del 2026-08-06) y el estado
 * de instalacion derivado (`estadoInstalacionDe` en `instalacion.js`).
 *
 * @param {unknown} tickets Respuesta cruda de `getTickets`
 * @param {{estadosCerrados: unknown[], categoria?: number}} opciones Misma
 *   lista que usa `resumenTickets`, mas la categoria de ticket a chequear
 *   (NAP por defecto; RADIO para conexiones Sprint Banda, ver
 *   `categoriaInstalacionDe`)
 * @returns {{existe: boolean, cerrado: boolean, anulado: boolean, closed_date: string}}
 */
export function resumenAltaNap(tickets, { estadosCerrados, categoria = CATEGORIA_ALTA_NAP }) {
	if (!Array.isArray(tickets)) {
		return { existe: false, cerrado: false, anulado: false, closed_date: '' };
	}

	const cerrados = (Array.isArray(estadosCerrados) ? estadosCerrados : []).map(String);

	/** @type {any} */
	let masReciente = null;
	for (const t of tickets) {
		if (!t || t.deleted_at) continue;
		if (t.ticket_category_id !== categoria) continue;

		const fecha = partesFechaHora(t.created_at);
		// Mismo criterio que `resumenTickets`: un ticket sin fecha legible no
		// puede convertirse en "el mas reciente" -ni siquiera como primer
		// candidato-, o un created_at corrupto queda pegado ahi para siempre
		// y ningun ticket posterior, por mas valido que sea, puede
		// desplazarlo.
		if (!fecha) continue;

		if (!masReciente || compararFechaHora(fecha, partesFechaHora(masReciente.created_at)) > 0) {
			masReciente = t;
		}
	}

	if (!masReciente) return { existe: false, cerrado: false, anulado: false, closed_date: '' };

	const cerrado = cerrados.includes(String(masReciente.ticket_status_id));

	return {
		existe: true,
		cerrado,
		anulado: masReciente.ticket_status_id === ESTADO_ANULADO,
		// Igual que `start_date` en `normalizarCliente`: se guarda la fecha
		// sola, la hora nunca es significativa aca.
		closed_date:
			cerrado && typeof masReciente.closed_date === 'string'
				? masReciente.closed_date.slice(0, 10)
				: ''
	};
}
