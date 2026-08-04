/**
 * La guardia de `verificarPermiso` es la unica proteccion de este endpoint:
 * sin ella, GET /api/cartera/tickets/[code] expone el hilo completo de los
 * tickets de cualquier cliente -incluidos los comentarios internos- a
 * cualquiera con acceso a la red. Los tests de autenticacion afirman ademas
 * que no se llamo a IspCube: eso es lo que demuestra que no se filtro nada y
 * que no se gasto cuota (la API se factura por request).
 *
 * El resto cubre el modo degradado: catalogos caidos tiene que devolver los
 * tickets igual, porque perder los nombres es peor pantalla, y no traer los
 * tickets es ninguna.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET, _resetCacheCatalogos } from './+server.js';
import * as ispcube from '$lib/server/ispcube.js';

vi.mock('$lib/server/ispcube.js', () => ({
	getTickets: vi.fn(async () => ({ ok: true, tickets: [] })),
	getCatalogosTickets: vi.fn(async () => ({
		ok: true,
		categorias: [{ id: 3, name: 'Sin servicio', color: '#f00' }],
		estados: [{ id: 1, name: 'Abierto' }],
		prioridades: [],
		areas: []
	}))
}));

vi.mock('$lib/server/ispcubeDeps.js', () => ({
	ispcubeConfig: () => ({ baseUrl: 'http://ispcube', usuario: 'u', password: 'p' }),
	pocketbaseUrl: () => 'http://pb'
}));

const TICKET = {
	id: 100,
	ticket_category_id: 3,
	ticket_status_id: 1,
	created_at: '2026-07-01T10:00:00.000000Z',
	items: [{ content: 'nota interna', created_at: '2026-07-01 10:05:00' }]
};

/** Request con un token que PocketBase confirma y que tiene el permiso. */
function pedido(query = '') {
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => ({
			ok: true,
			status: 200,
			json: async () => ({ record: { id: 'user-1', permisos: ['cartera'] } })
		}))
	);
	return {
		request: new Request(`http://x/api/cartera/tickets/0001234${query}`, {
			headers: { Authorization: 'Bearer tok-valido' }
		}),
		params: { code: '0001234' },
		url: new URL(`http://x/api/cartera/tickets/0001234${query}`)
	};
}

beforeEach(() => {
	_resetCacheCatalogos();
	vi.clearAllMocks();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('GET /api/cartera/tickets/[code] - guardias', () => {
	it('devuelve 401 cuando falta el header Authorization', async () => {
		const request = new Request('http://x/api/cartera/tickets/0001234');

		const r = await GET({ request, params: { code: '0001234' }, url: new URL('http://x/') });

		expect(r.status).toBe(401);
		expect(ispcube.getTickets).not.toHaveBeenCalled();
	});

	it('devuelve 403 cuando el token es valido pero falta el permiso cartera', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => ({
				ok: true,
				status: 200,
				json: async () => ({ record: { id: 'user-1', permisos: ['precios'] } })
			}))
		);
		const request = new Request('http://x/api/cartera/tickets/0001234', {
			headers: { Authorization: 'Bearer tok-valido' }
		});

		const r = await GET({ request, params: { code: '0001234' }, url: new URL('http://x/') });

		expect(r.status).toBe(403);
		expect(ispcube.getTickets).not.toHaveBeenCalled();
	});
});

describe('GET /api/cartera/tickets/[code] - respuesta', () => {
	it('devuelve los tickets normalizados con los nombres del catalogo', async () => {
		ispcube.getTickets.mockResolvedValueOnce({ ok: true, tickets: [TICKET] });

		const r = await GET(pedido());
		const body = await r.json();

		expect(r.status).toBe(200);
		expect(body.catalogos).toBe(true);
		expect(body.tickets).toHaveLength(1);
		expect(body.tickets[0].categoria.nombre).toBe('Sin servicio');
		expect(body.tickets[0].hilo[0].texto).toBe('nota interna');
	});

	it('marca cerrado segun el query param cerrados', async () => {
		ispcube.getTickets.mockResolvedValueOnce({ ok: true, tickets: [TICKET] });

		const body = await (await GET(pedido('?cerrados=1,5'))).json();

		expect(body.tickets[0].cerrado).toBe(true);
	});

	it('devuelve 502 cuando IspCube no responde los tickets', async () => {
		ispcube.getTickets.mockResolvedValueOnce({ ok: false, reason: 'api' });

		const r = await GET(pedido());

		expect(r.status).toBe(502);
		expect(ispcube.getCatalogosTickets).not.toHaveBeenCalled();
	});

	it('no gasta requests de catalogos cuando el cliente no tiene tickets', async () => {
		ispcube.getTickets.mockResolvedValueOnce({ ok: true, tickets: [] });

		const body = await (await GET(pedido())).json();

		expect(body.tickets).toEqual([]);
		expect(ispcube.getCatalogosTickets).not.toHaveBeenCalled();
	});
});

describe('GET /api/cartera/tickets/[code] - catalogos', () => {
	it('devuelve los tickets igual cuando los catalogos fallan', async () => {
		ispcube.getTickets.mockResolvedValue({ ok: true, tickets: [TICKET] });
		ispcube.getCatalogosTickets.mockResolvedValueOnce({ ok: false, reason: 'api' });

		const r = await GET(pedido());
		const body = await r.json();

		expect(r.status).toBe(200);
		expect(body.catalogos).toBe(false);
		expect(body.tickets[0].categoria).toEqual({ id: 3, nombre: '', color: '' });
	});

	it('no cachea el fallo: el pedido siguiente vuelve a intentar', async () => {
		ispcube.getTickets.mockResolvedValue({ ok: true, tickets: [TICKET] });
		ispcube.getCatalogosTickets.mockResolvedValueOnce({ ok: false, reason: 'api' });

		await GET(pedido());
		const body = await (await GET(pedido())).json();

		expect(ispcube.getCatalogosTickets).toHaveBeenCalledTimes(2);
		expect(body.catalogos).toBe(true);
	});

	it('cachea el exito: el pedido siguiente no vuelve a pedirlos', async () => {
		ispcube.getTickets.mockResolvedValue({ ok: true, tickets: [TICKET] });

		await GET(pedido());
		const body = await (await GET(pedido())).json();

		expect(ispcube.getCatalogosTickets).toHaveBeenCalledTimes(1);
		expect(body.tickets[0].categoria.nombre).toBe('Sin servicio');
	});
});
