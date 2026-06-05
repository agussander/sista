import { describe, it, expect } from 'vitest';
import { formatPrice, clampStep } from '$lib/components/elegirplan/data.js';

describe('vitest setup', () => {
	it('resuelve el alias $lib e importa data.js', () => {
		expect(formatPrice(1000)).toBe('$1.000');
	});
});

describe('clampStep', () => {
	it('sin selecciones, cualquier paso pedido cae en "tipo"', () => {
		expect(clampStep({}, 'resumen')).toBe('tipo');
		expect(clampStep({ tipo: null }, 'internet')).toBe('tipo');
	});

	it('combo TV+promo completo permite "resumen"', () => {
		const w = { tipo: 'tv', promo: true, internetPlan: 'power', tvPlatform: 'gigared' };
		expect(clampStep(w, 'resumen')).toBe('resumen');
	});

	it('rama internet sin plan no pasa de "internet"', () => {
		const w = { tipo: 'internet', internetPlan: null };
		expect(clampStep(w, 'resumen')).toBe('internet');
	});

	it('rama internet con plan permite "adicionales"', () => {
		const w = { tipo: 'internet', internetPlan: 'home' };
		expect(clampStep(w, 'adicionales')).toBe('adicionales');
	});

	it('rama TV "armar" sin plan no pasa de "internet"', () => {
		const w = { tipo: 'tv', promo: false, internetPlan: null };
		expect(clampStep(w, 'tv')).toBe('internet');
	});

	it('rama TV con plan pero sin plataforma no pasa de "tv"', () => {
		const w = { tipo: 'tv', promo: false, internetPlan: 'power', tvPlatform: null };
		expect(clampStep(w, 'resumen')).toBe('tv');
	});

	it('paso pedido fuera del flow cae al paso válido más lejano', () => {
		const w = { tipo: 'internet', internetPlan: 'home' };
		expect(clampStep(w, 'tv')).toBe('internet');
	});
});
