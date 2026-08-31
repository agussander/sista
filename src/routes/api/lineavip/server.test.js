import { describe, it, expect } from 'vitest';
import { GET } from './+server.js';
import { PLANES } from '$lib/tarifario/hojaLineaVip.js';

/** Ejecuta el handler y devuelve la respuesta ya parseada. */
async function pedir() {
	const res = /** @type {Response} */ (GET(/** @type {any} */ ({})));
	return { res, body: await res.json() };
}

describe('GET /api/lineavip', () => {
	it('responde 200 con JSON en UTF-8', async () => {
		const { res } = await pedir();
		expect(res.status).toBe(200);
		// El scraper que rompio leia la pagina vieja como UTF-16; que el
		// content-type declare el charset es justo lo que evita repetirlo.
		expect(res.headers.get('content-type')).toMatch(/application\/json/);
	});

	it('devuelve los cuatro planes con los numeros crudos', async () => {
		const { body } = await pedir();
		expect(body.planes).toHaveLength(4);

		const r11 = body.planes[0];
		expect(r11.nombre).toBe('Linea VIP R11');
		expect(r11.clientes).toBe('Radio');
		expect(r11.numeroLocal).toBe('AMBA 011');
		expect(r11.cargoInicial).toBe(800);
		expect(r11.abonoMensual).toBeCloseTo(21451.3805, 4);
		expect(r11.minutosLocales).toBe(500);
	});

	it('repite en cada plan los valores de las celdas combinadas', async () => {
		const { body } = await pedir();
		for (const plan of body.planes) {
			expect(plan.llamadasCelulares).toBeCloseTo(239.6334, 4);
			expect(plan.excedenteNacional).toBeCloseTo(29.8505, 4);
		}
	});

	it('mantiene el "--" de los planes de fibra, como en el Excel', async () => {
		const { body } = await pedir();
		const fibra = body.planes.filter((/** @type {any} */ p) => p.clientes === 'Fibra');
		expect(fibra).toHaveLength(2);
		for (const plan of fibra) expect(plan.cargoInicial).toBe('--');
	});

	it('sirve la vigencia, la version y las notas', async () => {
		const { body } = await pedir();
		expect(body.vigencia).toBe('2026-09-01');
		expect(body.version).toBe(26.09);
		expect(body.moneda).toBe('ARS');
		expect(body.aparato).toMatch(/^Aparato telefonico/i);
		expect(body.notas).toContain('Valores en Pesos ($)');
		expect(body.notas).toContain('Incluye IVA, del 21 %');
	});

	it('no filtra el instructivo de Word ni ninguna nota interna', async () => {
		const { body } = await pedir();
		const texto = JSON.stringify(body);
		expect(texto).not.toMatch(/Copiar rango/i);
		expect(texto).not.toMatch(/metrotel/i);
	});

	it('sirve exactamente los planes del modulo compartido', async () => {
		const { body } = await pedir();
		expect(body.planes).toEqual(PLANES);
	});
});
