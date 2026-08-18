import { describe, it, expect } from 'vitest';
import {
	applyCreate,
	applyUpdate,
	applyDelete,
	totalPages,
	clampPage,
	paginate,
	formatExtra,
	timeAgo
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
		const out = applyUpdate([lead('a', { atendido: false }), lead('b')], lead('a', { atendido: true }));
		expect(out[0].atendido).toBe(true);
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

describe('timeAgo', () => {
	// "Ahora" fijo para que el texto no dependa del reloj real.
	const now = new Date('2024-03-10T12:00:00Z');
	const hace = (ms) => new Date(now.getTime() - ms);

	const SEG = 1000;
	const MIN = 60 * SEG;
	const HORA = 60 * MIN;
	const DIA = 24 * HORA;

	it('devuelve vacío si no hay fecha', () => {
		expect(timeAgo(null, now)).toBe('');
		expect(timeAgo(undefined, now)).toBe('');
	});

	it('una fecha futura es "recién"', () => {
		expect(timeAgo(new Date(now.getTime() + MIN), now)).toBe('recién');
	});

	it('menos de un minuto son "unos segundos"', () => {
		expect(timeAgo(hace(30 * SEG), now)).toBe('hace unos segundos');
	});

	it('singular y plural en minutos', () => {
		expect(timeAgo(hace(MIN), now)).toBe('hace 1 minuto');
		expect(timeAgo(hace(5 * MIN), now)).toBe('hace 5 minutos');
	});

	it('singular y plural en horas', () => {
		expect(timeAgo(hace(HORA), now)).toBe('hace 1 hora');
		expect(timeAgo(hace(3 * HORA), now)).toBe('hace 3 horas');
	});

	it('singular y plural en días', () => {
		expect(timeAgo(hace(DIA), now)).toBe('hace 1 día');
		expect(timeAgo(hace(3 * DIA), now)).toBe('hace 3 días');
	});

	it('meses y años', () => {
		expect(timeAgo(hace(30 * DIA), now)).toBe('hace 1 mes');
		expect(timeAgo(hace(365 * DIA), now)).toBe('hace 1 año');
	});

	it('acepta la fecha como string ISO (como viene de PocketBase)', () => {
		expect(timeAgo(hace(5 * MIN).toISOString(), now)).toBe('hace 5 minutos');
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
