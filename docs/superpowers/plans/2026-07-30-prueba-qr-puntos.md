# Prueba de QR para la plataforma de puntos: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que al escanear con la cámara del celular un QR del cliente 003566 aparezca una pantalla que dice "Sumar puntos a Talone Sandra Elizabeth" con un botón.

**Architecture:** Un módulo puro `ispcube.js` que habla con la API (recibe credenciales y `fetch` por parámetro, testeable con Vitest), un `ispcubeDeps.js` que es la única capa que lee `$env`, y una ruta `/puntos/[nro]` con `+page.server.js` que los usa. Es la misma separación que la Fase 1 ya estableció en `src/lib/server/`.

**Tech Stack:** SvelteKit 2.9 con runes de Svelte 5, adapter-node 5.5.7 / adapter-static 3.0.6, Vite 6, Vitest 4, Node 22, `qrcode` 1.5.

**Spec:** `docs/superpowers/specs/2026-07-30-prueba-qr-puntos-design.md`

**Rama:** `prueba-qr-puntos`, creada desde `fase1-endpoints-node`.

---

## Pre-flight

Baseline al crear la rama: `npm test` → **17 archivos, 208 tests, todos pasando**. Si al empezar no está verde, parar y avisar.

> **La Fase 1 avanza en paralelo sobre `fase1-endpoints-node`.** Este plan se escribió con un baseline de 16/202 y la rama se creó unos commits después, ya con `/api/empresas`, `/api/modal` y `pocketbase.js` adentro. Si los conteos de tests no dan exactos, **verificar de dónde salió la diferencia antes de asumir que está mal**: lo más probable es que la rama base haya avanzado otra vez.
>
> Además, `src/routes/api/llamenme/+server.js` puede aparecer **sin trackear** en el working tree: es trabajo en vuelo de la otra sesión y sigue al usuario entre ramas. **Nunca usar `git add -A` en este plan** — todos los commits van con rutas explícitas.

### Cosas que YA están hechas y no hay que rehacer

- **`svelte.config.js` con `strict: false`** (commit `268ba1b`). Sin eso `npm run build` fallaría al agregar la primera ruta no prerenderizable — que es justo la de este plan. Ya está en la rama base. **No tocar el archivo.**
- **El `noindex` del subdominio.** `server.js` y `src/hooks.server.js` ponen `X-Robots-Tag: noindex, nofollow` en todo mientras `SITE_ENV !== 'production'`. La página nueva lo hereda sin código propio.
- **Las variables `ISPCUBE_*` en el `.env` local.** Ya tienen valores reales.

### Dos trampas verificadas del entorno

1. **No sondear la API con `set -a && . ./.env`.** El `ISPCUBE_PASSWORD` tiene un carácter que rompe el parser del shell: se come las líneas siguientes y `ISPCUBE_API_KEY` queda vacía, con lo que la API responde `api-key header requerido` y parece un problema de credenciales. **`node --env-file=.env` sí lo parsea bien** (verificado: `KEYLEN=36`, `PASSLEN=24`). Usar Node o Python, nunca `source`.
2. **`src/routes/+layout.js` fija `trailingSlash = 'always'`.** Toda URL de esta prueba lleva barra final: `/puntos/003566/`. Sin ella, un 308 por escaneo.

### Restricción dura

**`npm run build` tiene que seguir produciendo el estático de siempre.** Producción (`sista.com.ar`, FTP) no se toca. La ruta `/puntos/` simplemente no se emite en ese build.

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `src/lib/formatName.js` (crear) | `toTitleCase()`. Puro, sin dependencias. |
| `src/lib/formatName.test.js` (crear) | Tests del formateo. |
| `src/lib/server/ispcube.js` (crear) | `getAuthToken()` y `getCustomerByCode()`. No importa `$env`. |
| `src/lib/server/ispcube.test.js` (crear) | Tests con `fetch` inyectado. |
| `src/lib/server/ispcubeDeps.js` (crear) | Única capa que lee `$env` para IspCube. |
| `src/routes/puntos/[nro]/+page.server.js` (crear) | Resuelve el número contra la API. |
| `src/routes/puntos/[nro]/+page.svelte` (crear) | La pantalla y sus estados. |
| `scripts/generar-qr.js` (crear) | Emite el PNG del QR. One-off. |
| `package.json` (modificar) | `qrcode` como devDependency. |
| `.gitignore` (modificar) | Ignorar `qr/`. |

---

## Task 1: La rama y el formateo del nombre

IspCube devuelve `"TALONE SANDRA ELIZABETH"`: un solo campo, en mayúsculas, apellido primero. Se empieza por acá porque es la pieza sin dependencias.

