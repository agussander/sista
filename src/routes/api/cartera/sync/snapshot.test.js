/**
 * `snapshotDe` prometia "nunca lanza" y no era cierto: `String()`/`Number()`
 * tiran `TypeError` ante un objeto sin `toString` ni `valueOf` invocables, y
 * `JSON.parse` puede producir exactamente eso. Estos tests cubren las dos
 * mitades del arreglo:
 *
 *   - el body de POST /api/cartera/sync se valida en el borde (`idsFinitos`),
 *     asi que un `areasSoporte` hostil no llega a `resumenTickets`;
 *   - `snapshotDe` atrapa lo que igual pueda tirar mas adelante (datos
 *     hostiles que vengan de IspCube, fuera de nuestro control), y ese
 *     cliente degrada a `{ok: false}` sin tumbar al resto del lote.
 *
 * La guardia de autenticacion ya esta cubierta en server.test.js; aca se
 * mockea verificarPermiso para poder llegar a `snapshotDe` con distintos
 * datos.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './+server.js';
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

/** Cliente sano, sin nada hostil, para no tener que repetirlo en cada test. */
const clienteSano = (code) => ({
	ok: true,
	customer: {
		code,
		name: `CLIENTE ${code}`,
		status: 'enabled',
		crudo: { code, name: `CLIENTE ${code}`, status: 'enabled', debt: 100, duedebt: 0 }
	}
});

const post = (body) =>
	POST({
		request: new Request('http://x/api/cartera/sync', {
			method: 'POST',
			body: JSON.stringify(body)
		})
	});

beforeEach(() => {
	vi.mocked(getCustomerByCode).mockReset();
	vi.mocked(getTickets).mockReset();
	vi.mocked(getCobranzas).mockReset();
	vi.mocked(getPlanCatalog).mockReset();
	vi.mocked(getTickets).mockResolvedValue({ ok: true, tickets: [] });
	vi.mocked(getCobranzas).mockResolvedValue({ ok: true, cobranzas: [] });
	vi.mocked(getPlanCatalog).mockResolvedValue({ ok: true, porId: new Map() });
});

describe('POST /api/cartera/sync - validacion del body', () => {
	it('un areasSoporte hostil no tumba el request con un 500', async () => {
		vi.mocked(getCustomerByCode).mockResolvedValue(clienteSano('003566'));

		const r = await post({
			codes: ['003566'],
			// Sin toString ni valueOf invocables: String(x) tiraria TypeError si
			// esto llegara crudo a resumenTickets.
			areasSoporte: [{ toString: 1, valueOf: 1 }]
		});

		expect(r.status).toBe(200);
		const body = await r.json();
		expect(body.resultados).toEqual([expect.objectContaining({ code: '003566', ok: true })]);
	});

	it('cuenta el tope de codigos sobre el array crudo, antes de filtrar por tipo', async () => {
		// 20 numeros (invalidos, se descartan al filtrar) + 5 strings validos:
		// el array crudo tiene 25 elementos, mas que MAX_CODIGOS (20). Con el
		// chequeo hecho despues del filtro esto pasaba, porque quedaban 5.
		const codes = [...Array(20).keys(), '000001', '000002', '000003', '000004', '000005'];

		const r = await post({ codes });

		expect(r.status).toBe(400);
		const body = await r.json();
		expect(body.error).toBe('demasiados_codigos');
		expect(getCustomerByCode).not.toHaveBeenCalled();
	});
});

describe('POST /api/cartera/sync - resiliencia de snapshotDe', () => {
	it('un cliente con datos hostiles de IspCube degrada a ok:false sin tumbar el resto del lote', async () => {
		vi.mocked(getCustomerByCode).mockImplementation(async (code) => {
			if (code === '000001') {
				// debt hostil: sin toString ni valueOf invocables. Simula un campo
				// que IspCube, fuera de nuestro control, podria devolver asi.
				return {
					ok: true,
					customer: {
						code,
						name: 'CLIENTE ROTO',
						status: 'enabled',
						crudo: {
							code,
							name: 'CLIENTE ROTO',
							status: 'enabled',
							debt: { toString: 1, valueOf: 1 },
							duedebt: 0
						}
					}
				};
			}
			return clienteSano(code);
		});

		const r = await post({ codes: ['000001', '000002'] });

		expect(r.status).toBe(200);
		const body = await r.json();
		const porCode = Object.fromEntries(body.resultados.map((x) => [x.code, x]));

		expect(porCode['000001']).toEqual({ code: '000001', ok: false, reason: 'error' });
		expect(porCode['000002'].ok).toBe(true);
	});

	it('suma alta_nap a los datos, leido de los mismos tickets que resumenTickets', async () => {
		vi.mocked(getCustomerByCode).mockResolvedValue(clienteSano('003566'));
		vi.mocked(getTickets).mockResolvedValue({
			ok: true,
			tickets: [
				{
					id: 1,
					ticket_category_id: 69,
					ticket_status_id: 3,
					created_at: '2026-08-01T10:00:00.000000Z',
					closed_date: '2026-08-05 15:22:00'
				}
			]
		});

		const r = await post({ codes: ['003566'], estadosCerrados: [3] });

		expect(r.status).toBe(200);
		const body = await r.json();
		expect(body.resultados[0].datos.alta_nap).toEqual({
			existe: true,
			cerrado: true,
			anulado: false,
			closed_date: '2026-08-05'
		});
	});
});
