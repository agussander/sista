import { describe, it, expect } from 'vitest';
import { shouldBlockIndexing, NOINDEX_VALUE } from './robotsHeader.js';

describe('shouldBlockIndexing', () => {
	it('no bloquea en production', () => {
		expect(shouldBlockIndexing('production')).toBe(false);
	});

	it('bloquea en beta', () => {
		expect(shouldBlockIndexing('beta')).toBe(true);
	});

	it('bloquea cuando la variable no esta definida', () => {
		expect(shouldBlockIndexing(undefined)).toBe(true);
	});

	it('bloquea con string vacio', () => {
		expect(shouldBlockIndexing('')).toBe(true);
	});

	it('no confunde valores parecidos a production', () => {
		expect(shouldBlockIndexing('Production')).toBe(true);
		expect(shouldBlockIndexing('production ')).toBe(true);
		expect(shouldBlockIndexing('pre-production')).toBe(true);
	});

	it('expone el valor del header', () => {
		expect(NOINDEX_VALUE).toBe('noindex, nofollow');
	});
});
