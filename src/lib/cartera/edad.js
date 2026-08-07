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
 * No salen de ninguna tabla oficial -la RENAPER no publica una-: son puntos de
 * referencia de uso comun, aproximados a proposito. Si algun dia se consiguen
 * datos reales, se corrigen aca y el resto del modulo no se entera.
 *
 * Los extremos importan tanto como los puntos del medio. Por debajo del
 * primero la secuencia deja de ser confiable: hasta fines de los 60 convivian
 * la libreta de enrolamiento y la civica, dos series separadas. Por encima del
 * ultimo estariamos extrapolando hacia numeros que todavia no se emitieron, y
 * ahi arriba tambien vive la serie 90.000.000+, que la RENAPER reserva a
 * extranjeros y que no es secuencial por nacimiento: el tope de la tabla la
 * descarta sola.
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

	// Mas de 11 digitos no es ni un DNI ni un CUIT.
	if (digitos.length > 11) return null;

	// Todo lo demas se devuelve tal cual, incluso un numero corto o absurdo:
	// esta funcion solo lee el documento. Decidir si sirve para estimar algo
	// es de `estimarAnioNacimiento`, que tiene la tabla para saberlo.
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

	// Inalcanzable mientras el guardia de rango de arriba se cumpla: la ultima
	// vuelta del loop tiene `dniActual === ultimoDni` y siempre entra. Esta
	// igual para que la funcion no pueda devolver `undefined` y contradecir su
	// propia firma si ese guardia alguna vez cambia.
	return null;
}

/**
 * Edad aproximada en anios cumplidos-ish: no sabemos el mes de nacimiento, asi
 * que es la resta de anios y nada mas.
 *
 * `anioActual` es un anio suelto (2026), no un `Date` ni una fecha: quien
 * llama ya tiene las partes de hoy calculadas y pasarle el objeto entero
 * devolveria `null` para TODA la lista, que se ve como una columna de guiones
 * sin ningun error en ningun lado. Por eso se valida en vez de dejarlo pasar.
 *
 * Una edad imposible (negativa, o mas de 120) tambien se descarta: significa
 * que el documento o el anio estan mal, y mostrar "-3" seria peor que no
 * mostrar nada.
 *
 * @param {unknown} docNumber
 * @param {number} anioActual
 * @returns {number | null}
 */
export function estimarEdad(docNumber, anioActual) {
	if (!Number.isInteger(anioActual)) return null;

	const nacimiento = estimarAnioNacimiento(docNumber);
	if (nacimiento === null) return null;

	const edad = anioActual - nacimiento;
	return edad >= 0 && edad <= 120 ? edad : null;
}
