import { describe, it, expect } from 'vitest';
import { partesFecha, claveMes, mesesEntre, sumarMeses } from './fechas.js';

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
