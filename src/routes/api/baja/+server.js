/**
 * Reemplazo de `static/assets/send-form-baja2.php`.
 *
 * CONTINGENCIA heredada del PHP: la casilla de correo original fue eliminada y
 * el SMTP no autenticaba, asi que la fuente de verdad de las bajas es la
 * coleccion `bajas` de PocketBase y el mail quedo best-effort. Se mantiene ese
 * orden aunque el SMTP hoy funcione: una baja perdida es peor que un mail
 * perdido.
 */
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { createRecord } from '$lib/server/pocketbase.js';
import { renderMailTemplate } from '$lib/server/mailTemplate.js';
import { templateHtml } from '$lib/server/correoTemplate.js';
import { formDataToFields } from '$lib/server/formHandler.js';
import { getMailSender, getRecaptchaVerifier } from '$lib/server/endpointDeps.js';

// Tiene POST: no se puede prerenderizar. El `trailingSlash` explicito no
// neutraliza nada del layout; ver `api/contacto/+server.js` para el detalle.
export const prerender = false;
export const trailingSlash = 'ignore';

/** Todos obligatorios, igual que en el PHP. */
const CAMPOS = ['nombre', 'mail', 'tel', 'motivo'];

/** Tope por campo, para que un paste enorme no infle el registro. */
const MAX_LARGO = 2000;

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, getClientAddress, url }) {
	// Es un POST publico: un body multipart truncado o con un `Content-Type` que
	// no corresponde hace tirar a `formData()`. Sin esto seria un 500 en vez del
	// `{success, message}` que espera el JS del formulario.
	/** @type {FormData} */
	let form;
	try {
		form = await request.formData();
	} catch (error) {
		console.error('[api/baja] body invalido:', error);
		return json({ success: false, message: 'error' });
	}

	const fields = formDataToFields(form);
	const get = (name) => (typeof fields[name] === 'string' ? fields[name].trim() : '');

	// 1. reCAPTCHA (bloqueante).
	const verifyRecaptcha = getRecaptchaVerifier(getClientAddress());
	const captcha = await verifyRecaptcha(get('g-recaptcha-response'));
	if (!captcha.ok) {
		return json({ success: false, message: 'recaptcha', reason: captcha.reason });
	}

	// 2. Todos los campos son obligatorios.
	/** @type {Record<string, string>} */
	const datos = {};
	for (const campo of CAMPOS) {
		const valor = get(campo);
		if (valor === '') {
			return json({ success: false, message: 'incompleto', field: campo });
		}
		datos[campo] = valor.slice(0, MAX_LARGO);
	}

	// 3. PocketBase: fuente de verdad.
	const pbUrl = env.VITE_POCKETBASE_URL || 'https://sista.pockethost.io';
	const record = await createRecord(pbUrl, 'bajas', {
		data: { ...datos, origen: url.host, fecha: new Date().toISOString() }
	});
	if (!record.ok) {
		return json({ success: false, message: 'pb' });
	}

	// 4. Mail best-effort: la baja ya quedo guardada.
	const sendMail = getMailSender();
	const html = renderMailTemplate(templateHtml, {
		title: 'Solicitud de Baja - Web',
		Nombre: datos.nombre,
		Teléfono: datos.tel,
		Email: datos.mail,
		Motivo: datos.motivo
	});
	const mail = await sendMail({ subject: 'Solicitud de Baja - Web', html });
	if (!mail.success) {
		console.error('[api/baja] el mail fallo pero la baja quedo guardada:', mail.error);
	}

	return json({ success: true });
}
