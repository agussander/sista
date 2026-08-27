import { describe, expect, it } from 'vitest';
import { normalizarTarifario } from './fetchTarifario.js';

describe('normalizarTarifario', () => {
	it('saca "Amazon" de la etiqueta de un combo aunque venga así desde PocketBase', () => {
		const record = {
			id: 'abc',
			version: '26.09',
			vigencia: '2026-09-01',
			tarifas_web: {
				alicuota: 0.21,
				filas: [
					{ label: 'DGo Fútbol total (Full + Dsports + Amazon + Fútbol) NUEVO', nivel: 1 }
				]
			}
		};

		const { tarifasWeb } = normalizarTarifario(record);

		expect(tarifasWeb.filas[0].label).toBe('DGo Fútbol total (Full + Dsports + Fútbol) NUEVO');
		expect(tarifasWeb.alicuota).toBe(0.21);
		expect(tarifasWeb.filas[0].nivel).toBe(1);
	});

	it('acepta tarifas_web como string JSON (campo texto en PocketBase)', () => {
		const record = {
			id: 'abc',
			tarifas_web: JSON.stringify({
				alicuota: null,
				filas: [{ label: 'Amazon + Full + Dsports', nivel: 0 }]
			})
		};

		const { tarifasWeb } = normalizarTarifario(record);

		expect(tarifasWeb.filas[0].label).toBe('Full + Dsports');
	});

	it('no toca una etiqueta que no menciona Amazon', () => {
		const record = { id: 'abc', tarifas_web: { filas: [{ label: 'Pack Fútbol (DGo)' }] } };

		expect(normalizarTarifario(record).tarifasWeb.filas[0].label).toBe('Pack Fútbol (DGo)');
	});

	it('aguanta un registro sin los campos json', () => {
		const salida = normalizarTarifario({ id: 'abc' });

		expect(salida.tarifasWeb).toEqual({ filas: [], alicuota: null });
		expect(salida.lineaVip.planes).toEqual([]);
		expect(salida.internacional.destinos).toEqual([]);
		expect(salida.version).toBe('');
	});
});
