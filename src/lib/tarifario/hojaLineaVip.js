/**
 * Pestaña "Linea VIP - Tarifas Web" del tarifario, rango A1:J18.
 *
 * Copia fija tomada de `docs/Tarifario V26.09  (09-2026).xlsx`. La consumen la
 * página /lineavip y el endpoint /api/lineavip, que tienen que mostrar
 * exactamente lo mismo. Al publicar una version nueva del tarifario hay que
 * actualizar `VIGENCIA`, `VERSION` y los numeros de `PLANES`.
 *
 * Los valores van crudos, sin formatear: el formato "$ #.##0" es cosa de como
 * se pinta la celda, y quien consume la API quiere el numero.
 */

/** Celda B2: el titulo de la hoja. */
export const TITULO = 'Sista s.a. - LINEA VIP';

/** Celda J2: fecha desde la que rigen estos precios. */
export const VIGENCIA = '2026-09-01';

/** Celda J9: la version del tarifario de la que sale esta copia. */
export const VERSION = 26.09;

/**
 * Fila 3 y 4: los encabezados de la tabla, tal cual estan escritos en el Excel.
 * `excedentes` es el titulo de I3:J3, combinada sobre las dos subcolumnas.
 */
export const ENCABEZADOS = {
	nombre: 'Nombre',
	clientes: 'Clientes',
	numeroLocal: 'Número Local',
	cargoInicial: 'Cargo Inicial',
	abonoMensual: 'Abono Mensual',
	minutosLocales: 'Minutos Locales Incluidos',
	llamadasCelulares: 'Llamadas a Celulares',
	excedentes: 'Precio de los Minutos Excedentes',
	excedenteLocal: 'Destino Local',
	excedenteNacional: 'Destino Nacional'
};

/**
 * H5:H8 y J5:J8 estan combinadas en el Excel: un solo valor para los cuatro
 * planes. Se repite en cada plan para que cada fila de la API se lea sola.
 */
export const LLAMADAS_CELULARES = 239.63344364310535; // H5
export const EXCEDENTE_NACIONAL = 29.850532772151535; // J5

/**
 * Filas 5 a 8. `cargoInicial` es número en los planes de radio y el texto "--"
 * en los de fibra, igual que en el Excel.
 *
 * @type {{
 *   nombre: string, clientes: string, numeroLocal: string,
 *   cargoInicial: number | string, abonoMensual: number, minutosLocales: number,
 *   llamadasCelulares: number, excedenteLocal: number, excedenteNacional: number
 * }[]}
 */
export const PLANES = [
	{
		nombre: 'Linea VIP R11',
		clientes: 'Radio',
		numeroLocal: 'AMBA 011',
		cargoInicial: 800,
		abonoMensual: 21451.380500642037,
		minutosLocales: 500,
		llamadasCelulares: LLAMADAS_CELULARES,
		excedenteLocal: 30.04025988144986,
		excedenteNacional: EXCEDENTE_NACIONAL
	},
	{
		nombre: 'Linea VIP R221',
		clientes: 'Radio',
		numeroLocal: 'LP 0221',
		cargoInicial: 800,
		abonoMensual: 10181.007070018002,
		minutosLocales: 500,
		llamadasCelulares: LLAMADAS_CELULARES,
		excedenteLocal: 30.04025988144986,
		excedenteNacional: EXCEDENTE_NACIONAL
	},
	{
		nombre: 'Linea VIP 11',
		clientes: 'Fibra',
		numeroLocal: 'AMBA 011',
		cargoInicial: '--',
		abonoMensual: 21451.380500642037,
		minutosLocales: 500,
		llamadasCelulares: LLAMADAS_CELULARES,
		excedenteLocal: 30.04025988144986,
		excedenteNacional: EXCEDENTE_NACIONAL
	},
	{
		nombre: 'Linea VIP 221',
		clientes: 'Fibra',
		numeroLocal: 'LP 0221',
		cargoInicial: '--',
		abonoMensual: 10181.007070018002,
		minutosLocales: 500,
		llamadasCelulares: LLAMADAS_CELULARES,
		excedenteLocal: 30.04025988144986,
		excedenteNacional: EXCEDENTE_NACIONAL
	}
];

/** Celda B10. Va aparte de las notas porque en el Excel tiene formato propio. */
export const APARATO = 'Aparato telefonico (Opcional): Ver ofertas de vitrina';

/** Celda B12: la nota que remite al cuadro internacional. */
export const NOTA_INTERNACIONAL =
	'El precio de las llamadas internacionales se expresa en U$S según el Cuadro Tarifario Internacional vigente';

/** Celda G13: la URL que el Excel escribe al lado de esa nota. */
export const LINK_INTERNACIONAL = 'www.sista.ar/internacional';

/** Celdas B14, B15, B17 y B18, en el orden del Excel. */
export const NOTAS = [
	'Valores en Pesos ($)',
	'Incluye IVA, del 21 %',
	'Para cada abonado de fibra, se puede incorporar hasta 2 líneas VIP 11 o VIP 221, las dos iguales o una y una',
	'Para cada abonado de ATA se puede incorporar una línea VIP R11 o VIP R221'
];
