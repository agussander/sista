/**
 * Edad aproximada de un cliente a partir de su numero de documento.
 *
 * En Argentina el DNI se asigna de forma aproximadamente secuencial al
 * inscribir el nacimiento, asi que el numero acota el anio en que nacio su
 * titular. Esto es una ESTIMACION, no un dato: el margen real ronda los tres
 * anios, y por eso la UI la muestra con una tilde (`~57`) y nunca como la edad
 * a secas.
 *
 * No hay ninguna fuente oficial que publique la tabla; las anclas de abajo son
 * puntos de referencia de uso comun, y entre ellas se interpola linealmente.
 * Cuando el numero cae fuera de lo que la tabla puede sostener -la serie de
 * extranjeros, un CUIT de empresa, un numero anterior o posterior a las
 * anclas- la respuesta es `null` y la columna muestra un guion. Preferimos no
 * decir nada antes que decir un numero inventado.
 */

/**
 * Pares `[dni, anio de nacimiento]`, ascendentes por DNI.
 *
 * Los extremos importan tanto como los puntos del medio: por debajo del primero
 * la secuencia deja de ser confiable (libretas de enrolamiento y civicas, dos
 * series separadas hasta fines de los 60) y por encima del ultimo estariamos
 * extrapolando hacia numeros que todavia no se emitieron.
 */
const ANCLAS = [
	[1_000_000, 1920],
	[3_000_000, 1932],
	[5_000_000, 1943],
	[7_000_000, 1948],
	[10_000_000, 1952],
	[12_000_000, 1957],
	[14_000_000, 1961],
	[16_000_000, 1963],
	[18_000_000, 1966],
	[20_000_000, 1968],
	[22_000_000, 1971],
	[24_000_000, 1974],
	[26_000_000, 1977],
	[28_000_000, 1980],
	[30_000_000, 1983],
	[32_000_000, 1986],
	[34_000_000, 1988],
	[36_000_000, 1991],
	[38_000_000, 1994],
	[40_000_000, 1997],
	[42_000_000, 2000],
	[44_000_000, 2002],
	[46_000_000, 2005],
	[48_000_000, 2008],
	[50_000_000, 2010],
	[52_000_000, 2012],
	[54_000_000, 2014],
	[56_000_000, 2016],
	[58_000_000, 2018],
	[60_000_000, 2020]
];

/** Primer DNI de la serie que la RENAPER reserva a extranjeros. */
const SERIE_EXTRANJEROS = 90_000_000;

/** Prefijos de CUIT/CUIL que corresponden a una persona fisica. */
const PREFIJOS_PERSONA = ['20', '23', '24', '27'];

/**
 * El DNI que hay detras de un `doc_number` de IspCube, como numero.
 *
 * El campo es texto libre del otro lado: puede venir el DNI pelado, con puntos,
 * o el CUIT/CUIL entero (con guiones o sin ellos). Un CUIT de empresa
 * (prefijos 30, 33, 34) devuelve `null`: no hay persona de la cual estimar una
 * edad.
 *
 * @param {unknown} docNumber
 * @returns {number | null}
 */
export function dniDe(docNumber) {
	const digitos = String(docNumber ?? '').replace(/\D/g, '');
	if (digitos === '') return null;

	if (digitos.length === 11) {
		if (!PREFIJOS_PERSONA.includes(digitos.slice(0, 2))) return null;
		// CUIL = 2 de prefijo + 8 de DNI + 1 verificador.
		return Number(digitos.slice(2, 10));
	}

	// Mas de 11 digitos no es ninguna de las dos cosas; menos, es un DNI
	// (posiblemente viejo y corto, que `estimarAnioNacimiento` va a descartar).
	if (digitos.length > 11) return null;
	return Number(digitos);
}

/**
 * Anio de nacimiento estimado, o `null` si el numero no lo permite.
 *
 * @param {unknown} docNumber
 * @returns {number | null}
 */
export function estimarAnioNacimiento(docNumber) {
	const dni = dniDe(docNumber);
	if (dni === null) return null;

	// Redundante con el tope de la tabla (90M > 60M), pero explicito: la serie
	// de extranjeros no es secuencial por nacimiento y no se estima ni aunque
	// algun dia las anclas lleguen mas arriba.
	if (dni >= SERIE_EXTRANJEROS) return null;

	const [primerDni] = ANCLAS[0];
	const [ultimoDni] = ANCLAS[ANCLAS.length - 1];
	if (dni < primerDni || dni > ultimoDni) return null;

	for (let i = 1; i < ANCLAS.length; i++) {
		const [dniAnterior, anioAnterior] = ANCLAS[i - 1];
		const [dniActual, anioActual] = ANCLAS[i];
		if (dni > dniActual) continue;

		const avance = (dni - dniAnterior) / (dniActual - dniAnterior);
		return Math.round(anioAnterior + avance * (anioActual - anioAnterior));
	}

	return null;
}

/**
 * Edad aproximada en anios cumplidos-ish: no sabemos el mes de nacimiento, asi
 * que es la resta de anios y nada mas. Un resultado imposible (negativo, o mas
 * de 120) se descarta: significa que el `anioActual` o el documento estan mal,
 * y mostrar "-3" seria peor que no mostrar nada.
 *
 * @param {unknown} docNumber
 * @param {number} anioActual
 * @returns {number | null}
 */
export function estimarEdad(docNumber, anioActual) {
	const nacimiento = estimarAnioNacimiento(docNumber);
	if (nacimiento === null) return null;

	const edad = anioActual - nacimiento;
	return edad >= 0 && edad <= 120 ? edad : null;
}
