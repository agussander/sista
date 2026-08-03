import { describe, it, expect } from 'vitest';
import { CONFIG_DEFAULT, diaCorteValido, diaCorteONormal, normalizarConfig } from './config.js';

describe('diaCorteValido', () => {
	it('acepta enteros entre 1 y 31', () => {
		expect(diaCorteValido(1)).toBe(true);
		expect(diaCorteValido(10)).toBe(true);
		expect(diaCorteValido(31)).toBe(true);
	});

	it('rechaza 0', () => {
		// El caso central del bug: un input de "Primer corte" vaciado termina en
		// `Number(undefined)` -> `NaN` -> `null` en PocketBase -> `0` leido de
		// vuelta. `0 ?? 10` da `0`, no `10`: por eso hace falta esta validacion
		// explicita en vez de un `??`.
		expect(diaCorteValido(0)).toBe(false);
	});

	it('rechaza fuera de rango', () => {
		expect(diaCorteValido(32)).toBe(false);
		expect(diaCorteValido(-1)).toBe(false);
	});

	it('rechaza no enteros', () => {
		expect(diaCorteValido(10.5)).toBe(false);
		expect(diaCorteValido(NaN)).toBe(false);
		expect(diaCorteValido('10')).toBe(false);
		expect(diaCorteValido(undefined)).toBe(false);
		expect(diaCorteValido(null)).toBe(false);
	});
});

describe('diaCorteONormal', () => {
	it('devuelve el numero si es valido', () => {
		expect(diaCorteONormal(15, 10)).toBe(15);
	});

	it('cae al default con 0', () => {
		expect(diaCorteONormal(0, 10)).toBe(10);
	});

	it('cae al default con undefined (campo vacio)', () => {
		expect(diaCorteONormal(undefined, 10)).toBe(10);
	});

	it('cae al default con un string no numerico', () => {
		expect(diaCorteONormal('', 10)).toBe(10);
	});

	it('coacciona un string numerico valido', () => {
		expect(diaCorteONormal('15', 10)).toBe(15);
	});

	it('cae al default fuera de rango', () => {
		expect(diaCorteONormal(45, 10)).toBe(10);
	});
});

describe('normalizarConfig', () => {
	it('devuelve los defaults con un registro vacio', () => {
		expect(normalizarConfig(null)).toEqual(CONFIG_DEFAULT);
		expect(normalizarConfig(undefined)).toEqual(CONFIG_DEFAULT);
	});

	it('conserva los dias de corte validos', () => {
		const c = normalizarConfig({ dia_corte_1: 5, dia_corte_2: 15, dia_corte_tarjeta: 25 });
		expect(c.dia_corte_1).toBe(5);
		expect(c.dia_corte_2).toBe(15);
		expect(c.dia_corte_tarjeta).toBe(25);
	});

	it('reemplaza un dia_corte_1 en 0 por el default, sin propagarlo', () => {
		// Caso puntual del hallazgo: un registro guardado con el corte en 0
		// (por el bug de validacion, o creado a mano en PocketBase con el campo
		// vacio) tiene que corregirse en lectura, porque `alertas.js` no vuelve
		// a validar: usa `hoy.dia > corte1` tal cual, y con corte1=0 esa
		// comparacion es verdadera todos los dias para todos los clientes.
		const c = normalizarConfig({ dia_corte_1: 0, dia_corte_2: 20, dia_corte_tarjeta: 21 });
		expect(c.dia_corte_1).toBe(CONFIG_DEFAULT.dia_corte_1);
	});

	it('reemplaza dias de corte faltantes por el default', () => {
		const c = normalizarConfig({ entidades_tarjeta: [1] });
		expect(c.dia_corte_1).toBe(CONFIG_DEFAULT.dia_corte_1);
		expect(c.dia_corte_2).toBe(CONFIG_DEFAULT.dia_corte_2);
		expect(c.dia_corte_tarjeta).toBe(CONFIG_DEFAULT.dia_corte_tarjeta);
	});

	it('conserva el resto de los campos tal cual', () => {
		const c = normalizarConfig({ entidades_tarjeta: [1, 2], areas_soporte: [3] });
		expect(c.entidades_tarjeta).toEqual([1, 2]);
		expect(c.areas_soporte).toEqual([3]);
	});
});
