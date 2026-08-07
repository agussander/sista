import adapterStatic from '@sveltejs/adapter-static';
import adapterNode from '@sveltejs/adapter-node';

// El repo buildea a dos targets desde el mismo código fuente:
//
//   npm run build         -> build/         app Node (adapter-node), deploy en Hostinger
//   npm run build:static  -> build-static/  estático (adapter-static), sitio legacy por FTP
//
// El target por DEFECTO es Node, y sale a `build/`, porque Hostinger no guarda
// la configuración de build en ningún lado: cada push a la rama conectada dispara
// un build que AUTODETECTA el proyecto, y para un SvelteKit la autodetección
// siempre asume la convención `npm run build` -> `build/` -> `server.js` adentro
// (verificado en 15 builds). Cuando el repo se salía de esa convención, el build
// automático generaba el estático, no encontraba `build/server.js` y el sitio
// quedaba en 503 hasta relanzarlo a mano por API. Con los nombres convencionales
// apuntando acá, la autodetección acierta sola.
//
// Corolario: NO mover el output de adapter-node fuera de `build/` ni renombrar el
// script `build`. Es lo único que mantiene el deploy automático funcionando.
//
// El estático es ahora el caso raro (sitio legacy sista.com.ar, actualizado a
// mano). Sale a `build-static/` para no pisar el build Node.
const useStatic = process.env.ADAPTER === 'static';

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
		adapter: useStatic
			? adapterStatic({ strict: false, pages: 'build-static', assets: 'build-static' })
			: adapterNode({ out: 'build' })
	}
};

export default config;
