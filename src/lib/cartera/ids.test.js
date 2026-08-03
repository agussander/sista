import { describe, it, expect } from 'vitest';
import { idsFinitos, parseIds } from './ids.js';

describe('idsFinitos', () => {
	it('coerciona numeros y strings numericas', () => {
		expect(idsFinitos([6, '9', 12.5])).toEqual([6, 9, 12.5]);
	});

	it('descarta lo que no es un numero finito', () => {
		expect(idsFinitos(['x', undefined, NaN, Infinity])).toEqual([]);
	});

	it('null coercina a 0, igual que Number(null)', () => {
		// Number(null) es 0, no NaN: no es un caso especial de idsFinitos, es
		// el comportamiento normal de Number() que ya tenia parseIds.
		expect(idsFinitos([null])).toEqual([0]);
	});

	it('descarta un item hostil sin tumbar a los demas', () => {
		// Sin toString ni valueOf invocables: Number(x) tira TypeError en vez de
		// devolver NaN. Esto es justo lo que JSON.parse puede producir con
		// {"toString": 1, "valueOf": 2}.
		const hostil = { toString: 1, valueOf: 2 };
		expect(idsFinitos([6, hostil, 9])).toEqual([6, 9]);
	});

	it('array vacio da lista vacia', () => {
		expect(idsFinitos([])).toEqual([]);
	});
});

describe('parseIds', () => {
	it('parsea una lista separada por comas', () => {
		expect(parseIds('6,9')).toEqual([6, 9]);
	});

	it('recorta espacios', () => {
		expect(parseIds(' 6 , 9 ')).toEqual([6, 9]);
	});

	it('vacio o null da lista vacia', () => {
		expect(parseIds('')).toEqual([]);
		expect(parseIds(null)).toEqual([]);
	});
});
