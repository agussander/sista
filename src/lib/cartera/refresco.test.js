import { describe, it, expect } from 'vitest';
import { aRefrescar } from './refresco.js';

const AHORA = new Date('2026-07-15T12:00:00Z').getTime();
const hace = (horas) => new Date(AHORA - horas * 3600_000).toISOString();

const cli = (code, sincronizado, extra = {}) => ({
	code,
	sincronizado,
	perfil_pago: 'ventanilla',
	...extra
});

describe('aRefrescar', () => {
	const config = { dia_corte_1: 10, dia_corte_2: 20, dia_corte_tarjeta: 21 };
	const hoy = { anio: 2026, mes: 7, dia: 15 };

	it('deja afuera los frescos', () => {
		const r = aRefrescar([cli('001', hace(2))], { ahora: AHORA, hoy, config });
		expect(r).toEqual([]);
	});

	it('incluye los de mas de 12 horas', () => {
		const r = aRefrescar([cli('001', hace(13))], { ahora: AHORA, hoy, config });
		expect(r).toEqual(['001']);
	});

	it('incluye los que nunca se sincronizaron', () => {
		const r = aRefrescar([cli('001', '')], { ahora: AHORA, hoy, config });
		expect(r).toEqual(['001']);
	});

	it('corta en 20 codigos', () => {
		const clientes = Array.from({ length: 30 }, (_, i) => cli(String(i).padStart(3, '0'), hace(20)));
		const r = aRefrescar(clientes, { ahora: AHORA, hoy, config });
		expect(r).toHaveLength(20);
	});

	it('el prioritario le gana al mas viejo cuando solo uno esta en ventana', () => {
		const clientes = [
			cli('viejo-sin-riesgo', hace(100), { perfil_pago: 'tarjeta' }),
			cli('vencido-hace-poco', hace(13), { perfil_pago: 'ventanilla' })
		];
		// Dia 12: ventanilla vencio el 10 (dentro de 3 dias), tarjeta vence el 21.
		const r = aRefrescar(clientes, {
			ahora: AHORA,
			hoy: { anio: 2026, mes: 7, dia: 12 },
			config
		});

		expect(r[0]).toBe('vencido-hace-poco');
	});

	it('entre dos prioritarios gana el mas viejo', () => {
		const clientes = [cli('nuevo', hace(13)), cli('viejo', hace(100))];
		const r = aRefrescar(clientes, {
			ahora: AHORA,
			hoy: { anio: 2026, mes: 7, dia: 12 },
			config
		});

		expect(r[0]).toBe('viejo');
	});

	it('ignora los archivados', () => {
		const r = aRefrescar([cli('001', hace(50), { archivado: true })], { ahora: AHORA, hoy, config });
		expect(r).toEqual([]);
	});
});
