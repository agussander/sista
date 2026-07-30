/** Reemplazo de `static/assets/send-form-empresas.php`. */
import { json } from '@sveltejs/kit';
import { handleFormSubmission, formDataToFields } from '$lib/server/formHandler.js';
import { buildMailDeps } from '$lib/server/endpointDeps.js';

// Tiene POST: no se puede prerenderizar.
//
// `trailingSlash: 'ignore'` es explicito para que el POST se atienda igual con
// y sin barra final. NO esta para neutralizar el `trailingSlash = 'always'` de
// `src/routes/+layout.js`: verificado empiricamente que ese valor aplica a las
// paginas bajo el layout y no cascadea a los `+server.js` -sacando esta linea,
// un POST a `/api/empresas` responde 200 igual, no 308-.
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
