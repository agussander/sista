// Horario de atención en el que se muestra "Quiero que me llamen":
// lunes a viernes de 9:30 a 16:30, hora de Buenos Aires (GMT-3).
// Se calcula la hora en esa zona horaria sin depender del reloj/zona del
// dispositivo del visitante.
export function isWithinCallHours(now = new Date()) {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: 'America/Argentina/Buenos_Aires',
		weekday: 'short',
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23'
	}).formatToParts(now);

	const get = (type) => parts.find((p) => p.type === type)?.value;

	const isWeekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(get('weekday'));
	const minutes = parseInt(get('hour'), 10) * 60 + parseInt(get('minute'), 10);

	const start = 9 * 60 + 30; // 9:30
	const end = 16 * 60 + 30; // 16:30

	return isWeekday && minutes >= start && minutes <= end;
}

export const OVERRIDE_VALUES = ['auto', 'abierto', 'cerrado'];

// Combina el override manual del admin con el horario automático.
// override: 'auto' | 'abierto' | 'cerrado' (cualquier otro valor => 'auto').
export function computeFormVisible(override, now = new Date()) {
	if (override === 'abierto') return true;
	if (override === 'cerrado') return false;
	return isWithinCallHours(now);
}
