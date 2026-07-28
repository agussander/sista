import { describe, it, expect } from 'vitest';
import {
	MOTIVO_PAGO,
	MOTIVO_PROVEEDOR,
	MOTIVO_OTRO,
	createEmptyData,
	isMotivoPago,
	isMotivoProveedor,
	isProveedorOfertaOtro,
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
		expect(data.proveedorOferta).toBe('');
		expect(data.proveedorOfertaOtro).toBe('');
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

	it('isMotivoProveedor detecta el motivo "Contraté otro proveedor"', () => {
		expect(isMotivoProveedor(MOTIVO_PROVEEDOR)).toBe(true);
		expect(isMotivoProveedor(MOTIVO_PAGO)).toBe(false);
		expect(isMotivoProveedor('')).toBe(false);
	});

	it('isProveedorOfertaOtro detecta la oferta "Otro"', () => {
		expect(isProveedorOfertaOtro('Otro')).toBe(true);
		expect(isProveedorOfertaOtro('Mejor precio')).toBe(false);
	});

	it('isPagoMedioOtro detecta el medio "otro"', () => {
		expect(isPagoMedioOtro('otro')).toBe(true);
		expect(isPagoMedioOtro('efectivo')).toBe(false);
	});

	it('isContactoNo es true solo cuando la respuesta es "No"', () => {
		expect(isContactoNo('No')).toBe(true);
		expect(isContactoNo('Sí')).toBe(false);
	});

	it('isContactoNoMotivoOtro detecta el motivo "otro"', () => {
		expect(isContactoNoMotivoOtro('otro')).toBe(true);
		expect(isContactoNoMotivoOtro('no sabía que se podía')).toBe(false);
	});

	it('isVolveriaCondicionVisible es true para "Sí" y "Tal vez", false para "No"', () => {
		expect(isVolveriaCondicionVisible('Sí')).toBe(true);
		expect(isVolveriaCondicionVisible('Tal vez')).toBe(true);
		expect(isVolveriaCondicionVisible('No')).toBe(false);
	});
});

