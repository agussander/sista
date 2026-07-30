/**
 * Orquestador de los formularios que solo mandan mail. Puerto de
 * `handle_form_submission()` en `static/assets/includes/form-handler.php`.
 *
 * Orden: reCAPTCHA -> validacion de campos -> mail. El contrato de salida es el
 * mismo que devolvia el PHP (`{success, message}` con `message` en
 * recaptcha / incompleto / error / success), asi que la UI de los formularios
 * no se modifica.
 */
import { renderMailTemplate } from './mailTemplate.js';

/**
 * @typedef {object} FormConfig
 * @property {string} subject Asunto del mail y titulo del template
 * @property {Record<string, string>} fields Mapa `name` del input -> etiqueta del mail
 * @property {string[]} [optional_fields] Campos que pueden venir vacios
 * @property {string} [custom_recipient] Destinatario distinto del default
 * @property {string} [reply_to] Reply-To del mail
 * @property {Array<{filename: string, content: Buffer, contentType?: string}>} [attachments]
 */

/**
 * @param {Record<string, string>} fields Campos crudos del POST
 * @param {FormConfig} config
 * @param {object} deps
 * @param {(token: string) => Promise<{ok: boolean, reason: string, score: number | null}>} deps.verifyRecaptcha
 * @param {(message: object) => Promise<{success: boolean, message: string, error?: string}>} deps.sendMail
 * @param {string} deps.templateHtml
 * @returns {Promise<{success: boolean, message: string, field?: string, reason?: string, error?: string}>}
 */
export async function handleFormSubmission(fields, config, deps) {
	const captcha = await deps.verifyRecaptcha(fields['g-recaptcha-response'] ?? '');
	if (!captcha.ok) {
		return { success: false, message: 'recaptcha', reason: captcha.reason };
	}

	const optional = config.optional_fields ?? [];
	/** @type {Record<string, string>} */
	const data = { title: config.subject };

	for (const [name, label] of Object.entries(config.fields)) {
		const value = typeof fields[name] === 'string' ? fields[name].trim() : '';
		if (value === '' && !optional.includes(name)) {
			return { success: false, message: 'incompleto', field: name };
		}
		data[label] = value;
	}

	return deps.sendMail({
		subject: config.subject,
		html: renderMailTemplate(deps.templateHtml, data),
		to: config.custom_recipient,
		replyTo: config.reply_to,
		attachments: config.attachments
	});
}
