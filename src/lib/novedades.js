/**
 * Logica pura de las novedades. Sin runes ni imports: la usan el sitio
 * publico, el carrusel del home y el panel de admin, y se testea con Vitest
 * sin levantar nada.
 */

/** Titulo -> slug de URL: sin tildes, minusculas, palabras unidas por guion. */
export function slugify(titulo) {
	return String(titulo ?? '')
		.normalize('NFD')
		// Los diacriticos combinantes que deja NFD. Se usa el escape \uXXXX
		// (y no el caracter literal) porque un combinante pegado en el
		// codigo fuente es invisible al leerlo y fragil ante herramientas
		// que normalizan texto.
		.replace(/[\u0300-\u036f]/g, '')
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

const PUNTUACION_FINAL = /[.,;:!?)\]]/;

/**
 * Separa la puntuacion que cierra la oracion del final de una URL, para que
 * "entra a https://a.com." no linkee el punto.
 *
 * Un ")" es un caso especial: si la URL trae tantos "(" como ")" (por ejemplo
 * ".../PHP_(lenguaje)"), el parentesis es parte de la URL y no se corta. Solo
 * se corta cuando sobra un ")" sin abrir, que es la puntuacion de la oracion
 * (como en "(mira https://a.com)").
 */
function separarPuntuacion(url) {
	let cortarDesde = url.length;

	while (cortarDesde > 0 && PUNTUACION_FINAL.test(url[cortarDesde - 1])) {
		if (url[cortarDesde - 1] === ')') {
			const prefijo = url.slice(0, cortarDesde);
			const abiertos = (prefijo.match(/\(/g) ?? []).length;
			const cerrados = (prefijo.match(/\)/g) ?? []).length;
			if (abiertos >= cerrados) break;
		}
		cortarDesde--;
	}

	return [url.slice(0, cortarDesde), url.slice(cortarDesde)];
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
 * palabras al medio). Si en la ventana no hay ningun espacio (una palabra
 * sola mas larga que `max`), se hace un corte duro ahi mismo: no queda otro
 * lugar donde cortar.
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

/**
 * Destacadas primero, despues por fecha descendente. No muta la lista.
 *
 * Usa `aDate()` (declarada mas abajo, pero las function declarations se
 * hoistean) en vez de parsear la fecha inline: una fecha ausente o invalida
 * da `null`, y ahi cae al centinela epoch 0 para que ordene al final en vez
 * de devolver NaN. Un comparador que devuelve NaN deja a `Array.sort` en
 * comportamiento indefinido y la lista sale practicamente desordenada.
 */
export function ordenarNovedades(lista) {
	return [...(lista ?? [])].sort((a, b) => {
		const da = a.destacada ? 1 : 0;
		const db = b.destacada ? 1 : 0;
		if (da !== db) return db - da;
		const fa = aDate(a.fecha)?.getTime() ?? 0;
		const fb = aDate(b.fecha)?.getTime() ?? 0;
		return fb - fa;
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
