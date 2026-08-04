/**
 * Historial de pagos de un cliente: de las cobranzas crudas de IspCube a los
 * puntos por mes que muestra la Cartera.
 *
 * Sin red y sin PocketBase: todo entra por parametro.
 */
import { partesFecha, claveMes, mesesEntre, sumarMeses } from './fechas.js';

/** Cuantos meses de historia se guardan en el snapshot. */
const MESES_HISTORICO = 12;

/**
 * @typedef {{mes: string, dia: number, monto: number}} Pago
 */

/**
 * Convierte las cobranzas de IspCube en un pago por mes.
 *
 * Usa `real_date`, no `date`: en IspCube esos campos pueden diferir por meses y
 * el que dice cuando pago de verdad es `real_date`.
 *
 * Cuando hay varias cobranzas en el mismo mes se toma **el dia del primer
 * pago** (el que define si llego en ventana) y **la suma de los montos**.
 *
 * @param {unknown} cobranzas
 * @returns {Pago[]} Ordenados por mes ascendente
 */
export function pagosDeCobranzas(cobranzas) {
	if (!Array.isArray(cobranzas)) return [];

	/** @type {Map<string, Pago>} */
	const porMes = new Map();

	for (const c of cobranzas) {
		const partes = partesFecha(c?.real_date);
		if (!partes) continue;
		const mes = claveMes(partes);
		const monto = Number(c?.total) || 0;

		const previo = porMes.get(mes);
		if (previo) {
			porMes.set(mes, {
				mes,
				dia: Math.min(previo.dia, partes.dia),
				monto: previo.monto + monto
			});
		} else {
			porMes.set(mes, { mes, dia: partes.dia, monto });
		}
	}

	return [...porMes.values()].sort((a, b) => a.mes.localeCompare(b.mes));
}

/**
 * Mezcla el historico guardado con lo que acaba de devolver la API.
 *
 * Hace falta acumular porque `cash_last_six_monts` devuelve las ultimas SEIS
 * COBRANZAS, no seis meses: un cliente que paga dos veces por mes deja apenas
 * tres meses de historia. Reemplazar en vez de fusionar iria borrando el
 * pasado en cada sincronizacion.
 *
 * @param {Pago[] | null | undefined} guardados
 * @param {Pago[]} nuevos Ganan ante un mes repetido: son los mas frescos
 * @param {import('./fechas.js').Partes} hoy
 * @returns {Pago[]} Ordenados por mes ascendente, podados a 12 meses
 */
export function fusionarPagos(guardados, nuevos, hoy) {
	/** @type {Map<string, Pago>} */
	const porMes = new Map();

	for (const p of Array.isArray(guardados) ? guardados : []) {
		if (p?.mes) porMes.set(p.mes, p);
	}
	for (const p of Array.isArray(nuevos) ? nuevos : []) {
		if (p?.mes) porMes.set(p.mes, p);
	}

	const corte = claveMes(sumarMeses(hoy, -(MESES_HISTORICO - 1)));

	return [...porMes.values()]
		.filter((p) => p.mes >= corte)
		.sort((a, b) => a.mes.localeCompare(b.mes));
}

/**
 * Primer mes que se le factura al cliente.
 *
 * Una instalacion a mitad de mes no genera una cuota mensual: lo que se cobra
 * ese mes es la instalacion o un proporcional, y el ciclo de facturacion
 * arranca el 1 del mes siguiente. La unica excepcion es instalar el dia 1: ahi
 * el mes se factura entero y ya cuenta.
 *
 * Es el corte que usan tanto los puntos (`puntosPorMes`) como la mora
 * (`alertasDe`): antes de este mes el cliente no debe nada y no se lo mide.
 *
 * @param {import('./fechas.js').Partes | null | undefined} instalacion
 * @returns {string | null} Clave de mes, o `null` sin fecha de instalacion
 */
export function primerMesFacturable(instalacion) {
	if (!instalacion) return null;
	return claveMes(instalacion.dia === 1 ? instalacion : sumarMeses(instalacion, 1));
}

/**
 * @typedef {object} OpcionesPuntos
 * @property {'ventanilla' | 'tarjeta'} perfil todavia sin usar: la ventana la define diaCorte
 * @property {number} diaCorte Ultimo dia de la ventana de pago del cliente
 * @property {import('./fechas.js').Partes} instalacion
 * @property {import('./fechas.js').Partes} hoy
 * @property {number} [meses] Cuantos puntos devolver (default 6)
 */

/**
 * Un punto por mes para la fila de estado de pagos.
 *
 * Estados:
 *   - `verde`     pago dentro de su ventana (<= dia de corte)
 *   - `amarillo`  pago despues de la ventana, dentro del mes
 *   - `rojo`      no hubo pago y la ventana ya vencio
 *   - `pendiente` mes en curso sin pago: la ventana todavia no vencio
 *   - `gris`      mes anterior al primer mes facturable: al cliente todavia no
 *     le corresponde una cuota (ver `primerMesFacturable`)
 *
 * `gris` no es cosmetico: sin el, un cliente de dos meses aparece con seis
 * puntos rojos y parece un moroso cronico. Las dos vistas directamente no lo
 * dibujan.
 *
 * @param {Pago[]} pagos
 * @param {OpcionesPuntos} opciones
 * @returns {{mes: string, estado: string, dia: number | null, monto: number | null}[]}
 */
export function puntosPorMes(pagos, { perfil, diaCorte, instalacion, hoy, meses = 6 }) {
	const claves = mesesEntre(hoy, meses);
	const porMes = new Map((Array.isArray(pagos) ? pagos : []).map((p) => [p.mes, p]));

	const primerMes = primerMesFacturable(instalacion);
	const mesActual = claveMes(hoy);

	return claves.map((mes) => {
		const pago = porMes.get(mes) ?? null;

		// Antes del primer mes facturable no se muestra nada, ni siquiera si
		// hubo cobranza: lo que se cobra el mes de la instalacion no es una
		// cuota mensual y mezclarlo con el historial confunde.
		if (primerMes && mes < primerMes) {
			return { mes, estado: 'gris', dia: null, monto: null };
		}

		if (pago) {
			return {
				mes,
				estado: pago.dia <= diaCorte ? 'verde' : 'amarillo',
				dia: pago.dia,
				monto: pago.monto
			};
		}

		// Sin pago: solo es mora si la ventana ya vencio. En el mes en curso
		// depende de que dia es hoy.
		if (mes === mesActual && hoy.dia <= diaCorte) {
			return { mes, estado: 'pendiente', dia: null, monto: null };
		}

		return { mes, estado: 'rojo', dia: null, monto: null };
	});
}
