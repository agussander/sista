import { describe, it, expect } from 'vitest';
import {
	MOTIVO_PAGO,
	MOTIVO_OTRO,
	createEmptyData,
	isMotivoPago,
	isMotivoOtro,
	isPagoMedioOtro,
	isContactoNo,
	isContactoNoMotivoOtro,
	isVolveriaCondicionVisible,
	canSubmit,
	buildPayload
} from './encuestaBajaLogic.js';

describe('createEmptyData', () => {
	it('devuelve todos los campos vacíos', () => {
		const data = createEmptyData();
		expect(data.motivo).toBe('');
		expect(data.motivoOtro).toBe('');
		expect(data.pagoMedio).toBe('');
		expect(data.pagoMedioOtro).toBe('');
		expect(data.pagoInconvenientes).toBe('');
		expect(data.pagoInconvenientesComentario).toBe('');
		expect(data.contactoPrevio).toBe('');
		expect(data.contactoNoMotivo).toBe('');
		expect(data.contactoNoOtro).toBe('');
		expect(data.conformidad).toBe('');
		expect(data.queDiferente).toBe('');
		expect(data.volveria).toBe('');
		expect(data.volveriaCondicion).toBe('');
		expect(data.comentarios).toBe('');
		expect(data.idNombre).toBe('');
		expect(data.idTelefono).toBe('');
		expect(data.idCliente).toBe('');
	});
});

describe('detectores de rama', () => {
	it('isMotivoPago es true solo para el motivo de dificultades económicas', () => {
		expect(isMotivoPago(MOTIVO_PAGO)).toBe(true);
		expect(isMotivoPago('Contraté otro proveedor')).toBe(false);
		expect(isMotivoPago('')).toBe(false);
	});

	it('isMotivoOtro detecta el motivo "Otro"', () => {
		expect(isMotivoOtro(MOTIVO_OTRO)).toBe(true);
		expect(isMotivoOtro(MOTIVO_PAGO)).toBe(false);
	});

	it('isPagoMedioOtro detecta el medio "otro"', () => {
		expect(isPagoMedioOtro('otro')).toBe(true);
		expect(isPagoMedioOtro('efectivo')).toBe(false);
	});

	it('isContactoNo es true solo cuando la respuesta es "no"', () => {
		expect(isContactoNo('no')).toBe(true);
		expect(isContactoNo('sí')).toBe(false);
	});

	it('isContactoNoMotivoOtro detecta el motivo "otro"', () => {
		expect(isContactoNoMotivoOtro('otro')).toBe(true);
		expect(isContactoNoMotivoOtro('no sabía que se podía')).toBe(false);
	});

	it('isVolveriaCondicionVisible es true para "sí" y "tal vez", false para "no"', () => {
		expect(isVolveriaCondicionVisible('sí')).toBe(true);
		expect(isVolveriaCondicionVisible('tal vez')).toBe(true);
		expect(isVolveriaCondicionVisible('no')).toBe(false);
	});
});

describe('canSubmit', () => {
	const baseValid = () => ({
		...createEmptyData(),
		motivo: 'Contraté otro proveedor',
		contactoPrevio: 'sí',
		conformidad: '7',
		volveria: 'no'
	});

	it('false cuando falta el motivo', () => {
		expect(canSubmit({ ...baseValid(), motivo: '' })).toBe(false);
	});

	it('false cuando el motivo es "Otro" sin especificar', () => {
		expect(canSubmit({ ...baseValid(), motivo: MOTIVO_OTRO, motivoOtro: '' })).toBe(false);
	});

	it('true cuando el motivo es "Otro" con texto', () => {
		expect(canSubmit({ ...baseValid(), motivo: MOTIVO_OTRO, motivoOtro: 'razón X' })).toBe(true);
	});

	it('false cuando el motivo es de pago y falta el medio de pago', () => {
		expect(canSubmit({ ...baseValid(), motivo: MOTIVO_PAGO, pagoMedio: '', pagoInconvenientes: 'sí' })).toBe(false);
	});

	it('false cuando el medio de pago es "otro" sin especificar', () => {
		expect(
			canSubmit({
				...baseValid(),
				motivo: MOTIVO_PAGO,
				pagoMedio: 'otro',
				pagoMedioOtro: '',
				pagoInconvenientes: 'sí'
			})
		).toBe(false);
	});

	it('false cuando el motivo es de pago y falta sí/no de inconvenientes', () => {
		expect(
			canSubmit({ ...baseValid(), motivo: MOTIVO_PAGO, pagoMedio: 'efectivo', pagoInconvenientes: '' })
		).toBe(false);
	});

	it('true cuando la rama de pago está completa', () => {
		expect(
			canSubmit({ ...baseValid(), motivo: MOTIVO_PAGO, pagoMedio: 'efectivo', pagoInconvenientes: 'no' })
		).toBe(true);
	});

	it('false cuando falta contactoPrevio', () => {
		expect(canSubmit({ ...baseValid(), contactoPrevio: '' })).toBe(false);
	});

	it('false cuando contactoPrevio es "no" y falta el motivo de no-contacto', () => {
		expect(canSubmit({ ...baseValid(), contactoPrevio: 'no', contactoNoMotivo: '' })).toBe(false);
	});

	it('false cuando el motivo de no-contacto es "otro" sin especificar', () => {
		expect(
			canSubmit({
				...baseValid(),
				contactoPrevio: 'no',
				contactoNoMotivo: 'otro',
				contactoNoOtro: ''
			})
		).toBe(false);
	});

	it('true cuando la rama de no-contacto está completa', () => {
		expect(
			canSubmit({
				...baseValid(),
				contactoPrevio: 'no',
				contactoNoMotivo: 'no tenía tiempo'
			})
		).toBe(true);
	});

	it('false cuando falta conformidad', () => {
		expect(canSubmit({ ...baseValid(), conformidad: '' })).toBe(false);
	});

	it('false cuando falta volveria', () => {
		expect(canSubmit({ ...baseValid(), volveria: '' })).toBe(false);
	});

	it('true con solo los campos obligatorios de la rama simple', () => {
		expect(canSubmit(baseValid())).toBe(true);
	});

	it('false cuando conformidad no está en el conjunto cerrado de opciones', () => {
		expect(canSubmit({ ...baseValid(), conformidad: 'abc' })).toBe(false);
	});

	it('false cuando pagoInconvenientes no es "sí" ni "no"', () => {
		expect(
			canSubmit({
				...baseValid(),
				motivo: MOTIVO_PAGO,
				pagoMedio: 'efectivo',
				pagoInconvenientes: 'maybe'
			})
		).toBe(false);
	});
});

