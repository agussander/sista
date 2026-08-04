import { describe, it, expect } from 'vitest';
import { alertasDe, diaCorteDe } from './alertas.js';

const CONFIG = {
	dia_corte_1: 10,
	dia_corte_2: 20,
	dia_corte_tarjeta: 21
};

/** Cliente base: instalado hace mucho, al dia, sin tickets nuevos. */
const base = {
	fecha_instalacion: '2025-01-10',
	ultimo_contacto: '',
	perfil_pago: 'ventanilla',
	pagos: [{ mes: '2026-07', dia: 5, monto: 12000 }],
	tickets: { abiertos: 0, cerrados: 3, ultimo: null },
	tickets_vistos_hasta: '2026-07-01'
};

const tipos = (r) => r.map((a) => a.tipo);

describe('diaCorteDe', () => {
	it('ventanilla corta el 10', () => {
		expect(diaCorteDe('ventanilla', CONFIG)).toBe(10);
	});

	it('tarjeta corta el 21', () => {
		expect(diaCorteDe('tarjeta', CONFIG)).toBe(21);
	});
});

describe('alerta de seguimiento a los 2 meses', () => {
	it('no salta antes de los dos meses', () => {
		const r = alertasDe(
			{ ...base, fecha_instalacion: '2026-06-10' },
			{ anio: 2026, mes: 7, dia: 15 },
			CONFIG
		);

		expect(tipos(r)).not.toContain('seguimiento');
	});

	it('salta cumplidos los dos meses sin contacto', () => {
		const r = alertasDe(
			{ ...base, fecha_instalacion: '2026-05-10' },
			{ anio: 2026, mes: 7, dia: 15 },
			CONFIG
		);

		expect(tipos(r)).toContain('seguimiento');
	});

	it('salta el dia exacto en que se cumplen los dos meses', () => {
		const r = alertasDe(
			{ ...base, fecha_instalacion: '2026-05-15' },
			{ anio: 2026, mes: 7, dia: 15 },
			CONFIG
		);

		expect(tipos(r)).toContain('seguimiento');
	});

	it('un contacto posterior a la instalacion la apaga', () => {
		const r = alertasDe(
			{ ...base, fecha_instalacion: '2026-05-10', ultimo_contacto: '2026-07-01' },
			{ anio: 2026, mes: 7, dia: 15 },
			CONFIG
		);

		expect(tipos(r)).not.toContain('seguimiento');
	});

	it('un contacto anterior a la instalacion no cuenta', () => {
		const r = alertasDe(
			{ ...base, fecha_instalacion: '2026-05-10', ultimo_contacto: '2026-04-01' },
			{ anio: 2026, mes: 7, dia: 15 },
			CONFIG
		);

		expect(tipos(r)).toContain('seguimiento');
	});

	it('un ultimo_contacto vacio no la apaga', () => {
		// El store solo escribe este campo con notas de tipo contacto: una nota
		// interna lo deja como estaba, y por eso no apaga la alerta.
		const r = alertasDe(
			{ ...base, fecha_instalacion: '2026-05-10', ultimo_contacto: '' },
			{ anio: 2026, mes: 7, dia: 15 },
			CONFIG
		);

		expect(tipos(r)).toContain('seguimiento');
	});

	it('sin fecha de instalacion no se calcula', () => {
		const r = alertasDe({ ...base, fecha_instalacion: '' }, { anio: 2026, mes: 7, dia: 15 }, CONFIG);

		expect(tipos(r)).not.toContain('seguimiento');
	});
});

