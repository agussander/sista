import { describe, expect, it } from 'vitest';
import { formatearFecha } from './formato.js';

describe('formatearFecha', () => {
	it('pasa de ISO a DD/MM/AAAA', () => {
		expect(formatearFecha('2026-08-01')).toBe('01/08/2026');
		expect(formatearFecha('2026-06-01')).toBe('01/06/2026');
	});

	// No se construye un Date: `new Date('2026-08-01')` es medianoche UTC y en
	// Argentina (UTC-3) se lee como el 31/07.
	it('no corre la fecha por zona horaria', () => {
		expect(formatearFecha('2026-01-01')).toBe('01/01/2026');
	});

	it('devuelve null si no hay fecha o no tiene el formato esperado', () => {
		expect(formatearFecha(null)).toBe(null);
		expect(formatearFecha('')).toBe(null);
		expect(formatearFecha('agosto 2026')).toBe(null);
	});
});
