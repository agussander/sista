/**
 * Detalle en vivo de un cliente para la Cartera: datos, tickets y cobranzas.
 *
 * Cuesta 3 requests de la cuota de IspCube (mas 0 de auth gracias al cache de
 * token), mas el catalogo de planes (`getPlanCatalog`) — cacheado una hora, asi
 * que en la practica es 0 casi siempre. Es la unica pantalla que consulta en
 * vivo; la lista se sirve del snapshot en PocketBase.
 *
 * Solo lectura: no escribe en IspCube ni en PocketBase. Quien guarda el
 * snapshot actualizado es el navegador, con el token del propio asesor.
 */
import { json } from '@sveltejs/kit';
import { getCustomerByCode, getTickets, getCobranzas, getPlanCatalog } from '$lib/server/ispcube.js';
import { ispcubeConfig, pocketbaseUrl } from '$lib/server/ispcubeDeps.js';
import { verificarPermiso } from '$lib/server/adminAuth.js';
import { normalizarCliente, resumenTickets, resumenAltaNap } from '$lib/cartera/normalizar.js';
import { pagosDeCobranzas } from '$lib/cartera/pagos.js';
import { parseIds } from '$lib/cartera/ids.js';

export const prerender = false;
export const trailingSlash = 'ignore';

/** @type {import('./$types').RequestHandler} */
export async function GET({ request, params, url }) {
	const auth = await verificarPermiso(request, pocketbaseUrl(), 'cartera');
	if (!auth.ok) {
		// sin_token/token_invalido: no sabemos quien es. sin_permiso: sabemos
		// quien es y no puede: por eso el codigo distinto (403, no 401).
		const status = auth.reason === 'sin_permiso' ? 403 : 401;
		return json({ error: auth.reason }, { status });
	}
	// auth.usuarioId no se usa: este endpoint es de solo lectura y no escribe
	// nada asociado al usuario (ver comentario arriba del archivo). El permiso
	// ya se valido arriba.

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

	const [tickets, cobranzas, planes] = await Promise.all([
		getTickets(params.code, cfg),
		getCobranzas(params.code, cfg),
		getPlanCatalog(cfg)
	]);

	return json({
		// Sin catalogo (`planes.ok === false`) `normalizarCliente` sigue
		// funcionando igual que antes de que existiera: solo se pierde el
		// respaldo de nombre para conexiones sin `plan` anidado.
		cliente: normalizarCliente(cliente.customer.crudo ?? cliente.customer, planes.ok ? planes.porId : undefined),
		// Solo el resumen: el payload crudo de tickets trae el texto completo de
		// cada comentario y no lo lee nadie. Devolverlo entero terminaba
		// guardado en PocketBase por `agregar()` en el store, sin cota de tamano
		// y con una forma distinta a la que deja `resumenTickets` en cada
		// sincronizacion posterior.
		tickets: tickets.ok
			? resumenTickets(tickets.tickets, { areasSoporte, estadosCerrados })
			: { error: tickets.reason },
		alta_nap: tickets.ok ? resumenAltaNap(tickets.tickets, { estadosCerrados }) : null,
		pagos: cobranzas.ok ? pagosDeCobranzas(cobranzas.cobranzas) : { error: cobranzas.reason }
	});
}
