import { describe, it, expect } from 'vitest';
import { buscarCanales, hayAlgunaCoincidencia, elegirServicio } from './tvRecomendador.js';

// Helper: resultado de un servicio puntual dentro del array que devuelve buscarCanales.
const porServicio = (resultados, key) => resultados.find((r) => r.key === key);

describe('buscarCanales', () => {
	it('encuentra "espn" en los 3 servicios, con más de un canal en cada uno', () => {
		const r = buscarCanales('espn');

		for (const key of ['gigared', 'antina', 'dgo']) {
			expect(porServicio(r, key).disponible).toBe(true);
			expect(porServicio(r, key).matches.length).toBeGreaterThan(1);
		}
	});

	it('encuentra "hbo" sólo en Antina y lo marca como adicional', () => {
		const r = buscarCanales('hbo');

		expect(porServicio(r, 'gigared').disponible).toBe(false);
		expect(porServicio(r, 'dgo').disponible).toBe(false);

		const antina = porServicio(r, 'antina');
		expect(antina.disponible).toBe(true);
		expect(antina.soloAdicional).toBe(true);
		expect(antina.matches[0].addonLabel).toBe('Cine');
	});

	it('no marca como adicional un canal incluido en el precio base', () => {
		const antina = porServicio(buscarCanales('telefe'), 'antina');

		expect(antina.disponible).toBe(true);
		expect(antina.soloAdicional).toBe(false);
		expect(antina.matches[0].addonLabel).toBe(null);
	});

	it('ignora los acentos: "publica" encuentra "TV Pública"', () => {
		const gigared = porServicio(buscarCanales('publica'), 'gigared');

		expect(gigared.matches.map((c) => c.nombre)).toContain('TV Pública');
	});

	it('ignora mayúsculas y espacios sobrantes', () => {
		expect(buscarCanales('  HBO  ')).toEqual(buscarCanales('hbo'));
	});

	it('no filtra con un término de menos de 2 caracteres', () => {
		for (const termino of ['', '   ', 'a']) {
			const r = buscarCanales(termino);
			expect(r).toHaveLength(3);
			expect(r.every((s) => s.matches.length === 0)).toBe(true);
			expect(r.every((s) => s.disponible === false)).toBe(true);
		}
	});

	it('no encuentra "netflix" en ninguna grilla', () => {
		const r = buscarCanales('netflix');

		expect(r.every((s) => s.disponible === false)).toBe(true);
		expect(hayAlgunaCoincidencia(r)).toBe(false);
	});

	it('hayAlgunaCoincidencia es true si al menos un servicio matchea', () => {
		expect(hayAlgunaCoincidencia(buscarCanales('hbo'))).toBe(true);
	});

	it('devuelve los servicios en el orden de TV_SERVICES, del más barato al premium', () => {
		expect(buscarCanales('espn').map((s) => s.key)).toEqual(['gigared', 'antina', 'dgo']);
	});
});

// Respuestas base: 1 TV, sin exigir 13/TN ni Full HD. Cada test pisa lo que le importa.
const respuestas = (extra = {}) => ({ tv: 1, tn13: false, fullhd: false, canal: '', ...extra });

describe('elegirServicio', () => {
	it('sin canal, recomienda el más barato que cumple', () => {
		const r = elegirServicio(respuestas({ tv: 2 }));

		expect(r.recoKey).toBe('gigared');
		expect(r.canalIgnorado).toBe(false);
		expect(r.alternativas).toEqual([]);
	});

	it('sin canal, exigir Full HD lleva a DGO', () => {
		expect(elegirServicio(respuestas({ fullhd: true })).recoKey).toBe('dgo');
	});

	it('sin canal, exigir el 13 y TN descarta a Gigared', () => {
		expect(elegirServicio(respuestas({ tn13: true })).recoKey).toBe('antina');
	});

	it('con un canal que tienen todos, sigue ganando el más barato', () => {
		expect(elegirServicio(respuestas({ canal: 'espn' })).recoKey).toBe('gigared');
	});

	it('descarta al más barato si no tiene el canal pedido', () => {
		const r = elegirServicio(respuestas({ canal: 'trece' }));

		expect(r.recoKey).toBe('antina');
		expect(r.motivo).toContain('trece');
	});

	it('avisa cuando el canal sólo está disponible como adicional pago', () => {
		const r = elegirServicio(respuestas({ canal: 'hbo' }));

		expect(r.recoKey).toBe('antina');
		expect(r.motivo).toContain('Cine');
	});

	it('ignora un canal que no existe en ninguna grilla y recomienda por el resto', () => {
		const r = elegirServicio(respuestas({ canal: 'netflix', fullhd: true }));

		expect(r.canalIgnorado).toBe(true);
		expect(r.recoKey).toBe('dgo');
	});

	it('no marca canalIgnorado cuando el campo está vacío', () => {
		expect(elegirServicio(respuestas()).canalIgnorado).toBe(false);
	});

	it('no recomienda nada si el canal choca con la cantidad de TV', () => {
		const r = elegirServicio(respuestas({ tv: 4, canal: 'hbo' }));

		expect(r.recoKey).toBe(null);
		expect(r.alternativas.map((a) => a.key)).toEqual(['antina', 'dgo']);
	});

	it('explica de cada alternativa qué cumple y qué no', () => {
		const [antina, dgo] = elegirServicio(respuestas({ tv: 4, canal: 'hbo' })).alternativas;

		expect(antina.cumple).toContain('hbo');
		expect(antina.falla).toContain('2 TV');
		expect(dgo.cumple).toContain('4');
		expect(dgo.falla).toContain('hbo');
	});

	it('nunca devuelve más de 2 alternativas', () => {
		const r = elegirServicio(respuestas({ tv: 4, canal: 'hbo', tn13: true, fullhd: true }));

		expect(r.alternativas.length).toBeLessThanOrEqual(2);
	});
});
