import { readFile } from 'node:fs/promises';
import { beforeAll, describe, expect, it } from 'vitest';
import { leerLibro } from './xlsx.js';
import { parseTarifasWeb } from './parseTarifario.js';

const FIXTURE = new URL('./__fixtures__/tarifario-26.081.xlsx', import.meta.url);

/** @type {Map<string, Map<string, any>>} */
let libro;
beforeAll(async () => {
	libro = await leerLibro(await readFile(FIXTURE));
});

describe('parseTarifasWeb', () => {
	it('lee las 28 filas publicables y la alicuota', () => {
		const { filas, alicuota } = parseTarifasWeb(libro);

		expect(filas).toHaveLength(28);
		expect(alicuota).toBeCloseTo(0.21, 9);

		// Los precios se comparan con tolerancia: son dobles que vienen de
		// dividir en Excel, y una igualdad exacta de float es un test frágil.
		expect(filas[0].label).toBe('HOME F111');
		expect(filas[0].nivel).toBe(0);
		expect(filas[0].sinImpuestos).toBeCloseTo(20787.0354818, 6);
		expect(filas[0].precioFinal).toBeCloseTo(25152.312933, 6);
		expect(filas.at(-1).label).toBe('SPRINT Banda 94');
	});

	it('marca los packs como sub-items y les recorta la sangria', () => {
		const { filas } = parseTarifasWeb(libro);
		const cine = filas.find((f) => f.label === 'Básico + Cine');

		expect(cine).toBeDefined();
		expect(cine.nivel).toBe(1);
		expect(cine.precioFinal).toBe(45950);

		expect(filas.find((f) => f.label === 'ANTINA PLAY +').nivel).toBe(0);
	});

	// Las instrucciones para Word viven en B36 y B38, despues del hueco de B34.
	it('corta en el primer hueco y no llega a las celdas de instrucciones', () => {
		const { filas } = parseTarifasWeb(libro);
		expect(filas.some((f) => /^Copiar rango/i.test(f.label))).toBe(false);
	});
});