**Files:**
- Create: `src/lib/formatName.js`
- Create: `src/lib/formatName.test.js`

- [ ] **Step 1: Crear la rama**

```bash
git checkout fase1-endpoints-node && git checkout -b prueba-qr-puntos
```

- [ ] **Step 2: Escribir el test que falla**

Crear `src/lib/formatName.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { toTitleCase } from './formatName.js';

describe('toTitleCase', () => {
	it('capitaliza el nombre que devuelve IspCube', () => {
		expect(toTitleCase('TALONE SANDRA ELIZABETH')).toBe('Talone Sandra Elizabeth');
	});

	it('capitaliza un nombre en minusculas', () => {
		expect(toTitleCase('talone sandra')).toBe('Talone Sandra');
	});

	it('normaliza un nombre en mayusculas y minusculas mezcladas', () => {
		expect(toTitleCase('TaLoNe SaNdRa')).toBe('Talone Sandra');
	});

	it('respeta acentos y enie', () => {
		expect(toTitleCase('MARÍA PEÑA')).toBe('María Peña');
	});

	it('colapsa los espacios multiples', () => {
		expect(toTitleCase('TALONE    SANDRA')).toBe('Talone Sandra');
	});

	it('recorta los espacios de los extremos', () => {
		expect(toTitleCase('  TALONE  ')).toBe('Talone');
	});

	it('sirve una sola palabra', () => {
		expect(toTitleCase('TALONE')).toBe('Talone');
	});

	it('devuelve vacio para un string vacio o de solo espacios', () => {
		expect(toTitleCase('')).toBe('');
		expect(toTitleCase('   ')).toBe('');
	});

	it('devuelve vacio para lo que no es string', () => {
		expect(toTitleCase(null)).toBe('');
		expect(toTitleCase(undefined)).toBe('');
		expect(toTitleCase(42)).toBe('');
	});
});
```

- [ ] **Step 3: Correr el test para verificar que falla**

```bash
npx vitest run src/lib/formatName.test.js
```

Expected: FAIL — no resuelve el import de `./formatName.js`.

- [ ] **Step 4: Implementar el módulo**

Crear `src/lib/formatName.js`:

```js
/**
 * IspCube devuelve `name` en mayusculas y en un solo campo
 * ("TALONE SANDRA ELIZABETH"), sin separar nombre de apellido.
 *
 * Se muestra capitalizado para que la pantalla sea legible, pero NO se intenta
 * partir el nombre: la heuristica "la primera palabra es el apellido" falla con
 * los apellidos compuestos ("DE LA TORRE JUAN") y con las razones sociales de
 * los clientes empresa. Mostrar el nombre completo tal como lo tiene el ISP
 * ademas sirve mejor al proposito de la pantalla: que el comercio confirme que
 * escaneo al cliente correcto.
 */

/**
 * @param {unknown} value Valor del campo `name` de IspCube
 * @returns {string} El nombre con la inicial de cada palabra en mayuscula
 */
export function toTitleCase(value) {
	if (typeof value !== 'string') return '';

	return value
		.trim()
		.split(/\s+/)
		.filter((word) => word !== '')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(' ');
}
```

- [ ] **Step 5: Correr el test para verificar que pasa**

```bash
npx vitest run src/lib/formatName.test.js
```

Expected: PASS, 9 tests.

- [ ] **Step 6: Correr la suite completa**

```bash
npm test
```

