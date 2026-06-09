import { describe, it, expect } from 'vitest';
import { capitalizePlan, planWhatsappUrl } from '$lib/components/home/planCard.js';

describe('capitalizePlan', () => {
	it('capitaliza la primera letra', () => {
		expect(capitalizePlan('gamer')).toBe('Gamer');
	});
	it('string vacío o nulo devuelve vacío', () => {
		expect(capitalizePlan('')).toBe('');
		expect(capitalizePlan(undefined)).toBe('');
	});
});

describe('planWhatsappUrl', () => {
	it('arma el link con el plan capitalizado y los mb', () => {
		const url = planWhatsappUrl('gamer', '300');
		expect(url).toContain('phone=5492213541906');
		expect(decodeURIComponent(url)).toContain('Hola! Quiero contratar el plan Gamer (300mb)');
	});
	it('el texto va URL-encodeado (sin espacios crudos en la URL)', () => {
		const url = planWhatsappUrl('worker', '200');
		expect(url).not.toContain(' ');
		expect(url).toContain('text=');
	});
});