describe('alertas de mora', () => {
	const sinPagos = { ...base, pagos: [] };

	it('no hay mora antes del primer corte', () => {
		const r = alertasDe(sinPagos, { anio: 2026, mes: 7, dia: 9 }, CONFIG);
		expect(tipos(r)).not.toContain('mora_1');
	});

	it('mora_1 pasado el dia 10 sin pago', () => {
		const r = alertasDe(sinPagos, { anio: 2026, mes: 7, dia: 11 }, CONFIG);
		expect(tipos(r)).toContain('mora_1');
		expect(tipos(r)).not.toContain('mora_2');
	});

	it('sin mora_1 justo el dia del corte (ventanilla, dia 10)', () => {
		// El corte es inclusive: pagar el mismo dia 10 todavia esta en ventana.
		const r = alertasDe(sinPagos, { anio: 2026, mes: 7, dia: 10 }, CONFIG);
		expect(tipos(r)).not.toContain('mora_1');
	});

	it('mora_2 pasado el dia 20 sin pago', () => {
		const r = alertasDe(sinPagos, { anio: 2026, mes: 7, dia: 21 }, CONFIG);
		expect(tipos(r)).toContain('mora_2');
	});

	it('mora_1 sin mora_2 justo el dia 20 (ventanilla)', () => {
		// Ya paso el corte 1 (10) pero el corte 2 (20) todavia es inclusive.
		const r = alertasDe(sinPagos, { anio: 2026, mes: 7, dia: 20 }, CONFIG);
		expect(tipos(r)).toContain('mora_1');
		expect(tipos(r)).not.toContain('mora_2');
	});

	it('un pago en el mes apaga las dos', () => {
		const r = alertasDe(
			{ ...base, pagos: [{ mes: '2026-07', dia: 25, monto: 1 }] },
			{ anio: 2026, mes: 7, dia: 28 },
			CONFIG
		);

		expect(tipos(r)).not.toContain('mora_1');
		expect(tipos(r)).not.toContain('mora_2');
	});

	it('a un cliente de tarjeta no se le aplica el corte del 10', () => {
		const r = alertasDe(
			{ ...sinPagos, perfil_pago: 'tarjeta' },
			{ anio: 2026, mes: 7, dia: 15 },
			CONFIG
		);

		// Es dia 15 y no pago: a un cliente de ventanilla ya le habria saltado
		// mora_1. Al de tarjeta no, porque su ventana llega hasta el 21.
		//
		// Se afirma la ausencia de las dos moras y no `toEqual([])`, porque el
		// cliente base de este bloque lleva 18 meses instalado y sin contacto:
		// su alerta de seguimiento salta con razon y no tiene nada que ver con
		// lo que este test mide.
		expect(tipos(r)).not.toContain('mora_1');
		expect(tipos(r)).not.toContain('mora_2');
	});

	it('a un cliente de tarjeta le salta la mora pasado el 21', () => {
		const r = alertasDe(
			{ ...sinPagos, perfil_pago: 'tarjeta' },
			{ anio: 2026, mes: 7, dia: 22 },
			CONFIG
		);

		expect(tipos(r)).toContain('mora_1');
	});

	it('a un cliente de tarjeta no le salta mora_1 justo el dia 21', () => {
		// El corte de tarjeta tambien es inclusive.
		const r = alertasDe(
			{ ...sinPagos, perfil_pago: 'tarjeta' },
			{ anio: 2026, mes: 7, dia: 21 },
			CONFIG
		);

		expect(tipos(r)).not.toContain('mora_1');
	});

	it('a un cliente de tarjeta nunca le salta mora_2', () => {
		const r = alertasDe(
			{ ...sinPagos, perfil_pago: 'tarjeta' },
			{ anio: 2026, mes: 7, dia: 28 },
			CONFIG
		);

		expect(tipos(r)).not.toContain('mora_2');
	});

	it('no hay mora en el mes de la instalacion', () => {
		// Recien instalado: se le factura recien desde el 1 del mes siguiente.
		const r = alertasDe(
			{ ...sinPagos, fecha_instalacion: '2026-07-02' },
			{ anio: 2026, mes: 7, dia: 25 },
			CONFIG
		);

		expect(tipos(r)).not.toContain('mora_1');
	});

	it('instalado el 1: ese mismo mes ya puede tener mora', () => {
		// La excepcion de la regla: el mes se factura entero.
		const r = alertasDe(
			{ ...sinPagos, fecha_instalacion: '2026-07-01' },
			{ anio: 2026, mes: 7, dia: 25 },
			CONFIG
		);

		expect(tipos(r)).toContain('mora_1');
	});

	it('hay mora en el mes siguiente a la instalacion', () => {
		// Instalado el 20 de junio: julio ya es un mes exigible.
		const r = alertasDe(
			{ ...sinPagos, fecha_instalacion: '2026-06-20' },
			{ anio: 2026, mes: 7, dia: 25 },
			CONFIG
		);

		expect(tipos(r)).toContain('mora_1');
	});

	it('mora_1 si pago este mes pero IspCube todavia reporta duedebt', () => {
		// Pago $100 el 5 y debe $30000 desde el 25: el recibo existe pero la
		// deuda vencida de IspCube sigue en pie, y la mora tiene que verlo.
		const r = alertasDe(
			{
				...base,
				pagos: [{ mes: '2026-07', dia: 5, monto: 100 }],
				duedebt: 30000
			},
			{ anio: 2026, mes: 7, dia: 25 },
			CONFIG
		);

		expect(tipos(r)).toContain('mora_1');
	});

	it('sin mora si pago este mes y duedebt es 0', () => {
		const r = alertasDe(
			{
				...base,
				pagos: [{ mes: '2026-07', dia: 5, monto: 12000 }],
				duedebt: 0
			},
			{ anio: 2026, mes: 7, dia: 25 },
			CONFIG
		);

		expect(tipos(r)).not.toContain('mora_1');
	});

	it('sin mora si hay duedebt pero todavia no paso el corte', () => {
		// El gate del dia sigue mandando: duedebt no lo saltea.
		const r = alertasDe(
			{ ...sinPagos, duedebt: 30000 },
			{ anio: 2026, mes: 7, dia: 9 },
			CONFIG
		);

		expect(tipos(r)).not.toContain('mora_1');
	});

	it('duedebt ausente se comporta como 0, sin explotar', () => {
		const r = alertasDe(
			{
				...base,
				pagos: [{ mes: '2026-07', dia: 5, monto: 12000 }]
				// sin campo duedebt
			},
			{ anio: 2026, mes: 7, dia: 25 },
			CONFIG
		);

		expect(tipos(r)).not.toContain('mora_1');
	});

	it('no hay mora si la instalacion es en un mes futuro', () => {
		// Bug: el guard comparaba con `===`, asi que una instalacion futura
		// (fecha mal cargada o alta programada) no lo alcanzaba y la mora
		// disparaba igual.
		const r = alertasDe(
			{ ...sinPagos, fecha_instalacion: '2026-09-10' },
			{ anio: 2026, mes: 7, dia: 25 },
			CONFIG
		);

		expect(tipos(r)).not.toContain('mora_1');
		expect(tipos(r)).not.toContain('mora_2');
	});
});

