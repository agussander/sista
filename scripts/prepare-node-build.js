/**
 * Post-procesa el output de `adapter-node` antes de desplegarlo.
 *
 * Se ejecuta desde `npm run build:node`. Ver
 * `docs/superpowers/specs/2026-07-28-migracion-adapter-node-hostinger-design.md`.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
	prunePhpFiles,
	writeRobotsTxt,
	findRemainingPhpFiles,
	writeServerEntry
} from './lib/prepareNodeBuild.js';

const buildDir = path.resolve('build-node');
const clientDir = path.join(buildDir, 'client');

if (!fs.existsSync(clientDir)) {
	console.error(`[prepare-node-build] No existe ${clientDir}. Corre el build primero.`);
	process.exit(1);
}

const removed = prunePhpFiles(clientDir);
console.log(`[prepare-node-build] ${removed.length} archivo(s) .php borrados del build.`);

const remaining = findRemainingPhpFiles(clientDir);
if (remaining.length > 0) {
	console.error(
		`[prepare-node-build] ABORTADO: quedaron ${remaining.length} archivo(s) .php en el build:`
	);
	for (const file of remaining) console.error(`  - ${file}`);
	process.exit(1);
}

const siteEnv = process.env.SITE_ENV;
const blocked = writeRobotsTxt(clientDir, { siteEnv });
console.log(
	blocked
		? `[prepare-node-build] robots.txt bloqueado (SITE_ENV=${siteEnv ?? 'sin definir'}).`
		: '[prepare-node-build] robots.txt de produccion conservado.'
);

// El entry se emite adentro del build porque Hostinger resuelve el `entry_file`
// relativo al output directory, no a la raiz del proyecto.
const entryPath = writeServerEntry(buildDir, {
	robotsHeaderPath: path.resolve('src/lib/server/robotsHeader.js')
});
console.log(`[prepare-node-build] entry emitido en ${path.relative(process.cwd(), entryPath)}.`);
