/**
 * Comportamiento de /api/cartera/candidatos con verificarPermiso mockeado
 * (la guardia ya esta cubierta en server.test.js) y getCustomersPage
 * mockeado para controlar el paginado sin pegarle a IspCube.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './+server.js';
import { getCustomersPage } from '$lib/server/ispcube.js';

vi.mock('$lib/server/adminAuth.js', () => ({
	verificarPermiso: vi.fn(async () => ({ ok: true, usuarioId: 'usuario-1' }))
}));

vi.mock('$lib/server/ispcube.js', () => ({
	getCustomersPage: vi.fn()
}));

const get = (qs) => GET({ request: new Request(`http://x${qs}`), url: new URL(`http://x${qs}`) });

beforeEach(() => {
	vi.mocked(getCustomersPage).mockReset();
});

describe('GET /api/cartera/candidatos - validacion de query params', () => {
	it('vendedor ausente o no numerico da 400', async () => {
		const r = await get('/api/cartera/candidatos?antes=2026-07-01');
		expect(r.status).toBe(400);
		expect((await r.json()).error).toBe('vendedor_invalido');
	});

	it('antes ausente o mal formado da 400', async () => {
		const r = await get('/api/cartera/candidatos?vendedor=64');
		expect(r.status).toBe(400);
		expect((await r.json()).error).toBe('antes_invalido');
	});
});

describe('GET /api/cartera/candidatos - filtrado y paginado', () => {
	const cliente = (over = {}) => ({
		id: 1,
		code: '000001',
		name: 'CLIENTE UNO',
		status: 'enabled',
		start_date: '2026-08-01 00:00:00',
		seller_id: 64,
		entity_id: null,
		debt: '0.00',
		duedebt: '0.00',
		connections: [],
		...over
	});

	it('filtra por seller_id, descarta a los de otro vendedor', async () => {
		vi.mocked(getCustomersPage)
			.mockResolvedValueOnce({
				ok: true,
				customers: [cliente({ code: '000001', seller_id: 64 }), cliente({ code: '000002', seller_id: 6 })]
			})
			.mockResolvedValue({ ok: true, customers: [] });

		const r = await get('/api/cartera/candidatos?vendedor=64&antes=2026-01-01');
		const body = await r.json();

		expect(body.candidatos.map((c) => c.code)).toEqual(['000001']);
	});

	it('descarta candidatos con start_date anterior a antes', async () => {
		vi.mocked(getCustomersPage)
			.mockResolvedValueOnce({
				ok: true,
				customers: [cliente({ code: '000001', seller_id: 64, start_date: '2025-01-01 00:00:00' })]
			})
			.mockResolvedValue({ ok: true, customers: [] });

		const r = await get('/api/cartera/candidatos?vendedor=64&antes=2026-01-01');
		const body = await r.json();

		expect(body.candidatos).toEqual([]);
	});

	it('corta de pedir mas paginas cuando la ultima fecha de la pagina ya es anterior a antes', async () => {
		vi.mocked(getCustomersPage).mockResolvedValue({
			ok: true,
			customers: Array.from({ length: 100 }, (_, i) =>
				cliente({ code: String(i).padStart(6, '0'), seller_id: 64, start_date: '2025-01-01 00:00:00' })
			)
		});

		await get('/api/cartera/candidatos?vendedor=64&antes=2026-01-01');

		expect(getCustomersPage).toHaveBeenCalledTimes(1);
	});

	it('respeta el tope duro de paginas aunque toda la pagina siga siendo reciente', async () => {
		vi.mocked(getCustomersPage).mockResolvedValue({
			ok: true,
			customers: Array.from({ length: 100 }, (_, i) =>
				cliente({ code: String(i).padStart(6, '0'), seller_id: 6, start_date: '2026-08-01 00:00:00' })
			)
		});

		await get('/api/cartera/candidatos?vendedor=64&antes=2026-01-01');

		expect(getCustomersPage).toHaveBeenCalledTimes(5);
	});
});
