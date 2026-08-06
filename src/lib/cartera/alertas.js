/**
 * Las alertas de la Cartera.
 *
 * Cuatro las deduce el sistema del snapshot del cliente (`seguimiento`,
 * `mora_1`, `mora_2`, `tickets`); la quinta, `recordatorio`, la escribio el
 * asesor a mano y entra por parametro.
 *
 * Se calculan sobre el snapshot local, sin red: por eso la lista es instantanea
 * y sigue funcionando con IspCube caido. La contracara es que una alerta de
 * mora es tan fresca como el snapshot, y de eso se encarga el store.
 *
 * Este es el modulo que mas va a cambiar con el uso. Esta aislado a proposito.
 */
import {
	partesFecha,
	partesFechaHora,
	claveMes,
	sumarMeses,
	compararFechas,
	compararFechaHora,
	diferenciaDias
} from './fechas.js';
import { primerMesFacturable } from './pagos.js';

/** Meses desde la instalacion hasta el llamado de seguimiento. */
const MESES_SEGUIMIENTO = 2;

/** Dias de aviso antes del vencimiento de una promo. */
const DIAS_AVISO_PROMO = 15;

/**
 * @typedef {object} ConfigCartera
 * @property {number} dia_corte_1
 * @property {number} dia_corte_2
 * @property {number} dia_corte_tarjeta
 */

/**
 * Ultimo dia de la ventana de pago segun el medio de pago del cliente.
 *
 * @param {string} perfil
 * @param {ConfigCartera} config
 * @returns {number}
 */
export function diaCorteDe(perfil, config) {
	return perfil === 'tarjeta' ? config.dia_corte_tarjeta : config.dia_corte_1;
}

/**
 * Promos activas: `fin` todavia no paso. El arranque futuro cuenta como
 * activa igual — algunas promos se cargan con `promotion_start_date` del mes
 * que viene desde el dia de la instalacion.
 *
 * Toma el array de promos directo (`cliente.promos`), no el cliente entero:
 * mismo criterio que esta funcion recibe `recordatorios` como array.
 *
 * @param {any[]} promos
 * @param {import('./fechas.js').Partes} hoy
 * @returns {any[]} Ordenadas por `fin` ascendente
 */
export function promosActivas(promos, hoy) {
	return (Array.isArray(promos) ? promos : [])
		.map((p) => ({ p, fin: partesFecha(p?.fin) }))
		.filter(({ fin }) => fin && compararFechas(hoy, fin) <= 0)
		.sort((a, b) => compararFechas(a.fin, b.fin))
		.map(({ p }) => p);
}

/**
 * El recordatorio pendiente que toca mirar primero, este vencido o no.
 *
 * A diferencia de la alerta `recordatorio` de `alertasDe` -que nace SOLO
 * cuando la fecha ya paso-, esta tambien devuelve los futuros: la fila de la
 * lista dibuja el chip con su fecha y un semaforo, para que el asesor vea
 * "llamar el 12" el dia 10 y no recien el 12.
 *
 * Que sea una funcion aparte y no un cambio en `alertasDe` es deliberado: un
 * recordatorio futuro NO es una alerta. Si entrara por `alertasDe` prenderia
 * el borde de urgencia y el filtro "Con alerta" para un cliente al que no hay
 * que hacerle nada hoy.
 *
 * Orden ascendente por fecha, mismo criterio que `alertasDe`: si hay vencidos
 * gana el mas viejo (un pendiente viejo es mas urgente, no menos); si no los
 * hay, gana el futuro mas cercano. Uno solo y no todos: la fila no gana nada
 * con N chips iguales, y el detalle ya los muestra completos.
 *
 * @param {any[]} recordatorios Recordatorios PENDIENTES (`hecho = false`)
 * @param {import('./fechas.js').Partes} hoy
 * @returns {{recordatorio: any, dias: number, estado: 'vencido' | 'hoy' | 'proximo'} | null}
 */
export function proximoRecordatorio(recordatorios, hoy) {
	const pendientes = (Array.isArray(recordatorios) ? recordatorios : [])
		.map((r) => ({ r, partes: partesFecha(r?.fecha) }))
		.filter(({ partes }) => partes !== null)
		// El .sort() cae sobre el array intermedio del .map, nunca sobre el que
		// entro por parametro.
		.sort((a, b) => compararFechas(a.partes, b.partes));

	if (pendientes.length === 0) return null;

	const { r, partes } = pendientes[0];
	const dias = diferenciaDias(hoy, partes);

	return {
		recordatorio: r,
		dias,
		estado: dias < 0 ? 'vencido' : dias === 0 ? 'hoy' : 'proximo'
	};
}

/**
 * Alertas activas de un cliente.
 *
 * Toma SOLO el registro del cliente, sin las notas: la lista muestra hasta 500
 * clientes y pedir las notas de cada uno para saber si alguien ya llamo seria
 * una consulta por fila. En su lugar, `cartera_notas` sigue siendo la bitacora
 * completa y `cliente.ultimo_contacto` es la marca que escribe el store cuando
 * el asesor aprieta «Marcar contactado».
 *
 * @param {any} cliente Registro de `cartera_clientes`
 * @param {import('./fechas.js').Partes} hoy
 * @param {ConfigCartera} config
 * @param {any[]} [recordatorios] Recordatorios PENDIENTES del cliente (`hecho = false`)
 * @param {any[]} [promos] `cliente.promos`, sin filtrar por vigencia
 * @returns {{tipo: string, desde: string | null, texto?: string}[]}
 */
