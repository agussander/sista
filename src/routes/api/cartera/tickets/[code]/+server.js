/**
 * Los tickets de un cliente, en vivo, para el carrusel del detalle de la
 * Cartera.
 *
 * Cuesta 1 request de la cuota de IspCube por apertura (mas 4 la primera vez
 * de cada hora, por los catalogos, que se cachean). El snapshot de
 * `cartera_clientes` NO guarda esta lista: el payload crudo trae el texto
 * completo de cada comentario y no tiene cota de tamano. Lo que se guarda
 * sigue siendo el resumen (`{abiertos, cerrados, ultimo}`) que arma
 * `/api/cartera/sync`.
 *
 * Solo lectura: no escribe en IspCube ni en PocketBase.
 */
import { json } from '@sveltejs/kit';
import { getTickets, getCatalogosTickets } from '$lib/server/ispcube.js';
import { ispcubeConfig, pocketbaseUrl } from '$lib/server/ispcubeDeps.js';
import { verificarPermiso } from '$lib/server/adminAuth.js';
import { normalizarTickets } from '$lib/cartera/tickets.js';
import { parseIds } from '$lib/cartera/ids.js';

export const prerender = false;
export const trailingSlash = 'ignore';

/** Vida del cache en memoria. Los catalogos de tickets casi no cambian. */
const TTL_MS = 60 * 60 * 1000;

/** @type {{datos: any, expira: number} | null} */
let cacheCatalogos = null;

/**
 * Los catalogos, del cache o de IspCube.
 *
 * Devuelve `null` si IspCube no los da, y eso NO es un error del endpoint: sin
 * catalogos las tarjetas muestran `#3` en vez de "Sin servicio", que es
 * exactamente lo que se veia antes de esta pantalla. Perder los nombres
 * degrada la vista; no traer los tickets la vacia.
 *
 * Un fallo tampoco se cachea: el proximo pedido vuelve a intentar.
 */
async function catalogos(cfg) {
	if (cacheCatalogos && cacheCatalogos.expira > Date.now()) return cacheCatalogos.datos;

	const r = await getCatalogosTickets(cfg);
	if (!r.ok) {
		console.error('[cartera] no se pudieron leer los catalogos de tickets:', r.reason);
		return null;
	}

	const datos = {
		categorias: r.categorias,
		estados: r.estados,
		prioridades: r.prioridades,
		areas: r.areas
	};
	cacheCatalogos = { datos, expira: Date.now() + TTL_MS };
	return datos;
}

/** Vacia el cache. Solo para los tests: en produccion lo vence el TTL. */
export function _resetCacheCatalogos() {
	cacheCatalogos = null;
}

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
	// nada asociado al usuario. El permiso ya se valido arriba.

	const cfg = ispcubeConfig();

	// Sin 404 posible, a diferencia de `/api/cartera/cliente/[code]`: para
	// `getTickets` un 404 de IspCube significa "este cliente no tiene tickets"
	// y vuelve como lista vacia. Todo lo que llega aca es un fallo de la API
	// (o un code mal formado, que no puede pasar: el code sale del snapshot).
	const tickets = await getTickets(params.code, cfg);
	if (!tickets.ok) return json({ error: tickets.reason }, { status: 502 });

	// Los catalogos solo se piden si hay algo que traducir: un cliente sin
	// tickets no tiene que gastar cuatro requests de la cuota.
	const cat = tickets.tickets.length > 0 ? await catalogos(cfg) : null;

	// `cerrados` llega del cliente porque vive en `cartera_config`, que es de
	// PocketBase. Vacio = no se sabe cual es cerrado, y todo queda abierto.
	const estadosCerrados = parseIds(url.searchParams.get('cerrados'));

	return json({
		tickets: normalizarTickets(tickets.tickets, { catalogos: cat, estadosCerrados }),
		catalogos: cat !== null
	});
}
