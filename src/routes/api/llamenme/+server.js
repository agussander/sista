/**
 * Reemplazo de `static/assets/send-llamenme.php`.
 *
 * Orden deliberado (igual que el PHP): honeypot -> reCAPTCHA -> validacion ->
 * PocketBase -> mail. PocketBase es la FUENTE DE VERDAD del lead: si falla,
 * responde `pb` y el visitante reintenta. El mail es best-effort: si falla, el
 * lead ya quedo guardado y se responde exito igual.
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

/** Destinatario del aviso. Igual que el `setTo` del PHP. */
const RECIPIENT = 'agustin@sista.ar';

/** Preferencia de horario del modal. Cualquier otra cosa se guarda vacia. */
const ALLOWED_EXTRA = ['en_horario', 'manana', 'tarde', 'whatsapp', 'sin_preferencia'];

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, getClientAddress }) {
	// Es un POST publico: un body multipart truncado o con un `Content-Type` que
	// no corresponde hace tirar a `formData()`. Sin esto seria un 500 en vez del
	// `{success, message}` que espera el JS del formulario.
	/** @type {FormData} */
	let form;
	try {
		form = await request.formData();
	} catch (error) {
		console.error('[api/llamenme] body invalido:', error);
		return json({ success: false, message: 'error' });
	}

	const fields = formDataToFields(form);
	const get = (name) => (typeof fields[name] === 'string' ? fields[name].trim() : '');

	// 1. Honeypot: si vino lleno, es bot.
	if (get('website') !== '') {
		return json({ success: false, message: 'spam' });
	}

	// 2. reCAPTCHA.
	const verifyRecaptcha = getRecaptchaVerifier(getClientAddress());
	const captcha = await verifyRecaptcha(get('g-recaptcha-response'));
	if (!captcha.ok) {
		return json({ success: false, message: 'recaptcha', reason: captcha.reason });
	}

	// 3. Validacion.
	const numero = get('numero').slice(0, 40);
	if (numero === '') {
		return json({ success: false, message: 'incompleto', field: 'numero' });
	}
	const rawExtra = get('extra');
	const extra = ALLOWED_EXTRA.includes(rawExtra) ? rawExtra : '';

	// 4. PocketBase: fuente de verdad.
	const pbUrl = env.VITE_POCKETBASE_URL || 'https://sista.pockethost.io';
	const record = await createRecord(pbUrl, 'quiero_que_me_llamen', { numero, extra });
	if (!record.ok) {
		return json({ success: false, message: 'pb' });
	}

	// 5. Mail best-effort: el lead ya esta guardado.
	const sendMail = getMailSender();
	const html = renderMailTemplate(templateHtml, {
		title: 'Quiero que me llamen',
		Numero: numero,
		Preferencia: extra !== '' ? extra : '—'
	});
	const mail = await sendMail({
		subject: 'Quiero que me llamen',
		html,
		to: RECIPIENT
	});
	if (!mail.success) {
		console.error('[llamenme] el mail fallo pero el lead quedo guardado:', mail.error);
	}

	return json({ success: true });
}
