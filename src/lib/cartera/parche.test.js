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

	it('agrega tickets tal cual si /sync los trajo', () => {
		const tickets = [{ id: 1, ticket_category_id: 69 }];
		const p = construirParche(clienteBase(), datosInstalado({ tickets }), CONFIG, HOY);
		expect(p.tickets).toEqual(tickets);
	});

	it('copia los campos planos de /sync tal cual, sin mezclarlos entre si', () => {
		const p = construirParche(clienteBase(), datosInstalado(), CONFIG, HOY);
		expect(p).toMatchObject({
			nombre: 'PEREZ JUAN',
			doc_number: '20123456',
			ciudad: 'PUNTA LARA',
			estado: 'activo',
			start_date: '2026-07-01',
			entity_id: 3,
			entity_nombre: 'CAJA',
			debt: 0,
			duedebt: 0
		});
	});

	it('en pagos, el mes que trae /sync pisa al guardado cuando coinciden', () => {
		// Mismo mes en los dos lados, con datos distintos: si `fusionarPagos`
		// se llamara con los argumentos invertidos, ganaria el guardado (viejo)
		// en vez del que acaba de traer /sync.
		const actual = clienteBase({ pagos: [{ mes: '2026-07', dia: 5, monto: 100 }] });
		const datos = datosInstalado({ pagos: [{ mes: '2026-07', dia: 20, monto: 250 }] });
		const p = construirParche(actual, datos, CONFIG, HOY);
		expect(p.pagos.find((x) => x.mes === '2026-07')).toEqual({
			mes: '2026-07',
			dia: 20,
			monto: 250
		});
	});

	it('poda del historial de pagos lo anterior a los 12 meses contados desde `hoy`', () => {
		// HOY es 2026-08, asi que la ventana de 12 meses arranca en 2025-09:
		// 2025-08 queda afuera. Si `hoy` se reemplazara por una fecha fija
		// vieja, este pago no se podaria.
		const actual = clienteBase({ pagos: [{ mes: '2025-08', dia: 10, monto: 50 }] });
		const datos = datosInstalado({ pagos: [{ mes: '2026-08', dia: 1, monto: 10 }] });
		const p = construirParche(actual, datos, CONFIG, HOY);
		const meses = p.pagos.map((x) => x.mes);
		expect(meses).not.toContain('2025-08');
		expect(meses).toContain('2026-08');
	});

	it('con la marca de debito automatico fuerza tarjeta aunque la entidad no este configurada', () => {
		// La marca viene en `datos.comercial_activity` (lo que trajo /sync),
		// no en `actual.comercial_activity`: el snapshot guardado no tiene ese
		// campo. entity_id 3 no esta en `entidades_tarjeta` ([7]), asi que si
		// esto da 'tarjeta' es por la marca, no por la entidad.
		const p = construirParche(
			clienteBase(),
			datosInstalado({ entity_id: 3, comercial_activity: 'FACTURA EN DEBITO AUTOMATICO' }),
			CONFIG,
			HOY
		);
		expect(p.perfil_pago).toBe('tarjeta');
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
