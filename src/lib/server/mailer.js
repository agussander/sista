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
 * @param {number | string} config.port
 * @param {string} config.user
 * @param {string} config.pass
 */
export function createTransport({ host, port, user, pass }) {
	// `env` dinamico (`$env/dynamic/private`) entrega strings; coercionamos una
	// sola vez para que la comparacion con 465 no falle en silencio.
	const numericPort = Number(port);

	if (!user || !pass) {
		console.error('[mailer] SMTP sin credenciales (SMTP_USER/SMTP_PASSWORD vacios)');
	}

	return nodemailer.createTransport({
		host,
		port: numericPort,
		// 587 con STARTTLS, igual que `ENCRYPTION_STARTTLS` en el PHP.
		secure: numericPort === 465,
		// El PHP fuerza el upgrade a TLS y falla si el servidor no lo ofrece
		// (`ENCRYPTION_STARTTLS`); sin esto nodemailer hace STARTTLS oportunista
		// y seguiria en texto plano -mandando credenciales sin cifrar- si el
		// servidor no lo ofrece. Irrelevante con `secure: true` en 465.
		requireTLS: true,
		// A diferencia del PHP (que apuntaba a `mail.sista.ar` y desactivaba la
		// verificacion del certificado TLS), dejamos la verificacion estricta de
		// nodemailer por defecto: el `.env` actual usa `smtp.gmail.com`, cuyo
		// certificado valida sin problemas. Si algun dia se vuelve a apuntar a un
		// host con certificado self-signed, esto va a romper y hay que revisitarlo.
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
		// Nodemailer adjunta `.code`/`.command`/`.responseCode`/`.response` en los
		// errores SMTP; se loguea el objeto completo para no perderlos, aunque lo
		// que devolvemos en `error` sigue siendo el string.
		console.error('[mailer] fallo el envio:', detail, error);
		return { success: false, message: 'error', error: detail };
	}
}
