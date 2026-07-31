/**
 * Arma las dependencias de los endpoints a partir de las variables de entorno.
 * Vive aparte de `formHandler.js` para que ese modulo siga sin importar `$env` y
 * se pueda testear con Vitest.
 *
 * Las piezas se exponen sueltas (`getMailSender`, `getRecaptchaVerifier`) ademas
 * de compuestas (`buildMailDeps`): no todos los endpoints usan
 * `handleFormSubmission`, y los que solo mandan mail -o solo validan el
 * captcha- no tienen por que pedir el paquete entero. El fallback de cada
 * secret queda igual en un unico lugar.
 */
import { env } from '$env/dynamic/private';
import { verifyRecaptcha } from './recaptcha.js';
import { createTransport, sendMail } from './mailer.js';
import { templateHtml } from './correoTemplate.js';

/**
 * El transport se crea una vez por proceso; nodemailer reusa la conexion.
 *
 * El costo del cacheo: si se rota `SMTP_PASSWORD` (o cualquier `SMTP_*`) en
 * hPanel, este transport sigue usando la credencial vieja hasta que se reinicie
 * la app, asi que rotar la clave obliga a reiniciarla.
 */
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

/**
 * Direccion del remitente: siempre el usuario SMTP autenticado.
 *
 * Sin default a proposito, igual que `mailer.js` con las credenciales: un
 * fallback hardcodeado fingiria que hay configuracion cuando no la hay, y con
 * Gmail un `From` que no coincide con la cuenta autenticada puede terminar
 * reescrito o rechazado sin que nos enteremos. Si esto vuelve vacio, el
 * `console.error` de `createTransport` ya grito que el SMTP esta sin configurar.
 */
export function fromAddress() {
	return env.SMTP_USER || '';
}

/**
 * Funcion de envio ya atada al transport y al remitente. Para los endpoints que
 * solo mandan mail, sin pasar por `handleFormSubmission`.
 *
 * @returns {(message: object) => Promise<{success: boolean, message: string, error?: string}>}
 */
export function getMailSender() {
	return (message) => sendMail(getTransport(), { from: fromAddress(), ...message });
}

/**
 * Verificacion de reCAPTCHA ya atada al secret. Para los endpoints que validan
 * el captcha por su cuenta.
 *
 * @param {string | null} remoteIp IP del visitante
 * @returns {(token: string) => Promise<import('./recaptcha.js').RecaptchaResult>}
 */
export function getRecaptchaVerifier(remoteIp) {
	return (token) => verifyRecaptcha(token, { secret: env.RECAPTCHA_SECRET_KEY || '', remoteIp });
}

/**
 * Paquete completo, para los endpoints que usan `handleFormSubmission`.
 *
 * @param {string | null} remoteIp IP del visitante, para reCAPTCHA
 */
export function buildMailDeps(remoteIp) {
	return {
		verifyRecaptcha: getRecaptchaVerifier(remoteIp),
		sendMail: getMailSender(),
		templateHtml
	};
}