describe('buildPayload', () => {
	it('arma el payload base sin ramas condicionales activas', () => {
		const data = {
			...createEmptyData(),
			motivo: 'Contraté otro proveedor',
			contactoPrevio: 'sí',
			conformidad: '8',
			queDiferente: '  algo  ',
			volveria: 'no',
			comentarios: ' ',
			idNombre: 'Juan'
		};
		const payload = buildPayload(data);
		expect(payload.motivo).toBe('Contraté otro proveedor');
		expect(payload.motivo_otro).toBe('');
		expect(payload.pago_medio).toBe('');
		expect(payload.pago_medio_otro).toBe('');
		expect(payload.pago_inconvenientes).toBe(null);
		expect(payload.pago_inconvenientes_comentario).toBe('');
		expect(payload.contacto_previo).toBe(true);
		expect(payload.contacto_no_motivo).toBe('');
		expect(payload.contacto_no_otro).toBe('');
		expect(payload.conformidad).toBe(8);
		expect(payload.que_diferente).toBe('algo');
		expect(payload.volveria).toBe('no');
		expect(payload.volveria_condicion).toBe('');
		expect(payload.comentarios).toBe('');
		expect(payload.id_nombre).toBe('Juan');
	});

	it('incluye los campos de la rama de pago solo si el motivo es de pago', () => {
		const dataSinRama = {
			...createEmptyData(),
			motivo: 'Contraté otro proveedor',
			pagoMedio: 'efectivo',
			contactoPrevio: 'sí',
			conformidad: '5',
			volveria: 'no'
		};
		expect(buildPayload(dataSinRama).pago_medio).toBe('');

		const dataConRama = {
			...createEmptyData(),
			motivo: MOTIVO_PAGO,
			pagoMedio: 'otro',
			pagoMedioOtro: 'billetera virtual',
			pagoInconvenientes: 'sí',
			pagoInconvenientesComentario: 'no me llegaba el aviso',
			contactoPrevio: 'sí',
			conformidad: '5',
			volveria: 'no'
		};
		const payload = buildPayload(dataConRama);
		expect(payload.pago_medio).toBe('otro');
		expect(payload.pago_medio_otro).toBe('billetera virtual');
		expect(payload.pago_inconvenientes).toBe(true);
		expect(payload.pago_inconvenientes_comentario).toBe('no me llegaba el aviso');
	});

	it('incluye contacto_no_motivo solo si contactoPrevio es "no"', () => {
		const data = {
			...createEmptyData(),
			motivo: 'Contraté otro proveedor',
			contactoPrevio: 'no',
			contactoNoMotivo: 'no sabía que se podía',
			conformidad: '5',
			volveria: 'no'
		};
		expect(buildPayload(data).contacto_no_motivo).toBe('no sabía que se podía');
	});

	it('incluye volveria_condicion solo si volveria no es "no"', () => {
		const dataNo = {
			...createEmptyData(),
			motivo: 'Contraté otro proveedor',
			contactoPrevio: 'sí',
			conformidad: '5',
			volveria: 'no',
			volveriaCondicion: 'esto no debería viajar'
		};
		expect(buildPayload(dataNo).volveria_condicion).toBe('');

		const dataSi = {
			...createEmptyData(),
			motivo: 'Contraté otro proveedor',
			contactoPrevio: 'sí',
			conformidad: '5',
			volveria: 'sí',
			volveriaCondicion: 'mejor precio'
		};
		expect(buildPayload(dataSi).volveria_condicion).toBe('mejor precio');
	});
});
