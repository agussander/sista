import fs from 'node:fs';
import path from 'node:path';

const BLOCKED_ROBOTS = 'User-agent: *\nDisallow: /\n';

/** @param {string} name */
function isPhpName(name) {
	return name.toLowerCase().endsWith('.php');
}

/**
 * Borra recursivamente todos los archivos (y symlinks) `.php` de un directorio.
 *
 * Bajo Node no hay Apache que los ejecute: SvelteKit los serviria como texto
 * plano, publicando el codigo de los handlers. Por eso no pueden quedar en el
 * output del build Node.
 *
 * Los symlinks cuyo nombre termina en `.php` se borran (el symlink en si, no
 * el archivo apuntado). Los directorios symlinkeados deliberadamente NO se
 * recorren (seguirlos arriesga loops infinitos con symlinks ciclicos); lo que
 * quede adentro de un directorio symlinkeado lo debe atrapar el gate de
 * verificacion (`findRemainingPhpFiles`), que si sigue symlinks.
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

			if (entry.isSymbolicLink()) {
				if (isPhpName(entry.name)) {
					fs.rmSync(full);
					removed.push(path.relative(dir, full));
				}
				// No seguimos symlinks a directorios: ver comentario arriba.
				continue;
			}

			if (entry.isDirectory()) {
				walk(full);
			} else if (entry.isFile() && isPhpName(entry.name)) {
				fs.rmSync(full);
				removed.push(path.relative(dir, full));
			}
		}
	}

	walk(dir);
	return removed;
}

/**
 * Recorre `dir` (siguiendo symlinks a directorios) y devuelve las rutas
 * relativas de todo lo que termine en `.php`.
 *
 * Es el gate de verificacion que se corre despues de `prunePhpFiles`: convierte
 * la garantia de "tratamos de borrarlos" en "el build falla en vez de publicar
 * codigo PHP", que es la propiedad que realmente importa y es robusta a
 * sorpresas futuras del filesystem (symlinks, dotfiles, etc).
 *
 * @param {string} dir Directorio raiz a inspeccionar
 * @returns {string[]} Rutas relativas a `dir` de los `.php` que sobrevivieron
 */
export function findRemainingPhpFiles(dir) {
	/** @type {string[]} */
	const found = [];
	/** @type {Set<string>} */
	const visitedRealPaths = new Set();

	/** @param {string} current Ruta absoluta del directorio a recorrer */
	function walk(current) {
		let realPath;
		try {
			realPath = fs.realpathSync(current);
		} catch {
			return;
		}
		if (visitedRealPaths.has(realPath)) return;
		visitedRealPaths.add(realPath);

		let entries;
		try {
			entries = fs.readdirSync(current, { withFileTypes: true });
		} catch {
			return;
		}

		for (const entry of entries) {
			const full = path.join(current, entry.name);

			let stat;
			try {
				stat = fs.statSync(full);
			} catch {
				// Symlink roto u otro problema de acceso: lo ignoramos.
				continue;
			}

			if (stat.isDirectory()) {
				walk(full);
			} else if (stat.isFile() && isPhpName(entry.name)) {
				found.push(path.relative(dir, full));
			}
		}
	}

	walk(dir);
	return found;
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
