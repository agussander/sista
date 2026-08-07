/**
 * El orden de la lista de la Cartera.
 *
 * Dos modos, y la diferencia entre ellos es el punto del modulo:
 *
 *   - El orden POR DEFECTO responde "que atiendo hoy": primero todo lo que
 *     tiene alerta, de mas urgente a menos, y dentro de cada nivel lo que hace
 *     mas tiempo que espera.
 *   - El orden POR COLUMNA responde otra pregunta ("quienes son mis clientes
 *     mas viejos", "quien vive en Ensenada") y por eso NO sube las alertas
 *     arriba. Si lo hiciera, la primera pantalla seria siempre la misma y el
 *     boton no serviria para nada.
 *
 * Trabaja sobre las "filas" que arma `Cartera.svelte`, no sobre el registro
 * crudo del cliente: la urgencia y las alertas ya vienen calculadas de ahi, y
 * recalcularlas por comparacion seria O(n log n) veces el mismo trabajo.
 */

/**
 * @typedef {object} Fila
 * @property {{code: string, nombre: string, connections?: unknown[]}} cliente
 * @property {{tipo: string, desde: string | null}[]} alertas
 * @property {'alta' | 'media' | 'baja' | null} urgencia
 * @property {number | null} edad
 * @property {string} ciudad
 * @property {{estado: string}[]} puntos
 * @property {string} ultimoContacto
 * @property {string} alta
 */

/** Menor es mas urgente. `null` (sin alertas) nunca llega a compararse aca. */
const RANGO_URGENCIA = { alta: 0, media: 1, baja: 2 };

/**
 * Cuanto "duele" cada punto de pago. Es la unica escala de la tabla que no sale
 * de un campo directo: un rojo (vencido sin pagar) pesa el triple que un
 * amarillo (pago fuera de termino), y verde y pendiente no suman nada.
 */
const PESO_PUNTO = { rojo: 3, amarillo: 1 };

/**
 * `desde` normalizado a `"YYYY-MM-DD"`, comparable como string.
 *
 * Llega en tres formas segun la alerta: `"2026-08"` (mora y seguimiento usan
 * `claveMes`), `"2026-08-04"` (recordatorio, promo) y `"2026-08-04 14:30:00"`
 * (tickets, que necesitan la hora para su propia comparacion). El mes se
 * completa al dia 1 -es lo mas viejo que ese mes puede ser- y la fecha-hora se
 * recorta.
 *
 * @param {unknown} desde
 * @returns {string} `''` si no hay fecha utilizable
 */
function normalizarDesde(desde) {
	if (typeof desde !== 'string') return '';
	if (/^\d{4}-\d{2}$/.test(desde)) return `${desde}-01`;
	if (/^\d{4}-\d{2}-\d{2}/.test(desde)) return desde.slice(0, 10);
	return '';
}

/**
 * La fecha de la alerta mas vieja del cliente.
 *
 * Un pendiente viejo urge mas que uno reciente -mismo criterio que usa
 * `proximoRecordatorio` para elegir cual mostrar-, asi que la fila se ordena
 * por la mas vieja de todas, no por la mas nueva.
 *
 * @param {{desde?: unknown}[]} alertas
 * @returns {string} `''` si ninguna alerta tiene fecha
 */
export function fechaDeAlerta(alertas) {
	let masVieja = '';
	for (const alerta of alertas ?? []) {
		const fecha = normalizarDesde(alerta?.desde);
		if (!fecha) continue;
		if (!masVieja || fecha < masVieja) masVieja = fecha;
	}
	return masVieja;
}

/**
 * Cuanto "debe" el historial de pagos visible del cliente. Mas alto es peor.
 *
 * @param {{estado?: string}[]} puntos
 * @returns {number}
 */
export function pesoPagos(puntos) {
	let total = 0;
	for (const punto of puntos ?? []) total += PESO_PUNTO[punto?.estado] ?? 0;
	return total;
}

/** @param {string} a @param {string} b */
const cmpTexto = (a, b) => a.localeCompare(b, 'es-AR');

/** @param {number} a @param {number} b */
const cmpNumero = (a, b) => a - b;

