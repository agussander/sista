import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import { priceInfo } from '$lib/stores.js';

describe('priceInfo flags simétricos', () => {
	it('gamer, worker y max son simétricos', () => {
		const sym = get(priceInfo).filter((p) => p.symmetric).map((p) => p.plan);
		expect(sym.sort()).toEqual(['gamer', 'max', 'worker']);
	});
	it('home, fast y power NO son simétricos', () => {
		const asym = get(priceInfo).filter((p) => !p.symmetric).map((p) => p.plan);
		expect(asym.sort()).toEqual(['fast', 'home', 'power']);
	});
});
