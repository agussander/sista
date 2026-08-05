import { describe, it, expect } from 'vitest';
import { desdeCuando } from './relativo.js';

// Un instante fijo como "ahora" para todos los casos: la funcion lo recibe por
// parametro justamente para no tener que congelar el reloj del proceso.
const AHORA = Date.parse('2026-08-05T15:00:00.000Z');
const hace = (ms) => new Date(AHORA - ms).toISOString();

const SEGUNDO = 1000;
const MINUTO = 60 * SEGUNDO;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;

describe('desdeCuando', () => {
	it('sin fecha dice nunca', () => {
		expect(desdeCuando('', AHORA)).toBe('nunca');
		expect(desdeCuando(null, AHORA)).toBe('nunca');
		expect(desdeCuando(undefined, AHORA)).toBe('nunca');
	});

	it('una fecha que no se puede parsear dice nunca', () => {
		expect(desdeCuando('pronto', AHORA)).toBe('nunca');
	});

	it('hace menos de un minuto es recien', () => {
		expect(desdeCuando(hace(0), AHORA)).toBe('recién');
		expect(desdeCuando(hace(59 * SEGUNDO), AHORA)).toBe('recién');
	});

	it('al minuto pasa a minutos', () => {
		expect(desdeCuando(hace(MINUTO), AHORA)).toBe('hace 1 min');
	});

	it('cuenta minutos hasta los 59', () => {
		expect(desdeCuando(hace(5 * MINUTO), AHORA)).toBe('hace 5 min');
		expect(desdeCuando(hace(59 * MINUTO), AHORA)).toBe('hace 59 min');
	});

	it('a la hora pasa a horas', () => {
		expect(desdeCuando(hace(HORA), AHORA)).toBe('hace 1 h');
		expect(desdeCuando(hace(23 * HORA), AHORA)).toBe('hace 23 h');
	});

	it('al dia pasa a dias', () => {
		expect(desdeCuando(hace(DIA), AHORA)).toBe('hace 1 d');
		expect(desdeCuando(hace(9 * DIA), AHORA)).toBe('hace 9 d');
	});

	it('una fecha en el futuro es recien, no un numero negativo', () => {
		// Pasa cuando el reloj del servidor va adelantado respecto del navegador.
		expect(desdeCuando(hace(-5 * MINUTO), AHORA)).toBe('recién');
	});
});
