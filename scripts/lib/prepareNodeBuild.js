import fs from 'node:fs';
import path from 'node:path';

const BLOCKED_ROBOTS = 'User-agent: *\nDisallow: /\n';

/**
 * Borra recursivamente todos los archivos `.php` de un directorio.
 *
 * Bajo Node no hay Apache que los ejecute: SvelteKit los serviria como texto
 * plano, publicando el codigo de los handlers. Por eso no pueden quedar en el
 * output del build Node.
 *
 * @param {string} dir Directorio raiz a limpiar
 * @returns {string[]} Rutas relativas a `dir` de los archivos borrados
 */
export function prunePhpFiles(dir) {
	/** @type {string[]} */
	const removed = [];

	/** @param {string} current Ruta absoluta del directorio a recorrer */
	function walk(current) {
		for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
			const full = path.join(current, entry.name);
			if (entry.isDirectory()) {
				walk(full);
			} else if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.php') {
				fs.rmSync(full);
				removed.push(path.relative(dir, full));
			}
		}
	}

	walk(dir);
	return removed;
}

/**
 * Escribe un `robots.txt` que bloquea todo, salvo en produccion.
 *
 * El subdominio de pruebas sirve contenido identico a sista.com.ar: sin esto,
 * Google lo puede indexar como contenido duplicado.
 *
 * @param {string} dir Directorio donde vive el `robots.txt`
 * @param {{ siteEnv: string | undefined }} options
 * @returns {boolean} `true` si se bloqueo, `false` si se dejo el original
 */
export function writeRobotsTxt(dir, { siteEnv }) {
	if (siteEnv === 'production') return false;

	fs.writeFileSync(path.join(dir, 'robots.txt'), BLOCKED_ROBOTS);
	return true;
}
