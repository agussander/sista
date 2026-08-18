import { readFile } from 'node:fs/promises';
import { beforeAll, describe, expect, it } from 'vitest';
import { leerLibro } from './xlsx.js';
import { parseInternacional, parseLineaVip, parseTarifasWeb } from './parseTarifario.js';

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

describe('parseLineaVip', () => {
	it('lee los 4 planes con la vigencia propia de la pestana', () => {
		const vip = parseLineaVip(libro);

		expect(vip.vigencia).toBe('2026-08-01');
		expect(vip.planes).toHaveLength(4);

		const r11 = vip.planes[0];
		expect(r11.nombre).toBe('Linea VIP R11');
		expect(r11.clientes).toBe('Radio');
		expect(r11.numeroLocal).toBe('AMBA 011');
		expect(r11.cargoInicial).toBe(800);
		expect(r11.minutosLocales).toBe(500);
		expect(r11.abonoMensual).toBeCloseTo(19501.2550005, 6);
		expect(r11.excedenteLocal).toBeCloseTo(25.0335499, 6);
	});

	// H5:H8 y J5:J8 estan combinadas: el valor esta solo en la fila 5.
	it('replica a los 4 planes las columnas combinadas', () => {
		const vip = parseLineaVip(libro);

		for (const plan of vip.planes) {
			expect(plan.llamadasCelulares).toBeCloseTo(140.96084920182668, 9);
			expect(plan.excedenteNacional).toBeCloseTo(29.2652282079917, 9);
		}

		const fibra221 = vip.planes.find((p) => p.nombre === 'Linea VIP 221');
		expect(fibra221.clientes).toBe('Fibra');
		expect(fibra221.cargoInicial).toBe('--');
		expect(fibra221.abonoMensual).toBeCloseTo(9971.603398646428, 9);
	});

	it('separa la nota del aparato del resto y corta en las instrucciones', () => {
		const vip = parseLineaVip(libro);

		expect(vip.aparato).toMatch(/^Aparato telefonico/i);
		expect(vip.notas).toContain('Valores en Pesos ($)');
		expect(vip.notas).toContain('Incluye IVA, del 21 %');
		expect(vip.notas.some((n) => /abonado de fibra/i.test(n))).toBe(true);
		expect(vip.notas.some((n) => /^Aparato telefonico/i.test(n))).toBe(false);
		expect(vip.notas.some((n) => /^Copiar rango/i.test(n))).toBe(false);
	});
});

describe('parseInternacional', () => {
	it('agrupa los 3273 prefijos en destinos, con su vigencia propia', () => {
		const intl = parseInternacional(libro);

		// La pestana Internacional tiene su propia vigencia, distinta de la general.
		expect(intl.vigencia).toBe('2026-06-01');
		expect(intl.unidad).toBe('U$S');
		expect(intl.destinos).toHaveLength(346);

		expect(intl.destinos[0]).toEqual({ destino: 'AFGANISTAN', fijo: 0.5, movil: 0.5 });
	});

	it('deja en null el tipo que un destino no tiene', () => {
		const { destinos } = parseInternacional(libro);
		const econet = destinos.find((d) => d.destino === 'ZIMBABWE ECONET');

		expect(econet.fijo).toBe(0.5);
		expect(econet.movil).toBe(null);
	});

	it('respeta el orden de aparicion y no repite destinos', () => {
		const { destinos } = parseInternacional(libro);
		const nombres = destinos.map((d) => d.destino);

		expect(new Set(nombres).size).toBe(nombres.length);
		expect(nombres[1]).toBe('ALASKA');
	});
});
