import { describe, it, expect } from 'vitest';
import { pagosDeCobranzas, fusionarPagos, puntosPorMes, primerMesFacturable } from './pagos.js';

const cobranza = (real_date, total = '12000.00') => ({ real_date, date: '2020-01-01', total });

describe('pagosDeCobranzas', () => {
	it('usa real_date y no date', () => {
		// En IspCube estos dos campos difieren; el que dice cuando pago de verdad
		// es real_date.
		expect(pagosDeCobranzas([cobranza('2026-07-08 10:00:00')])).toEqual([
			{ mes: '2026-07', dia: 8, monto: 12000 }
		]);
	});

	it('se queda con el primer pago del mes cuando hay varios', () => {
		const pagos = pagosDeCobranzas([
			cobranza('2026-07-20 10:00:00', '5000.00'),
			cobranza('2026-07-08 10:00:00', '7000.00')
		]);

		expect(pagos).toEqual([{ mes: '2026-07', dia: 8, monto: 12000 }]);
	});

	it('ignora cobranzas sin fecha valida', () => {
		expect(pagosDeCobranzas([cobranza(null), cobranza('2026-07-08 10:00:00')])).toEqual([
			{ mes: '2026-07', dia: 8, monto: 12000 }
		]);
	});

	it('devuelve lista vacia ante una entrada que no es array', () => {
		expect(pagosDeCobranzas(null)).toEqual([]);
		expect(pagosDeCobranzas(undefined)).toEqual([]);
	});
});

describe('fusionarPagos', () => {
	it('conserva los meses viejos que la api ya no devuelve', () => {
		const guardados = [{ mes: '2026-01', dia: 5, monto: 10000 }];
		const nuevos = [{ mes: '2026-07', dia: 8, monto: 12000 }];

		expect(fusionarPagos(guardados, nuevos, { anio: 2026, mes: 7, dia: 15 })).toEqual([
			{ mes: '2026-01', dia: 5, monto: 10000 },
			{ mes: '2026-07', dia: 8, monto: 12000 }
		]);
	});

	it('los datos nuevos pisan a los guardados del mismo mes', () => {
		const guardados = [{ mes: '2026-07', dia: 25, monto: 5000 }];
		const nuevos = [{ mes: '2026-07', dia: 8, monto: 12000 }];

		expect(fusionarPagos(guardados, nuevos, { anio: 2026, mes: 7, dia: 15 })).toEqual([
			{ mes: '2026-07', dia: 8, monto: 12000 }
		]);
	});

	it('poda lo anterior a 12 meses', () => {
		const guardados = [
			{ mes: '2025-06', dia: 5, monto: 1 },
			{ mes: '2025-08', dia: 5, monto: 2 }
		];

		expect(fusionarPagos(guardados, [], { anio: 2026, mes: 7, dia: 15 })).toEqual([
			{ mes: '2025-08', dia: 5, monto: 2 }
		]);
	});

	it('tolera un histórico guardado nulo', () => {
		expect(fusionarPagos(null, [{ mes: '2026-07', dia: 8, monto: 1 }], { anio: 2026, mes: 7, dia: 1 })).toEqual([
			{ mes: '2026-07', dia: 8, monto: 1 }
		]);
	});
});

describe('primerMesFacturable', () => {
	it('es el mes siguiente cuando la instalacion no cae el dia 1', () => {
		expect(primerMesFacturable({ anio: 2026, mes: 6, dia: 20 })).toBe('2026-07');
		expect(primerMesFacturable({ anio: 2026, mes: 6, dia: 2 })).toBe('2026-07');
	});

	it('es el mismo mes cuando la instalacion cae el dia 1', () => {
		expect(primerMesFacturable({ anio: 2026, mes: 6, dia: 1 })).toBe('2026-06');
	});

	it('cruza el año', () => {
		expect(primerMesFacturable({ anio: 2026, mes: 12, dia: 15 })).toBe('2027-01');
	});

	it('sin fecha de instalacion no hay primer mes', () => {
		expect(primerMesFacturable(null)).toBe(null);
		expect(primerMesFacturable(undefined)).toBe(null);
	});
});

