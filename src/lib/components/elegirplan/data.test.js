import { describe, it, expect } from 'vitest';
import { formatPrice } from '$lib/components/elegirplan/data.js';

describe('vitest setup', () => {
	it('resuelve el alias $lib e importa data.js', () => {
		expect(formatPrice(1000)).toBe('$1.000');
	});
});
