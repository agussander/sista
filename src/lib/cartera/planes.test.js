import { describe, it, expect, afterEach } from 'vitest';
import { NOMBRES_PLAN, nombreCortoPlan } from './planes.js';

describe('nombreCortoPlan', () => {
	afterEach(() => {
		delete NOMBRES_PLAN[27];
	});

	it('plan_id ausente del diccionario devuelve el nombre completo', () => {
		expect(nombreCortoPlan(999, 'Servicio de Internet basico POWER F131')).toBe(
			'Servicio de Internet basico POWER F131'
		);
	});

	it('plan_id presente en el diccionario devuelve el nombre corto', () => {
		NOMBRES_PLAN[27] = 'Power';
		expect(nombreCortoPlan(27, 'Servicio de Internet basico POWER F131')).toBe('Power');
	});

	it('nombreCompleto vacio y sin match no revienta', () => {
		expect(nombreCortoPlan(1, '')).toBe('');
	});

	it('plan_id null sin match devuelve el nombre completo', () => {
		expect(nombreCortoPlan(null, 'Plan X')).toBe('Plan X');
	});
});