describe('canSubmit', () => {
	const baseValid = () => ({
		...createEmptyData(),
		motivo: 'Contraté otro proveedor',
		proveedorOferta: 'Mejor precio',
		contactoPrevio: 'Sí',
		conformidad: '7',
		volveria: 'No'
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
		expect(canSubmit({ ...baseValid(), motivo: MOTIVO_PAGO, pagoMedio: '', pagoInconvenientes: 'Sí' })).toBe(false);
	});

	it('false cuando el medio de pago es "otro" sin especificar', () => {
		expect(
			canSubmit({
				...baseValid(),
				motivo: MOTIVO_PAGO,
				pagoMedio: 'otro',
				pagoMedioOtro: '',
				pagoInconvenientes: 'Sí'
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
			canSubmit({ ...baseValid(), motivo: MOTIVO_PAGO, pagoMedio: 'efectivo', pagoInconvenientes: 'No' })
		).toBe(true);
	});

	it('false cuando el motivo es "Contraté otro proveedor" y falta la oferta', () => {
		expect(canSubmit({ ...baseValid(), proveedorOferta: '' })).toBe(false);
	});

	it('true cuando la oferta es "Otro" aunque el detalle quede vacío (opcional)', () => {
		expect(
			canSubmit({ ...baseValid(), proveedorOferta: 'Otro', proveedorOfertaOtro: '' })
		).toBe(true);
	});

	it('la oferta no es obligatoria si el motivo no es de proveedor', () => {
		expect(
			canSubmit({ ...baseValid(), motivo: MOTIVO_OTRO, motivoOtro: 'razón X', proveedorOferta: '' })
		).toBe(true);
	});

	it('false cuando falta contactoPrevio', () => {
		expect(canSubmit({ ...baseValid(), contactoPrevio: '' })).toBe(false);
	});

	it('false cuando contactoPrevio es "No" y falta el motivo de no-contacto', () => {
		expect(canSubmit({ ...baseValid(), contactoPrevio: 'No', contactoNoMotivo: '' })).toBe(false);
	});

	it('false cuando el motivo de no-contacto es "otro" sin especificar', () => {
		expect(
			canSubmit({
				...baseValid(),
				contactoPrevio: 'No',
				contactoNoMotivo: 'otro',
				contactoNoOtro: ''
			})
		).toBe(false);
	});

	it('true cuando la rama de no-contacto está completa', () => {
		expect(
			canSubmit({
				...baseValid(),
				contactoPrevio: 'No',
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

	it('false cuando pagoInconvenientes no es "Sí" ni "No"', () => {
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
			contactoPrevio: 'Sí',
			conformidad: '8',
			queDiferente: '  algo  ',
			volveria: 'No',
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
		expect(payload.volveria).toBe('No');
		expect(payload.volveria_condicion).toBe('');
		expect(payload.comentarios).toBe('');
		expect(payload.id_nombre).toBe('Juan');
	});

	it('incluye los campos de la rama de pago solo si el motivo es de pago', () => {
		const dataSinRama = {
			...createEmptyData(),
			motivo: 'Contraté otro proveedor',
			pagoMedio: 'efectivo',
			contactoPrevio: 'Sí',
			conformidad: '5',
			volveria: 'No'
		};
		expect(buildPayload(dataSinRama).pago_medio).toBe('');

		const dataConRama = {
			...createEmptyData(),
			motivo: MOTIVO_PAGO,
			pagoMedio: 'otro',
			pagoMedioOtro: 'billetera virtual',
			pagoInconvenientes: 'Sí',
			pagoInconvenientesComentario: 'no me llegaba el aviso',
			contactoPrevio: 'Sí',
			conformidad: '5',
			volveria: 'No'
		};
		const payload = buildPayload(dataConRama);
		expect(payload.pago_medio).toBe('otro');
		expect(payload.pago_medio_otro).toBe('billetera virtual');
		expect(payload.pago_inconvenientes).toBe(true);
		expect(payload.pago_inconvenientes_comentario).toBe('no me llegaba el aviso');
	});

	it('incluye los campos de proveedor solo si el motivo es de proveedor', () => {
		const dataSinRama = {
			...createEmptyData(),
			motivo: MOTIVO_PAGO,
			proveedorOferta: 'Mejor precio',
			pagoMedio: 'efectivo',
			pagoInconvenientes: 'No',
			contactoPrevio: 'Sí',
			conformidad: '5',
			volveria: 'No'
		};
		expect(buildPayload(dataSinRama).proveedor_oferta).toBe('');

		const dataConRama = {
			...createEmptyData(),
			motivo: MOTIVO_PROVEEDOR,
			proveedorOferta: 'Otro',
			proveedorOfertaOtro: '  fibra simétrica  ',
			contactoPrevio: 'Sí',
			conformidad: '5',
			volveria: 'No'
		};
		const payload = buildPayload(dataConRama);
		expect(payload.proveedor_oferta).toBe('Otro');
		expect(payload.proveedor_oferta_otro).toBe('fibra simétrica');
	});

	it('deja proveedor_oferta_otro vacío cuando la oferta no es "Otro"', () => {
		const data = {
			...createEmptyData(),
			motivo: MOTIVO_PROVEEDOR,
			proveedorOferta: 'Mejor servicio de internet',
			proveedorOfertaOtro: 'no debería viajar',
			contactoPrevio: 'Sí',
			conformidad: '5',
			volveria: 'No'
		};
		const payload = buildPayload(data);
		expect(payload.proveedor_oferta).toBe('Mejor servicio de internet');
		expect(payload.proveedor_oferta_otro).toBe('');
	});

	it('incluye contacto_no_motivo solo si contactoPrevio es "No"', () => {
		const data = {
			...createEmptyData(),
			motivo: 'Contraté otro proveedor',
			contactoPrevio: 'No',
			contactoNoMotivo: 'no sabía que se podía',
			conformidad: '5',
			volveria: 'No'
		};
		expect(buildPayload(data).contacto_no_motivo).toBe('no sabía que se podía');
	});

	it('incluye volveria_condicion solo si volveria no es "No"', () => {
		const dataNo = {
			...createEmptyData(),
			motivo: 'Contraté otro proveedor',
			contactoPrevio: 'Sí',
			conformidad: '5',
			volveria: 'No',
			volveriaCondicion: 'esto no debería viajar'
		};
		expect(buildPayload(dataNo).volveria_condicion).toBe('');

		const dataSi = {
			...createEmptyData(),
			motivo: 'Contraté otro proveedor',
			contactoPrevio: 'Sí',
			conformidad: '5',
			volveria: 'Sí',
			volveriaCondicion: 'mejor precio'
		};
		expect(buildPayload(dataSi).volveria_condicion).toBe('mejor precio');
	});
});
