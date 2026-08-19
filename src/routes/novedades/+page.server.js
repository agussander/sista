/**
 * Listado publico de novedades.
 *
 * Los datos se traen en el servidor y no en el navegador para que el HTML ya
 * salga con las novedades adentro (buscadores y previews). Eso hace la ruta no
 * prerenderizable, de ahi el `prerender = false` que pisa el `true` global de
 * `src/routes/+layout.js`.
 *
 * Consecuencia: esta ruta NO se emite en el build estatico (`build-static/`,
 * el sitio legacy sista.com.ar). Con `strict: false` en `svelte.config.js` eso
 * pasa en silencio, sin romper el build.
 */
import { env } from '$env/dynamic/private';
import { listarPublicadas, aNovedadPublica } from '$lib/server/novedades.js';

export const prerender = false;

/** @type {import('./$types').PageServerLoad} */
export async function load() {
	const baseUrl = env.VITE_POCKETBASE_URL || 'https://sista.pockethost.io';
	const registros = await listarPublicadas(baseUrl);

	return { novedades: registros.map((r) => aNovedadPublica(baseUrl, r)) };
}
