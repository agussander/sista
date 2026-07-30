/** Reemplazo de `static/assets/send-form-contacto.php`. */
import { json } from '@sveltejs/kit';
import { handleFormSubmission } from '$lib/server/formHandler.js';
import { buildMailDeps } from '$lib/server/endpointDeps.js';

// Tiene POST: no se puede prerenderizar.
//
// `trailingSlash: 'ignore'` es explicito para que el POST se atienda igual con
// y sin barra final. NO esta para neutralizar el `trailingSlash = 'always'` de
// `src/routes/+layout.js`: verificado empiricamente que ese valor aplica a las
// paginas bajo el layout y no cascadea a los `+server.js` -sacando esta linea,
// un POST a `/api/contacto` responde 200 igual, no 308-.
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
