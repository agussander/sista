import { describe, it, expect } from 'vitest';
import { dniDe, estimarAnioNacimiento, estimarEdad } from './edad.js';

describe('dniDe', () => {
	it('un DNI de 8 digitos pasa tal cual', () => {
		expect(dniDe('20909528')).toBe(20909528);
	});

	it('saca los puntos de un DNI escrito a mano', () => {
		expect(dniDe('20.909.528')).toBe(20909528);
	});

	it('de un CUIL de persona fisica extrae el DNI del medio', () => {
		expect(dniDe('20-20909528-5')).toBe(20909528);
		expect(dniDe('27-30987654-3')).toBe(30987654);
		expect(dniDe('20209095285')).toBe(20909528);
	});

	it('un CUIT de empresa no es una persona', () => {
		expect(dniDe('30-71234567-8')).toBe(null);
		expect(dniDe('33712345678')).toBe(null);
		expect(dniDe('34712345678')).toBe(null);
	});

	it('vacio, nulo o sin digitos da null', () => {
		expect(dniDe('')).toBe(null);
		expect(dniDe(null)).toBe(null);
		expect(dniDe(undefined)).toBe(null);
		expect(dniDe('sin datos')).toBe(null);
	});

	it('mas de 11 digitos no es ni DNI ni CUIT', () => {
		expect(dniDe('123456789012')).toBe(null);
	});
});

describe('estimarAnioNacimiento', () => {
	it('interpola entre dos anclas', () => {
		// 20.909.528 cae entre 20M (1968) y 22M (1971).
		expect(estimarAnioNacimiento('20909528')).toBe(1969);
	});

	it('sobre un ancla exacta devuelve su anio', () => {
		expect(estimarAnioNacimiento('30000000')).toBe(1983);
		expect(estimarAnioNacimiento('44000000')).toBe(2002);
	});

	it('la serie de extranjeros (90M+) no se estima', () => {
		expect(estimarAnioNacimiento('95000000')).toBe(null);
	});

	it('por debajo de la primera ancla no se estima', () => {
		expect(estimarAnioNacimiento('500000')).toBe(null);
	});

	it('por encima de la ultima ancla no se extrapola', () => {
		expect(estimarAnioNacimiento('70000000')).toBe(null);
	});

	it('funciona igual entrando por un CUIL', () => {
		expect(estimarAnioNacimiento('20-20909528-5')).toBe(1969);
	});
});

describe('estimarEdad', () => {
	it('resta el anio de nacimiento al anio actual', () => {
		expect(estimarEdad('20909528', 2026)).toBe(57);
	});

	it('sin estimacion de nacimiento, sin edad', () => {
		expect(estimarEdad('95000000', 2026)).toBe(null);
		expect(estimarEdad('', 2026)).toBe(null);
	});

	it('una edad imposible se descarta en vez de mostrarse', () => {
		expect(estimarEdad('30000000', 1950)).toBe(null);
	});
});
