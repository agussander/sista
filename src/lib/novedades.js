/**
 * Logica pura de las novedades. Sin runes ni imports: la usan el sitio
 * publico, el carrusel del home y el panel de admin, y se testea con Vitest
 * sin levantar nada.
 */

/** Titulo -> slug de URL: sin tildes, minusculas, palabras unidas por guion. */
export function slugify(titulo) {
	return String(titulo ?? '')
		.normalize('NFD')
		// Los diacriticos combinantes que deja NFD, escapados a proposito: el
		// rango escrito con los caracteres literales es invisible al leerlo.
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

/**
 * Slug libre para un titulo nuevo. El campo `slug` tiene indice unico en
 * PocketBase: sin esto, cargar dos novedades con el mismo titulo falla con un
 * error del SDK que no le dice nada a quien esta cargando.
 *
 * @param {string} titulo
 * @param {string[]} slugsExistentes Los slugs ya cargados.
 */
export function slugUnico(titulo, slugsExistentes = []) {
	const base = slugify(titulo);
	if (!base) return '';

	const usados = new Set(slugsExistentes);
	if (!usados.has(base)) return base;

	let n = 2;
	while (usados.has(`${base}-${n}`)) n++;
	return `${base}-${n}`;
}

const URL_RE = /https?:\/\/[^\s]+/g;

/**
 * Separa la puntuacion que cierra la oracion del final de una URL, para que
 * "entra a https://a.com." no linkee el punto.
 */
function separarPuntuacion(url) {
	const cola = url.match(/[.,;:!?)\]]+$/);
	if (!cola) return [url, ''];
	return [url.slice(0, -cola[0].length), cola[0]];
}

/**
 * Parte el cuerpo en parrafos y cada parrafo en tramos de texto y de link.
 *
 * Devuelve DATOS, no HTML, a proposito: el cuerpo lo escribe una persona en el
 * panel y se dibuja con `{#each}`, asi Svelte lo escapa solo y no hay forma de
 * inyectar markup en la pagina.
 *
 * Cada salto de linea abre un parrafo nuevo y las lineas vacias se descartan:
 * para quien escribe, "enter" es "parrafo nuevo".
 *
 * @param {string} texto
 * @returns {{tipo: 'texto'|'link', valor: string}[][]}
 */
export function parseCuerpo(texto) {
	const lineas = String(texto ?? '')
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter(Boolean);

	return lineas.map((linea) => {
		const tramos = [];
		let ultimo = 0;

		for (const match of linea.matchAll(URL_RE)) {
			const [url, cola] = separarPuntuacion(match[0]);
			if (!url) continue;

			if (match.index > ultimo) {
				tramos.push({ tipo: 'texto', valor: linea.slice(ultimo, match.index) });
			}
			tramos.push({ tipo: 'link', valor: url });
			if (cola) tramos.push({ tipo: 'texto', valor: cola });

			ultimo = match.index + match[0].length;
		}

		if (ultimo < linea.length) {
			tramos.push({ tipo: 'texto', valor: linea.slice(ultimo) });
		}
		return tramos;
	});
}

/**
 * Texto corto para la tarjeta: la bajada si la cargaron, si no un recorte del
 * cuerpo cortado en el ultimo espacio (cortar a la cantidad exacta parte
 * palabras al medio).
 */
export function resumenDe(novedad, max = 140) {
	const bajada = String(novedad?.bajada ?? '').trim();
	if (bajada) return bajada;

	const cuerpo = String(novedad?.cuerpo ?? '').replace(/\s+/g, ' ').trim();
	if (cuerpo.length <= max) return cuerpo;

	const corte = cuerpo.slice(0, max);
	const espacio = corte.lastIndexOf(' ');
	const recorte = espacio > 0 ? corte.slice(0, espacio) : corte;
	return `${recorte.replace(/[.,;:]$/, '')}…`;
}

/** Destacadas primero, despues por fecha descendente. No muta la lista. */
export function ordenarNovedades(lista) {
	return [...(lista ?? [])].sort((a, b) => {
		const da = a.destacada ? 1 : 0;
		const db = b.destacada ? 1 : 0;
		if (da !== db) return db - da;
		return new Date(String(b.fecha ?? '').replace(' ', 'T')) -
			new Date(String(a.fecha ?? '').replace(' ', 'T'));
	});
}

/** PocketBase devuelve "2026-08-19 00:00:00.000Z"; Date quiere la T. */
function aDate(fecha) {
	if (!fecha) return null;
	const d = new Date(String(fecha).replace(' ', 'T'));
	return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Fecha para mostrar. `timeZone: 'UTC'` no es un detalle: PocketBase guarda las
 * fechas a las 00:00Z y el sitio se ve desde Argentina (UTC-3), asi que sin
 * fijarla toda novedad se mostraria con la fecha del dia anterior.
 */
export function formatFecha(fecha) {
	const d = aDate(fecha);
	if (!d) return '';
	return d.toLocaleDateString('es-AR', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		timeZone: 'UTC'
	});
}

/** Fecha en el formato `YYYY-MM-DD` que espera un `<input type="date">`. */
export function fechaParaInput(fecha) {
	const d = aDate(fecha);
	if (!d) return '';
	return d.toISOString().slice(0, 10);
}
