import { describe, it, expect } from 'vitest';
import { handleFormSubmission } from './formHandler.js';

const CONFIG = {
	subject: 'Contacto Web',
	fields: { nombre: 'Nombre', tel: 'Contacto', mensaje: 'Mensaje' }
};

/** deps con todo en verde. `sent` acumula los mails que se habrian enviado. */
function deps(overrides = {}) {
	const sent = [];
	return {
		sent,
		deps: {
			verifyRecaptcha: async () => ({ ok: true, reason: 'ok', score: 0.9 }),
			sendMail: async (message) => {
				sent.push(message);
				return { success: true, message: 'success' };
			},
			templateHtml: '<h1>[title]</h1><ul>[data]</ul>',
			...overrides
		}
	};
}

describe('handleFormSubmission', () => {
	it('envia el mail y devuelve success cuando todo esta bien', async () => {
		const { sent, deps: d } = deps();
		const res = await handleFormSubmission(
			{ nombre: 'Ada', tel: '221', mensaje: 'hola', 'g-recaptcha-response': 'tok' },
			CONFIG,
			d
		);

		expect(res).toEqual({ success: true, message: 'success' });
		expect(sent).toHaveLength(1);
		expect(sent[0].subject).toBe('Contacto Web');
		expect(sent[0].html).toContain('Ada');
	});

	it('corta con recaptcha si el captcha falla', async () => {
		const { sent, deps: d } = deps({
			verifyRecaptcha: async () => ({ ok: false, reason: 'low_score', score: 0.1 })
		});
		const res = await handleFormSubmission({ nombre: 'Ada', 'g-recaptcha-response': 'tok' }, CONFIG, d);

		expect(res).toEqual({ success: false, message: 'recaptcha', reason: 'low_score' });
		expect(sent).toHaveLength(0);
	});

	it('corta con incompleto y nombra el campo que falta', async () => {
		const { sent, deps: d } = deps();
		const res = await handleFormSubmission(
			{ nombre: 'Ada', tel: '', mensaje: 'hola', 'g-recaptcha-response': 'tok' },
			CONFIG,
			d
		);

		expect(res).toEqual({ success: false, message: 'incompleto', field: 'tel' });
		expect(sent).toHaveLength(0);
	});

	it('corta con incompleto si el campo ni siquiera vino', async () => {
		const { deps: d } = deps();
		const res = await handleFormSubmission({ nombre: 'Ada', 'g-recaptcha-response': 'tok' }, CONFIG, d);

		expect(res.message).toBe('incompleto');
		expect(res.field).toBe('tel');
	});

	it('reporta el primer campo faltante en el orden de la config', async () => {
		const { deps: d } = deps();
		const res = await handleFormSubmission({ 'g-recaptcha-response': 'tok' }, CONFIG, d);

		expect(res.field).toBe('nombre');
	});

	it('acepta vacios en los campos opcionales', async () => {
		const { sent, deps: d } = deps();
		const config = {
			subject: 'Empresas - Contacto web',
			fields: { nombre: 'Nombre', tel: 'Contacto', empresa: 'Empresa', mensaje: 'Mensaje' },
			optional_fields: ['empresa', 'mensaje']
		};
		const res = await handleFormSubmission(
			{ nombre: 'Ada', tel: '221', empresa: '', mensaje: '', 'g-recaptcha-response': 'tok' },
			config,
			d
		);

		expect(res.success).toBe(true);
		// Se busca el markup exacto del label (no el string suelto 'Empresa'):
		// el subject 'Empresas - Contacto web' tambien contiene esa substring,
		// asi que un toContain('Empresa') daria un falso negativo.
		expect(sent[0].html).not.toContain("<span class='label'>Empresa:</span>");
		expect(sent[0].html).not.toContain("<span class='label'>Mensaje:</span>");
		expect(sent[0].html).toContain("<span class='label'>Nombre:</span>");
	});

	it('recorta los espacios de los valores', async () => {
		const { sent, deps: d } = deps();
		await handleFormSubmission(
			{ nombre: '  Ada  ', tel: '221', mensaje: 'hola', 'g-recaptcha-response': 'tok' },
			CONFIG,
			d
		);

		expect(sent[0].html).toContain('>Ada<');
	});

	it('usa el destinatario y el reply-to de la config', async () => {
		const { sent, deps: d } = deps();
		await handleFormSubmission(
			{ nombre: 'Ada', tel: '221', mensaje: 'hola', 'g-recaptcha-response': 'tok' },
			{ ...CONFIG, custom_recipient: 'rrhh@sista.ar', reply_to: 'ada@example.com' },
			d
		);

		expect(sent[0].to).toBe('rrhh@sista.ar');
		expect(sent[0].replyTo).toBe('ada@example.com');
	});

	it('pasa los adjuntos al mail', async () => {
		const { sent, deps: d } = deps();
		const attachments = [{ filename: 'cv.pdf', content: Buffer.from('x') }];
		await handleFormSubmission(
			{ nombre: 'Ada', tel: '221', mensaje: 'hola', 'g-recaptcha-response': 'tok' },
			{ ...CONFIG, attachments },
			d
		);

		expect(sent[0].attachments).toBe(attachments);
	});

	it('propaga el error cuando el mail falla', async () => {
		const { deps: d } = deps({
			sendMail: async () => ({ success: false, message: 'error', error: 'SMTP caido' })
		});
		const res = await handleFormSubmission(
			{ nombre: 'Ada', tel: '221', mensaje: 'hola', 'g-recaptcha-response': 'tok' },
			CONFIG,
			d
		);

		expect(res.success).toBe(false);
		expect(res.message).toBe('error');
	});

	it('el titulo del mail es el subject de la config', async () => {
		const { sent, deps: d } = deps();
		await handleFormSubmission(
			{ nombre: 'Ada', tel: '221', mensaje: 'hola', 'g-recaptcha-response': 'tok' },
			CONFIG,
			d
		);

		expect(sent[0].html).toContain('<h1>Contacto Web</h1>');
	});
});
