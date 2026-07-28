import { describe, it, expect } from 'vitest';
import {
	applyCreate,
	applyUpdate,
	applyDelete,
	totalPages,
	clampPage,
	paginate,
	formatExtra
} from './llamenmeLogic.js';

const lead = (id, extra = {}) => ({ id, numero: id, ...extra });

describe('applyCreate', () => {
	it('prepone el registro nuevo', () => {
		const out = applyCreate([lead('a')], lead('b'));
		expect(out.map((l) => l.id)).toEqual(['b', 'a']);
	});

	it('es idempotente si el id ya existe', () => {
		const base = [lead('a')];
		expect(applyCreate(base, lead('a'))).toBe(base);
	});

	it('ignora record nulo', () => {
		const base = [lead('a')];
		expect(applyCreate(base, null)).toBe(base);
	});
});

describe('applyUpdate', () => {
	it('reemplaza la fila con el mismo id', () => {
		const out = applyUpdate([lead('a', { agente: null }), lead('b')], lead('a', { agente: 'felipe' }));
		expect(out[0].agente).toBe('felipe');
		expect(out[1].id).toBe('b');
	});

	it('deja la lista igual si el id no está', () => {
		const base = [lead('a')];
		expect(applyUpdate(base, lead('z'))).toBe(base);
	});
});

describe('applyDelete', () => {
	it('quita la fila por id', () => {
		expect(applyDelete([lead('a'), lead('b')], 'a').map((l) => l.id)).toEqual(['b']);
	});
});

describe('formatExtra', () => {
	it('traduce cada preferencia conocida', () => {
		expect(formatExtra('en_horario')).toBe('En el momento');
		expect(formatExtra('manana')).toBe('Mañana (9 a 13)');
		expect(formatExtra('tarde')).toBe('Tarde (13 a 17)');
		expect(formatExtra('whatsapp')).toBe('WhatsApp');
		expect(formatExtra('sin_preferencia')).toBe('Sin preferencia');
	});

	it('muestra un guion cuando no hay preferencia', () => {
		expect(formatExtra('')).toBe('—');
		expect(formatExtra(null)).toBe('—');
		expect(formatExtra(undefined)).toBe('—');
	});

	it('devuelve el valor crudo si no lo conoce', () => {
		expect(formatExtra('otra_cosa')).toBe('otra_cosa');
	});
});

describe('paginación', () => {
	const items = Array.from({ length: 25 }, (_, i) => lead(String(i)));

	it('totalPages redondea hacia arriba y mínimo 1', () => {
		expect(totalPages(25)).toBe(3);
		expect(totalPages(0)).toBe(1);
		expect(totalPages(10)).toBe(1);
		expect(totalPages(11)).toBe(2);
	});

	it('clampPage acota al rango válido', () => {
		expect(clampPage(0, 25)).toBe(1);
		expect(clampPage(99, 25)).toBe(3);
		expect(clampPage(2, 25)).toBe(2);
	});

	it('paginate devuelve 10 por página', () => {
		expect(paginate(items, 1).map((l) => l.id)).toEqual(['0','1','2','3','4','5','6','7','8','9']);
		expect(paginate(items, 3)).toHaveLength(5);
	});

	it('paginate acota páginas fuera de rango', () => {
		expect(paginate(items, 99).map((l) => l.id)).toEqual(['20','21','22','23','24']);
	});
});
