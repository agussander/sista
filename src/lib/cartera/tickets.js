/**
 * De los tickets crudos de IspCube al modelo de vista del carrusel.
 *
 * No vive en `normalizar.js` a proposito: ese modulo traduce respuestas de
 * IspCube a lo que se GUARDA en el snapshot de `cartera_clientes`, y esto no
 * se guarda en ningun lado. Se pide en vivo al abrir el detalle de un cliente
 * y se muestra; el snapshot sigue teniendo solo el resumen que arma
 * `resumenTickets`.
 */
import { partesFechaHora, compararFechaHora } from './fechas.js';

/**
 * Cuantos tickets se devuelven, contando desde el mas nuevo.
 *
 * Es una cota al tamano de la respuesta, no un filtro de producto: un cliente
 * de la cartera con mas de 30 tickets no existe hoy. Si alguna vez existe, ve
 * los 30 mas nuevos y no una pagina en blanco por timeout.
 */
export const TOPE_TICKETS = 30;

/**
 * Una fecha de IspCube como la lee una persona: `"12/07/2026"`, o
 * `"12/07/2026 10:05"` con `conHora`.
 *
 * Es la unica funcion del modulo que construye un `Date`, y solo para
 * formatear. El resto de `cartera/` lo tiene prohibido porque `new Date(str)`
 * corre el dia segun la zona horaria y eso movia puntos de pago y disparaba
 * moras falsas. Aca no hay riesgo: nada de lo que sale de esta funcion vuelve
 * a entrar en una comparacion.
 *
 * Ademas el `Date` no se arma parseando el string -que en Safari falla con el
 * formato `"2026-07-01 10:00:00"`- sino con las partes ya extraidas por texto.
 * El sufijo `Z` decide como se las interpreta: con `Z` son UTC y se pasan a la
 * hora local del asesor; sin `Z`, IspCube no documenta la zona y se las toma
 * tal cual vinieron.
 *
 * @param {unknown} valor
 * @param {{conHora?: boolean}} [opciones]
 * @returns {string} vacio si no tiene forma de fecha
 */
export function fechaLegible(valor, { conHora = false } = {}) {
	const p = partesFechaHora(valor);
	if (!p) return '';

	const esUTC = typeof valor === 'string' && valor.trim().endsWith('Z');
	const d = esUTC
		? new Date(Date.UTC(p.anio, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo))
		: new Date(p.anio, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo);

	const fecha = d.toLocaleDateString('es-AR');
	if (!conHora) return fecha;
	// `hour12: false` explicito: el ICU de Node resuelve es-AR a formato de 12
	// horas ("10:00 p. m."), que no es como se escribe la hora en Argentina.
	const hora = d.toLocaleTimeString('es-AR', {
		hour: '2-digit',
		minute: '2-digit',
		hour12: false
	});
	return `${fecha} ${hora}`;
}

/**
 * Indice `id -> item` de un catalogo de IspCube.
 *
 * Las claves son strings porque los ids llegan como number desde `/api/tickets`
 * y a veces como string desde los `*_list`; cruzarlos sin normalizar deja todos
 * los nombres vacios.
 *
 * @param {unknown} catalogo
 * @returns {Map<string, any>}
 */
function indexar(catalogo) {
	const mapa = new Map();
	if (!Array.isArray(catalogo)) return mapa;
	for (const item of catalogo) {
		if (item && item.id !== null && item.id !== undefined) mapa.set(String(item.id), item);
	}
	return mapa;
}

/**
 * `{id, nombre}` para un id de catalogo. Sin catalogo -o con un id que no
 * figura- el nombre queda vacio y la UI muestra el id crudo: perder el nombre
 * degrada la pantalla, no la rompe.
 *
 * @param {unknown} id
 * @param {Map<string, any>} indice
 * @returns {{id: unknown, nombre: string}}
 */
function etiqueta(id, indice) {
	if (id === null || id === undefined) return { id: null, nombre: '' };
	const item = indice.get(String(id));
	return { id, nombre: typeof item?.name === 'string' ? item.name : '' };
}

/**
 * El color de una categoria, si es un color hexadecimal y nada mas.
 *
 * La UI lo pinta con un `style:` inline, asi que lo que venga del catalogo
 * entra en una hoja de estilo. Svelte escapa el atributo -no se puede salir de
 * el- pero un valor como `url(http://...)` seguiria siendo una peticion a un
 * servidor ajeno disparada por un dato de la API. Un color que no es un color
 * se descarta y la tarjeta usa el tono neutro de siempre.
 *
 * @param {unknown} valor
 * @returns {string}
 */
function colorHex(valor) {
	if (typeof valor !== 'string') return '';
	const limpio = valor.trim();
	return /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(limpio) ? limpio : '';
}

