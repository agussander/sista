import { describe, it, expect } from 'vitest';
import { PERMISOS, tienePermiso } from './adminPermisos.js';

describe('PERMISOS', () => {
	it('incluye cartera, la seccion nueva que exige el guardia de la Cartera', () => {
		expect(PERMISOS).toContain('cartera');
	});

	it('no tiene claves repetidas', () => {
		expect(new Set(PERMISOS).size).toBe(PERMISOS.length);
	});

	it('son todas strings no vacias', () => {
		for (const p of PERMISOS) {
			expect(typeof p).toBe('string');
			expect(p.length).toBeGreaterThan(0);
		}
	});
});

describe('tienePermiso', () => {
	it('devuelve false cuando permisos es undefined', () => {
		expect(tienePermiso(undefined, 'cartera')).toBe(false);
	});

	it('devuelve false cuando permisos es null', () => {
		expect(tienePermiso(null, 'cartera')).toBe(false);
	});

	it('devuelve false cuando permisos es un array vacio', () => {
		// Este es el caso critico: sin permisos cargados, sin acceso a nada.
		// Si esto devolviera true, "no configurado" equivaldria a "todo
		// permitido" y se reabriria el agujero que este archivo cierra.
		expect(tienePermiso([], 'cartera')).toBe(false);
	});

	it('devuelve false cuando permisos no es un array (string suelto)', () => {
		expect(tienePermiso('cartera', 'cartera')).toBe(false);
	});

	it('devuelve false cuando permisos no es un array (objeto)', () => {
		expect(tienePermiso({ cartera: true }, 'cartera')).toBe(false);
	});

	it('devuelve false cuando permisos no es un array (numero)', () => {
		expect(tienePermiso(42, 'cartera')).toBe(false);
	});

	it('devuelve false cuando el array tiene otros permisos pero no el pedido', () => {
		expect(tienePermiso(['precios', 'novedades'], 'cartera')).toBe(false);
	});

	it('devuelve true cuando el array contiene el permiso pedido', () => {
		expect(tienePermiso(['precios', 'cartera'], 'cartera')).toBe(true);
	});

	it('no explota con elementos no-string mezclados en el array', () => {
		expect(tienePermiso([null, 42, {}, 'cartera'], 'cartera')).toBe(true);
		expect(tienePermiso([null, 42, {}], 'cartera')).toBe(false);
	});
});
