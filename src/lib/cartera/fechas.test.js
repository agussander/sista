import { describe, it, expect } from 'vitest';
import {
	partesFecha,
	partesFechaHora,
	claveMes,
	mesesEntre,
	sumarMeses,
	compararFechas,
	diasDelMes,
	compararFechaHora
} from './fechas.js';

describe('partesFecha', () => {
	it('parsea el formato con espacio', () => {
		expect(partesFecha('2022-07-15 03:20:21')).toEqual({ anio: 2022, mes: 7, dia: 15 });
	});

	it('parsea el formato ISO con microsegundos', () => {
		expect(partesFecha('2022-07-15T03:20:21.000000Z')).toEqual({ anio: 2022, mes: 7, dia: 15 });
	});

	it('parsea una fecha sin hora', () => {
		expect(partesFecha('2026-03-01')).toEqual({ anio: 2026, mes: 3, dia: 1 });
	});

	it('no corre el dia por zona horaria', () => {
		// Con `new Date(...).getDate()` en UTC-3 esto daria 14.
		expect(partesFecha('2022-07-15T01:00:00.000000Z').dia).toBe(15);
	});

	it('devuelve null ante basura', () => {
		expect(partesFecha('')).toBeNull();
		expect(partesFecha(null)).toBeNull();
		expect(partesFecha(undefined)).toBeNull();
		expect(partesFecha('ayer')).toBeNull();
		expect(partesFecha(20220715)).toBeNull();
	});
});

describe('partesFechaHora', () => {
	it('parsea el formato con espacio', () => {
		expect(partesFechaHora('2026-07-14 18:00:00')).toEqual({
			anio: 2026,
			mes: 7,
			dia: 14,
			hora: 18,
			minuto: 0,
			segundo: 0
		});
	});

	it('parsea el formato ISO con microsegundos', () => {
		expect(partesFechaHora('2022-07-15T03:20:21.000000Z')).toEqual({
			anio: 2022,
			mes: 7,
			dia: 15,
			hora: 3,
			minuto: 20,
			segundo: 21
		});
	});

	it('sin hora, la completa en cero', () => {
		expect(partesFechaHora('2026-03-01')).toEqual({
			anio: 2026,
			mes: 3,
			dia: 1,
			hora: 0,
			minuto: 0,
			segundo: 0
		});
	});

	it('no corre el dia por zona horaria', () => {
		expect(partesFechaHora('2022-07-15T01:00:00.000000Z').dia).toBe(15);
	});

	it('devuelve null ante basura', () => {
		expect(partesFechaHora('')).toBeNull();
		expect(partesFechaHora(null)).toBeNull();
		expect(partesFechaHora(undefined)).toBeNull();
		expect(partesFechaHora('ayer')).toBeNull();
	});
});

describe('claveMes', () => {
	it('arma la clave con el mes en dos digitos', () => {
		expect(claveMes({ anio: 2026, mes: 3, dia: 1 })).toBe('2026-03');
		expect(claveMes({ anio: 2026, mes: 11, dia: 30 })).toBe('2026-11');
	});

	it('devuelve null si las partes son null', () => {
		expect(claveMes(null)).toBeNull();
	});
});

describe('sumarMeses', () => {
	it('suma dentro del mismo anio', () => {
		expect(sumarMeses({ anio: 2026, mes: 3, dia: 15 }, 2)).toEqual({ anio: 2026, mes: 5, dia: 15 });
	});

	it('cruza el fin de anio', () => {
		expect(sumarMeses({ anio: 2026, mes: 11, dia: 5 }, 2)).toEqual({ anio: 2027, mes: 1, dia: 5 });
	});

	it('recorta el dia cuando el mes destino es mas corto', () => {
		// 31 de enero + 1 mes no es el 3 de marzo.
		expect(sumarMeses({ anio: 2026, mes: 1, dia: 31 }, 1)).toEqual({ anio: 2026, mes: 2, dia: 28 });
	});
});

