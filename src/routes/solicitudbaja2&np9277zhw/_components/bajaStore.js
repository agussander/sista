import { persisted } from 'svelte-persisted-store';

export const paso = persisted('paso_form_baja_sista', 0);
export const datosBaja = persisted('datos_form_baja_sista', {
    dni: '',
    motivo: 'seleccionar',
    consentimientoEntrega: false,
    servicio: 'seleccionar',
    dia: 'Día',
    hora: 'Horario',
    cliente: '',
    code: '',
    domicilio: '',
    domicilioOriginal: '',
    devolucion: '',
    numeroTramite: ''
});
