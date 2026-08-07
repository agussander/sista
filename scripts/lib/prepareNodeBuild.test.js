import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
	prunePhpFiles,
	writeRobotsTxt,
	findRemainingPhpFiles,
	writeServerEntry
} from './prepareNodeBuild.js';

/** @type {string} */
let dir;

beforeEach(() => {
	dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prepare-node-build-'));
});

afterEach(() => {
	fs.rmSync(dir, { recursive: true, force: true });
});

/** Crea un archivo creando los directorios intermedios que hagan falta. */
function write(relPath, content) {
	const full = path.join(dir, relPath);
	fs.mkdirSync(path.dirname(full), { recursive: true });
	fs.writeFileSync(full, content);
}

describe('prunePhpFiles', () => {
	it('borra los .php de la raiz y de subdirectorios anidados', () => {
		write('assets/send-llamenme.php', '<?php echo 1;');
		write('assets/PHPMailer/SMTP.php', '<?php class SMTP {}');
		write('assets/includes/MailHandler.php', '<?php class MailHandler {}');

		prunePhpFiles(dir);

		expect(fs.existsSync(path.join(dir, 'assets/send-llamenme.php'))).toBe(false);
		expect(fs.existsSync(path.join(dir, 'assets/PHPMailer/SMTP.php'))).toBe(false);
		expect(fs.existsSync(path.join(dir, 'assets/includes/MailHandler.php'))).toBe(false);
	});

	it('no toca archivos que no son .php', () => {
		write('assets/correo_template.html', '<html></html>');
		write('assets/DGO-channels.json', '{}');
		write('index.html', '<html></html>');

		prunePhpFiles(dir);

		expect(fs.existsSync(path.join(dir, 'assets/correo_template.html'))).toBe(true);
		expect(fs.existsSync(path.join(dir, 'assets/DGO-channels.json'))).toBe(true);
		expect(fs.existsSync(path.join(dir, 'index.html'))).toBe(true);
	});

	it('devuelve las rutas relativas de lo que borro', () => {
		write('assets/a.php', '<?php');
		write('assets/sub/b.php', '<?php');

		const removed = prunePhpFiles(dir);

		expect(removed.sort()).toEqual(['assets/a.php', 'assets/sub/b.php']);
	});

	it('no falla con un .PHP en mayusculas', () => {
		write('assets/Legacy.PHP', '<?php');

		prunePhpFiles(dir);

		expect(fs.existsSync(path.join(dir, 'assets/Legacy.PHP'))).toBe(false);
	});

	it('devuelve lista vacia si no hay php', () => {
		write('index.html', '<html></html>');

		expect(prunePhpFiles(dir)).toEqual([]);
	});

	it('borra un archivo llamado exactamente .php', () => {
		write('assets/.php', '<?php echo "hidden";');

		prunePhpFiles(dir);

		expect(fs.existsSync(path.join(dir, 'assets/.php'))).toBe(false);
	});

	it('borra un symlink llamado evil.php', () => {
		write('assets/real-target.txt', 'contenido real');
		fs.symlinkSync(
			path.join(dir, 'assets/real-target.txt'),
			path.join(dir, 'assets/evil.php')
		);

		prunePhpFiles(dir);

		expect(fs.existsSync(path.join(dir, 'assets/evil.php'))).toBe(false);
		// el archivo apuntado no se toca, solo el symlink
		expect(fs.existsSync(path.join(dir, 'assets/real-target.txt'))).toBe(true);
	});
});

describe('findRemainingPhpFiles', () => {
	it('devuelve lista vacia en un arbol limpio', () => {
		write('index.html', '<html></html>');
		write('assets/correo_template.html', '<html></html>');

		expect(findRemainingPhpFiles(dir)).toEqual([]);
	});

	it('encuentra un .php dentro de un directorio symlinkeado', () => {
		const realSubdir = fs.mkdtempSync(path.join(os.tmpdir(), 'prepare-node-build-target-'));
		fs.writeFileSync(path.join(realSubdir, 'hidden.php'), '<?php');
		fs.symlinkSync(realSubdir, path.join(dir, 'linked-dir'));

		const remaining = findRemainingPhpFiles(dir);

		expect(remaining).toEqual(['linked-dir/hidden.php']);

		fs.rmSync(realSubdir, { recursive: true, force: true });
	});

	it('no falla con un symlink roto', () => {
		fs.symlinkSync(path.join(dir, 'no-existe.php'), path.join(dir, 'broken.php'));

		expect(() => findRemainingPhpFiles(dir)).not.toThrow();
	});
});

