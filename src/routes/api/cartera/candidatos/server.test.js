/**
 * Ver el comentario en ../catalogos/server.test.js: mismo motivo, mismo
 * patron. El comportamiento (paginado, filtro por vendedor, corte por
 * `antes` y por tope de paginas) se prueba aparte, en candidatos.test.js,
 * con verificarPermiso mockeado.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { GET } from './+server.js';
import * as ispcube from '$lib/server/ispcube.js';

vi.mock('$lib/server/ispcube.js', () => ({
	getCustomersPage: vi.fn(async () => {
		throw new Error('getCustomersPage no debe llamarse sin autenticacion');
	})
}));

afterEach(() => {
	vi.unstubAllGlobals();
});

const get = (qs, headers = {}) =>
	GET({ request: new Request(`http://x${qs}`, { headers }), url: new URL(`http://x${qs}`) });

describe('GET /api/cartera/candidatos - guardia de autenticacion', () => {
	it('devuelve 401 cuando falta el header Authorization', async () => {
		const r = await get('/api/cartera/candidatos?vendedor=64&antes=2026-07-01');
		expect(r.status).toBe(401);
	});

	it('no llama a IspCube cuando falta el header Authorization', async () => {
		await get('/api/cartera/candidatos?vendedor=64&antes=2026-07-01');
		expect(ispcube.getCustomersPage).not.toHaveBeenCalled();
	});
});

describe('GET /api/cartera/candidatos - guardia de autorizacion', () => {
	const stubFetchSinPermiso = () =>
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => ({
				ok: true,
				status: 200,
				json: async () => ({ record: { id: 'user-1', permisos: ['precios'] } })
			}))
		);

	it('devuelve 403 cuando el token es valido pero falta el permiso cartera', async () => {
		stubFetchSinPermiso();
		const r = await get('/api/cartera/candidatos?vendedor=64&antes=2026-07-01', {
			Authorization: 'Bearer tok-valido'
		});
		expect(r.status).toBe(403);
	});
});
