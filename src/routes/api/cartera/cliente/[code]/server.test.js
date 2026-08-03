/**
 * Ver el comentario en ../../catalogos/+server.test.js: mismo motivo, mismo
 * patron. Sin la guardia de verificarAsesor, GET /api/cartera/cliente/:code
 * seria un enumerador publico de la base de clientes de Sista.
 */
import { describe, it, expect, vi } from 'vitest';
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
