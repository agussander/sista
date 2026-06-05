import { describe, it, expect } from 'vitest';
import { formatPrice, clampStep, buildPlanParams, parsePlanParams } from '$lib/components/elegirplan/data.js';

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

describe('buildPlanParams', () => {
	it('estado default sólo serializa el paso', () => {
		const w = { step: 'tipo', tipo: null, internetPlan: null, tvPlatform: null, promo: false, addons: {} };
		expect(buildPlanParams(w).toString()).toBe('paso=tipo');
	});

	it('combo completo serializa todos los params en orden', () => {
		const w = {
			step: 'adicionales',
			tipo: 'tv',
			internetPlan: 'power',
			tvPlatform: 'gigared',
			promo: true,
			addons: { pack_futbol: false, cine: true, telefono: false }
		};
		expect(decodeURIComponent(buildPlanParams(w).toString())).toBe(
			'paso=adicionales&tipo=tv&plan=power&tv=gigared&promo=1&add=cine'
		);
	});

	it('promo false se omite; varios adicionales van separados por coma', () => {
		const w = {
			step: 'adicionales',
			tipo: 'internet',
			internetPlan: 'home',
			tvPlatform: null,
			promo: false,
			addons: { pack_futbol: true, cine: false, telefono: true }
		};
		expect(decodeURIComponent(buildPlanParams(w).toString())).toBe(
			'paso=adicionales&tipo=internet&plan=home&add=pack_futbol,telefono'
		);
	});
});

describe('parsePlanParams', () => {
	it('URL vacía devuelve defaults (paso "tipo", todo null/false)', () => {
		const r = parsePlanParams(new URLSearchParams(''));
		expect(r).toEqual({
			step: 'tipo',
			tipo: null,
			internetPlan: null,
			tvPlatform: null,
			promo: false,
			addons: { pack_futbol: false, cine: false, telefono: false }
		});
	});

	it('parsea un combo completo', () => {
		const r = parsePlanParams(
			new URLSearchParams('paso=adicionales&tipo=tv&plan=power&tv=gigared&promo=1&add=cine,telefono')
		);
		expect(r).toEqual({
			step: 'adicionales',
			tipo: 'tv',
			internetPlan: 'power',
			tvPlatform: 'gigared',
			promo: true,
			addons: { pack_futbol: false, cine: true, telefono: true }
		});
	});

	it('descarta valores inválidos', () => {
		const r = parsePlanParams(
			new URLSearchParams('paso=zzz&tipo=foo&plan=ultra&tv=netflix&add=hack')
		);
		expect(r.step).toBe('tipo');
		expect(r.tipo).toBeNull();
		expect(r.internetPlan).toBeNull();
		expect(r.tvPlatform).toBeNull();
		expect(r.addons).toEqual({ pack_futbol: false, cine: false, telefono: false });
	});
});