describe('alerta de tickets nuevos', () => {
	it('salta cuando hay un ticket posterior a la marca de visto', () => {
		const r = alertasDe(
			{
				...base,
				tickets: { abiertos: 1, cerrados: 0, ultimo: { fecha: '2026-07-10 09:00:00' } },
				tickets_vistos_hasta: '2026-07-01'
			},
			{ anio: 2026, mes: 7, dia: 15 },
			CONFIG
		);

		expect(tipos(r)).toContain('tickets');
	});

	it('no salta si el ultimo ticket es anterior a la marca', () => {
		const r = alertasDe(
			{
				...base,
				tickets: { abiertos: 1, cerrados: 0, ultimo: { fecha: '2026-06-10 09:00:00' } },
				tickets_vistos_hasta: '2026-07-01'
			},
			{ anio: 2026, mes: 7, dia: 15 },
			CONFIG
		);

		expect(tipos(r)).not.toContain('tickets');
	});

	it('sin marca de visto, cualquier ticket cuenta como nuevo', () => {
		const r = alertasDe(
			{
				...base,
				tickets: { abiertos: 1, cerrados: 0, ultimo: { fecha: '2026-06-10 09:00:00' } },
				tickets_vistos_hasta: ''
			},
			{ anio: 2026, mes: 7, dia: 15 },
			CONFIG
		);

		expect(tipos(r)).toContain('tickets');
	});

	it('sin tickets no salta', () => {
		const r = alertasDe(base, { anio: 2026, mes: 7, dia: 15 }, CONFIG);
		expect(tipos(r)).not.toContain('tickets');
	});

	it('salta con un ticket mas tarde el mismo dia que la marca de visto', () => {
		// Bug: con granularidad de dia, tickets_vistos_hasta escrito a la manana
		// y un ticket abierto esa misma tarde no alertaban nunca.
		const r = alertasDe(
			{
				...base,
				tickets: { abiertos: 1, cerrados: 0, ultimo: { fecha: '2026-07-14T18:00:00.000000Z' } },
				tickets_vistos_hasta: '2026-07-14T09:00:00.000000Z'
			},
			{ anio: 2026, mes: 7, dia: 15 },
			CONFIG
		);

		expect(tipos(r)).toContain('tickets');
	});

	it('no salta con un ticket mas temprano el mismo dia que la marca de visto', () => {
		const r = alertasDe(
			{
				...base,
				tickets: { abiertos: 1, cerrados: 0, ultimo: { fecha: '2026-07-14T09:00:00.000000Z' } },
				tickets_vistos_hasta: '2026-07-14T18:00:00.000000Z'
			},
			{ anio: 2026, mes: 7, dia: 15 },
			CONFIG
		);

		expect(tipos(r)).not.toContain('tickets');
	});

	it('no salta si el ticket y la marca de visto son el mismo instante', () => {
		// "Visto hasta" incluye ese instante.
		const r = alertasDe(
			{
				...base,
				tickets: { abiertos: 1, cerrados: 0, ultimo: { fecha: '2026-07-14T18:00:00.000000Z' } },
				tickets_vistos_hasta: '2026-07-14T18:00:00.000000Z'
			},
			{ anio: 2026, mes: 7, dia: 15 },
			CONFIG
		);

		expect(tipos(r)).not.toContain('tickets');
	});
});

