import { describe, it, expect } from 'vitest';
import { estadoInstalacionDe } from './instalacion.js';

const altaNap = (over = {}) => ({ existe: true, cerrado: false, anulado: false, ...over });

describe('estadoInstalacionDe', () => {
	it('sin conexiones activas, pendiente_pago sin importar el ticket', () => {
		expect(
			estadoInstalacionDe({ connections: [], alta_nap: altaNap({ cerrado: true }) })
		).toBe('pendiente_pago');
	});

	it('habilitado con el ticket cerrado, instalado', () => {
		expect(
			estadoInstalacionDe({ connections: [{ plan_id: 1 }], alta_nap: altaNap({ cerrado: true }) })
		).toBe('instalado');
	});

	it('habilitado sin ticket de NAP, instalacion_pendiente', () => {
		expect(
			estadoInstalacionDe({ connections: [{ plan_id: 1 }], alta_nap: { existe: false, cerrado: false, anulado: false } })
		).toBe('instalacion_pendiente');
	});

	it('habilitado con el ticket abierto (no cerrado, no anulado), instalacion_pendiente', () => {
		expect(
			estadoInstalacionDe({ connections: [{ plan_id: 1 }], alta_nap: altaNap({ cerrado: false, anulado: false }) })
		).toBe('instalacion_pendiente');
	});

	it('habilitado con el ticket anulado, instalacion_pendiente (la alerta es aparte)', () => {
		expect(
			estadoInstalacionDe({ connections: [{ plan_id: 1 }], alta_nap: altaNap({ cerrado: false, anulado: true }) })
		).toBe('instalacion_pendiente');
	});

	it('sin connections en el cliente (undefined), no explota y da pendiente_pago', () => {
		expect(estadoInstalacionDe({ alta_nap: altaNap({ cerrado: true }) })).toBe('pendiente_pago');
	});

	it('sin alta_nap en el cliente (null, todavia no llego el primer sync), instalacion_pendiente si esta habilitado', () => {
		expect(estadoInstalacionDe({ connections: [{ plan_id: 1 }], alta_nap: null })).toBe(
			'instalacion_pendiente'
		);
	});
});
