/**
 * Mapeo de la pestaña "Precios Mostrador" a los campos de la coleccion
 * `precios` de PocketBase, que es de donde leen las paginas comerciales
 * (planes, wizard de TV, grillas de canales).
 *
 * Sin imports a proposito: es una tabla de correspondencias y la aritmetica
 * minima que hace falta. Se testea sin tocar Excel ni PocketBase.
 *
 * El invariante que ordena todo el archivo: **solo se escribe un numero
 * positivo y finito que efectivamente se encontro**. Una etiqueta que no esta,
 * un valor vacio o un valor <= 0 dejan el campo como estaba y generan un aviso.
 * Un Excel con la estructura cambiada degrada a "no actualice estos campos", no
 * a "borre los precios del sitio".
 */

/** Etiqueta del Excel -> campo de `precios`. El valor sale del abono mensual. */
export const CAMPOS_POR_ETIQUETA = Object.freeze({
	'HOME F111': 'home',
	'FAST F121': 'fast',
	'POWER F131': 'power',
	'GAMER F141': 'gamer',
	'WORKER F151': 'worker',
	'MAX F161 (NUEVO)': 'max',
	'ANTINA PLAY +': 'antina',
	'Pack Fútbol (Antina)': 'antina_futbol',
	'DGO Full': 'dgo_full',
	'Pack Fútbol (DGo)': 'dgo_futbol',
	'PARAMOUNT + (Dgo)': 'dgo_paramount',
	'UNIVERSAL (DGo)': 'dgo_universal',
	'GIGARED Básico': 'gigared',
	'Pack Fútbol (Gigared)': 'gigared_futbol',
	'LINEA VIP 56-221': 'telefono'
});

/** Fila de la que sale el cargo de instalación. */
const ETIQUETA_INSTALACION = 'HOME F111';

/** Las dos filas de las que se deriva el adicional de Cine. */
const ETIQUETA_ANTINA_TOTAL_CINE = 'Básico + Cine';
const ETIQUETA_ANTINA_BASICO = 'ANTINA PLAY +';

/**
 * Etiqueta comparable: sin espacios de sobra ni distincion de mayusculas.
 * "MAX F161   (NUEVO)" viene con espacios triples desde el Excel.
 *
 * @param {unknown} etiqueta
 */
export function normalizar(etiqueta) {
	return String(etiqueta ?? '')
		.replace(/\s+/g, ' ')
		.trim()
		.toLowerCase();
}

/** @param {unknown} valor */
function positivo(valor) {
	return typeof valor === 'number' && Number.isFinite(valor) && valor > 0;
}

/**
 * @typedef {{ label: string, cargoInicial: number | null, abonoMensual: number | null }} FilaMostrador
 * @typedef {{
 *   valores: Record<string, number>,
 *   avisos: string[],
 *   sinCampo: string[]
 * }} ResultadoPrecios
 */

/**
 * Valores a escribir en `precios`, más los avisos para la vista previa.
 *
 * @param {FilaMostrador[]} mostrador
 * @returns {ResultadoPrecios}
 */
