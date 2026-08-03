/**
 * La guardia de verificarAsesor es la unica proteccion de este endpoint: sin
 * ella, GET /api/cartera/catalogos expone datos de IspCube a cualquiera con
 * acceso a la red. Estos tests existen porque un reviewer borro la linea de
 * la guardia en los tres endpoints de la Cartera y la suite entera siguio
 * en verde: nada probaba la autenticacion.
 *
 * Se mockea $lib/server/ispcube.js para poder afirmar, ademas del 401, que
 * ninguna funcion de IspCube se llego a llamar: eso es lo que demuestra que
 * no se filtro nada y que no se gasto cuota (la API se factura por request).
 */
import { describe, it, expect, vi } from 'vitest';
import { GET } from './+server.js';
import * as ispcube from '$lib/server/ispcube.js';

vi.mock('$lib/server/ispcube.js', () => ({
	getCatalogos: vi.fn(async () => {
		throw new Error('getCatalogos no debe llamarse sin autenticacion');
	})
}));

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
