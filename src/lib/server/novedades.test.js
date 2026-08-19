import { describe, it, expect, vi } from 'vitest';
import { listarPublicadas, traerPorSlug, urlArchivo, aNovedadPublica } from './novedades.js';

const BASE = 'https://sista.pockethost.io';

/** fetch falso: registra las llamadas y devuelve la respuesta que le pasen. */
function fakeFetch(response, calls) {
	return async (url, init) => {
		calls?.push({ url, init });
		return response;
	};
}

const respuesta = (items) => ({ ok: true, status: 200, json: async () => ({ items }) });

const registro = (extra = {}) => ({
	id: 'rec1',
	collectionId: 'col1',
	slug: 'nueva-tienda',
	titulo: 'Nueva tienda',
	fecha: '2026-08-19 00:00:00.000Z',
	imagen: 'foto.png',
	...extra
});

describe('listarPublicadas', () => {
	it('filtra por publicada en la propia consulta', async () => {
		const calls = [];
		await listarPublicadas(BASE, { fetchImpl: fakeFetch(respuesta([]), calls) });

		expect(calls[0].url).toContain('/api/collections/novedades/records');
		expect(decodeURIComponent(calls[0].url)).toContain('(publicada=true)');
	});

	it('saca la barra final de la base url', async () => {
		const calls = [];
		await listarPublicadas(`${BASE}/`, { fetchImpl: fakeFetch(respuesta([]), calls) });
		expect(calls[0].url.startsWith(`${BASE}/api/`)).toBe(true);
	});

	it('devuelve las novedades ordenadas', async () => {
		const items = [
			registro({ id: 'vieja', fecha: '2026-01-01', destacada: false }),
			registro({ id: 'destacada', fecha: '2025-01-01', destacada: true })
		];
		const out = await listarPublicadas(BASE, { fetchImpl: fakeFetch(respuesta(items)) });
		expect(out.map((n) => n.id)).toEqual(['destacada', 'vieja']);
	});

	it('devuelve lista vacia si PocketBase responde con error', async () => {
		const error = { ok: false, status: 500, json: async () => ({}) };
		expect(await listarPublicadas(BASE, { fetchImpl: fakeFetch(error) })).toEqual([]);
	});

	it('devuelve lista vacia si se cae la red', async () => {
		const rompe = async () => {
			throw new Error('sin red');
		};
		expect(await listarPublicadas(BASE, { fetchImpl: rompe })).toEqual([]);
	});

	it('devuelve lista vacia si se corta por timeout', async () => {
		const corta = async () => {
			throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
		};
		expect(await listarPublicadas(BASE, { fetchImpl: corta })).toEqual([]);
	});

	it('devuelve lista vacia si items no es un array', async () => {
		const mal = { ok: true, status: 200, json: async () => ({ items: 'oops' }) };
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		expect(await listarPublicadas(BASE, { fetchImpl: fakeFetch(mal) })).toEqual([]);
		expect(spy).toHaveBeenCalled();
		spy.mockRestore();
	});

	it('loguea cuando el listado viene truncado', async () => {
		const truncado = {
			ok: true,
			status: 200,
			json: async () => ({ items: [registro()], totalItems: 250 })
		};
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const out = await listarPublicadas(BASE, { fetchImpl: fakeFetch(truncado) });
		expect(out).toHaveLength(1);
		expect(spy).toHaveBeenCalledWith(expect.stringContaining('truncad'));
		spy.mockRestore();
	});
});

describe('traerPorSlug', () => {
	it('pide por slug y solo publicadas', async () => {
		const calls = [];
		await traerPorSlug(BASE, 'nueva-tienda', {
			fetchImpl: fakeFetch(respuesta([registro()]), calls)
		});

		const url = decodeURIComponent(calls[0].url);
		expect(url).toContain("slug='nueva-tienda'");
		expect(url).toContain('publicada=true');
	});

	it('devuelve el registro encontrado', async () => {
		const out = await traerPorSlug(BASE, 'nueva-tienda', {
			fetchImpl: fakeFetch(respuesta([registro()]))
		});
		expect(out.id).toBe('rec1');
	});

	it('devuelve null si no hay resultados', async () => {
		const out = await traerPorSlug(BASE, 'no-existe', { fetchImpl: fakeFetch(respuesta([])) });
		expect(out).toBe(null);
	});

	// El slug sale de la URL y se interpola en el filtro de PocketBase: si no se
	// valida, cualquiera puede escribir filtros arbitrarios desde la barra de
	// direcciones.
	it('rechaza un slug con caracteres raros sin consultar', async () => {
		const calls = [];
		const out = await traerPorSlug(BASE, "x' || publicada=false || '", {
			fetchImpl: fakeFetch(respuesta([registro()]), calls)
		});
		expect(out).toBe(null);
		expect(calls).toHaveLength(0);
	});

	it('devuelve null sin slug', async () => {
		expect(await traerPorSlug(BASE, '', { fetchImpl: fakeFetch(respuesta([])) })).toBe(null);
	});

	it('devuelve null si se corta por timeout', async () => {
		const corta = async () => {
			throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
		};
		expect(await traerPorSlug(BASE, 'nueva-tienda', { fetchImpl: corta })).toBe(null);
	});

	it('devuelve null si items no es un array', async () => {
		const mal = { ok: true, status: 200, json: async () => ({ items: 'oops' }) };
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		expect(await traerPorSlug(BASE, 'nueva-tienda', { fetchImpl: fakeFetch(mal) })).toBe(null);
		expect(spy).toHaveBeenCalled();
		spy.mockRestore();
	});
});

describe('urlArchivo', () => {
	it('arma la url del archivo', () => {
		expect(urlArchivo(BASE, registro(), 'foto.png')).toBe(
			`${BASE}/api/files/col1/rec1/foto.png`
		);
	});

	it('agrega el thumb cuando se lo pide', () => {
		expect(urlArchivo(BASE, registro(), 'foto.png', '600x400')).toBe(
			`${BASE}/api/files/col1/rec1/foto.png?thumb=600x400`
		);
	});

	it('devuelve null si no hay archivo', () => {
		expect(urlArchivo(BASE, registro(), '')).toBe(null);
		expect(urlArchivo(BASE, null, 'foto.png')).toBe(null);
	});
});

describe('aNovedadPublica', () => {
	it('deja las urls de imagen ya armadas', () => {
		const out = aNovedadPublica(BASE, registro());
		expect(out.imagen).toBe(`${BASE}/api/files/col1/rec1/foto.png?thumb=600x400`);
		expect(out.imagenGrande).toBe(`${BASE}/api/files/col1/rec1/foto.png?thumb=1200x0`);
	});

	it('deja las imagenes en null si la novedad no tiene', () => {
		const out = aNovedadPublica(BASE, registro({ imagen: '' }));
		expect(out.imagen).toBe(null);
		expect(out.imagenGrande).toBe(null);
	});

	it('normaliza los campos que pueden faltar', () => {
		const out = aNovedadPublica(BASE, registro({ bajada: undefined, cuerpo: undefined }));
		expect(out.bajada).toBe('');
		expect(out.cuerpo).toBe('');
		expect(out.destacada).toBe(false);
	});
});
