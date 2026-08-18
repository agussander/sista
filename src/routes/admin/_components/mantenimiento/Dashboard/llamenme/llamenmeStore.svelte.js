// Store con runes para el panel "Quiero que me llamen".
// Fuente única de verdad: vive a nivel admin (lo arranca el Dashboard) para que
// el sonido y el puntito funcionen estés en la sección que estés.
import { pb } from '$lib/pocketbase';
import { applyCreate, applyUpdate, applyDelete } from './llamenmeLogic.js';
import { fetchOverride, saveOverride } from '$lib/llamenme/config.js';

const COLLECTION = 'quiero_que_me_llamen';
const HIGHLIGHT_MS = 3000;

// Estado reactivo del módulo.
let leads = $state([]);
let unread = $state(0);
let newIds = $state(new Set());
let loading = $state(true);
let error = $state('');
let override = $state('auto');

let started = false;
let unsubscribe = null;

// --- Audio del gallo -------------------------------------------------------
let audio = null;
let primed = false;

function getAudio() {
	if (!audio && typeof Audio !== 'undefined') {
		audio = new Audio('/assets/gallo-sfx.mp3');
	}
	return audio;
}

/**
 * Habilita el autoplay reproduciendo el audio en silencio una vez, tras una
 * interacción del usuario. Los navegadores bloquean play() sin gesto previo.
 */
export function primeAudio() {
	if (primed) return;
	const a = getAudio();
	if (!a) return;
	primed = true;
	const prevVolume = a.volume;
	a.volume = 0;
	a.play()
		.then(() => {
			a.pause();
			a.currentTime = 0;
			a.volume = prevVolume;
		})
		.catch(() => {
			a.volume = prevVolume;
		});
}

function playGallo() {
	const a = getAudio();
	if (!a) return;
	a.currentTime = 0;
	a.play().catch(() => {});
}

// --- Highlight de recién llegados -----------------------------------------
function markNew(id) {
	newIds = new Set(newIds).add(id);
	setTimeout(() => {
		const next = new Set(newIds);
		next.delete(id);
		newIds = next;
	}, HIGHLIGHT_MS);
}

// --- Carga y realtime ------------------------------------------------------
async function load() {
	loading = true;
	error = '';
	try {
		const res = await pb.collection(COLLECTION).getList(1, 200, { sort: '-created' });
		leads = res.items;
	} catch (e) {
		console.error(e);
		error = 'No se pudieron cargar los datos.';
	} finally {
		loading = false;
	}
}

async function start() {
	if (started) return;
	started = true;
	await load();
	try {
		unsubscribe = await pb.collection(COLLECTION).subscribe('*', (e) => {
			if (e.action === 'create') {
				const before = leads.length;
				leads = applyCreate(leads, e.record);
				if (leads.length !== before) {
					unread += 1;
					markNew(e.record.id);
					playGallo();
				}
			} else if (e.action === 'update') {
				leads = applyUpdate(leads, e.record);
			} else if (e.action === 'delete') {
				leads = applyDelete(leads, e.record.id);
			}
		});
	} catch (e) {
		// Un fallo de SSE no debe romper el admin: queda la carga manual.
		console.error('Realtime llamenme no disponible:', e);
	}
}

function stop() {
	if (unsubscribe) {
		try {
			unsubscribe();
		} catch (e) {
			console.error(e);
		}
		unsubscribe = null;
	}
	started = false;
}

function markRead() {
	unread = 0;
}

async function loadOverride() {
	override = await fetchOverride(pb);
}

// Asignación optimista del override, con rollback ante error (mismo patrón que assign).
// El switch es un único valor global (a diferencia de assign, que corrige una fila
// puntual), así que sólo revertimos si nadie cambió el valor mientras esta llamada
// estaba en curso: evita que un fallo tardío pise una selección más nueva ya exitosa.
async function setOverride(value) {
	const prev = override;
	override = value;
	try {
		await saveOverride(pb, value);
	} catch (e) {
		console.error(e);
		if (override === value) override = prev;
		error = 'No se pudo guardar el estado del formulario.';
		setTimeout(() => (error = ''), 3000);
	}
}

// Tilde de "atendido" optimista, con rollback ante error.
async function setAtendido(lead, value) {
	const atendido = !!value;
	const prev = lead.atendido;
	leads = applyUpdate(leads, { ...lead, atendido });
	try {
		await pb.collection(COLLECTION).update(lead.id, { atendido });
	} catch (e) {
		console.error(e);
		leads = applyUpdate(leads, { ...lead, atendido: prev });
		error = 'No se pudo guardar el estado del lead.';
		setTimeout(() => (error = ''), 3000);
	}
}

// Anotaciones del lead, guardado optimista con rollback ante error.
async function setNotas(lead, value) {
	const notas = value ?? '';
	const prev = lead.notas;
	if (notas === (prev ?? '')) return;
	leads = applyUpdate(leads, { ...lead, notas });
	try {
		await pb.collection(COLLECTION).update(lead.id, { notas });
	} catch (e) {
		console.error(e);
		leads = applyUpdate(leads, { ...lead, notas: prev });
		error = 'No se pudieron guardar las anotaciones.';
		setTimeout(() => (error = ''), 3000);
	}
}

// Se exporta como objeto con getters para conservar la reactividad de runes
// al consumirlo desde los componentes.
export const llamenmeStore = {
	get leads() {
		return leads;
	},
	get unread() {
		return unread;
	},
	get newIds() {
		return newIds;
	},
	get loading() {
		return loading;
	},
	get error() {
		return error;
	},
	get override() {
		return override;
	},
	start,
	stop,
	load,
	markRead,
	setAtendido,
	setNotas,
	loadOverride,
	setOverride
};
