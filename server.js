/**
 * Entry point de la app Node en Hostinger.
 *
 * Envuelve el `handler` de adapter-node en vez de usar su `index.js`, porque
 * `hooks.server.js` NO alcanza para el header `X-Robots-Tag`: adapter-node
 * sirve las paginas prerenderizadas desde un middleware de archivos estaticos
 * que corre ANTES del handler de SvelteKit, asi que el hook nunca se ejecuta
 * para ellas. Y como todo el sitio es `prerender = true`, sin esto ninguna
 * pagina real llevaria el header.
 *
 * Seteando el header aca, antes de delegar en `handler`, queda cubierto todo:
 * prerenderizadas, assets estaticos y respuestas dinamicas.
 *
 * Start command en hPanel: `node server.js`
 */
import { createServer } from 'node:http';
import { handler } from './build-node/handler.js';
// Se importa del fuente (no del build) para no duplicar la regla: es un modulo
// JS puro, sin imports de SvelteKit, asi que Node lo resuelve sin problema.
import { shouldBlockIndexing, NOINDEX_VALUE } from './src/lib/server/robotsHeader.js';

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || '0.0.0.0';

// Se evalua una sola vez al arrancar: `SITE_ENV` no cambia en caliente.
const blockIndexing = shouldBlockIndexing(process.env.SITE_ENV);

const server = createServer((req, res) => {
	if (blockIndexing) {
		res.setHeader('X-Robots-Tag', NOINDEX_VALUE);
	}

	handler(req, res);
});

server.listen(port, host, () => {
	console.log(
		`[server] escuchando en http://${host}:${port} — indexacion ${
			blockIndexing ? 'BLOQUEADA' : 'permitida'
		} (SITE_ENV=${process.env.SITE_ENV ?? 'sin definir'})`
	);
});