describe('alerta de recordatorio', () => {
	const hoy = { anio: 2026, mes: 8, dia: 4 };

	it('un recordatorio con fecha pasada la enciende', () => {
		const r = alertasDe(base, hoy, CONFIG, [
			{ fecha: '2026-08-01', texto: 'Llamar por el router' }
		]);

		expect(tipos(r)).toContain('recordatorio');
	});

	it('un recordatorio con fecha de hoy la enciende', () => {
		// El borde es >=: si me anote algo para hoy, hoy tengo que verlo.
		const r = alertasDe(base, hoy, CONFIG, [{ fecha: '2026-08-04', texto: 'Es hoy' }]);

		expect(tipos(r)).toContain('recordatorio');
	});

	it('un recordatorio futuro no la enciende', () => {
		const r = alertasDe(base, hoy, CONFIG, [{ fecha: '2026-08-05', texto: 'Es mañana' }]);

		expect(tipos(r)).not.toContain('recordatorio');
	});

	it('varios vencidos dan una sola alerta, la del mas viejo', () => {
		// En la practica hay uno por cliente; si hay varios, N chips iguales en
		// la fila de la lista solo hacen ruido. El detalle los lista a todos.
		const r = alertasDe(base, hoy, CONFIG, [
			{ fecha: '2026-08-03', texto: 'El nuevo' },
			{ fecha: '2026-07-20', texto: 'El viejo' }
		]);

		const recordatorios = r.filter((a) => a.tipo === 'recordatorio');
		expect(recordatorios).toHaveLength(1);
		expect(recordatorios[0].texto).toBe('El viejo');
		expect(recordatorios[0].desde).toBe('2026-07-20');
	});

	it('una fecha invalida o vacia se ignora', () => {
		const r = alertasDe(base, hoy, CONFIG, [
			{ fecha: '', texto: 'sin fecha' },
			{ fecha: 'pronto', texto: 'fecha en prosa' }
		]);

		expect(tipos(r)).not.toContain('recordatorio');
	});

	it('sin el cuarto argumento no emite recordatorio', () => {
		expect(tipos(alertasDe(base, hoy, CONFIG))).not.toContain('recordatorio');
	});
});
