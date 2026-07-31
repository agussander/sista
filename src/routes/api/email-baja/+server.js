/**
 * Reemplazo de `static/assets/send-email-baja.php`.
 *
 * Contrato distinto al resto: `{status: 'success' | 'error', message}`. Lo
 * consume `solicitudbaja2&np9277zhw/_components/Paso4.svelte`, que ramifica
 * sobre `status`. No se cambia.
 *
 * Recibe JSON, no FormData, asi que la proteccion CSRF de SvelteKit no aplica.
 * El PHP usaba `mail()` nativo; aca va por el mismo SMTP que el resto.
 */
import { json } from '@sveltejs/kit';
import { renderBajaEmail } from '$lib/server/bajaEmail.js';
import { getMailSender } from '$lib/server/endpointDeps.js';

// Tiene POST: no se puede prerenderizar. El `trailingSlash` explicito no
// neutraliza nada del layout; ver `api/contacto/+server.js` para el detalle.
export const prerender = false;
export const trailingSlash = 'ignore';

const RECIPIENT = 'agustinsander@gmail.com';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
	/** @type {any} */
	let data;
	try {
		data = await request.json();
	} catch (error) {
		console.error('[api/email-baja] body invalido:', error);
		return json({ status: 'error', message: 'Datos no válidos' });
	}
	if (!data || typeof data !== 'object') {
		return json({ status: 'error', message: 'Datos no válidos' });
	}

	const { nro_cliente, dni_cliente, mensaje_ticket, numero_tramite } = data;
	if (!nro_cliente || !dni_cliente || !mensaje_ticket) {
		return json({ status: 'error', message: 'Faltan datos necesarios para el email' });
	}

	const sendMail = getMailSender();
	const result = await sendMail({
		subject: `Nueva Solicitud de Baja - Cliente: ${nro_cliente}`,
		html: renderBajaEmail({ nro_cliente, dni_cliente, mensaje_ticket, numero_tramite }),
		to: RECIPIENT
	});

	return result.success
		? json({ status: 'success', message: 'Email enviado correctamente' })
		: json({ status: 'error', message: 'Error al enviar el email' });
}
