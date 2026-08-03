/**
 * Catalogos de IspCube que la Cartera necesita para configurarse: entidades de
 * cobranza (el medio de pago) y areas de tickets.
 *
 * Se cachean en memoria del proceso porque son estables y la API de IspCube se
 * factura por request: sin cache, cada apertura de la pantalla de configuracion
 * gastaria dos llamadas de la cuota mensual.
 */
import { json } from '@sveltejs/kit';
import { getCatalogos } from '$lib/server/ispcube.js';
import { ispcubeConfig, pocketbaseUrl } from '$lib/server/ispcubeDeps.js';
import { verificarPermiso } from '$lib/server/adminAuth.js';

export const prerender = false;
export const trailingSlash = 'ignore';

/** Vida del cache en memoria. Los catalogos cambian con muy baja frecuencia. */
const TTL_MS = 60 * 60 * 1000;

/** @type {{datos: any, expira: number} | null} */
let cache = null;

/** @type {import('./$types').RequestHandler} */
export async function GET({ request }) {
	const auth = await verificarPermiso(request, pocketbaseUrl(), 'cartera');
	if (!auth.ok) {
		// sin_token/token_invalido: no sabemos quien es. sin_permiso: sabemos
		// quien es y no puede: por eso el codigo distinto (403, no 401).
		const status = auth.reason === 'sin_permiso' ? 403 : 401;
		return json({ error: auth.reason }, { status });
	}
	// auth.usuarioId no se usa: este endpoint no escribe en PocketBase ni
	// filtra datos por usuario, solo sirve catalogos globales de IspCube. El
	// permiso ya se valido arriba.
	// auth.usuarioId no se usa: este endpoint no escribe en PocketBase ni
	// filtra datos por usuario, solo sirve catalogos globales de IspCube. El
	// permiso ya se valido arriba.

	if (cache && cache.expira > Date.now()) {
		return json({ ...cache.datos, cacheado: true });
	}

	const r = await getCatalogos(ispcubeConfig());
	if (!r.ok) return json({ error: r.reason }, { status: 502 });

	const datos = {
		entidades: r.entidades.map((e) => ({ id: e.id, nombre: e.name })),
		areas: r.areas.map((a) => ({ id: a.id, nombre: a.name }))
	};
	cache = { datos, expira: Date.now() + TTL_MS };

	return json({ ...datos, cacheado: false });
}
