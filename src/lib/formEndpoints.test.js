import { describe, it, expect } from 'vitest';
import { resolveFormEndpoints, PHP_ENDPOINTS, NODE_ENDPOINTS } from './formEndpoints.js';

describe('resolveFormEndpoints', () => {
	it('devuelve los .php cuando el backend no es node', () => {
		expect(resolveFormEndpoints(undefined)).toBe(PHP_ENDPOINTS);
		expect(resolveFormEndpoints('')).toBe(PHP_ENDPOINTS);
		expect(resolveFormEndpoints('php')).toBe(PHP_ENDPOINTS);
	});

	it('devuelve los /api cuando el backend es node', () => {
		expect(resolveFormEndpoints('node')).toBe(NODE_ENDPOINTS);
	});

	it('los dos mapas tienen exactamente las mismas claves', () => {
		expect(Object.keys(NODE_ENDPOINTS).sort()).toEqual(Object.keys(PHP_ENDPOINTS).sort());
	});

	it('cubre los 8 formularios', () => {
		expect(Object.keys(PHP_ENDPOINTS).sort()).toEqual([
			'BAJA',
			'CONTACTO',
			'EMAIL_BAJA',
			'EMPRESAS',
			'LLAMENME',
			'MODAL',
			'TICKET_ISPCUBE',
			'TRABAJO'
		]);
	});

	it('las rutas php apuntan a /assets y las node a /api', () => {
		for (const url of Object.values(PHP_ENDPOINTS)) {
			expect(url.startsWith('/assets/')).toBe(true);
			expect(url.endsWith('.php')).toBe(true);
		}
		for (const url of Object.values(NODE_ENDPOINTS)) {
			expect(url.startsWith('/api/')).toBe(true);
		}
	});
});