describe('writeRobotsTxt', () => {
	it('bloquea todo cuando siteEnv no es production', () => {
		write('robots.txt', 'User-agent: *\nAllow: /\n');

		const blocked = writeRobotsTxt(dir, { siteEnv: 'beta' });

		expect(blocked).toBe(true);
		expect(fs.readFileSync(path.join(dir, 'robots.txt'), 'utf8')).toBe(
			'User-agent: *\nDisallow: /\n'
		);
	});

	it('bloquea tambien cuando siteEnv no esta definido', () => {
		write('robots.txt', 'User-agent: *\nAllow: /\n');

		expect(writeRobotsTxt(dir, { siteEnv: undefined })).toBe(true);
		expect(fs.readFileSync(path.join(dir, 'robots.txt'), 'utf8')).toContain('Disallow: /');
	});

	it('deja intacto el robots.txt original en production', () => {
		const original = 'User-agent: *\nAllow: /\n\nSitemap: https://www.sista.com.ar/sitemap.xml\n';
		write('robots.txt', original);

		const blocked = writeRobotsTxt(dir, { siteEnv: 'production' });

		expect(blocked).toBe(false);
		expect(fs.readFileSync(path.join(dir, 'robots.txt'), 'utf8')).toBe(original);
	});

	it('crea el robots.txt aunque no existiera', () => {
		writeRobotsTxt(dir, { siteEnv: 'beta' });

		expect(fs.readFileSync(path.join(dir, 'robots.txt'), 'utf8')).toContain('Disallow: /');
	});
});

describe('writeServerEntry', () => {
	/** Simula el arbol que deja adapter-node, mas el modulo fuente del header. */
	function setupBuild() {
		write('handler.js', 'export function handler() {}');
		const robotsHeaderPath = path.join(dir, 'fuente-robotsHeader.js');
		fs.writeFileSync(
			robotsHeaderPath,
			"export const NOINDEX_VALUE = 'noindex, nofollow';\nexport function shouldBlockIndexing(s) { return s !== 'production'; }\n"
		);
		return robotsHeaderPath;
	}

	it('escribe server.js dentro del build', () => {
		const robotsHeaderPath = setupBuild();

		writeServerEntry(dir, { robotsHeaderPath });

		expect(fs.existsSync(path.join(dir, 'server.js'))).toBe(true);
	});

	it('copia robotsHeader.js al build para no depender de src/', () => {
		const robotsHeaderPath = setupBuild();

		writeServerEntry(dir, { robotsHeaderPath });

		const copiado = fs.readFileSync(path.join(dir, 'robotsHeader.js'), 'utf8');
		expect(copiado).toContain('shouldBlockIndexing');
		expect(copiado).toContain('NOINDEX_VALUE');
	});

	it('el server.js generado resuelve todo con rutas hermanas', () => {
		const robotsHeaderPath = setupBuild();

		writeServerEntry(dir, { robotsHeaderPath });

		const generado = fs.readFileSync(path.join(dir, 'server.js'), 'utf8');
		expect(generado).toContain("from './handler.js'");
		expect(generado).toContain("from './robotsHeader.js'");

		// Hostinger resuelve el entry dentro del output dir: un import que salga
		// de ahi no se encuentra y el arranque falla con 503. Se miran solo los
		// imports reales, no los comentarios que hablan de rutas.
		const specs = [...generado.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);
		expect(specs.length).toBeGreaterThan(0);
		for (const spec of specs) {
			if (spec.startsWith('node:')) continue;
			expect(spec.startsWith('./')).toBe(true);
			expect(spec).not.toContain('..');
			expect(spec).not.toContain('build');
		}
	});

	it('setea el header antes de delegar en el handler', () => {
		const robotsHeaderPath = setupBuild();

		writeServerEntry(dir, { robotsHeaderPath });

		const generado = fs.readFileSync(path.join(dir, 'server.js'), 'utf8');
		expect(generado.indexOf('setHeader')).toBeLessThan(generado.indexOf('handler(req, res)'));
	});

	it('falla si no encuentra el modulo fuente del header', () => {
		write('handler.js', 'export function handler() {}');

		expect(() =>
			writeServerEntry(dir, { robotsHeaderPath: path.join(dir, 'no-existe.js') })
		).toThrow();
	});
});
