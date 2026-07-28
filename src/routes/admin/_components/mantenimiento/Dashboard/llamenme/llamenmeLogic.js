// Lógica pura (sin runes ni efectos) del panel "Quiero que me llamen".
// Se mantiene aparte del store para poder testearla con Vitest.

const PER_PAGE = 10;

/**
 * Inserta un registro recién creado al principio de la lista.
 * Idempotente: si el id ya existe, devuelve la lista sin cambios.
 */
export function applyCreate(leads, record) {
	if (!record || leads.some((l) => l.id === record.id)) return leads;
	return [record, ...leads];
}

/** Reemplaza en la lista la fila con el mismo id (si existe). */
export function applyUpdate(leads, record) {
	if (!record) return leads;
	let found = false;
	const next = leads.map((l) => {
		if (l.id === record.id) {
			found = true;
			return record;
		}
		return l;
	});
	return found ? next : leads;
}

/** Quita de la lista la fila con el id dado. */
export function applyDelete(leads, id) {
	return leads.filter((l) => l.id !== id);
}

// Etiquetas legibles para el campo `extra` de PocketBase (la preferencia de
// contacto que elige el visitante). Las claves son los valores de la allowlist
// de static/assets/send-llamenme.php.
const EXTRA_LABELS = {
	en_horario: 'En el momento',
	manana: 'Mañana (9 a 13)',
	tarde: 'Tarde (13 a 17)',
	whatsapp: 'WhatsApp',
	sin_preferencia: 'Sin preferencia'
};

/**
 * Traduce la preferencia guardada a texto para la tabla. Los leads viejos (y
 * los que se cierran sin elegir) no tienen valor: se muestran con un guion.
 * Un valor desconocido se muestra crudo en vez de ocultarse.
 */
export function formatExtra(extra) {
	if (!extra) return '—';
	return EXTRA_LABELS[extra] ?? extra;
}

/** Cantidad total de páginas (mínimo 1). */
export function totalPages(count, perPage = PER_PAGE) {
	return Math.max(1, Math.ceil(count / perPage));
}

/** Acota un número de página al rango [1, totalPages]. */
export function clampPage(page, count, perPage = PER_PAGE) {
	const max = totalPages(count, perPage);
	if (page < 1) return 1;
	if (page > max) return max;
	return page;
}

/** Devuelve el slice de la página pedida. */
export function paginate(leads, page, perPage = PER_PAGE) {
	const p = clampPage(page, leads.length, perPage);
	const start = (p - 1) * perPage;
	return leads.slice(start, start + perPage);
}

export { PER_PAGE, EXTRA_LABELS };
