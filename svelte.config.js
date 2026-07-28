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
		adapter: useNode ? adapterNode({ out: 'build-node' }) : adapterStatic()
	}
};

export default config;
