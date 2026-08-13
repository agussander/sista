import { describe, it, expect } from 'vitest';
import {
	isWithinCallHours,
	computeInCallWindow,
	computeCallHeading,
	computeWhatsappSublabel,
	isFormVisible,
	OVERRIDE_VALUES
} from './visibility.js';

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

	it('incluye el borde de apertura, 9:00 ART', () => {
		expect(isWithinCallHours(new Date('2024-01-10T12:00:00Z'))).toBe(true);
	});

	it('excluye un minuto antes de abrir, 8:59 ART', () => {
		expect(isWithinCallHours(new Date('2024-01-10T11:59:00Z'))).toBe(false);
	});

	it('incluye el borde de cierre, 16:40 ART', () => {
		expect(isWithinCallHours(new Date('2024-01-10T19:40:00Z'))).toBe(true);
	});

	it('excluye un minuto después de cerrar, 16:41 ART', () => {
		expect(isWithinCallHours(new Date('2024-01-10T19:41:00Z'))).toBe(false);
	});
});

describe('computeInCallWindow', () => {
	const dentroDeHorario = new Date('2024-01-10T15:00:00Z'); // miércoles 12:00 ART
	const fueraDeHorario = new Date('2024-01-10T23:00:00Z'); // miércoles 20:00 ART

	it('"abierto" fuerza modo en-horario aunque esté fuera de horario', () => {
		expect(computeInCallWindow('abierto', fueraDeHorario)).toBe(true);
	});

	it('"cerrado" fuerza modo fuera-de-horario aunque esté dentro', () => {
		expect(computeInCallWindow('cerrado', dentroDeHorario)).toBe(false);
	});

	it('"auto" sigue el horario cuando está dentro', () => {
		expect(computeInCallWindow('auto', dentroDeHorario)).toBe(true);
	});

	it('"auto" sigue el horario cuando está fuera', () => {
		expect(computeInCallWindow('auto', fueraDeHorario)).toBe(false);
	});

	it('un valor desconocido se comporta como "auto"', () => {
		expect(computeInCallWindow('lo-que-sea', dentroDeHorario)).toBe(true);
	});

	it('"oculto" no toca la ventana de llamado: sigue el horario', () => {
		expect(computeInCallWindow('oculto', dentroDeHorario)).toBe(true);
		expect(computeInCallWindow('oculto', fueraDeHorario)).toBe(false);
	});
});

describe('isFormVisible', () => {
	it('"oculto" esconde el formulario', () => {
		expect(isFormVisible('oculto')).toBe(false);
	});

	it('los otros estados lo dejan visible', () => {
		expect(isFormVisible('auto')).toBe(true);
		expect(isFormVisible('abierto')).toBe(true);
		expect(isFormVisible('cerrado')).toBe(true);
	});

	it('un valor desconocido deja el formulario visible', () => {
		expect(isFormVisible('lo-que-sea')).toBe(true);
		expect(isFormVisible(undefined)).toBe(true);
	});
});

describe('computeCallHeading', () => {
	it('día de semana antes de las 9:00 → "Te llamamos hoy"', () => {
		// miércoles 08:00 ART
		expect(computeCallHeading(new Date('2024-01-10T11:00:00Z'))).toBe('Te llamamos hoy');
	});

	it('viernes a la mañana temprano también es "hoy"', () => {
		// viernes 08:00 ART
		expect(computeCallHeading(new Date('2024-01-12T11:00:00Z'))).toBe('Te llamamos hoy');
	});

	it('viernes después de cerrar → "Te llamamos el lunes"', () => {
		// viernes 20:00 ART
		expect(computeCallHeading(new Date('2024-01-12T23:00:00Z'))).toBe('Te llamamos el lunes');
	});

	it('sábado → "Te llamamos el lunes"', () => {
		// sábado 15:00 ART
		expect(computeCallHeading(new Date('2024-01-13T18:00:00Z'))).toBe('Te llamamos el lunes');
	});

	it('domingo → "Te llamamos mañana"', () => {
		// domingo 15:00 ART
		expect(computeCallHeading(new Date('2024-01-14T18:00:00Z'))).toBe('Te llamamos mañana');
	});

	it('martes de noche → "Te llamamos mañana"', () => {
		// martes 20:00 ART
		expect(computeCallHeading(new Date('2024-01-09T23:00:00Z'))).toBe('Te llamamos mañana');
	});
});

describe('computeWhatsappSublabel', () => {
	it('día de semana → "En línea hasta las 22:00"', () => {
		expect(computeWhatsappSublabel(new Date('2024-01-10T23:00:00Z'))).toBe('En línea hasta las 22:00');
	});

	it('sábado → "En línea hasta las 19:00"', () => {
		expect(computeWhatsappSublabel(new Date('2024-01-13T18:00:00Z'))).toBe('En línea hasta las 19:00');
	});

	it('domingo → "Guardia técnica"', () => {
		expect(computeWhatsappSublabel(new Date('2024-01-14T18:00:00Z'))).toBe('Guardia técnica');
	});
});

describe('OVERRIDE_VALUES', () => {
	it('contiene los 4 estados válidos', () => {
		expect(OVERRIDE_VALUES).toEqual(['auto', 'abierto', 'cerrado', 'oculto']);
	});
});
