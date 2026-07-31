import { describe, it, expect } from 'vitest';
import { toTitleCase } from './formatName.js';

describe('toTitleCase', () => {
	it('capitaliza el nombre que devuelve IspCube', () => {
		expect(toTitleCase('TALONE SANDRA ELIZABETH')).toBe('Talone Sandra Elizabeth');
	});

	it('capitaliza un nombre en minusculas', () => {
		expect(toTitleCase('talone sandra')).toBe('Talone Sandra');
	});

	it('normaliza un nombre en mayusculas y minusculas mezcladas', () => {
		expect(toTitleCase('TaLoNe SaNdRa')).toBe('Talone Sandra');
	});

	it('respeta acentos y enie', () => {
		expect(toTitleCase('MARÍA PEÑA')).toBe('María Peña');
	});

	it('colapsa los espacios multiples', () => {
		expect(toTitleCase('TALONE    SANDRA')).toBe('Talone Sandra');
	});

	it('recorta los espacios de los extremos', () => {
		expect(toTitleCase('  TALONE  ')).toBe('Talone');
	});

	it('sirve una sola palabra', () => {
		expect(toTitleCase('TALONE')).toBe('Talone');
	});

	it('devuelve vacio para un string vacio o de solo espacios', () => {
		expect(toTitleCase('')).toBe('');
		expect(toTitleCase('   ')).toBe('');
	});

	it('devuelve vacio para lo que no es string', () => {
		expect(toTitleCase(null)).toBe('');
		expect(toTitleCase(undefined)).toBe('');
		expect(toTitleCase(42)).toBe('');
	});
});
