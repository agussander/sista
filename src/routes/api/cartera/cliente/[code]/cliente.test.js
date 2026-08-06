/**
 * Comportamiento de GET /api/cartera/cliente/[code] con verificarPermiso
 * mockeado (la guardia ya esta cubierta en server.test.js).
 */
import { describe, it, expect, vi } from 'vitest';
import { GET } from './+server.js';
import { getCustomerByCode, getTickets, getCobranzas, getPlanCatalog } from '$lib/server/ispcube.js';

vi.mock('$lib/server/adminAuth.js', () => ({
	verificarPermiso: vi.fn(async () => ({ ok: true, usuarioId: 'usuario-1' }))
}));

vi.mock('$lib/server/ispcube.js', () => ({
	getCustomerByCode: vi.fn(),
	getTickets: vi.fn(),
	getCobranzas: vi.fn(),
	getPlanCatalog: vi.fn()
}));

const get = (qs = '') =>
	GET({
		request: new Request(`http://x/api/cartera/cliente/003566${qs}`),
		params: { code: '003566' },
		url: new URL(`http://x/api/cartera/cliente/003566${qs}`)
	});

describe('GET /api/cartera/cliente/[code] - alta_nap', () => {
	it('suma alta_nap a la respuesta, leido del mismo getTickets que ya se pedia', async () => {
		vi.mocked(getCustomerByCode).mockResolvedValue({
			ok: true,
			customer: { code: '003566', name: 'CLIENTE', status: 'enabled', crudo: { code: '003566', name: 'CLIENTE', status: 'enabled' } }
		});
		vi.mocked(getTickets).mockResolvedValue({
			ok: true,
			tickets: [
				{
					id: 1,
					ticket_category_id: 69,
					ticket_status_id: 8,
					created_at: '2026-08-01T10:00:00.000000Z',
					closed_date: null
				}
			]
		});
		vi.mocked(getCobranzas).mockResolvedValue({ ok: true, cobranzas: [] });
		vi.mocked(getPlanCatalog).mockResolvedValue({ ok: true, porId: new Map() });

		const r = await get('?cerrados=3');

		expect(r.status).toBe(200);
		const body = await r.json();
		expect(body.alta_nap).toEqual({ existe: true, cerrado: false, anulado: true, closed_date: '' });
	});
});
