// =============================================================================
// wizardState.svelte.js — Estado reactivo (runes) compartido entre los pasos
//
// Singleton: todos los componentes importan el mismo objeto `wizard` (proxy
// reactivo de Svelte 5). Mutar sus propiedades (wizard.step = 'tv') propaga la
// reactividad a cualquier componente que lo lea. La navegación se calcula sobre
// getFlow(wizard) para respetar el branching (Solo Internet / +TV / promo).
// =============================================================================

import { getFlow, PROMO, clampStep, buildPlanParams, parsePlanParams } from './data.js';

export const wizard = $state({
	// flujo
	step: 'tipo', // clave del paso actual: tipo|promo|internet|tv|adicionales|resumen

	// selección
	tipo: null, // 'internet' | 'tv'
	internetPlan: null, // 'home'|'fast'|'power'|'gamer'|'worker'|'max'
	tvPlatform: null, // 'dgo'|'antina'|'gigared'
	addons: { pack_futbol: false, cine: false, telefono: false },
	promo: false,
	noPromo: false, // ?sinpromo=1: oculta la promo (solo nuevos clientes) → arma a medida
	recom: { usos: [], personas: null }, // usos: multi-select

	// datos / carga
	precios: {},
	sinImpuestos: {},
	loading: true,
	error: false,

	// overlays
	showRecom: false // recomendador (paso 3b)
});

// --- Navegación -------------------------------------------------------------

export function goTo(stepKey) {
	wizard.step = stepKey;
}

export function next() {
	const flow = getFlow(wizard);
	const i = flow.indexOf(wizard.step);
	if (i >= 0 && i < flow.length - 1) wizard.step = flow[i + 1];
}

export function prev() {
	const flow = getFlow(wizard);
	const i = flow.indexOf(wizard.step);
	if (i > 0) wizard.step = flow[i - 1];
}

// ¿El paso actual es el primero del flujo? (para mostrar/ocultar "volver")
export function isFirstStep() {
	return getFlow(wizard).indexOf(wizard.step) <= 0;
}

// --- Acciones de selección --------------------------------------------------

export function setTipo(tipo) {
	wizard.tipo = tipo;
	if (tipo === 'internet') {
		// Solo Internet: sin TV, sin promo, sin Pack Fútbol
		wizard.promo = false;
		wizard.tvPlatform = null;
		wizard.addons.pack_futbol = false;
	}
}

// Paso 2 — "Armar a medida": continúa al armado libre
export function chooseArmar() {
	wizard.promo = false;
	wizard.tvPlatform = null; // la TV se elige en el paso 4
	next(); // → 'internet'
}

// Paso 2 — confirmó la promo desde el modal completo de Gigared (TvServiceModal,
// con su chequeo de instalación embebido): aplica Power + GigaredPlay gratis,
// sincroniza los addons elegidos en el modal y avanza a adicionales.
export function confirmPromo(chosenAddonKeys = []) {
	wizard.promo = true;
	wizard.internetPlan = PROMO.plan; // 'power'
	wizard.tvPlatform = PROMO.tvGratis; // 'gigared'
	wizard.addons.pack_futbol = chosenAddonKeys.includes('pack_futbol');
	wizard.addons.cine = chosenAddonKeys.includes('cine');
	goTo('adicionales');
}

export function setInternetPlan(key) {
	wizard.internetPlan = key;
}

// Commit de la TV desde el modal del paso de TV (Step4TV): fija la plataforma,
// sincroniza los TV-addons elegidos (Pack Fútbol / Cine) — limpiando los que el
// servicio no ofrece, porque chosenAddonKeys solo trae los tildados — y avanza.
export function chooseTvService(serviceKey, chosenAddonKeys = []) {
	wizard.tvPlatform = serviceKey;
	wizard.addons.pack_futbol = chosenAddonKeys.includes('pack_futbol');
	wizard.addons.cine = chosenAddonKeys.includes('cine');
	next();
}

export function toggleAddon(key) {
	wizard.addons[key] = !wizard.addons[key];
}

// Recomendador (3b)
export function openRecom() {
	wizard.showRecom = true;
}
export function closeRecom() {
	wizard.showRecom = false;
}
// Toggle de un uso en la selección múltiple del recomendador
export function toggleUso(key) {
	const arr = wizard.recom.usos;
	const i = arr.indexOf(key);
	if (i >= 0) arr.splice(i, 1);
	else arr.push(key);
}

export function resetWizard() {
	wizard.step = 'tipo';
	wizard.tipo = null;
	wizard.internetPlan = null;
	wizard.tvPlatform = null;
	wizard.addons.pack_futbol = false;
	wizard.addons.cine = false;
	wizard.addons.telefono = false;
	wizard.promo = false;
	wizard.recom.usos = [];
	wizard.recom.personas = null;
	wizard.showRecom = false;
	// `precios` y `loading` se conservan (ya cargados desde PB)
}

// --- Sincronización con la URL --------------------------------------------

// Query string canónica del estado actual (para el guard del loop y para goto).
export function toSearchString() {
	return buildPlanParams({
		step: wizard.step,
		tipo: wizard.tipo,
		internetPlan: wizard.internetPlan,
		tvPlatform: wizard.tvPlatform,
		promo: wizard.promo,
		noPromo: wizard.noPromo,
		addons: wizard.addons
	}).toString();
}

// Hidrata el estado desde los params de la URL. Aplica las selecciones válidas
// y clampea el paso al más lejano permitido. Resetea overlays transitorios
// (reemplaza a resetWizard en el mount). `precios`/`loading` se conservan.
export function hydrateFromParams(searchParams) {
	const p = parsePlanParams(searchParams);
	wizard.tipo = p.tipo;
	wizard.internetPlan = p.internetPlan;
	wizard.tvPlatform = p.tvPlatform;
	wizard.noPromo = p.noPromo;
	// Con ?sinpromo=1 la promo no existe como opción: forzamos promo=false aunque
	// venga en la URL (link viejo o manipulado).
	wizard.promo = p.noPromo ? false : p.promo;
	wizard.addons.pack_futbol = p.addons.pack_futbol;
	wizard.addons.cine = p.addons.cine;
	wizard.addons.telefono = p.addons.telefono;
	// overlays efímeros (no viven en la URL)
	wizard.showRecom = false;
	wizard.recom.usos = [];
	wizard.recom.personas = null;
	// el paso, clampeado contra el estado ya aplicado
	wizard.step = clampStep(wizard, p.step);
}
