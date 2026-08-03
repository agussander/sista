import { describe, it, expect } from 'vitest';
import { verificarPermiso } from './adminAuth.js';

const PB = 'https://sista.pockethost.io';

const res = (status, body) => ({
	ok: status >= 200 && status < 300,
	status,
	json: async () => body
});

const pedido = (auth) => ({ headers: { get: (k) => (k.toLowerCase() === 'authorization' ? auth : null) } });

describe('verificarPermiso', () => {
	it('devuelve el id del usuario cuando el token es valido y tiene el permiso pedido', async () => {
		const r = await verificarPermiso(pedido('Bearer tok-123'), PB, 'cartera', {
			fetchImpl: async () => res(200, { record: { id: 'user-1', permisos: ['cartera'] }, token: 'tok-nuevo' })
		});

		expect(r).toEqual({ ok: true, usuarioId: 'user-1' });
	});

	it('manda el token a PocketBase en el header Authorization', async () => {
		const calls = [];
		await verificarPermiso(pedido('Bearer tok-123'), PB, 'cartera', {
			fetchImpl: async (url, init) => {
				calls.push({ url, init });
				return res(200, { record: { id: 'user-1', permisos: ['cartera'] } });
			}
		});

		expect(calls[0].url).toBe(`${PB}/api/collections/users/auth-refresh`);
		expect(calls[0].init.headers.Authorization).toBe('tok-123');
	});

	it('rechaza cuando no hay header', async () => {
		const r = await verificarPermiso(pedido(null), PB, 'cartera', { fetchImpl: async () => res(200, {}) });
		expect(r).toEqual({ ok: false, reason: 'sin_token' });
	});

	it('rechaza un header que no es Bearer', async () => {
		const r = await verificarPermiso(pedido('Basic abc'), PB, 'cartera', { fetchImpl: async () => res(200, {}) });
		expect(r).toEqual({ ok: false, reason: 'sin_token' });
	});

	it('rechaza un token que PocketBase no valida', async () => {
		const r = await verificarPermiso(pedido('Bearer viejo'), PB, 'cartera', {
			fetchImpl: async () => res(401, { message: 'no' })
		});

		expect(r).toEqual({ ok: false, reason: 'token_invalido' });
	});

	it('rechaza si PocketBase responde sin record', async () => {
		const r = await verificarPermiso(pedido('Bearer tok'), PB, 'cartera', {
			fetchImpl: async () => res(200, {})
		});

		expect(r).toEqual({ ok: false, reason: 'token_invalido' });
	});

	it('devuelve reason network si no se pudo preguntar', async () => {
		const r = await verificarPermiso(pedido('Bearer tok'), PB, 'cartera', {
			fetchImpl: async () => {
				throw new Error('ECONNRESET');
			}
		});

		expect(r).toEqual({ ok: false, reason: 'network' });
	});

	// --- Autorizacion por permiso: esta es la parte nueva, la que cierra el
	// agujero de "cualquier sesion valida entra". ---

	it('rechaza con sin_permiso si el record no tiene el permiso pedido', async () => {
		const r = await verificarPermiso(pedido('Bearer tok'), PB, 'cartera', {
			fetchImpl: async () => res(200, { record: { id: 'user-1', permisos: ['precios', 'novedades'] } })
		});

		expect(r).toEqual({ ok: false, reason: 'sin_permiso' });
	});

	it('rechaza con sin_permiso si el record no tiene el campo permisos', async () => {
		const r = await verificarPermiso(pedido('Bearer tok'), PB, 'cartera', {
			fetchImpl: async () => res(200, { record: { id: 'user-1' } })
		});

		expect(r).toEqual({ ok: false, reason: 'sin_permiso' });
	});

	it('rechaza con sin_permiso si permisos es un array vacio', async () => {
		const r = await verificarPermiso(pedido('Bearer tok'), PB, 'cartera', {
			fetchImpl: async () => res(200, { record: { id: 'user-1', permisos: [] } })
		});

		expect(r).toEqual({ ok: false, reason: 'sin_permiso' });
	});

	it('autoriza cuando permisos contiene el permiso pedido junto con otros', async () => {
		const r = await verificarPermiso(pedido('Bearer tok'), PB, 'cartera', {
			fetchImpl: async () => res(200, { record: { id: 'user-1', permisos: ['precios', 'cartera'] } })
		});

		expect(r).toEqual({ ok: true, usuarioId: 'user-1' });
	});
});
