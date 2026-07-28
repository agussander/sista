// Horario de atención de "Quiero que me llamen": lunes a viernes de 9:00 a
// 16:40, hora de Buenos Aires (GMT-3). El formulario ahora se muestra siempre;
// este horario decide si, al enviar, se avisa directo en la tarjeta (dentro de
// horario) o se abre el modal de preferencia de contacto (fuera de horario).
// Se calcula la hora en esa zona horaria sin depender del reloj/zona del
// dispositivo del visitante.

const CALL_START = 9 * 60; // 9:00
const CALL_END = 16 * 60 + 40; // 16:40

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

// Devuelve { weekday, minutes } del instante `now` en horario de Buenos Aires.
function buenosAiresParts(now) {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: 'America/Argentina/Buenos_Aires',
		weekday: 'short',
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23'
	}).formatToParts(now);

	const get = (type) => parts.find((p) => p.type === type)?.value;

	return {
		weekday: get('weekday'),
		minutes: parseInt(get('hour'), 10) * 60 + parseInt(get('minute'), 10)
	};
}

export function isWithinCallHours(now = new Date()) {
	const { weekday, minutes } = buenosAiresParts(now);
	const isWeekday = WEEKDAYS.includes(weekday);
	return isWeekday && minutes >= CALL_START && minutes <= CALL_END;
}

// Encabezado del modal (fuera de horario), según el día/hora en ART:
//   - día de semana antes de abrir  → "Te llamamos hoy"
//   - viernes (ya cerrado) o sábado → "Te llamamos el lunes"
//   - resto (lun-jue cerrado, dom)  → "Te llamamos mañana"
export function computeCallHeading(now = new Date()) {
	const { weekday, minutes } = buenosAiresParts(now);
	if (WEEKDAYS.includes(weekday) && minutes < CALL_START) return 'Te llamamos hoy';
	if (weekday === 'Fri' || weekday === 'Sat') return 'Te llamamos el lunes';
	return 'Te llamamos mañana';
}

// Aclaración de la opción de WhatsApp del modal, según el día en ART.
export function computeWhatsappSublabel(now = new Date()) {
	const { weekday } = buenosAiresParts(now);
	if (weekday === 'Sat') return 'En línea hasta las 19:00';
	if (weekday === 'Sun') return 'Guardia técnica';
	return 'En línea hasta las 22:00';
}

export const OVERRIDE_VALUES = ['auto', 'abierto', 'cerrado'];

// Combina el override manual del admin con el horario automático para decidir
// si estamos "en ventana de llamado" (aviso directo) o no (modal de preferencia).
// override: 'auto' | 'abierto' | 'cerrado' (cualquier otro valor => 'auto').
export function computeInCallWindow(override, now = new Date()) {
	if (override === 'abierto') return true;
	if (override === 'cerrado') return false;
	return isWithinCallHours(now);
}
