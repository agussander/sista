/**
 * Detalle en vivo de un cliente para la Cartera: datos, tickets y cobranzas.
 *
 * Cuesta 3 requests de la cuota de IspCube (mas 0 de auth gracias al cache de
 * token). Es la unica pantalla que consulta en vivo; la lista se sirve del
 * snapshot en PocketBase.
 *
 * Solo lectura: no escribe en IspCube ni en PocketBase. Quien guarda el
 * snapshot actualizado es el navegador, con el token del propio asesor.
 */
import { json } from '@sveltejs/kit';
import { getCustomerByCode, getTickets, getCobranzas } from '$lib/server/ispcube.js';
import { ispcubeConfig, pocketbaseUrl } from '$lib/server/ispcubeDeps.js';
import { verificarAsesor } from '$lib/server/adminAuth.js';
import { normalizarCliente, resumenTickets } from '$lib/cartera/normalizar.js';
import { pagosDeCobranzas } from '$lib/cartera/pagos.js';
import { parseIds } from '$lib/cartera/ids.js';

export const prerender = false;
export const trailingSlash = 'ignore';

/** @type {import('./$types').RequestHandler} */
export async function GET({ request, params, url }) {
	const auth = await verificarAsesor(request, pocketbaseUrl());
	if (!auth.ok) return json({ error: auth.reason }, { status: 401 });

	const cfg = ispcubeConfig();

	// `getCustomerByCode` valida el formato del code y devuelve `not_found`
	// tanto para un codigo mal formado como para uno inexistente, a proposito.
	const cliente = await getCustomerByCode(params.code, cfg);
	if (!cliente.ok) {
		const status = cliente.reason === 'not_found' ? 404 : 502;
		return json({ error: cliente.reason }, { status });
	}

	// Las areas de soporte llegan del cliente porque viven en `cartera_config`,
	// que es de PocketBase. Vacio = todas las areas.
	const areasSoporte = parseIds(url.searchParams.get('areas'));
	const estadosCerrados = parseIds(url.searchParams.get('cerrados'));

	const [tickets, cobranzas] = await Promise.all([
		getTickets(params.code, cfg),
		getCobranzas(params.code, cfg)
	]);

	return json({
		cliente: normalizarCliente(cliente.customer.crudo ?? cliente.customer),
		tickets: tickets.ok
			? { ...resumenTickets(tickets.tickets, { areasSoporte, estadosCerrados }), lista: tickets.tickets }
			: { error: tickets.reason },
		pagos: cobranzas.ok ? pagosDeCobranzas(cobranzas.cobranzas) : { error: cobranzas.reason }
	});
}
