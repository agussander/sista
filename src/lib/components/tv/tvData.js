// =============================================================================
// tvData.js — Contenido estático de la página /tv/elegirtv
//
// Define los 3 servicios de TV (features, grilla, adicionales). Los PRECIOS no
// viven acá: se resuelven en runtime desde la colección `precios` de PocketBase
// usando `priceField` (mismos nombres de campo que el wizard /elegirplan).
//
// Cada feature tiene `type`:
//   'pos'     → ✓ (verde, beneficio destacado)
//   'neg'     → ✗ (carencia)
//   'neutral' → • (dato informativo)
//
// `devices` = límite de reproducciones en simultáneo. Gigared y DGO dan un cupo
// único que se reparte entre cualquier dispositivo (maxMobile: null); Antina
// separa TV de celulares/compus, cada uno con su propio cupo. `label` es el
// texto que se muestra en features, resumen y recomendador (fuente única).
// =============================================================================

import gigaredplayChannels from '$lib/data/gigaredplay-channels.json';
import antinaChannels from '$lib/data/antina-channels.json';
import dgoChannels from '$lib/data/dgo-channels.json';

// Adicionales reutilizables. `field` es el campo de la colección `precios`;
// si vale 0 o no existe, la UI cae a "Consultar".
//
// Pack Fútbol es el mismo addon conceptual en los 3 servicios (mismo `key`,
// para que wizard/URL params lo traten como uno solo), pero cada servicio
// tiene su propio precio en PocketBase: gigared_futbol, antina_futbol,
// dgo_futbol.
function packFutbolAddon(field) {
	return {
		key: 'pack_futbol',
		field,
		label: 'Pack Fútbol',
		detail: 'ESPN Premium · TNT Sports',
		notes: ['Partidos de la Liga Profesional de Fútbol']
	};
}
export const ADDON_CINE = {
	key: 'cine',
	field: 'antina_cine',
	label: 'Cine',
	detail: 'Canales HBO y Universal'
};

export const TV_SERVICES = [
	{
		key: 'gigared',
		label: 'Gigared Play',
		priceField: 'gigared',
		logo: '/images/tv/logo-gigared.png',
		devices: { maxTv: 3, maxMobile: null, label: 'Hasta 3 dispositivos' },
		warnMagisXuper: true,
		intro:
			'La opción más económica para tener TV en casa. Buena variedad de canales.',
		features: [
			{ type: 'neutral', text: '77 canales' },
			{ type: 'neg', text: 'No tiene El 13 y TN' },
			{ type: 'neg', text: 'No tiene HD' },
			{ type: 'neutral', text: 'Hasta 3 dispositivos' }
		],
		grilla: { type: 'channelgrid', channels: gigaredplayChannels, accent: '#b74d8d' },
		addons: [packFutbolAddon('gigared_futbol')]
	},
	{
		key: 'antina',
		label: 'Antina Play',
		priceField: 'antina',
		logo: '/images/tv/logo-antina.png',
		devices: { maxTv: 2, maxMobile: 3, label: 'Hasta 2 TV + 3 celus o compus' },
		warnMagisXuper: true,
		intro:
			'Más canales y algunos en HD, con contenido en vivo y on demand.',
		features: [
			{ type: 'neutral', text: '79 canales' },
			{ type: 'neutral', text: 'Algunos canales HD' },
			{ type: 'neutral', text: 'Hasta 2 TV + 3 celus o compus' }
		],
		grilla: {
			type: 'channelgrid',
			channels: antinaChannels,
			accent: '#52FFB6',
			categoryPrices: { 'Adicional CINE': 'antina_cine' }
		},
		addons: [packFutbolAddon('antina_futbol'), ADDON_CINE]
	},
	{
		key: 'dgo',
		label: 'DGO',
		priceField: 'dgo_full',
		logo: '/images/tv/logo-dgo.png',
		devices: { maxTv: 4, maxMobile: null, label: 'Hasta 4 dispositivos' },
		warnMagisXuper: false,
		intro:
			'El servicio de streaming de DirecTV: todo en Full HD y hasta 4 dispositivos.',
		features: [
			{ type: 'neutral', text: '123 canales' },
			{ type: 'neutral', text: 'Full HD' },
			{ type: 'neutral', text: 'Hasta 4 dispositivos' }
		],
		// Explícita (no depende del default de ChannelGrid): el recomendador
		// necesita la lista para buscar canales.
		grilla: { type: 'channelgrid', channels: dgoChannels },
		addons: [packFutbolAddon('dgo_futbol')]
	}
];

// Servicios incompatibles (aviso en Antina / Gigared). Los logos pueden fallar
// al cargar → fallback a "chip" con el nombre (igual que TvCheckModal).
export const INCOMPATIBLES = [
	{ label: 'Magis', logo: '/images/tv/magis-logo.png' },
	{ label: 'Xuper', logo: '/images/tv/xuper-logo.jpg' }
];

export function serviceByKey(key) {
	return TV_SERVICES.find((s) => s.key === key) || null;
}

// Addon "Pack Fútbol" de un servicio (cada uno tiene su propio campo de
// precio). Usado por la tarjeta para el switch "Con Pack Fútbol".
export function futbolAddonFor(service) {
	return service?.addons?.find((a) => a.key === 'pack_futbol') ?? null;
}
