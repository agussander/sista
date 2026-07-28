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

/** Cuerpo del entry que se emite dentro del build. Ver `writeServerEntry`. */
const SERVER_ENTRY = `/**
 * ARCHIVO GENERADO por scripts/lib/prepareNodeBuild.js — no editarlo a mano.
 *
 * Envuelve el \`handler\` de adapter-node en vez de usar su \`index.js\`, porque
 * \`hooks.server.js\` NO alcanza para el header \`X-Robots-Tag\`: adapter-node
 * sirve las paginas prerenderizadas desde un middleware de archivos estaticos
 * que corre ANTES del handler de SvelteKit, asi que el hook nunca se ejecuta
 * para ellas. Y como todo el sitio es \`prerender = true\`, sin esto ninguna
 * pagina real llevaria el header.
 *
 * Vive DENTRO del build y solo importa hermanos: Hostinger resuelve el
 * \`entry_file\` relativo al output directory, asi que un import que salga de
 * aca (\`../src/...\`) no se encuentra y el arranque falla con 503.
 */
import { createServer } from 'node:http';
import { handler } from './handler.js';
import { shouldBlockIndexing, NOINDEX_VALUE } from './robotsHeader.js';

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || '0.0.0.0';

// Se evalua una sola vez al arrancar: \`SITE_ENV\` no cambia en caliente.
const blockIndexing = shouldBlockIndexing(process.env.SITE_ENV);

const server = createServer((req, res) => {
	if (blockIndexing) {
		res.setHeader('X-Robots-Tag', NOINDEX_VALUE);
	}

	handler(req, res);
});

server.listen(port, host, () => {
	console.log(
		\`[server] escuchando en http://\${host}:\${port} — indexacion \${
			blockIndexing ? 'BLOQUEADA' : 'permitida'
		} (SITE_ENV=\${process.env.SITE_ENV ?? 'sin definir'})\`
	);
});
`;

/**
 * Emite el entry de produccion (`server.js`) dentro del output del build, junto
 * con una copia de `robotsHeader.js`.
 *
 * Hostinger resuelve el `entry_file` **relativo al output directory**, no a la
 * raiz del proyecto. Un `server.js` en la raiz que importe `./build-node/...`
 * nunca lo encuentra: el proceso no arranca y el sitio responde 503. Por eso el
 * entry se genera adentro y solo referencia hermanos.
 *
 * `robotsHeader.js` se copia (en vez de importarse desde `src/`) para que el
 * build sea autocontenido y la regla siga viviendo en un unico lugar del fuente.
 *
 * @param {string} buildDir Raiz del output de adapter-node (`build-node/`)
 * @param {{ robotsHeaderPath: string }} options Ruta al modulo fuente del header
 * @returns {string} Ruta absoluta del `server.js` emitido
 */
export function writeServerEntry(buildDir, { robotsHeaderPath }) {
	// Falla ruidosamente si el fuente se movio: es preferible romper el build a
	// desplegar un entry que no arranca.
	const robotsHeader = fs.readFileSync(robotsHeaderPath, 'utf8');

	fs.writeFileSync(path.join(buildDir, 'robotsHeader.js'), robotsHeader);

	const entryPath = path.join(buildDir, 'server.js');
	fs.writeFileSync(entryPath, SERVER_ENTRY);
	return entryPath;
}
