/**
 * Ver el comentario en ../catalogos/+server.test.js: mismo motivo, mismo
 * patron. POST /api/cartera/sync ademas dispara hasta 60 unidades de cuota
 * de IspCube por llamada, asi que la guardia importa doblemente aca.
 *
 * El body se manda valido (no vacio, no invalido) a proposito: la idea es
 * probar la guardia, no un 400 por body_invalido. El ultimo test prueba
 * ademas el orden: la guardia tiene que correr ANTES de leer el body, para
 * que un pedido sin token no gaste ni siquiera el parseo.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { POST } from './+server.js';
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

const bodyValido = (headers = {}) =>
	new Request('http://x/api/cartera/sync', {
		method: 'POST',
		headers,
		body: JSON.stringify({ codes: ['003566'] })
	});

describe('POST /api/cartera/sync - guardia de autenticacion', () => {
	it('devuelve 401 cuando falta el header Authorization, con un body valido', async () => {
		const r = await POST({ request: bodyValido() });

		expect(r.status).toBe(401);
	});

	it('no llama a IspCube cuando falta el header Authorization', async () => {
		await POST({ request: bodyValido() });

		expect(ispcube.getCustomerByCode).not.toHaveBeenCalled();
		expect(ispcube.getTickets).not.toHaveBeenCalled();
		expect(ispcube.getCobranzas).not.toHaveBeenCalled();
	});

	it('la guardia corre antes de leer el body', async () => {
		const request = bodyValido();
		const jsonSpy = vi.spyOn(request, 'json');

		await POST({ request });

		expect(jsonSpy).not.toHaveBeenCalled();
	});
});

describe('POST /api/cartera/sync - guardia de autorizacion', () => {
	// Ver el comentario en ../catalogos/+server.test.js: token valido, permiso
	// `cartera` ausente, `fetch` global stubeado para ejercitar el
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

		const r = await POST({ request: bodyValido({ Authorization: 'Bearer tok-valido' }) });

		expect(r.status).toBe(403);
	});

	it('no llama a IspCube cuando falta el permiso cartera', async () => {
		stubFetchSinPermiso();

		await POST({ request: bodyValido({ Authorization: 'Bearer tok-valido' }) });

		expect(ispcube.getCustomerByCode).not.toHaveBeenCalled();
		expect(ispcube.getTickets).not.toHaveBeenCalled();
		expect(ispcube.getCobranzas).not.toHaveBeenCalled();
	});
});
