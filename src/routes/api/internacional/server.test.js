import { describe, it, expect } from 'vitest';
import { GET } from './+server.js';
import { FILAS } from '$lib/tarifario/hojaInternacional.js';

/** Ejecuta el handler y devuelve la respuesta ya parseada. */
async function pedir() {
	const res = /** @type {Response} */ (GET(/** @type {any} */ ({})));
	return { res, body: await res.json() };
}

describe('GET /api/internacional', () => {
	it('responde 200 con JSON en UTF-8', async () => {
		const { res } = await pedir();
		expect(res.status).toBe(200);
		expect(res.headers.get('content-type')).toMatch(/application\/json/);
	});

	it('devuelve una entrada por prefijo, en el orden del Excel', async () => {
		const { body } = await pedir();
		expect(body.total).toBe(FILAS.length);
		expect(body.destinos).toHaveLength(FILAS.length);

		expect(body.destinos[0]).toEqual({
			prefijo: '0093',
			destino: 'AFGANISTAN',
			tipo: 'Fijo',
			precio: 0.5
		});
		expect(body.destinos.at(-1).destino).toBe('ZIMBABWE ECONET');
	});

	it('conserva los ceros a la izquierda del prefijo', async () => {
		// Si el prefijo viajara como numero, "0093" se convertiria en 93 y el
		// que arma la factura marcaria mal el destino.
		const { body } = await pedir();
		for (const d of body.destinos.slice(0, 50)) {
			expect(typeof d.prefijo).toBe('string');
			expect(d.prefijo.startsWith('0')).toBe(true);
		}
	});

	it('sirve los precios como numeros, en dolares', async () => {
		const { body } = await pedir();
		expect(body.moneda).toBe('USD');
		for (const d of body.destinos) expect(typeof d.precio).toBe('number');
	});

	it('sirve la vigencia y los encabezados de la hoja', async () => {
		const { body } = await pedir();
		expect(body.vigencia).toBe('2026-06-01');
		expect(body.encabezados).toEqual(['Prefijo', 'Destino', 'Fijo / Móvil', 'Precio [U$S]']);
	});

	it('no filtra las notas internas de la columna G', async () => {
		const { body } = await pedir();
		const texto = JSON.stringify(body);
		expect(texto).not.toMatch(/metrotel/i);
		expect(texto).not.toMatch(/pegar en Word/i);
	});
});
