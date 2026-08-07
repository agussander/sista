import { describe, it, expect } from 'vitest';
import { paginasVisibles, POR_PAGINA } from './paginacion.js';

describe('paginasVisibles', () => {
	it('con pocas paginas las muestra todas, sin elipsis', () => {
		expect(paginasVisibles(1, 5)).toEqual([1, 2, 3, 4, 5]);
		expect(paginasVisibles(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
	});

	it('con una sola pagina devuelve solo esa', () => {
		expect(paginasVisibles(1, 1)).toEqual([1]);
	});

	it('sin paginas devuelve una lista vacia', () => {
		expect(paginasVisibles(1, 0)).toEqual([]);
	});

	it('parado al principio, la elipsis va del lado derecho', () => {
		expect(paginasVisibles(1, 10)).toEqual([1, 2, '…', 10]);
	});

	it('parado en el medio, hay elipsis de los dos lados', () => {
		expect(paginasVisibles(5, 10)).toEqual([1, '…', 4, 5, 6, '…', 10]);
	});

	it('parado al final, la elipsis va del lado izquierdo', () => {
		expect(paginasVisibles(10, 10)).toEqual([1, '…', 9, 10]);
	});

	it('no pone elipsis por un solo numero salteado', () => {
		// El hueco entre 1 y 3 es un solo numero: se dibuja el 2, no "…".
		expect(paginasVisibles(4, 8)).toEqual([1, 2, 3, 4, 5, '…', 8]);
		expect(paginasVisibles(3, 8)).toEqual([1, 2, 3, 4, '…', 8]);
	});

	it('el umbral de las siete paginas es exacto', () => {
		expect(paginasVisibles(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
		expect(paginasVisibles(4, 8)).toContain('…');
	});

	it('nunca repite un numero ni sale desordenado', () => {
		for (let total = 1; total <= 40; total++) {
			for (let actual = 1; actual <= total; actual++) {
				const salida = paginasVisibles(actual, total);
				const numeros = salida.filter((n) => n !== '…');

				expect(new Set(numeros).size).toBe(numeros.length);
				expect([...numeros].sort((a, b) => a - b)).toEqual(numeros);
				// La actual, la primera y la ultima siempre son alcanzables de un click.
				expect(numeros).toContain(actual);
				expect(numeros).toContain(1);
				expect(numeros).toContain(total);
				// Dos elipsis seguidas no tienen sentido.
				expect(salida.some((n, i) => n === '…' && salida[i - 1] === '…')).toBe(false);
			}
		}
	});
});

describe('POR_PAGINA', () => {
	it('son 20', () => {
		expect(POR_PAGINA).toBe(20);
	});
});
