// Acceso a la colección genérica "config" de PocketBase.
// Cada registro es { key, values } — este módulo maneja el registro
// key="llamenme", cuyo values.state guarda el override del formulario
// "Quiero que me llamen": 'auto' | 'abierto' | 'cerrado' | 'oculto'.
import { OVERRIDE_VALUES } from './visibility.js';

const COLLECTION = 'config';
const KEY = 'llamenme';
const DEFAULT_STATE = 'auto';

function normalize(state) {
	return OVERRIDE_VALUES.includes(state) ? state : DEFAULT_STATE;
}

// Devuelve el override guardado. Fail-open: ante cualquier error (colección
// sin crear, red caída, registro inexistente) devuelve 'auto' para que la web
// caiga al horario automático en vez de romperse.
export async function fetchOverride(pb) {
	try {
		const record = await pb.collection(COLLECTION).getFirstListItem(`key="${KEY}"`);
		return normalize(record.values?.state);
	} catch (e) {
		console.error('No se pudo leer la config de llamenme:', e);
		return DEFAULT_STATE;
	}
}

// Actualiza values.state del registro "llamenme", preservando el resto de
// las claves de values. A diferencia de fetchOverride, no atrapa errores: el
// llamador (admin) los necesita para poder hacer rollback.
export async function saveOverride(pb, state) {
	const record = await pb.collection(COLLECTION).getFirstListItem(`key="${KEY}"`);
	const updated = await pb.collection(COLLECTION).update(record.id, {
		values: { ...record.values, state }
	});
	return updated.values.state;
}
