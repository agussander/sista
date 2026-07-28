# Fase 0 — Adapter Node en Hostinger: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el mismo repo pueda buildear tanto el sitio estático actual como una app Node desplegable en Hostinger, sin filtrar los handlers PHP y sin que el subdominio de pruebas se indexe.

**Architecture:** `svelte.config.js` elige adapter según `process.env.ADAPTER`. El build Node sale a `build-node/` para no pisar el `build/` que consume `deploy.sh`. Un script post-build borra los `.php` del output y reescribe `robots.txt`; un entry propio `server.js` agrega `X-Robots-Tag: noindex` fuera de producción.

> **Corrección aplicada durante la implementación.** El plan original ponía el header en `hooks.server.js`. No alcanza: adapter-node sirve lo prerenderizado desde un middleware de estáticos que corre antes del handler de SvelteKit, y con todo el sitio en `prerender = true`, ninguna página real llevaba el header. Se agregó `server.js`, que envuelve el `handler` de adapter-node. El start command en hPanel es **`node server.js`**.

**Tech Stack:** SvelteKit 2.68, `@sveltejs/adapter-node` 5.5.7, Vite 6, Vitest 4, Node 22.

**Spec:** `docs/superpowers/specs/2026-07-28-migracion-adapter-node-hostinger-design.md`

---

## Pre-flight

Baseline verificado al escribir este plan: `npm test` → **10 archivos, 128 tests, todos pasando**. Si al empezar no está verde, parar y avisar: este plan asume ese punto de partida.

Este plan **no debe modificar** `deploy.sh`, `static/`, ni ningún componente de `src/lib/components/` o `src/routes/`. Si una tarea parece pedir eso, está mal interpretada.

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `svelte.config.js` (modificar) | Elegir adapter por env var. Único punto de decisión del target de build. |
| `package.json` (modificar) | Dependencia `adapter-node`, `engines`, script `build:node`. |
| `vite.config.js` (modificar) | Que Vitest también levante tests de `scripts/`. |
| `.gitignore` (modificar) | Ignorar `build-node/`. |
| `scripts/lib/prepareNodeBuild.js` (crear) | Funciones puras sobre un directorio: borrar `.php`, escribir `robots.txt`. Sin conocimiento de rutas del proyecto. |
| `scripts/lib/prepareNodeBuild.test.js` (crear) | Tests de las dos funciones contra directorios temporales. |
| `scripts/prepare-node-build.js` (crear) | CLI fino: aplica las funciones sobre `build-node/client`. |
| `src/lib/server/robotsHeader.js` (crear) | `shouldBlockIndexing(siteEnv)`. Pura y testeable, sin módulos virtuales de SvelteKit. |
| `src/lib/server/robotsHeader.test.js` (crear) | Tests de la función. |
| `src/hooks.server.js` (crear) | Red de contención: cubre solo respuestas dinámicas. Se verifica por integración, no por unit test. |
| `server.js` (crear) | Entry real en producción. Envuelve el `handler` de adapter-node y setea el header antes de delegar, cubriendo prerenderizadas, assets y dinámicas. |

---

## Task 1: Instalar adapter-node y fijar la versión de Node

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Instalar la dependencia**

```bash
npm install --save-dev @sveltejs/adapter-node@^5.5.7
```

- [ ] **Step 2: Agregar `engines` a `package.json`**

Insertar como propiedad de primer nivel, después de `"type": "module"`:

```json
	"engines": {
		"node": ">=20"
	},
```

Contexto: `.npmrc` tiene `engine-strict=true`, así que este campo se aplica de verdad. Local corre Node 22; Hostinger soporta 18–24. En hPanel hay que elegir 22 para que coincida con desarrollo.

- [ ] **Step 3: Verificar que no se rompió nada**

```bash
npm test
```

Expected: `Test Files 10 passed (10)`, `Tests 128 passed (128)`.

- [ ] **Step 4: Verificar que el build estático sigue igual**

