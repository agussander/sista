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
// =============================================================================

// Adicionales reutilizables. `field` es el campo de la colección `precios`;
// si vale 0 o no existe, la UI cae a "Consultar".
export const ADDON_PACK_FUTBOL = {
	key: 'pack_futbol',
	field: 'pack_futbol',
	label: 'Pack Fútbol',
	detail: 'ESPN Premium · TNT Sports',
	notes: ['No lo necesitas para ver el mundial', 'Solo Liga Profesional, vuelve en agosto']
};
export const ADDON_CINE = {
	key: 'cine',
	field: 'cine',
	label: 'Cine',
	detail: 'Canales HBO y Universal'
};

export const TV_SERVICES = [
	{
		key: 'gigared',
		label: 'Gigared Play',
		priceField: 'gigared',
		logo: '/images/tv/logo-gigared.png',
		warnMagisXuper: true,
		intro:
			'La opción más económica para tener TV en casa. Buena variedad de canales y todos los partidos de Argentina.',
		features: [
			{ type: 'neutral', text: '86 canales' },
			{ type: 'neg', text: 'No tiene El 13 y TN' },
			{ type: 'neg', text: 'No tiene HD' },
			{ type: 'neutral', text: 'Hasta 2 TV' },
			{ type: 'pos', text: 'Todos los partidos de Argentina' }
		],
		grilla: { type: 'image', src: '/images/tv/grilla-gigaplay.png', alt: 'Grilla de canales de Gigared Play' },
		addons: [ADDON_PACK_FUTBOL]
	},
	{
		key: 'antina',
		label: 'Antina Play',
		priceField: 'antina',
		logo: '/images/tv/logo-antina.png',
		warnMagisXuper: true,
		intro:
			'Más canales y algunos en HD, con contenido en vivo y on demand. Todos los partidos de Argentina incluidos.',
		features: [
			{ type: 'neutral', text: '79 canales' },
			{ type: 'neutral', text: 'Algunos canales HD' },
			{ type: 'neutral', text: 'Hasta 2 TV' },
			{ type: 'pos', text: 'Todos los partidos de Argentina' }
		],
		grilla: { type: 'image', src: '/images/tv/grilla antina play.png', alt: 'Grilla de canales de Antina Play' },
		addons: [ADDON_PACK_FUTBOL, ADDON_CINE]
	},
	{
		key: 'dgo',
		label: 'DGO',
		priceField: 'dgo_full',
		logo: '/images/tv/logo-dgo.png',
		warnMagisXuper: false,
		intro:
			'El servicio de streaming de DirecTV: todo en Full HD, hasta 4 TV y el Mundial completo de forma exclusiva.',
		features: [
			{ type: 'neutral', text: '123 canales' },
			{ type: 'neutral', text: 'Full HD' },
			{ type: 'neutral', text: 'Hasta 4 TV' },
			{ type: 'pos', text: 'Mundial completo, todos los partidos (exclusivo)' }
		],
		grilla: { type: 'channelgrid' },
		addons: [ADDON_PACK_FUTBOL]
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