export function alertasDe(cliente, hoy, config, recordatorios = [], promos = []) {
	const alertas = [];

	const instalacion = partesFecha(cliente?.fecha_instalacion);
	const perfil = cliente?.perfil_pago === 'tarjeta' ? 'tarjeta' : 'ventanilla';

	// --- Seguimiento a los 2 meses -----------------------------------------
	if (instalacion) {
		const vence = sumarMeses(instalacion, MESES_SEGUIMIENTO);
		const contacto = partesFecha(cliente?.ultimo_contacto);
		// Un contacto anterior a la instalacion no cuenta: es de una etapa previa
		// (la venta), no del seguimiento post-instalacion.
		const yaContactado = contacto && compararFechas(contacto, instalacion) >= 0;

		if (compararFechas(hoy, vence) >= 0 && !yaContactado) {
			alertas.push({ tipo: 'seguimiento', desde: claveMes(vence) });
		}
	}

	// --- Mora ---------------------------------------------------------------
	const mesActual = claveMes(hoy);
	const pagoDelMes = (Array.isArray(cliente?.pagos) ? cliente.pagos : []).some(
		(p) => p?.mes === mesActual
	);
	// `duedebt` es la deuda vencida que informa IspCube (GET /api/customer),
	// ya convertida a numero por normalizarCliente. Corrobora al recibo: un
	// cliente que pago $100 el 5 y debe $30000 desde el 25 tiene "un pago este
	// mes" pero IspCube sigue diciendo que debe, y la mora tiene que verlo.
	const duedebt = Number(cliente?.duedebt) || 0;

	// Al cliente se le factura recien desde `primerMesFacturable`: el mes de la
	// instalacion no cuenta (salvo que se haya instalado el dia 1) y una
	// instalacion FUTURA (fecha mal cargada o alta programada) tampoco puede
	// estar en mora, porque su primer mes queda todavia mas adelante.
	const primerMes = primerMesFacturable(instalacion);
	const recienInstalado = primerMes && mesActual < primerMes;

	// Deliberadamente asimetrico con los puntos de pago (`puntosPorMes`): ahi
	// el punto sigue reflejando cuando llego el primer recibo del mes, sin
	// mirar duedebt, porque es historial de comportamiento, no un estado de
	// cuenta. Que no se "corrija" para que combine con esto.
	if (!recienInstalado && (!pagoDelMes || duedebt > 0)) {
		const corte1 = diaCorteDe(perfil, config);
		if (hoy.dia > corte1) {
			alertas.push({ tipo: 'mora_1', desde: mesActual });
		}
		// El segundo corte es solo para ventanilla: en tarjeta el dia 21 es el
		// unico hito.
		if (perfil === 'ventanilla' && hoy.dia > config.dia_corte_2) {
			alertas.push({ tipo: 'mora_2', desde: mesActual });
		}
	}

	// --- Tickets nuevos ------------------------------------------------------
	// Con granularidad de dia (compararFechas) un ticket abierto el mismo dia
	// en que el asesor marco "visto" nunca alertaba: tickets_vistos_hasta se
	// escribe apenas el asesor abre al cliente, y un ticket nuevo esa misma
	// tarde es el caso comun, no el borde. Por eso aca se compara con hora.
	const ultimo = partesFechaHora(cliente?.tickets?.ultimo?.fecha);
	if (ultimo) {
		const visto = partesFechaHora(cliente?.tickets_vistos_hasta);
		// Sin marca de visto, cualquier ticket es nuevo: el asesor nunca miro.
		if (!visto || compararFechaHora(ultimo, visto) > 0) {
			alertas.push({ tipo: 'tickets', desde: cliente.tickets.ultimo.fecha });
		}
	}

	// --- Recordatorios --------------------------------------------------------
	// Una sola alerta aunque haya varios vencidos: la lista de la Cartera no gana
	// nada con N chips iguales en la misma fila, y el detalle los muestra todos.
	// Un recordatorio vencido NO se apaga con el paso del tiempo: sigue encendido
	// hasta que alguien lo marque hecho, porque un pendiente viejo es mas
	// urgente, no menos.
	const vencidos = (Array.isArray(recordatorios) ? recordatorios : [])
		.map((r) => ({ r, partes: partesFecha(r?.fecha) }))
		.filter(({ partes }) => partes && compararFechas(hoy, partes) >= 0)
		.sort((a, b) => compararFechas(a.partes, b.partes));

	if (vencidos.length > 0) {
		const primero = vencidos[0].r;
		alertas.push({ tipo: 'recordatorio', desde: primero.fecha, texto: primero.texto });
	}

	// --- Promo por vencer ----------------------------------------------------
	// Una sola alerta con la de vencimiento mas proximo, igual que recordatorio.
	// `promosActivas` es informativa y la usa la UI directo (chip de la lista,
	// seccion del detalle); acá solo se usa para derivar esta alerta puntual.
	const activas = promosActivas(promos, hoy);
	if (activas.length > 0) {
		const proxima = activas[0];
		const fin = partesFecha(proxima.fin);
		if (fin && diferenciaDias(hoy, fin) <= DIAS_AVISO_PROMO) {
			alertas.push({ tipo: 'promo_venciendo', desde: proxima.fin, texto: proxima.promo_nombre });
		}
	}

	// --- Reserva de NAP ------------------------------------------------------
	// Solo se evalua habilitado: sin conexion activa, no tener el ticket
	// todavia es lo esperable (el proceso de instalacion ni arranco), no una
	// anomalia. Mutuamente excluyentes: sin ticket no hay ticket anulado que
	// mostrar.
	if (Array.isArray(cliente?.connections) && cliente.connections.length > 0) {
		if (!cliente?.alta_nap?.existe) {
			alertas.push({ tipo: 'nap_faltante', desde: null });
		} else if (cliente.alta_nap.anulado) {
			alertas.push({ tipo: 'nap_anulado', desde: null });
		}
	}

	return alertas;
}
