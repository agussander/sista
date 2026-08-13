import { env } from '$env/dynamic/private';
import { shouldBlockIndexing, NOINDEX_VALUE } from '$lib/server/robotsHeader.js';
import { sacarGtmNoscript } from '$lib/server/gtmNoscript.js';
import { shouldTrack } from '$lib/tracking.js';

// OJO: para los HEADERS este hook NO alcanza por si solo. adapter-node sirve las
// paginas prerenderizadas antes de llegar al handler de SvelteKit, asi que aca
// solo pasan las respuestas dinamicas. La cobertura completa la da `server.js`,
// que es el entry real en produccion. Esto queda como red de contencion por
// si alguien arranca `build/index.js` directamente.
//
// `transformPageChunk` es otra historia: modifica el HTML cuando se GENERA, y
// para las paginas prerenderizadas eso pasa durante el build. Por eso si sirve
// para sacarles el noscript de GTM.

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
	// El `<noscript>` de GTM vive en `src/app.html`, fuera del arbol de
	// componentes, asi que el layout no puede condicionarlo como al resto de la
	// medicion. Se saca aca para que las rutas internas no lo disparen.
	const transformPageChunk = shouldTrack(event.url.pathname)
		? undefined
		: ({ html }) => sacarGtmNoscript(html);

	const response = await resolve(event, { transformPageChunk });

	if (shouldBlockIndexing(env.SITE_ENV)) {
		response.headers.set('X-Robots-Tag', NOINDEX_VALUE);
	}

	return response;
}
