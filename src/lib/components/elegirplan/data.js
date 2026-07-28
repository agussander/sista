// =============================================================================
// data.js — Metadata estática + helpers del wizard "Elegí tu plan"
//
// Concentra la configuración del flujo (planes, TV, adicionales, promo) y los
// helpers puros (formateo, recomendador, total, URL de WhatsApp). No tiene
// estado: el estado vive en wizardState.svelte.js y se pasa como argumento.
//
// Las `key` de los planes coinciden con los nombres de campo de la colección
// `precios` en PocketBase (home, fast, power, gamer, worker, max), así el
// precio se resuelve directo con precios[plan.key].
// =============================================================================

import { serviceByKey } from '$lib/components/tv/tvData.js';
// Fuente única de los planes de Internet: $lib/plans.js (compartida con el
// inicio vía el store priceInfo). Se reexporta para los consumidores del wizard.
import { INTERNET_PLANS } from '$lib/plans.js';

export const WHATSAPP_PHONE = '5492213541906';

// --- Planes de Internet (los 6 actuales) ------------------------------------
export { INTERNET_PLANS };

// --- Adicionales ------------------------------------------------------------
// `tvAddon: true` → se elige dentro del modal de TV (Pack Fútbol, Cine), no en
// el paso de adicionales. Telefonía (tvAddon:false) sí vive en ese paso.
//
// Pack Fútbol no tiene un único campo de precio: cada servicio de TV tiene el
// suyo (gigared_futbol, antina_futbol, dgo_futbol). `fieldFor(w)` resuelve el
// campo correcto según la plataforma ya elegida en el wizard.
export const ADDONS = [
	{
		key: 'pack_futbol',
		field: 'pack_futbol',
		fieldFor: (w) => (w.tvPlatform ? `${w.tvPlatform}_futbol` : null),
		label: 'Pack Fútbol',
		subtitle: 'ESPN Premium · TNT Sports',
		tvAddon: true
	},
	{ key: 'cine',     field: 'antina_cine', label: 'Cine',           subtitle: 'Canales HBO y Universal', tvAddon: true },
	{ key: 'telefono', field: 'telefono',    label: 'Telefonía fija', subtitle: 'Portabilidad numérica',   tvAddon: false }
];

// --- Claves válidas para los params de URL (orden canónico de serialización) ---
export const STEP_KEYS = ['tipo', 'promo', 'internet', 'tv', 'adicionales', 'resumen'];
export const PLAN_KEYS = INTERNET_PLANS.map((p) => p.key);
export const TV_KEYS = ['gigared', 'antina', 'dgo'];
export const ADDON_KEYS = ADDONS.map((a) => a.key); // pack_futbol, cine, telefono

// --- Promo (Paso 2, solo Internet+TV) ---------------------------------------
// Sin colección de promos en PB: se modela acá. Power + GigaredPlay gratis 6 meses.
export const PROMO = { plan: 'power', tvGratis: 'gigared', mesesGratis: 6 };

// --- Servicios incompatibles (aviso en Antina / Gigared) --------------------
// Los logos pueden no existir aún: TvCheckModal cae a un "chip" con el nombre.
export const INCOMPATIBLES = [
	{ label: 'Magis', logo: '/images/tv/magis-logo.png' },
	{ label: 'Xuper', logo: '/images/tv/xuper-logo.jpg' }
];

// --- Recomendador (Paso 3b) -------------------------------------------------
// Multi-select: el usuario puede combinar varios usos.
export const USO_OPTIONS = [
	{ key: 'redes',         label: 'Redes sociales' },
	{ key: 'basico',        label: 'Navegación / básico' },
	{ key: 'streaming',     label: 'Streaming' },
	{ key: 'series',        label: 'Series / pelis' },
	{ key: 'equipos',       label: 'Varios dispositivos' },
	{ key: 'teletrabajo',   label: 'Teletrabajo' },
	{ key: 'videollamadas', label: 'Videollamadas' },
	{ key: 'gaming',        label: 'Videojuegos en línea' },
	{ key: '4k',            label: '4K / UHD' }
];
export const PERSONAS_OPTIONS = [
	{ key: '1-2', label: '1-2' },
	{ key: '3-4', label: '3-4' },
	{ key: '5+',  label: '5+' }
];

// --- Títulos de cada paso ---------------------------------------------------
export const STEP_TITLES = {
	tipo: '¿Qué querés contratar?',
	promo: 'Te conviene la promo',
	internet: 'Elegí tu Internet',
	tv: 'Elegí tu plataforma de TV',
	adicionales: '¿Sumás algo más?',
	resumen: 'Tu combo Sista'
};

// =============================================================================
// Helpers
// =============================================================================