describe('puntosPorMes', () => {
	const hoy = { anio: 2026, mes: 7, dia: 15 };
	const instalacion = { anio: 2025, mes: 1, dia: 10 };

	it('verde cuando pago dentro de la ventana de ventanilla', () => {
		const puntos = puntosPorMes([{ mes: '2026-07', dia: 8, monto: 1 }], {
			perfil: 'ventanilla',
			diaCorte: 10,
			instalacion,
			hoy,
			meses: 1
		});

		expect(puntos).toEqual([{ mes: '2026-07', estado: 'verde', dia: 8, monto: 1 }]);
	});

	it('verde cuando pago exactamente el dia del corte', () => {
		const puntos = puntosPorMes([{ mes: '2026-07', dia: 10, monto: 1 }], {
			perfil: 'ventanilla',
			diaCorte: 10,
			instalacion,
			hoy,
			meses: 1
		});

		expect(puntos[0].estado).toBe('verde');
	});

	it('amarillo cuando pago pasado el corte pero dentro del mes', () => {
		const puntos = puntosPorMes([{ mes: '2026-07', dia: 11, monto: 1 }], {
			perfil: 'ventanilla',
			diaCorte: 10,
			instalacion,
			hoy,
			meses: 1
		});

		expect(puntos[0].estado).toBe('amarillo');
	});

	it('para tarjeta la ventana llega hasta el 21', () => {
		const puntos = puntosPorMes([{ mes: '2026-07', dia: 21, monto: 1 }], {
			perfil: 'tarjeta',
			diaCorte: 21,
			instalacion,
			hoy,
			meses: 1
		});

		expect(puntos[0].estado).toBe('verde');
	});

	it('rojo cuando no hubo pago en el mes', () => {
		const puntos = puntosPorMes([], {
			perfil: 'ventanilla',
			diaCorte: 10,
			instalacion,
			hoy: { anio: 2026, mes: 7, dia: 28 },
			meses: 1
		});

		expect(puntos[0].estado).toBe('rojo');
	});

	it('gris hasta el mes de la instalacion inclusive', () => {
		// Sin el gris, un cliente de dos meses aparece con seis puntos rojos.
		// El mes del medio (2026-06) es el de la instalacion y tambien es gris:
		// se le factura recien desde el 1 del mes siguiente.
		const puntos = puntosPorMes([], {
			perfil: 'ventanilla',
			diaCorte: 10,
			instalacion: { anio: 2026, mes: 6, dia: 20 },
			hoy: { anio: 2026, mes: 7, dia: 28 },
			meses: 3
		});

		expect(puntos.map((p) => p.estado)).toEqual(['gris', 'gris', 'rojo']);
	});

	it('gris en el mes de la instalacion sin pago', () => {
		const puntos = puntosPorMes([], {
			perfil: 'ventanilla',
			diaCorte: 10,
			instalacion: { anio: 2026, mes: 7, dia: 2 },
			hoy: { anio: 2026, mes: 7, dia: 28 },
			meses: 1
		});

		expect(puntos[0].estado).toBe('gris');
	});

	it('gris en el mes de la instalacion aunque haya cobranza', () => {
		// Una cobranza del mes de la instalacion (instalacion, proporcional,
		// primer recibo) no es una cuota mensual: el historial arranca el mes
		// siguiente y el punto no se muestra.
		const puntos = puntosPorMes([{ mes: '2026-07', dia: 5, monto: 1 }], {
			perfil: 'ventanilla',
			diaCorte: 10,
			instalacion: { anio: 2026, mes: 7, dia: 2 },
			hoy: { anio: 2026, mes: 7, dia: 28 },
			meses: 1
		});

		expect(puntos[0].estado).toBe('gris');
	});

	it('instalado el 1: ese mismo mes ya cuenta', () => {
		// Unica excepcion: si la instalacion cae el dia 1, el mes se factura
		// entero y es el primer mes del historial.
		const puntos = puntosPorMes([], {
			perfil: 'ventanilla',
			diaCorte: 10,
			instalacion: { anio: 2026, mes: 7, dia: 1 },
			hoy: { anio: 2026, mes: 7, dia: 28 },
			meses: 1
		});

		expect(puntos[0].estado).toBe('rojo');
	});

	it('el primer mes facturable se trata como cualquier otro', () => {
		// Instalado el 20 de junio: julio es el primer mes exigible y, sin pago
		// pasado el corte, es rojo. No hay mes extra de gracia.
		const puntos = puntosPorMes([], {
			perfil: 'ventanilla',
			diaCorte: 10,
			instalacion: { anio: 2026, mes: 6, dia: 20 },
			hoy: { anio: 2026, mes: 7, dia: 28 },
			meses: 1
		});

		expect(puntos[0].estado).toBe('rojo');
	});

	it('el primer mes facturable sigue siendo pendiente antes del corte', () => {
		const puntos = puntosPorMes([], {
			perfil: 'ventanilla',
			diaCorte: 10,
			instalacion: { anio: 2026, mes: 6, dia: 20 },
			hoy: { anio: 2026, mes: 7, dia: 5 },
			meses: 1
		});

		expect(puntos[0].estado).toBe('pendiente');
	});

	it('el mes en curso no es rojo si todavia no vencio el corte', () => {
		// Es dia 5 y el corte es el 10: todavia no debe nada.
		const puntos = puntosPorMes([], {
			perfil: 'ventanilla',
			diaCorte: 10,
			instalacion,
			hoy: { anio: 2026, mes: 7, dia: 5 },
			meses: 1
		});

		expect(puntos[0].estado).toBe('pendiente');
	});

	it('pendiente justo el dia del corte sin pago (el corte es inclusive)', () => {
		const puntos = puntosPorMes([], {
			perfil: 'ventanilla',
			diaCorte: 10,
			instalacion,
			hoy: { anio: 2026, mes: 7, dia: 10 },
			meses: 1
		});

		expect(puntos[0].estado).toBe('pendiente');
	});

	it('devuelve un punto por mes, del mas viejo al mas nuevo', () => {
		const puntos = puntosPorMes([{ mes: '2026-06', dia: 3, monto: 1 }], {
			perfil: 'ventanilla',
			diaCorte: 10,
			instalacion,
			hoy,
			meses: 6
		});

		expect(puntos).toHaveLength(6);
		expect(puntos[0].mes).toBe('2026-02');
		expect(puntos[5].mes).toBe('2026-07');
	});
});
