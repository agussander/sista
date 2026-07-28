// Lógica pura (sin dependencias de Svelte/PocketBase) de la encuesta de baja.
// Se mantiene aparte del componente para poder testearla con Vitest.

export const MOTIVO_PAGO = 'No pude pagar por dificultades económicas';
export const MOTIVO_PROVEEDOR = 'Contraté otro proveedor';
export const MOTIVO_OTRO = 'Otro';
const MEDIO_OTRO = 'otro';
const CONTACTO_NO_OTRO = 'otro';
const PROVEEDOR_OTRO = 'Otro';

export const MOTIVO_OPTIONS = [
	MOTIVO_PAGO,
	'Me pareció que el precio no era acorde al servicio',
	'Tuve problemas técnicos/de conexión sin resolver',
	MOTIVO_PROVEEDOR,
	'Ya no necesito el servicio (mudanza, etc.)',
	MOTIVO_OTRO
];

export const PAGO_MEDIO_OPTIONS = ['Efectivo', 'Transferencia', 'Débito automático', MEDIO_OTRO];

export const PROVEEDOR_OFERTA_OPTIONS = [
	'Mejor precio',
	'Mejor servicio de internet',
	'Mejor servicio de TV',
	PROVEEDOR_OTRO
];

export const SI_NO_OPTIONS = ['Sí', 'No'];

export const CONTACTO_NO_MOTIVO_OPTIONS = [
	'No sabía que se podía',
	'No tenía tiempo',
	'No creí que hubiera solución',
	CONTACTO_NO_OTRO
];

export const CONFORMIDAD_OPTIONS = Array.from({ length: 10 }, (_, i) => String(i + 1));

export const VOLVERIA_OPTIONS = ['Sí', 'Tal vez', 'No'];

export function createEmptyData() {
	return {
		motivo: '',
		motivoOtro: '',
		proveedorOferta: '',
		proveedorOfertaOtro: '',
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
	};
}

export function isMotivoPago(motivo) {
	return motivo === MOTIVO_PAGO;
}

export function isMotivoOtro(motivo) {
	return motivo === MOTIVO_OTRO;
}

export function isMotivoProveedor(motivo) {
	return motivo === MOTIVO_PROVEEDOR;
}

export function isProveedorOfertaOtro(proveedorOferta) {
	return proveedorOferta === PROVEEDOR_OTRO;
}

export function isPagoMedioOtro(pagoMedio) {
	return pagoMedio === MEDIO_OTRO;
}

export function isContactoNo(contactoPrevio) {
	return contactoPrevio === 'No';
}

export function isContactoNoMotivoOtro(contactoNoMotivo) {
	return contactoNoMotivo === CONTACTO_NO_OTRO;
}

export function isVolveriaCondicionVisible(volveria) {
	return volveria === 'Sí' || volveria === 'Tal vez';
}

export function canSubmit(data) {
	if (!data.motivo) return false;
	if (isMotivoOtro(data.motivo) && !data.motivoOtro.trim()) return false;

	if (isMotivoPago(data.motivo)) {
		if (!data.pagoMedio) return false;
		if (isPagoMedioOtro(data.pagoMedio) && !data.pagoMedioOtro.trim()) return false;
		if (!SI_NO_OPTIONS.includes(data.pagoInconvenientes)) return false;
	}

	if (isMotivoProveedor(data.motivo) && !data.proveedorOferta) return false;

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
		proveedor_oferta: '',
		proveedor_oferta_otro: '',
		pago_medio: '',
		pago_medio_otro: '',
		pago_inconvenientes: null,
		pago_inconvenientes_comentario: '',
		contacto_previo: data.contactoPrevio === 'Sí',
		contacto_no_motivo: '',
		contacto_no_otro: '',
		conformidad: Number(data.conformidad),
		que_diferente: data.queDiferente.trim(),
		volveria: data.volveria,
		volveria_condicion: '',
		comentarios: data.comentarios.trim(),
		id_nombre: data.idNombre.trim(),
		id_telefono: data.idTelefono.trim(),
	};

	if (isMotivoPago(data.motivo)) {
		payload.pago_medio = data.pagoMedio;
		payload.pago_medio_otro = isPagoMedioOtro(data.pagoMedio) ? data.pagoMedioOtro.trim() : '';
		payload.pago_inconvenientes = data.pagoInconvenientes === 'Sí';
		payload.pago_inconvenientes_comentario = data.pagoInconvenientesComentario.trim();
	}

	if (isMotivoProveedor(data.motivo)) {
		payload.proveedor_oferta = data.proveedorOferta;
		payload.proveedor_oferta_otro = isProveedorOfertaOtro(data.proveedorOferta)
			? data.proveedorOfertaOtro.trim()
			: '';
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
