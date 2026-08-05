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

	it('conserva comercial_activity', () => {
		// Sondeo real (cliente 003566): el campo llega tal cual, con el typo de
		// IspCube ("comercial", no "commercial").
		const c = normalizarCliente({ ...crudo, comercial_activity: 'FACTURA EN DEBITO AUTOMATICO' });
		expect(c.comercial_activity).toBe('FACTURA EN DEBITO AUTOMATICO');
	});

	it('sin comercial_activity da string vacio', () => {
		expect(normalizarCliente({}).comercial_activity).toBe('');
	});
});

describe('normalizarCliente: connections y promos', () => {
	// Cliente 012377, sondeo real contra IspCube (GET /api/customer): dos
	// conexiones vivas (una con promo activa, una sin promo) y una tercera
	// dada de baja, agregada a mano para probar el filtro.
	const crudo = {
		connections: [
			{
				id: 35914,
				plan_id: 27,
				delete_date: null,
				deleted_in_provider: 0,
				promotion_id: 63,
				promotion_start_date: '2026-09-01 00:00:00',
				promotion_end_date: '2026-10-31 23:59:59',
				plan: { id: 27, name: 'Servicio de Internet basico POWER F131' },
				promotion: {
					id: 63,
					name: 'PROMOCION CHEQUE CARGO CONEXION',
					bill_detail: 'Bonificacion Cargo Conexión',
					value: '10000.00',
					months: 2
				}
			},
			{
				id: 40021,
				plan_id: 31,
				delete_date: null,
				deleted_in_provider: 0,
				promotion_id: null,
				promotion_start_date: null,
				promotion_end_date: null,
				plan: { id: 31, name: 'Plan TV Basico' }
			},
			{
				id: 50000,
				plan_id: 99,
				delete_date: '2026-01-01 00:00:00',
				deleted_in_provider: 0,
				promotion_id: 70,
				promotion_start_date: '2026-01-01 00:00:00',
				promotion_end_date: '2026-12-31 23:59:59',
				plan: { id: 99, name: 'Plan Borrado' },
				promotion: { id: 70, name: 'Promo Borrada', bill_detail: 'x' }
			}
		]
	};

	it('connections mapea plan_id y plan_nombre de las conexiones vivas', () => {
		const c = normalizarCliente(crudo);
		expect(c.connections).toEqual([
			{ plan_id: 27, plan_nombre: 'Servicio de Internet basico POWER F131' },
			{ plan_id: 31, plan_nombre: 'Plan TV Basico' }
		]);
	});

	it('connections excluye la conexion borrada', () => {
		const c = normalizarCliente(crudo);
		expect(c.connections.some((cx) => cx.plan_id === 99)).toBe(false);
	});

	it('connections y promos excluyen una conexion con deleted_in_provider aunque delete_date sea null', () => {
		const c = normalizarCliente({
			connections: [
				{
					id: 60000,
					plan_id: 100,
					delete_date: null,
					deleted_in_provider: 1,
					promotion_id: 80,
					promotion_start_date: '2026-01-01 00:00:00',
					promotion_end_date: '2026-12-31 23:59:59',
					plan: { id: 100, name: 'Plan Baja Proveedor' },
					promotion: { id: 80, name: 'Promo Baja Proveedor', bill_detail: 'x' }
				}
			]
		});
		expect(c.connections).toEqual([]);
		expect(c.promos).toEqual([]);
	});

	it('promos solo incluye la conexion con promotion_id y fecha de fin, viva', () => {
		const c = normalizarCliente(crudo);
		expect(c.promos).toEqual([
			{
				conexion_id: 35914,
				plan_nombre: 'Servicio de Internet basico POWER F131',
				promo_nombre: 'PROMOCION CHEQUE CARGO CONEXION',
				beneficio: 'Bonificacion Cargo Conexión',
				inicio: '2026-09-01',
				fin: '2026-10-31'
			}
		]);
	});

	it('promos excluye una conexion borrada aunque tenga promotion_id', () => {
		const c = normalizarCliente(crudo);
		expect(c.promos.some((p) => p.conexion_id === 50000)).toBe(false);
	});

	it('una conexion sin plan.name da plan_nombre vacio y conserva plan_id', () => {
		const c = normalizarCliente({
			connections: [{ id: 1, plan_id: 5, plan: {} }]
		});
		expect(c.connections).toEqual([{ plan_id: 5, plan_nombre: '' }]);
	});

	it('una conexion con promotion_id pero sin promotion_end_date no entra en promos', () => {
		const c = normalizarCliente({
			connections: [
				{
					id: 2,
					plan_id: 5,
					promotion_id: 10,
					promotion_start_date: '2026-01-01 00:00:00',
					promotion_end_date: null,
					plan: { name: 'Plan X' },
					promotion: { name: 'Promo X', bill_detail: 'y' }
				}
			]
		});
		expect(c.promos).toEqual([]);
	});

	it('una conexion con promotion_id pero sin promotion.name no entra en promos', () => {
		const c = normalizarCliente({
			connections: [
				{
					id: 3,
					plan_id: 5,
					promotion_id: 11,
					promotion_start_date: '2026-01-01 00:00:00',
					promotion_end_date: '2026-02-01 00:00:00',
					plan: { name: 'Plan X' },
					promotion: {}
				}
			]
		});
		expect(c.promos).toEqual([]);
	});

	it('connections ausente da dos arrays vacios', () => {
		const c = normalizarCliente({});
		expect(c.connections).toEqual([]);
		expect(c.promos).toEqual([]);
	});

	it('connections no es array da dos arrays vacios', () => {
		const c = normalizarCliente({ connections: 'no es un array' });
		expect(c.connections).toEqual([]);
		expect(c.promos).toEqual([]);
	});
});

