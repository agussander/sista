/**
 * Ver el comentario en ../../catalogos/+server.test.js: mismo motivo, mismo
 * patron. Sin la guardia de verificarPermiso, GET /api/cartera/cliente/:code
 * seria un enumerador publico de la base de clientes de Sista.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { GET } from './+server.js';
import * as ispcube from '$lib/server/ispcube.js';

vi.mock('$lib/server/ispcube.js', () => ({
	getCustomerByCode: vi.fn(async () => {
		throw new Error('getCustomerByCode no debe llamarse sin autenticacion');
	}),
	getTickets: vi.fn(async () => {
		throw new Error('getTickets no debe llamarse sin autenticacion');
	}),
	getCobranzas: vi.fn(async () => {
		throw new Error('getCobranzas no debe llamarse sin autenticacion');
	})
}));

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('GET /api/cartera/cliente/[code] - guardia de autenticacion', () => {
	it('devuelve 401 cuando falta el header Authorization', async () => {
		const request = new Request('http://x/api/cartera/cliente/003566');
		const url = new URL('http://x/api/cartera/cliente/003566');

		const r = await GET({ request, params: { code: '003566' }, url });

		expect(r.status).toBe(401);
	});

	it('no llama a IspCube cuando falta el header Authorization', async () => {
		const request = new Request('http://x/api/cartera/cliente/003566');
		const url = new URL('http://x/api/cartera/cliente/003566');

		await GET({ request, params: { code: '003566' }, url });

		expect(ispcube.getCustomerByCode).not.toHaveBeenCalled();
		expect(ispcube.getTickets).not.toHaveBeenCalled();
		expect(ispcube.getCobranzas).not.toHaveBeenCalled();
	});
});

describe('GET /api/cartera/cliente/[code] - guardia de autorizacion', () => {
	// Ver el comentario en ../../catalogos/+server.test.js: token valido,
	// permiso `cartera` ausente, `fetch` global stubeado para ejercitar el
	// verificarPermiso real.
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
		const request = new Request('http://x/api/cartera/cliente/003566', {
			headers: { Authorization: 'Bearer tok-valido' }
		});
		const url = new URL('http://x/api/cartera/cliente/003566');

		const r = await GET({ request, params: { code: '003566' }, url });

		expect(r.status).toBe(403);
	});

	it('no llama a IspCube cuando falta el permiso cartera', async () => {
		stubFetchSinPermiso();
		const request = new Request('http://x/api/cartera/cliente/003566', {
			headers: { Authorization: 'Bearer tok-valido' }
		});
		const url = new URL('http://x/api/cartera/cliente/003566');

		await GET({ request, params: { code: '003566' }, url });

		expect(ispcube.getCustomerByCode).not.toHaveBeenCalled();
		expect(ispcube.getTickets).not.toHaveBeenCalled();
		expect(ispcube.getCobranzas).not.toHaveBeenCalled();
	});
});
