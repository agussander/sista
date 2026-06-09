import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import { priceInfo } from '$lib/stores.js';

describe('priceInfo flags simétricos', () => {
	it('gamer y worker son simétricos', () => {
		const sym = get(priceInfo).filter((p) => p.symmetric).map((p) => p.plan);
		expect(sym.sort()).toEqual(['gamer', 'worker']);
	});
	it('home, fast, power y max NO son simétricos', () => {
		const asym = get(priceInfo).filter((p) => !p.symmetric).map((p) => p.plan);
		expect(asym.sort()).toEqual(['fast', 'home', 'max', 'power']);
	});
});
