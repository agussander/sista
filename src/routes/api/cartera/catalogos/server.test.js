/**
 * La guardia de verificarPermiso es la unica proteccion de este endpoint: sin
 * ella, GET /api/cartera/catalogos expone datos de IspCube a cualquiera con
 * acceso a la red. Estos tests existen porque un reviewer borro la linea de
 * la guardia en los tres endpoints de la Cartera y la suite entera siguio
 * en verde: nada probaba la autenticacion.
 *
 * Se mockea $lib/server/ispcube.js para poder afirmar, ademas del 401/403,
 * que ninguna funcion de IspCube se llego a llamar: eso es lo que demuestra
 * que no se filtro nada y que no se gasto cuota (la API se factura por
 * request).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { GET } from './+server.js';
import * as ispcube from '$lib/server/ispcube.js';

vi.mock('$lib/server/ispcube.js', () => ({
	getCatalogos: vi.fn(async () => {
		throw new Error('getCatalogos no debe llamarse sin autenticacion');
	})
}));

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('GET /api/cartera/catalogos - guardia de autenticacion', () => {
	it('devuelve 401 cuando falta el header Authorization', async () => {
		const request = new Request('http://x/api/cartera/catalogos');

		const r = await GET({ request });

		expect(r.status).toBe(401);
	});

	it('no llama a IspCube cuando falta el header Authorization', async () => {
		const request = new Request('http://x/api/cartera/catalogos');

		await GET({ request });

		expect(ispcube.getCatalogos).not.toHaveBeenCalled();
	});
});

describe('GET /api/cartera/catalogos - guardia de autorizacion', () => {
	// Token valido (PocketBase lo confirma) pero el record no tiene el
	// permiso `cartera`. `fetch` se stubea porque verificarPermiso usa el
	// `fetch` global cuando el endpoint no le pasa `fetchImpl` -asi se prueba
	// la integracion real, no una version reimplementada en el mock.
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
		const request = new Request('http://x/api/cartera/catalogos', {
			headers: { Authorization: 'Bearer tok-valido' }
		});

		const r = await GET({ request });

		expect(r.status).toBe(403);
	});

	it('no llama a IspCube cuando falta el permiso cartera', async () => {
		stubFetchSinPermiso();
		const request = new Request('http://x/api/cartera/catalogos', {
			headers: { Authorization: 'Bearer tok-valido' }
		});

		await GET({ request });

		expect(ispcube.getCatalogos).not.toHaveBeenCalled();
	});
});