Expected: `Test Files 18 passed (18)`, `Tests 217 passed (217)`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/formatName.js src/lib/formatName.test.js
git commit -m "feat: capitalizar el nombre que devuelve ispcube"
```

---

## Task 2: Cliente de la API de IspCube

Puerto de la parte de autenticación de `static/assets/client-handler.php`, más la búsqueda por número de cliente que el PHP no hace.

**Files:**
- Create: `src/lib/server/ispcube.js`
- Create: `src/lib/server/ispcube.test.js`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/server/ispcube.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { getAuthToken, getCustomerByCode, AUTH_PATH, CUSTOMER_PATH } from './ispcube.js';

const CONFIG = {
	baseUrl: 'https://ispcube.test',
	username: 'api_web2',
	password: 's3cr3t',
	apiKey: 'k3y',
	clientId: '734'
};

/**
 * `fetch` falso que va devolviendo las respuestas de la lista, en orden.
 * Cada una es `{status, body}`; si `body` es `undefined`, `.json()` explota
 * (simula una respuesta que no es JSON).
 */
function fakeFetch(responses, calls = []) {
	let i = 0;
	return async (url, init) => {
		calls.push({ url, init });
		const r = responses[Math.min(i, responses.length - 1)];
		i += 1;
		return {
			ok: r.status >= 200 && r.status < 300,
			status: r.status,
			json: async () => {
				if (r.body === undefined) throw new Error('no es json');
				return r.body;
			}
		};
	};
}

const AUTH_OK = { status: 200, body: { data: { token: 't0k3n' } } };

const CLIENTE_OK = {
	status: 200,
	body: { id: 7277, code: '003566', name: 'TALONE SANDRA ELIZABETH', status: 'enabled' }
};

describe('getAuthToken', () => {
	it('devuelve el token que viene en data.token', async () => {
		const res = await getAuthToken({ ...CONFIG, fetchImpl: fakeFetch([AUTH_OK]) });
		expect(res).toEqual({ ok: true, token: 't0k3n' });
	});

	it('acepta el token en la raiz de la respuesta', async () => {
		const res = await getAuthToken({
			...CONFIG,
			fetchImpl: fakeFetch([{ status: 200, body: { token: 'otro' } }])
		});
		expect(res).toEqual({ ok: true, token: 'otro' });
	});

	it('falla con reason config si falta una credencial, sin llamar a la api', async () => {
		const calls = [];
		const res = await getAuthToken({
			...CONFIG,
			apiKey: '',
			fetchImpl: fakeFetch([AUTH_OK], calls)
		});

		expect(res).toEqual({ ok: false, reason: 'config' });
		expect(calls).toHaveLength(0);
	});

	it('falla con reason auth si la respuesta no trae token', async () => {
		const res = await getAuthToken({
			...CONFIG,
			fetchImpl: fakeFetch([{ status: 400, body: { status: false, message: 'credenciales' } }])
		});
		expect(res).toEqual({ ok: false, reason: 'auth' });
	});

	it('falla con reason network si fetch explota', async () => {
		const res = await getAuthToken({
			...CONFIG,
			fetchImpl: async () => {
				throw new Error('ECONNRESET');
			}
		});
		expect(res).toEqual({ ok: false, reason: 'network' });
	});

	it('postea las credenciales a la url de auth con los headers obligatorios', async () => {
		const calls = [];
		await getAuthToken({ ...CONFIG, fetchImpl: fakeFetch([AUTH_OK], calls) });

		expect(calls[0].url).toBe('https://ispcube.test' + AUTH_PATH);
		expect(calls[0].init.method).toBe('POST');
		expect(JSON.parse(calls[0].init.body)).toEqual({ username: 'api_web2', password: 's3cr3t' });
		expect(calls[0].init.headers['api-key']).toBe('k3y');
		expect(calls[0].init.headers['client-id']).toBe('734');
		expect(calls[0].init.headers['login-type']).toBe('api');
		expect(calls[0].init.headers.username).toBe('api_web2');
	});
});

describe('getCustomerByCode', () => {
	it('devuelve code, name y status del cliente', async () => {
		const res = await getCustomerByCode('003566', {
			...CONFIG,
			fetchImpl: fakeFetch([AUTH_OK, CLIENTE_OK])
		});

		expect(res).toEqual({
			ok: true,
			customer: { code: '003566', name: 'TALONE SANDRA ELIZABETH', status: 'enabled' }
		});
	});

	it('consulta ?code= respetando los ceros a la izquierda', async () => {
		const calls = [];
		await getCustomerByCode('003566', {
			...CONFIG,
			fetchImpl: fakeFetch([AUTH_OK, CLIENTE_OK], calls)
		});

		expect(calls[1].url).toBe(`https://ispcube.test${CUSTOMER_PATH}?code=003566`);
	});

	it('manda el bearer y el header username en la consulta', async () => {
		const calls = [];
		await getCustomerByCode('003566', {
			...CONFIG,
			fetchImpl: fakeFetch([AUTH_OK, CLIENTE_OK], calls)
		});

		expect(calls[1].init.headers.Authorization).toBe('Bearer t0k3n');
		// Sin este header la api responde 400 "username header requerido",
		// aunque el bearer sea valido.
		expect(calls[1].init.headers.username).toBe('api_web2');
	});

	it('devuelve not_found cuando la api responde 404', async () => {
		const res = await getCustomerByCode('999999', {
			...CONFIG,
			fetchImpl: fakeFetch([
				AUTH_OK,
				{ status: 404, body: { result: true, message: 'Cliente no encontrado' } }
			])
		});

		expect(res).toEqual({ ok: false, reason: 'not_found' });
	});

	it('rechaza un codigo con formato invalido sin llamar a la api', async () => {
		const calls = [];
		const fetchImpl = fakeFetch([AUTH_OK, CLIENTE_OK], calls);

		expect(await getCustomerByCode('abc', { ...CONFIG, fetchImpl })).toEqual({
			ok: false,
			reason: 'not_found'
		});
		expect(await getCustomerByCode('', { ...CONFIG, fetchImpl })).toEqual({
			ok: false,
			reason: 'not_found'
		});
		expect(await getCustomerByCode('1'.repeat(13), { ...CONFIG, fetchImpl })).toEqual({
			ok: false,
			reason: 'not_found'
		});
		expect(calls).toHaveLength(0);
	});

	it('devuelve api cuando la api responde 500', async () => {
		const res = await getCustomerByCode('003566', {
			...CONFIG,
			fetchImpl: fakeFetch([AUTH_OK, { status: 500, body: { message: 'boom' } }])
		});

		expect(res).toEqual({ ok: false, reason: 'api' });
	});

	it('devuelve invalid si la respuesta no trae name', async () => {
		const res = await getCustomerByCode('003566', {
			...CONFIG,
			fetchImpl: fakeFetch([AUTH_OK, { status: 200, body: { code: '003566' } }])
		});

		expect(res).toEqual({ ok: false, reason: 'invalid' });
	});

	it('devuelve invalid si la respuesta no es json', async () => {
		const res = await getCustomerByCode('003566', {
			...CONFIG,
			fetchImpl: fakeFetch([AUTH_OK, { status: 200 }])
		});

		expect(res).toEqual({ ok: false, reason: 'invalid' });
	});

	it('propaga el fallo del auth sin consultar el cliente', async () => {
		const calls = [];
		const res = await getCustomerByCode('003566', {
			...CONFIG,
			fetchImpl: fakeFetch([{ status: 400, body: { message: 'nope' } }], calls)
		});

		expect(res).toEqual({ ok: false, reason: 'auth' });
		expect(calls).toHaveLength(1);
	});

	it('devuelve network si fetch explota en la consulta', async () => {
		let n = 0;
		const res = await getCustomerByCode('003566', {
			...CONFIG,
			fetchImpl: async () => {
				n += 1;
				if (n === 1) return { ok: true, status: 200, json: async () => AUTH_OK.body };
				throw new Error('ECONNRESET');
			}
		});

		expect(res).toEqual({ ok: false, reason: 'network' });
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
 * Cliente de la API de IspCube.
 *
 * No importa `$env` a proposito: la configuracion entra por parametro, igual
 * que en `recaptcha.js`. Asi el modulo se testea con Vitest sin los modulos
 * virtuales de SvelteKit, y el punto donde se leen los secrets queda
 * concentrado en `ispcubeDeps.js`.
 */

export const AUTH_PATH = '/api/sanctum/token';
export const CUSTOMER_PATH = '/api/customer';

/** Solo digitos. El zero-padding es significativo: `3566` NO es `003566`. */
const CODE_PATTERN = /^\d{1,12}$/;

const TIMEOUT_MS = 15_000;

/**
 * @typedef {object} IspcubeConfig
 * @property {string} baseUrl Sin barra final
 * @property {string} username
 * @property {string} password
 * @property {string} apiKey
 * @property {string} clientId
 * @property {typeof fetch} [fetchImpl] Inyectable para tests
 */

/**
 * Headers que la API exige en TODAS las llamadas.
 *
 * El `username` no es folklore: sin el, cualquier consulta responde
 * `400 {"status":false,"message":"username header requerido"}` aunque el bearer
 * sea valido. `static/assets/client-handler.php` no lo manda, y por eso su
 * busqueda por DNI esta rota.
 *
 * @param {IspcubeConfig} config
 * @returns {Record<string, string>}
 */
function commonHeaders(config) {
	return {
		'Content-Type': 'application/json',
		Accept: 'application/json',
		'api-key': config.apiKey,
		'client-id': config.clientId,
		'login-type': 'api',
		username: config.username
	};
}

/**
 * @typedef {{ok: true, token: string} | {ok: false, reason: string}} AuthResult
 */

/**
 * @param {IspcubeConfig} config
 * @returns {Promise<AuthResult>}
 */
export async function getAuthToken(config) {
	const { baseUrl, username, password, apiKey, clientId, fetchImpl = fetch } = config;

	if (!baseUrl || !username || !password || !apiKey || !clientId) {
		console.error('[ispcube] faltan credenciales: revisar las ISPCUBE_* del entorno');
		return { ok: false, reason: 'config' };
	}

	/** @type {any} */
	let data;
	try {
		const res = await fetchImpl(baseUrl + AUTH_PATH, {
			method: 'POST',
			headers: commonHeaders(config),
			body: JSON.stringify({ username, password }),
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
		data = await res.json();
	} catch (error) {
		console.error('[ispcube] error de red en el auth:', error);
		return { ok: false, reason: 'network' };
	}

	const token = data?.data?.token ?? data?.token ?? '';
	if (!token) {
		console.error('[ispcube] el auth no devolvio token:', data?.message);
		return { ok: false, reason: 'auth' };
	}

	return { ok: true, token };
}

/**
 * @typedef {object} Customer
 * @property {string} code
 * @property {string} name Tal como lo devuelve la api, en mayusculas
 * @property {string} status `enabled`, `disabled`, etc.
 */

/**
 * @typedef {{ok: true, customer: Customer} | {ok: false, reason: string}} CustomerResult
 */

/**
 * Busca un cliente por su numero. `reason` puede ser `not_found`, `config`,
 * `auth`, `api`, `invalid` o `network`.
 *
 * @param {unknown} code Numero de cliente, con sus ceros ("003566")
 * @param {IspcubeConfig} config
 * @returns {Promise<CustomerResult>}
 */
export async function getCustomerByCode(code, config) {
	// Un codigo mal formado se resuelve sin gastar una llamada, y cae en el
	// mismo `not_found` que un cliente inexistente para no confirmarle a quien
	// sondea si un codigo existe.
	if (typeof code !== 'string' || !CODE_PATTERN.test(code)) {
		return { ok: false, reason: 'not_found' };
	}

	const auth = await getAuthToken(config);
	if (!auth.ok) return auth;

	const fetchImpl = config.fetchImpl ?? fetch;
	const url = `${config.baseUrl}${CUSTOMER_PATH}?code=${encodeURIComponent(code)}`;

	/** @type {any} */
	let res;
	try {
		res = await fetchImpl(url, {
			headers: { ...commonHeaders(config), Authorization: `Bearer ${auth.token}` },
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
	} catch (error) {
		console.error('[ispcube] error de red consultando el cliente:', error);
		return { ok: false, reason: 'network' };
	}

	// El 404 se corta antes de parsear: es el caso esperado, no un error.
	if (res.status === 404) return { ok: false, reason: 'not_found' };

	/** @type {any} */
	let data;
	try {
		data = await res.json();
	} catch (error) {
		console.error('[ispcube] la api no devolvio json:', error);
		return { ok: false, reason: 'invalid' };
	}

	if (!res.ok) {
		console.error(`[ispcube] HTTP ${res.status} consultando el cliente:`, data?.message);
		return { ok: false, reason: 'api' };
	}

	if (!data || typeof data.name !== 'string') {
		console.error('[ispcube] respuesta sin el campo name:', data);
		return { ok: false, reason: 'invalid' };
	}

	return {
		ok: true,
		customer: {
			code: typeof data.code === 'string' ? data.code : code,
			name: data.name,
			status: typeof data.status === 'string' ? data.status : ''
		}
	};
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

```bash
npx vitest run src/lib/server/ispcube.test.js
```

Expected: PASS, 16 tests.

- [ ] **Step 5: Correr la suite completa**

```bash
npm test
```

Expected: `Test Files 19 passed (19)`, `Tests 233 passed (233)`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/ispcube.js src/lib/server/ispcube.test.js
git commit -m "feat: cliente de la api de ispcube con busqueda por nro de cliente"
```

---

## Task 3: La ruta `/puntos/[nro]`

Es la primera página del repo con `+page.server.js`. Sin tests propios: `ispcubeDeps.js` solo lee env vars y el `load` es un adaptador fino sobre módulos ya cubiertos.

**Files:**
- Create: `src/lib/server/ispcubeDeps.js`
- Create: `src/routes/puntos/[nro]/+page.server.js`
- Create: `src/routes/puntos/[nro]/+page.svelte`

- [ ] **Step 1: Crear el lector de entorno**

Crear `src/lib/server/ispcubeDeps.js`:

```js
/**
 * Unica capa que lee `$env` para IspCube, igual que `endpointDeps.js` con el
 * mail y el captcha. Mantiene a `ispcube.js` puro y testeable.
 */
import { env } from '$env/dynamic/private';

/**
 * Los defaults son solo para la URL base (el host es publico y estable). Las
 * credenciales NO tienen fallback: si faltan, `getAuthToken` corta con
 * `reason: 'config'` y deja un console.error, en vez de fingir que hay
 * configuracion y fallar mas adelante con un error confuso.
 *
 * @returns {import('./ispcube.js').IspcubeConfig}
 */
export function ispcubeConfig() {
	return {
		baseUrl: (env.ISPCUBE_API_URL || 'https://sista.ispcube.online').replace(/\/+$/, ''),
		username: env.ISPCUBE_USERNAME || '',
		password: env.ISPCUBE_PASSWORD || '',
		apiKey: env.ISPCUBE_API_KEY || '',
		clientId: env.ISPCUBE_CLIENT_ID || ''
	};
}
```

- [ ] **Step 2: Crear el `load`**

Crear `src/routes/puntos/[nro]/+page.server.js`:

```js
/**
 * Resuelve el numero de cliente que viene en el QR de la plataforma de puntos.
 *
 * Prueba de concepto: valida el circuito camara -> URL -> API IspCube -> nombre
 * en pantalla. No hay modelo de puntos todavia.
 */
import { getCustomerByCode } from '$lib/server/ispcube.js';
import { ispcubeConfig } from '$lib/server/ispcubeDeps.js';
import { toTitleCase } from '$lib/formatName.js';

// Consulta una API en cada request: no se puede prerenderizar. Es la razon por
// la que `svelte.config.js` necesita `strict: false` en adapter-static.
export const prerender = false;

/** Solo digitos, igual que en `ispcube.js`. */
const NRO_VALIDO = /^\d{1,12}$/;

/** @type {import('./$types').PageServerLoad} */
export async function load({ params }) {
	// El parametro sale de la URL, asi que se muestra en pantalla solo si tiene
	// forma de numero de cliente. Svelte ya escapa el valor, pero reflejar texto
	// arbitrario igual rompe el diseño de la pagina.
	const nro = NRO_VALIDO.test(params.nro) ? params.nro : '';

	const result = await getCustomerByCode(params.nro, ispcubeConfig());

	if (result.ok) {
		return { estado: 'ok', nro, nombre: toTitleCase(result.customer.name) };
	}

	// El detalle tecnico ya quedo en el log del servidor; al navegador solo va
	// la distincion entre "no existe" y "algo se rompio".
	return {
		estado: result.reason === 'not_found' ? 'no_encontrado' : 'error',
		nro,
		nombre: ''
	};
}
```

- [ ] **Step 3: Crear la pantalla**

Crear `src/routes/puntos/[nro]/+page.svelte`:

```svelte
<script>
	// Pantalla que ve el comercio al escanear el QR de un cliente.
	//
	// El boton NO persiste nada a proposito: esta prueba valida el circuito
	// camara -> API -> nombre, y definir el esquema de la operacion obligaria a
	// decidir antes el modelo de puntos.
	let { data } = $props();

	let sumado = $state(false);
</script>

<svelte:head>
	<title>Sumar puntos · Sista</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="puntos">
	{#if data.estado === 'ok'}
		{#if sumado}
			<p class="puntos__hecho">¡Listo!</p>
			<p class="puntos__sub">Puntos sumados a {data.nombre}</p>
		{:else}
			<p class="puntos__sub">Sumar puntos a</p>
			<h1 class="puntos__nombre">{data.nombre}</h1>
			<button class="puntos__btn" onclick={() => (sumado = true)}>Sumar puntos</button>
		{/if}
	{:else if data.estado === 'no_encontrado'}
		<p class="puntos__error">
			{#if data.nro}
				No encontramos el cliente {data.nro}
			{:else}
				No encontramos ese cliente
			{/if}
		</p>
	{:else}
		<p class="puntos__error">No pudimos consultar el sistema. Probá de nuevo.</p>
	{/if}
</main>

<style>
	.puntos {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		padding: 1.5rem;
		text-align: center;
		background: var(--background);
		color: var(--text);
	}

	.puntos__sub {
		margin: 0;
		font-size: 1.125rem;
		opacity: 0.75;
	}

	.puntos__nombre {
		margin: 0;
		font-size: 2rem;
		line-height: 1.15;
		font-weight: 700;
		text-wrap: balance;
	}

	.puntos__hecho {
		margin: 0;
		font-size: 2rem;
		font-weight: 700;
	}

	.puntos__btn {
		margin-top: 1.5rem;
		padding: 1rem 2.5rem;
		border: none;
		border-radius: 999px;
		background: var(--text);
		color: var(--background);
		font: inherit;
		font-size: 1.125rem;
		font-weight: 600;
		cursor: pointer;
	}

	.puntos__btn:active {
		transform: scale(0.98);
	}

	.puntos__error {
		margin: 0;
		font-size: 1.25rem;
		text-wrap: balance;
	}
</style>
```

- [ ] **Step 4: Verificar que el build estático sigue andando y NO emite la ruta**

```bash
rm -rf build && npm run build > /dev/null && ls build/index.html && ls build/assets/send-form-contacto.php
find build -path "*puntos*" | wc -l
```

Expected: los dos `ls` encuentran su archivo y el `find` imprime `0`. **Si el build falla, parar: se rompió el deploy de producción.**

- [ ] **Step 5: Verificar que el build Node sí emite la ruta**

```bash
rm -rf build-node && npm run build:node > /dev/null && grep -rl "Sumar puntos a" build-node/server | head -1
```

Expected: imprime algún archivo de `build-node/server`.

- [ ] **Step 6: Correr la suite completa**

```bash
npm test
```

Expected: `Test Files 19 passed (19)`, `Tests 233 passed (233)`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/server/ispcubeDeps.js src/routes/puntos
git commit -m "feat: pantalla de sumar puntos resuelta contra ispcube"
```

---

## Task 4: Verificación local contra la API real

Acá se prueba de verdad. Los tests usan `fetch` falso; esto usa la API de producción de IspCube (solo lectura).

**Files:** ninguno. Es verificación.

- [ ] **Step 1: Levantar el server Node**

Dos comandos separados a propósito: `a && b &` mandaría también el build al fondo y el `sleep` arrancaría antes de tiempo.

```bash
npm run build:node > /dev/null
```

```bash
node --env-file=.env server.js &
sleep 3
```

**`--env-file` es obligatorio y `source .env` NO sirve** (ver Pre-flight).

- [ ] **Step 2: Verificar el caso feliz**

```bash
curl -s http://localhost:3000/puntos/003566/ | grep -o "Sumar puntos a\|Talone Sandra Elizabeth"
```

Expected: imprime las dos líneas — `Sumar puntos a` y `Talone Sandra Elizabeth`.

Si sale `No pudimos consultar el sistema`, mirar la consola del server: el `console.error` de `ispcube.js` dice si es `config` (faltan env vars), `auth` (credenciales) o `network`.

- [ ] **Step 3: Verificar el redirect de la barra final**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/puntos/003566
```

Expected: `308`. Confirma por qué el QR tiene que llevar la barra — es el redirect que queremos evitarle a la cámara.

- [ ] **Step 4: Verificar los casos de error**

```bash
curl -s http://localhost:3000/puntos/999999/ | grep -o "No encontramos el cliente 999999"
curl -s http://localhost:3000/puntos/3566/   | grep -o "No encontramos el cliente 3566"
curl -s http://localhost:3000/puntos/abc/    | grep -o "No encontramos ese cliente"
```

Expected: cada uno imprime su mensaje. El segundo es la prueba del zero-padding: `3566` sin ceros **no** es el cliente 003566.

- [ ] **Step 5: Verificar que el noindex cubre la ruta nueva**

```bash
curl -sI http://localhost:3000/puntos/003566/ | grep -i x-robots-tag
```

Expected: `x-robots-tag: noindex, nofollow`.

- [ ] **Step 6: Cortar el server**

```bash
kill %1
```

- [ ] **Step 7: Commit si hubo ajustes**

Si algo de lo anterior obligó a tocar código, commitear **con rutas explícitas** (ver Pre-flight: hay trabajo sin trackear de otra sesión en el working tree):

```bash
git add src/lib/server/ispcube.js src/lib/server/ispcubeDeps.js src/routes/puntos
git commit -m "fix: ajustes de la verificacion local contra ispcube"
```

Si no hubo cambios, seguir.

---

## Task 5: Deploy al subdominio

Manual, en hPanel. **App:** `ghostwhite-okapi-714606.hostingersite.com` (usuario `u784612252`).

**Files:** ninguno.

- [ ] **Step 1: Pushear la rama**

```bash
git push -u origin prueba-qr-puntos
```

- [ ] **Step 2: Cargar las variables de IspCube en hPanel**

hPanel → la web app → Environment Variables. Con los valores del `.env` local:

| Variable |
|---|
| `ISPCUBE_API_URL` |
| `ISPCUBE_USERNAME` |
| `ISPCUBE_PASSWORD` |
| `ISPCUBE_API_KEY` |
| `ISPCUBE_CLIENT_ID` |

`SITE_ENV=beta` ya está de la Fase 0 — **dejarla así**, es lo que mantiene el `noindex`. **No hay endpoint de API para las variables de entorno: esto es sí o sí por hPanel.**

- [ ] **Step 3: Apuntar el build a la rama y dispararlo**

En hPanel, apuntar la app a `prueba-qr-puntos`. La config no cambia respecto de la Fase 0: `build_script: build:node`, `output_directory: build-node`, `entry_file: server.js`, Node 24.

Verificar que terminó:

```bash
curl -s -H "Authorization: Bearer $HOSTINGER_API_TOKEN" \
  "https://developers.hostinger.com/api/hosting/v1/accounts/u784612252/websites/ghostwhite-okapi-714606.hostingersite.com/nodejs/builds?per_page=1"
```

Expected: el build más reciente en `state: completed`.

- [ ] **Step 4: Verificar la URL real**

```bash
BASE=https://ghostwhite-okapi-714606.hostingersite.com
curl -s $BASE/puntos/003566/ | grep -o "Talone Sandra Elizabeth"
curl -s $BASE/puntos/999999/ | grep -o "No encontramos el cliente 999999"
curl -sI $BASE/puntos/003566/ | grep -i x-robots-tag
```

Expected: el nombre, el mensaje de no encontrado, y `x-robots-tag: noindex, nofollow`.

**Esta es la URL exacta que va a ir en el QR.** No seguir a la Task 6 hasta que el primer comando imprima el nombre.

---

## Task 6: Generar el QR

Va último a propósito: recién ahora la URL está verificada. Un QR impreso apuntando a una página rota es el peor resultado posible de esta prueba.

**Files:**
- Create: `scripts/generar-qr.js`
- Modify: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Instalar `qrcode`**

```bash
npm install --save-dev qrcode@^1.5
```

Va como devDependency: el script se corre a mano, la app en runtime no lo usa.

- [ ] **Step 2: Escribir el script**

Crear `scripts/generar-qr.js`:

```js
/**
 * Genera el PNG del QR de un cliente para la prueba de la plataforma de puntos.
 *
 * One-off: no es parte de ningun build. Se corre a mano DESPUES de verificar
 * que la URL responde con el nombre del cliente.
 *
 * Uso:
 *   node scripts/generar-qr.js 003566
 *   node scripts/generar-qr.js 003566 http://localhost:3000
 */
import { mkdir } from 'node:fs/promises';
import QRCode from 'qrcode';

const BASE_POR_DEFECTO = 'https://ghostwhite-okapi-714606.hostingersite.com';

const [, , nro, base = BASE_POR_DEFECTO] = process.argv;

if (!nro || !/^\d{1,12}$/.test(nro)) {
	console.error('Uso: node scripts/generar-qr.js <nro-cliente> [base-url]');
	console.error('El numero va con sus ceros: 003566, no 3566.');
	process.exit(1);
}

// La barra final NO es opcional: `src/routes/+layout.js` fija
// `trailingSlash: 'always'`, asi que sin ella cada escaneo se come un 308.
const url = `${base.replace(/\/+$/, '')}/puntos/${nro}/`;
const salida = `qr/qr-${nro}.png`;

await mkdir('qr', { recursive: true });
await QRCode.toFile(salida, url, { width: 800, margin: 2, errorCorrectionLevel: 'M' });

console.log(`QR generado: ${salida}`);
console.log(`URL codificada: ${url}`);
```

- [ ] **Step 3: Ignorar la carpeta de salida**

Agregar al final de `.gitignore`:

```
# QRs generados a mano por scripts/generar-qr.js
qr/
```

- [ ] **Step 4: Generar el QR de 003566**

```bash
node scripts/generar-qr.js 003566
```

Expected:

```
QR generado: qr/qr-003566.png
URL codificada: https://ghostwhite-okapi-714606.hostingersite.com/puntos/003566/
```

- [ ] **Step 5: Escanear con el celular**

Abrir la cámara nativa (Android o iOS), apuntar al PNG en la pantalla de la compu, y tocar la notificación.

Expected: se abre el navegador y aparece **"Sumar puntos a Talone Sandra Elizabeth"** con el botón debajo. Tocar el botón: cambia a **"¡Listo! Puntos sumados a Talone Sandra Elizabeth"**.

Esto cierra la prueba: el circuito cámara → URL → API IspCube → nombre en pantalla funciona.

- [ ] **Step 6: Commit**

```bash
git add scripts/generar-qr.js package.json package-lock.json .gitignore
git commit -m "feat: script para generar el qr de un cliente"
```

---

## Al terminar

Lo que queda abierto, en orden de urgencia, ya anotado en el spec:

1. **La ruta es enumerable.** `/puntos/003567/` muestra el nombre de otro cliente. El `noindex` frena a Google, no a una persona. Resolver con token opaco o HMAC antes de que esto salga del subdominio de pruebas.
2. **No hay identidad del comercio.** Cualquiera con el link ve la pantalla.
3. **El botón no persiste nada.** Es el próximo incremento: definir el modelo de puntos, comercios y compras.
4. **Sin caché del token de IspCube.** Un login por visita.