/**
 * Un item del hilo de mensajes.
 *
 * `interno` es true salvo que el item diga explicitamente `internal: false`.
 * En la practica casi todos los items son internos (es donde el equipo deja
 * sus comentarios del ticket) y el campo puede no venir; suponer "visible al
 * cliente" ante la duda mostraria como publica una nota que no lo es.
 *
 * @param {any} item
 */
function normalizarItem(item) {
	const texto = typeof item?.content === 'string' ? item.content.trim() : '';
	if (!texto) return null;
	return {
		fecha: typeof item.created_at === 'string' ? item.created_at : '',
		autor: typeof item.user?.name === 'string' ? item.user.name : '',
		interno: item.internal !== false,
		texto
	};
}

/**
 * Ordena el hilo del mas viejo al mas nuevo: un ticket se lee de arriba abajo.
 *
 * @param {unknown} items
 */
function normalizarHilo(items) {
	if (!Array.isArray(items)) return [];

	return items
		.map(normalizarItem)
		.filter((i) => i !== null)
		.sort((a, b) => {
			const pa = partesFechaHora(a.fecha);
			const pb = partesFechaHora(b.fecha);
			if (!pa || !pb) return 0;
			return compararFechaHora(pa, pb);
		});
}

/**
 * Los tickets de un cliente, listos para pintar: ids traducidos a nombres, mas
 * nuevo primero, acotados a `TOPE_TICKETS`.
 *
 * @param {unknown} crudos Respuesta de `getTickets`
 * @param {{catalogos: {areas?: unknown[], categorias?: unknown[], estados?: unknown[], prioridades?: unknown[]} | null,
 *   estadosCerrados: unknown[]}} opciones
 *   `catalogos` en null significa que los `*_list` de IspCube fallaron: los
 *   nombres quedan vacios y la UI cae a mostrar los ids.
 * @returns {Array<{id: unknown, numero: string, fecha: string, cerrado: boolean,
 *   area: {id: unknown, nombre: string}, categoria: {id: unknown, nombre: string, color: string},
 *   estado: {id: unknown, nombre: string}, prioridad: {id: unknown, nombre: string},
 *   asignado: string, visita: string,
 *   hilo: Array<{fecha: string, autor: string, interno: boolean, texto: string}>}>}
 */
export function normalizarTickets(crudos, { catalogos, estadosCerrados }) {
	if (!Array.isArray(crudos)) return [];

	const areas = indexar(catalogos?.areas);
	const categorias = indexar(catalogos?.categorias);
	const estados = indexar(catalogos?.estados);
	const prioridades = indexar(catalogos?.prioridades);
	const cerrados = (Array.isArray(estadosCerrados) ? estadosCerrados : []).map(String);

	const normalizados = [];

	for (const t of crudos) {
		if (!t || t.deleted_at) continue;

		const fecha = typeof t.created_at === 'string' ? t.created_at : '';
		const categoria = etiqueta(t.ticket_category_id ?? null, categorias);
		const color = categorias.get(String(t.ticket_category_id));

		normalizados.push({
			id: t.id ?? null,
			// El listado de IspCube no documenta `ticket_number` (si lo hace la
			// respuesta del alta), asi que el id es el respaldo: la tarjeta
			// siempre muestra algo con lo que buscar el ticket en IspCube.
			numero: String(t.ticket_number ?? t.id ?? ''),
			fecha,
			cerrado: cerrados.includes(String(t.ticket_status_id)),
			area: etiqueta(t.ticket_area_id ?? null, areas),
			categoria: { ...categoria, color: colorHex(color?.color) },
			estado: etiqueta(t.ticket_status_id ?? null, estados),
			prioridad: etiqueta(t.ticket_priority_id ?? null, prioridades),
			asignado: typeof t.assigned_user?.name === 'string' ? t.assigned_user.name : '',
			visita: typeof t.visit_date === 'string' ? t.visit_date : '',
			hilo: normalizarHilo(t.items)
		});
	}

	// Mas nuevo primero, comparando por partes y no con `>` sobre el string:
	// IspCube devuelve `created_at` en dos formatos ("...T10:00:00.000000Z" y
	// "... 10:00:00") y el espacio ordena antes que la T, lo que invertiria el
	// orden entre dos tickets del mismo dia con formatos distintos.
	//
	// Un ticket sin fecha legible no se descarta -existe igual, y esconderlo
	// seria peor que mostrarlo sin fecha- pero va al final: no hay forma de
	// ubicarlo entre los demas.
	normalizados.sort((a, b) => {
		const pa = partesFechaHora(a.fecha);
		const pb = partesFechaHora(b.fecha);
		if (!pa && !pb) return 0;
		if (!pa) return 1;
		if (!pb) return -1;
		return compararFechaHora(pb, pa);
	});

	return normalizados.slice(0, TOPE_TICKETS);
}
