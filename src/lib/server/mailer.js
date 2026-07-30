/**
 * Envio de mail. Puerto de `static/assets/includes/MailHandler.php`, que usaba
 * PHPMailer sobre el mismo SMTP.
 *
 * Devuelve el mismo contrato que el PHP (`{success, message, error}`) para que
 * la logica de los 8 formularios no cambie.
 */
import nodemailer from 'nodemailer';

/** Destinatario por defecto, igual que `MailHandler::DEFAULT_RECIPIENT`. */
export const DEFAULT_RECIPIENT = 'info@sista.ar';

/** Nombre del remitente, igual que el `$from_name` del PHP. */
export const FROM_NAME = 'Web';

/**
 * @param {object} config
 * @param {string} config.host
 * @param {number} config.port
 * @param {string} config.user
 * @param {string} config.pass
 */
export function createTransport({ host, port, user, pass }) {
	return nodemailer.createTransport({
		host,
		port,
		// 587 con STARTTLS, igual que `ENCRYPTION_STARTTLS` en el PHP.
		secure: port === 465,
		auth: { user, pass },
		connectionTimeout: 30_000,
		greetingTimeout: 30_000,
		socketTimeout: 30_000
	});
}

/**
 * @param {import('nodemailer').Transporter} transport
 * @param {object} message
 * @param {string} message.from Direccion del remitente (el usuario SMTP)
 * @param {string} [message.to]
 * @param {string} [message.replyTo]
 * @param {string} message.subject
 * @param {string} message.html
 * @param {Array<{filename: string, content: Buffer, contentType?: string}>} [message.attachments]
 * @returns {Promise<{success: boolean, message: string, error?: string}>}
 */
export async function sendMail(transport, message) {
	try {
		await transport.sendMail({
			from: { name: FROM_NAME, address: message.from },
			to: message.to || DEFAULT_RECIPIENT,
			replyTo: message.replyTo || undefined,
			subject: message.subject,
			html: message.html,
			attachments: message.attachments ?? []
		});
		return { success: true, message: 'success' };
	} catch (error) {
		const detail = error instanceof Error ? error.message : String(error);
		console.error('[mailer] fallo el envio:', detail);
		return { success: false, message: 'error', error: detail };
	}
}
