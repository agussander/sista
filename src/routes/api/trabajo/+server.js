/**
 * Reemplazo de `static/assets/form-trabajo.php`.
 *
 * Es el unico formulario que NO usa `fetch`: es un `<form action>` nativo. Por
 * eso responde con un redirect 303 en vez de JSON — el navegador navega solo a
 * `/gracias/` o `/error-form/`.
 *
 * Va como `+server.js` y no como form action de SvelteKit a proposito: un
 * `+page.server.js` con `actions` haria no-prerenderizable a
 * `/trabajaconnosotros2/`, y esa pagina desapareceria del build estatico que se
 * sube a produccion.
 */
import { redirect } from '@sveltejs/kit';
import { handleFormSubmission, formDataToFields } from '$lib/server/formHandler.js';
import { buildMailDeps } from '$lib/server/endpointDeps.js';

// Tiene POST: no se puede prerenderizar. El `trailingSlash` explicito no
// neutraliza nada del layout; ver `api/contacto/+server.js` para el detalle.
export const prerender = false;
export const trailingSlash = 'ignore';

/** Limite de adjunto que anuncia el formulario ("no supere los 5mb"). */
const MAX_CV_BYTES = 5 * 1024 * 1024;

const RECIPIENT = 'agustinsander@gmail.com';

/** Mismo mapa de campos que el `$config['fields']` del PHP. */
const FIELDS = {
	nombre: 'Nombre',
	apellido: 'Apellido',
	dni: 'DNI',
	nacimiento: 'Fecha de Nacimiento',
	telefono: 'Teléfono',
	mail: 'Email',
	puesto: 'Puesto',
	secundario: 'Secundario',
	formacion: 'Formación Adicional',
	experiencia: 'Experiencia Laboral'
};

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, getClientAddress }) {
	/** @type {FormData} */
	let form;
	try {
		form = await request.formData();
	} catch (error) {
		console.error('[api/trabajo] body invalido:', error);
		redirect(303, '/error-form/');
	}

	const fields = formDataToFields(form);

	/** @type {Array<{filename: string, content: Buffer, contentType?: string}>} */
	const attachments = [];
	const cv = form.get('curriculum');
	if (cv && typeof cv !== 'string' && cv.size > 0) {
		if (cv.size > MAX_CV_BYTES) {
			console.error(`[api/trabajo] CV rechazado por tamano: ${cv.size} bytes`);
			redirect(303, '/error-form/');
		}
		attachments.push({
			filename: cv.name,
			content: Buffer.from(await cv.arrayBuffer()),
			contentType: cv.type || 'application/octet-stream'
		});
	}

	const config = {
		subject: `Nueva postulación - ${fields.apellido ?? ''}`,
		fields: FIELDS,
		attachments,
		custom_recipient: RECIPIENT,
		reply_to: fields.mail || undefined
	};

	const result = await handleFormSubmission(fields, config, buildMailDeps(getClientAddress()));

	if (!result.success) {
		console.error('[api/trabajo] postulacion rechazada:', result.message, result.field ?? '');
		redirect(303, '/error-form/');
	}
	redirect(303, '/gracias/');
}
