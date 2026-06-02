import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		// Sin `fallback`: sitio 100 % estático. Las rutas inexistentes las resuelve
		// el servidor con HTTP 404 + `404.html` (ver `static/.htaccess`).
		adapter: adapter()
	}
};

export default config;
