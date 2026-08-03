import { describe, it, expect } from 'vitest';
import { PERMISOS, tienePermiso, PERMISO_POR_SECCION, seccionPermitida } from './adminPermisos.js';

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

describe('PERMISO_POR_SECCION', () => {
	it('mapea las dos entradas de encuesta de calidad al mismo permiso', () => {
		expect(PERMISO_POR_SECCION.formulario_calidad).toBe('encuestas');
		expect(PERMISO_POR_SECCION.formulario_calidad_2).toBe('encuestas');
	});

	it('mapea el sorteo de conectarlaciudad al permiso de conectarlaciudad', () => {
		expect(PERMISO_POR_SECCION['sorteo-conectarlaciudad']).toBe('conectarlaciudad');
	});

	it('cada valor es uno de PERMISOS', () => {
		for (const clave of Object.values(PERMISO_POR_SECCION)) {
			expect(PERMISOS).toContain(clave);
		}
	});
});

describe('seccionPermitida', () => {
	it('devuelve true cuando el permiso de la seccion esta en la lista', () => {
		expect(seccionPermitida('cartera', ['cartera'])).toBe(true);
	});

	it('devuelve false cuando falta el permiso', () => {
		expect(seccionPermitida('cartera', ['precios'])).toBe(false);
	});

	it('devuelve false ante permisos vacios o mal formados', () => {
		expect(seccionPermitida('cartera', [])).toBe(false);
		expect(seccionPermitida('cartera', null)).toBe(false);
		expect(seccionPermitida('cartera', undefined)).toBe(false);
	});

	it('las dos entradas de encuesta de calidad comparten el permiso encuestas', () => {
		expect(seccionPermitida('formulario_calidad', ['encuestas'])).toBe(true);
		expect(seccionPermitida('formulario_calidad_2', ['encuestas'])).toBe(true);
	});

	it('devuelve false ante una seccion desconocida, no true', () => {
		// Fail closed: una seccion sin declarar en PERMISO_POR_SECCION no se
		// muestra "porque no se sabe que pedirle", no se muestra igual.
		expect(seccionPermitida('seccion-inventada', ['precios', 'cartera'])).toBe(false);
	});

	it('devuelve false ante una seccion que no es string', () => {
		expect(seccionPermitida(null, ['cartera'])).toBe(false);
		expect(seccionPermitida(undefined, ['cartera'])).toBe(false);
	});
});
