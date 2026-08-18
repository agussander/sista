import { describe, expect, it } from 'vitest';
import { calcularPrecios } from './mapeoPrecios.js';

/** @param {Array<[string, number | null]>} filas */
const mostrador = (filas) =>
	filas.map(([label, abonoMensual]) => ({ label, cargoInicial: null, abonoMensual }));

const COMPLETO = [
	{ label: 'HOME F111', cargoInicial: 20000, abonoMensual: 25152.31 },
	{ label: 'FAST F121', cargoInicial: 20000, abonoMensual: 31058.05 },
	{ label: 'ANTINA PLAY +', cargoInicial: null, abonoMensual: 19890 },
	{ label: 'Básico + Cine', cargoInicial: null, abonoMensual: 45950 },
	{ label: 'Pack Fútbol (DGo)', cargoInicial: null, abonoMensual: 25610 },
	{ label: 'LINEA VIP 56-221', cargoInicial: null, abonoMensual: 9971.6 }
];

describe('calcularPrecios', () => {
	it('mapea las etiquetas a los campos y redondea', () => {
		const { valores } = calcularPrecios(COMPLETO);

		expect(valores.home).toBe(25152);
		expect(valores.fast).toBe(31058);
		expect(valores.antina).toBe(19890);
		expect(valores.dgo_futbol).toBe(25610);
		expect(valores.telefono).toBe(9972);
	});

	it('toma la instalacion del cargo inicial de HOME F111', () => {
		expect(calcularPrecios(COMPLETO).valores.instalacion).toBe(20000);
	});

	// El Excel publica el total "Basico + Cine"; el sitio usa el adicional.
	it('deriva antina_cine restando el basico del total', () => {
		const { valores, avisos } = calcularPrecios(COMPLETO);

		expect(valores.antina_cine).toBe(26060); // 45950 - 19890
		expect(avisos.some((a) => /antina_cine/.test(a))).toBe(false);
	});

	it('no deriva antina_cine si falta alguna de las dos filas', () => {
		const sinBasico = COMPLETO.filter((f) => f.label !== 'ANTINA PLAY +');
		const { valores, avisos } = calcularPrecios(sinBasico);

		expect('antina_cine' in valores).toBe(false);
		expect(avisos.some((a) => /antina_cine/.test(a))).toBe(true);
	});

	it('normaliza espacios de mas y mayusculas al buscar la etiqueta', () => {
		const { valores } = calcularPrecios(mostrador([['max   f161   (NUEVO)', 54688.87]]));
		expect(valores.max).toBe(54689);
	});

	// Invariante: solo se escribe un numero positivo que se encontro.
	it('deja el campo intacto y avisa si la etiqueta no esta', () => {
		const { valores, avisos } = calcularPrecios(mostrador([['HOME F111', 25152]]));

		expect(valores.home).toBe(25152);
		expect('gamer' in valores).toBe(false);
		expect(avisos.some((a) => /GAMER F141/.test(a))).toBe(true);
	});

	it('descarta valores no numericos o no positivos', () => {
		const { valores, avisos } = calcularPrecios(
			mostrador([
				['HOME F111', 0],
				['FAST F121', null],
				['POWER F131', -5]
			])
		);

		expect('home' in valores).toBe(false);
		expect('fast' in valores).toBe(false);
		expect('power' in valores).toBe(false);
		expect(avisos.length).toBeGreaterThanOrEqual(3);
	});

	it('lista como informativas las filas del Excel sin campo asociado', () => {
		const { sinCampo } = calcularPrecios([
			...COMPLETO,
			{ label: 'SPRINT Banda 94', cargoInicial: null, abonoMensual: 58992 }
		]);

		expect(sinCampo).toContain('SPRINT Banda 94');
		expect(sinCampo).not.toContain('HOME F111');
	});
});
