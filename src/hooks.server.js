import { env } from '$env/dynamic/private';
import { shouldBlockIndexing, NOINDEX_VALUE } from '$lib/server/robotsHeader.js';

// OJO: este hook NO alcanza por si solo. adapter-node sirve las paginas
// prerenderizadas antes de llegar al handler de SvelteKit, asi que aca solo
// pasan las respuestas dinamicas. La cobertura completa la da `server.js`,
// que es el entry real en produccion. Esto queda como red de contencion por
// si alguien arranca `build-node/index.js` directamente.

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
	const response = await resolve(event);

	if (shouldBlockIndexing(env.SITE_ENV)) {
		response.headers.set('X-Robots-Tag', NOINDEX_VALUE);
	}

	return response;
}
