# Fase 1 — Los PHP pasan a endpoints Node: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que los 8 formularios del sitio funcionen en la app Node del subdominio, con los secrets en variables de entorno de hPanel en vez de dentro de `static/`, sin que el build estático de producción pierda sus formularios.

**Architecture:** Tres módulos puros en `src/lib/server/` replican los tres includes PHP (`recaptcha.js`, `mailer.js`, `formHandler.js`). Los módulos **no importan `$env`**: reciben secrets y dependencias por parámetro, así son testeables con Vitest sin módulos virtuales de SvelteKit. Encima, 8 `+server.js` finos en `src/routes/api/` que leen `$env/dynamic/private` y aportan solo su config. Los call sites importan la URL de `src/lib/formEndpoints.js`, que resuelve `/api/...` o `/assets/....php` según el target de build — sin eso el build estático se quedaría sin formularios y se perdería el rollback.

**Tech Stack:** SvelteKit 2.68, adapter-node 5.5.7 / adapter-static 3.0.6, Vite 6, Vitest 4, nodemailer 7, Node 22.

**Spec:** `docs/superpowers/specs/2026-07-28-migracion-adapter-node-hostinger-design.md` (sección "Fase 1")

**Rama:** `fase1-endpoints-node`, creada desde `main` (837515f).

---

## Pre-flight

Baseline al escribir este plan: `npm test` → **12 archivos, 153 tests, todos pasando**. Si al empezar no está verde, parar y avisar.

Restricción dura de toda la fase: **`npm run build` tiene que seguir produciendo el estático de siempre, con sus `.php` intactos**. Producción (`sista.com.ar`, FTP) no se toca. Cada tarea que agrega una ruta bajo `src/routes/api/` verifica los dos builds.

### Dependencia externa que no resuelve este plan

