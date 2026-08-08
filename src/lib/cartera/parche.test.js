import { describe, it, expect } from 'vitest';
import { construirParche } from './parche.js';

const HOY = { anio: 2026, mes: 8, dia: 8 };
const CONFIG = { entidades_tarjeta: [7], areas_soporte: [], estados_cerrados: [] };

/** Un cliente en el estado 'pendiente_pago': sin conexiones, sin alta_nap. */
const clienteBase = (extra = {}) => ({
	id: 'rec1',
	code: '001',
	perfil_manual: false,
	perfil_pago: 'ventanilla',
	connections: [],
	alta_nap: null,
	fecha_instalacion: '',
	pagos: [],
	...extra
});

/** Datos de /sync que dejan al cliente 'instalado'. */
const datosInstalado = (extra = {}) => ({
	nombre: 'PEREZ JUAN',
	doc_number: '20123456',
	ciudad: 'PUNTA LARA',
	estado: 'activo',
	start_date: '2026-07-01',
	entity_id: 3,
	entity_nombre: 'CAJA',
	debt: 0,
	duedebt: 0,
	connections: [{ id: 1 }],
	promos: [],
	alta_nap: { existe: true, cerrado: true, anulado: false, closed_date: '2026-08-05' },
	...extra
});

describe('construirParche', () => {
	it('prende instalado_aviso en la transicion a instalado', () => {
		const p = construirParche(clienteBase(), datosInstalado(), CONFIG, HOY);
		expect(p.instalado_aviso).toBe(true);
	});

	it('apaga instalado_aviso si ya estaba instalado', () => {
		const actual = clienteBase({
			connections: [{ id: 1 }],
			alta_nap: { existe: true, cerrado: true, anulado: false, closed_date: '2026-08-05' }
		});
		const p = construirParche(actual, datosInstalado(), CONFIG, HOY);
		expect(p.instalado_aviso).toBe(false);
	});

	it('sella fecha_instalacion con closed_date en la transicion', () => {
		const p = construirParche(clienteBase(), datosInstalado(), CONFIG, HOY);
		expect(p.fecha_instalacion).toBe('2026-08-05');
	});

	it('no pisa una fecha_instalacion que ya estaba cargada', () => {
		const p = construirParche(
			clienteBase({ fecha_instalacion: '2026-01-01' }),
			datosInstalado(),
			CONFIG,
			HOY
		);
		expect(p.fecha_instalacion).toBeUndefined();
	});

	it('conserva el alta_nap guardado si /sync no trajo tickets', () => {
		const guardada = { existe: true, cerrado: false, anulado: false, closed_date: '' };
		const p = construirParche(
			clienteBase({ alta_nap: guardada }),
			datosInstalado({ alta_nap: undefined }),
			CONFIG,
			HOY
		);
		expect(p.alta_nap).toEqual(guardada);
	});

	it('sin alta_nap en ningun lado usa el vacio, no null', () => {
		const p = construirParche(clienteBase(), datosInstalado({ alta_nap: undefined }), CONFIG, HOY);
		expect(p.alta_nap).toEqual({ existe: false, cerrado: false, anulado: false, closed_date: '' });
	});

	it('con perfil_manual respeta el perfil guardado', () => {
		const actual = clienteBase({ perfil_manual: true, perfil_pago: 'tarjeta' });
		const p = construirParche(actual, datosInstalado({ entity_id: 3 }), CONFIG, HOY);
		expect(p.perfil_pago).toBe('tarjeta');
	});

	it('sin perfil_manual recalcula el perfil con la config', () => {
		const p = construirParche(clienteBase(), datosInstalado({ entity_id: 7 }), CONFIG, HOY);
		expect(p.perfil_pago).toBe('tarjeta');
	});

	it('siempre apaga el flag nuevo', () => {
		const p = construirParche(clienteBase(), datosInstalado(), CONFIG, HOY);
		expect(p.nuevo).toBe(false);
	});

	it('no incluye pagos ni tickets si /sync no los trajo', () => {
		const p = construirParche(clienteBase(), datosInstalado(), CONFIG, HOY);
		expect(p).not.toHaveProperty('pagos');
		expect(p).not.toHaveProperty('tickets');
	});

	it('normaliza connections y promos a array', () => {
		const p = construirParche(
			clienteBase(),
			datosInstalado({ connections: null, promos: undefined }),
			CONFIG,
			HOY
		);
		expect(p.connections).toEqual([]);
		expect(p.promos).toEqual([]);
	});
});
