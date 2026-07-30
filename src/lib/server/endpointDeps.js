/**
 * Arma las dependencias de `handleFormSubmission` a partir de las variables de
 * entorno. Vive aparte de `formHandler.js` para que ese modulo siga sin
 * importar `$env` y se pueda testear con Vitest.
 */
import { env } from '$env/dynamic/private';
import { verifyRecaptcha } from './recaptcha.js';
import { createTransport, sendMail } from './mailer.js';
import { templateHtml } from './correoTemplate.js';

/** El transport se crea una vez por proceso; nodemailer reusa la conexion. */
let transport;

function getTransport() {
	if (!transport) {
		transport = createTransport({
			host: env.SMTP_HOST || 'smtp.gmail.com',
			port: Number(env.SMTP_PORT || 587),
			user: env.SMTP_USER || '',
			pass: env.SMTP_PASSWORD || ''
		});
	}
	return transport;
}

/** Direccion del remitente: siempre el usuario SMTP autenticado. */
export function fromAddress() {
	return env.SMTP_USER || 'formularios@sista.ar';
}

/**
 * @param {string | null} remoteIp IP del visitante, para reCAPTCHA
 */
export function buildMailDeps(remoteIp) {
	return {
		verifyRecaptcha: (token) =>
			verifyRecaptcha(token, { secret: env.RECAPTCHA_SECRET_KEY || '', remoteIp }),
		sendMail: (message) => sendMail(getTransport(), { from: fromAddress(), ...message }),
		templateHtml
	};
}
