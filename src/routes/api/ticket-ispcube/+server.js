/**
 * Reemplazo de `static/assets/send-ticket-ispcube.php`.
 *
 * Contrato `{status}`, como el PHP: lo consume
 * `solicitudbaja2&np9277zhw/_components/Paso4.svelte`.
 *
 * ATENCION: crea tickets REALES en el IspCube de produccion. No dispararlo
 * desde verificaciones automaticas.
 */
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { getAuthToken, createTicket } from '$lib/server/ispcube.js';

// Tiene POST: no se puede prerenderizar. El `trailingSlash` explicito no
// neutraliza nada del layout; ver `api/contacto/+server.js` para el detalle.
export const prerender = false;
export const trailingSlash = 'ignore';

function config() {
	return {
		baseUrl: env.ISPCUBE_API_URL || 'https://sista.ispcube.online',
		username: env.ISPCUBE_USERNAME || '',
		password: env.ISPCUBE_PASSWORD || '',
		apiKey: env.ISPCUBE_API_KEY || '',
		clientId: env.ISPCUBE_CLIENT_ID || '734'
	};
}

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
	/** @type {any} */
	let data;
	try {
		data = await request.json();
	} catch (error) {
		console.error('[api/ticket-ispcube] body invalido:', error);
		return json({ status: 'error', message: 'Datos no válidos' });
	}
	if (!data || typeof data !== 'object') {
		return json({ status: 'error', message: 'Datos no válidos' });
	}

	const { nro_cliente, dni_cliente, mensaje_ticket, form_type, bearer_token } = data;
	if (!nro_cliente || !dni_cliente || !mensaje_ticket) {
		return json({ status: 'error', message: 'Faltan datos necesarios' });
	}

	const cfg = config();
	// El cliente manda el token que ya obtuvo al consultar el abonado; pedir uno
	// nuevo es el fallback, igual que en el PHP.
	const token = bearer_token || (await getAuthToken(cfg));
	if (!token) {
		return json({ status: 'error', message: 'Error al obtener token de autenticación' });
	}

	return json(
		await createTicket(cfg, { nro_cliente, dni_cliente, mensaje_ticket, form_type }, token)
	);
}