/**
 * Definicion de cada columna ordenable.
 *
 * `valor` devuelve `null` cuando la fila no tiene ese dato: esas filas salen de
 * la comparacion y van al final SIEMPRE, en las dos direcciones. Sin esto,
 * invertir el orden por edad subiria arriba de todo a los treinta clientes sin
 * DNI cargado, que es exactamente lo contrario de lo que buscaba quien hizo
 * click.
 *
 * `contacto` no usa esa via a proposito: "nunca contactado" no es un dato
 * faltante, es el valor mas viejo posible, y tiene que competir como tal.
 */
const COLUMNAS = {
	codigo: { dir: 'asc', valor: (f) => f.cliente.code, comparar: cmpTexto },
	nombre: { dir: 'asc', valor: (f) => f.cliente.nombre, comparar: cmpTexto },
	edad: { dir: 'desc', valor: (f) => f.edad, comparar: cmpNumero },
	ciudad: { dir: 'asc', valor: (f) => f.ciudad || null, comparar: cmpTexto },
	conexiones: {
		dir: 'desc',
		valor: (f) => (Array.isArray(f.cliente.connections) ? f.cliente.connections.length : 0),
		comparar: cmpNumero
	},
	contacto: { dir: 'asc', valor: (f) => f.ultimoContacto, comparar: cmpTexto },
	pagos: {
		dir: 'desc',
		valor: (f) => (f.puntos?.length ? pesoPagos(f.puntos) : null),
		comparar: cmpNumero
	},
	alta: { dir: 'desc', valor: (f) => f.alta, comparar: cmpTexto }
};

/**
 * Direccion con la que arranca una columna al hacerle click por primera vez.
 * Siempre la que responde la pregunta interesante: los mas nuevos, los mayores,
 * los peores pagadores, el contacto mas viejo.
 *
 * @param {string} columna
 * @returns {'asc' | 'desc'}
 */
export function direccionInicial(columna) {
	return COLUMNAS[columna]?.dir ?? 'desc';
}

/**
 * El orden por defecto, y tambien el desempate de cualquier orden por columna:
 * asi dos filas con la misma ciudad siempre salen en el mismo orden entre
 * renders, en vez de depender de como venia el array.
 *
 * @param {Fila} a
 * @param {Fila} b
 */
function compararDefecto(a, b) {
	const grupoA = a.alertas.length > 0 ? 0 : 1;
	const grupoB = b.alertas.length > 0 ? 0 : 1;
	if (grupoA !== grupoB) return grupoA - grupoB;

	if (grupoA === 0) {
		const urgenciaA = RANGO_URGENCIA[a.urgencia] ?? 3;
		const urgenciaB = RANGO_URGENCIA[b.urgencia] ?? 3;
		if (urgenciaA !== urgenciaB) return urgenciaA - urgenciaB;

		const fechaA = fechaDeAlerta(a.alertas);
		const fechaB = fechaDeAlerta(b.alertas);
		if (fechaA !== fechaB) {
			// Una alerta sin fecha (las dos de NAP) no puede competir por
			// antiguedad: va ultima dentro de su nivel de urgencia.
			if (!fechaA) return 1;
			if (!fechaB) return -1;
			return fechaA < fechaB ? -1 : 1;
		}
	}

	// Alta mas nueva arriba, y el code como ultimo recurso para que el orden sea
	// total (dos clientes dados de alta el mismo dia no pueden quedar sueltos).
	if (a.alta !== b.alta) return a.alta < b.alta ? 1 : -1;
	return cmpTexto(a.cliente.code, b.cliente.code);
}

/**
 * Devuelve una copia ordenada. Nunca muta lo que recibe: el array de entrada es
 * un `$derived` de Svelte y ordenarlo en el lugar dispararia el derived de
 * nuevo.
 *
 * @param {Fila[]} filas
 * @param {string} columna `'alertas'` para el orden compuesto por defecto
 * @param {'asc' | 'desc'} direccion Ignorada cuando `columna` es `'alertas'`
 * @returns {Fila[]}
 */
export function ordenar(filas, columna = 'alertas', direccion = 'desc') {
	const copia = [...filas];
	const col = COLUMNAS[columna];
	if (!col) return copia.sort(compararDefecto);

	const signo = direccion === 'desc' ? -1 : 1;

	/** @type {Fila[]} */
	const conDato = [];
	/** @type {Fila[]} */
	const sinDato = [];
	for (const f of copia) (col.valor(f) === null ? sinDato : conDato).push(f);

	conDato.sort((a, b) => signo * col.comparar(col.valor(a), col.valor(b)) || compararDefecto(a, b));
	sinDato.sort(compararDefecto);

	return [...conDato, ...sinDato];
}