```bash
npm run build && ls build/index.html && echo "ESTATICO OK"
```

Expected: imprime `build/index.html` y `ESTATICO OK`.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: agregar @sveltejs/adapter-node y engines"
```

---

## Task 2: Build dual en svelte.config.js

**Files:**
- Modify: `svelte.config.js`
- Modify: `.gitignore`

- [ ] **Step 1: Reescribir `svelte.config.js` completo**

```js
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
```

- [ ] **Step 2: Agregar `build-node/` a `.gitignore`**

En la sección `# Output`, debajo de `/build`:

```
/build-node
```

- [ ] **Step 3: Verificar que el build estático NO cambió de comportamiento**

```bash
rm -rf build && npm run build && ls build/index.html && ls build/assets/send-llamenme.php
```

Expected: los dos `ls` encuentran su archivo. En el build estático los `.php` **deben seguir estando** — son los que hacen andar los formularios en producción.

- [ ] **Step 4: Verificar que el build Node sale al directorio correcto**

```bash
ADAPTER=node npx vite build
ls build-node/index.js && ls -d build-node/client/_app && ls build-node/prerendered/index.html
```

Expected: los tres existen.

Ojo con el layout de `adapter-node`, que no es el de `adapter-static`: los assets van a `build-node/client/`, el HTML pregenerado a `build-node/prerendered/`, y el server a `build-node/index.js`. El home **no** está en `build-node/client/index.html`.

- [ ] **Step 5: Verificar que el build Node NO pisó el estático**

```bash
ls build/index.html && echo "ESTATICO INTACTO"
```

Expected: imprime `ESTATICO INTACTO`. Si falla, el `out:` no se aplicó y hay que parar.

- [ ] **Step 6: Confirmar el problema que resuelve la Task 3**

```bash
cat build-node/client/assets/send-llamenme.php | head -5
```

Expected: **imprime código PHP**. Esto es exactamente lo que no puede llegar a producción. La Task 3 lo arregla.

- [ ] **Step 7: Commit**

```bash
git add svelte.config.js .gitignore
git commit -m "build: adapter dual static/node segun ADAPTER env"
```

---

## Task 3: Script de preparación del build Node

**Files:**
- Create: `scripts/lib/prepareNodeBuild.js`
- Create: `scripts/lib/prepareNodeBuild.test.js`
- Create: `scripts/prepare-node-build.js`
- Modify: `vite.config.js`

- [ ] **Step 1: Que Vitest levante los tests de `scripts/`**

En `vite.config.js`, reemplazar el bloque `test`:

```js
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}', 'scripts/**/*.{test,spec}.{js,ts}'],
		environment: 'node'
	}
```

- [ ] **Step 2: Escribir los tests que fallan**

Crear `scripts/lib/prepareNodeBuild.test.js`:

```js
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
```

- [ ] **Step 3: Correr los tests para verificar que fallan**

```bash
npx vitest run scripts/lib/prepareNodeBuild.test.js
```

Expected: FAIL — no resuelve el import de `./prepareNodeBuild.js`.

- [ ] **Step 4: Implementar el módulo**

Crear `scripts/lib/prepareNodeBuild.js`:

```js
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
```

- [ ] **Step 5: Correr los tests para verificar que pasan**

```bash
npx vitest run scripts/lib/prepareNodeBuild.test.js
```

Expected: PASS, 9 tests.

- [ ] **Step 6: Escribir el CLI**

Crear `scripts/prepare-node-build.js`:

