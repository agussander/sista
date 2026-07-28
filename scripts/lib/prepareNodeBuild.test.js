import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { prunePhpFiles, writeRobotsTxt } from './prepareNodeBuild.js';

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
