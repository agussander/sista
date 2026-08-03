import { describe, it, expect } from 'vitest';
import { verificarAsesor } from './adminAuth.js';

const PB = 'https://sista.pockethost.io';

const res = (status, body) => ({
	ok: status >= 200 && status < 300,
	status,
	json: async () => body
});

const pedido = (auth) => ({ headers: { get: (k) => (k.toLowerCase() === 'authorization' ? auth : null) } });

describe('verificarAsesor', () => {
	it('devuelve el id del asesor con un token valido', async () => {
		const r = await verificarAsesor(pedido('Bearer tok-123'), PB, {
			fetchImpl: async () => res(200, { record: { id: 'user-1' }, token: 'tok-nuevo' })
		});

		expect(r).toEqual({ ok: true, asesorId: 'user-1' });
	});

	it('manda el token a PocketBase en el header Authorization', async () => {
		const calls = [];
		await verificarAsesor(pedido('Bearer tok-123'), PB, {
			fetchImpl: async (url, init) => {
				calls.push({ url, init });
				return res(200, { record: { id: 'user-1' } });
			}
		});

		expect(calls[0].url).toBe(`${PB}/api/collections/users/auth-refresh`);
		expect(calls[0].init.headers.Authorization).toBe('tok-123');
	});

	it('rechaza cuando no hay header', async () => {
		const r = await verificarAsesor(pedido(null), PB, { fetchImpl: async () => res(200, {}) });
		expect(r).toEqual({ ok: false, reason: 'sin_token' });
	});

	it('rechaza un header que no es Bearer', async () => {
		const r = await verificarAsesor(pedido('Basic abc'), PB, { fetchImpl: async () => res(200, {}) });
		expect(r).toEqual({ ok: false, reason: 'sin_token' });
	});

	it('rechaza un token que PocketBase no valida', async () => {
		const r = await verificarAsesor(pedido('Bearer viejo'), PB, {
			fetchImpl: async () => res(401, { message: 'no' })
		});

		expect(r).toEqual({ ok: false, reason: 'token_invalido' });
	});

	it('rechaza si PocketBase responde sin record', async () => {
		const r = await verificarAsesor(pedido('Bearer tok'), PB, {
			fetchImpl: async () => res(200, {})
		});

		expect(r).toEqual({ ok: false, reason: 'token_invalido' });
	});

	it('devuelve reason network si no se pudo preguntar', async () => {
		const r = await verificarAsesor(pedido('Bearer tok'), PB, {
			fetchImpl: async () => {
				throw new Error('ECONNRESET');
			}
		});

		expect(r).toEqual({ ok: false, reason: 'network' });
	});
});
