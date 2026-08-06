/**
 * Estado de instalacion de un cliente de la Cartera.
 *
 * No se guarda como campo propio: se deriva de dos campos que si vive en el
 * snapshot, `connections` y `alta_nap` (ver `resumenAltaNap` en
 * `normalizar.js`). Modulo aparte de `alertas.js` porque no es una alerta
 * -no suma a la urgencia de la fila- sino un estado informativo, mismo
 * criterio que separo `relativo.js` de `alertas.js`.
 */

/**
 * @param {{
 *   connections?: unknown[],
 *   alta_nap?: {existe: boolean, cerrado: boolean, anulado: boolean} | null
 * }} cliente
 * @returns {'pendiente_pago' | 'instalacion_pendiente' | 'instalado'}
 */
export function estadoInstalacionDe(cliente) {
	const conexiones = Array.isArray(cliente?.connections) ? cliente.connections : [];
	// Sin conexion activa no importa que diga el ticket: no hay nada mas que
	// mirar todavia. `pendiente_pago` porque en la practica la conexion se
	// habilita cuando se acredita el primer pago.
	if (conexiones.length === 0) return 'pendiente_pago';

	return cliente?.alta_nap?.cerrado ? 'instalado' : 'instalacion_pendiente';
}
