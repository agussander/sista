import { describe, it, expect } from 'vitest';
import { normalizarCliente, perfilDe, resumenTickets } from './normalizar.js';

describe('normalizarCliente', () => {
	const crudo = {
		code: '003365',
		name: 'RIOS ANA MARIA',
		status: 'enabled',
		start_date: '2026-05-01 00:00:00',
		entity_id: 4,
		entity: { id: 4, name: 'Tarjeta Visa' },
		debt: '12000.00',
		duedebt: '0.00'
	};

	it('normaliza el nombre a mayuscula inicial', () => {
		expect(normalizarCliente(crudo).nombre).toBe('Rios Ana Maria');
	});

	it('conserva el code con sus ceros', () => {
		expect(normalizarCliente(crudo).code).toBe('003365');
	});

	it('pasa las deudas a numero', () => {
		const c = normalizarCliente(crudo);
		expect(c.debt).toBe(12000);
		expect(c.duedebt).toBe(0);
	});

	it('recorta start_date a la fecha sola', () => {
		expect(normalizarCliente(crudo).start_date).toBe('2026-05-01');
	});

	it('toma el nombre de la entidad de entity.name', () => {
		const c = normalizarCliente(crudo);
		expect(c.entity_id).toBe(4);
		expect(c.entity_nombre).toBe('Tarjeta Visa');
	});

	it('tolera un cliente sin entidad', () => {
		const c = normalizarCliente({ ...crudo, entity_id: null, entity: null });
		expect(c.entity_id).toBeNull();
		expect(c.entity_nombre).toBe('');
	});

	it('tolera campos ausentes sin explotar', () => {
		const c = normalizarCliente({});
		expect(c.nombre).toBe('');
		expect(c.debt).toBe(0);
		expect(c.start_date).toBe('');
	});
});

describe('perfilDe', () => {
	it('es tarjeta si la entidad esta en la lista', () => {
		expect(perfilDe(4, [4, 7])).toBe('tarjeta');
	});

	it('es ventanilla si no esta', () => {
		expect(perfilDe(2, [4, 7])).toBe('ventanilla');
	});

	it('con la lista vacia todos son ventanilla', () => {
		// Default deliberado: el panel funciona antes de configurarse.
		expect(perfilDe(4, [])).toBe('ventanilla');
	});

	it('tolera ids como string', () => {
		expect(perfilDe('4', [4])).toBe('tarjeta');
	});

	it('sin entidad es ventanilla', () => {
		expect(perfilDe(null, [4])).toBe('ventanilla');
	});
});

describe('resumenTickets', () => {
	const t = (id, area, cerrado, fecha) => ({
		id,
		ticket_area_id: area,
		ticket_status_id: cerrado ? 3 : 1,
		deleted_at: null,
		created_at: fecha
	});

	it('cuenta abiertos y cerrados', () => {
		const r = resumenTickets(
			[t(1, 6, false, '2026-07-10T09:00:00.000000Z'), t(2, 6, true, '2026-06-01T09:00:00.000000Z')],
			{ areasSoporte: [6], estadosCerrados: [3] }
		);

		expect(r.abiertos).toBe(1);
		expect(r.cerrados).toBe(1);
	});

	it('el ultimo es el mas reciente', () => {
		const r = resumenTickets(
			[t(1, 6, false, '2026-06-01T09:00:00.000000Z'), t(2, 6, false, '2026-07-10T09:00:00.000000Z')],
			{ areasSoporte: [6], estadosCerrados: [3] }
		);

		expect(r.ultimo.id).toBe(2);
		expect(r.ultimo.fecha).toBe('2026-07-10T09:00:00.000000Z');
	});

	it('filtra por area de soporte', () => {
		const r = resumenTickets(
			[t(1, 6, false, '2026-07-10T09:00:00.000000Z'), t(2, 9, false, '2026-07-11T09:00:00.000000Z')],
			{ areasSoporte: [6], estadosCerrados: [3] }
		);

		expect(r.abiertos).toBe(1);
		expect(r.ultimo.id).toBe(1);
	});

	it('con areasSoporte vacio cuenta todas las areas', () => {
		const r = resumenTickets(
			[t(1, 6, false, '2026-07-10T09:00:00.000000Z'), t(2, 9, false, '2026-07-11T09:00:00.000000Z')],
			{ areasSoporte: [], estadosCerrados: [3] }
		);

		expect(r.abiertos).toBe(2);
	});

	it('ignora tickets borrados', () => {
		const borrado = { ...t(1, 6, false, '2026-07-10T09:00:00.000000Z'), deleted_at: '2026-07-11' };
		const r = resumenTickets([borrado], { areasSoporte: [6], estadosCerrados: [3] });

		expect(r.abiertos).toBe(0);
		expect(r.ultimo).toBeNull();
	});

	it('sin tickets devuelve ceros y ultimo null', () => {
		const r = resumenTickets([], { areasSoporte: [6], estadosCerrados: [3] });
		expect(r).toEqual({ abiertos: 0, cerrados: 0, ultimo: null });
	});

	it('tolera una entrada que no es array', () => {
		expect(resumenTickets(null, { areasSoporte: [], estadosCerrados: [3] })).toEqual({
			abiertos: 0,
			cerrados: 0,
			ultimo: null
		});
	});
});
