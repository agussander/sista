import { describe, it, expect } from 'vitest';
import { SITE_ORIGIN, canonicalUrl } from './seo.js';

describe('SITE_ORIGIN', () => {
	it('es el apex sin www y sin barra final', () => {
		expect(SITE_ORIGIN).toBe('https://sista.ar');
	});
});

describe('canonicalUrl', () => {
	it('arma la home con barra final', () => {
		expect(canonicalUrl('/')).toBe('https://sista.ar/');
	});

	it('agrega la barra final que exige trailingSlash always', () => {
		expect(canonicalUrl('/formasdepago')).toBe('https://sista.ar/formasdepago/');
	});

	it('no duplica la barra final cuando ya viene', () => {
		expect(canonicalUrl('/formasdepago/')).toBe('https://sista.ar/formasdepago/');
	});

	it('sirve rutas anidadas', () => {
		expect(canonicalUrl('/conectar-la-ciudad/juego')).toBe(
			'https://sista.ar/conectar-la-ciudad/juego/'
		);
	});

	it('descarta query y hash, que no van en el canonical', () => {
		expect(canonicalUrl('/tv?utm_source=fb')).toBe('https://sista.ar/tv/');
		expect(canonicalUrl('/tv#planes')).toBe('https://sista.ar/tv/');
	});

	it('agrega la barra inicial si falta', () => {
		expect(canonicalUrl('formasdepago')).toBe('https://sista.ar/formasdepago/');
	});

	it('cae a la home cuando no hay path', () => {
		expect(canonicalUrl('')).toBe('https://sista.ar/');
		expect(canonicalUrl(null)).toBe('https://sista.ar/');
		expect(canonicalUrl(undefined)).toBe('https://sista.ar/');
	});

	it('cae a la home para lo que no es string', () => {
		expect(canonicalUrl(42)).toBe('https://sista.ar/');
		expect(canonicalUrl({})).toBe('https://sista.ar/');
	});

	it('colapsa las barras repetidas', () => {
		expect(canonicalUrl('//tv//')).toBe('https://sista.ar/tv/');
	});
});