// Separador de miles (mismo patrón que home/Price.svelte)
export function formatNumber(value) {
	if (!value) return '';
	return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// Precio formateado, con fallback "Consultar" para 0 / nulo
export function formatPrice(value) {
	const n = Number(value);
	if (!n || n <= 0) return 'Consultar';
	return '$' + formatNumber(n);
}

// Velocidad en mb ("75mb", "1000mb")
export function speedLabel(mb) {
	return `${mb}mb`;
}

export function planByKey(key) {
	return INTERNET_PLANS.find((p) => p.key === key) || null;
}
// Adaptador: normaliza un servicio de TV_SERVICES a la forma que esperan los
// consumidores legacy (Step2Promo, TvCheckModal de la promo, summaryItems):
// { key, label, logo, field, warnMagisXuper }. Única fuente de TV: TV_SERVICES.
export function tvByKey(key) {
	const s = serviceByKey(key);
	if (!s) return null;
	return {
		key: s.key,
		label: s.label,
		logo: s.logo,
		field: s.priceField,
		warnMagisXuper: s.warnMagisXuper
	};
}

// Recomendador transparente: combinación de usos + personas → varios planes.
// Devuelve [{ key, reason }] ordenado por mejor opción primero (1 a 3 planes).
const USO_PESO = {
	redes: 1,
	basico: 1,
	streaming: 2,
	series: 2,
	equipos: 2,
	teletrabajo: 2,
	videollamadas: 2,
	gaming: 3,
	'4k': 3
};

export function recommendPlans(usos = [], personas) {
	if (!usos.length || !personas) return [];

	const has = (u) => usos.includes(u);
	const ppl = personas === '5+' ? 2 : personas === '3-4' ? 1 : 0;

	// Demanda de bajada → plan "base". Pesa el uso más exigente + personas +
	// un extra si se combinan muchos usos en simultáneo.
	const pesoMax = Math.max(1, ...usos.map((u) => USO_PESO[u] || 1));
	const demand = pesoMax + ppl + (usos.length >= 3 ? 1 : 0);

	let base, baseReason;
	if (demand <= 1) {
		base = 'home';
		baseReason = 'Suficiente para un uso liviano.';
	} else if (demand === 2) {
		base = 'fast';
		baseReason = 'Cómoda para varias actividades a la vez.';
	} else if (demand <= 4) {
		base = 'power';
		baseReason = 'Equilibrio de velocidad y dispositivos.';
	} else {
		base = 'max';
		baseReason = 'Máxima velocidad para un hogar exigente.';
	}

	const recs = [{ key: base, reason: baseReason }];
	const add = (key, reason) => {
		if (!recs.some((r) => r.key === key)) recs.push({ key, reason });
	};

	// Necesidades simétricas / especiales → se ofrecen como alternativas
	if (has('gaming')) add('gamer', 'Tráfico simétrico y baja latencia para jugar.');
	if (has('teletrabajo') || has('videollamadas')) add('worker', 'Simétrico: subís y hacés videollamadas sin cortes.');
	if (has('4k') || demand >= 5) add('max', 'Tope de gama para 4K y varios equipos en simultáneo.');

	return recs.slice(0, 3);
}

// Ítems seleccionados (para resumen y WhatsApp). value=0 → "Consultar".
export function summaryItems(w) {
	const p = w.precios || {};
	const items = [];

	if (w.internetPlan) {
		const plan = planByKey(w.internetPlan);
		if (plan) {
			items.push({
				step: 'internet',
				label: `Internet ${plan.label} ${speedLabel(plan.mb)}`,
				value: Number(p[plan.key]) || 0
			});
		}
	}

	if (w.tvPlatform) {
		const tv = tvByKey(w.tvPlatform);
		if (tv) {
			const free = w.promo && w.tvPlatform === PROMO.tvGratis;
			const listValue = Number(p[tv.field]) || 0;
			items.push({
				step: 'tv',
				label: `TV · ${tv.label}`,
				value: free ? 0 : listValue,
				listValue,
				free
			});
		}
	}

	for (const addon of ADDONS) {
		if (w.addons?.[addon.key]) {
			const field = addon.fieldFor ? addon.fieldFor(w) : addon.field;
			const value = field ? Number(p[field]) || 0 : 0;
			items.push({
				step: addon.tvAddon ? 'tv' : 'adicionales',
				label: addon.label,
				value,
				listValue: value
			});
		}
	}

	return items;
}

// Total mensual (excluye lo "gratis" de la promo)
export function computeTotal(w) {
	return summaryItems(w).reduce((sum, it) => sum + (it.free ? 0 : it.value), 0);
}

// Total a precio de lista (incluye lo "gratis" a su precio sin promo)
export function computeListTotal(w) {
	return summaryItems(w).reduce((sum, it) => sum + (it.listValue ?? it.value), 0);
}

// ¿Algún ítem seleccionado está "a consultar" (precio 0)? → el total es parcial
export function hasConsultar(w) {
	return summaryItems(w).some((it) => !it.free && it.value <= 0);
}

// Secuencia de pasos según el branching (tipo / promo)
// `w.noPromo` (param ?sinpromo=1): oculta el paso de promo en Internet+TV y va
// directo al armado a medida. La promo es solo para clientes/domicilios nuevos.
export function getFlow(w) {
	if (w.tipo === 'internet') return ['tipo', 'internet', 'adicionales', 'resumen'];
	if (w.tipo === 'tv' && w.noPromo) return ['tipo', 'internet', 'tv', 'adicionales', 'resumen'];
	if (w.tipo === 'tv' && w.promo) return ['tipo', 'promo', 'adicionales', 'resumen'];
	if (w.tipo === 'tv') return ['tipo', 'promo', 'internet', 'tv', 'adicionales', 'resumen'];
	// Estimación antes de elegir el tipo (para la barra de progreso)
	return w.noPromo
		? ['tipo', 'internet', 'tv', 'adicionales', 'resumen']
		: ['tipo', 'promo', 'internet', 'tv', 'adicionales', 'resumen'];
}

// URL de WhatsApp con el combo pre-escrito (mismo patrón que ContactButtons)
export function buildWhatsappUrl(w) {
	const lines = ['¡Hola Sista! Armé mi combo y quiero contratarlo:', ''];

	for (const it of summaryItems(w)) {
		const price = it.free ? `gratis ${PROMO.mesesGratis} meses` : formatPrice(it.value);
		lines.push(`• ${it.label}: ${price}`);
	}

	const total = computeTotal(w);
	const listTotal = computeListTotal(w);
	if (w.promo && listTotal > total && total > 0) {
		lines.push('', `Total precio de lista: ${formatPrice(listTotal)}/mes`);
		lines.push(`Total con promo (primeros ${PROMO.mesesGratis} meses): ${formatPrice(total)}/mes`);
	} else {
		lines.push('', `Total mensual: ${total > 0 ? formatPrice(total) : 'Consultar'}`);
	}

	const text = encodeURIComponent(lines.join('\n'));
	return `https://api.whatsapp.com/send?phone=${WHATSAPP_PHONE}&text=${text}`;
}

// Requisito para "pasar" cada paso (estar más allá de él). promo/adicionales/
// resumen no bloquean: la rama ya quedó codificada en tipo/promo.
const STEP_REQUIREMENT = {
	tipo: (w) => !!w.tipo,
	internet: (w) => !!w.internetPlan,
	tv: (w) => !!w.tvPlatform
};

// Devuelve el paso válido más lejano alcanzable: nunca más allá de un requisito
// sin cumplir. Si requestedStep no está en el flow vigente, cae a ese paso más
// lejano alcanzable (nunca descarta selecciones ya completas).
export function clampStep(w, requestedStep) {
	const flow = getFlow(w);
	let furthest = 0;
	for (let i = 0; i < flow.length; i++) {
		furthest = i;
		const req = STEP_REQUIREMENT[flow[i]];
		if (req && !req(w)) break; // se puede estar EN i, no pasar de i
	}
	const reqIdx = flow.indexOf(requestedStep);
	const target = reqIdx < 0 ? furthest : Math.min(reqIdx, furthest);
	return flow[target];
}

// Estado → URLSearchParams canónica. Params omitidos = no seleccionado.
export function buildPlanParams(w) {
	const sp = new URLSearchParams();
	if (w.step) sp.set('paso', w.step);
	if (w.tipo) sp.set('tipo', w.tipo);
	if (w.internetPlan) sp.set('plan', w.internetPlan);
	if (w.tvPlatform) sp.set('tv', w.tvPlatform);
	if (w.promo) sp.set('promo', '1');
	if (w.noPromo) sp.set('sinpromo', '1');
	const adds = ADDON_KEYS.filter((k) => w.addons?.[k]);
	if (adds.length) sp.set('add', adds.join(','));
	return sp;
}

// URLSearchParams → objeto plano validado (sin clamp del paso; eso lo hace
// clampStep una vez que el estado tiene tipo/promo). Valores inválidos → null.
export function parsePlanParams(sp) {
	const oneOf = (val, allowed) => (allowed.includes(val) ? val : null);
	const addRaw = (sp.get('add') || '').split(',').filter(Boolean);
	return {
		step: oneOf(sp.get('paso'), STEP_KEYS) || 'tipo',
		tipo: oneOf(sp.get('tipo'), ['internet', 'tv']),
		internetPlan: oneOf(sp.get('plan'), PLAN_KEYS),
		tvPlatform: oneOf(sp.get('tv'), TV_KEYS),
		promo: sp.get('promo') === '1',
		noPromo: sp.get('sinpromo') === '1',
		addons: {
			pack_futbol: addRaw.includes('pack_futbol'),
			cine: addRaw.includes('cine'),
			telefono: addRaw.includes('telefono')
		}
	};
}