```js
/**
 * Post-procesa el output de `adapter-node` antes de desplegarlo.
 *
 * Se ejecuta desde `npm run build:node`. Ver
 * `docs/superpowers/specs/2026-07-28-migracion-adapter-node-hostinger-design.md`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { prunePhpFiles, writeRobotsTxt } from './lib/prepareNodeBuild.js';

const clientDir = path.resolve('build-node/client');

if (!fs.existsSync(clientDir)) {
	console.error(`[prepare-node-build] No existe ${clientDir}. Corre el build primero.`);
	process.exit(1);
}

const removed = prunePhpFiles(clientDir);
console.log(`[prepare-node-build] ${removed.length} archivo(s) .php borrados del build.`);

const siteEnv = process.env.SITE_ENV;
const blocked = writeRobotsTxt(clientDir, { siteEnv });
console.log(
	blocked
		? `[prepare-node-build] robots.txt bloqueado (SITE_ENV=${siteEnv ?? 'sin definir'}).`
		: '[prepare-node-build] robots.txt de produccion conservado.'
);
```

- [ ] **Step 7: Correr la suite completa**

```bash
npm test
```

Expected: `Test Files 11 passed (11)`, `Tests 137 passed (137)`.

- [ ] **Step 8: Commit**

```bash
git add scripts/lib/prepareNodeBuild.js scripts/lib/prepareNodeBuild.test.js scripts/prepare-node-build.js vite.config.js
git commit -m "build: script que limpia php y bloquea robots en el build node"
```

---

## Task 4: Header X-Robots-Tag

**Files:**
- Create: `src/lib/server/robotsHeader.js`
- Create: `src/lib/server/robotsHeader.test.js`
- Create: `src/hooks.server.js`

`robots.txt` evita que los crawlers recorran el sitio, pero una URL enlazada desde afuera igual puede terminar indexada. El header es la capa que lo garantiza.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/server/robotsHeader.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { shouldBlockIndexing, NOINDEX_VALUE } from './robotsHeader.js';

