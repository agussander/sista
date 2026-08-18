/**
 * Parser del Tarifario de Sista.
 *
 * A diferencia de `xlsx.js`, que no sabe de tarifas, este modulo conoce *este*
 * libro: que hojas mirar, que columnas tienen que datos y donde arranca cada
 * bloque.
 *
 * Ninguna fila se lee por numero fijo: se escanea desde el encabezado hasta el
 * primer hueco en la columna de etiquetas. Asi, agregar o sacar un plan entre
 * versiones no rompe nada, y las celdas de instrucciones para Word (que estan
 * mas abajo, despues del hueco) nunca se alcanzan.
 */

export const HOJA_TARIFAS = 'Tarifas Web';
export const HOJA_MOSTRADOR = 'Precios Mostrador';
export const HOJA_VIP = 'Linea VIP - Tarifas Web';
export const HOJA_INTERNACIONAL = 'Internacional';

/**
 * @param {Map<string, Map<string, any>>} libro
 * @param {string} nombre
 */
export function hoja(libro, nombre) {
	const h = libro.get(nombre);
	if (!h) throw new Error(`El Excel no tiene la pestaña "${nombre}".`);
	return h;
}

/**
 * Texto de una celda, o `null`. No recorta: la sangría es información.
 *
 * @param {Map<string, any>} h
 * @param {string} ref
 * @returns {string | null}
 */
export function texto(h, ref) {
	const v = h.get(ref);
	if (v === undefined || v === null) return null;
	const s = String(v);
	return s.trim() === '' ? null : s;
}

/**
 * Número finito de una celda, o `null`.
 *
 * @param {Map<string, any>} h
 * @param {string} ref
 * @returns {number | null}
 */
