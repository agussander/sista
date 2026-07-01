import { describe, it, expect } from 'vitest';
import { isWithinCallHours, computeFormVisible, OVERRIDE_VALUES } from './visibility.js';

describe('isWithinCallHours', () => {
	it('es true un miércoles al mediodía', () => {
		expect(isWithinCallHours(new Date('2024-01-10T15:00:00Z'))).toBe(true);
	});

	it('es false un miércoles a las 20:00 ART', () => {
		expect(isWithinCallHours(new Date('2024-01-10T23:00:00Z'))).toBe(false);
	});

	it('es false un sábado al mediodía', () => {
		expect(isWithinCallHours(new Date('2024-01-13T15:00:00Z'))).toBe(false);
	});

	it('incluye el borde de apertura, 9:30 ART', () => {
		expect(isWithinCallHours(new Date('2024-01-10T12:30:00Z'))).toBe(true);
	});

	it('excluye un minuto antes de abrir, 9:29 ART', () => {
		expect(isWithinCallHours(new Date('2024-01-10T12:29:00Z'))).toBe(false);
	});

	it('incluye el borde de cierre, 16:30 ART', () => {
		expect(isWithinCallHours(new Date('2024-01-10T19:30:00Z'))).toBe(true);
	});

	it('excluye un minuto después de cerrar, 16:31 ART', () => {
		expect(isWithinCallHours(new Date('2024-01-10T19:31:00Z'))).toBe(false);
	});
});

describe('computeFormVisible', () => {
	const dentroDeHorario = new Date('2024-01-10T15:00:00Z'); // miércoles 12:00 ART
	const fueraDeHorario = new Date('2024-01-10T23:00:00Z'); // miércoles 20:00 ART

	it('"abierto" fuerza visible aunque esté fuera de horario', () => {
		expect(computeFormVisible('abierto', fueraDeHorario)).toBe(true);
	});

	it('"cerrado" fuerza oculto aunque esté dentro de horario', () => {
		expect(computeFormVisible('cerrado', dentroDeHorario)).toBe(false);
	});

	it('"auto" sigue el horario cuando está dentro', () => {
		expect(computeFormVisible('auto', dentroDeHorario)).toBe(true);
	});

	it('"auto" sigue el horario cuando está fuera', () => {
		expect(computeFormVisible('auto', fueraDeHorario)).toBe(false);
	});

	it('un valor desconocido se comporta como "auto"', () => {
		expect(computeFormVisible('lo-que-sea', dentroDeHorario)).toBe(true);
	});
});

describe('OVERRIDE_VALUES', () => {
	it('contiene los 3 estados válidos', () => {
		expect(OVERRIDE_VALUES).toEqual(['auto', 'abierto', 'cerrado']);
	});
});
