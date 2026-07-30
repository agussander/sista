/**
 * URLs de los formularios, resueltas segun el target de build.
 *
 * El repo produce dos artefactos desde el mismo codigo (ver
 * `docs/superpowers/specs/2026-07-28-migracion-adapter-node-hostinger-design.md`):
 * el estatico que se sube por FTP a sista.com.ar, donde los formularios los
 * atiende Apache+PHP, y la app Node, donde los atiende SvelteKit.
 *
 * Si los call sites apuntaran directo a `/api/...`, el build estatico quedaria
 * llamando rutas que en sista.com.ar no existen: se perderian TODOS los
 * formularios de produccion y con ellos el rollback de la migracion.
 */

/** Handlers PHP en `static/assets/`. Los usa el build estatico. */
export const PHP_ENDPOINTS = Object.freeze({
	LLAMENME: '/assets/send-llamenme.php',
	CONTACTO: '/assets/send-form-contacto.php',
	EMPRESAS: '/assets/send-form-empresas.php',
	MODAL: '/assets/send-form-modal.php',
	BAJA: '/assets/send-form-baja2.php',
	TICKET_ISPCUBE: '/assets/send-ticket-ispcube.php',
	EMAIL_BAJA: '/assets/send-email-baja.php',
	TRABAJO: '/assets/form-trabajo.php'
});

/** Endpoints de SvelteKit. Los usa el build Node. */
export const NODE_ENDPOINTS = Object.freeze({
	LLAMENME: '/api/llamenme',
	CONTACTO: '/api/contacto',
	EMPRESAS: '/api/empresas',
	MODAL: '/api/modal',
	BAJA: '/api/baja',
	TICKET_ISPCUBE: '/api/ticket-ispcube',
	EMAIL_BAJA: '/api/email-baja',
	TRABAJO: '/api/trabajo'
});

/**
 * @param {string | undefined} backend Valor de `VITE_FORMS_BACKEND`
 * @returns {typeof PHP_ENDPOINTS}
 */
export function resolveFormEndpoints(backend) {
	return backend === 'node' ? NODE_ENDPOINTS : PHP_ENDPOINTS;
}

/** Mapa ya resuelto para el build actual. Es lo que importan los componentes. */
export const FORM_ENDPOINTS = resolveFormEndpoints(import.meta.env.VITE_FORMS_BACKEND);
