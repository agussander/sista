import { describe, it, expect } from 'vitest';
import { formatPrice, clampStep, buildPlanParams, parsePlanParams, getFlow } from '$lib/components/elegirplan/data.js';

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

	it('paso pedido fuera del flow cae al paso alcanzable más lejano', () => {
		// 'tv' no existe en el flow de internet; con plan elegido el alcanzable es 'resumen'
		const w = { tipo: 'internet', internetPlan: 'home' };
		expect(clampStep(w, 'tv')).toBe('resumen');
	});

	it('paso fuera del flow no descarta un combo ya completo', () => {
		// combo promo completo + un paso ('internet') ausente del flow de promo:
		// debe quedarse en 'resumen', no volver a 'tipo'
		const w = { tipo: 'tv', promo: true, internetPlan: 'power', tvPlatform: 'gigared' };
		expect(clampStep(w, 'internet')).toBe('resumen');
	});
});

describe('getFlow', () => {
	it('Internet+TV incluye el paso de promo por defecto', () => {
		const w = { tipo: 'tv', promo: false, noPromo: false };
		expect(getFlow(w)).toEqual(['tipo', 'promo', 'internet', 'tv', 'adicionales', 'resumen']);
	});

	it('con noPromo (sinpromo=1) Internet+TV salta la promo y arma a medida', () => {
		const w = { tipo: 'tv', promo: false, noPromo: true };
		expect(getFlow(w)).toEqual(['tipo', 'internet', 'tv', 'adicionales', 'resumen']);
	});

	it('con noPromo, antes de elegir el tipo la barra ya excluye la promo', () => {
		const w = { tipo: null, promo: false, noPromo: true };
		expect(getFlow(w)).toEqual(['tipo', 'internet', 'tv', 'adicionales', 'resumen']);
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

	it('noPromo serializa sinpromo=1', () => {
		const w = { step: 'tipo', tipo: null, internetPlan: null, tvPlatform: null, promo: false, noPromo: true, addons: {} };
		expect(decodeURIComponent(buildPlanParams(w).toString())).toBe('paso=tipo&sinpromo=1');
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
			noPromo: false,
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
			noPromo: false,
			addons: { pack_futbol: false, cine: true, telefono: true }
		});
	});

	it('sinpromo=1 → noPromo true', () => {
		const r = parsePlanParams(new URLSearchParams('tipo=tv&sinpromo=1'));
		expect(r.noPromo).toBe(true);
		expect(r.tipo).toBe('tv');
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