describe('shouldBlockIndexing', () => {
	it('no bloquea en production', () => {
		expect(shouldBlockIndexing('production')).toBe(false);
	});

	it('bloquea en beta', () => {
		expect(shouldBlockIndexing('beta')).toBe(true);
	});

	it('bloquea cuando la variable no esta definida', () => {
		expect(shouldBlockIndexing(undefined)).toBe(true);
	});

	it('bloquea con string vacio', () => {
		expect(shouldBlockIndexing('')).toBe(true);
	});

	it('no confunde valores parecidos a production', () => {
		expect(shouldBlockIndexing('Production')).toBe(true);
		expect(shouldBlockIndexing('production ')).toBe(true);
		expect(shouldBlockIndexing('pre-production')).toBe(true);
	});

	it('expone el valor del header', () => {
		expect(NOINDEX_VALUE).toBe('noindex, nofollow');
	});
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

```bash
npx vitest run src/lib/server/robotsHeader.test.js
```

Expected: FAIL — no resuelve el import de `./robotsHeader.js`.

- [ ] **Step 3: Implementar la función**

Crear `src/lib/server/robotsHeader.js`:

```js
/** Valor del header `X-Robots-Tag` cuando hay que impedir la indexacion. */
export const NOINDEX_VALUE = 'noindex, nofollow';

/**
 * Decide si la respuesta debe llevar `X-Robots-Tag: noindex`.
 *
 * El default es bloquear: si `SITE_ENV` no esta configurada, es mas seguro no
 * indexar que indexar un entorno de pruebas por accidente. La contracara es que
 * el dia del cutover hay que setear `SITE_ENV=production` si o si.
 *
 * @param {string | undefined} siteEnv Valor de la env var `SITE_ENV`
 * @returns {boolean}
 */
export function shouldBlockIndexing(siteEnv) {
	return siteEnv !== 'production';
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

```bash
npx vitest run src/lib/server/robotsHeader.test.js
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Escribir el hook**

Crear `src/hooks.server.js`:

```js
import { env } from '$env/dynamic/private';
import { shouldBlockIndexing, NOINDEX_VALUE } from '$lib/server/robotsHeader.js';

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
	const response = await resolve(event);

	if (shouldBlockIndexing(env.SITE_ENV)) {
		response.headers.set('X-Robots-Tag', NOINDEX_VALUE);
	}

	return response;
}
```

- [ ] **Step 6: Verificar que el hook no rompe el build estático**

`hooks.server.js` corre durante el prerender, así que hay que confirmar que el build estático sigue saliendo igual.

```bash
rm -rf build && npm run build && ls build/index.html && echo "ESTATICO OK"
```

Expected: imprime `ESTATICO OK`.

- [ ] **Step 7: Correr la suite completa**

```bash
npm test
```

Expected: `Test Files 12 passed (12)`, `Tests 143 passed (143)`.

- [ ] **Step 8: Commit**

```bash
git add src/lib/server/robotsHeader.js src/lib/server/robotsHeader.test.js src/hooks.server.js
git commit -m "feat: X-Robots-Tag noindex fuera de produccion"
```

---

## Task 5: Script `build:node`

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Agregar el script**

En `"scripts"`, debajo de `"build"`:

```json
		"build:node": "ADAPTER=node vite build && node scripts/prepare-node-build.js",
```

- [ ] **Step 2: Correr el build completo desde cero**

```bash
rm -rf build-node && npm run build:node
```

Expected: termina con dos líneas del tipo:

```
[prepare-node-build] N archivo(s) .php borrados del build.
[prepare-node-build] robots.txt bloqueado (SITE_ENV=sin definir).
```

`N` tiene que ser mayor que cero.

- [ ] **Step 3: Verificar que no quedó ni un php**

```bash
find build-node -name "*.php" | wc -l
```

Expected: `0`.

- [ ] **Step 4: Verificar el robots.txt del build Node**

```bash
cat build-node/client/robots.txt
```

Expected:

```
User-agent: *
Disallow: /
```

- [ ] **Step 5: Verificar que el estático conserva sus php y su robots**

```bash
rm -rf build && npm run build
ls build/assets/send-llamenme.php && cat build/robots.txt
```

Expected: el `.php` existe y el `robots.txt` dice `Allow: /` con la línea del Sitemap. Si acá aparece `Disallow: /`, el script se está aplicando al target equivocado y hay que parar.

- [ ] **Step 6: Commit**

```bash
git add package.json
git commit -m "build: script build:node"
```

---

## Task 6: Verificación integral local

Sin cambios de código. Es el criterio de aceptación del spec, corrido contra el server Node real.

**Files:** ninguno.

- [ ] **Step 1: Buildear y levantar el server**

```bash
npm run build:node
node server.js
```

Expected: queda escuchando (por defecto en `http://localhost:3000`). Dejarlo corriendo en una terminal aparte para los pasos siguientes.

- [ ] **Step 2: Verificar el header noindex**

```bash
curl -sI http://localhost:3000/ | grep -i x-robots-tag
```

Expected: `x-robots-tag: noindex, nofollow`.

- [ ] **Step 3: Verificar que los PHP dan 404 y no código fuente**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/assets/send-llamenme.php
curl -s http://localhost:3000/assets/send-llamenme.php | grep -c "<?php" || echo "0 coincidencias de <?php (correcto)"
```

Expected: `404`, y ninguna coincidencia de `<?php`. **Este es el chequeo más importante de toda la fase.**

- [ ] **Step 4: Verificar que una ruta inexistente da el error page propio**

```bash
curl -s http://localhost:3000/ruta-que-no-existe/ | grep -c "Volver al Inicio"
```

Expected: `1` — es el botón de `src/routes/+error.svelte`, no un stack trace de Node.

- [ ] **Step 5: Verificar el robots servido**

```bash
curl -s http://localhost:3000/robots.txt
```

Expected: `User-agent: *` + `Disallow: /`.

- [ ] **Step 6: Verificar SITE_ENV=production**

Cortar el server y relanzarlo con la variable:

```bash
SITE_ENV=production node server.js
```

En otra terminal:

```bash
curl -sI http://localhost:3000/ | grep -i x-robots-tag || echo "sin header (correcto para production)"
```

Expected: no aparece el header. Cortar el server después de verificar.

- [ ] **Step 7: Revisión visual del sitio**

Levantar `node server.js` y recorrer en el navegador: `/`, `/precios/`, `/elegirplan/`, `/dgo/`, `/tv/`.

Expected: renderizan igual que producción. Los precios y las grillas de canales cargan (vienen de PocketBase, que es una llamada de cliente y no depende del adapter).

Sabido y esperado, **no reportar como bug**: los formularios no funcionan (los `.php` ya no están; se resuelven en Fase 1) y `/lineavip/` e `/internacional/` dan 404 (Fase 2).

- [ ] **Step 8: Confirmar que el deploy estático quedó intacto**

```bash
git status --short deploy.sh static/ && echo "--- sin cambios en deploy estatico ---"
rm -rf build && npm run build && ls build/index.html build/assets/send-llamenme.php
```

Expected: `git status` no lista nada bajo `deploy.sh` ni `static/`, y los dos archivos del build existen.

---

## Task 7: Configuración en hPanel

Manual, en el panel de Hostinger. No hay código.

- [ ] **Step 1: Pushear la rama al remoto**

```bash
git push
```

- [ ] **Step 2: Crear la Web App**

En hPanel → Websites → Add Website → Deploy Web App → conectar el repositorio de GitHub.

- [ ] **Step 3: Configurar build y start**

| Campo | Valor |
|---|---|
| Build command | `npm run build:node` |
| Start command | `node server.js` |
| Node version | 22 |

**El start command es `node server.js`, NO `node build-node/index.js`.** Ese entry propio es el que aplica `X-Robots-Tag` a las páginas prerenderizadas; con el `index.js` de adapter-node, el sitio se sirve sin el header y queda indexable.

**Hostinger autodetecta y suele proponer `npm run build`.** Si queda así, produce el build **estático** y después `node build-node/index.js` falla porque ese directorio no existe. Hay que sobrescribirlo a mano.

- [ ] **Step 4: Setear las variables de entorno**

| Variable | Valor |
|---|---|
| `SITE_ENV` | `beta` |
| `VITE_POCKETBASE_URL` | `https://sista.pockethost.io` |
| `VITE_RECAPTCHA_SITE_KEY` | el valor de `.env` local |
| `VITE_RECAPTCHA_SITE_KEY_BAJA` | el valor de `.env` local |

Las tres `VITE_` tienen fallback hardcodeado en el código, así que la app levanta igual sin ellas — se setean para no depender del fallback. **Ningún secret va todavía**: SMTP, reCAPTCHA secret e IspCube son de Fase 1.

- [ ] **Step 5: Deployar y verificar contra el subdominio**

Repetir los chequeos de la Task 6 contra el subdominio asignado, reemplazando `http://localhost:3000`:

```bash
curl -sI https://TU-SUBDOMINIO.hostingersite.com/ | grep -i x-robots-tag
curl -s -o /dev/null -w "%{http_code}\n" https://TU-SUBDOMINIO.hostingersite.com/assets/send-llamenme.php
curl -s https://TU-SUBDOMINIO.hostingersite.com/robots.txt
```

Expected: header `noindex, nofollow`; `404` en el `.php`; `Disallow: /` en el robots.

- [ ] **Step 6: Recorrido visual en el subdominio**

Mismas rutas que en la Task 6, Step 7.

---

## Al terminar la Fase 0

Queda anotado para más adelante, **no se hace ahora**:

- **Fase 1** — los 8 handlers PHP pasan a endpoints Node. Antes de empezar hay que dar de alta el subdominio en la consola de reCAPTCHA de Google, o todos los formularios van a devolver `message: 'recaptcha'` y va a parecer un bug del código.
- **Fase 4 (cutover)** — `SITE_ENV=production` es **obligatorio** en el dominio real. El default de `shouldBlockIndexing` es bloquear, así que si se olvida, el sitio de producción sale con `noindex` y desaparece de Google. Es la contracara deliberada de tener un default seguro.