Las site keys de reCAPTCHA están registradas para los dominios de Sista. **Hay que dar de alta `ghostwhite-okapi-714606.hostingersite.com` en la consola de reCAPTCHA de Google** (https://www.google.com/recaptcha/admin) antes de la verificación end-to-end de la Task 14, o *todos* los formularios devuelven `message: 'recaptcha'` y parece un bug del código. Es un paso manual del dueño de la cuenta.

### Diferencia con el spec, ya decidida

- **`form-trabajo` va como `+server.js` con redirect 303, no como form action de SvelteKit.** Un `+page.server.js` con `actions` haría no-prerenderizable a `/trabajaconnosotros2/`, y esa página **desaparecería del build estático** — justo lo que no puede pasar. Un endpoint que responde `redirect(303, '/gracias/')` deja la página 100% prerenderizada y solo cambia el atributo `action` del `<form>`.
- **`send-ticket-ispcube` se porta pero NO se prueba contra producción.** Decisión del usuario: nada de tickets reales en la verificación. La prueba end-to-end la hace él cuando quiera.

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `src/lib/formEndpoints.js` (crear) | Única fuente de las URLs de formulario. Resuelve PHP vs Node por `VITE_FORMS_BACKEND`. |
| `src/lib/formEndpoints.test.js` (crear) | Tests de la resolución. |
| `src/lib/server/recaptcha.js` (crear) | `verifyRecaptcha(token, opts)`. Reemplaza `includes/recaptcha-verify.php`. |
| `src/lib/server/recaptcha.test.js` (crear) | Tests con `fetch` inyectado. |
| `src/lib/server/mailTemplate.js` (crear) | `renderMailTemplate(html, data)` puro. La mitad testeable de `MailHandler::buildHtmlBody`. |
| `src/lib/server/mailTemplate.test.js` (crear) | Tests del render. |
| `src/lib/server/mailer.js` (crear) | Transport nodemailer + `sendMail`. Reemplaza `includes/MailHandler.php`. |
| `src/lib/server/correoTemplate.js` (crear) | Importa `static/assets/correo_template.html` como string en tiempo de build. |
| `src/lib/server/formHandler.js` (crear) | `handleFormSubmission(fields, config, deps)`. Reemplaza `includes/form-handler.php`. |
| `src/lib/server/formHandler.test.js` (crear) | Tests con deps inyectadas. |
| `src/lib/server/pocketbase.js` (crear) | `createRecord(baseUrl, collection, data)`. Lo comparten llamenme y baja. |
| `src/lib/server/pocketbase.test.js` (crear) | Tests con `fetch` inyectado. |
| `src/routes/api/contacto/+server.js` (crear) | Config de Contacto Web. |
| `src/routes/api/empresas/+server.js` (crear) | Config de Empresas. |
| `src/routes/api/modal/+server.js` (crear) | Config del modal de planes. |
| `src/routes/api/llamenme/+server.js` (crear) | Honeypot + PocketBase (fuente de verdad) + mail best-effort. |
| `src/routes/api/baja/+server.js` (crear) | PocketBase `bajas` + mail best-effort. |
| `src/routes/api/email-baja/+server.js` (crear) | Mail HTML propio del flujo de baja guiada. Contrato `{status}`. |
| `src/routes/api/ticket-ispcube/+server.js` (crear) | Alta de ticket en IspCube. Contrato `{status}`. |
| `src/routes/api/trabajo/+server.js` (crear) | Multipart con adjunto de CV + redirect 303. |
| `src/lib/server/ispcube.js` (crear) | Auth + alta de ticket contra IspCube. |
| `src/lib/server/ispcube.test.js` (crear) | Tests con `fetch` inyectado. |
| `svelte.config.js` (modificar) | `strict: false` en adapter-static: hay rutas que no se prerenderizan. |
| `package.json` (modificar) | `nodemailer`, y `VITE_FORMS_BACKEND=node` en `build:node`. |
| 6 call sites (modificar) | Importan la URL de `formEndpoints.js` en vez de hardcodearla. |

---

## Task 1: `formEndpoints.js` y el flag de build

Sin esto, cualquier cambio en un call site rompe producción. Va primero.

**Files:**
- Create: `src/lib/formEndpoints.js`
- Create: `src/lib/formEndpoints.test.js`
- Modify: `package.json`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/formEndpoints.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { resolveFormEndpoints, PHP_ENDPOINTS, NODE_ENDPOINTS } from './formEndpoints.js';

describe('resolveFormEndpoints', () => {
	it('devuelve los .php cuando el backend no es node', () => {
		expect(resolveFormEndpoints(undefined)).toBe(PHP_ENDPOINTS);
		expect(resolveFormEndpoints('')).toBe(PHP_ENDPOINTS);
		expect(resolveFormEndpoints('php')).toBe(PHP_ENDPOINTS);
	});

	it('devuelve los /api cuando el backend es node', () => {
		expect(resolveFormEndpoints('node')).toBe(NODE_ENDPOINTS);
	});

	it('los dos mapas tienen exactamente las mismas claves', () => {
		expect(Object.keys(NODE_ENDPOINTS).sort()).toEqual(Object.keys(PHP_ENDPOINTS).sort());
	});

	it('cubre los 8 formularios', () => {
		expect(Object.keys(PHP_ENDPOINTS).sort()).toEqual([
			'BAJA',
			'CONTACTO',
			'EMAIL_BAJA',
			'EMPRESAS',
			'LLAMENME',
			'MODAL',
			'TICKET_ISPCUBE',
			'TRABAJO'
		]);
	});

	it('las rutas php apuntan a /assets y las node a /api', () => {
		for (const url of Object.values(PHP_ENDPOINTS)) {
			expect(url.startsWith('/assets/')).toBe(true);
			expect(url.endsWith('.php')).toBe(true);
		}
		for (const url of Object.values(NODE_ENDPOINTS)) {
			expect(url.startsWith('/api/')).toBe(true);
		}
	});
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

```bash
npx vitest run src/lib/formEndpoints.test.js
```

Expected: FAIL — no resuelve el import de `./formEndpoints.js`.

- [ ] **Step 3: Implementar el módulo**

Crear `src/lib/formEndpoints.js`:

```js
/**
 * URLs de los formularios, resueltas segun el target de build.
 *
 * El repo produce dos artefactos desde el mismo codigo (ver
 * `docs/superpowers/specs/2026-07-28-migracion-adapter-node-hostinger-design.md`):
 * el estatico que se sube por FTP a sista.com.ar, donde los formularios los
 * atiende Apache+PHP, y la app Node, donde los atiende SvelteKit.
 *
 * Si los call sites apuntaran directo a `/api/...`, el build estatico quedaria
 * llamando rutas que en sista.com.ar no existen: se perderian TODOS los
 * formularios de produccion y con ellos el rollback de la migracion.
 */

/** Handlers PHP en `static/assets/`. Los usa el build estatico. */
export const PHP_ENDPOINTS = Object.freeze({
	LLAMENME: '/assets/send-llamenme.php',
	CONTACTO: '/assets/send-form-contacto.php',
	EMPRESAS: '/assets/send-form-empresas.php',
	MODAL: '/assets/send-form-modal.php',
	BAJA: '/assets/send-form-baja2.php',
	TICKET_ISPCUBE: '/assets/send-ticket-ispcube.php',
	EMAIL_BAJA: '/assets/send-email-baja.php',
	TRABAJO: '/assets/form-trabajo.php'
});

/** Endpoints de SvelteKit. Los usa el build Node. */
export const NODE_ENDPOINTS = Object.freeze({
	LLAMENME: '/api/llamenme',
	CONTACTO: '/api/contacto',
	EMPRESAS: '/api/empresas',
	MODAL: '/api/modal',
	BAJA: '/api/baja',
	TICKET_ISPCUBE: '/api/ticket-ispcube',
	EMAIL_BAJA: '/api/email-baja',
	TRABAJO: '/api/trabajo'
});

/**
 * @param {string | undefined} backend Valor de `VITE_FORMS_BACKEND`
 * @returns {typeof PHP_ENDPOINTS}
 */
export function resolveFormEndpoints(backend) {
	return backend === 'node' ? NODE_ENDPOINTS : PHP_ENDPOINTS;
}

/** Mapa ya resuelto para el build actual. Es lo que importan los componentes. */
export const FORM_ENDPOINTS = resolveFormEndpoints(import.meta.env.VITE_FORMS_BACKEND);
```

- [ ] **Step 4: Correr el test para verificar que pasa**

```bash
npx vitest run src/lib/formEndpoints.test.js
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Activar el flag en el build Node**

En `package.json`, reemplazar la línea del script `build:node` por:

```json
		"build:node": "ADAPTER=node VITE_FORMS_BACKEND=node vite build && node scripts/prepare-node-build.js",
```

- [ ] **Step 6: Verificar que el flag llega al bundle de cada target**

```bash
rm -rf build build-node
npm run build:node > /dev/null 2>&1 && grep -rl "/api/contacto" build-node/client/_app | head -1
npm run build > /dev/null 2>&1 && grep -rl "send-form-contacto.php" build/_app | head -1
```

Expected: la primera línea imprime un archivo de `build-node/client/_app`, la segunda uno de `build/_app`. Todavía ningún componente los usa, así que si no imprimen nada es esperado en este punto — se vuelve a verificar en la Task 6, cuando el primer call site ya importa el módulo. **No bloquear acá.**

- [ ] **Step 7: Correr la suite completa**

```bash
npm test
```

Expected: `Test Files 13 passed (13)`, `Tests 158 passed (158)`.

- [ ] **Step 8: Commit**

```bash
git add src/lib/formEndpoints.js src/lib/formEndpoints.test.js package.json
git commit -m "feat: resolver las urls de formulario segun el target de build"
```

---

## Task 2: Verificación de reCAPTCHA

Puerto de `static/assets/includes/recaptcha-verify.php`. Mismo umbral 0.5, mismos motivos.

**Files:**
- Create: `src/lib/server/recaptcha.js`
- Create: `src/lib/server/recaptcha.test.js`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/server/recaptcha.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { verifyRecaptcha, MIN_SCORE, RECAPTCHA_VERIFY_URL } from './recaptcha.js';

/** fetch falso que responde con el JSON dado. Guarda el body para inspeccionarlo. */
function fakeFetch(json, { calls } = {}) {
	return async (url, init) => {
		calls?.push({ url, init });
		return { ok: true, json: async () => json };
	};
}

describe('verifyRecaptcha', () => {
	it('rechaza un token vacio sin llamar a Google', async () => {
		const calls = [];
		const res = await verifyRecaptcha('', {
			secret: 's3cr3t',
			fetchImpl: fakeFetch({ success: true }, { calls })
		});

		expect(res).toEqual({ ok: false, reason: 'empty', score: null });
		expect(calls).toHaveLength(0);
	});

	it('trata como vacio un token que es solo espacios o no es string', async () => {
		const opts = { secret: 's3cr3t', fetchImpl: fakeFetch({ success: true }) };
		expect((await verifyRecaptcha('   ', opts)).reason).toBe('empty');
		expect((await verifyRecaptcha(null, opts)).reason).toBe('empty');
		expect((await verifyRecaptcha(undefined, opts)).reason).toBe('empty');
	});

	it('falla con reason config si no hay secret', async () => {
		const res = await verifyRecaptcha('tok', {
			secret: '',
			fetchImpl: fakeFetch({ success: true })
		});

		expect(res).toEqual({ ok: false, reason: 'config', score: null });
	});

	it('acepta un token valido con score alto', async () => {
		const res = await verifyRecaptcha('tok', {
			secret: 's3cr3t',
			fetchImpl: fakeFetch({ success: true, score: 0.9 })
		});

		expect(res).toEqual({ ok: true, reason: 'ok', score: 0.9 });
	});

	it('acepta v2 (respuesta sin score)', async () => {
		const res = await verifyRecaptcha('tok', {
			secret: 's3cr3t',
			fetchImpl: fakeFetch({ success: true })
		});

		expect(res).toEqual({ ok: true, reason: 'ok', score: null });
	});

	it('rechaza por score bajo', async () => {
		const res = await verifyRecaptcha('tok', {
			secret: 's3cr3t',
			fetchImpl: fakeFetch({ success: true, score: 0.3 })
		});

		expect(res).toEqual({ ok: false, reason: 'low_score', score: 0.3 });
	});

	it('el umbral exacto pasa', async () => {
		const res = await verifyRecaptcha('tok', {
			secret: 's3cr3t',
			fetchImpl: fakeFetch({ success: true, score: MIN_SCORE })
		});

		expect(res.ok).toBe(true);
	});

	it('rechaza cuando Google dice success false', async () => {
		const res = await verifyRecaptcha('tok', {
			secret: 's3cr3t',
			fetchImpl: fakeFetch({ success: false, 'error-codes': ['timeout-or-duplicate'] })
		});

		expect(res).toEqual({ ok: false, reason: 'failed', score: null });
	});

	it('rechaza una respuesta sin la clave success', async () => {
		const res = await verifyRecaptcha('tok', {
			secret: 's3cr3t',
			fetchImpl: fakeFetch({ cualquier: 'cosa' })
		});

		expect(res).toEqual({ ok: false, reason: 'invalid', score: null });
	});

	it('devuelve network si fetch explota', async () => {
		const res = await verifyRecaptcha('tok', {
			secret: 's3cr3t',
			fetchImpl: async () => {
				throw new Error('ECONNRESET');
			}
		});

		expect(res).toEqual({ ok: false, reason: 'network', score: null });
	});

	it('postea secret, response y remoteip a la url de Google', async () => {
		const calls = [];
		await verifyRecaptcha('tok', {
			secret: 's3cr3t',
			remoteIp: '1.2.3.4',
			fetchImpl: fakeFetch({ success: true, score: 0.9 }, { calls })
		});

		expect(calls[0].url).toBe(RECAPTCHA_VERIFY_URL);
		expect(calls[0].init.method).toBe('POST');
		const body = new URLSearchParams(calls[0].init.body);
		expect(body.get('secret')).toBe('s3cr3t');
		expect(body.get('response')).toBe('tok');
		expect(body.get('remoteip')).toBe('1.2.3.4');
	});

	it('omite remoteip cuando no se conoce la ip', async () => {
		const calls = [];
		await verifyRecaptcha('tok', {
			secret: 's3cr3t',
			fetchImpl: fakeFetch({ success: true, score: 0.9 }, { calls })
		});

		expect(new URLSearchParams(calls[0].init.body).has('remoteip')).toBe(false);
	});
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

```bash
npx vitest run src/lib/server/recaptcha.test.js
```

Expected: FAIL — no resuelve el import de `./recaptcha.js`.

- [ ] **Step 3: Implementar el módulo**

Crear `src/lib/server/recaptcha.js`:

```js
/**
 * Verificacion server-side de reCAPTCHA. Puerto de
 * `static/assets/includes/recaptcha-verify.php`.
 *
 * No lee `$env` a proposito: el secret entra por parametro. Asi el modulo es
 * testeable con Vitest sin los modulos virtuales de SvelteKit, y el punto donde
 * se leen los secrets queda concentrado en los `+server.js`.
 */

export const RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

/** Umbral de la doc oficial de Google para v3. Mismo valor que usaba el PHP. */
export const MIN_SCORE = 0.5;

/**
 * @typedef {{ ok: boolean, reason: string, score: number | null }} RecaptchaResult
 */

/**
 * @param {string | null | undefined} token Token `g-recaptcha-response` del cliente
 * @param {object} options
 * @param {string} options.secret `RECAPTCHA_SECRET_KEY`
 * @param {string | null} [options.remoteIp] IP del visitante, si se conoce
 * @param {typeof fetch} [options.fetchImpl] Inyectable para tests
 * @returns {Promise<RecaptchaResult>}
 */
export async function verifyRecaptcha(token, { secret, remoteIp = null, fetchImpl = fetch }) {
	const clean = typeof token === 'string' ? token.trim() : '';
	if (clean === '') return { ok: false, reason: 'empty', score: null };
	if (!secret) {
		console.error('[recaptcha] RECAPTCHA_SECRET_KEY no configurada');
		return { ok: false, reason: 'config', score: null };
	}

	const body = new URLSearchParams({ secret, response: clean });
	if (remoteIp) body.set('remoteip', remoteIp);

	/** @type {any} */
	let data;
	try {
		const res = await fetchImpl(RECAPTCHA_VERIFY_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: body.toString(),
			signal: AbortSignal.timeout(10_000)
		});
		data = await res.json();
	} catch (error) {
		console.error('[recaptcha] error de red:', error);
		return { ok: false, reason: 'network', score: null };
	}

	if (!data || typeof data.success === 'undefined') {
		console.error('[recaptcha] respuesta invalida:', data);
		return { ok: false, reason: 'invalid', score: null };
	}

	// v2 no devuelve score; en ese caso solo vale `success`.
	const score = typeof data.score === 'number' ? data.score : null;

	if (!data.success) {
		console.error('[recaptcha] rechazado:', data['error-codes']);
		return { ok: false, reason: 'failed', score };
	}
	if (score !== null && score < MIN_SCORE) {
		return { ok: false, reason: 'low_score', score };
	}
	return { ok: true, reason: 'ok', score };
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

```bash
npx vitest run src/lib/server/recaptcha.test.js
```

Expected: PASS, 12 tests.

Nota: el test "rechaza cuando Google dice success false" espera `score: null` porque esa respuesta no trae `score`. Si falla ahí, revisar que el mock no esté agregando score.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/recaptcha.js src/lib/server/recaptcha.test.js
git commit -m "feat: verificacion de recaptcha en node"
```

---

## Task 3: Render del template de mail

La mitad pura de `MailHandler::buildHtmlBody`. Se separa del transporte para poder testear el HTML sin SMTP.

**Files:**
- Create: `src/lib/server/mailTemplate.js`
- Create: `src/lib/server/mailTemplate.test.js`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/server/mailTemplate.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { renderMailTemplate, escapeHtml, labelFor } from './mailTemplate.js';

const TEMPLATE = '<h1>[title]</h1><ul>[data]</ul>';

describe('escapeHtml', () => {
	it('escapa como htmlspecialchars con ENT_QUOTES', () => {
		expect(escapeHtml('<b>&"\'')).toBe('&lt;b&gt;&amp;&quot;&#039;');
	});

	it('escapa el ampersand antes que el resto', () => {
		expect(escapeHtml('&lt;')).toBe('&amp;lt;');
	});

	it('convierte saltos de linea en <br />', () => {
		expect(escapeHtml('a\nb')).toBe('a<br />\nb');
	});
});

describe('labelFor', () => {
	it('reemplaza guiones y guiones bajos por espacios', () => {
		expect(labelFor('fecha_de_alta')).toBe('Fecha de alta');
		expect(labelFor('reply-to')).toBe('Reply to');
	});

	it('deja intacta una etiqueta ya capitalizada', () => {
		expect(labelFor('Nombre')).toBe('Nombre');
	});
});

describe('renderMailTemplate', () => {
	it('reemplaza [title] con el titulo', () => {
		const html = renderMailTemplate(TEMPLATE, { title: 'Contacto Web' });
		expect(html).toContain('<h1>Contacto Web</h1>');
	});

	it('arma un <li> por cada campo, sin incluir title', () => {
		const html = renderMailTemplate(TEMPLATE, {
			title: 'Contacto Web',
			Nombre: 'Ada',
			Contacto: '221-555'
		});

		expect(html).toContain("<li><span class='label'>Nombre:</span><div class='value'>Ada</div></li>");
		expect(html).toContain("<li><span class='label'>Contacto:</span><div class='value'>221-555</div></li>");
		expect(html).not.toContain("<span class='label'>Title:</span>");
	});

	it('omite los campos vacios', () => {
		const html = renderMailTemplate(TEMPLATE, { title: 'X', Nombre: 'Ada', Empresa: '' });
		expect(html).toContain('Ada');
		expect(html).not.toContain('Empresa');
	});

	it('omite null y undefined', () => {
		const html = renderMailTemplate(TEMPLATE, { title: 'X', A: null, B: undefined, C: 'ok' });
		expect(html).not.toContain("<span class='label'>A:</span>");
		expect(html).not.toContain("<span class='label'>B:</span>");
		expect(html).toContain('ok');
	});

	it('escapa el contenido para que no se inyecte html', () => {
		const html = renderMailTemplate(TEMPLATE, {
			title: 'X',
			Mensaje: '<script>alert(1)</script>'
		});

		expect(html).not.toContain('<script>alert(1)</script>');
		expect(html).toContain('&lt;script&gt;');
	});

	it('conserva los saltos de linea de un textarea', () => {
		const html = renderMailTemplate(TEMPLATE, { title: 'X', Mensaje: 'linea1\nlinea2' });
		expect(html).toContain('linea1<br />\nlinea2');
	});

	it('respeta el orden en que vienen los campos', () => {
		const html = renderMailTemplate(TEMPLATE, { title: 'X', Primero: '1', Segundo: '2' });
		expect(html.indexOf('Primero')).toBeLessThan(html.indexOf('Segundo'));
	});

	it('sirve un template sin placeholders sin romperse', () => {
		expect(renderMailTemplate('<p>hola</p>', { title: 'X', A: '1' })).toBe('<p>hola</p>');
	});

	it('cae a un html por defecto si no hay template', () => {
		const html = renderMailTemplate('', { title: 'Aviso', Nombre: 'Ada' });
		expect(html).toContain('<h2>Aviso</h2>');
		expect(html).toContain('<strong>Nombre:</strong> Ada');
	});
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

```bash
npx vitest run src/lib/server/mailTemplate.test.js
```

Expected: FAIL — no resuelve el import de `./mailTemplate.js`.

- [ ] **Step 3: Implementar el módulo**

Crear `src/lib/server/mailTemplate.js`:

```js
/**
 * Render del cuerpo HTML de los mails. Puerto de `MailHandler::buildHtmlBody`
 * de `static/assets/includes/MailHandler.php`.
 *
 * El template (`static/assets/correo_template.html`) tiene dos placeholders:
 * `[title]` y `[data]`. `[data]` se expande a un `<li>` por campo. Se replica el
 * markup exacto que produce el PHP (comillas simples incluidas) para que los
 * mails que llegan no cambien de aspecto durante la migracion.
 */

/**
 * Equivalente a `htmlspecialchars($v, ENT_QUOTES)` + `nl2br()` de PHP.
 *
 * @param {string} value
 * @returns {string}
 */
export function escapeHtml(value) {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#039;')
		.replace(/\r\n|\n\r|\n|\r/g, '<br />\n');
}

/**
 * Equivalente a `ucfirst(str_replace(['_','-'], ' ', $key))`.
 *
 * En la practica las claves ya vienen capitalizadas desde la config de cada
 * formulario ('Nombre', 'Contacto'), asi que casi siempre es identidad. Se
 * replica igual para no cambiar el mail de ningun formulario existente.
 *
 * @param {string} key
 * @returns {string}
 */
export function labelFor(key) {
	const spaced = key.replaceAll('_', ' ').replaceAll('-', ' ');
	return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * @param {Record<string, unknown>} data Campos del mail. `title` es especial.
 * @returns {string}
 */
function buildDefaultBody(data) {
	const { title, ...rest } = data;
	let html = `<h2>${title ?? ''}</h2>`;
	for (const [key, value] of Object.entries(rest)) {
		if (value === null || value === undefined || value === '') continue;
		html += `<p><strong>${labelFor(key)}:</strong> ${value}</p>`;
	}
	return html;
}

/**
 * @param {string} templateHtml Contenido de `correo_template.html`. Vacio = default.
 * @param {Record<string, unknown>} data `title` mas un par label/valor por campo
 * @returns {string}
 */
export function renderMailTemplate(templateHtml, data) {
	if (!templateHtml) return buildDefaultBody(data);

	let body = templateHtml;

	if (body.includes('[data]')) {
		let list = '';
		for (const [key, value] of Object.entries(data)) {
			if (key === 'title') continue;
			if (value === null || value === undefined || value === '') continue;
			list += `<li><span class='label'>${labelFor(key)}:</span><div class='value'>${escapeHtml(
				String(value)
			)}</div></li>\n`;
		}
		body = body.replaceAll('[data]', list);
	}

	for (const [key, value] of Object.entries(data)) {
		body = body.replaceAll(`[${key}]`, value === null || value === undefined ? '' : String(value));
	}

	return body;
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

```bash
npx vitest run src/lib/server/mailTemplate.test.js
```

Expected: PASS, 14 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/mailTemplate.js src/lib/server/mailTemplate.test.js
git commit -m "feat: render del template de mail en node"
```

---

## Task 4: Transporte de mail con nodemailer

**Files:**
- Create: `src/lib/server/correoTemplate.js`
- Create: `src/lib/server/mailer.js`
- Modify: `package.json`

No lleva unit tests: es I/O contra un SMTP real. Se verifica por integración en la Task 13.

- [ ] **Step 1: Instalar nodemailer**

```bash
npm install nodemailer@^7
```

Va como dependencia de producción (no `--save-dev`): la app Node la necesita en runtime.

- [ ] **Step 2: Exponer el template como string de build**

Crear `src/lib/server/correoTemplate.js`:

```js
/**
 * El template de mail vive en `static/assets/correo_template.html` porque lo
 * comparte con los handlers PHP del build estatico. Se importa con `?raw` para
 * que Vite lo inline en el bundle: leerlo del disco en runtime dependeria del
 * cwd del proceso, que en Hostinger no es la raiz del repo.
 */
import templateHtml from '../../../static/assets/correo_template.html?raw';

export { templateHtml };
```

- [ ] **Step 3: Verificar que el import `?raw` funciona**

```bash
npx vite build --outDir /tmp/raw-check 2>&1 | tail -5
```

Expected: el build termina sin errores de resolución. Si Vite se queja de que el archivo está fuera de `src/`, la alternativa es mover el template a `src/lib/server/correo_template.html` y ajustar el import — pero entonces hay que dejar una nota en `static/assets/correo_template.html` avisando que hay dos copias.

Limpiar: `rm -rf /tmp/raw-check`.

- [ ] **Step 4: Implementar el mailer**

Crear `src/lib/server/mailer.js`:

```js
/**
 * Envio de mail. Puerto de `static/assets/includes/MailHandler.php`, que usaba
 * PHPMailer sobre el mismo SMTP.
 *
 * Devuelve el mismo contrato que el PHP (`{success, message, error}`) para que
 * la logica de los 8 formularios no cambie.
 */
import nodemailer from 'nodemailer';

/** Destinatario por defecto, igual que `MailHandler::DEFAULT_RECIPIENT`. */
export const DEFAULT_RECIPIENT = 'info@sista.ar';

/** Nombre del remitente, igual que el `$from_name` del PHP. */
export const FROM_NAME = 'Web';

/**
 * @param {object} config
 * @param {string} config.host
 * @param {number} config.port
 * @param {string} config.user
 * @param {string} config.pass
 */
export function createTransport({ host, port, user, pass }) {
	return nodemailer.createTransport({
		host,
		port,
		// 587 con STARTTLS, igual que `ENCRYPTION_STARTTLS` en el PHP.
		secure: port === 465,
		auth: { user, pass },
		connectionTimeout: 30_000,
		greetingTimeout: 30_000,
		socketTimeout: 30_000
	});
}

/**
 * @param {import('nodemailer').Transporter} transport
 * @param {object} message
 * @param {string} message.from Direccion del remitente (el usuario SMTP)
 * @param {string} [message.to]
 * @param {string} [message.replyTo]
 * @param {string} message.subject
 * @param {string} message.html
 * @param {Array<{filename: string, content: Buffer, contentType?: string}>} [message.attachments]
 * @returns {Promise<{success: boolean, message: string, error?: string}>}
 */
export async function sendMail(transport, message) {
	try {
		await transport.sendMail({
			from: { name: FROM_NAME, address: message.from },
			to: message.to || DEFAULT_RECIPIENT,
			replyTo: message.replyTo || undefined,
			subject: message.subject,
			html: message.html,
			attachments: message.attachments ?? []
		});
		return { success: true, message: 'success' };
	} catch (error) {
		const detail = error instanceof Error ? error.message : String(error);
		console.error('[mailer] fallo el envio:', detail);
		return { success: false, message: 'error', error: detail };
	}
}
```

- [ ] **Step 5: Verificar que la suite sigue verde**

```bash
npm test
```

Expected: `Test Files 15 passed (15)`, `Tests 185 passed (185)`.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/server/mailer.js src/lib/server/correoTemplate.js
git commit -m "feat: mailer con nodemailer sobre el mismo smtp"
```

---

## Task 5: Orquestador de formularios

Puerto de `handle_form_submission()`. Es la pieza que comparten contacto, empresas, modal y trabajo.

**Files:**
- Create: `src/lib/server/formHandler.js`
- Create: `src/lib/server/formHandler.test.js`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/server/formHandler.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { handleFormSubmission } from './formHandler.js';

const CONFIG = {
	subject: 'Contacto Web',
	fields: { nombre: 'Nombre', tel: 'Contacto', mensaje: 'Mensaje' }
};

/** deps con todo en verde. `sent` acumula los mails que se habrian enviado. */
function deps(overrides = {}) {
	const sent = [];
	return {
		sent,
		deps: {
			verifyRecaptcha: async () => ({ ok: true, reason: 'ok', score: 0.9 }),
			sendMail: async (message) => {
				sent.push(message);
				return { success: true, message: 'success' };
			},
			templateHtml: '<h1>[title]</h1><ul>[data]</ul>',
			...overrides
		}
	};
}

describe('handleFormSubmission', () => {
	it('envia el mail y devuelve success cuando todo esta bien', async () => {
		const { sent, deps: d } = deps();
		const res = await handleFormSubmission(
			{ nombre: 'Ada', tel: '221', mensaje: 'hola', 'g-recaptcha-response': 'tok' },
			CONFIG,
			d
		);

		expect(res).toEqual({ success: true, message: 'success' });
		expect(sent).toHaveLength(1);
		expect(sent[0].subject).toBe('Contacto Web');
		expect(sent[0].html).toContain('Ada');
	});

	it('corta con recaptcha si el captcha falla', async () => {
		const { sent, deps: d } = deps({
			verifyRecaptcha: async () => ({ ok: false, reason: 'low_score', score: 0.1 })
		});
		const res = await handleFormSubmission({ nombre: 'Ada', 'g-recaptcha-response': 'tok' }, CONFIG, d);

		expect(res).toEqual({ success: false, message: 'recaptcha', reason: 'low_score' });
		expect(sent).toHaveLength(0);
	});

	it('corta con incompleto y nombra el campo que falta', async () => {
		const { sent, deps: d } = deps();
		const res = await handleFormSubmission(
			{ nombre: 'Ada', tel: '', mensaje: 'hola', 'g-recaptcha-response': 'tok' },
			CONFIG,
			d
		);

		expect(res).toEqual({ success: false, message: 'incompleto', field: 'tel' });
		expect(sent).toHaveLength(0);
	});

	it('corta con incompleto si el campo ni siquiera vino', async () => {
		const { deps: d } = deps();
		const res = await handleFormSubmission({ nombre: 'Ada', 'g-recaptcha-response': 'tok' }, CONFIG, d);

		expect(res.message).toBe('incompleto');
		expect(res.field).toBe('tel');
	});

	it('reporta el primer campo faltante en el orden de la config', async () => {
		const { deps: d } = deps();
		const res = await handleFormSubmission({ 'g-recaptcha-response': 'tok' }, CONFIG, d);

		expect(res.field).toBe('nombre');
	});

	it('acepta vacios en los campos opcionales', async () => {
		const { sent, deps: d } = deps();
		const config = {
			subject: 'Empresas - Contacto web',
			fields: { nombre: 'Nombre', tel: 'Contacto', empresa: 'Empresa', mensaje: 'Mensaje' },
			optional_fields: ['empresa', 'mensaje']
		};
		const res = await handleFormSubmission(
			{ nombre: 'Ada', tel: '221', empresa: '', mensaje: '', 'g-recaptcha-response': 'tok' },
			config,
			d
		);

		expect(res.success).toBe(true);
		expect(sent[0].html).not.toContain('Empresa');
	});

	it('recorta los espacios de los valores', async () => {
		const { sent, deps: d } = deps();
		await handleFormSubmission(
			{ nombre: '  Ada  ', tel: '221', mensaje: 'hola', 'g-recaptcha-response': 'tok' },
			CONFIG,
			d
		);

		expect(sent[0].html).toContain('>Ada<');
	});

	it('usa el destinatario y el reply-to de la config', async () => {
		const { sent, deps: d } = deps();
		await handleFormSubmission(
			{ nombre: 'Ada', tel: '221', mensaje: 'hola', 'g-recaptcha-response': 'tok' },
			{ ...CONFIG, custom_recipient: 'rrhh@sista.ar', reply_to: 'ada@example.com' },
			d
		);

		expect(sent[0].to).toBe('rrhh@sista.ar');
		expect(sent[0].replyTo).toBe('ada@example.com');
	});

	it('pasa los adjuntos al mail', async () => {
		const { sent, deps: d } = deps();
		const attachments = [{ filename: 'cv.pdf', content: Buffer.from('x') }];
		await handleFormSubmission(
			{ nombre: 'Ada', tel: '221', mensaje: 'hola', 'g-recaptcha-response': 'tok' },
			{ ...CONFIG, attachments },
			d
		);

		expect(sent[0].attachments).toBe(attachments);
	});

	it('propaga el error cuando el mail falla', async () => {
		const { deps: d } = deps({
			sendMail: async () => ({ success: false, message: 'error', error: 'SMTP caido' })
		});
		const res = await handleFormSubmission(
			{ nombre: 'Ada', tel: '221', mensaje: 'hola', 'g-recaptcha-response': 'tok' },
			CONFIG,
			d
		);

		expect(res.success).toBe(false);
		expect(res.message).toBe('error');
	});

	it('el titulo del mail es el subject de la config', async () => {
		const { sent, deps: d } = deps();
		await handleFormSubmission(
			{ nombre: 'Ada', tel: '221', mensaje: 'hola', 'g-recaptcha-response': 'tok' },
			CONFIG,
			d
		);

		expect(sent[0].html).toContain('<h1>Contacto Web</h1>');
	});
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

```bash
npx vitest run src/lib/server/formHandler.test.js
```

Expected: FAIL — no resuelve el import de `./formHandler.js`.

- [ ] **Step 3: Implementar el módulo**

Crear `src/lib/server/formHandler.js`:

```js
/**
 * Orquestador de los formularios que solo mandan mail. Puerto de
 * `handle_form_submission()` en `static/assets/includes/form-handler.php`.
 *
 * Orden: reCAPTCHA -> validacion de campos -> mail. El contrato de salida es el
 * mismo que devolvia el PHP (`{success, message}` con `message` en
 * recaptcha / incompleto / error / success), asi que la UI de los formularios
 * no se modifica.
 */
import { renderMailTemplate } from './mailTemplate.js';

/**
 * @typedef {object} FormConfig
 * @property {string} subject Asunto del mail y titulo del template
 * @property {Record<string, string>} fields Mapa `name` del input -> etiqueta del mail
 * @property {string[]} [optional_fields] Campos que pueden venir vacios
 * @property {string} [custom_recipient] Destinatario distinto del default
 * @property {string} [reply_to] Reply-To del mail
 * @property {Array<{filename: string, content: Buffer, contentType?: string}>} [attachments]
 */

/**
 * @param {Record<string, string>} fields Campos crudos del POST
 * @param {FormConfig} config
 * @param {object} deps
 * @param {(token: string) => Promise<{ok: boolean, reason: string, score: number | null}>} deps.verifyRecaptcha
 * @param {(message: object) => Promise<{success: boolean, message: string, error?: string}>} deps.sendMail
 * @param {string} deps.templateHtml
 * @returns {Promise<{success: boolean, message: string, field?: string, reason?: string, error?: string}>}
 */
export async function handleFormSubmission(fields, config, deps) {
	const captcha = await deps.verifyRecaptcha(fields['g-recaptcha-response'] ?? '');
	if (!captcha.ok) {
		return { success: false, message: 'recaptcha', reason: captcha.reason };
	}

	const optional = config.optional_fields ?? [];
	/** @type {Record<string, string>} */
	const data = { title: config.subject };

	for (const [name, label] of Object.entries(config.fields)) {
		const value = typeof fields[name] === 'string' ? fields[name].trim() : '';
		if (value === '' && !optional.includes(name)) {
			return { success: false, message: 'incompleto', field: name };
		}
		data[label] = value;
	}

	return deps.sendMail({
		subject: config.subject,
		html: renderMailTemplate(deps.templateHtml, data),
		to: config.custom_recipient,
		replyTo: config.reply_to,
		attachments: config.attachments
	});
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

```bash
npx vitest run src/lib/server/formHandler.test.js
```

Expected: PASS, 11 tests.

- [ ] **Step 5: Correr la suite completa**

```bash
npm test
```

Expected: `Test Files 16 passed (16)`, `Tests 196 passed (196)`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/formHandler.js src/lib/server/formHandler.test.js
git commit -m "feat: orquestador de formularios en node"
```

---

## Task 6: Primer endpoint (`/api/contacto`) y el ajuste de adapter-static

Esta es la tarea estructuralmente riesgosa: es la primera ruta no prerenderizable del repo. Se hace con el formulario más simple para aislar el problema.

**Files:**
- Create: `src/routes/api/contacto/+server.js`
- Modify: `svelte.config.js`
- Modify: `src/lib/components/forms/Form1.svelte:46`

- [ ] **Step 1: Crear el armador de dependencias compartido**

Los `+server.js` son la única capa que toca `$env/dynamic/private`: leen los secrets y se los pasan a los módulos de `$lib/server/`, que quedan puros. Los 4 endpoints que usan `handleFormSubmission` necesitan exactamente las mismas dependencias, así que se arman en un solo lugar.

Crear `src/lib/server/endpointDeps.js`:

```js
/**
 * Arma las dependencias de `handleFormSubmission` a partir de las variables de
 * entorno. Vive aparte de `formHandler.js` para que ese modulo siga sin
 * importar `$env` y se pueda testear con Vitest.
 */
import { env } from '$env/dynamic/private';
import { verifyRecaptcha } from './recaptcha.js';
import { createTransport, sendMail } from './mailer.js';
import { templateHtml } from './correoTemplate.js';

/** El transport se crea una vez por proceso; nodemailer reusa la conexion. */
let transport;

function getTransport() {
	if (!transport) {
		transport = createTransport({
			host: env.SMTP_HOST || 'smtp.gmail.com',
			port: Number(env.SMTP_PORT || 587),
			user: env.SMTP_USER || '',
			pass: env.SMTP_PASSWORD || ''
		});
	}
	return transport;
}

/** Direccion del remitente: siempre el usuario SMTP autenticado. */
export function fromAddress() {
	return env.SMTP_USER || 'formularios@sista.ar';
}

/**
 * @param {string | null} remoteIp IP del visitante, para reCAPTCHA
 */
export function buildMailDeps(remoteIp) {
	return {
		verifyRecaptcha: (token) =>
			verifyRecaptcha(token, { secret: env.RECAPTCHA_SECRET_KEY || '', remoteIp }),
		sendMail: (message) => sendMail(getTransport(), { from: fromAddress(), ...message }),
		templateHtml
	};
}
```

- [ ] **Step 2: Crear el endpoint**

Crear `src/routes/api/contacto/+server.js`:

```js
/** Reemplazo de `static/assets/send-form-contacto.php`. */
import { json } from '@sveltejs/kit';
import { handleFormSubmission } from '$lib/server/formHandler.js';
import { buildMailDeps } from '$lib/server/endpointDeps.js';

// Tiene POST: no se puede prerenderizar. `trailingSlash: 'ignore'` evita que
// herede el `'always'` del layout raiz y responda 308 en vez de procesar.
export const prerender = false;
export const trailingSlash = 'ignore';

const CONFIG = {
	subject: 'Contacto Web',
	fields: {
		nombre: 'Nombre',
		tel: 'Contacto',
		mensaje: 'Mensaje'
	}
};

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, getClientAddress }) {
	const form = await request.formData();
	/** @type {Record<string, string>} */
	const fields = {};
	for (const [key, value] of form.entries()) {
		if (typeof value === 'string') fields[key] = value;
	}

	return json(await handleFormSubmission(fields, CONFIG, buildMailDeps(getClientAddress())));
}
```

- [ ] **Step 3: Comprobar que el build estático se rompe (y por qué)**

```bash
rm -rf build && npm run build 2>&1 | tail -20
```

Expected: **FALLA**, con un error de adapter-static del tipo `The following routes were marked as prerenderable, but were not prerendered` o `Cannot prerender routes with POST`. Es el problema que arregla el paso siguiente. Si por algún motivo el build pasa, saltear el Step 4 y anotarlo.

- [ ] **Step 4: Permitir rutas no prerenderizadas en el build estático**

En `svelte.config.js`, reemplazar la línea del adapter y su comentario por:

```js
		// Estático, sin `fallback`: las rutas inexistentes las resuelve el
		// servidor con HTTP 404 + `404.html` (ver `static/.htaccess`).
		// En Node, ese 404 lo maneja `src/routes/+error.svelte`.
		//
		// `strict: false` porque desde la Fase 1 el repo tiene rutas que NO se
		// pueden prerenderizar: los `+server.js` de `src/routes/api/`. En el
		// build estático simplemente no se emiten, y los formularios siguen
		// hablando con los `.php` gracias a `src/lib/formEndpoints.js`.
		adapter: useNode ? adapterNode({ out: 'build-node' }) : adapterStatic({ strict: false })
```

- [ ] **Step 5: Verificar que el build estático vuelve a andar y no emitió las rutas api**

```bash
rm -rf build && npm run build > /dev/null && ls build/index.html && ls build/assets/send-form-contacto.php
find build -path "*api/contacto*" | wc -l
```

Expected: los dos `ls` encuentran su archivo y el `find` imprime `0`.

- [ ] **Step 6: Verificar que el build Node sí emite la ruta**

```bash
rm -rf build-node && npm run build:node > /dev/null && grep -rl "Contacto Web" build-node/server | head -1
```

Expected: imprime algún archivo de `build-node/server`.

- [ ] **Step 7: Apuntar el call site al módulo de endpoints**

En `src/lib/components/forms/Form1.svelte`, agregar al bloque `<script>`, debajo del import de `Recaptcha`:

```js
    import { FORM_ENDPOINTS } from '$lib/formEndpoints.js';
```

Y reemplazar la línea 46:

```js
            const response = await fetch('/assets/send-form-contacto.php', {
```

por:

```js
            const response = await fetch(FORM_ENDPOINTS.CONTACTO, {
```

- [ ] **Step 8: Verificar que cada build quedó apuntando a donde corresponde**

```bash
rm -rf build build-node
npm run build > /dev/null && grep -rl "send-form-contacto.php" build/_app | head -1
npm run build:node > /dev/null && grep -rl "/api/contacto" build-node/client/_app | head -1
```

Expected: la primera línea imprime un archivo de `build/_app` (el estático sigue hablando PHP) y la segunda uno de `build-node/client/_app`. **Si el estático quedó con `/api/contacto`, parar: se rompió producción.**

- [ ] **Step 9: Probar el endpoint contra el server Node**

```bash
node --env-file=.env server.js &
sleep 3
curl -s -X POST http://localhost:3000/api/contacto -F "nombre=Test" -F "tel=221" -F "mensaje=hola"
```

Expected: `{"success":false,"message":"recaptcha","reason":"empty"}` — sin token, corta en el captcha. Lo importante es que responde JSON y no un 404 ni un 308.

Cortar el server: `kill %1`.

- [ ] **Step 10: Correr la suite y commitear**

```bash
npm test
```

Expected: `Test Files 16 passed (16)`, `Tests 196 passed (196)`.

```bash
git add svelte.config.js src/routes/api/contacto/+server.js src/lib/server/endpointDeps.js src/lib/components/forms/Form1.svelte
git commit -m "feat: endpoint /api/contacto y adapter-static no estricto"
```

---

## Task 7: `/api/empresas` y `/api/modal`

Mismo molde que contacto, solo cambia la config.

**Files:**
- Create: `src/routes/api/empresas/+server.js`
- Create: `src/routes/api/modal/+server.js`
- Modify: `src/lib/components/forms/Form2.svelte:46`
- Modify: `src/lib/components/layout/Modal.svelte:48`

- [ ] **Step 1: Crear `/api/empresas`**

Crear `src/routes/api/empresas/+server.js`:

```js
/** Reemplazo de `static/assets/send-form-empresas.php`. */
import { json } from '@sveltejs/kit';
import { handleFormSubmission } from '$lib/server/formHandler.js';
import { buildMailDeps } from '$lib/server/endpointDeps.js';

export const prerender = false;
export const trailingSlash = 'ignore';

const CONFIG = {
	subject: 'Empresas - Contacto web',
	fields: {
		nombre: 'Nombre',
		tel: 'Contacto',
		empresa: 'Empresa',
		mensaje: 'Mensaje'
	},
	optional_fields: ['empresa', 'mensaje']
};

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, getClientAddress }) {
	const form = await request.formData();
	/** @type {Record<string, string>} */
	const fields = {};
	for (const [key, value] of form.entries()) {
		if (typeof value === 'string') fields[key] = value;
	}

	return json(await handleFormSubmission(fields, CONFIG, buildMailDeps(getClientAddress())));
}
```

- [ ] **Step 2: Crear `/api/modal`**

Crear `src/routes/api/modal/+server.js`:

```js
/** Reemplazo de `static/assets/send-form-modal.php`. */
import { json } from '@sveltejs/kit';
import { handleFormSubmission } from '$lib/server/formHandler.js';
import { buildMailDeps } from '$lib/server/endpointDeps.js';

export const prerender = false;
export const trailingSlash = 'ignore';

const CONFIG = {
	subject: 'Interesado en servicio - Web',
	fields: {
		nombre: 'Nombre',
		contacto: 'Contacto'
	}
};

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, getClientAddress }) {
	const form = await request.formData();
	/** @type {Record<string, string>} */
	const fields = {};
	for (const [key, value] of form.entries()) {
		if (typeof value === 'string') fields[key] = value;
	}

	return json(await handleFormSubmission(fields, CONFIG, buildMailDeps(getClientAddress())));
}
```

- [ ] **Step 3: Apuntar los dos call sites**

En `src/lib/components/forms/Form2.svelte`, agregar el import debajo del de `Recaptcha`:

```js
    import { FORM_ENDPOINTS } from '$lib/formEndpoints.js';
```

y reemplazar `fetch('/assets/send-form-empresas.php', {` por `fetch(FORM_ENDPOINTS.EMPRESAS, {`.

En `src/lib/components/layout/Modal.svelte`, agregar el import debajo del de `PlanDetails`:

```js
    import { FORM_ENDPOINTS } from '$lib/formEndpoints.js';
```

y reemplazar `fetch('/assets/send-form-modal.php', {` por `fetch(FORM_ENDPOINTS.MODAL, {`.

- [ ] **Step 4: Verificar que no quedó ninguna URL hardcodeada en esos tres archivos**

```bash
grep -n "assets/send-form" src/lib/components/forms/Form1.svelte src/lib/components/forms/Form2.svelte src/lib/components/layout/Modal.svelte | wc -l
```

Expected: `0`.

- [ ] **Step 5: Probar los endpoints**

```bash
node --env-file=.env server.js &
sleep 3
curl -s -X POST http://localhost:3000/api/empresas -F "nombre=Test"
curl -s -X POST http://localhost:3000/api/modal -F "nombre=Test"
kill %1
```

Expected: las dos respuestas son `{"success":false,"message":"recaptcha","reason":"empty"}`.

Ojo: el server hay que rebuildearlo antes (`npm run build:node`) para que tome los endpoints nuevos.

- [ ] **Step 6: Verificar los dos builds**

```bash
rm -rf build build-node
npm run build > /dev/null && ls build/assets/send-form-empresas.php build/assets/send-form-modal.php
npm run build:node > /dev/null && find build-node -name "*.php" | wc -l
```

Expected: los dos `.php` existen en el estático y el `find` imprime `0`.

- [ ] **Step 7: Commit**

```bash
git add src/routes/api/empresas src/routes/api/modal src/lib/components/forms/Form2.svelte src/lib/components/layout/Modal.svelte
git commit -m "feat: endpoints /api/empresas y /api/modal"
```

---

## Task 8: Cliente de PocketBase

Lo comparten llamenme y baja. Se saca a un módulo para no duplicar el manejo de errores.

**Files:**
- Create: `src/lib/server/pocketbase.js`
- Create: `src/lib/server/pocketbase.test.js`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/server/pocketbase.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { createRecord } from './pocketbase.js';

function fakeFetch(response, calls) {
	return async (url, init) => {
		calls?.push({ url, init });
		return response;
	};
}

const OK = { ok: true, status: 200, json: async () => ({ id: 'abc' }), text: async () => '{}' };

describe('createRecord', () => {
	it('postea al endpoint de la coleccion', async () => {
		const calls = [];
		await createRecord('https://sista.pockethost.io', 'quiero_que_me_llamen', { numero: '221' }, {
			fetchImpl: fakeFetch(OK, calls)
		});

		expect(calls[0].url).toBe(
			'https://sista.pockethost.io/api/collections/quiero_que_me_llamen/records'
		);
		expect(calls[0].init.method).toBe('POST');
		expect(JSON.parse(calls[0].init.body)).toEqual({ numero: '221' });
	});

	it('saca la barra final de la base url', async () => {
		const calls = [];
		await createRecord('https://sista.pockethost.io/', 'bajas', {}, {
			fetchImpl: fakeFetch(OK, calls)
		});

		expect(calls[0].url).toBe('https://sista.pockethost.io/api/collections/bajas/records');
	});

	it('devuelve ok true cuando pocketbase acepta', async () => {
		const res = await createRecord('https://pb', 'c', {}, { fetchImpl: fakeFetch(OK) });
		expect(res.ok).toBe(true);
	});

	it('devuelve ok false con el status cuando pocketbase rechaza', async () => {
		const res = await createRecord('https://pb', 'c', {}, {
			fetchImpl: fakeFetch({
				ok: false,
				status: 400,
				text: async () => '{"message":"Failed to create record."}'
			})
		});

		expect(res.ok).toBe(false);
		expect(res.status).toBe(400);
	});

	it('devuelve ok false si la red falla', async () => {
		const res = await createRecord('https://pb', 'c', {}, {
			fetchImpl: async () => {
				throw new Error('ECONNREFUSED');
			}
		});

		expect(res.ok).toBe(false);
		expect(res.status).toBe(0);
	});
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

```bash
npx vitest run src/lib/server/pocketbase.test.js
```

Expected: FAIL — no resuelve el import de `./pocketbase.js`.

- [ ] **Step 3: Implementar el módulo**

Crear `src/lib/server/pocketbase.js`:

```js
/**
 * Alta de registros en PocketBase desde el servidor.
 *
 * Para llamenme y para bajas, PocketBase es la fuente de verdad: si esto falla,
 * el formulario devuelve error aunque el mail hubiera salido. El SDK
 * `pocketbase` no se usa aca porque para un POST suelto alcanza con `fetch` y
 * asi el modulo queda testeable sin mocks del SDK.
 */

/**
 * @param {string} baseUrl URL de PocketBase, con o sin barra final
 * @param {string} collection Nombre de la coleccion
 * @param {Record<string, unknown>} data Cuerpo del registro
 * @param {{ fetchImpl?: typeof fetch }} [options]
 * @returns {Promise<{ok: boolean, status: number, body: string}>}
 */
export async function createRecord(baseUrl, collection, data, { fetchImpl = fetch } = {}) {
	const url = `${baseUrl.replace(/\/+$/, '')}/api/collections/${collection}/records`;

	try {
		const res = await fetchImpl(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(data),
			signal: AbortSignal.timeout(10_000)
		});

		const body = await res.text();
		if (!res.ok) {
			console.error(`[pocketbase] ${collection} respondio ${res.status}: ${body}`);
			return { ok: false, status: res.status, body };
		}
		return { ok: true, status: res.status, body };
	} catch (error) {
		console.error(`[pocketbase] error de red en ${collection}:`, error);
		return { ok: false, status: 0, body: String(error) };
	}
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

```bash
npx vitest run src/lib/server/pocketbase.test.js
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/pocketbase.js src/lib/server/pocketbase.test.js
git commit -m "feat: alta de registros en pocketbase desde el server"
```

---

## Task 9: `/api/llamenme`

El más delicado: PocketBase es la fuente de verdad y el mail es best-effort. Ese orden se respeta tal cual.

**Files:**
- Create: `src/routes/api/llamenme/+server.js`
- Modify: `src/lib/components/home/LlamenmeForm.svelte:71`

- [ ] **Step 1: Crear el endpoint**

Crear `src/routes/api/llamenme/+server.js`:

```js
/**
 * Reemplazo de `static/assets/send-llamenme.php`.
 *
 * Orden deliberado (igual que el PHP): honeypot -> reCAPTCHA -> validacion ->
 * PocketBase -> mail. PocketBase es la FUENTE DE VERDAD del lead: si falla,
 * responde `pb` y el visitante reintenta. El mail es best-effort: si falla, el
 * lead ya quedo guardado y se responde exito igual.
 */
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { verifyRecaptcha } from '$lib/server/recaptcha.js';
import { createRecord } from '$lib/server/pocketbase.js';
import { renderMailTemplate } from '$lib/server/mailTemplate.js';
import { templateHtml } from '$lib/server/correoTemplate.js';
import { buildMailDeps } from '$lib/server/endpointDeps.js';

export const prerender = false;
export const trailingSlash = 'ignore';

/** Destinatario del aviso. Igual que el `setTo` del PHP. */
const RECIPIENT = 'agustin@sista.ar';

/** Preferencia de horario del modal. Cualquier otra cosa se guarda vacia. */
const ALLOWED_EXTRA = ['en_horario', 'manana', 'tarde', 'whatsapp', 'sin_preferencia'];

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, getClientAddress }) {
	const form = await request.formData();
	const get = (name) => {
		const value = form.get(name);
		return typeof value === 'string' ? value.trim() : '';
	};

	// 1. Honeypot: si vino lleno, es bot.
	if (get('website') !== '') {
		return json({ success: false, message: 'spam' });
	}

	// 2. reCAPTCHA.
	const captcha = await verifyRecaptcha(get('g-recaptcha-response'), {
		secret: env.RECAPTCHA_SECRET_KEY || '',
		remoteIp: getClientAddress()
	});
	if (!captcha.ok) {
		return json({ success: false, message: 'recaptcha', reason: captcha.reason });
	}

	// 3. Validacion.
	const numero = get('numero').slice(0, 40);
	if (numero === '') {
		return json({ success: false, message: 'incompleto', field: 'numero' });
	}
	const rawExtra = get('extra');
	const extra = ALLOWED_EXTRA.includes(rawExtra) ? rawExtra : '';

	// 4. PocketBase: fuente de verdad.
	const pbUrl = env.VITE_POCKETBASE_URL || 'https://sista.pockethost.io';
	const record = await createRecord(pbUrl, 'quiero_que_me_llamen', { numero, extra });
	if (!record.ok) {
		return json({ success: false, message: 'pb' });
	}

	// 5. Mail best-effort: el lead ya esta guardado.
	const deps = buildMailDeps(getClientAddress());
	const html = renderMailTemplate(templateHtml, {
		title: 'Quiero que me llamen',
		Numero: numero,
		Preferencia: extra !== '' ? extra : '—'
	});
	const mail = await deps.sendMail({
		subject: 'Quiero que me llamen',
		html,
		to: RECIPIENT
	});
	if (!mail.success) {
		console.error('[llamenme] el mail fallo pero el lead quedo guardado:', mail.error);
	}

	return json({ success: true });
}
```

- [ ] **Step 2: Apuntar el call site**

En `src/lib/components/home/LlamenmeForm.svelte`, agregar el import debajo del de `visibility.js`:

```js
    import { FORM_ENDPOINTS } from '$lib/formEndpoints.js';
```

y reemplazar `fetch('/assets/send-llamenme.php', {` por `fetch(FORM_ENDPOINTS.LLAMENME, {`.

- [ ] **Step 3: Verificar el honeypot y el captcha contra el server**

```bash
npm run build:node > /dev/null
node --env-file=.env server.js &
sleep 3
curl -s -X POST http://localhost:3000/api/llamenme -F "numero=2211234567" -F "website=soy-un-bot"
curl -s -X POST http://localhost:3000/api/llamenme -F "numero=2211234567"
kill %1
```

Expected: la primera responde `{"success":false,"message":"spam"}` y la segunda `{"success":false,"message":"recaptcha","reason":"empty"}`.

**No probar el camino feliz acá**: escribiría un lead falso en la colección de producción. Se hace en la Task 14, desde el navegador y con reCAPTCHA real, y después se borra el registro desde el panel.

- [ ] **Step 4: Correr la suite y commitear**

```bash
npm test
```

Expected: `Test Files 17 passed (17)`, `Tests 201 passed (201)`.

```bash
git add src/routes/api/llamenme src/lib/components/home/LlamenmeForm.svelte
git commit -m "feat: endpoint /api/llamenme"
```

---

## Task 10: `/api/baja`

Mismo patrón que llamenme, contra la colección `bajas`. El campo `data` es un JSON, no columnas sueltas — así quedó cuando se borró la casilla de correo.

**Files:**
- Create: `src/routes/api/baja/+server.js`
- Modify: `src/routes/solicitudbaja/+page.svelte:50`

- [ ] **Step 1: Crear el endpoint**

Crear `src/routes/api/baja/+server.js`:

```js
/**
 * Reemplazo de `static/assets/send-form-baja2.php`.
 *
 * CONTINGENCIA heredada del PHP: la casilla de correo original fue eliminada y
 * el SMTP no autenticaba, asi que la fuente de verdad de las bajas es la
 * coleccion `bajas` de PocketBase y el mail quedo best-effort. Se mantiene ese
 * orden aunque el SMTP hoy funcione: una baja perdida es peor que un mail
 * perdido.
 */
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { verifyRecaptcha } from '$lib/server/recaptcha.js';
import { createRecord } from '$lib/server/pocketbase.js';
import { renderMailTemplate } from '$lib/server/mailTemplate.js';
import { templateHtml } from '$lib/server/correoTemplate.js';
import { buildMailDeps } from '$lib/server/endpointDeps.js';

export const prerender = false;
export const trailingSlash = 'ignore';

const CAMPOS = ['nombre', 'mail', 'tel', 'motivo'];

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, getClientAddress, url }) {
	const form = await request.formData();
	const get = (name) => {
		const value = form.get(name);
		return typeof value === 'string' ? value.trim() : '';
	};

	// 1. reCAPTCHA (bloqueante).
	const captcha = await verifyRecaptcha(get('g-recaptcha-response'), {
		secret: env.RECAPTCHA_SECRET_KEY || '',
		remoteIp: getClientAddress()
	});
	if (!captcha.ok) {
		return json({ success: false, message: 'recaptcha', reason: captcha.reason });
	}

	// 2. Todos los campos son obligatorios.
	/** @type {Record<string, string>} */
	const datos = {};
	for (const campo of CAMPOS) {
		const valor = get(campo);
		if (valor === '') {
			return json({ success: false, message: 'incompleto', field: campo });
		}
		datos[campo] = valor.slice(0, 2000);
	}

	// 3. PocketBase: fuente de verdad.
	const pbUrl = env.VITE_POCKETBASE_URL || 'https://sista.pockethost.io';
	const record = await createRecord(pbUrl, 'bajas', {
		data: { ...datos, origen: url.host, fecha: new Date().toISOString() }
	});
	if (!record.ok) {
		return json({ success: false, message: 'pb' });
	}

	// 4. Mail best-effort.
	const deps = buildMailDeps(getClientAddress());
	const html = renderMailTemplate(templateHtml, {
		title: 'Solicitud de Baja - Web',
		Nombre: datos.nombre,
		Teléfono: datos.tel,
		Email: datos.mail,
		Motivo: datos.motivo
	});
	const mail = await deps.sendMail({ subject: 'Solicitud de Baja - Web', html });
	if (!mail.success) {
		console.error('[baja] el mail fallo pero la baja quedo guardada:', mail.error);
	}

	return json({ success: true });
}
```

- [ ] **Step 2: Apuntar el call site**

En `src/routes/solicitudbaja/+page.svelte`, agregar el import debajo del de `MetaTags`:

```js
    import { FORM_ENDPOINTS } from '$lib/formEndpoints.js';
```

y reemplazar `fetch('/assets/send-form-baja2.php', {` por `fetch(FORM_ENDPOINTS.BAJA, {`.

- [ ] **Step 3: Verificar contra el server**

```bash
npm run build:node > /dev/null
node --env-file=.env server.js &
sleep 3
curl -s -X POST http://localhost:3000/api/baja -F "nombre=Test"
kill %1
```

Expected: `{"success":false,"message":"recaptcha","reason":"empty"}`.

Igual que llamenme: **no probar el camino feliz**, escribiría una baja falsa en producción.

- [ ] **Step 4: Commit**

```bash
git add src/routes/api/baja src/routes/solicitudbaja/+page.svelte
git commit -m "feat: endpoint /api/baja"
```

---

## Task 11: `/api/email-baja`

Del flujo de baja guiada (`solicitudbaja2&np9277zhw`). No usa `formHandler`: tiene su propio HTML y su contrato es `{status}`, no `{success}`.

**Files:**
- Create: `src/lib/server/bajaEmail.js`
- Create: `src/lib/server/bajaEmail.test.js`
- Create: `src/routes/api/email-baja/+server.js`
- Modify: `src/routes/solicitudbaja2&np9277zhw/_components/Paso4.svelte:103`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/server/bajaEmail.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { renderBajaEmail } from './bajaEmail.js';

const DATOS = {
	nro_cliente: '1234',
	dni_cliente: '30111222',
	mensaje_ticket: '<strong>Cliente:</strong> Ada'
};

describe('renderBajaEmail', () => {
	it('incluye el numero de cliente y el dni', () => {
		const html = renderBajaEmail(DATOS);
		expect(html).toContain('1234');
		expect(html).toContain('30111222');
	});

	it('incrusta el mensaje del ticket como html', () => {
		const html = renderBajaEmail(DATOS);
		expect(html).toContain('<strong>Cliente:</strong> Ada');
	});

	it('muestra el bloque de tramite cuando hay numero', () => {
		const html = renderBajaEmail({ ...DATOS, numero_tramite: 'T-99' });
		expect(html).toContain('T-99');
		expect(html).toContain('Número de Trámite Generado');
	});

	it('omite el bloque de tramite cuando no hay numero', () => {
		const html = renderBajaEmail(DATOS);
		expect(html).not.toContain('Número de Trámite Generado');
	});

	it('trata null como ausencia de tramite', () => {
		const html = renderBajaEmail({ ...DATOS, numero_tramite: null });
		expect(html).not.toContain('Número de Trámite Generado');
	});
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

```bash
npx vitest run src/lib/server/bajaEmail.test.js
```

Expected: FAIL — no resuelve el import de `./bajaEmail.js`.

- [ ] **Step 3: Implementar el módulo**

Crear `src/lib/server/bajaEmail.js`:

```js
/**
 * HTML del aviso de baja guiada. Puerto del template embebido en
 * `static/assets/send-email-baja.php`.
 *
 * `mensaje_ticket` llega como HTML armado por el cliente (Paso4.svelte) y se
 * incrusta tal cual, igual que hacia el PHP. No se escapa a proposito: el
 * markup viene del propio frontend, no del visitante.
 */

/**
 * @param {{nro_cliente: string, dni_cliente: string, mensaje_ticket: string, numero_tramite?: string | null}} datos
 * @returns {string}
 */
export function renderBajaEmail({ nro_cliente, dni_cliente, mensaje_ticket, numero_tramite }) {
	const tramite = numero_tramite
		? `
			<div style="background-color:#d4edda;border:1px solid #c3e6cb;padding:15px;border-radius:5px;text-align:center;margin:20px 0;">
				<h3 style="color:#6f42c1;">🎫 Número de Trámite Generado</h3>
				<p style="font-size:24px;font-weight:bold;color:#6f42c1;margin:10px 0;">${numero_tramite}</p>
			</div>`
		: '';

	return `<!DOCTYPE html>
<html lang="es">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title>Nueva Solicitud de Baja de Servicio</title>
</head>
<body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:0;background-color:#f4f4f4;">
	<div style="max-width:600px;margin:0 auto;padding:20px;background-color:#ffffff;">
		<div style="background-color:#6f42c1;color:white;padding:20px;text-align:center;">
			<h1>Nueva Solicitud de Baja de Servicio</h1>
		</div>
		<div style="background-color:#f8f9fa;padding:20px;">
			<div style="margin-bottom:20px;">
				<h3 style="color:#6f42c1;border-bottom:2px solid #6f42c1;padding-bottom:5px;">📋 Información del Cliente</h3>
				<div style="margin-bottom:10px;">
					<span style="font-weight:bold;display:inline-block;width:200px;">Número de Cliente:</span>
					<span>${nro_cliente}</span>
				</div>
				<div style="margin-bottom:10px;">
					<span style="font-weight:bold;display:inline-block;width:200px;">DNI:</span>
					<span>${dni_cliente}</span>
				</div>
			</div>
			<div style="margin-bottom:20px;">
				<h3 style="color:#6f42c1;border-bottom:2px solid #6f42c1;padding-bottom:5px;">📄 Detalles de la Solicitud</h3>
				<div style="background-color:white;padding:15px;border-radius:5px;border-left:4px solid #6f42c1;">
					${mensaje_ticket}
				</div>
			</div>${tramite}
		</div>
	</div>
</body>
</html>`;
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

```bash
npx vitest run src/lib/server/bajaEmail.test.js
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Crear el endpoint**

Crear `src/routes/api/email-baja/+server.js`:

```js
/**
 * Reemplazo de `static/assets/send-email-baja.php`.
 *
 * Contrato distinto al resto: `{status: 'success' | 'error', message}`. Lo
 * consume `solicitudbaja2&np9277zhw/_components/Paso4.svelte`, que ramifica
 * sobre `status`. No se cambia.
 *
 * El PHP usaba `mail()` nativo; aca va por el mismo SMTP que el resto.
 */
import { json } from '@sveltejs/kit';
import { renderBajaEmail } from '$lib/server/bajaEmail.js';
import { buildMailDeps } from '$lib/server/endpointDeps.js';

export const prerender = false;
export const trailingSlash = 'ignore';

const RECIPIENT = 'agustinsander@gmail.com';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, getClientAddress }) {
	/** @type {any} */
	let data;
	try {
		data = await request.json();
	} catch {
		return json({ status: 'error', message: 'Datos no válidos' });
	}
	if (!data || typeof data !== 'object') {
		return json({ status: 'error', message: 'Datos no válidos' });
	}

	const { nro_cliente, dni_cliente, mensaje_ticket, numero_tramite } = data;
	if (!nro_cliente || !dni_cliente || !mensaje_ticket) {
		return json({ status: 'error', message: 'Faltan datos necesarios para el email' });
	}

	const deps = buildMailDeps(getClientAddress());
	const result = await deps.sendMail({
		subject: `Nueva Solicitud de Baja - Cliente: ${nro_cliente}`,
		html: renderBajaEmail({ nro_cliente, dni_cliente, mensaje_ticket, numero_tramite }),
		to: RECIPIENT
	});

	return result.success
		? json({ status: 'success', message: 'Email enviado correctamente' })
		: json({ status: 'error', message: 'Error al enviar el email' });
}
```

- [ ] **Step 6: Apuntar el call site**

En `src/routes/solicitudbaja2&np9277zhw/_components/Paso4.svelte`, agregar al `<script>` debajo del import de `StepButtons`:

```js
import { FORM_ENDPOINTS } from '$lib/formEndpoints.js';
```

y reemplazar las dos líneas del email (102-103):

```js
        console.log('Enviando email a:', '/assets/send-email-baja.php');
        const emailRes = await fetch('/assets/send-email-baja.php', emailOptions);
```

por:

```js
        console.log('Enviando email a:', FORM_ENDPOINTS.EMAIL_BAJA);
        const emailRes = await fetch(FORM_ENDPOINTS.EMAIL_BAJA, emailOptions);
```

- [ ] **Step 7: Probar el endpoint (sí se puede: manda mail a una casilla propia)**

```bash
npm run build:node > /dev/null
node --env-file=.env server.js &
sleep 3
curl -s -X POST http://localhost:3000/api/email-baja \
  -H "Content-Type: application/json" \
  -d '{"nro_cliente":"PRUEBA-MIGRACION","dni_cliente":"00000000","mensaje_ticket":"<strong>Prueba de la migracion a Node</strong>","numero_tramite":"T-TEST"}'
curl -s -X POST http://localhost:3000/api/email-baja -H "Content-Type: application/json" -d '{}'
kill %1
```

Expected: la primera responde `{"status":"success",...}` y llega un mail a `agustinsander@gmail.com` con el número de trámite `T-TEST`. La segunda responde `{"status":"error","message":"Faltan datos necesarios para el email"}`.

Si la primera da `{"status":"error"}`, el problema es SMTP: revisar que `.env` tenga `SMTP_PASSWORD` y que sea una app password de Gmail válida.

- [ ] **Step 8: Correr la suite y commitear**

```bash
npm test
```

Expected: `Test Files 18 passed (18)`, `Tests 206 passed (206)`.

```bash
git add src/lib/server/bajaEmail.js src/lib/server/bajaEmail.test.js src/routes/api/email-baja "src/routes/solicitudbaja2&np9277zhw/_components/Paso4.svelte"
git commit -m "feat: endpoint /api/email-baja"
```

---

## Task 12: `/api/ticket-ispcube`

**No se prueba contra producción**: crea tickets reales. Se porta y se verifica que el código responde bien a los caminos de error.

**Files:**
- Create: `src/lib/server/ispcube.js`
- Create: `src/lib/server/ispcube.test.js`
- Create: `src/routes/api/ticket-ispcube/+server.js`
- Modify: `src/routes/solicitudbaja2&np9277zhw/_components/Paso4.svelte:47`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/server/ispcube.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { getAuthToken, createTicket } from './ispcube.js';

const CONFIG = {
	baseUrl: 'https://sista.ispcube.online',
	username: 'u',
	password: 'p',
	apiKey: 'k',
	clientId: '734'
};

function fakeFetch(responses, calls) {
	let i = 0;
	return async (url, init) => {
		calls?.push({ url, init });
		return responses[Math.min(i++, responses.length - 1)];
	};
}

const res = (status, body) => ({
	ok: status >= 200 && status < 300,
	status,
	text: async () => JSON.stringify(body),
	json: async () => body
});

describe('getAuthToken', () => {
	it('pega al endpoint de sanctum con los headers de la api', async () => {
		const calls = [];
		const token = await getAuthToken(CONFIG, {
			fetchImpl: fakeFetch([res(200, { data: { token: 'tok-123' } })], calls)
		});

		expect(token).toBe('tok-123');
		expect(calls[0].url).toBe('https://sista.ispcube.online/api/sanctum/token');
		expect(calls[0].init.headers['api-key']).toBe('k');
		expect(calls[0].init.headers['client-id']).toBe('734');
		expect(calls[0].init.headers['login-type']).toBe('api');
	});

	it('devuelve null si la respuesta no trae token', async () => {
		const token = await getAuthToken(CONFIG, { fetchImpl: fakeFetch([res(200, { data: {} })]) });
		expect(token).toBeNull();
	});

	it('devuelve null si la red falla', async () => {
		const token = await getAuthToken(CONFIG, {
			fetchImpl: async () => {
				throw new Error('ETIMEDOUT');
			}
		});
		expect(token).toBeNull();
	});
});

describe('createTicket', () => {
	const TICKET = { nro_cliente: '1234', dni_cliente: '30111222', mensaje_ticket: 'texto', form_type: 'baja2' };

	it('postea el ticket con el bearer recibido', async () => {
		const calls = [];
		const out = await createTicket(CONFIG, TICKET, 'bearer-abc', {
			fetchImpl: fakeFetch([res(201, { ticket_id: 7, ticket_number: 'T-7' })], calls)
		});

		expect(calls[0].url).toBe('https://sista.ispcube.online/tickets');
		expect(calls[0].init.headers.Authorization).toBe('Bearer bearer-abc');
		expect(JSON.parse(calls[0].init.body).subject).toBe('Solicitud de Baja - Cliente: 1234');
		expect(out).toEqual({
			status: 'success',
			message: 'Ticket creado exitosamente',
			ticket_id: 7,
			ticket_number: 'T-7'
		});
	});

	it('acepta 200 ademas de 201', async () => {
		const out = await createTicket(CONFIG, TICKET, 'b', { fetchImpl: fakeFetch([res(200, {})]) });
		expect(out.status).toBe('success');
	});

	it('traduce el 401 a error de autenticacion', async () => {
		const out = await createTicket(CONFIG, TICKET, 'b', { fetchImpl: fakeFetch([res(401, {})]) });
		expect(out).toEqual({
			status: 'error',
			message: 'Error de autenticación con la API de IspCube'
		});
	});

	it('traduce el 403 a falta de permisos', async () => {
		const out = await createTicket(CONFIG, TICKET, 'b', { fetchImpl: fakeFetch([res(403, {})]) });
		expect(out.message).toBe('No tiene permisos para crear tickets');
	});

	it('incluye el detalle del 400', async () => {
		const out = await createTicket(CONFIG, TICKET, 'b', {
			fetchImpl: fakeFetch([res(400, { error: 'customer_id invalido' })])
		});
		expect(out.message).toContain('customer_id invalido');
	});

	it('reporta cualquier otro status', async () => {
		const out = await createTicket(CONFIG, TICKET, 'b', { fetchImpl: fakeFetch([res(500, {})]) });
		expect(out.status).toBe('error');
		expect(out.message).toContain('500');
	});

	it('reporta el error de red', async () => {
		const out = await createTicket(CONFIG, TICKET, 'b', {
			fetchImpl: async () => {
				throw new Error('ECONNRESET');
			}
		});
		expect(out.status).toBe('error');
		expect(out.message).toContain('ECONNRESET');
	});
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

```bash
npx vitest run src/lib/server/ispcube.test.js
```

Expected: FAIL — no resuelve el import de `./ispcube.js`.

- [ ] **Step 3: Implementar el módulo**

Crear `src/lib/server/ispcube.js`:

```js
/**
 * Alta de tickets en IspCube. Puerto de
 * `static/assets/send-ticket-ispcube.php`.
 *
 * OJO: esto crea tickets REALES en el IspCube de produccion. No dispararlo
 * desde una verificacion automatica.
 */

/**
 * @typedef {object} IspcubeConfig
 * @property {string} baseUrl
 * @property {string} username
 * @property {string} password
 * @property {string} apiKey
 * @property {string} clientId
 */

/** @param {IspcubeConfig} config */
function apiHeaders({ apiKey, clientId }) {
	return {
		'Content-Type': 'application/json',
		Accept: 'application/json',
		'api-key': apiKey,
		'client-id': clientId
	};
}

/**
 * @param {IspcubeConfig} config
 * @param {{ fetchImpl?: typeof fetch }} [options]
 * @returns {Promise<string | null>}
 */
export async function getAuthToken(config, { fetchImpl = fetch } = {}) {
	const url = `${config.baseUrl.replace(/\/+$/, '')}/api/sanctum/token`;
	try {
		const res = await fetchImpl(url, {
			method: 'POST',
			headers: { ...apiHeaders(config), 'login-type': 'api' },
			body: JSON.stringify({ username: config.username, password: config.password }),
			signal: AbortSignal.timeout(30_000)
		});
		const data = await res.json();
		return data?.data?.token ?? null;
	} catch (error) {
		console.error('[ispcube] fallo la autenticacion:', error);
		return null;
	}
}

/**
 * @param {IspcubeConfig} config
 * @param {{nro_cliente: string, dni_cliente: string, mensaje_ticket: string, form_type?: string}} datos
 * @param {string} bearerToken
 * @param {{ fetchImpl?: typeof fetch }} [options]
 * @returns {Promise<{status: string, message: string, ticket_id?: unknown, ticket_number?: unknown}>}
 */
export async function createTicket(config, datos, bearerToken, { fetchImpl = fetch } = {}) {
	const url = `${config.baseUrl.replace(/\/+$/, '')}/tickets`;
	const payload = {
		subject: `Solicitud de Baja - Cliente: ${datos.nro_cliente}`,
		description: datos.mensaje_ticket,
		customer_id: datos.nro_cliente,
		customer_dni: datos.dni_cliente,
		form_type: datos.form_type
	};

	/** @type {Response} */
	let res;
	/** @type {any} */
	let body;
	try {
		res = await fetchImpl(url, {
			method: 'POST',
			headers: { ...apiHeaders(config), Authorization: `Bearer ${bearerToken}` },
			body: JSON.stringify(payload),
			signal: AbortSignal.timeout(30_000)
		});
		const raw = await res.text();
		try {
			body = JSON.parse(raw);
		} catch {
			body = {};
		}
	} catch (error) {
		const detail = error instanceof Error ? error.message : String(error);
		return { status: 'error', message: `Error en la solicitud a la API de IspCube: ${detail}` };
	}

	switch (res.status) {
		case 200:
		case 201:
			return {
				status: 'success',
				message: 'Ticket creado exitosamente',
				ticket_id: body?.ticket_id ?? null,
				ticket_number: body?.ticket_number ?? null
			};
		case 400:
			return {
				status: 'error',
				message: `Error en los datos enviados: ${body?.error ?? 'Error desconocido'}`
			};
		case 401:
			return { status: 'error', message: 'Error de autenticación con la API de IspCube' };
		case 403:
			return { status: 'error', message: 'No tiene permisos para crear tickets' };
		case 422:
			return {
				status: 'error',
				message: `Datos de validación incorrectos: ${body?.errors ?? 'Error de validación'}`
			};
		default:
			return { status: 'error', message: `Error inesperado de la API: ${res.status}` };
	}
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

```bash
npx vitest run src/lib/server/ispcube.test.js
```

Expected: PASS, 11 tests.

- [ ] **Step 5: Crear el endpoint**

Crear `src/routes/api/ticket-ispcube/+server.js`:

```js
/**
 * Reemplazo de `static/assets/send-ticket-ispcube.php`.
 *
 * Contrato `{status}`, como el PHP: lo consume Paso4.svelte.
 *
 * ATENCION: crea tickets REALES en el IspCube de produccion.
 */
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { getAuthToken, createTicket } from '$lib/server/ispcube.js';

export const prerender = false;
export const trailingSlash = 'ignore';

function config() {
	return {
		baseUrl: env.ISPCUBE_API_URL || 'https://sista.ispcube.online',
		username: env.ISPCUBE_USERNAME || '',
		password: env.ISPCUBE_PASSWORD || '',
		apiKey: env.ISPCUBE_API_KEY || '',
		clientId: env.ISPCUBE_CLIENT_ID || '734'
	};
}

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
	/** @type {any} */
	let data;
	try {
		data = await request.json();
	} catch {
		return json({ status: 'error', message: 'Datos no válidos' });
	}
	if (!data || typeof data !== 'object') {
		return json({ status: 'error', message: 'Datos no válidos' });
	}

	const { nro_cliente, dni_cliente, mensaje_ticket, form_type, bearer_token } = data;
	if (!nro_cliente || !dni_cliente || !mensaje_ticket) {
		return json({ status: 'error', message: 'Faltan datos necesarios' });
	}

	const cfg = config();
	const token = bearer_token || (await getAuthToken(cfg));
	if (!token) {
		return json({ status: 'error', message: 'Error al obtener token de autenticación' });
	}

	return json(
		await createTicket(cfg, { nro_cliente, dni_cliente, mensaje_ticket, form_type }, token)
	);
}
```

- [ ] **Step 6: Apuntar el call site**

En `src/routes/solicitudbaja2&np9277zhw/_components/Paso4.svelte`, reemplazar las líneas 46-47:

```js
        console.log('Enviando solicitud a:', '/assets/send-ticket-ispcube.php');
        const res = await fetch('/assets/send-ticket-ispcube.php',options);
```

por:

```js
        console.log('Enviando solicitud a:', FORM_ENDPOINTS.TICKET_ISPCUBE);
        const res = await fetch(FORM_ENDPOINTS.TICKET_ISPCUBE, options);
```

(el import de `FORM_ENDPOINTS` ya lo agregó la Task 11).

- [ ] **Step 7: Verificar solo el camino de validación**

```bash
npm run build:node > /dev/null
node --env-file=.env server.js &
sleep 3
curl -s -X POST http://localhost:3000/api/ticket-ispcube -H "Content-Type: application/json" -d '{}'
kill %1
```

Expected: `{"status":"error","message":"Faltan datos necesarios"}`.

**No mandar un payload completo**: crearía un ticket real. El camino feliz lo prueba el usuario cuando quiera, sabiendo que después hay que cerrar el ticket.

- [ ] **Step 8: Correr la suite y commitear**

```bash
npm test
```

Expected: `Test Files 19 passed (19)`, `Tests 217 passed (217)`.

```bash
git add src/lib/server/ispcube.js src/lib/server/ispcube.test.js src/routes/api/ticket-ispcube "src/routes/solicitudbaja2&np9277zhw/_components/Paso4.svelte"
git commit -m "feat: endpoint /api/ticket-ispcube"
```

---

## Task 13: `/api/trabajo`

El único con `multipart/form-data`, adjunto de CV y navegación por redirect en vez de JSON.

**Files:**
- Create: `src/routes/api/trabajo/+server.js`
- Modify: `src/routes/trabajaconnosotros2/+page.svelte:40`

- [ ] **Step 1: Crear el endpoint**

Crear `src/routes/api/trabajo/+server.js`:

```js
/**
 * Reemplazo de `static/assets/form-trabajo.php`.
 *
 * Es el unico formulario que NO usa `fetch`: es un `<form action>` nativo. Por
 * eso responde con un redirect 303 en vez de JSON — el navegador navega solo a
 * `/gracias/` o `/error-form/`.
 *
 * Va como `+server.js` y no como form action de SvelteKit a proposito: un
 * `+page.server.js` con `actions` haria no-prerenderizable a
 * `/trabajaconnosotros2/`, y esa pagina desapareceria del build estatico que se
 * sube a produccion.
 */
import { redirect } from '@sveltejs/kit';
import { handleFormSubmission } from '$lib/server/formHandler.js';
import { buildMailDeps } from '$lib/server/endpointDeps.js';

export const prerender = false;
export const trailingSlash = 'ignore';

/** Limite de adjunto que anuncia el formulario ("no supere los 5mb"). */
const MAX_CV_BYTES = 5 * 1024 * 1024;

const RECIPIENT = 'agustinsander@gmail.com';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, getClientAddress }) {
	const form = await request.formData();

	/** @type {Record<string, string>} */
	const fields = {};
	for (const [key, value] of form.entries()) {
		if (typeof value === 'string') fields[key] = value;
	}

	/** @type {Array<{filename: string, content: Buffer, contentType?: string}>} */
	const attachments = [];
	const cv = form.get('curriculum');
	if (cv && typeof cv !== 'string' && cv.size > 0) {
		if (cv.size > MAX_CV_BYTES) {
			console.error(`[trabajo] CV rechazado por tamaño: ${cv.size} bytes`);
			redirect(303, '/error-form/');
		}
		attachments.push({
			filename: cv.name,
			content: Buffer.from(await cv.arrayBuffer()),
			contentType: cv.type || 'application/octet-stream'
		});
	}

	const config = {
		subject: `Nueva postulación - ${fields.apellido ?? ''}`,
		fields: {
			nombre: 'Nombre',
			apellido: 'Apellido',
			dni: 'DNI',
			nacimiento: 'Fecha de Nacimiento',
			telefono: 'Teléfono',
			mail: 'Email',
			puesto: 'Puesto',
			secundario: 'Secundario',
			formacion: 'Formación Adicional',
			experiencia: 'Experiencia Laboral'
		},
		attachments,
		custom_recipient: RECIPIENT,
		reply_to: fields.mail || undefined
	};

	const result = await handleFormSubmission(fields, config, buildMailDeps(getClientAddress()));

	if (!result.success) {
		console.error('[trabajo] postulacion rechazada:', result.message, result.field ?? '');
		redirect(303, '/error-form/');
	}
	redirect(303, '/gracias/');
}
```

- [ ] **Step 2: Apuntar el `action` del formulario**

En `src/routes/trabajaconnosotros2/+page.svelte`, agregar al `<script>` debajo del import de `MetaTags`:

```js
import { FORM_ENDPOINTS } from '$lib/formEndpoints.js';
```

y reemplazar la línea 40:

```svelte
    <form action="/assets/form-trabajo.php" method="POST" enctype="multipart/form-data">
```

por:

```svelte
    <form action={FORM_ENDPOINTS.TRABAJO} method="POST" enctype="multipart/form-data">
```

- [ ] **Step 3: Verificar el redirect de error (sin captcha)**

```bash
npm run build:node > /dev/null
node --env-file=.env server.js &
sleep 3
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" -X POST http://localhost:3000/api/trabajo -F "nombre=Test"
kill %1
```

Expected: `303 http://localhost:3000/error-form/` — sin token de captcha, `handleFormSubmission` devuelve `recaptcha` y el endpoint redirige al error.

- [ ] **Step 4: Verificar que ya no queda ningún `.php` referenciado desde `src/`**

```bash
grep -rn "assets/.*\.php" src/ | grep -v formEndpoints.js | grep -v "^src/routes/admin.*//" | wc -l
```

Expected: `0`. La única mención permitida es la del propio `formEndpoints.js` (y comentarios en `llamenmeLogic.js`, que no son código).

- [ ] **Step 5: Correr la suite y commitear**

```bash
npm test
```

Expected: `Test Files 19 passed (19)`, `Tests 217 passed (217)`.

```bash
git add src/routes/api/trabajo src/routes/trabajaconnosotros2/+page.svelte
git commit -m "feat: endpoint /api/trabajo con adjunto de cv"
```

---

## Task 14: Verificación integral local

Sin cambios de código. Es el criterio de aceptación del spec corrido contra el server Node real.

**Files:** ninguno.

- [ ] **Step 1: Confirmar que ningún secret quedó en el bundle del cliente**

```bash
rm -rf build-node && npm run build:node > /dev/null
grep -rlE "RECAPTCHA_SECRET|SMTP_PASSWORD|ISPCUBE_PASSWORD|ISPCUBE_API_KEY" build-node/client | wc -l
```

Expected: `0`. **Este es el chequeo más importante de la fase.** Si imprime algo distinto de cero, parar: un secret se filtró al cliente.

También, con los valores reales:

```bash
node -e '
const fs=require("fs"),path=require("path");
const env=Object.fromEntries(fs.readFileSync(".env","utf8").split("\n")
  .filter(l=>l.includes("=")&&!l.trim().startsWith("#"))
  .map(l=>l.split("=").map(s=>s.trim())).map(([k,...v])=>[k,v.join("=")]));
const secrets=["SMTP_PASSWORD","RECAPTCHA_SECRET_KEY","ISPCUBE_PASSWORD","ISPCUBE_API_KEY","ISPCUBE_USERNAME"]
  .map(k=>env[k]).filter(v=>v&&v.length>6);
let hits=0;
(function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);
  if(e.isDirectory())walk(p);else{const c=fs.readFileSync(p,"utf8");
  for(const s of secrets)if(c.includes(s)){console.log("FILTRADO en",p);hits++;}}}})("build-node/client");
console.log(hits===0?"OK: ningun secret en el cliente":"PARAR: "+hits+" filtraciones");
'
```

Expected: `OK: ningun secret en el cliente`.

- [ ] **Step 2: Confirmar que el build estático quedó intacto**

```bash
rm -rf build && npm run build > /dev/null
ls build/index.html build/assets/send-llamenme.php build/assets/send-form-contacto.php build/trabajaconnosotros2/index.html
cat build/robots.txt | head -2
git status --short deploy.sh static/
```

Expected: los cuatro archivos existen, el `robots.txt` dice `Allow: /`, y `git status` no lista nada. **Si falta `build/trabajaconnosotros2/index.html`, se rompió el prerender de esa página y hay que parar.**

- [ ] **Step 3: Confirmar que el build estático sigue apuntando a los PHP**

```bash
grep -rl "send-llamenme.php" build/_app | head -1
grep -rl "/api/llamenme" build/_app | wc -l
```

Expected: la primera línea imprime un archivo; la segunda imprime `0`.

- [ ] **Step 4: Levantar el server Node y verificar que los 8 endpoints existen**

```bash
npm run build:node > /dev/null
node --env-file=.env server.js &
sleep 3
for e in contacto empresas modal llamenme baja email-baja ticket-ispcube trabajo; do
  printf "%-16s %s\n" "$e" "$(curl -s -o /dev/null -w '%{http_code}' -X POST http://localhost:3000/api/$e)"
done
```

Expected: ninguno devuelve `404` ni `308`. `trabajo` devuelve `303`; los otros siete `200` (con un JSON de error adentro, que es lo correcto sin captcha).

- [ ] **Step 5: Verificar que los PHP siguen dando 404 en Node**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/assets/send-llamenme.php
curl -s http://localhost:3000/assets/send-llamenme.php | grep -c "<?php" || echo "0 coincidencias de <?php (correcto)"
```

Expected: `404` y ninguna coincidencia de `<?php`.

- [ ] **Step 6: Verificar que el noindex de la Fase 0 sigue puesto**

```bash
curl -sI http://localhost:3000/ | grep -i x-robots-tag
```

Expected: `x-robots-tag: noindex, nofollow`.

Cortar el server: `kill %1`.

- [ ] **Step 7: Prueba de mail end-to-end**

Con el server levantado, mandar el mail de prueba del flujo de baja (es el único que se puede disparar sin efectos en producción):

```bash
node --env-file=.env server.js &
sleep 3
curl -s -X POST http://localhost:3000/api/email-baja -H "Content-Type: application/json" \
  -d '{"nro_cliente":"PRUEBA-FASE1","dni_cliente":"00000000","mensaje_ticket":"<strong>Verificacion de la Fase 1</strong>"}'
kill %1
```

Expected: `{"status":"success",...}` y el mail llega. Confirmar que **llegó de verdad** revisando `agustinsander@gmail.com` — un `success` acá solo dice que el SMTP aceptó el mensaje.

- [ ] **Step 8: Commit del estado verificado (si hubo ajustes)**

Si los pasos anteriores obligaron a tocar algo:

```bash
git add -A && git commit -m "fix: ajustes de la verificacion integral de fase 1"
```

Si no hubo cambios, seguir.

---

## Task 15: Deploy y verificación en el subdominio

Manual, en hPanel. No hay código.

**App:** `ghostwhite-okapi-714606.hostingersite.com` (usuario `u784612252`).

- [ ] **Step 1: Dar de alta el subdominio en reCAPTCHA**

En https://www.google.com/recaptcha/admin, agregar `ghostwhite-okapi-714606.hostingersite.com` a los dominios de **las dos** site keys (`VITE_RECAPTCHA_SITE_KEY` y `VITE_RECAPTCHA_SITE_KEY_BAJA`).

**Sin esto, los 8 formularios devuelven `message: 'recaptcha'` en el subdominio y parece un bug del código.** Es un paso del dueño de la cuenta de Google.

- [ ] **Step 2: Pushear la rama**

```bash
git push -u origin fase1-endpoints-node
```

- [ ] **Step 3: Cargar los secrets en hPanel**

hPanel → la web app → Environment Variables. Agregar, con los valores del `.env` local:

| Variable | Origen |
|---|---|
| `SMTP_HOST` | `.env` |
| `SMTP_PORT` | `.env` |
| `SMTP_USER` | `.env` |
| `SMTP_PASSWORD` | `.env` |
| `RECAPTCHA_SECRET_KEY` | `.env` |
| `ISPCUBE_API_URL` | `.env` |
| `ISPCUBE_USERNAME` | `.env` |
| `ISPCUBE_PASSWORD` | `.env` |
| `ISPCUBE_API_KEY` | `.env` |
| `ISPCUBE_CLIENT_ID` | `.env` |

`SITE_ENV=beta` y las tres `VITE_` ya están de la Fase 0. **No hay endpoint de API para variables de entorno: esto es sí o sí por hPanel.**

- [ ] **Step 4: Disparar el build desde la rama**

Si hPanel está conectado a `main`, apuntarlo a `fase1-endpoints-node` o mergear primero. La config de build no cambia respecto de la Fase 0: `build_script: build:node`, `output_directory: build-node`, `entry_file: server.js`, Node 24.

Verificar el estado:

```bash
curl -s -H "Authorization: Bearer $HOSTINGER_API_TOKEN" \
  "https://developers.hostinger.com/api/hosting/v1/accounts/u784612252/websites/ghostwhite-okapi-714606.hostingersite.com/nodejs/builds?per_page=1"
```

Expected: el build más reciente en `state: completed`.

- [ ] **Step 5: Verificar los endpoints en el subdominio**

```bash
BASE=https://ghostwhite-okapi-714606.hostingersite.com
for e in contacto empresas modal llamenme baja email-baja ticket-ispcube; do
  printf "%-16s %s\n" "$e" "$(curl -s -X POST $BASE/api/$e)"
done
curl -s -o /dev/null -w "trabajo %{http_code}\n" -X POST $BASE/api/trabajo
```

Expected: los que usan FormData responden `{"success":false,"message":"recaptcha","reason":"empty"}`; `email-baja` y `ticket-ispcube` responden `{"status":"error",...}` por falta de datos; `trabajo` devuelve `303`.

- [ ] **Step 6: Verificar que los PHP siguen sin filtrarse**

```bash
curl -s -o /dev/null -w "%{http_code}\n" $BASE/assets/send-llamenme.php
curl -sI $BASE/ | grep -i x-robots-tag
```

Expected: `404` y `x-robots-tag: noindex, nofollow`.

- [ ] **Step 7: Prueba real desde el navegador**

En el subdominio, con reCAPTCHA ya habilitado (Step 1):

1. **Contacto** (`/contacto/`) → enviar → tiene que navegar a `/gracias/` y llegar el mail a `info@sista.ar`.
2. **Modal de planes** (`/precios/`, abrir un plan) → enviar → `/gracias/` + mail.
3. **Empresas** (`/empresas/`) → enviar dejando Empresa y Mensaje vacíos → tiene que aceptar igual (son opcionales) → `/gracias/` + mail.
4. **Llamenme** (home) → enviar un número de prueba → mensaje de éxito, registro nuevo en la colección `quiero_que_me_llamen` y mail a `agustin@sista.ar`. **Borrar el registro de prueba desde `/admin` al terminar.**
5. **Solicitud de baja** (`/solicitudbaja/`) → enviar → `/gracias/`, registro en la colección `bajas`. **Borrar el registro de prueba.**
6. **Trabajá con nosotros** (`/trabajaconnosotros2/`) → completar con un PDF chico → tiene que navegar a `/gracias/` y llegar el mail con el CV adjunto a `agustinsander@gmail.com`.

Nota conocida sobre el punto 6: `/trabajaconnosotros2/` usa reCAPTCHA **Enterprise** (`enterprise.js`) con la site key de baja, y el `sitekey` del `<script>` en `svelte:head` está escrito como `'{recaptchaSiteKeyBaja}'` — Svelte **no interpola dentro de un `<script>`**, así que ahí va el literal. Si el widget no renderiza, es ese bug, preexistente y ajeno a esta migración: anotarlo y tratarlo aparte, no meterlo en esta fase.

7. **Baja guiada** (`/solicitudbaja2&np9277zhw/`) → **solo si el usuario decide probarlo**: crea un ticket real en IspCube. Queda a su criterio.

- [ ] **Step 8: Verificar que producción no se movió**

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://www.sista.com.ar/assets/send-llamenme.php
curl -s https://www.sista.com.ar/robots.txt | head -2
```

Expected: el `.php` responde `200` (Apache lo ejecuta; devuelve JSON de error por falta de captcha, no código fuente) y el `robots.txt` dice `Allow: /`. Producción sigue exactamente como estaba: en toda la fase no se subió nada por FTP.

---

## Al terminar la Fase 1

Queda anotado, **no se hace ahora**:

- **Fase 2 — proxies de telefonía.** `/lineavip/` e `/internacional/` siguen dando 404 en el subdominio. Ojo con preservar el `arrayBuffer` crudo: `decodeLineaVipHtml` decodifica el charset a mano.
- **Borrar los `.php` de `static/`.** Recién cuando el dominio real esté servido por Node (Fase 4). Hasta entonces son los que hacen andar los formularios de producción.
- **El bug del sitekey en `/trabajaconnosotros2/`** (interpolación dentro de `<script>` en `svelte:head`), si el Step 7.6 lo confirma.
- **`RECAPTCHA_ENTERPRISE_API_KEY`** está en `.env` y no la usa nadie en el código portado. Revisar si hace falta para las site keys Enterprise o si es residuo.
