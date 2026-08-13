import { describe, it, expect } from 'vitest';
import { leerConfigCache, guardarConfigCache, olvidarConfigCache } from './configCache.js';

/** Un Storage falso: los tests corren en `environment: 'node'`, sin sessionStorage. */
function almacenFalso() {
	const datos = new Map();
	return {
		getItem: (k) => (datos.has(k) ? datos.get(k) : null),
		setItem: (k, v) => datos.set(k, String(v)),
		removeItem: (k) => datos.delete(k)
	};
}

/** Un Storage que tira siempre: Safari en modo privado, cookies bloqueadas. */
const almacenRoto = {
	getItem: () => {
		throw new Error('denied');
	},
	setItem: () => {
		throw new Error('denied');
	},
	removeItem: () => {
		throw new Error('denied');
	}
};

const CONFIG = { dia_corte_1: 10, dia_corte_2: 20, dia_corte_tarjeta: 21, entidades_tarjeta: [7] };

describe('configCache', () => {
	it('devuelve null cuando no hay nada guardado', () => {
		expect(leerConfigCache(almacenFalso())).toBe(null);
	});

	it('devuelve lo que se guardo', () => {
		const a = almacenFalso();
		guardarConfigCache(a, CONFIG);
		expect(leerConfigCache(a)).toEqual(CONFIG);
	});

	it('olvidar borra lo guardado', () => {
		const a = almacenFalso();
		guardarConfigCache(a, CONFIG);
		olvidarConfigCache(a);
		expect(leerConfigCache(a)).toBe(null);
	});

	it('devuelve null si lo guardado no es JSON valido', () => {
		const a = almacenFalso();
		a.setItem('cartera_config_v1', '{roto');
		expect(leerConfigCache(a)).toBe(null);
	});

	it('sin almacen (SSR) devuelve null y no explota al guardar', () => {
		expect(leerConfigCache(null)).toBe(null);
		expect(() => guardarConfigCache(null, CONFIG)).not.toThrow();
		expect(() => olvidarConfigCache(null)).not.toThrow();
	});

	it('con un almacen que tira, degrada a null sin propagar', () => {
		expect(leerConfigCache(almacenRoto)).toBe(null);
		expect(() => guardarConfigCache(almacenRoto, CONFIG)).not.toThrow();
		expect(() => olvidarConfigCache(almacenRoto)).not.toThrow();
	});
});