describe('mesesEntre', () => {
	it('cuenta los meses hacia atras desde una fecha', () => {
		expect(mesesEntre({ anio: 2026, mes: 3, dia: 10 }, 3)).toEqual(['2026-01', '2026-02', '2026-03']);
	});

	it('cruza el fin de anio', () => {
		expect(mesesEntre({ anio: 2026, mes: 2, dia: 1 }, 3)).toEqual(['2025-12', '2026-01', '2026-02']);
	});
});

describe('diasDelMes', () => {
	it('devuelve 28 para febrero en un anio no bisiesto', () => {
		expect(diasDelMes(2026, 2)).toBe(28);
	});

	it('devuelve 29 para febrero en un anio bisiesto (regla de 4)', () => {
		expect(diasDelMes(2024, 2)).toBe(29);
	});

	it('devuelve 28 para un siglo no bisiesto (regla de 100)', () => {
		expect(diasDelMes(2100, 2)).toBe(28);
	});

	it('devuelve 29 para un siglo bisiesto (regla de 400)', () => {
		expect(diasDelMes(2000, 2)).toBe(29);
	});

	it('devuelve los dias de un mes no febrero', () => {
		expect(diasDelMes(2026, 4)).toBe(30);
		expect(diasDelMes(2026, 1)).toBe(31);
	});
});

describe('compararFechas', () => {
	it('devuelve negativo cuando a es anterior', () => {
		expect(compararFechas({ anio: 2026, mes: 7, dia: 10 }, { anio: 2026, mes: 7, dia: 15 })).toBeLessThan(0);
	});

	it('devuelve positivo cuando a es posterior', () => {
		expect(compararFechas({ anio: 2026, mes: 7, dia: 15 }, { anio: 2026, mes: 7, dia: 10 })).toBeGreaterThan(0);
	});

	it('devuelve 0 cuando son iguales', () => {
		expect(compararFechas({ anio: 2026, mes: 7, dia: 15 }, { anio: 2026, mes: 7, dia: 15 })).toBe(0);
	});

	it('el anio pesa mas que el mes y el dia', () => {
		expect(compararFechas({ anio: 2027, mes: 1, dia: 1 }, { anio: 2026, mes: 12, dia: 31 })).toBeGreaterThan(0);
	});

	it('el mes pesa mas que el dia', () => {
		expect(compararFechas({ anio: 2026, mes: 8, dia: 1 }, { anio: 2026, mes: 7, dia: 31 })).toBeGreaterThan(0);
	});

	it('compara un 29 de febrero bisiesto contra el 1 de marzo', () => {
		expect(compararFechas({ anio: 2024, mes: 2, dia: 29 }, { anio: 2024, mes: 3, dia: 1 })).toBeLessThan(0);
	});
});

describe('compararFechaHora', () => {
	it('devuelve negativo cuando a es anterior por hora', () => {
		expect(
			compararFechaHora(
				{ anio: 2026, mes: 7, dia: 14, hora: 9, minuto: 0, segundo: 0 },
				{ anio: 2026, mes: 7, dia: 14, hora: 18, minuto: 0, segundo: 0 }
			)
		).toBeLessThan(0);
	});

	it('devuelve positivo cuando a es posterior por hora, mismo dia', () => {
		expect(
			compararFechaHora(
				{ anio: 2026, mes: 7, dia: 14, hora: 18, minuto: 0, segundo: 0 },
				{ anio: 2026, mes: 7, dia: 14, hora: 9, minuto: 0, segundo: 0 }
			)
		).toBeGreaterThan(0);
	});

	it('devuelve 0 para el mismo instante', () => {
		expect(
			compararFechaHora(
				{ anio: 2026, mes: 7, dia: 14, hora: 9, minuto: 0, segundo: 0 },
				{ anio: 2026, mes: 7, dia: 14, hora: 9, minuto: 0, segundo: 0 }
			)
		).toBe(0);
	});

	it('el dia pesa mas que la hora', () => {
		expect(
			compararFechaHora(
				{ anio: 2026, mes: 7, dia: 15, hora: 0, minuto: 0, segundo: 0 },
				{ anio: 2026, mes: 7, dia: 14, hora: 23, minuto: 59, segundo: 59 }
			)
		).toBeGreaterThan(0);
	});
});
