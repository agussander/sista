/** Reemplazo de `static/assets/send-form-empresas.php`. */
import { json } from '@sveltejs/kit';
import { handleFormSubmission, formDataToFields } from '$lib/server/formHandler.js';
import { buildMailDeps } from '$lib/server/endpointDeps.js';

// Tiene POST: no se puede prerenderizar. El `trailingSlash` explicito no
// neutraliza nada del layout; ver `api/contacto/+server.js` para el detalle.
export const prerender = false;
export const trailingSlash = 'ignore';

const CONFIG = {
	subject: 'Empresas - Contacto web',
	fields: {
		nombre: 'Nombre',
		tel: 'Contacto',
		empresa: 'Empresa',
		mensaje: 'Mensaje'
	},
	optional_fields: ['empresa', 'mensaje']
};

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, getClientAddress }) {
	// Es un POST publico: un body multipart truncado o con un `Content-Type` que
	// no corresponde hace tirar a `formData()`. Sin esto seria un 500 en vez del
	// `{success, message}` que espera el JS de los formularios.
	/** @type {FormData} */
	let form;
	try {
		form = await request.formData();
	} catch (error) {
		console.error('[api/empresas] body invalido:', error);
		return json({ success: false, message: 'error' });
	}

	const fields = formDataToFields(form);

	return json(await handleFormSubmission(fields, CONFIG, buildMailDeps(getClientAddress())));
}
