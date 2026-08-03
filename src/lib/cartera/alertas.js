/**
 * Las cuatro alertas de la Cartera.
 *
 * Se calculan sobre el snapshot local, sin red: por eso la lista es instantanea
 * y sigue funcionando con IspCube caido. La contracara es que una alerta de
 * mora es tan fresca como el snapshot, y de eso se encarga el store.
 *
 * Este es el modulo que mas va a cambiar con el uso. Esta aislado a proposito.
 */
import { partesFecha, claveMes, sumarMeses, compararFechas } from './fechas.js';

/** Meses desde la instalacion hasta el llamado de seguimiento. */
const MESES_SEGUIMIENTO = 2;

/**
 * Tipos de nota que cuentan como contacto con el cliente. `nota` queda afuera
 * a proposito: sirve para dejar contexto sin cerrar el pendiente.
 */
export const TIPOS_CONTACTO = ['llamada', 'whatsapp', 'visita'];

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
 * Alertas activas de un cliente.
 *
 * Toma SOLO el registro del cliente, sin las notas: la lista muestra hasta 500
 * clientes y pedir las notas de cada uno para saber si alguien ya llamo seria
 * una consulta por fila. En su lugar, `cartera_notas` sigue siendo la bitacora
 * completa y `cliente.ultimo_contacto` es la marca desnormalizada que mantiene
 * el store cada vez que se guarda una nota de tipo contacto.
 *
 * @param {any} cliente Registro de `cartera_clientes`
 * @param {import('./fechas.js').Partes} hoy
 * @param {ConfigCartera} config
 * @returns {{tipo: string, desde: string | null}[]}
 */
export function alertasDe(cliente, hoy, config) {
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

	// El mes de la instalacion no cuenta: todavia no le facturaron nada.
	const recienInstalado = instalacion && claveMes(instalacion) === mesActual;

	if (!pagoDelMes && !recienInstalado) {
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
	const ultimo = partesFecha(cliente?.tickets?.ultimo?.fecha);
	if (ultimo) {
		const visto = partesFecha(cliente?.tickets_vistos_hasta);
		// Sin marca de visto, cualquier ticket es nuevo: el asesor nunca miro.
		if (!visto || compararFechas(ultimo, visto) > 0) {
			alertas.push({ tipo: 'tickets', desde: cliente.tickets.ultimo.fecha });
		}
	}

	return alertas;
}
