/** Reemplazo de `static/assets/send-form-contacto.php`. */
import { json } from '@sveltejs/kit';
import { handleFormSubmission } from '$lib/server/formHandler.js';
import { buildMailDeps } from '$lib/server/endpointDeps.js';

// Tiene POST: no se puede prerenderizar. `trailingSlash: 'ignore'` evita que
// herede el `'always'` del layout raiz y responda 308 en vez de procesar.
export const prerender = false;
export const trailingSlash = 'ignore';

const CONFIG = {
	subject: 'Contacto Web',
	fields: {
		nombre: 'Nombre',
		tel: 'Contacto',
		mensaje: 'Mensaje'
	}
};

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, getClientAddress }) {
	const form = await request.formData();
	/** @type {Record<string, string>} */
	const fields = {};
	for (const [key, value] of form.entries()) {
		if (typeof value === 'string') fields[key] = value;
	}

	return json(await handleFormSubmission(fields, CONFIG, buildMailDeps(getClientAddress())));
}
