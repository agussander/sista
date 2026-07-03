// Lógica pura (sin dependencias de Svelte/PocketBase) de la encuesta de baja.
// Se mantiene aparte del componente para poder testearla con Vitest.

export const MOTIVO_PAGO = 'No pude pagar por dificultades económicas';
export const MOTIVO_OTRO = 'Otro';
const MEDIO_OTRO = 'otro';
const CONTACTO_NO_OTRO = 'otro';

export const MOTIVO_OPTIONS = [
	MOTIVO_PAGO,
	'Me pareció que el precio no era acorde al servicio',
	'Tuve problemas técnicos/de conexión sin resolver',
	'Contraté otro proveedor',
	'Ya no necesito el servicio (mudanza, etc.)',
	MOTIVO_OTRO
];

export const PAGO_MEDIO_OPTIONS = ['efectivo', 'transferencia', 'débito automático', MEDIO_OTRO];

export const SI_NO_OPTIONS = ['sí', 'no'];

export const CONTACTO_NO_MOTIVO_OPTIONS = [
	'no sabía que se podía',
	'no tenía tiempo',
	'no creí que hubiera solución',
	CONTACTO_NO_OTRO
];

export const CONFORMIDAD_OPTIONS = Array.from({ length: 10 }, (_, i) => String(i + 1));

export const VOLVERIA_OPTIONS = ['sí', 'tal vez', 'no'];

export function createEmptyData() {
	return {
		motivo: '',
		motivoOtro: '',
		pagoMedio: '',
		pagoMedioOtro: '',
		pagoInconvenientes: '',
		pagoInconvenientesComentario: '',
		contactoPrevio: '',
		contactoNoMotivo: '',
		contactoNoOtro: '',
		conformidad: '',
		queDiferente: '',
		volveria: '',
		volveriaCondicion: '',
		comentarios: '',
		idNombre: '',
		idTelefono: '',
		idCliente: ''
	};
}

export function isMotivoPago(motivo) {
	return motivo === MOTIVO_PAGO;
}

export function isMotivoOtro(motivo) {
	return motivo === MOTIVO_OTRO;
}

export function isPagoMedioOtro(pagoMedio) {
	return pagoMedio === MEDIO_OTRO;
}

export function isContactoNo(contactoPrevio) {
	return contactoPrevio === 'no';
}

export function isContactoNoMotivoOtro(contactoNoMotivo) {
	return contactoNoMotivo === CONTACTO_NO_OTRO;
}

export function isVolveriaCondicionVisible(volveria) {
	return volveria === 'sí' || volveria === 'tal vez';
}

export function canSubmit(data) {
	if (!data.motivo) return false;
	if (isMotivoOtro(data.motivo) && !data.motivoOtro.trim()) return false;

	if (isMotivoPago(data.motivo)) {
		if (!data.pagoMedio) return false;
		if (isPagoMedioOtro(data.pagoMedio) && !data.pagoMedioOtro.trim()) return false;
		if (!SI_NO_OPTIONS.includes(data.pagoInconvenientes)) return false;
	}

	if (!data.contactoPrevio) return false;
	if (isContactoNo(data.contactoPrevio)) {
		if (!data.contactoNoMotivo) return false;
		if (isContactoNoMotivoOtro(data.contactoNoMotivo) && !data.contactoNoOtro.trim()) return false;
	}

	if (!CONFORMIDAD_OPTIONS.includes(data.conformidad)) return false;
	if (!data.volveria) return false;

	return true;
}

export function buildPayload(data) {
	const payload = {
		motivo: data.motivo,
		motivo_otro: isMotivoOtro(data.motivo) ? data.motivoOtro.trim() : '',
		pago_medio: '',
		pago_medio_otro: '',
		pago_inconvenientes: null,
		pago_inconvenientes_comentario: '',
		contacto_previo: data.contactoPrevio === 'sí',
		contacto_no_motivo: '',
		contacto_no_otro: '',
		conformidad: Number(data.conformidad),
		que_diferente: data.queDiferente.trim(),
		volveria: data.volveria,
		volveria_condicion: '',
		comentarios: data.comentarios.trim(),
		id_nombre: data.idNombre.trim(),
		id_telefono: data.idTelefono.trim(),
		id_cliente: data.idCliente.trim()
	};

	if (isMotivoPago(data.motivo)) {
		payload.pago_medio = data.pagoMedio;
		payload.pago_medio_otro = isPagoMedioOtro(data.pagoMedio) ? data.pagoMedioOtro.trim() : '';
		payload.pago_inconvenientes = data.pagoInconvenientes === 'sí';
		payload.pago_inconvenientes_comentario = data.pagoInconvenientesComentario.trim();
	}

	if (isContactoNo(data.contactoPrevio)) {
		payload.contacto_no_motivo = data.contactoNoMotivo;
		payload.contacto_no_otro = isContactoNoMotivoOtro(data.contactoNoMotivo)
			? data.contactoNoOtro.trim()
			: '';
	}

	if (isVolveriaCondicionVisible(data.volveria)) {
		payload.volveria_condicion = data.volveriaCondicion.trim();
	}

	return payload;
}