export function numero(h, ref) {
	const v = h.get(ref);
	return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * Números de fila con etiqueta, desde `desde` hasta el primer hueco.
 *
 * @param {Map<string, any>} h
 * @param {string} columna
 * @param {number} desde
 * @param {number} [tope] Corte duro, por si una hoja viniera sin huecos.
 */
export function filasConEtiqueta(h, columna, desde, tope = 10000) {
	const filas = [];
	for (let f = desde; f < desde + tope; f++) {
		if (texto(h, `${columna}${f}`) === null) break;
		filas.push(f);
	}
	return filas;
}

/**
 * @typedef {{ label: string, nivel: 0 | 1, sinImpuestos: number | null, precioFinal: number | null }} FilaTarifa
 * @typedef {{ filas: FilaTarifa[], alicuota: number | null }} TarifasWeb
 */

/**
 * Pestaña "Tarifas Web": lo que se publica en /tarifas.
 *
 * @param {Map<string, Map<string, any>>} libro
 * @returns {TarifasWeb}
 */
export function parseTarifasWeb(libro) {
	const h = hoja(libro, HOJA_TARIFAS);

	const filas = filasConEtiqueta(h, 'B', 6).map((f) => {
		const crudo = texto(h, `B${f}`) ?? '';
		return {
			// La sangria del Excel es lo unico que distingue un pack de su
			// servicio padre; se guarda como `nivel` y la etiqueta va limpia.
			label: crudo.trim(),
			nivel: /^\s/.test(crudo) ? 1 : 0,
			sinImpuestos: numero(h, `C${f}`),
			precioFinal: numero(h, `D${f}`)
		};
	});

	return { filas, alicuota: numero(h, 'D42') };
}

/**
 * @typedef {{
 *   nombre: string, clientes: string | null, numeroLocal: string | null,
 *   cargoInicial: number | string | null, abonoMensual: number | null,
 *   minutosLocales: number | null, llamadasCelulares: number | null,
 *   excedenteLocal: number | null, excedenteNacional: number | null
 * }} PlanVip
 * @typedef {{ vigencia: string | null, planes: PlanVip[], aparato: string | null, notas: string[] }} LineaVip
 */

/**
 * Valor de una celda tal cual: número si es número, texto recortado si no.
 *
 * @param {Map<string, any>} h
 * @param {string} ref
 * @returns {string | number | null}
 */
function crudo(h, ref) {
	const v = h.get(ref);
	if (v === undefined || v === null) return null;
	if (typeof v === 'number') return v;
	const s = String(v).trim();
	return s === '' ? null : s;
}

/**
 * Pestaña "Linea VIP - Tarifas Web": alimenta /telefonia.
 *
 * @param {Map<string, Map<string, any>>} libro
 * @returns {LineaVip}
 */
export function parseLineaVip(libro) {
	const h = hoja(libro, HOJA_VIP);

	const filas = filasConEtiqueta(h, 'B', 5);

	// H5:H8 y J5:J8 estan combinadas en el Excel: el valor existe solo en la
	// primera fila y vale para los cuatro planes. Se lee una vez y se replica.
	const primera = filas[0];
	const llamadasCelulares = primera ? numero(h, `H${primera}`) : null;
	const excedenteNacional = primera ? numero(h, `J${primera}`) : null;

	const planes = filas.map((f) => ({
		nombre: (texto(h, `B${f}`) ?? '').trim(),
		clientes: /** @type {string | null} */ (crudo(h, `C${f}`)),
		numeroLocal: /** @type {string | null} */ (crudo(h, `D${f}`)),
		cargoInicial: crudo(h, `E${f}`), // 800 en Radio, "--" en Fibra
		abonoMensual: numero(h, `F${f}`),
		minutosLocales: numero(h, `G${f}`),
		llamadasCelulares,
		excedenteLocal: numero(h, `I${f}`),
		excedenteNacional
	}));

	// Las notas arrancan despues de los planes y se cortan al llegar a la celda
	// de instrucciones para Word, que es la unica con contenido en la columna A.
	/** @type {string[]} */
	const notas = [];
	/** @type {string | null} */
	let aparato = null;
	const desde = (filas.at(-1) ?? 4) + 1;
	for (let f = desde; f < desde + 30; f++) {
		if (texto(h, `A${f}`) !== null) break;
		const nota = texto(h, `B${f}`)?.trim();
		if (!nota) continue;
		if (/^Aparato telef/i.test(nota)) aparato = nota;
		else notas.push(nota);
	}

	return { vigencia: texto(h, 'J2'), planes, aparato, notas };
}

/**
 * @typedef {{ destino: string, fijo: number | null, movil: number | null }} DestinoInternacional
 * @typedef {{ vigencia: string | null, unidad: 'U$S', destinos: DestinoInternacional[] }} Internacional
 */

/**
 * Pestaña "Internacional": alimenta /telefonia/internacional.
 *
 * La fuente trae una fila por prefijo (3.273) y la pagina muestra una por pais
 * (346), asi que se agrupa aca y no en el navegador: baja el registro de ~142 KB
 * a ~15 KB. Se verifico que ningun destino tiene dos precios distintos para el
 * mismo tipo, asi que agrupar no pierde informacion de precio.
 *
 * @param {Map<string, Map<string, any>>} libro
 * @returns {Internacional}
 */
export function parseInternacional(libro) {
	const h = hoja(libro, HOJA_INTERNACIONAL);

	/** @type {Map<string, DestinoInternacional>} */
	const porDestino = new Map();
	/** @type {DestinoInternacional[]} */
	const destinos = [];

	for (const f of filasConEtiqueta(h, 'B', 5)) {
		const nombre = texto(h, `C${f}`)?.trim();
		if (!nombre) continue;

		let entrada = porDestino.get(nombre);
		if (!entrada) {
			entrada = { destino: nombre, fijo: null, movil: null };
			porDestino.set(nombre, entrada);
			destinos.push(entrada); // el orden de aparicion es el alfabetico del Excel
		}

		const tipo = texto(h, `D${f}`) ?? '';
		const precio = numero(h, `E${f}`);
		if (/fij/i.test(tipo)) entrada.fijo ??= precio;
		else if (/m[oó]vil/i.test(tipo)) entrada.movil ??= precio;
	}

	return { vigencia: texto(h, 'E3'), unidad: 'U$S', destinos };
}

/**
 * @typedef {{ label: string, cargoInicial: number | null, abonoMensual: number | null }} FilaMostrador
 * @typedef {{
 *   version: string | null, vigencia: string | null,
 *   tarifasWeb: TarifasWeb, lineaVip: LineaVip,
 *   internacional: Internacional, mostrador: FilaMostrador[]
 * }} Tarifario
 */

/**
 * Pestaña "Precios Mostrador": de acá salen los precios de la colección `precios`.
 *
 * Se toman las columnas de precio final (con impuestos), que son las que se
 * publican: `G` para el cargo inicial y `I` para el abono mensual.
 *
 * @param {Map<string, Map<string, any>>} libro
 * @returns {FilaMostrador[]}
 */
export function parseMostrador(libro) {
	const h = hoja(libro, HOJA_MOSTRADOR);

	return filasConEtiqueta(h, 'B', 5).map((f) => ({
		label: (texto(h, `B${f}`) ?? '').trim(),
		cargoInicial: numero(h, `G${f}`),
		abonoMensual: numero(h, `I${f}`)
	}));
}

/**
 * Tarifario completo a partir del libro ya leído.
 *
 * @param {Map<string, Map<string, any>>} libro
 * @returns {Tarifario}
 */
export function parseTarifario(libro) {
	const tarifasWeb = parseTarifasWeb(libro);
	const lineaVip = parseLineaVip(libro);
	const internacional = parseInternacional(libro);
	const mostrador = parseMostrador(libro);

	const version = numero(hoja(libro, HOJA_MOSTRADOR), 'B2');

	return {
		// `String` y no `toFixed`: la version es un numero (26.081) y hay que
		// mostrarlo tal como esta escrito. `toFixed(3)` convertiria una futura
		// 5.2 en "5.200"; `String` da la representacion mas corta que round-trippea.
		version: version === null ? null : String(version),
		vigencia: texto(hoja(libro, HOJA_TARIFAS), 'B5'),
		tarifasWeb,
		lineaVip,
		internacional,
		mostrador
	};
}