describe('normalizarCliente: plan_nombre por catalogo cuando falta plan.name', () => {
	// Sondeo real (cliente 015387): las conexiones de TV/reventa (conntype
	// "nc") no traen `plan` anidado como si trae una conexion de internet
	// (conntype "pppoe") -solo `plan_id`-, asi que sin catalogo el chip queda
	// en blanco. `normalizarCliente` recibe un segundo parametro opcional,
	// `Map<number, string>` de `plan_id` a nombre, para resolverlo.
	it('sin plan.name pero con plan_id en el catalogo, usa el nombre del catalogo', () => {
		const nombrePorId = new Map([[151, 'Servicio tv basico Gigared ( Por cuenta y orden cuit 30663045179)']]);
		const c = normalizarCliente({ connections: [{ id: 1, plan_id: 151 }] }, nombrePorId);

		expect(c.connections).toEqual([
			{ plan_id: 151, plan_nombre: 'Servicio tv basico Gigared ( Por cuenta y orden cuit 30663045179)' }
		]);
	});

	it('sin plan.name y sin match en el catalogo, plan_nombre vacio', () => {
		const c = normalizarCliente({ connections: [{ id: 1, plan_id: 999 }] }, new Map());
		expect(c.connections).toEqual([{ plan_id: 999, plan_nombre: '' }]);
	});

	it('plan.name embebido tiene prioridad sobre el catalogo', () => {
		const nombrePorId = new Map([[27, 'No deberia usarse']]);
		const c = normalizarCliente(
			{ connections: [{ id: 1, plan_id: 27, plan: { name: 'Nombre embebido' } }] },
			nombrePorId
		);

		expect(c.connections[0].plan_nombre).toBe('Nombre embebido');
	});

	it('promos tambien resuelve plan_nombre desde el catalogo cuando falta plan.name', () => {
		const nombrePorId = new Map([[5, 'Plan del catalogo']]);
		const c = normalizarCliente(
			{
				connections: [
					{
						id: 1,
						plan_id: 5,
						promotion_id: 10,
						promotion_start_date: '2026-01-01 00:00:00',
						promotion_end_date: '2026-02-01 00:00:00',
						promotion: { name: 'Promo X', bill_detail: 'y' }
					}
				]
			},
			nombrePorId
		);

		expect(c.promos[0].plan_nombre).toBe('Plan del catalogo');
	});

	it('sin segundo argumento (llamadas existentes) sigue funcionando igual que antes', () => {
		const c = normalizarCliente({ connections: [{ id: 1, plan_id: 5, plan: {} }] });
		expect(c.connections).toEqual([{ plan_id: 5, plan_nombre: '' }]);
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

	it('es tarjeta si comercial_activity dice FACTURA EN DEBITO AUTOMATICO, aunque la entidad no clasifique', () => {
		// Sondeo real (cliente 003566): la entidad configurada como tarjeta en
		// `cartera_config` no siempre alcanza para detectar debito automatico.
		expect(perfilDe(2, [4, 7], 'FACTURA EN DEBITO AUTOMATICO')).toBe('tarjeta');
	});

	it('comercial_activity vacio no cambia el resultado por entidad', () => {
		expect(perfilDe(2, [4, 7], '')).toBe('ventanilla');
	});

	it('comercial_activity con otro texto no es tarjeta', () => {
		expect(perfilDe(2, [4, 7], 'ALGUN OTRO TEXTO')).toBe('ventanilla');
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
