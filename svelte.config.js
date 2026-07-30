import adapterStatic from '@sveltejs/adapter-static';
import adapterNode from '@sveltejs/adapter-node';

// El repo buildea a dos targets desde el mismo código fuente:
//
//   npm run build       -> build/       estático (adapter-static), deploy por FTP
//   npm run build:node  -> build-node/  app Node (adapter-node), deploy en Hostinger
//
// El `out: 'build-node'` NO es cosmético: ambos adapters escriben en `build/`
// por defecto, y un build Node pisaría el estático que consume `deploy.sh`.
const useNode = process.env.ADAPTER === 'node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		// Estático, sin `fallback`: las rutas inexistentes las resuelve el
		// servidor con HTTP 404 + `404.html` (ver `static/.htaccess`).
		// En Node, ese 404 lo maneja `src/routes/+error.svelte`.
		//
		// `strict: false` porque desde la Fase 1 el repo tiene rutas que NO se
		// pueden prerenderizar: los `+server.js` de `src/routes/api/`. En el
		// build estático simplemente no se emiten, y los formularios siguen
		// hablando con los `.php` gracias a `src/lib/formEndpoints.js`.
		//
		// Lo que se pierde a cambio: con `strict: false` el build estático ya no
		// avisa si una PÁGINA deja de ser prerenderizable por accidente (un
		// `+page.server.js` con `actions`, un `load` que lee algo de runtime).
		// Esa página desaparece de `build/` -y de producción- en silencio, sin
		// romper el build. Es justo el chequeo que gritó cuando se agregó el
		// primer `+server.js`. Si falta una página en `build/`, empezar por acá.
		adapter: useNode ? adapterNode({ out: 'build-node' }) : adapterStatic({ strict: false })
	}
};

export default config;
