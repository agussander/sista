/**
 * Que clientes vale la pena refrescar al abrir la lista.
 *
 * La API de IspCube se factura por request, asi que abrir el panel no puede
 * costar "lo que haya en la cartera". Pero un snapshot viejo muestra moras
 * falsas: si el snapshot es del dia 5 y hoy es 12, la Cartera no sabe que el
 * cliente pago el 8.
 *
 * El equilibrio: refrescar solo lo vencido, con un tope duro, priorizando a
 * quienes acaban de pasar su dia de corte -que son justo los que podrian estar
 * mostrando una mora que no existe-.
 */
import { diaCorteDe } from './alertas.js';

/** Un snapshot mas nuevo que esto se considera fresco. */
const FRESCO_MS = 12 * 60 * 60 * 1000;

/**
 * Tope de clientes a refrescar por apertura. Es el techo del gasto.
 *
 * Tiene que coincidir con `MAX_CODIGOS` de `/api/cartera/sync`: si este valor
 * sube y ese no (o viceversa), `sincronizar` termina mandando mas codigos de
 * los que el endpoint acepta y la llamada vuelve entera con `demasiados_codigos`.
 */
const MAX_POR_APERTURA = 20;

/** Cuantos dias despues del corte un cliente sigue siendo prioritario. */
const DIAS_DE_RIESGO = 3;

/**
 * @param {any[]} clientes Registros de `cartera_clientes`
 * @param {{ahora: number, hoy: import('./fechas.js').Partes, config: import('./alertas.js').ConfigCartera}} opciones
 * @returns {string[]} Codigos a refrescar, en orden de prioridad
 */
export function aRefrescar(clientes, { ahora, hoy, config }) {
	const candidatos = [];

	for (const c of Array.isArray(clientes) ? clientes : []) {
		if (!c || c.archivado) continue;

		const ultima = c.sincronizado ? Date.parse(c.sincronizado) : NaN;
		const edad = Number.isFinite(ultima) ? ahora - ultima : Infinity;
		if (edad < FRESCO_MS) continue;

		const corte = diaCorteDe(c.perfil_pago, config);
		const desdeCorte = hoy.dia - corte;
		const enRiesgo = desdeCorte > 0 && desdeCorte <= DIAS_DE_RIESGO;

		candidatos.push({ code: c.code, edad, enRiesgo });
	}

	candidatos.sort((a, b) => {
		if (a.enRiesgo !== b.enRiesgo) return a.enRiesgo ? -1 : 1;
		return b.edad - a.edad;
	});

	return candidatos.slice(0, MAX_POR_APERTURA).map((c) => c.code);
}