export function calcularPrecios(mostrador) {
	const filas = Array.isArray(mostrador) ? mostrador : [];

	/** @type {Map<string, FilaMostrador>} */
	const porEtiqueta = new Map();
	for (const fila of filas) {
		const clave = normalizar(fila?.label);
		if (clave && !porEtiqueta.has(clave)) porEtiqueta.set(clave, fila);
	}

	/** @type {Record<string, number>} */
	const valores = {};
	/** @type {string[]} */
	const avisos = [];

	for (const [etiqueta, campo] of Object.entries(CAMPOS_POR_ETIQUETA)) {
		const fila = porEtiqueta.get(normalizar(etiqueta));
		if (!fila) {
			avisos.push(`No encontré la fila "${etiqueta}": ${campo} queda como está.`);
			continue;
		}
		if (!positivo(fila.abonoMensual)) {
			avisos.push(`"${etiqueta}" no tiene un abono mensual válido: ${campo} queda como está.`);
			continue;
		}
		valores[campo] = Math.round(fila.abonoMensual);
	}

	// Instalacion: es un cargo por unica vez, no un abono, asi que sale de la
	// otra columna. Es el mismo para todos los planes de fibra.
	const filaInstalacion = porEtiqueta.get(normalizar(ETIQUETA_INSTALACION));
	if (filaInstalacion && positivo(filaInstalacion.cargoInicial)) {
		valores.instalacion = Math.round(filaInstalacion.cargoInicial);
	} else {
		avisos.push(
			`No pude leer el cargo inicial de "${ETIQUETA_INSTALACION}": instalacion queda como está.`
		);
	}

	// El sitio usa antina_cine como ADICIONAL (se suma a Antina Play+), pero el
	// Excel solo publica el total "Basico + Cine". Se deriva por resta, y si
	// falta cualquiera de las dos filas no se escribe nada.
	const total = porEtiqueta.get(normalizar(ETIQUETA_ANTINA_TOTAL_CINE));
	const basico = porEtiqueta.get(normalizar(ETIQUETA_ANTINA_BASICO));
	if (total && basico && positivo(total.abonoMensual) && positivo(basico.abonoMensual)) {
		const adicional = total.abonoMensual - basico.abonoMensual;
		if (adicional > 0) {
			valores.antina_cine = Math.round(adicional);
		} else {
			avisos.push(
				`La resta de "${ETIQUETA_ANTINA_TOTAL_CINE}" dio ${adicional}: antina_cine queda como está.`
			);
		}
	} else {
		avisos.push(
			`Faltan "${ETIQUETA_ANTINA_TOTAL_CINE}" o "${ETIQUETA_ANTINA_BASICO}": antina_cine queda como está.`
		);
	}

	// Informativo: filas que se publican en /tarifas pero no tienen campo propio
	// (SistaFLEX, PABXIP, bandas SPRINT, IP fija, cableados, traslados...).
	const mapeadas = new Set(Object.keys(CAMPOS_POR_ETIQUETA).map(normalizar));
	mapeadas.add(normalizar(ETIQUETA_ANTINA_TOTAL_CINE));
	const sinCampo = filas
		.map((f) => String(f?.label ?? '').trim())
		.filter((label) => label && !mapeadas.has(normalizar(label)));

	return { valores, avisos, sinCampo };
}

/**
 * Precio sin impuestos nacionales por campo de `precios`, a partir de las
 * filas de la pestaña "Tarifas Web" (mismo dato que ya publica /tarifas).
 *
 * A diferencia de `calcularPrecios`, es un dato decorativo que no se escribe
 * en PocketBase: sin avisos ni `sinCampo`, una etiqueta que falta simplemente
 * no aparece en el resultado, y quien lo consume no muestra esa línea.
 *
 * @param {{ label?: unknown, sinImpuestos?: unknown }[] | undefined} filas
 * @returns {Record<string, number>}
 */
export function sinImpuestosPorCampo(filas) {
	/** @type {Map<string, { label?: unknown, sinImpuestos?: unknown }>} */
	const porEtiqueta = new Map();
	for (const fila of Array.isArray(filas) ? filas : []) {
		const clave = normalizar(fila?.label);
		if (clave && !porEtiqueta.has(clave)) porEtiqueta.set(clave, fila);
	}

	/** @type {Record<string, number>} */
	const valores = {};
	for (const [etiqueta, campo] of Object.entries(CAMPOS_POR_ETIQUETA)) {
		const fila = porEtiqueta.get(normalizar(etiqueta));
		if (fila && positivo(fila.sinImpuestos)) {
			valores[campo] = Math.round(/** @type {number} */ (fila.sinImpuestos));
		}
	}
	return valores;
}
