/**
 * Catalogo de secciones navegables del panel de admin: titulo, la clave que
 * usan `selected`/`Content.svelte`, y el path SVG del icono.
 *
 * Unica fuente para el Sidebar y para la grilla de inicio (`Dashboard.svelte`
 * cuando `selected` es null). Antes cada uno tenia su propia lista hardcodeada
 * y quedaron desincronizadas: la grilla de inicio no supo nunca de "Cartera de
 * clientes" y no filtraba por permiso. Con una sola lista, agregar o sacar una
 * seccion la cambia en los dos lugares a la vez.
 */

/** @typedef {{title: string, content: string, icon: string}} SeccionPanel */

/** @type {readonly SeccionPanel[]} */
export const PANEL_SECCIONES = [
	{
		title: 'Precios',
		content: 'precios',
		icon: '<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'
	},
	{
		title: 'Novedades',
		content: 'novedades',
		icon: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M2 10h20"/>'
	},
	{
		title: 'Trabajos',
		content: 'trabajos',
		icon: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'
	},
	{
		title: 'Técnicos',
		content: 'tecnicos',
		icon: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>'
	},
	{
		title: 'Quiero que me llamen',
		content: 'llamenme',
		icon: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>'
	},
	{
		title: 'Cartera de clientes',
		content: 'cartera',
		icon: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'
	}
];
