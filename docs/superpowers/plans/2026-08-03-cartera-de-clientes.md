# Cartera de clientes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un panel en `/admin` donde cada asesor comercial gestiona su cartera de clientes de IspCube, con alertas de seguimiento, mora y tickets nuevos.

**Architecture:** PocketBase guarda un snapshot de cada cliente para que la lista no gaste cuota de la API de IspCube; el detalle consulta en vivo a través de endpoints de SvelteKit protegidos por el token de PocketBase del asesor. Las reglas de negocio (pagos, alertas, normalización) viven en módulos puros sin red, testeados con vitest.

**Tech Stack:** SvelteKit 2 + Svelte 5 (runes), PocketBase, vitest, API REST de IspCube.

**Spec:** [`docs/superpowers/specs/2026-08-03-cartera-de-clientes-design.md`](../specs/2026-08-03-cartera-de-clientes-design.md)
**Referencia de la API:** [`docs/ispcube-api.md`](../../ispcube-api.md)

---

## Contexto que el implementador necesita

**No inventes credenciales ni las leas con `source .env`.** Las `ISPCUBE_*` ya están en `.env` y las lee `src/lib/server/ispcubeDeps.js`. Ningún módulo de `src/lib/server/` importa `$env` directamente: la config entra por parámetro. Respetá eso.

**Nunca ejecutes `createTicket` fuera de un test con `fetchImpl` inyectado.** Crea tickets reales en el IspCube de producción de Sista.

**Los tests no tocan la red.** Todas las funciones que hacen fetch aceptan `{ fetchImpl }` y los tests inyectan un doble. Mirá `src/lib/server/ispcube.test.js` para el patrón exacto.

**La Cartera solo funciona en el build Node.** `npm run build` (estático) no emite los `+server.js`, así que los endpoints de `/api/cartera/` no existen ahí. El deploy que sirve este panel es `npm run build:node`. Ver los comentarios en `svelte.config.js`.

**Comandos:**

```bash
npx vitest run                          # toda la suite (hoy: 20 archivos, 249 tests, verde)
npx vitest run src/lib/cartera/         # un directorio
npx vitest run -t "nombre del test"     # un test puntual
```

---

## File Structure

**Servidor — capa IspCube** (sin `$env`, todo por parámetro)

| Archivo | Responsabilidad |
|---|---|
| `src/lib/server/ispcube.js` *(modificar)* | Suma caché de token, `getTickets`, `getCobranzas`, `getCatalogos` |
| `src/lib/server/adminAuth.js` *(crear)* | Valida el token de PocketBase de un asesor y devuelve su id |

**Lógica pura** (sin red, sin PocketBase — el grueso de los tests)

| Archivo | Responsabilidad |
|---|---|
| `src/lib/cartera/fechas.js` | Parseo de fechas de IspCube sin bugs de zona horaria |
| `src/lib/cartera/pagos.js` | Cobranzas → puntos por mes; fusión del histórico acumulado |
| `src/lib/cartera/alertas.js` | Cliente + notas + hoy → alertas activas |
| `src/lib/cartera/normalizar.js` | Respuestas de IspCube → la forma del snapshot |

**Endpoints**

| Archivo | Responsabilidad |
|---|---|
| `src/routes/api/cartera/catalogos/+server.js` | Entidades y áreas de tickets, cacheadas en memoria |
| `src/routes/api/cartera/cliente/[code]/+server.js` | Detalle en vivo de un cliente |
| `src/routes/api/cartera/sync/+server.js` | Snapshots frescos para N códigos |

**UI** — `src/routes/admin/_components/mantenimiento/Dashboard/cartera/`

| Archivo | Responsabilidad |
|---|---|
| `carteraStore.svelte.js` | Estado, carga desde PocketBase, sincronización |
| `Cartera.svelte` | Lista, buscador, filtro por alerta |
| `AgregarCliente.svelte` | Alta: número → validación → fecha de instalación |
| `ClienteDetalle.svelte` | Datos, pagos, tickets, bitácora |
| `CarteraConfig.svelte` | Mapeo de entidades tarjeta y áreas de soporte |

Más `Sidebar.svelte` y `Content.svelte` *(modificar)* para engancharlo.

---

## Fase 0 — Sondeo

### Task 1: Sondear la API de IspCube antes de decidir la estrategia

El spec deja abierta la estrategia de sincronización porque depende de datos que solo se obtienen preguntándole a la API. Este sondeo es de **solo lectura**.

**Files:**
- Create: `scripts/sondeo-cartera.mjs` (temporal, se borra al final de la task)

- [ ] **Step 1: Escribir el script de sondeo**

```js
// scripts/sondeo-cartera.mjs
// Sondeo de SOLO LECTURA contra IspCube. No crea ni modifica nada.
// Uso: node --env-file=.env scripts/sondeo-cartera.mjs
const cfg = {
	baseUrl: (process.env.ISPCUBE_API_URL || 'https://sista.ispcube.online').replace(/\/+$/, ''),
	username: process.env.ISPCUBE_USERNAME || '',
	password: process.env.ISPCUBE_PASSWORD || '',
	apiKey: process.env.ISPCUBE_API_KEY || '',
	clientId: process.env.ISPCUBE_CLIENT_ID || ''
};

const headers = {
	'Content-Type': 'application/json',
	Accept: 'application/json',
	'api-key': cfg.apiKey,
	'client-id': cfg.clientId,
	'login-type': 'api',
	username: cfg.username
};

const tokenRes = await fetch(`${cfg.baseUrl}/api/sanctum/token`, {
	method: 'POST',
	headers,
	body: JSON.stringify({ username: cfg.username, password: cfg.password })
});
const tokenBody = await tokenRes.json();
const token = tokenBody?.data?.token ?? tokenBody?.token;
if (!token) {
	console.error('sin token:', tokenBody);
	process.exit(1);
}
const auth = { ...headers, Authorization: `Bearer ${token}` };

async function get(path) {
	const res = await fetch(`${cfg.baseUrl}${path}`, { headers: auth });
	const texto = await res.text();
	let body;
	try {
		body = JSON.parse(texto);
	} catch {
		body = texto.slice(0, 200);
	}
	return { status: res.status, body };
}

// 1. Tamaño de la base (define si la estrategia en bloque conviene).
const resumen = await get('/api/customer/summary');
console.log('summary:', resumen.status, JSON.stringify(resumen.body));

// 2. Limite maximo de customers_list.
for (const limit of [25, 100, 500, 1000]) {
	const r = await get(`/api/customers/customers_list?limit=${limit}&offset=0`);
	const n = Array.isArray(r.body) ? r.body.length : `no-array (${typeof r.body})`;
	console.log(`customers_list limit=${limit}: status=${r.status} devolvio=${n}`);
}

// 3. Entidades de cobranza: cual es tarjeta.
const ent = await get('/api/cash/entities_list');
console.log('\nentities_list:', ent.status);
if (Array.isArray(ent.body)) {
	for (const e of ent.body) console.log(`  id=${e.id} name=${JSON.stringify(e.name)} paymethod=${e.paymethod} enabled=${e.enabled}`);
}

// 4. Areas de tickets: cual es soporte.
const areas = await get('/api/tickets/areas_list');
console.log('\nareas_list:', areas.status);
if (Array.isArray(areas.body)) {
	for (const a of areas.body) console.log(`  id=${a.id} name=${JSON.stringify(a.name)}`);
}

// 5. Estados de ticket: cuales significan "cerrado".
const estados = await get('/api/tickets/status_list');
console.log('\nstatus_list:', estados.status);
if (Array.isArray(estados.body)) {
	for (const e of estados.body) console.log(`  id=${e.id} name=${JSON.stringify(e.name)}`);
}

// 6. Cuantas cobranzas devuelve cash_list (los ultimos 30 dias de TODA la empresa).
const cash = await get('/api/cash/cash_list');
console.log('\ncash_list:', cash.status, Array.isArray(cash.body) ? `${cash.body.length} movimientos` : cash.body);
```

- [ ] **Step 2: Correrlo**

```bash
node --env-file=.env scripts/sondeo-cartera.mjs
```

`--env-file` en vez de `source .env`: el `.env` tiene valores con caracteres que el shell interpreta, y `source` los rompe.

- [ ] **Step 3: Anotar los resultados en el spec**

Agregá una sección `## Resultados del sondeo (2026-08-XX)` al final de `docs/superpowers/specs/2026-08-03-cartera-de-clientes-design.md` con:

- Cantidad de clientes y conexiones activas (de `summary`). Con las conexiones se calcula la cuota mensual: `2,5 × conexiones`.
- El `limit` máximo real de `customers_list`.
- **Qué ids de entidad son tarjeta** — hacen falta para configurar `cartera_config`.
- **Qué ids de área son soporte.**
- **Qué ids de estado significan cerrado** (de `status_list`) — van a `cartera_config.estados_cerrados`.
- Cuántos movimientos devuelve `cash_list`.

Y la decisión: si `clientes / limit_max` da menos requests que el tamaño esperado de una cartera, la estrategia en bloque vale la pena; si no, queda la de por-cliente.

- [ ] **Step 4: Borrar el script y commitear**

El script no queda en el repo: fue un sondeo puntual y sus resultados ya están escritos en el spec.

```bash
rm scripts/sondeo-cartera.mjs
git add docs/superpowers/specs/2026-08-03-cartera-de-clientes-design.md
git commit -m "docs: resultados del sondeo de la api para la Cartera"
```

---

## Fase 1 — Capa de IspCube

### Task 2: Cachear el token de autenticación

El token dura 24 h y hoy se pide uno nuevo en cada llamada. Cachearlo corta a la mitad el consumo de la API — incluido el de lo que ya existe.

**Files:**
- Modify: `src/lib/server/ispcube.js:66-89`
- Test: `src/lib/server/ispcube.test.js`

- [ ] **Step 1: Escribir los tests que fallan**

Agregá al final de `src/lib/server/ispcube.test.js`. Actualizá también el import de la primera línea para incluir `limpiarCacheToken`:

```js
import { getAuthToken, createTicket, getCustomerByCode, limpiarCacheToken } from './ispcube.js';
```

```js
describe('cache del token', () => {
	beforeEach(() => limpiarCacheToken());

	it('reusa el token en la segunda llamada, sin volver a pedirlo', async () => {
		const calls = [];
		const fetchImpl = fakeFetch([res(200, { token: 'tok-1' })], calls);

		const a = await getAuthToken(CONFIG, { fetchImpl });
		const b = await getAuthToken(CONFIG, { fetchImpl });

		expect(a).toBe('tok-1');
		expect(b).toBe('tok-1');
		expect(calls).toHaveLength(1);
	});

	it('pide uno nuevo cuando el cacheado venció', async () => {
		const calls = [];
		const fetchImpl = fakeFetch([res(200, { token: 'tok-1' })], calls);
		let ahora = 1_000_000;
		const now = () => ahora;

		await getAuthToken(CONFIG, { fetchImpl, now });
		ahora += 24 * 60 * 60 * 1000;
		await getAuthToken(CONFIG, { fetchImpl, now });

		expect(calls).toHaveLength(2);
	});

	it('con forzar: true ignora el cache', async () => {
		const calls = [];
		const fetchImpl = fakeFetch([res(200, { token: 'tok-1' })], calls);

		await getAuthToken(CONFIG, { fetchImpl });
		await getAuthToken(CONFIG, { fetchImpl, forzar: true });

		expect(calls).toHaveLength(2);
	});

	it('no cachea un fallo de autenticación', async () => {
		const calls = [];
		const fetchImpl = fakeFetch([res(401, { message: 'no' })], calls);

		await getAuthToken(CONFIG, { fetchImpl });
		await getAuthToken(CONFIG, { fetchImpl });

		expect(calls).toHaveLength(2);
	});

	it('separa el cache por usuario', async () => {
		const calls = [];
		const fetchImpl = fakeFetch([res(200, { token: 'tok-1' })], calls);

		await getAuthToken(CONFIG, { fetchImpl });
		await getAuthToken({ ...CONFIG, username: 'otro' }, { fetchImpl });

		expect(calls).toHaveLength(2);
	});
});
```

Asegurate de que `beforeEach` esté importado de vitest en la primera línea del archivo:

```js
import { describe, it, expect, beforeEach } from 'vitest';
```

- [ ] **Step 2: Verificar que fallan**

Run: `npx vitest run src/lib/server/ispcube.test.js -t "cache del token"`
Expected: FAIL — `limpiarCacheToken is not a function`.

- [ ] **Step 3: Implementar**

En `src/lib/server/ispcube.js`, reemplazá la función `getAuthToken` (líneas 56-89) por:

```js
/**
 * Vida del token cacheado. La API lo emite con 24 h de validez; se guarda por
 * 23 para no quedar del lado equivocado del vencimiento.
 */
const TOKEN_TTL_MS = 23 * 60 * 60 * 1000;

/** @type {Map<string, {token: string, expira: number}>} */
const cacheToken = new Map();

/**
 * Vacia el cache de tokens. Existe para los tests: sin esto, un token cacheado
 * en un test se filtra al siguiente y las cuentas de llamadas dan mal.
 */
export function limpiarCacheToken() {
	cacheToken.clear();
}

/**
 * Obtiene un bearer token de IspCube, cacheado en memoria del proceso.
 *
 * El cache no es una optimizacion cosmetica: la API de IspCube se factura por
 * request (2,5 x conexiones activas por mes, ver `docs/ispcube-api.md`), y sin
 * el cada consulta de datos costaba dos llamadas en vez de una.
 *
 * @param {IspcubeConfig} config
 * @param {{ fetchImpl?: typeof fetch, now?: () => number, forzar?: boolean }} [options]
 *   `forzar` saltea el cache: lo usan los reintentos ante un 401, porque un
 *   token revocado del lado de IspCube seguiria cacheado hasta 23 h.
 * @returns {Promise<string | null>} `null` si no se pudo obtener
 */
export async function getAuthToken(config, { fetchImpl = fetch, now = Date.now, forzar = false } = {}) {
	const clave = `${trimBase(config.baseUrl)}|${config.username}`;
	if (!forzar) {
		const guardado = cacheToken.get(clave);
		if (guardado && guardado.expira > now()) return guardado.token;
	}

	const url = `${trimBase(config.baseUrl)}/api/sanctum/token`;
	try {
		const res = await fetchImpl(url, {
			method: 'POST',
			headers: { ...apiHeaders(config), 'login-type': 'api' },
			body: JSON.stringify({ username: config.username, password: config.password }),
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
		const data = await res.json();
		// La API devuelve el token en la raiz (`{"token": "..."}`), no anidado en
		// `data`. El PHP leia `data.token` y por eso su fallback de auth nunca
		// devolvia nada. Se aceptan las dos formas: verificado contra el IspCube
		// de produccion el 2026-07-31, pero no hay contrato escrito que lo fije.
		const token = data?.data?.token ?? data?.token ?? null;
		if (!token) {
			console.error('[ispcube] el auth respondio sin token:', data?.message ?? data);
			return null;
		}
		cacheToken.set(clave, { token, expira: now() + TOKEN_TTL_MS });
		return token;
	} catch (error) {
		console.error('[ispcube] fallo la autenticacion:', error);
		return null;
	}
}
```

- [ ] **Step 4: Verificar que pasan, y que no rompiste nada**

```bash
npx vitest run src/lib/server/ispcube.test.js
```

Expected: PASS, todos. Los tests viejos de `getAuthToken` siguen verdes porque `limpiarCacheToken()` corre en el `beforeEach` del describe nuevo — si alguno de los viejos falla por contaminación de cache, movele el `beforeEach` al nivel superior del archivo.

- [ ] **Step 5: Correr toda la suite**

```bash
npx vitest run
```

Expected: 20 archivos, todos verdes. `getCustomerByCode` ahora reusa token; ningún test existente cuenta llamadas de auth de forma que eso lo rompa.

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/ispcube.js src/lib/server/ispcube.test.js
git commit -m "perf: cachear el token de IspCube por 23h

La API se factura por request. Sin cache, cada consulta de datos costaba
dos llamadas: una de auth y una de datos."
```

---

### Task 3: `getTickets` — tickets de un cliente

**Files:**
- Modify: `src/lib/server/ispcube.js` (agregar al final)
- Test: `src/lib/server/ispcube.test.js`

- [ ] **Step 1: Escribir los tests que fallan**

Agregá el import de `getTickets` a la primera línea del test y este bloque al final:

```js
describe('getTickets', () => {
	beforeEach(() => limpiarCacheToken());

	const okAuth = res(200, { token: 'tok' });

	it('consulta por code con todos los headers obligatorios', async () => {
		const calls = [];
		await getTickets('003566', CONFIG, {
			fetchImpl: fakeFetch([okAuth, res(200, [])], calls)
		});

		expect(calls[1].url).toBe('https://sista.ispcube.online/api/tickets?code=003566');
		expect(calls[1].init.headers['login-type']).toBe('api');
		expect(calls[1].init.headers.username).toBe('u');
		expect(calls[1].init.headers.Authorization).toBe('Bearer tok');
	});

	it('devuelve los tickets cuando la api responde un array', async () => {
		const tickets = [{ id: 1, ticket_area_id: 6, created_at: '2026-07-01T10:00:00.000000Z' }];
		const r = await getTickets('003566', CONFIG, {
			fetchImpl: fakeFetch([okAuth, res(200, tickets)])
		});

		expect(r).toEqual({ ok: true, tickets });
	});

	it('trata un cliente sin tickets como lista vacia, no como error', async () => {
		const r = await getTickets('003566', CONFIG, {
			fetchImpl: fakeFetch([okAuth, res(404, {})])
		});

		expect(r).toEqual({ ok: true, tickets: [] });
	});

	it('rechaza un code mal formado sin gastar un request', async () => {
		const calls = [];
		const r = await getTickets('abc', CONFIG, { fetchImpl: fakeFetch([okAuth], calls) });

		expect(r).toEqual({ ok: false, reason: 'invalid' });
		expect(calls).toHaveLength(0);
	});

	it('reintenta una vez con token nuevo ante un 401', async () => {
		const calls = [];
		const fetchImpl = fakeFetch(
			[okAuth, res(401, {}), res(200, { token: 'tok-2' }), res(200, [])],
			calls
		);
		const r = await getTickets('003566', CONFIG, { fetchImpl });

		expect(r).toEqual({ ok: true, tickets: [] });
		expect(calls).toHaveLength(4);
		expect(calls[3].init.headers.Authorization).toBe('Bearer tok-2');
	});

	it('devuelve reason api si el 401 persiste tras el reintento', async () => {
		const r = await getTickets('003566', CONFIG, {
			fetchImpl: fakeFetch([okAuth, res(401, {}), res(200, { token: 't2' }), res(401, {})])
		});

		expect(r).toEqual({ ok: false, reason: 'api' });
	});

	it('devuelve reason network si el fetch explota', async () => {
		const r = await getTickets('003566', CONFIG, {
			fetchImpl: async (url) => {
				if (String(url).includes('sanctum')) return okAuth;
				throw new Error('ECONNRESET');
			}
		});

		expect(r).toEqual({ ok: false, reason: 'network' });
	});
});
```

- [ ] **Step 2: Verificar que fallan**

Run: `npx vitest run src/lib/server/ispcube.test.js -t "getTickets"`
Expected: FAIL — `getTickets is not a function`.

- [ ] **Step 3: Implementar**

Agregá al final de `src/lib/server/ispcube.js`:

```js
/**
 * Ejecuta una consulta GET autenticada contra IspCube, reintentando una sola
 * vez con token nuevo si la respuesta es 401.
 *
 * El reintento existe por el cache de token: si IspCube revoca un token, el
 * cacheado seguiria devolviendose hasta 23 h y el panel quedaria muerto todo
 * ese tiempo.
 *
 * @param {string} path Ruta absoluta desde el host, con su query string
 * @param {IspcubeConfig} config
 * @param {{ fetchImpl?: typeof fetch }} [options]
 * @returns {Promise<{ok: true, data: any} | {ok: false, reason: string, status?: number}>}
 */
async function getAutenticado(path, config, { fetchImpl = fetch } = {}) {
	const { baseUrl, username, password, apiKey, clientId } = config;
	if (!baseUrl || !username || !password || !apiKey || !clientId) {
		console.error('[ispcube] faltan credenciales: revisar las ISPCUBE_* del entorno');
		return { ok: false, reason: 'config' };
	}

	const url = `${trimBase(baseUrl)}${path}`;

	/** @param {boolean} forzar */
	const intentar = async (forzar) => {
		const token = await getAuthToken(config, { fetchImpl, forzar });
		if (!token) return { fallo: /** @type {const} */ ('auth') };
		const res = await fetchImpl(url, {
			headers: {
				...apiHeaders(config),
				'login-type': 'api',
				username,
				Authorization: `Bearer ${token}`
			},
			signal: AbortSignal.timeout(CUSTOMER_TIMEOUT_MS)
		});
		return { res };
	};

	try {
		let intento = await intentar(false);
		if (intento.fallo) return { ok: false, reason: 'auth' };

		if (intento.res.status === 401) {
			intento = await intentar(true);
			if (intento.fallo) return { ok: false, reason: 'auth' };
		}

		const res = intento.res;
		if (res.status === 404) return { ok: false, reason: 'not_found', status: 404 };

		if (!res.ok) {
			console.error(`[ispcube] HTTP ${res.status} en ${path}`);
			return { ok: false, reason: 'api', status: res.status };
		}

		try {
			return { ok: true, data: await res.json() };
		} catch (error) {
			console.error('[ispcube] la api no devolvio json:', error);
			return { ok: false, reason: 'invalid' };
		}
	} catch (error) {
		console.error(`[ispcube] error de red en ${path}:`, error);
		return { ok: false, reason: 'network' };
	}
}

/**
 * Tickets de un cliente. Solo lectura.
 *
 * Un 404 significa "este cliente no tiene tickets", no un error: se devuelve
 * lista vacia para que la UI no tenga que distinguir los dos casos.
 *
 * @param {unknown} code Numero de cliente, con sus ceros
 * @param {IspcubeConfig} config
 * @param {{ fetchImpl?: typeof fetch }} [options]
 * @returns {Promise<{ok: true, tickets: any[]} | {ok: false, reason: string}>}
 */
export async function getTickets(code, config, options = {}) {
	if (typeof code !== 'string' || !CODE_PATTERN.test(code)) {
		return { ok: false, reason: 'invalid' };
	}

	const r = await getAutenticado(`/api/tickets?code=${encodeURIComponent(code)}`, config, options);

	if (!r.ok) {
		if (r.reason === 'not_found') return { ok: true, tickets: [] };
		return { ok: false, reason: r.reason };
	}

	return { ok: true, tickets: Array.isArray(r.data) ? r.data : [] };
}
```

- [ ] **Step 4: Verificar que pasan**

Run: `npx vitest run src/lib/server/ispcube.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/ispcube.js src/lib/server/ispcube.test.js
git commit -m "feat: getTickets para la Cartera de clientes"
```

---

### Task 4: `getCobranzas`, `getCatalogos` y unificar `getCustomerByCode`

> **Alcance ampliado durante la ejecución (2026-08-03).** La revisión de la Task 3
> encontró dos problemas en el módulo, no en el commit:
>
> 1. **`getCustomerByCode` no tiene el auto-reparo ante 401.** El cache de token
>    de la Task 2 puede dejarlo con un token revocado hasta 23 h — y es el único
>    camino que hoy está en producción (la pantalla `/puntos/[nro]` del QR). O
>    sea: introdujimos el cache y dejamos sin proteger justo lo que ya se usa.
> 2. **Divergencia en el vocabulario de errores.** `getCustomerByCode` parsea el
>    JSON *antes* de mirar `res.ok`; `getAutenticado` mira el status primero. Un
>    502 con cuerpo HTML —caso que el propio módulo documenta como real— da
>    `invalid` por un camino y `api` por el otro.
>
> Las dos se arreglan con el mismo movimiento: plegar `getCustomerByCode` sobre
> `getAutenticado`. Se hace acá y no después porque al terminar esta task hay
> tres consumidores del transporte compartido y una copia divergente; reconciliar
> una copia es barato, reconciliar tres no.
>
> **Dos comportamientos deliberados de `getCustomerByCode` que el refactor NO
> puede perder:**
> - Un `code` mal formado devuelve `not_found`, **no** `invalid`. Es a propósito:
>   no le confirma a quien sondea si un número de cliente existe.
> - Una respuesta sin el campo `name` devuelve `invalid`.
>
> Su contrato público (`{ok: true, customer}` / `{ok: false, reason}`) no cambia:
> lo consume `/puntos/[nro]`, que está en producción.

**Files:**
- Modify: `src/lib/server/ispcube.js` (agregar al final, y refactorizar `getCustomerByCode`)
- Test: `src/lib/server/ispcube.test.js`

- [ ] **Step 1: Escribir los tests que fallan**

Agregá `getCobranzas, getCatalogos` al import y este bloque al final del test:

```js
describe('getCobranzas', () => {
	beforeEach(() => limpiarCacheToken());
	const okAuth = res(200, { token: 'tok' });

	it('pega al endpoint de las ultimas 6 cobranzas', async () => {
		const calls = [];
		await getCobranzas('003566', CONFIG, {
			fetchImpl: fakeFetch([okAuth, res(200, [])], calls)
		});

		expect(calls[1].url).toBe(
			'https://sista.ispcube.online/api/cash/cash_last_six_monts?code=003566'
		);
	});

	it('devuelve las cobranzas', async () => {
		const cobranzas = [{ id: 1, total: '12000.00', real_date: '2026-07-08 10:00:00' }];
		const r = await getCobranzas('003566', CONFIG, {
			fetchImpl: fakeFetch([okAuth, res(200, cobranzas)])
		});

		expect(r).toEqual({ ok: true, cobranzas });
	});

	it('trata un cliente sin cobranzas como lista vacia', async () => {
		const r = await getCobranzas('003566', CONFIG, {
			fetchImpl: fakeFetch([okAuth, res(404, {})])
		});

		expect(r).toEqual({ ok: true, cobranzas: [] });
	});

	it('rechaza un code mal formado sin gastar un request', async () => {
		const calls = [];
		const r = await getCobranzas('', CONFIG, { fetchImpl: fakeFetch([okAuth], calls) });

		expect(r).toEqual({ ok: false, reason: 'invalid' });
		expect(calls).toHaveLength(0);
	});
});

describe('getCatalogos', () => {
	beforeEach(() => limpiarCacheToken());
	const okAuth = res(200, { token: 'tok' });

	it('trae entidades y areas en dos requests', async () => {
		const calls = [];
		const entidades = [{ id: 1, name: 'Caja' }];
		const areas = [{ id: 6, name: 'Soporte Tecnico' }];
		const r = await getCatalogos(CONFIG, {
			fetchImpl: fakeFetch([okAuth, res(200, entidades), res(200, areas)], calls)
		});

		expect(r).toEqual({ ok: true, entidades, areas });
		expect(calls[1].url).toBe('https://sista.ispcube.online/api/cash/entities_list');
		expect(calls[2].url).toBe('https://sista.ispcube.online/api/tickets/areas_list');
	});

	it('falla si alguno de los dos catalogos falla', async () => {
		const r = await getCatalogos(CONFIG, {
			fetchImpl: fakeFetch([okAuth, res(200, []), res(500, {})])
		});

		expect(r).toEqual({ ok: false, reason: 'api' });
	});
});
```

- [ ] **Step 2: Verificar que fallan**

Run: `npx vitest run src/lib/server/ispcube.test.js -t "getCobranzas"`
Expected: FAIL — `getCobranzas is not a function`.

- [ ] **Step 3: Implementar**

Agregá al final de `src/lib/server/ispcube.js`:

```js
/**
 * Ultimas cobranzas de un cliente. Solo lectura.
 *
 * OJO: el endpoint devuelve las ultimas 6 COBRANZAS, no seis meses. Un cliente
 * que paga dos veces por mes deja tres meses de historia. Por eso el snapshot
 * de la Cartera acumula en vez de reemplazar (ver `cartera/pagos.js`).
 *
 * @param {unknown} code Numero de cliente, con sus ceros
 * @param {IspcubeConfig} config
 * @param {{ fetchImpl?: typeof fetch }} [options]
 * @returns {Promise<{ok: true, cobranzas: any[]} | {ok: false, reason: string}>}
 */
export async function getCobranzas(code, config, options = {}) {
	if (typeof code !== 'string' || !CODE_PATTERN.test(code)) {
		return { ok: false, reason: 'invalid' };
	}

	const r = await getAutenticado(
		`/api/cash/cash_last_six_monts?code=${encodeURIComponent(code)}`,
		config,
		options
	);

	if (!r.ok) {
		if (r.reason === 'not_found') return { ok: true, cobranzas: [] };
		return { ok: false, reason: r.reason };
	}

	return { ok: true, cobranzas: Array.isArray(r.data) ? r.data : [] };
}

/**
 * Catalogos que la Cartera necesita para configurarse: las entidades de
 * cobranza (que en IspCube ES el medio de pago) y las areas de tickets.
 *
 * Son estables: quien llame a esto deberia cachear el resultado en vez de
 * pedirlo en cada apertura de pantalla.
 *
 * @param {IspcubeConfig} config
 * @param {{ fetchImpl?: typeof fetch }} [options]
 * @returns {Promise<{ok: true, entidades: any[], areas: any[]} | {ok: false, reason: string}>}
 */
export async function getCatalogos(config, options = {}) {
	const entidades = await getAutenticado('/api/cash/entities_list', config, options);
	if (!entidades.ok) return { ok: false, reason: entidades.reason };

	const areas = await getAutenticado('/api/tickets/areas_list', config, options);
	if (!areas.ok) return { ok: false, reason: areas.reason };

	return {
		ok: true,
		entidades: Array.isArray(entidades.data) ? entidades.data : [],
		areas: Array.isArray(areas.data) ? areas.data : []
	};
}
```

- [ ] **Step 4: Verificar que pasan**

Run: `npx vitest run src/lib/server/ispcube.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/ispcube.js src/lib/server/ispcube.test.js
git commit -m "feat: getCobranzas y getCatalogos para la Cartera"
```

---

## Fase 2 — Lógica pura

### Task 5: `fechas.js` — parseo sin bugs de zona horaria

IspCube devuelve fechas en dos formatos (`"2022-07-15 03:20:21"` y `"2022-07-15T03:20:21.000000Z"`). Pasarlas por `new Date()` y leer `getDate()` **corre el día** según la zona horaria del servidor: en Argentina (UTC-3), `new Date("2022-07-15T01:00:00.000000Z").getDate()` da **14**. Un pago del día 10 aparecería como del 9 y la alerta de mora se dispararía mal.

Por eso las fechas se parsean como texto.

**Files:**
- Create: `src/lib/cartera/fechas.js`
- Test: `src/lib/cartera/fechas.test.js`

- [ ] **Step 1: Escribir los tests que fallan**

```js
// src/lib/cartera/fechas.test.js
import { describe, it, expect } from 'vitest';
import { partesFecha, claveMes, mesesEntre, sumarMeses } from './fechas.js';

describe('partesFecha', () => {
	it('parsea el formato con espacio', () => {
		expect(partesFecha('2022-07-15 03:20:21')).toEqual({ anio: 2022, mes: 7, dia: 15 });
	});

	it('parsea el formato ISO con microsegundos', () => {
		expect(partesFecha('2022-07-15T03:20:21.000000Z')).toEqual({ anio: 2022, mes: 7, dia: 15 });
	});

	it('parsea una fecha sin hora', () => {
		expect(partesFecha('2026-03-01')).toEqual({ anio: 2026, mes: 3, dia: 1 });
	});

	it('no corre el dia por zona horaria', () => {
		// Con `new Date(...).getDate()` en UTC-3 esto daria 14.
		expect(partesFecha('2022-07-15T01:00:00.000000Z').dia).toBe(15);
	});

	it('devuelve null ante basura', () => {
		expect(partesFecha('')).toBeNull();
		expect(partesFecha(null)).toBeNull();
		expect(partesFecha(undefined)).toBeNull();
		expect(partesFecha('ayer')).toBeNull();
		expect(partesFecha(20220715)).toBeNull();
	});
});

describe('claveMes', () => {
	it('arma la clave con el mes en dos digitos', () => {
		expect(claveMes({ anio: 2026, mes: 3, dia: 1 })).toBe('2026-03');
		expect(claveMes({ anio: 2026, mes: 11, dia: 30 })).toBe('2026-11');
	});

	it('devuelve null si las partes son null', () => {
		expect(claveMes(null)).toBeNull();
	});
});

describe('sumarMeses', () => {
	it('suma dentro del mismo anio', () => {
		expect(sumarMeses({ anio: 2026, mes: 3, dia: 15 }, 2)).toEqual({ anio: 2026, mes: 5, dia: 15 });
	});

	it('cruza el fin de anio', () => {
		expect(sumarMeses({ anio: 2026, mes: 11, dia: 5 }, 2)).toEqual({ anio: 2027, mes: 1, dia: 5 });
	});

	it('recorta el dia cuando el mes destino es mas corto', () => {
		// 31 de enero + 1 mes no es el 3 de marzo.
		expect(sumarMeses({ anio: 2026, mes: 1, dia: 31 }, 1)).toEqual({ anio: 2026, mes: 2, dia: 28 });
	});
});

describe('mesesEntre', () => {
	it('cuenta los meses hacia atras desde una fecha', () => {
		expect(mesesEntre({ anio: 2026, mes: 3, dia: 10 }, 3)).toEqual(['2026-01', '2026-02', '2026-03']);
	});

	it('cruza el fin de anio', () => {
		expect(mesesEntre({ anio: 2026, mes: 2, dia: 1 }, 3)).toEqual(['2025-12', '2026-01', '2026-02']);
	});
});
```

- [ ] **Step 2: Verificar que fallan**

Run: `npx vitest run src/lib/cartera/fechas.test.js`
Expected: FAIL — no existe `./fechas.js`.

- [ ] **Step 3: Implementar**

```js
// src/lib/cartera/fechas.js
/**
 * Fechas de IspCube, parseadas como texto.
 *
 * La API devuelve dos formatos: `"2022-07-15 03:20:21"` y
 * `"2022-07-15T03:20:21.000000Z"`. Pasarlos por `new Date()` y leer
 * `getDate()` CORRE EL DIA segun la zona horaria del proceso: en Argentina
 * (UTC-3), `new Date("2022-07-15T01:00:00.000000Z").getDate()` devuelve 14.
 *
 * Un pago del dia 10 leido como del 9 mueve un punto de verde a amarillo y
 * puede disparar una alerta de mora falsa. Por eso nada de este modulo
 * construye un `Date` a partir de los strings de la API.
 */

/**
 * @typedef {{anio: number, mes: number, dia: number}} Partes
 */

/** Dias de cada mes; febrero se corrige aparte. */
const DIAS_POR_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** @param {number} anio */
function esBisiesto(anio) {
	return (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
}

/**
 * @param {number} anio
 * @param {number} mes 1-12
 */
export function diasDelMes(anio, mes) {
	if (mes === 2 && esBisiesto(anio)) return 29;
	return DIAS_POR_MES[mes - 1];
}

/**
 * Extrae año, mes y día de una fecha de IspCube.
 *
 * @param {unknown} valor
 * @returns {Partes | null} `null` si no tiene forma de fecha
 */
export function partesFecha(valor) {
	if (typeof valor !== 'string') return null;
	const m = valor.match(/^(\d{4})-(\d{2})-(\d{2})/);
	if (!m) return null;
	return { anio: Number(m[1]), mes: Number(m[2]), dia: Number(m[3]) };
}

/**
 * Clave de mes, `"2026-03"`. Es la que agrupa los pagos del snapshot.
 *
 * @param {Partes | null} partes
 * @returns {string | null}
 */
export function claveMes(partes) {
	if (!partes) return null;
	return `${partes.anio}-${String(partes.mes).padStart(2, '0')}`;
}

/**
 * Suma meses recortando el día si el mes destino es más corto: el 31 de enero
 * más un mes es el 28 (o 29) de febrero, no el 3 de marzo.
 *
 * @param {Partes} partes
 * @param {number} n
 * @returns {Partes}
 */
export function sumarMeses(partes, n) {
	const total = partes.anio * 12 + (partes.mes - 1) + n;
	const anio = Math.floor(total / 12);
	const mes = (total % 12) + 1;
	return { anio, mes, dia: Math.min(partes.dia, diasDelMes(anio, mes)) };
}

/**
 * Las `cantidad` claves de mes que terminan en el mes de `hasta`, de la más
 * vieja a la más nueva.
 *
 * @param {Partes} hasta
 * @param {number} cantidad
 * @returns {string[]}
 */
export function mesesEntre(hasta, cantidad) {
	const claves = [];
	for (let i = cantidad - 1; i >= 0; i--) {
		claves.push(claveMes(sumarMeses(hasta, -i)));
	}
	return claves;
}

/**
 * Compara dos fechas por sus partes. Devuelve <0, 0 o >0.
 *
 * @param {Partes} a
 * @param {Partes} b
 */
export function compararFechas(a, b) {
	if (a.anio !== b.anio) return a.anio - b.anio;
	if (a.mes !== b.mes) return a.mes - b.mes;
	return a.dia - b.dia;
}
```

- [ ] **Step 4: Verificar que pasan**

Run: `npx vitest run src/lib/cartera/fechas.test.js`
Expected: PASS, 13 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/cartera/fechas.js src/lib/cartera/fechas.test.js
git commit -m "feat: parseo de fechas de IspCube sin bugs de zona horaria"
```

---

### Task 6: `pagos.js` — los puntos por mes y el histórico acumulado

**Files:**
- Create: `src/lib/cartera/pagos.js`
- Test: `src/lib/cartera/pagos.test.js`

- [ ] **Step 1: Escribir los tests que fallan**

```js
// src/lib/cartera/pagos.test.js
import { describe, it, expect } from 'vitest';
import { pagosDeCobranzas, fusionarPagos, puntosPorMes } from './pagos.js';

const cobranza = (real_date, total = '12000.00') => ({ real_date, date: '2020-01-01', total });

describe('pagosDeCobranzas', () => {
	it('usa real_date y no date', () => {
		// En IspCube estos dos campos difieren; el que dice cuando pago de verdad
		// es real_date.
		expect(pagosDeCobranzas([cobranza('2026-07-08 10:00:00')])).toEqual([
			{ mes: '2026-07', dia: 8, monto: 12000 }
		]);
	});

	it('se queda con el primer pago del mes cuando hay varios', () => {
		const pagos = pagosDeCobranzas([
			cobranza('2026-07-20 10:00:00', '5000.00'),
			cobranza('2026-07-08 10:00:00', '7000.00')
		]);

		expect(pagos).toEqual([{ mes: '2026-07', dia: 8, monto: 12000 }]);
	});

	it('ignora cobranzas sin fecha valida', () => {
		expect(pagosDeCobranzas([cobranza(null), cobranza('2026-07-08 10:00:00')])).toEqual([
			{ mes: '2026-07', dia: 8, monto: 12000 }
		]);
	});

	it('devuelve lista vacia ante una entrada que no es array', () => {
		expect(pagosDeCobranzas(null)).toEqual([]);
		expect(pagosDeCobranzas(undefined)).toEqual([]);
	});
});

describe('fusionarPagos', () => {
	it('conserva los meses viejos que la api ya no devuelve', () => {
		const guardados = [{ mes: '2026-01', dia: 5, monto: 10000 }];
		const nuevos = [{ mes: '2026-07', dia: 8, monto: 12000 }];

		expect(fusionarPagos(guardados, nuevos, { anio: 2026, mes: 7, dia: 15 })).toEqual([
			{ mes: '2026-01', dia: 5, monto: 10000 },
			{ mes: '2026-07', dia: 8, monto: 12000 }
		]);
	});

	it('los datos nuevos pisan a los guardados del mismo mes', () => {
		const guardados = [{ mes: '2026-07', dia: 25, monto: 5000 }];
		const nuevos = [{ mes: '2026-07', dia: 8, monto: 12000 }];

		expect(fusionarPagos(guardados, nuevos, { anio: 2026, mes: 7, dia: 15 })).toEqual([
			{ mes: '2026-07', dia: 8, monto: 12000 }
		]);
	});

	it('poda lo anterior a 12 meses', () => {
		const guardados = [
			{ mes: '2025-06', dia: 5, monto: 1 },
			{ mes: '2025-08', dia: 5, monto: 2 }
		];

		expect(fusionarPagos(guardados, [], { anio: 2026, mes: 7, dia: 15 })).toEqual([
			{ mes: '2025-08', dia: 5, monto: 2 }
		]);
	});

	it('tolera un histórico guardado nulo', () => {
		expect(fusionarPagos(null, [{ mes: '2026-07', dia: 8, monto: 1 }], { anio: 2026, mes: 7, dia: 1 })).toEqual([
			{ mes: '2026-07', dia: 8, monto: 1 }
		]);
	});
});

describe('puntosPorMes', () => {
	const hoy = { anio: 2026, mes: 7, dia: 15 };
	const instalacion = { anio: 2025, mes: 1, dia: 10 };

	it('verde cuando pago dentro de la ventana de ventanilla', () => {
		const puntos = puntosPorMes([{ mes: '2026-07', dia: 8, monto: 1 }], {
			perfil: 'ventanilla',
			diaCorte: 10,
			instalacion,
			hoy,
			meses: 1
		});

		expect(puntos).toEqual([{ mes: '2026-07', estado: 'verde', dia: 8, monto: 1 }]);
	});

	it('verde cuando pago exactamente el dia del corte', () => {
		const puntos = puntosPorMes([{ mes: '2026-07', dia: 10, monto: 1 }], {
			perfil: 'ventanilla',
			diaCorte: 10,
			instalacion,
			hoy,
			meses: 1
		});

		expect(puntos[0].estado).toBe('verde');
	});

	it('amarillo cuando pago pasado el corte pero dentro del mes', () => {
		const puntos = puntosPorMes([{ mes: '2026-07', dia: 11, monto: 1 }], {
			perfil: 'ventanilla',
			diaCorte: 10,
			instalacion,
			hoy,
			meses: 1
		});

		expect(puntos[0].estado).toBe('amarillo');
	});

	it('para tarjeta la ventana llega hasta el 21', () => {
		const puntos = puntosPorMes([{ mes: '2026-07', dia: 21, monto: 1 }], {
			perfil: 'tarjeta',
			diaCorte: 21,
			instalacion,
			hoy,
			meses: 1
		});

		expect(puntos[0].estado).toBe('verde');
	});

	it('rojo cuando no hubo pago en el mes', () => {
		const puntos = puntosPorMes([], {
			perfil: 'ventanilla',
			diaCorte: 10,
			instalacion,
			hoy: { anio: 2026, mes: 7, dia: 28 },
			meses: 1
		});

		expect(puntos[0].estado).toBe('rojo');
	});

	it('gris para los meses anteriores a la instalacion', () => {
		// Sin esto, un cliente de dos meses aparece con seis puntos rojos.
		const puntos = puntosPorMes([], {
			perfil: 'ventanilla',
			diaCorte: 10,
			instalacion: { anio: 2026, mes: 6, dia: 20 },
			hoy: { anio: 2026, mes: 7, dia: 28 },
			meses: 3
		});

		expect(puntos.map((p) => p.estado)).toEqual(['gris', 'rojo', 'rojo']);
	});

	it('el mes en curso no es rojo si todavia no vencio el corte', () => {
		// Es dia 5 y el corte es el 10: todavia no debe nada.
		const puntos = puntosPorMes([], {
			perfil: 'ventanilla',
			diaCorte: 10,
			instalacion,
			hoy: { anio: 2026, mes: 7, dia: 5 },
			meses: 1
		});

		expect(puntos[0].estado).toBe('pendiente');
	});

	it('devuelve un punto por mes, del mas viejo al mas nuevo', () => {
		const puntos = puntosPorMes([{ mes: '2026-06', dia: 3, monto: 1 }], {
			perfil: 'ventanilla',
			diaCorte: 10,
			instalacion,
			hoy,
			meses: 6
		});

		expect(puntos).toHaveLength(6);
		expect(puntos[0].mes).toBe('2026-02');
		expect(puntos[5].mes).toBe('2026-07');
	});
});
```

- [ ] **Step 2: Verificar que fallan**

Run: `npx vitest run src/lib/cartera/pagos.test.js`
Expected: FAIL — no existe `./pagos.js`.

- [ ] **Step 3: Implementar**

```js
// src/lib/cartera/pagos.js
/**
 * Historial de pagos de un cliente: de las cobranzas crudas de IspCube a los
 * puntos por mes que muestra la Cartera.
 *
 * Sin red y sin PocketBase: todo entra por parametro.
 */
import { partesFecha, claveMes, mesesEntre, sumarMeses } from './fechas.js';

/** Cuantos meses de historia se guardan en el snapshot. */
const MESES_HISTORICO = 12;

/**
 * @typedef {{mes: string, dia: number, monto: number}} Pago
 */

/**
 * Convierte las cobranzas de IspCube en un pago por mes.
 *
 * Usa `real_date`, no `date`: en IspCube esos campos pueden diferir por meses y
 * el que dice cuando pago de verdad es `real_date`.
 *
 * Cuando hay varias cobranzas en el mismo mes se toma **el dia del primer
 * pago** (el que define si llego en ventana) y **la suma de los montos**.
 *
 * @param {unknown} cobranzas
 * @returns {Pago[]} Ordenados por mes ascendente
 */
export function pagosDeCobranzas(cobranzas) {
	if (!Array.isArray(cobranzas)) return [];

	/** @type {Map<string, Pago>} */
	const porMes = new Map();

	for (const c of cobranzas) {
		const partes = partesFecha(c?.real_date);
		if (!partes) continue;
		const mes = claveMes(partes);
		const monto = Number(c?.total) || 0;

		const previo = porMes.get(mes);
		if (previo) {
			porMes.set(mes, {
				mes,
				dia: Math.min(previo.dia, partes.dia),
				monto: previo.monto + monto
			});
		} else {
			porMes.set(mes, { mes, dia: partes.dia, monto });
		}
	}

	return [...porMes.values()].sort((a, b) => a.mes.localeCompare(b.mes));
}

/**
 * Mezcla el historico guardado con lo que acaba de devolver la API.
 *
 * Hace falta acumular porque `cash_last_six_monts` devuelve las ultimas SEIS
 * COBRANZAS, no seis meses: un cliente que paga dos veces por mes deja apenas
 * tres meses de historia. Reemplazar en vez de fusionar iria borrando el
 * pasado en cada sincronizacion.
 *
 * @param {Pago[] | null | undefined} guardados
 * @param {Pago[]} nuevos Ganan ante un mes repetido: son los mas frescos
 * @param {import('./fechas.js').Partes} hoy
 * @returns {Pago[]} Ordenados por mes ascendente, podados a 12 meses
 */
export function fusionarPagos(guardados, nuevos, hoy) {
	/** @type {Map<string, Pago>} */
	const porMes = new Map();

	for (const p of Array.isArray(guardados) ? guardados : []) {
		if (p?.mes) porMes.set(p.mes, p);
	}
	for (const p of Array.isArray(nuevos) ? nuevos : []) {
		if (p?.mes) porMes.set(p.mes, p);
	}

	const corte = claveMes(sumarMeses(hoy, -(MESES_HISTORICO - 1)));

	return [...porMes.values()]
		.filter((p) => p.mes >= corte)
		.sort((a, b) => a.mes.localeCompare(b.mes));
}

/**
 * @typedef {object} OpcionesPuntos
 * @property {'ventanilla' | 'tarjeta'} perfil
 * @property {number} diaCorte Ultimo dia de la ventana de pago del cliente
 * @property {import('./fechas.js').Partes} instalacion
 * @property {import('./fechas.js').Partes} hoy
 * @property {number} [meses] Cuantos puntos devolver (default 6)
 */

/**
 * Un punto por mes para la fila de estado de pagos.
 *
 * Estados:
 *   - `verde`     pago dentro de su ventana (<= dia de corte)
 *   - `amarillo`  pago despues de la ventana, dentro del mes
 *   - `rojo`      no hubo pago y la ventana ya vencio
 *   - `pendiente` mes en curso, la ventana todavia no vencio
 *   - `gris`      mes anterior a la instalacion: el cliente no era cliente
 *
 * `gris` no es cosmetico: sin el, un cliente de dos meses aparece con seis
 * puntos rojos y parece un moroso cronico.
 *
 * @param {Pago[]} pagos
 * @param {OpcionesPuntos} opciones
 * @returns {{mes: string, estado: string, dia: number | null, monto: number | null}[]}
 */
export function puntosPorMes(pagos, { perfil, diaCorte, instalacion, hoy, meses = 6 }) {
	const claves = mesesEntre(hoy, meses);
	const porMes = new Map((Array.isArray(pagos) ? pagos : []).map((p) => [p.mes, p]));

	const mesInstalacion = claveMes(instalacion);
	const mesActual = claveMes(hoy);

	return claves.map((mes) => {
		const pago = porMes.get(mes) ?? null;

		if (mesInstalacion && mes < mesInstalacion) {
			return { mes, estado: 'gris', dia: null, monto: null };
		}

		if (pago) {
			return {
				mes,
				estado: pago.dia <= diaCorte ? 'verde' : 'amarillo',
				dia: pago.dia,
				monto: pago.monto
			};
		}

		// Sin pago: solo es mora si la ventana ya vencio. En el mes en curso
		// depende de que dia es hoy.
		if (mes === mesActual && hoy.dia <= diaCorte) {
			return { mes, estado: 'pendiente', dia: null, monto: null };
		}

		return { mes, estado: 'rojo', dia: null, monto: null };
	});
}
```

- [ ] **Step 4: Verificar que pasan**

Run: `npx vitest run src/lib/cartera/pagos.test.js`
Expected: PASS, 17 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/cartera/pagos.js src/lib/cartera/pagos.test.js
git commit -m "feat: historial de pagos por mes de la Cartera"
```

---

### Task 7: `alertas.js` — las cuatro alertas

**Files:**
- Create: `src/lib/cartera/alertas.js`
- Test: `src/lib/cartera/alertas.test.js`

- [ ] **Step 1: Escribir los tests que fallan**

```js
// src/lib/cartera/alertas.test.js
import { describe, it, expect } from 'vitest';
import { alertasDe, diaCorteDe, TIPOS_CONTACTO } from './alertas.js';

const CONFIG = {
	dia_corte_1: 10,
	dia_corte_2: 20,
	dia_corte_tarjeta: 21
};

/** Cliente base: instalado hace mucho, al dia, sin tickets nuevos. */
const base = {
	fecha_instalacion: '2025-01-10',
	ultimo_contacto: '',
	perfil_pago: 'ventanilla',
	pagos: [{ mes: '2026-07', dia: 5, monto: 12000 }],
	tickets: { abiertos: 0, cerrados: 3, ultimo: null },
	tickets_vistos_hasta: '2026-07-01'
};

const tipos = (r) => r.map((a) => a.tipo);

describe('diaCorteDe', () => {
	it('ventanilla corta el 10', () => {
		expect(diaCorteDe('ventanilla', CONFIG)).toBe(10);
	});

	it('tarjeta corta el 21', () => {
		expect(diaCorteDe('tarjeta', CONFIG)).toBe(21);
	});
});

describe('alerta de seguimiento a los 2 meses', () => {
	it('no salta antes de los dos meses', () => {
		const r = alertasDe(
			{ ...base, fecha_instalacion: '2026-06-10' },
			{ anio: 2026, mes: 7, dia: 15 },
			CONFIG
		);

		expect(tipos(r)).not.toContain('seguimiento');
	});

	it('salta cumplidos los dos meses sin contacto', () => {
		const r = alertasDe(
			{ ...base, fecha_instalacion: '2026-05-10' },
			{ anio: 2026, mes: 7, dia: 15 },
			CONFIG
		);

		expect(tipos(r)).toContain('seguimiento');
	});

	it('salta el dia exacto en que se cumplen los dos meses', () => {
		const r = alertasDe(
			{ ...base, fecha_instalacion: '2026-05-15' },
			{ anio: 2026, mes: 7, dia: 15 },
			CONFIG
		);

		expect(tipos(r)).toContain('seguimiento');
	});

	it('un contacto posterior a la instalacion la apaga', () => {
		const r = alertasDe(
			{ ...base, fecha_instalacion: '2026-05-10', ultimo_contacto: '2026-07-01' },
			{ anio: 2026, mes: 7, dia: 15 },
			CONFIG
		);

		expect(tipos(r)).not.toContain('seguimiento');
	});

	it('un contacto anterior a la instalacion no cuenta', () => {
		const r = alertasDe(
			{ ...base, fecha_instalacion: '2026-05-10', ultimo_contacto: '2026-04-01' },
			{ anio: 2026, mes: 7, dia: 15 },
			CONFIG
		);

		expect(tipos(r)).toContain('seguimiento');
	});

	it('un ultimo_contacto vacio no la apaga', () => {
		// El store solo escribe este campo con notas de tipo contacto: una nota
		// interna lo deja como estaba, y por eso no apaga la alerta.
		const r = alertasDe(
			{ ...base, fecha_instalacion: '2026-05-10', ultimo_contacto: '' },
			{ anio: 2026, mes: 7, dia: 15 },
			CONFIG
		);

		expect(tipos(r)).toContain('seguimiento');
	});

	it('sin fecha de instalacion no se calcula', () => {
		const r = alertasDe({ ...base, fecha_instalacion: '' }, { anio: 2026, mes: 7, dia: 15 }, CONFIG);

		expect(tipos(r)).not.toContain('seguimiento');
	});
});

describe('alertas de mora', () => {
	const sinPagos = { ...base, pagos: [] };

	it('no hay mora antes del primer corte', () => {
		const r = alertasDe(sinPagos, { anio: 2026, mes: 7, dia: 9 }, CONFIG);
		expect(tipos(r)).not.toContain('mora_1');
	});

	it('mora_1 pasado el dia 10 sin pago', () => {
		const r = alertasDe(sinPagos, { anio: 2026, mes: 7, dia: 11 }, CONFIG);
		expect(tipos(r)).toContain('mora_1');
		expect(tipos(r)).not.toContain('mora_2');
	});

	it('mora_2 pasado el dia 20 sin pago', () => {
		const r = alertasDe(sinPagos, { anio: 2026, mes: 7, dia: 21 }, CONFIG);
		expect(tipos(r)).toContain('mora_2');
	});

	it('un pago en el mes apaga las dos', () => {
		const r = alertasDe(
			{ ...base, pagos: [{ mes: '2026-07', dia: 25, monto: 1 }] },
			{ anio: 2026, mes: 7, dia: 28 },
			CONFIG
		);

		expect(tipos(r)).not.toContain('mora_1');
		expect(tipos(r)).not.toContain('mora_2');
	});

	it('a un cliente de tarjeta no se le aplica el corte del 10', () => {
		const r = alertasDe(
			{ ...sinPagos, perfil_pago: 'tarjeta' },
			{ anio: 2026, mes: 7, dia: 15 },
			CONFIG
		);

		expect(tipos(r)).toEqual([]);
	});

	it('a un cliente de tarjeta le salta la mora pasado el 21', () => {
		const r = alertasDe(
			{ ...sinPagos, perfil_pago: 'tarjeta' },
			{ anio: 2026, mes: 7, dia: 22 },
			CONFIG
		);

		expect(tipos(r)).toContain('mora_1');
	});

	it('a un cliente de tarjeta nunca le salta mora_2', () => {
		const r = alertasDe(
			{ ...sinPagos, perfil_pago: 'tarjeta' },
			{ anio: 2026, mes: 7, dia: 28 },
			CONFIG
		);

		expect(tipos(r)).not.toContain('mora_2');
	});

	it('no hay mora en el mes de la instalacion', () => {
		// Recien instalado: todavia no le facturaron nada.
		const r = alertasDe(
			{ ...sinPagos, fecha_instalacion: '2026-07-02' },
			{ anio: 2026, mes: 7, dia: 25 },
			CONFIG
		);

		expect(tipos(r)).not.toContain('mora_1');
	});
});

describe('alerta de tickets nuevos', () => {
	it('salta cuando hay un ticket posterior a la marca de visto', () => {
		const r = alertasDe(
			{
				...base,
				tickets: { abiertos: 1, cerrados: 0, ultimo: { fecha: '2026-07-10 09:00:00' } },
				tickets_vistos_hasta: '2026-07-01'
			},
			{ anio: 2026, mes: 7, dia: 15 },
			CONFIG
		);

		expect(tipos(r)).toContain('tickets');
	});

	it('no salta si el ultimo ticket es anterior a la marca', () => {
		const r = alertasDe(
			{
				...base,
				tickets: { abiertos: 1, cerrados: 0, ultimo: { fecha: '2026-06-10 09:00:00' } },
				tickets_vistos_hasta: '2026-07-01'
			},
			{ anio: 2026, mes: 7, dia: 15 },
			CONFIG
		);

		expect(tipos(r)).not.toContain('tickets');
	});

	it('sin marca de visto, cualquier ticket cuenta como nuevo', () => {
		const r = alertasDe(
			{
				...base,
				tickets: { abiertos: 1, cerrados: 0, ultimo: { fecha: '2026-06-10 09:00:00' } },
				tickets_vistos_hasta: ''
			},
			{ anio: 2026, mes: 7, dia: 15 },
			CONFIG
		);

		expect(tipos(r)).toContain('tickets');
	});

	it('sin tickets no salta', () => {
		const r = alertasDe(base, { anio: 2026, mes: 7, dia: 15 }, CONFIG);
		expect(tipos(r)).not.toContain('tickets');
	});
});

describe('TIPOS_CONTACTO', () => {
	it('nota no es un tipo de contacto', () => {
		expect(TIPOS_CONTACTO).toEqual(['llamada', 'whatsapp', 'visita']);
	});
});
```

- [ ] **Step 2: Verificar que fallan**

Run: `npx vitest run src/lib/cartera/alertas.test.js`
Expected: FAIL — no existe `./alertas.js`.

- [ ] **Step 3: Implementar**

```js
// src/lib/cartera/alertas.js
/**
 * Las cuatro alertas de la Cartera.
 *
 * Se calculan sobre el snapshot local, sin red: por eso la lista es instantanea
 * y sigue funcionando con IspCube caido. La contracara es que una alerta de
 * mora es tan fresca como el snapshot, y de eso se encarga el store.
 *
 * Este es el modulo que mas va a cambiar con el uso. Esta aislado a proposito.
 */
import { partesFecha, claveMes, sumarMeses, compararFechas } from './fechas.js';

/** Meses desde la instalacion hasta el llamado de seguimiento. */
const MESES_SEGUIMIENTO = 2;

/**
 * Tipos de nota que cuentan como contacto con el cliente. `nota` queda afuera
 * a proposito: sirve para dejar contexto sin cerrar el pendiente.
 */
export const TIPOS_CONTACTO = ['llamada', 'whatsapp', 'visita'];

/**
 * @typedef {object} ConfigCartera
 * @property {number} dia_corte_1
 * @property {number} dia_corte_2
 * @property {number} dia_corte_tarjeta
 */

/**
 * Ultimo dia de la ventana de pago segun el medio de pago del cliente.
 *
 * @param {string} perfil
 * @param {ConfigCartera} config
 * @returns {number}
 */
export function diaCorteDe(perfil, config) {
	return perfil === 'tarjeta' ? config.dia_corte_tarjeta : config.dia_corte_1;
}

/**
 * Alertas activas de un cliente.
 *
 * Toma SOLO el registro del cliente, sin las notas: la lista muestra hasta 500
 * clientes y pedir las notas de cada uno para saber si alguien ya llamo seria
 * una consulta por fila. En su lugar, `cartera_notas` sigue siendo la bitacora
 * completa y `cliente.ultimo_contacto` es la marca desnormalizada que mantiene
 * el store cada vez que se guarda una nota de tipo contacto.
 *
 * @param {any} cliente Registro de `cartera_clientes`
 * @param {import('./fechas.js').Partes} hoy
 * @param {ConfigCartera} config
 * @returns {{tipo: string, desde: string | null}[]}
 */
export function alertasDe(cliente, hoy, config) {
	const alertas = [];

	const instalacion = partesFecha(cliente?.fecha_instalacion);
	const perfil = cliente?.perfil_pago === 'tarjeta' ? 'tarjeta' : 'ventanilla';

	// --- Seguimiento a los 2 meses -----------------------------------------
	if (instalacion) {
		const vence = sumarMeses(instalacion, MESES_SEGUIMIENTO);
		const contacto = partesFecha(cliente?.ultimo_contacto);
		// Un contacto anterior a la instalacion no cuenta: es de una etapa previa
		// (la venta), no del seguimiento post-instalacion.
		const yaContactado = contacto && compararFechas(contacto, instalacion) >= 0;

		if (compararFechas(hoy, vence) >= 0 && !yaContactado) {
			alertas.push({ tipo: 'seguimiento', desde: claveMes(vence) });
		}
	}

	// --- Mora ---------------------------------------------------------------
	const mesActual = claveMes(hoy);
	const pagoDelMes = (Array.isArray(cliente?.pagos) ? cliente.pagos : []).some(
		(p) => p?.mes === mesActual
	);

	// El mes de la instalacion no cuenta: todavia no le facturaron nada.
	const recienInstalado = instalacion && claveMes(instalacion) === mesActual;

	if (!pagoDelMes && !recienInstalado) {
		const corte1 = diaCorteDe(perfil, config);
		if (hoy.dia > corte1) {
			alertas.push({ tipo: 'mora_1', desde: mesActual });
		}
		// El segundo corte es solo para ventanilla: en tarjeta el dia 21 es el
		// unico hito.
		if (perfil === 'ventanilla' && hoy.dia > config.dia_corte_2) {
			alertas.push({ tipo: 'mora_2', desde: mesActual });
		}
	}

	// --- Tickets nuevos ------------------------------------------------------
	const ultimo = partesFecha(cliente?.tickets?.ultimo?.fecha);
	if (ultimo) {
		const visto = partesFecha(cliente?.tickets_vistos_hasta);
		// Sin marca de visto, cualquier ticket es nuevo: el asesor nunca miro.
		if (!visto || compararFechas(ultimo, visto) > 0) {
			alertas.push({ tipo: 'tickets', desde: cliente.tickets.ultimo.fecha });
		}
	}

	return alertas;
}
```

- [ ] **Step 4: Verificar que pasan**

Run: `npx vitest run src/lib/cartera/alertas.test.js`
Expected: PASS, 20 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/cartera/alertas.js src/lib/cartera/alertas.test.js
git commit -m "feat: las cuatro alertas de la Cartera de clientes"
```

---

### Task 8: `normalizar.js` — de IspCube a la forma del snapshot

**Files:**
- Create: `src/lib/cartera/normalizar.js`
- Test: `src/lib/cartera/normalizar.test.js`

- [ ] **Step 1: Escribir los tests que fallan**

```js
// src/lib/cartera/normalizar.test.js
import { describe, it, expect } from 'vitest';
import { normalizarCliente, perfilDe, resumenTickets } from './normalizar.js';

describe('normalizarCliente', () => {
	const crudo = {
		code: '003365',
		name: 'RIOS ANA MARIA',
		status: 'enabled',
		start_date: '2026-05-01 00:00:00',
		entity_id: 4,
		entity: { id: 4, name: 'Tarjeta Visa' },
		debt: '12000.00',
		duedebt: '0.00'
	};

	it('normaliza el nombre a mayuscula inicial', () => {
		expect(normalizarCliente(crudo).nombre).toBe('Rios Ana Maria');
	});

	it('conserva el code con sus ceros', () => {
		expect(normalizarCliente(crudo).code).toBe('003365');
	});

	it('pasa las deudas a numero', () => {
		const c = normalizarCliente(crudo);
		expect(c.debt).toBe(12000);
		expect(c.duedebt).toBe(0);
	});

	it('recorta start_date a la fecha sola', () => {
		expect(normalizarCliente(crudo).start_date).toBe('2026-05-01');
	});

	it('toma el nombre de la entidad de entity.name', () => {
		const c = normalizarCliente(crudo);
		expect(c.entity_id).toBe(4);
		expect(c.entity_nombre).toBe('Tarjeta Visa');
	});

	it('tolera un cliente sin entidad', () => {
		const c = normalizarCliente({ ...crudo, entity_id: null, entity: null });
		expect(c.entity_id).toBeNull();
		expect(c.entity_nombre).toBe('');
	});

	it('tolera campos ausentes sin explotar', () => {
		const c = normalizarCliente({});
		expect(c.nombre).toBe('');
		expect(c.debt).toBe(0);
		expect(c.start_date).toBe('');
	});
});

describe('perfilDe', () => {
	it('es tarjeta si la entidad esta en la lista', () => {
		expect(perfilDe(4, [4, 7])).toBe('tarjeta');
	});

	it('es ventanilla si no esta', () => {
		expect(perfilDe(2, [4, 7])).toBe('ventanilla');
	});

	it('con la lista vacia todos son ventanilla', () => {
		// Default deliberado: el panel funciona antes de configurarse.
		expect(perfilDe(4, [])).toBe('ventanilla');
	});

	it('tolera ids como string', () => {
		expect(perfilDe('4', [4])).toBe('tarjeta');
	});

	it('sin entidad es ventanilla', () => {
		expect(perfilDe(null, [4])).toBe('ventanilla');
	});
});

describe('resumenTickets', () => {
	const t = (id, area, cerrado, fecha) => ({
		id,
		ticket_area_id: area,
		ticket_status_id: cerrado ? 3 : 1,
		deleted_at: null,
		created_at: fecha
	});

	it('cuenta abiertos y cerrados', () => {
		const r = resumenTickets(
			[t(1, 6, false, '2026-07-10T09:00:00.000000Z'), t(2, 6, true, '2026-06-01T09:00:00.000000Z')],
			{ areasSoporte: [6], estadosCerrados: [3] }
		);

		expect(r.abiertos).toBe(1);
		expect(r.cerrados).toBe(1);
	});

	it('el ultimo es el mas reciente', () => {
		const r = resumenTickets(
			[t(1, 6, false, '2026-06-01T09:00:00.000000Z'), t(2, 6, false, '2026-07-10T09:00:00.000000Z')],
			{ areasSoporte: [6], estadosCerrados: [3] }
		);

		expect(r.ultimo.id).toBe(2);
		expect(r.ultimo.fecha).toBe('2026-07-10T09:00:00.000000Z');
	});

	it('filtra por area de soporte', () => {
		const r = resumenTickets(
			[t(1, 6, false, '2026-07-10T09:00:00.000000Z'), t(2, 9, false, '2026-07-11T09:00:00.000000Z')],
			{ areasSoporte: [6], estadosCerrados: [3] }
		);

		expect(r.abiertos).toBe(1);
		expect(r.ultimo.id).toBe(1);
	});

	it('con areasSoporte vacio cuenta todas las areas', () => {
		const r = resumenTickets(
			[t(1, 6, false, '2026-07-10T09:00:00.000000Z'), t(2, 9, false, '2026-07-11T09:00:00.000000Z')],
			{ areasSoporte: [], estadosCerrados: [3] }
		);

		expect(r.abiertos).toBe(2);
	});

	it('ignora tickets borrados', () => {
		const borrado = { ...t(1, 6, false, '2026-07-10T09:00:00.000000Z'), deleted_at: '2026-07-11' };
		const r = resumenTickets([borrado], { areasSoporte: [6], estadosCerrados: [3] });

		expect(r.abiertos).toBe(0);
		expect(r.ultimo).toBeNull();
	});

	it('sin tickets devuelve ceros y ultimo null', () => {
		const r = resumenTickets([], { areasSoporte: [6], estadosCerrados: [3] });
		expect(r).toEqual({ abiertos: 0, cerrados: 0, ultimo: null });
	});

	it('tolera una entrada que no es array', () => {
		expect(resumenTickets(null, { areasSoporte: [], estadosCerrados: [3] })).toEqual({
			abiertos: 0,
			cerrados: 0,
			ultimo: null
		});
	});
});
```

- [ ] **Step 2: Verificar que fallan**

Run: `npx vitest run src/lib/cartera/normalizar.test.js`
Expected: FAIL — no existe `./normalizar.js`.

- [ ] **Step 3: Implementar**

```js
// src/lib/cartera/normalizar.js
/**
 * De las respuestas crudas de IspCube a la forma que guarda `cartera_clientes`.
 *
 * El cliente de IspCube trae ~80 campos; el snapshot guarda ocho. Esta capa
 * existe para que ni la UI ni las alertas sepan como es el JSON de la API.
 */
import { toTitleCase } from '$lib/formatName.js';

/**
 * Un cliente de `GET /api/customer`, reducido a lo que usa la Cartera.
 *
 * @param {any} crudo
 * @returns {{code: string, nombre: string, estado: string, start_date: string,
 *   entity_id: number | null, entity_nombre: string, debt: number, duedebt: number}}
 */
export function normalizarCliente(crudo) {
	const c = crudo ?? {};

	return {
		code: typeof c.code === 'string' ? c.code : '',
		nombre: typeof c.name === 'string' ? toTitleCase(c.name) : '',
		estado: typeof c.status === 'string' ? c.status : '',
		// `start_date` viene como "2026-05-01 00:00:00"; el snapshot guarda la
		// fecha sola porque la hora nunca es significativa.
		start_date: typeof c.start_date === 'string' ? c.start_date.slice(0, 10) : '',
		entity_id: c.entity_id ?? null,
		entity_nombre: typeof c.entity?.name === 'string' ? c.entity.name : '',
		debt: Number(c.debt) || 0,
		duedebt: Number(c.duedebt) || 0
	};
}

/**
 * Medio de pago del cliente.
 *
 * En IspCube no hay campo `payment_method`: el medio de pago ES la entidad de
 * cobranza (`entity_id`). Que entidades son tarjeta se configura en
 * `cartera_config`, no se adivina.
 *
 * Con la lista vacia todos caen en `ventanilla`. Es deliberado: el panel
 * funciona antes de configurarse, solo que sin distinguir tarjetas.
 *
 * @param {unknown} entityId
 * @param {unknown[]} entidadesTarjeta
 * @returns {'ventanilla' | 'tarjeta'}
 */
export function perfilDe(entityId, entidadesTarjeta) {
	if (entityId === null || entityId === undefined) return 'ventanilla';
	if (!Array.isArray(entidadesTarjeta) || entidadesTarjeta.length === 0) return 'ventanilla';

	// Los ids pueden venir como number de la API y como string de la config.
	const id = String(entityId);
	return entidadesTarjeta.some((e) => String(e) === id) ? 'tarjeta' : 'ventanilla';
}

/**
 * Resumen de los tickets de un cliente.
 *
 * @param {unknown} tickets Respuesta de `getTickets`
 * @param {{areasSoporte: unknown[], estadosCerrados: unknown[]}} opciones
 *   `areasSoporte` vacio significa "todas las areas" — el default antes de que
 *   alguien configure `cartera_config`.
 * @returns {{abiertos: number, cerrados: number, ultimo: {id: unknown, fecha: string, categoria: unknown, estado: unknown} | null}}
 */
export function resumenTickets(tickets, { areasSoporte, estadosCerrados }) {
	if (!Array.isArray(tickets)) return { abiertos: 0, cerrados: 0, ultimo: null };

	const filtraArea = Array.isArray(areasSoporte) && areasSoporte.length > 0;
	const areas = filtraArea ? areasSoporte.map(String) : [];
	const cerrados = (Array.isArray(estadosCerrados) ? estadosCerrados : []).map(String);

	let nAbiertos = 0;
	let nCerrados = 0;
	/** @type {any} */
	let ultimo = null;

	for (const t of tickets) {
		if (!t || t.deleted_at) continue;
		if (filtraArea && !areas.includes(String(t.ticket_area_id))) continue;

		if (cerrados.includes(String(t.ticket_status_id))) nCerrados++;
		else nAbiertos++;

		const fecha = typeof t.created_at === 'string' ? t.created_at : '';
		if (fecha && (!ultimo || fecha > ultimo.fecha)) {
			ultimo = {
				id: t.id,
				fecha,
				categoria: t.ticket_category_id ?? null,
				estado: t.ticket_status_id ?? null
			};
		}
	}

	return { abiertos: nAbiertos, cerrados: nCerrados, ultimo };
}
```

- [ ] **Step 4: Verificar que pasan**

Run: `npx vitest run src/lib/cartera/normalizar.test.js`
Expected: PASS, 20 tests.

- [ ] **Step 5: Correr toda la suite y commitear**

```bash
npx vitest run
git add src/lib/cartera/normalizar.js src/lib/cartera/normalizar.test.js
git commit -m "feat: normalizacion de las respuestas de IspCube para la Cartera"
```

---

## Fase 3 — Endpoints

### Task 9: `adminAuth.js` — la guardia de los endpoints

Sin esto, `/api/cartera/cliente/003566` sería un enumerador público de la base de clientes de Sista.

**Files:**
- Create: `src/lib/server/adminAuth.js`
- Test: `src/lib/server/adminAuth.test.js`

- [ ] **Step 1: Escribir los tests que fallan**

```js
// src/lib/server/adminAuth.test.js
import { describe, it, expect } from 'vitest';
import { verificarAsesor } from './adminAuth.js';

const PB = 'https://sista.pockethost.io';

const res = (status, body) => ({
	ok: status >= 200 && status < 300,
	status,
	json: async () => body
});

const pedido = (auth) => ({ headers: { get: (k) => (k.toLowerCase() === 'authorization' ? auth : null) } });

describe('verificarAsesor', () => {
	it('devuelve el id del asesor con un token valido', async () => {
		const r = await verificarAsesor(pedido('Bearer tok-123'), PB, {
			fetchImpl: async () => res(200, { record: { id: 'user-1' }, token: 'tok-nuevo' })
		});

		expect(r).toEqual({ ok: true, asesorId: 'user-1' });
	});

	it('manda el token a PocketBase en el header Authorization', async () => {
		const calls = [];
		await verificarAsesor(pedido('Bearer tok-123'), PB, {
			fetchImpl: async (url, init) => {
				calls.push({ url, init });
				return res(200, { record: { id: 'user-1' } });
			}
		});

		expect(calls[0].url).toBe(`${PB}/api/collections/users/auth-refresh`);
		expect(calls[0].init.headers.Authorization).toBe('tok-123');
	});

	it('rechaza cuando no hay header', async () => {
		const r = await verificarAsesor(pedido(null), PB, { fetchImpl: async () => res(200, {}) });
		expect(r).toEqual({ ok: false, reason: 'sin_token' });
	});

	it('rechaza un header que no es Bearer', async () => {
		const r = await verificarAsesor(pedido('Basic abc'), PB, { fetchImpl: async () => res(200, {}) });
		expect(r).toEqual({ ok: false, reason: 'sin_token' });
	});

	it('rechaza un token que PocketBase no valida', async () => {
		const r = await verificarAsesor(pedido('Bearer viejo'), PB, {
			fetchImpl: async () => res(401, { message: 'no' })
		});

		expect(r).toEqual({ ok: false, reason: 'token_invalido' });
	});

	it('rechaza si PocketBase responde sin record', async () => {
		const r = await verificarAsesor(pedido('Bearer tok'), PB, {
			fetchImpl: async () => res(200, {})
		});

		expect(r).toEqual({ ok: false, reason: 'token_invalido' });
	});

	it('devuelve reason network si no se pudo preguntar', async () => {
		const r = await verificarAsesor(pedido('Bearer tok'), PB, {
			fetchImpl: async () => {
				throw new Error('ECONNRESET');
			}
		});

		expect(r).toEqual({ ok: false, reason: 'network' });
	});
});
```

- [ ] **Step 2: Verificar que fallan**

Run: `npx vitest run src/lib/server/adminAuth.test.js`
Expected: FAIL — no existe `./adminAuth.js`.

- [ ] **Step 3: Implementar**

```js
// src/lib/server/adminAuth.js
/**
 * Guardia de los endpoints de administracion.
 *
 * Hasta ahora ningun endpoint del servidor autenticaba administradores: el
 * panel lee PocketBase directo desde el navegador y la seguridad la ponen las
 * reglas de la coleccion. Los endpoints de la Cartera son distintos: hacen de
 * proxy a IspCube, y sin guardia
 * `GET /api/cartera/cliente/003566` seria un enumerador publico de la base de
 * clientes de Sista.
 *
 * El token de PocketBase se valida contra el propio PocketBase en vez de
 * verificar el JWT localmente: no tenemos su secreto de firma, y ademas asi
 * una sesion revocada deja de funcionar en el acto.
 *
 * Como el resto de `src/lib/server/`, no lee `$env`: la URL entra por
 * parametro.
 */

/**
 * @param {{headers: {get: (name: string) => string | null}}} request
 * @param {string} pocketbaseUrl
 * @param {{ fetchImpl?: typeof fetch }} [options]
 * @returns {Promise<{ok: true, asesorId: string} | {ok: false, reason: string}>}
 *   `reason` puede ser `sin_token`, `token_invalido` o `network`.
 */
export async function verificarAsesor(request, pocketbaseUrl, { fetchImpl = fetch } = {}) {
	const header = request?.headers?.get('authorization') ?? null;
	if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
		return { ok: false, reason: 'sin_token' };
	}

	const token = header.slice('Bearer '.length).trim();
	if (!token) return { ok: false, reason: 'sin_token' };

	const url = `${pocketbaseUrl.replace(/\/+$/, '')}/api/collections/users/auth-refresh`;

	try {
		const res = await fetchImpl(url, {
			method: 'POST',
			// PocketBase espera el token pelado en Authorization, sin el "Bearer".
			headers: { 'Content-Type': 'application/json', Authorization: token },
			signal: AbortSignal.timeout(10_000)
		});

		if (!res.ok) return { ok: false, reason: 'token_invalido' };

		const data = await res.json();
		const asesorId = data?.record?.id;
		if (typeof asesorId !== 'string' || !asesorId) {
			return { ok: false, reason: 'token_invalido' };
		}

		return { ok: true, asesorId };
	} catch (error) {
		console.error('[adminAuth] no se pudo validar el token:', error);
		return { ok: false, reason: 'network' };
	}
}
```

- [ ] **Step 4: Verificar que pasan**

Run: `npx vitest run src/lib/server/adminAuth.test.js`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/adminAuth.js src/lib/server/adminAuth.test.js
git commit -m "feat: guardia de autenticacion para los endpoints de admin"
```

---

### Task 10: Endpoint de catálogos

**Files:**
- Create: `src/routes/api/cartera/catalogos/+server.js`
- Modify: `src/lib/server/ispcubeDeps.js`

- [ ] **Step 1: Agregar la URL de PocketBase a las deps del servidor**

En `src/lib/server/ispcubeDeps.js`, agregá al final:

```js
/**
 * URL de PocketBase para validar tokens de admin desde el servidor.
 *
 * `VITE_POCKETBASE_URL` ya existe y es la misma instancia que usa el navegador;
 * se reusa para no duplicar configuracion. El default replica el de
 * `src/lib/pocketbase.js`.
 *
 * @returns {string}
 */
export function pocketbaseUrl() {
	return env.VITE_POCKETBASE_URL || 'https://sista.pockethost.io';
}
```

- [ ] **Step 2: Escribir el endpoint**

```js
// src/routes/api/cartera/catalogos/+server.js
/**
 * Catalogos de IspCube que la Cartera necesita para configurarse: entidades de
 * cobranza (el medio de pago) y areas de tickets.
 *
 * Se cachean en memoria del proceso porque son estables y la API de IspCube se
 * factura por request: sin cache, cada apertura de la pantalla de configuracion
 * gastaria dos llamadas de la cuota mensual.
 */
import { json } from '@sveltejs/kit';
import { getCatalogos } from '$lib/server/ispcube.js';
import { ispcubeConfig, pocketbaseUrl } from '$lib/server/ispcubeDeps.js';
import { verificarAsesor } from '$lib/server/adminAuth.js';

export const prerender = false;
export const trailingSlash = 'ignore';

/** Vida del cache en memoria. Los catalogos cambian con muy baja frecuencia. */
const TTL_MS = 60 * 60 * 1000;

/** @type {{datos: any, expira: number} | null} */
let cache = null;

/** @type {import('./$types').RequestHandler} */
export async function GET({ request }) {
	const auth = await verificarAsesor(request, pocketbaseUrl());
	if (!auth.ok) return json({ error: auth.reason }, { status: 401 });

	if (cache && cache.expira > Date.now()) {
		return json({ ...cache.datos, cacheado: true });
	}

	const r = await getCatalogos(ispcubeConfig());
	if (!r.ok) return json({ error: r.reason }, { status: 502 });

	const datos = {
		entidades: r.entidades.map((e) => ({ id: e.id, nombre: e.name })),
		areas: r.areas.map((a) => ({ id: a.id, nombre: a.name }))
	};
	cache = { datos, expira: Date.now() + TTL_MS };

	return json({ ...datos, cacheado: false });
}
```

- [ ] **Step 3: Verificar que el proyecto sigue compilando**

```bash
npx vitest run
npm run build:node
```

Expected: la suite verde y el build sin errores. Si el build se queja de `$types`, ignoralo: SvelteKit los genera al arrancar `npm run dev` o al buildear.

- [ ] **Step 4: Commit**

```bash
git add src/routes/api/cartera/catalogos/+server.js src/lib/server/ispcubeDeps.js
git commit -m "feat: endpoint de catalogos de IspCube para la Cartera"
```

---

### Task 11: Endpoint de detalle de cliente

**Files:**
- Create: `src/routes/api/cartera/cliente/[code]/+server.js`

- [ ] **Step 1: Escribir el endpoint**

```js
// src/routes/api/cartera/cliente/[code]/+server.js
/**
 * Detalle en vivo de un cliente para la Cartera: datos, tickets y cobranzas.
 *
 * Cuesta 3 requests de la cuota de IspCube (mas 0 de auth gracias al cache de
 * token). Es la unica pantalla que consulta en vivo; la lista se sirve del
 * snapshot en PocketBase.
 *
 * Solo lectura: no escribe en IspCube ni en PocketBase. Quien guarda el
 * snapshot actualizado es el navegador, con el token del propio asesor.
 */
import { json } from '@sveltejs/kit';
import { getCustomerByCode, getTickets, getCobranzas } from '$lib/server/ispcube.js';
import { ispcubeConfig, pocketbaseUrl } from '$lib/server/ispcubeDeps.js';
import { verificarAsesor } from '$lib/server/adminAuth.js';
import { normalizarCliente, resumenTickets } from '$lib/cartera/normalizar.js';
import { pagosDeCobranzas } from '$lib/cartera/pagos.js';

export const prerender = false;
export const trailingSlash = 'ignore';

/** @type {import('./$types').RequestHandler} */
export async function GET({ request, params, url }) {
	const auth = await verificarAsesor(request, pocketbaseUrl());
	if (!auth.ok) return json({ error: auth.reason }, { status: 401 });

	const cfg = ispcubeConfig();

	// `getCustomerByCode` valida el formato del code y devuelve `not_found`
	// tanto para un codigo mal formado como para uno inexistente, a proposito.
	const cliente = await getCustomerByCode(params.code, cfg);
	if (!cliente.ok) {
		const status = cliente.reason === 'not_found' ? 404 : 502;
		return json({ error: cliente.reason }, { status });
	}

	// Las areas de soporte llegan del cliente porque viven en `cartera_config`,
	// que es de PocketBase. Vacio = todas las areas.
	const areasSoporte = parseIds(url.searchParams.get('areas'));
	const estadosCerrados = parseIds(url.searchParams.get('cerrados'));

	const [tickets, cobranzas] = await Promise.all([
		getTickets(params.code, cfg),
		getCobranzas(params.code, cfg)
	]);

	return json({
		cliente: normalizarCliente(cliente.customer.crudo ?? cliente.customer),
		tickets: tickets.ok
			? { ...resumenTickets(tickets.tickets, { areasSoporte, estadosCerrados }), lista: tickets.tickets }
			: { error: tickets.reason },
		pagos: cobranzas.ok ? pagosDeCobranzas(cobranzas.cobranzas) : { error: cobranzas.reason }
	});
}

/**
 * `"6,9"` -> `[6, 9]`. Una lista vacia significa "sin filtro".
 *
 * @param {string | null} valor
 * @returns {number[]}
 */
function parseIds(valor) {
	if (!valor) return [];
	return valor
		.split(',')
		.map((v) => Number(v.trim()))
		.filter((n) => Number.isFinite(n));
}
```

- [ ] **Step 2: Ampliar `getCustomerByCode` para que devuelva el cliente crudo**

El endpoint necesita `entity_id`, `entity.name`, `start_date`, `debt` y `duedebt`, y hoy `getCustomerByCode` solo devuelve `code`, `name` y `status`. En `src/lib/server/ispcube.js`, en el `return` final de `getCustomerByCode` (líneas 257-265), agregá el campo `crudo`:

```js
	return {
		ok: true,
		customer: {
			code: typeof data.code === 'string' ? data.code : code,
			name: data.name,
			status: typeof data.status === 'string' ? data.status : '',
			// La respuesta completa, para quien necesite mas que el nombre. La
			// pantalla de puntos solo usa los tres campos de arriba; la Cartera
			// necesita entity_id, start_date y las deudas.
			crudo: data
		}
	};
```

- [ ] **Step 3: Agregar el test de que `crudo` viaja**

En `src/lib/server/ispcube.test.js`, dentro del describe de `getCustomerByCode`:

```js
	it('devuelve la respuesta cruda para quien necesite mas campos', async () => {
		const data = { code: '003566', name: 'ANA', status: 'enabled', entity_id: 4, debt: '100.00' };
		const r = await getCustomerByCode('003566', CONFIG, {
			fetchImpl: fakeFetch([res(200, { token: 'tok' }), res(200, data)])
		});

		expect(r.ok).toBe(true);
		expect(r.customer.crudo.entity_id).toBe(4);
		expect(r.customer.crudo.debt).toBe('100.00');
	});
```

- [ ] **Step 4: Verificar**

```bash
npx vitest run
```

Expected: PASS. Los tests existentes de `getCustomerByCode` que usan `toEqual` sobre `customer` van a fallar por el campo nuevo — si alguno falla, cambialo a comprobar campo por campo (`expect(r.customer.name).toBe(...)`), que es más robusto ante agregados.

- [ ] **Step 5: Commit**

```bash
git add src/routes/api/cartera/cliente src/lib/server/ispcube.js src/lib/server/ispcube.test.js
git commit -m "feat: endpoint de detalle de cliente de la Cartera"
```

---

### Task 12: Endpoint de sincronización

**Files:**
- Create: `src/routes/api/cartera/sync/+server.js`

- [ ] **Step 1: Escribir el endpoint**

```js
// src/routes/api/cartera/sync/+server.js
/**
 * Devuelve snapshots frescos para una lista de numeros de cliente.
 *
 * NO escribe en PocketBase: el navegador guarda el resultado con el token del
 * propio asesor, y asi las reglas de la coleccion (`asesor = @request.auth.id`)
 * siguen siendo la unica autorizacion. El servidor no necesita una cuenta de
 * servicio con permisos amplios.
 *
 * Estrategia por-cliente: 3 requests de IspCube por codigo. El spec documenta
 * una estrategia en bloque mucho mas barata; si el sondeo de la Task 1 la
 * habilita, se reemplaza el cuerpo de `snapshotDe` y el contrato no cambia.
 */
import { json } from '@sveltejs/kit';
import { getCustomerByCode, getTickets, getCobranzas } from '$lib/server/ispcube.js';
import { ispcubeConfig, pocketbaseUrl } from '$lib/server/ispcubeDeps.js';
import { verificarAsesor } from '$lib/server/adminAuth.js';
import { normalizarCliente, resumenTickets } from '$lib/cartera/normalizar.js';
import { pagosDeCobranzas } from '$lib/cartera/pagos.js';

export const prerender = false;
export const trailingSlash = 'ignore';

/**
 * Tope de codigos por request. Es el limite duro del gasto de cuota que puede
 * provocar una sola llamada: 20 codigos x 3 requests = 60.
 */
const MAX_CODIGOS = 20;

/** Cuantos clientes se consultan en paralelo, para no ametrallar a IspCube. */
const CONCURRENCIA = 4;

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
	const auth = await verificarAsesor(request, pocketbaseUrl());
	if (!auth.ok) return json({ error: auth.reason }, { status: 401 });

	/** @type {any} */
	let body;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'body_invalido' }, { status: 400 });
	}

	const codes = Array.isArray(body?.codes) ? body.codes.filter((c) => typeof c === 'string') : [];
	if (codes.length === 0) return json({ error: 'sin_codigos' }, { status: 400 });
	if (codes.length > MAX_CODIGOS) return json({ error: 'demasiados_codigos' }, { status: 400 });

	const areasSoporte = Array.isArray(body?.areasSoporte) ? body.areasSoporte : [];
	const estadosCerrados = Array.isArray(body?.estadosCerrados) ? body.estadosCerrados : [];
	const cfg = ispcubeConfig();

	const resultados = await enTandas(codes, CONCURRENCIA, (code) =>
		snapshotDe(code, cfg, { areasSoporte, estadosCerrados })
	);

	return json({ resultados });
}

/**
 * Snapshot de un cliente. Nunca lanza: un fallo se devuelve como
 * `{ok: false, reason}` para que un cliente roto no tumbe la sincronizacion de
 * los demas.
 *
 * @param {string} code
 * @param {import('$lib/server/ispcube.js').IspcubeConfig} cfg
 * @param {{areasSoporte: unknown[], estadosCerrados: unknown[]}} opciones
 */
async function snapshotDe(code, cfg, { areasSoporte, estadosCerrados }) {
	const cliente = await getCustomerByCode(code, cfg);
	if (!cliente.ok) return { code, ok: false, reason: cliente.reason };

	const [tickets, cobranzas] = await Promise.all([getTickets(code, cfg), getCobranzas(code, cfg)]);

	return {
		code,
		ok: true,
		datos: {
			...normalizarCliente(cliente.customer.crudo ?? cliente.customer),
			tickets: tickets.ok
				? resumenTickets(tickets.tickets, { areasSoporte, estadosCerrados })
				: null,
			pagos: cobranzas.ok ? pagosDeCobranzas(cobranzas.cobranzas) : null
		}
	};
}

/**
 * Corre `fn` sobre `items` con como mucho `n` en vuelo a la vez.
 *
 * @template T, R
 * @param {T[]} items
 * @param {number} n
 * @param {(item: T) => Promise<R>} fn
 * @returns {Promise<R[]>} En el mismo orden que `items`
 */
async function enTandas(items, n, fn) {
	const salida = new Array(items.length);
	let siguiente = 0;

	const trabajador = async () => {
		while (siguiente < items.length) {
			const i = siguiente++;
			salida[i] = await fn(items[i]);
		}
	};

	await Promise.all(Array.from({ length: Math.min(n, items.length) }, trabajador));
	return salida;
}
```

- [ ] **Step 2: Verificar que compila y la suite sigue verde**

```bash
npx vitest run
npm run build:node
```

Expected: ambos sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/routes/api/cartera/sync/+server.js
git commit -m "feat: endpoint de sincronizacion de snapshots de la Cartera"
```

---

## Fase 4 — PocketBase

### Task 13: Crear las colecciones

**Esta task es manual**, en el admin de PocketBase (`https://sista.pockethost.io/_/`). No hay migraciones versionadas en este repo.

- [ ] **Step 1: Crear `cartera_clientes`**

Tipo **Base**. Campos:

| Nombre | Tipo | Opciones |
|---|---|---|
| `asesor` | Relation | → `users`, single, **required**, cascade delete |
| `code` | Text | required, pattern `^\d{1,12}$` |
| `fecha_instalacion` | Text | required (formato `YYYY-MM-DD`) |
| `nombre` | Text | |
| `estado` | Text | |
| `start_date` | Text | |
| `entity_id` | Number | |
| `entity_nombre` | Text | |
| `perfil_pago` | Select | valores: `ventanilla`, `tarjeta`; single |
| `perfil_manual` | Bool | si está en true, la sincronización no pisa `perfil_pago` |
| `debt` | Number | |
| `duedebt` | Number | |
| `pagos` | JSON | |
| `tickets` | JSON | |
| `tickets_vistos_hasta` | Text | |
| `ultimo_contacto` | Text | `YYYY-MM-DD` del último contacto real; apaga la alerta de los 2 meses |
| `sincronizado` | Text | ISO del último refresco |
| `archivado` | Bool | |

`ultimo_contacto` está desnormalizado a propósito: la bitácora completa vive en `cartera_notas`, pero la lista muestra hasta 500 clientes y calcular la alerta de seguimiento leyendo las notas sería una consulta a PocketBase por fila. El store lo actualiza cada vez que se guarda una nota de tipo `llamada`, `whatsapp` o `visita`.

`fecha_instalacion` y las demás fechas van como Text en formato `YYYY-MM-DD` a propósito: el módulo `cartera/fechas.js` las parsea como texto para no arrastrar bugs de zona horaria, y el tipo Date de PocketBase agrega una hora que no significa nada.

**Índice único**, en la pestaña Indexes:

```sql
CREATE UNIQUE INDEX idx_cartera_asesor_code ON cartera_clientes (asesor, code)
```

**API Rules** — las cuatro iguales (List, View, Create, Update, Delete):

```
@request.auth.id != "" && asesor = @request.auth.id
```

En **Create**, además, para que nadie cree registros a nombre de otro:

```
@request.auth.id != "" && @request.body.asesor = @request.auth.id
```

- [ ] **Step 2: Crear `cartera_notas`**

| Nombre | Tipo | Opciones |
|---|---|---|
| `cliente` | Relation | → `cartera_clientes`, single, required, cascade delete |
| `autor` | Relation | → `users`, single, required |
| `tipo` | Select | `llamada`, `whatsapp`, `visita`, `nota`; single, required |
| `texto` | Text | required |

**API Rules** (List, View, Create, Update, Delete):

```
@request.auth.id != "" && cliente.asesor = @request.auth.id
```

- [ ] **Step 3: Crear `cartera_config`**

| Nombre | Tipo | Default |
|---|---|---|
| `entidades_tarjeta` | JSON | `[]` |
| `areas_soporte` | JSON | `[]` |
| `estados_cerrados` | JSON | `[]` |
| `dia_corte_1` | Number | |
| `dia_corte_2` | Number | |
| `dia_corte_tarjeta` | Number | |

**API Rules:** List y View con `@request.auth.id != ""` (cualquier asesor autenticado necesita leerla). Update con `@request.auth.id != ""` por ahora; cuando existan roles, restringir a admin.

Creá **un único registro** con los valores del sondeo de la Task 1:

- `dia_corte_1`: `10`
- `dia_corte_2`: `20`
- `dia_corte_tarjeta`: `21`
- `entidades_tarjeta`: los ids de entidad que el sondeo mostró como tarjeta
- `areas_soporte`: los ids de área de soporte
- `estados_cerrados`: los ids de estado que significan cerrado (de `/api/tickets/status_list`)

- [ ] **Step 4: Verificar las reglas**

Desde una ventana de incógnito, sin autenticar:

```bash
curl -s -o /dev/null -w "%{http_code}\n" "https://sista.pockethost.io/api/collections/cartera_clientes/records"
```

Expected: `403` o `404`. Si devuelve `200` con una lista, la regla de List quedó vacía — corregila antes de seguir.

- [ ] **Step 5: Anotar en el spec qué quedó configurado**

Agregá al spec, bajo los resultados del sondeo, los valores reales cargados en `cartera_config`. Commiteá el spec.

```bash
git add docs/superpowers/specs/2026-08-03-cartera-de-clientes-design.md
git commit -m "docs: valores de cartera_config cargados en PocketBase"
```

---

## Fase 5 — UI

### Task 14: El store de la Cartera

**Files:**
- Create: `src/routes/admin/_components/mantenimiento/Dashboard/cartera/carteraStore.svelte.js`
- Create: `src/lib/cartera/refresco.js`
- Test: `src/lib/cartera/refresco.test.js`

La política de refresco es lógica pura y va aparte, para poder testearla sin navegador.

- [ ] **Step 1: Escribir los tests de la política de refresco**

```js
// src/lib/cartera/refresco.test.js
import { describe, it, expect } from 'vitest';
import { aRefrescar } from './refresco.js';

const AHORA = new Date('2026-07-15T12:00:00Z').getTime();
const hace = (horas) => new Date(AHORA - horas * 3600_000).toISOString();

const cli = (code, sincronizado, extra = {}) => ({
	code,
	sincronizado,
	perfil_pago: 'ventanilla',
	...extra
});

describe('aRefrescar', () => {
	const config = { dia_corte_1: 10, dia_corte_2: 20, dia_corte_tarjeta: 21 };
	const hoy = { anio: 2026, mes: 7, dia: 15 };

	it('deja afuera los frescos', () => {
		const r = aRefrescar([cli('001', hace(2))], { ahora: AHORA, hoy, config });
		expect(r).toEqual([]);
	});

	it('incluye los de mas de 12 horas', () => {
		const r = aRefrescar([cli('001', hace(13))], { ahora: AHORA, hoy, config });
		expect(r).toEqual(['001']);
	});

	it('incluye los que nunca se sincronizaron', () => {
		const r = aRefrescar([cli('001', '')], { ahora: AHORA, hoy, config });
		expect(r).toEqual(['001']);
	});

	it('corta en 20 codigos', () => {
		const clientes = Array.from({ length: 30 }, (_, i) => cli(String(i).padStart(3, '0'), hace(20)));
		const r = aRefrescar(clientes, { ahora: AHORA, hoy, config });
		expect(r).toHaveLength(20);
	});

	it('prioriza a los que acaban de pasar su dia de corte', () => {
		// Hoy es 15; el corte de ventanilla fue el 10, hace 5 dias -> fuera de
		// ventana. Con corte el 13 (config alternativa) entraria primero.
		const clientes = [
			cli('viejo', hace(100)),
			cli('recien-vencido', hace(13), { perfil_pago: 'ventanilla' })
		];
		const r = aRefrescar(clientes, {
			ahora: AHORA,
			hoy: { anio: 2026, mes: 7, dia: 12 },
			config
		});

		// El dia 12 esta dentro de los 3 dias posteriores al corte del 10:
		// los dos son prioritarios, y desempata el mas viejo.
		expect(r[0]).toBe('viejo');
	});

	it('el prioritario le gana al mas viejo cuando solo uno esta en ventana', () => {
		const clientes = [
			cli('viejo-sin-riesgo', hace(100), { perfil_pago: 'tarjeta' }),
			cli('vencido-hace-poco', hace(13), { perfil_pago: 'ventanilla' })
		];
		// Dia 12: ventanilla vencio el 10 (dentro de 3 dias), tarjeta vence el 21.
		const r = aRefrescar(clientes, {
			ahora: AHORA,
			hoy: { anio: 2026, mes: 7, dia: 12 },
			config
		});

		expect(r[0]).toBe('vencido-hace-poco');
	});

	it('ignora los archivados', () => {
		const r = aRefrescar([cli('001', hace(50), { archivado: true })], { ahora: AHORA, hoy, config });
		expect(r).toEqual([]);
	});
});
```

- [ ] **Step 2: Verificar que fallan**

Run: `npx vitest run src/lib/cartera/refresco.test.js`
Expected: FAIL — no existe `./refresco.js`.

- [ ] **Step 3: Implementar**

```js
// src/lib/cartera/refresco.js
/**
 * Que clientes vale la pena refrescar al abrir la lista.
 *
 * La API de IspCube se factura por request, asi que abrir el panel no puede
 * costar "lo que haya en la cartera". Pero un snapshot viejo muestra moras
 * falsas: si el snapshot es del dia 5 y hoy es 12, la Cartera no sabe que el
 * cliente pago el 8.
 *
 * El equilibrio: refrescar solo lo vencido, con un tope duro, priorizando a
 * quienes acaban de pasar su dia de corte -que son justo los que podrian estar
 * mostrando una mora que no existe-.
 */
import { diaCorteDe } from './alertas.js';

/** Un snapshot mas nuevo que esto se considera fresco. */
const FRESCO_MS = 12 * 60 * 60 * 1000;

/** Tope de clientes a refrescar por apertura. Es el techo del gasto. */
const MAX_POR_APERTURA = 20;

/** Cuantos dias despues del corte un cliente sigue siendo prioritario. */
const DIAS_DE_RIESGO = 3;

/**
 * @param {any[]} clientes Registros de `cartera_clientes`
 * @param {{ahora: number, hoy: import('./fechas.js').Partes, config: import('./alertas.js').ConfigCartera}} opciones
 * @returns {string[]} Codigos a refrescar, en orden de prioridad
 */
export function aRefrescar(clientes, { ahora, hoy, config }) {
	const candidatos = [];

	for (const c of Array.isArray(clientes) ? clientes : []) {
		if (!c || c.archivado) continue;

		const ultima = c.sincronizado ? Date.parse(c.sincronizado) : NaN;
		const edad = Number.isFinite(ultima) ? ahora - ultima : Infinity;
		if (edad < FRESCO_MS) continue;

		const corte = diaCorteDe(c.perfil_pago, config);
		const desdeCorte = hoy.dia - corte;
		const enRiesgo = desdeCorte > 0 && desdeCorte <= DIAS_DE_RIESGO;

		candidatos.push({ code: c.code, edad, enRiesgo });
	}

	candidatos.sort((a, b) => {
		if (a.enRiesgo !== b.enRiesgo) return a.enRiesgo ? -1 : 1;
		return b.edad - a.edad;
	});

	return candidatos.slice(0, MAX_POR_APERTURA).map((c) => c.code);
}
```

- [ ] **Step 4: Verificar que pasan**

Run: `npx vitest run src/lib/cartera/refresco.test.js`
Expected: PASS, 7 tests.

- [ ] **Step 5: Escribir el store**

```js
// src/routes/admin/_components/mantenimiento/Dashboard/cartera/carteraStore.svelte.js
// Store con runes para la Cartera de clientes.
//
// La lista sale del snapshot en PocketBase (0 requests a IspCube). El refresco
// contra IspCube pasa por `/api/cartera/sync`, que devuelve datos frescos pero
// NO escribe: guardar es responsabilidad de este store, con el token del propio
// asesor, para que las reglas de la coleccion sigan siendo la unica
// autorizacion.
import { pb } from '$lib/pocketbase';
import { aRefrescar } from '$lib/cartera/refresco.js';
import { fusionarPagos } from '$lib/cartera/pagos.js';
import { alertasDe, TIPOS_CONTACTO } from '$lib/cartera/alertas.js';
import { perfilDe } from '$lib/cartera/normalizar.js';
import { partesFecha } from '$lib/cartera/fechas.js';

const CLIENTES = 'cartera_clientes';
const NOTAS = 'cartera_notas';
const CONFIG = 'cartera_config';

const CONFIG_DEFAULT = {
	entidades_tarjeta: [],
	areas_soporte: [],
	estados_cerrados: [],
	dia_corte_1: 10,
	dia_corte_2: 20,
	dia_corte_tarjeta: 21
};

let clientes = $state([]);
let config = $state({ ...CONFIG_DEFAULT });
let loading = $state(true);
let sincronizando = $state(false);
let error = $state('');

/** Partes de la fecha de hoy, en hora local. */
function hoyPartes() {
	const d = new Date();
	return { anio: d.getFullYear(), mes: d.getMonth() + 1, dia: d.getDate() };
}

/** Fecha de hoy como `YYYY-MM-DD`, sin pasar por toISOString (que es UTC). */
export function hoyISO() {
	const { anio, mes, dia } = hoyPartes();
	return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

async function cargarConfig() {
	try {
		const lista = await pb.collection(CONFIG).getList(1, 1);
		if (lista.items.length > 0) config = { ...CONFIG_DEFAULT, ...lista.items[0] };
	} catch (e) {
		// Sin config el panel funciona con los defaults: todos ventanilla, todas
		// las areas cuentan como soporte.
		console.error('[cartera] no se pudo leer la configuracion:', e);
	}
}

async function cargar() {
	loading = true;
	error = '';
	try {
		await cargarConfig();
		const res = await pb.collection(CLIENTES).getList(1, 500, {
			filter: 'archivado = false',
			sort: 'nombre'
		});
		clientes = res.items;
	} catch (e) {
		console.error(e);
		error = 'No se pudieron cargar los clientes.';
	} finally {
		loading = false;
	}

	// El refresco corre despues de mostrar la lista: la pantalla no espera por
	// IspCube.
	refrescarVencidos();
}

/** Alertas activas de un cliente, calculadas solo con su registro. */
export function alertasDeCliente(cliente) {
	return alertasDe(cliente, hoyPartes(), config);
}

async function refrescarVencidos() {
	const codes = aRefrescar(clientes, { ahora: Date.now(), hoy: hoyPartes(), config });
	if (codes.length > 0) await sincronizar(codes);
}

/**
 * Pide datos frescos para `codes` y guarda el snapshot.
 *
 * @param {string[]} codes
 */
async function sincronizar(codes) {
	if (codes.length === 0 || sincronizando) return;
	sincronizando = true;

	try {
		const res = await fetch('/api/cartera/sync', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${pb.authStore.token}`
			},
			body: JSON.stringify({
				codes,
				areasSoporte: config.areas_soporte,
				estadosCerrados: config.estados_cerrados
			})
		});

		if (!res.ok) throw new Error(`sync respondio ${res.status}`);
		const { resultados } = await res.json();

		for (const r of resultados) {
			if (!r.ok) continue;
			await guardarSnapshot(r.code, r.datos);
		}
	} catch (e) {
		// Un fallo de sincronizacion no rompe el panel: queda el snapshot viejo,
		// y la UI muestra de cuando son los datos.
		console.error('[cartera] fallo la sincronizacion:', e);
	} finally {
		sincronizando = false;
	}
}

async function guardarSnapshot(code, datos) {
	const actual = clientes.find((c) => c.code === code);
	if (!actual) return;

	const perfil = actual.perfil_manual
		? actual.perfil_pago
		: perfilDe(datos.entity_id, config.entidades_tarjeta);

	const parche = {
		nombre: datos.nombre,
		estado: datos.estado,
		start_date: datos.start_date,
		entity_id: datos.entity_id,
		entity_nombre: datos.entity_nombre,
		perfil_pago: perfil,
		debt: datos.debt,
		duedebt: datos.duedebt,
		sincronizado: new Date().toISOString()
	};

	// Los pagos se fusionan, no se reemplazan: la API devuelve las ultimas 6
	// cobranzas y reemplazar iria borrando el historial mes a mes.
	if (datos.pagos) {
		parche.pagos = fusionarPagos(actual.pagos, datos.pagos, hoyPartes());
	}
	if (datos.tickets) parche.tickets = datos.tickets;

	try {
		const guardado = await pb.collection(CLIENTES).update(actual.id, parche);
		clientes = clientes.map((c) => (c.id === guardado.id ? guardado : c));
	} catch (e) {
		console.error('[cartera] no se pudo guardar el snapshot de', code, e);
	}
}

/**
 * Agrega un cliente a la cartera del asesor logueado.
 *
 * @param {string} code
 * @param {string} fechaInstalacion `YYYY-MM-DD`
 * @returns {Promise<{ok: true, cliente: any} | {ok: false, error: string}>}
 */
async function agregar(code, fechaInstalacion) {
	if (!/^\d{1,12}$/.test(code)) {
		return { ok: false, error: 'El número de cliente son solo dígitos.' };
	}
	if (!partesFecha(fechaInstalacion)) {
		return { ok: false, error: 'Falta la fecha de instalación.' };
	}
	if (clientes.some((c) => c.code === code)) {
		return { ok: false, error: 'Ese cliente ya está en tu cartera.' };
	}

	try {
		const res = await fetch(`/api/cartera/cliente/${encodeURIComponent(code)}`, {
			headers: { Authorization: `Bearer ${pb.authStore.token}` }
		});

		if (res.status === 404) return { ok: false, error: 'No encontramos ese número de cliente.' };
		if (!res.ok) return { ok: false, error: 'No pudimos consultar IspCube. Probá de nuevo.' };

		const datos = await res.json();

		const registro = {
			asesor: pb.authStore.record.id,
			code,
			fecha_instalacion: fechaInstalacion,
			nombre: datos.cliente.nombre,
			estado: datos.cliente.estado,
			start_date: datos.cliente.start_date,
			entity_id: datos.cliente.entity_id,
			entity_nombre: datos.cliente.entity_nombre,
			perfil_pago: perfilDe(datos.cliente.entity_id, config.entidades_tarjeta),
			perfil_manual: false,
			debt: datos.cliente.debt,
			duedebt: datos.cliente.duedebt,
			pagos: Array.isArray(datos.pagos) ? datos.pagos : [],
			tickets: datos.tickets?.error ? null : datos.tickets,
			tickets_vistos_hasta: '',
			ultimo_contacto: '',
			sincronizado: new Date().toISOString(),
			archivado: false
		};

		const creado = await pb.collection(CLIENTES).create(registro);
		clientes = [...clientes, creado].sort((a, b) => a.nombre.localeCompare(b.nombre));
		return { ok: true, cliente: creado };
	} catch (e) {
		console.error(e);
		return { ok: false, error: 'No se pudo agregar el cliente.' };
	}
}

/** Notas de un cliente, de la más nueva a la más vieja. */
async function notasDe(clienteId) {
	const res = await pb.collection(NOTAS).getList(1, 100, {
		filter: `cliente = "${clienteId}"`,
		sort: '-created'
	});
	return res.items;
}

/**
 * Guarda una nota y, si es de tipo contacto, actualiza la marca
 * `ultimo_contacto` del cliente.
 *
 * Esa marca es lo que apaga la alerta de los 2 meses. Existe desnormalizada
 * porque la lista muestra hasta 500 clientes y calcular la alerta leyendo las
 * notas seria una consulta a PocketBase por fila.
 */
async function agregarNota(clienteId, tipo, texto) {
	const nota = await pb.collection(NOTAS).create({
		cliente: clienteId,
		autor: pb.authStore.record.id,
		tipo,
		texto
	});

	if (TIPOS_CONTACTO.includes(tipo)) {
		try {
			const guardado = await pb
				.collection(CLIENTES)
				.update(clienteId, { ultimo_contacto: hoyISO() });
			clientes = clientes.map((c) => (c.id === guardado.id ? guardado : c));
		} catch (e) {
			// La nota ya quedo guardada; solo falla la marca. La alerta seguiria
			// encendida, que es el lado seguro del error.
			console.error('[cartera] no se pudo actualizar ultimo_contacto:', e);
		}
	}

	return nota;
}

/** Marca los tickets del cliente como vistos: apaga la alerta de tickets. */
async function marcarTicketsVistos(cliente) {
	const marca = new Date().toISOString();
	try {
		const guardado = await pb
			.collection(CLIENTES)
			.update(cliente.id, { tickets_vistos_hasta: marca });
		clientes = clientes.map((c) => (c.id === guardado.id ? guardado : c));
	} catch (e) {
		console.error('[cartera] no se pudo marcar los tickets como vistos:', e);
	}
}

async function archivar(cliente) {
	try {
		await pb.collection(CLIENTES).update(cliente.id, { archivado: true });
		clientes = clientes.filter((c) => c.id !== cliente.id);
	} catch (e) {
		console.error(e);
		error = 'No se pudo archivar el cliente.';
		setTimeout(() => (error = ''), 3000);
	}
}

export const carteraStore = {
	get clientes() {
		return clientes;
	},
	get config() {
		return config;
	},
	get loading() {
		return loading;
	},
	get sincronizando() {
		return sincronizando;
	},
	get error() {
		return error;
	},
	cargar,
	sincronizar,
	agregar,
	notasDe,
	agregarNota,
	marcarTicketsVistos,
	archivar
};
```

- [ ] **Step 6: Verificar y commitear**

```bash
npx vitest run
```

Expected: PASS.

```bash
git add src/lib/cartera/refresco.js src/lib/cartera/refresco.test.js src/routes/admin/_components/mantenimiento/Dashboard/cartera/carteraStore.svelte.js
git commit -m "feat: store y politica de refresco de la Cartera"
```

---

### Task 15: La lista

**Files:**
- Create: `src/routes/admin/_components/mantenimiento/Dashboard/cartera/Cartera.svelte`

- [ ] **Step 1: Escribir el componente**

```svelte
<!-- src/routes/admin/_components/mantenimiento/Dashboard/cartera/Cartera.svelte -->
<script>
import { onMount } from 'svelte';
import Spinner from '$lib/components/ui/Spinner.svelte';
import { carteraStore } from './carteraStore.svelte.js';
import AgregarCliente from './AgregarCliente.svelte';
import ClienteDetalle from './ClienteDetalle.svelte';
import { puntosPorMes } from '$lib/cartera/pagos.js';
import { diaCorteDe } from '$lib/cartera/alertas.js';
import { partesFecha } from '$lib/cartera/fechas.js';

const clientes = $derived(carteraStore.clientes);
const loading = $derived(carteraStore.loading);
const config = $derived(carteraStore.config);

let busqueda = $state('');
let filtro = $state('todos');
let abierto = $state(null);
let agregando = $state(false);

// Las alertas salen del registro del cliente y nada mas: la de seguimiento usa
// `ultimo_contacto`, que el store mantiene al guardar una nota de contacto. Sin
// eso, saber si alguien ya llamo costaria una consulta por fila.
const conAlertas = $derived(
    clientes.map((c) => ({ cliente: c, alertas: carteraStore.alertasDeCliente(c) }))
);

const FILTROS = [
    { value: 'todos', label: 'Todos' },
    { value: 'alerta', label: 'Con alerta' },
    { value: 'seguimiento', label: 'Seguimiento 2 meses' },
    { value: 'mora', label: 'En mora' },
    { value: 'tickets', label: 'Tickets nuevos' }
];

const visibles = $derived(
    conAlertas.filter(({ cliente, alertas }) => {
        const q = busqueda.trim().toLowerCase();
        if (q && !cliente.nombre.toLowerCase().includes(q) && !cliente.code.includes(q)) return false;

        if (filtro === 'todos') return true;
        if (filtro === 'alerta') return alertas.length > 0;
        if (filtro === 'mora') return alertas.some((a) => a.tipo.startsWith('mora'));
        return alertas.some((a) => a.tipo === filtro);
    })
);

const ETIQUETAS = {
    seguimiento: 'Contactar (2 meses)',
    mora_1: 'No pagó',
    mora_2: 'Mora vencida',
    tickets: 'Tickets nuevos'
};

function puntosDe(cliente) {
    const instalacion = partesFecha(cliente.fecha_instalacion);
    if (!instalacion) return [];
    const d = new Date();
    return puntosPorMes(cliente.pagos ?? [], {
        perfil: cliente.perfil_pago,
        diaCorte: diaCorteDe(cliente.perfil_pago, config),
        instalacion,
        hoy: { anio: d.getFullYear(), mes: d.getMonth() + 1, dia: d.getDate() },
        meses: 6
    });
}

function desdeCuando(iso) {
    if (!iso) return 'nunca';
    const horas = Math.floor((Date.now() - Date.parse(iso)) / 3600_000);
    if (!Number.isFinite(horas)) return 'nunca';
    if (horas < 1) return 'recién';
    if (horas < 24) return `hace ${horas} h`;
    return `hace ${Math.floor(horas / 24)} d`;
}

onMount(() => carteraStore.cargar());
</script>

<section>
    <header>
        <h2>Cartera de clientes</h2>
        <button class="agregar" onclick={() => (agregando = true)}>+ Agregar cliente</button>
    </header>

    <div class="controles">
        <input type="search" placeholder="Buscar por nombre o número" bind:value={busqueda} />
        <div class="filtros">
            {#each FILTROS as f}
                <button class:activo={filtro === f.value} onclick={() => (filtro = f.value)}>
                    {f.label}
                </button>
            {/each}
        </div>
    </div>

    {#if carteraStore.error}
        <p class="error">{carteraStore.error}</p>
    {/if}

    {#if loading}
        <Spinner />
    {:else if visibles.length === 0}
        <p class="vacio">
            {clientes.length === 0
                ? 'Todavía no agregaste clientes a tu cartera.'
                : 'Ningún cliente coincide con el filtro.'}
        </p>
    {:else}
        <ul class="lista">
            {#each visibles as { cliente, alertas } (cliente.id)}
                <li class:con-alerta={alertas.length > 0}>
                    <button class="fila" onclick={() => (abierto = cliente)}>
                        <div class="quien">
                            <strong>{cliente.nombre}</strong>
                            <span class="code">#{cliente.code}</span>
                        </div>

                        <div class="pagos" title="Últimos 6 meses">
                            {#each puntosDe(cliente) as p}
                                <span class="punto {p.estado}" title="{p.mes}{p.dia ? ` · día ${p.dia}` : ''}"></span>
                            {/each}
                        </div>

                        <div class="alertas">
                            {#each alertas as a}
                                <span class="chip {a.tipo}">{ETIQUETAS[a.tipo]}</span>
                            {/each}
                        </div>

                        <span class="sync">{desdeCuando(cliente.sincronizado)}</span>
                    </button>
                </li>
            {/each}
        </ul>
    {/if}

    {#if agregando}
        <AgregarCliente onCerrar={() => (agregando = false)} />
    {/if}

    {#if abierto}
        <ClienteDetalle cliente={abierto} onCerrar={() => (abierto = null)} />
    {/if}
</section>

<style>
section { padding: 1.5em 2em; }
header { display: flex; align-items: center; justify-content: space-between; gap: 1em; }
h2 { color: var(--violeta2); margin: 0; }
.agregar {
    background: var(--violeta2); color: #fff; border: none; border-radius: 2em;
    padding: 0.7em 1.4em; font-size: 1em; font-weight: 600; cursor: pointer;
}
.controles { display: flex; flex-wrap: wrap; gap: 1em; margin: 1.5em 0; align-items: center; }
input[type='search'] {
    flex: 1 1 18em; padding: 0.7em 1em; border: 2px solid #e5e7eb;
    border-radius: 0.8em; font-size: 1em; font-family: inherit;
}
input[type='search']:focus { outline: none; border-color: var(--violeta2); }
.filtros { display: flex; flex-wrap: wrap; gap: 0.4em; }
.filtros button {
    border: 1.5px solid #e0e0e0; background: #fff; color: var(--violeta2);
    border-radius: 2em; padding: 0.45em 1em; cursor: pointer; font-size: 0.92em;
}
.filtros button.activo { background: var(--violeta2); color: #fff; border-color: var(--violeta2); }
.lista { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.5em; }
li { border: 1.5px solid #ececec; border-radius: 1em; background: #fff; }
li.con-alerta { border-color: #f0c674; }
.fila {
    width: 100%; display: grid; grid-template-columns: 1fr auto auto auto;
    align-items: center; gap: 1.2em; padding: 0.9em 1.2em;
    background: none; border: none; cursor: pointer; text-align: left; font-size: 1em;
}
.fila:hover { background: #faf8fd; }
.quien { display: flex; flex-direction: column; gap: 0.15em; }
.code { color: #9ca3af; font-size: 0.85em; }
.pagos { display: flex; gap: 0.25em; }
.punto { width: 0.75em; height: 0.75em; border-radius: 50%; display: inline-block; }
.punto.verde { background: #22c55e; }
.punto.amarillo { background: #eab308; }
.punto.rojo { background: #ef4444; }
.punto.pendiente { background: #d1d5db; }
.punto.gris { background: #f3f4f6; border: 1px solid #e5e7eb; }
.alertas { display: flex; gap: 0.4em; flex-wrap: wrap; }
.chip { font-size: 0.78em; padding: 0.25em 0.7em; border-radius: 1em; white-space: nowrap; }
.chip.seguimiento { background: #ede7f6; color: #5a1e7a; }
.chip.mora_1 { background: #fef3c7; color: #92400e; }
.chip.mora_2 { background: #fee2e2; color: #991b1b; }
.chip.tickets { background: #dbeafe; color: #1e40af; }
.sync { color: #9ca3af; font-size: 0.8em; white-space: nowrap; }
.vacio, .error { color: #6b7280; padding: 2em 0; }
.error { color: #dc2626; }
@media (max-width: 700px) {
    section { padding: 1em; }
    .fila { grid-template-columns: 1fr; gap: 0.5em; }
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/admin/_components/mantenimiento/Dashboard/cartera/Cartera.svelte
git commit -m "feat: lista de la Cartera de clientes"
```

---

### Task 16: El alta de cliente

**Files:**
- Create: `src/routes/admin/_components/mantenimiento/Dashboard/cartera/AgregarCliente.svelte`

- [ ] **Step 1: Escribir el componente**

```svelte
<!-- src/routes/admin/_components/mantenimiento/Dashboard/cartera/AgregarCliente.svelte -->
<script>
// Alta en dos pasos: primero se valida el numero contra IspCube y se muestra el
// nombre para que el asesor confirme que es quien cree, y recien despues se
// pide la fecha de instalacion.
//
// La fecha la carga el asesor y no sale de IspCube a proposito: en IspCube las
// altas se cargan desde el principio del mes siguiente, asi que su `start_date`
// es casi siempre el dia 1 y no sirve para agendar el llamado de los 2 meses.
import { carteraStore, hoyISO } from './carteraStore.svelte.js';

let { onCerrar } = $props();

let code = $state('');
let fecha = $state(hoyISO());
let guardando = $state(false);
let error = $state('');

async function guardar() {
    error = '';
    guardando = true;
    const r = await carteraStore.agregar(code.trim(), fecha);
    guardando = false;

    if (r.ok) onCerrar();
    else error = r.error;
}
</script>

<div class="fondo" role="presentation" onclick={onCerrar}>
    <div class="modal" role="dialog" aria-label="Agregar cliente" onclick={(e) => e.stopPropagation()}>
        <h3>Agregar cliente</h3>

        <form onsubmit={(e) => { e.preventDefault(); guardar(); }}>
            <label for="code">Número de cliente</label>
            <input
                id="code"
                bind:value={code}
                placeholder="003566"
                inputmode="numeric"
                disabled={guardando}
            />
            <p class="ayuda">Con los ceros adelante, tal como figura en IspCube.</p>

            <label for="fecha">Fecha de instalación</label>
            <input id="fecha" type="date" bind:value={fecha} disabled={guardando} />
            <p class="ayuda">
                Desde acá se cuentan los dos meses para el llamado de seguimiento. No uses la fecha de
                alta de IspCube: ahí todas caen el día 1.
            </p>

            {#if error}<p class="error">{error}</p>{/if}

            <div class="acciones">
                <button type="button" class="cancelar" onclick={onCerrar} disabled={guardando}>
                    Cancelar
                </button>
                <button type="submit" class="confirmar" disabled={guardando || !code.trim()}>
                    {guardando ? 'Buscando…' : 'Agregar'}
                </button>
            </div>
        </form>
    </div>
</div>

<style>
.fondo {
    position: fixed; inset: 0; background: rgba(0, 0, 0, 0.45);
    display: flex; align-items: center; justify-content: center; padding: 1.5em; z-index: 50;
}
.modal {
    background: #fff; border-radius: 1.2em; padding: 2em; width: 100%; max-width: 26em;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}
h3 { margin: 0 0 1.2em; color: var(--violeta2); }
label { display: block; font-weight: 600; color: #374151; margin-bottom: 0.5em; }
input {
    width: 100%; padding: 0.8em 1em; border: 2px solid #e5e7eb; border-radius: 0.8em;
    font-size: 1em; box-sizing: border-box; font-family: inherit;
}
input:focus { outline: none; border-color: var(--violeta2); }
.ayuda { color: #6b7280; font-size: 0.85em; margin: 0.4em 0 1.4em; }
.error { color: #dc2626; font-size: 0.92em; margin: 0 0 1em; }
.acciones { display: flex; gap: 0.8em; justify-content: flex-end; }
.acciones button {
    border-radius: 2em; padding: 0.7em 1.4em; font-size: 1em; cursor: pointer; border: none;
}
.cancelar { background: #fff; border: 1.5px solid #e0e0e0; color: var(--violeta2); }
.confirmar { background: var(--violeta2); color: #fff; font-weight: 600; }
.confirmar:disabled, .cancelar:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/admin/_components/mantenimiento/Dashboard/cartera/AgregarCliente.svelte
git commit -m "feat: alta de clientes en la Cartera"
```

---

### Task 17: El detalle del cliente

**Files:**
- Create: `src/routes/admin/_components/mantenimiento/Dashboard/cartera/ClienteDetalle.svelte`

- [ ] **Step 1: Escribir el componente**

```svelte
<!-- src/routes/admin/_components/mantenimiento/Dashboard/cartera/ClienteDetalle.svelte -->
<script>
// Detalle de un cliente. Al abrirse marca sus tickets como vistos (apaga la
// alerta de tickets nuevos) y refresca su snapshot contra IspCube.
import { onMount } from 'svelte';
import Spinner from '$lib/components/ui/Spinner.svelte';
import { carteraStore } from './carteraStore.svelte.js';
import { puntosPorMes } from '$lib/cartera/pagos.js';
import { diaCorteDe, TIPOS_CONTACTO } from '$lib/cartera/alertas.js';
import { partesFecha } from '$lib/cartera/fechas.js';

let { cliente, onCerrar } = $props();

let notas = $state([]);
let cargandoNotas = $state(true);
let tipo = $state('llamada');
let texto = $state('');
let guardando = $state(false);
let error = $state('');

const TIPOS = [
    { value: 'llamada', label: 'Llamada' },
    { value: 'whatsapp', label: 'WhatsApp' },
    { value: 'visita', label: 'Visita' },
    { value: 'nota', label: 'Nota interna' }
];

// El registro puede actualizarse por la sincronizacion mientras el detalle esta
// abierto; se lee siempre del store para no mostrar datos congelados.
const actual = $derived(carteraStore.clientes.find((c) => c.id === cliente.id) ?? cliente);
const config = $derived(carteraStore.config);

const puntos = $derived.by(() => {
    const instalacion = partesFecha(actual.fecha_instalacion);
    if (!instalacion) return [];
    const d = new Date();
    return puntosPorMes(actual.pagos ?? [], {
        perfil: actual.perfil_pago,
        diaCorte: diaCorteDe(actual.perfil_pago, config),
        instalacion,
        hoy: { anio: d.getFullYear(), mes: d.getMonth() + 1, dia: d.getDate() },
        meses: 6
    });
});

const alertas = $derived(carteraStore.alertasDeCliente(actual));

async function cargarNotas() {
    cargandoNotas = true;
    try {
        notas = await carteraStore.notasDe(cliente.id);
    } catch (e) {
        console.error(e);
        error = 'No se pudieron cargar las anotaciones.';
    } finally {
        cargandoNotas = false;
    }
}

async function guardarNota() {
    if (!texto.trim()) return;
    guardando = true;
    error = '';
    try {
        await carteraStore.agregarNota(cliente.id, tipo, texto.trim());
        texto = '';
        await cargarNotas();
    } catch (e) {
        console.error(e);
        error = 'No se pudo guardar la anotación.';
    } finally {
        guardando = false;
    }
}

const fmt = (iso) => (iso ? new Date(iso).toLocaleDateString('es-AR') : '—');
const plata = (n) => (Number(n) || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });

onMount(async () => {
    await cargarNotas();
    // Abrir el detalle cuenta como "vi los tickets".
    if (actual.tickets?.ultimo) carteraStore.marcarTicketsVistos(actual);
    carteraStore.sincronizar([actual.code]);
});
</script>

<div class="fondo" role="presentation" onclick={onCerrar}>
    <div class="panel" role="dialog" aria-label="Detalle del cliente" onclick={(e) => e.stopPropagation()}>
        <header>
            <div>
                <h3>{actual.nombre}</h3>
                <span class="code">#{actual.code} · {actual.estado || 'sin estado'}</span>
            </div>
            <button class="cerrar" onclick={onCerrar} aria-label="Cerrar">×</button>
        </header>

        {#if alertas.length > 0}
            <div class="alertas">
                {#each alertas as a}
                    <span class="chip {a.tipo}">
                        {a.tipo === 'seguimiento' ? 'Contactar: pasaron 2 meses de la instalación' : ''}
                        {a.tipo === 'mora_1' ? 'No registró pago este mes' : ''}
                        {a.tipo === 'mora_2' ? 'Mora: pasó el segundo vencimiento' : ''}
                        {a.tipo === 'tickets' ? 'Tiene tickets de soporte nuevos' : ''}
                    </span>
                {/each}
            </div>
        {/if}

        <dl class="datos">
            <div><dt>Instalación</dt><dd>{fmt(actual.fecha_instalacion)}</dd></div>
            <div><dt>Alta en IspCube</dt><dd>{fmt(actual.start_date)}</dd></div>
            <div><dt>Medio de pago</dt><dd>{actual.entity_nombre || '—'} <span class="perfil">({actual.perfil_pago})</span></dd></div>
            <div><dt>Deuda</dt><dd>{plata(actual.debt)}</dd></div>
            <div><dt>Deuda vencida</dt><dd>{plata(actual.duedebt)}</dd></div>
            <div><dt>Tickets</dt><dd>{actual.tickets?.abiertos ?? 0} abiertos · {actual.tickets?.cerrados ?? 0} cerrados</dd></div>
        </dl>

        <section class="bloque">
            <h4>Pagos (últimos 6 meses)</h4>
            <div class="pagos">
                {#each puntos as p}
                    <div class="mes">
                        <span class="punto {p.estado}"></span>
                        <span class="etiqueta">{p.mes.slice(5)}</span>
                        <span class="dia">{p.dia ? `día ${p.dia}` : '—'}</span>
                    </div>
                {/each}
            </div>
            <p class="leyenda">
                Verde: pagó dentro de su ventana (hasta el {diaCorteDe(actual.perfil_pago, config)}).
                Amarillo: pagó tarde. Rojo: sin pago.
            </p>
        </section>

        <section class="bloque">
            <h4>Anotaciones</h4>

            <form onsubmit={(e) => { e.preventDefault(); guardarNota(); }}>
                <div class="tipos">
                    {#each TIPOS as t}
                        <button
                            type="button"
                            class:activo={tipo === t.value}
                            onclick={() => (tipo = t.value)}
                        >{t.label}</button>
                    {/each}
                </div>
                <textarea
                    bind:value={texto}
                    placeholder="Qué hablaron, qué quedó pendiente…"
                    rows="3"
                    disabled={guardando}
                ></textarea>
                <p class="ayuda">
                    {TIPOS_CONTACTO.includes(tipo)
                        ? 'Cuenta como contacto: apaga la alerta de los 2 meses.'
                        : 'Nota interna: no apaga la alerta de los 2 meses.'}
                </p>
                <button type="submit" class="guardar" disabled={guardando || !texto.trim()}>
                    {guardando ? 'Guardando…' : 'Guardar anotación'}
                </button>
            </form>

            {#if error}<p class="error">{error}</p>{/if}

            {#if cargandoNotas}
                <Spinner />
            {:else if notas.length === 0}
                <p class="vacio">Todavía no hay anotaciones.</p>
            {:else}
                <ul class="bitacora">
                    {#each notas as n (n.id)}
                        <li>
                            <div class="meta">
                                <span class="tipo {n.tipo}">{TIPOS.find((t) => t.value === n.tipo)?.label ?? n.tipo}</span>
                                <span class="cuando">{fmt(n.created)}</span>
                            </div>
                            <p>{n.texto}</p>
                        </li>
                    {/each}
                </ul>
            {/if}
        </section>

        <footer>
            <button class="archivar" onclick={() => { carteraStore.archivar(actual); onCerrar(); }}>
                Archivar cliente
            </button>
        </footer>
    </div>
</div>

<style>
.fondo {
    position: fixed; inset: 0; background: rgba(0, 0, 0, 0.45);
    display: flex; align-items: flex-start; justify-content: center;
    padding: 2em 1.5em; overflow-y: auto; z-index: 50;
}
.panel {
    background: #fff; border-radius: 1.2em; padding: 2em; width: 100%; max-width: 42em;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}
header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1em; }
h3 { margin: 0; color: var(--violeta2); }
.code { color: #9ca3af; font-size: 0.88em; }
.cerrar { background: none; border: none; font-size: 1.8em; line-height: 1; cursor: pointer; color: #9ca3af; }
.alertas { display: flex; flex-wrap: wrap; gap: 0.5em; margin: 1.2em 0; }
.chip { font-size: 0.85em; padding: 0.4em 0.9em; border-radius: 1em; }
.chip.seguimiento { background: #ede7f6; color: #5a1e7a; }
.chip.mora_1 { background: #fef3c7; color: #92400e; }
.chip.mora_2 { background: #fee2e2; color: #991b1b; }
.chip.tickets { background: #dbeafe; color: #1e40af; }
.datos { display: grid; grid-template-columns: repeat(auto-fit, minmax(11em, 1fr)); gap: 1em; margin: 1.5em 0; }
.datos div { display: flex; flex-direction: column; gap: 0.2em; }
dt { color: #6b7280; font-size: 0.8em; text-transform: uppercase; letter-spacing: 0.03em; }
dd { margin: 0; font-weight: 600; color: #374151; }
.perfil { font-weight: 400; color: #9ca3af; font-size: 0.9em; }
.bloque { border-top: 1px solid #ececec; padding-top: 1.5em; margin-top: 1.5em; }
h4 { margin: 0 0 1em; color: var(--violeta2); font-size: 1.05em; }
.pagos { display: flex; gap: 1.2em; flex-wrap: wrap; }
.mes { display: flex; flex-direction: column; align-items: center; gap: 0.3em; }
.punto { width: 1.1em; height: 1.1em; border-radius: 50%; }
.punto.verde { background: #22c55e; }
.punto.amarillo { background: #eab308; }
.punto.rojo { background: #ef4444; }
.punto.pendiente { background: #d1d5db; }
.punto.gris { background: #f3f4f6; border: 1px solid #e5e7eb; }
.etiqueta { font-size: 0.8em; color: #6b7280; }
.dia { font-size: 0.72em; color: #9ca3af; }
.leyenda, .ayuda { color: #9ca3af; font-size: 0.82em; margin: 1em 0 0; }
.tipos { display: flex; gap: 0.4em; flex-wrap: wrap; margin-bottom: 0.8em; }
.tipos button {
    border: 1.5px solid #e0e0e0; background: #fff; color: var(--violeta2);
    border-radius: 2em; padding: 0.4em 1em; cursor: pointer; font-size: 0.9em;
}
.tipos button.activo { background: var(--violeta2); color: #fff; border-color: var(--violeta2); }
textarea {
    width: 100%; padding: 0.8em 1em; border: 2px solid #e5e7eb; border-radius: 0.8em;
    font-family: inherit; font-size: 1em; box-sizing: border-box; resize: vertical;
}
textarea:focus { outline: none; border-color: var(--violeta2); }
.guardar {
    background: var(--violeta2); color: #fff; border: none; border-radius: 2em;
    padding: 0.7em 1.4em; font-weight: 600; cursor: pointer; margin-top: 0.8em;
}
.guardar:disabled { opacity: 0.6; cursor: not-allowed; }
.bitacora { list-style: none; padding: 0; margin: 1.5em 0 0; display: flex; flex-direction: column; gap: 0.8em; }
.bitacora li { background: #faf8fd; border-radius: 0.8em; padding: 0.9em 1.1em; }
.meta { display: flex; gap: 0.8em; align-items: center; margin-bottom: 0.4em; }
.tipo { font-size: 0.75em; padding: 0.2em 0.7em; border-radius: 1em; background: #ede7f6; color: #5a1e7a; }
.tipo.nota { background: #f3f4f6; color: #6b7280; }
.cuando { color: #9ca3af; font-size: 0.8em; }
.bitacora p { margin: 0; color: #374151; }
.vacio { color: #9ca3af; }
.error { color: #dc2626; font-size: 0.92em; }
footer { border-top: 1px solid #ececec; margin-top: 1.5em; padding-top: 1.2em; }
.archivar {
    background: #fff; border: 1.5px solid #e0e0e0; color: #6b7280;
    border-radius: 2em; padding: 0.6em 1.2em; cursor: pointer;
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/admin/_components/mantenimiento/Dashboard/cartera/ClienteDetalle.svelte
git commit -m "feat: detalle de cliente de la Cartera"
```

---

### Task 18: Enganchar la Cartera al dashboard

**Files:**
- Modify: `src/routes/admin/_components/mantenimiento/Dashboard/Content.svelte`
- Modify: `src/routes/admin/_components/mantenimiento/Dashboard/Sidebar.svelte:11-37`

- [ ] **Step 1: Agregar la rama en `Content.svelte`**

Agregá el import junto a los demás, al principio del `<script>`:

```js
import Cartera from "./cartera/Cartera.svelte";
```

Y la rama, después de la de `llamenme`:

```svelte
        {:else if selected === 'cartera'}
            <Cartera></Cartera>
```

- [ ] **Step 2: Agregar la entrada en el `Sidebar.svelte`**

En el array `mainItems`, agregá como último elemento:

```js
    {
        title: 'Cartera de clientes',
        content: 'cartera',
        icon: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'
    }
```

- [ ] **Step 3: Verificar en el navegador**

```bash
npm run dev
```

Abrí `/admin`, entrá con tu usuario y hacé clic en "Cartera de clientes". Verificá:

1. La lista carga vacía con el mensaje "Todavía no agregaste clientes a tu cartera."
2. "+ Agregar cliente" abre el modal.
3. Agregando un número real (probá con `003566`, que existe según el sondeo de la prueba de QR) aparece el cliente con su nombre.
4. Un número inexistente muestra "No encontramos ese número de cliente."
5. Abrir el cliente muestra el detalle, y guardar una anotación de tipo Llamada la lista en la bitácora.

Si el paso 3 devuelve 401, revisá que `pb.authStore.token` esté seteado — el store manda ese token en el header `Authorization` y `adminAuth` lo valida contra PocketBase.

- [ ] **Step 4: Commit**

```bash
git add src/routes/admin/_components/mantenimiento/Dashboard/Content.svelte src/routes/admin/_components/mantenimiento/Dashboard/Sidebar.svelte
git commit -m "feat: enganchar la Cartera de clientes al dashboard de admin"
```

---

### Task 19: Pantalla de configuración

**Files:**
- Create: `src/routes/admin/_components/mantenimiento/Dashboard/cartera/CarteraConfig.svelte`
- Modify: `src/routes/admin/_components/mantenimiento/Dashboard/cartera/Cartera.svelte`

- [ ] **Step 1: Escribir el componente**

```svelte
<!-- src/routes/admin/_components/mantenimiento/Dashboard/cartera/CarteraConfig.svelte -->
<script>
// Mapeo de entidades de IspCube a perfiles de pago, y dias de corte.
//
// En IspCube el medio de pago ES la entidad de cobranza (`entity_id`): no hay
// un campo `payment_method`. Por eso "este cliente paga con tarjeta" se define
// marcando entidades aca, y no cliente por cliente.
import { onMount } from 'svelte';
import Spinner from '$lib/components/ui/Spinner.svelte';
import { pb } from '$lib/pocketbase';
import { carteraStore } from './carteraStore.svelte.js';

let { onCerrar } = $props();

let entidades = $state([]);
let areas = $state([]);
let cargando = $state(true);
let guardando = $state(false);
let error = $state('');

let tarjeta = $state(new Set());
let soporte = $state(new Set());
let corte1 = $state(10);
let corte2 = $state(20);
let corteTarjeta = $state(21);

const toggle = (set, id) => {
    const next = new Set(set);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
};

async function cargar() {
    cargando = true;
    error = '';
    try {
        const res = await fetch('/api/cartera/catalogos', {
            headers: { Authorization: `Bearer ${pb.authStore.token}` }
        });
        if (!res.ok) throw new Error(`catalogos respondio ${res.status}`);
        const datos = await res.json();
        entidades = datos.entidades;
        areas = datos.areas;

        const c = carteraStore.config;
        tarjeta = new Set((c.entidades_tarjeta ?? []).map(String));
        soporte = new Set((c.areas_soporte ?? []).map(String));
        corte1 = c.dia_corte_1 ?? 10;
        corte2 = c.dia_corte_2 ?? 20;
        corteTarjeta = c.dia_corte_tarjeta ?? 21;
    } catch (e) {
        console.error(e);
        error = 'No se pudieron leer los catálogos de IspCube.';
    } finally {
        cargando = false;
    }
}

async function guardar() {
    guardando = true;
    error = '';
    try {
        const lista = await pb.collection('cartera_config').getList(1, 1);
        const datos = {
            entidades_tarjeta: [...tarjeta],
            areas_soporte: [...soporte],
            estados_cerrados: carteraStore.config.estados_cerrados ?? [],
            dia_corte_1: Number(corte1),
            dia_corte_2: Number(corte2),
            dia_corte_tarjeta: Number(corteTarjeta)
        };

        if (lista.items.length > 0) await pb.collection('cartera_config').update(lista.items[0].id, datos);
        else await pb.collection('cartera_config').create(datos);

        await carteraStore.cargar();
        onCerrar();
    } catch (e) {
        console.error(e);
        error = 'No se pudo guardar la configuración.';
    } finally {
        guardando = false;
    }
}

onMount(cargar);
</script>

<div class="fondo" role="presentation" onclick={onCerrar}>
    <div class="panel" role="dialog" aria-label="Configuración de la Cartera" onclick={(e) => e.stopPropagation()}>
        <h3>Configuración de la Cartera</h3>

        {#if cargando}
            <Spinner />
        {:else}
            <section>
                <h4>Medios de pago con tarjeta</h4>
                <p class="ayuda">
                    Marcá las entidades de cobranza que corresponden a tarjeta. A esos clientes se les
                    controla el pago alrededor del día {corteTarjeta} en vez del {corte1}.
                </p>
                <div class="opciones">
                    {#each entidades as e}
                        <label>
                            <input
                                type="checkbox"
                                checked={tarjeta.has(String(e.id))}
                                onchange={() => (tarjeta = toggle(tarjeta, String(e.id)))}
                            />
                            {e.nombre}
                        </label>
                    {/each}
                </div>
            </section>

            <section>
                <h4>Áreas que cuentan como soporte</h4>
                <p class="ayuda">Sin ninguna marcada, cuentan los tickets de todas las áreas.</p>
                <div class="opciones">
                    {#each areas as a}
                        <label>
                            <input
                                type="checkbox"
                                checked={soporte.has(String(a.id))}
                                onchange={() => (soporte = toggle(soporte, String(a.id)))}
                            />
                            {a.nombre}
                        </label>
                    {/each}
                </div>
            </section>

            <section>
                <h4>Días de corte</h4>
                <div class="dias">
                    <label>Primer corte <input type="number" min="1" max="31" bind:value={corte1} /></label>
                    <label>Segundo corte <input type="number" min="1" max="31" bind:value={corte2} /></label>
                    <label>Tarjeta <input type="number" min="1" max="31" bind:value={corteTarjeta} /></label>
                </div>
            </section>

            {#if error}<p class="error">{error}</p>{/if}

            <div class="acciones">
                <button class="cancelar" onclick={onCerrar} disabled={guardando}>Cancelar</button>
                <button class="confirmar" onclick={guardar} disabled={guardando}>
                    {guardando ? 'Guardando…' : 'Guardar'}
                </button>
            </div>
        {/if}
    </div>
</div>

<style>
.fondo {
    position: fixed; inset: 0; background: rgba(0, 0, 0, 0.45);
    display: flex; align-items: flex-start; justify-content: center;
    padding: 2em 1.5em; overflow-y: auto; z-index: 50;
}
.panel {
    background: #fff; border-radius: 1.2em; padding: 2em; width: 100%; max-width: 34em;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}
h3 { margin: 0 0 1.5em; color: var(--violeta2); }
h4 { margin: 0 0 0.5em; color: #374151; font-size: 1em; }
section { border-top: 1px solid #ececec; padding-top: 1.3em; margin-top: 1.3em; }
section:first-of-type { border-top: none; margin-top: 0; padding-top: 0; }
.ayuda { color: #9ca3af; font-size: 0.85em; margin: 0 0 0.9em; }
.opciones { display: flex; flex-direction: column; gap: 0.5em; }
.opciones label { display: flex; align-items: center; gap: 0.6em; color: #374151; cursor: pointer; }
.dias { display: flex; gap: 1em; flex-wrap: wrap; }
.dias label { display: flex; flex-direction: column; gap: 0.3em; color: #6b7280; font-size: 0.88em; }
.dias input { width: 5em; padding: 0.5em; border: 2px solid #e5e7eb; border-radius: 0.6em; font-size: 1em; }
.error { color: #dc2626; font-size: 0.92em; }
.acciones { display: flex; gap: 0.8em; justify-content: flex-end; margin-top: 1.8em; }
.acciones button { border-radius: 2em; padding: 0.7em 1.4em; font-size: 1em; cursor: pointer; border: none; }
.cancelar { background: #fff; border: 1.5px solid #e0e0e0; color: var(--violeta2); }
.confirmar { background: var(--violeta2); color: #fff; font-weight: 600; }
.confirmar:disabled, .cancelar:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
```

- [ ] **Step 2: Agregar el botón en `Cartera.svelte`**

En el `<script>`, agregá el import y el estado:

```js
import CarteraConfig from './CarteraConfig.svelte';
```

```js
let configurando = $state(false);
```

En el `<header>`, antes del botón de agregar:

```svelte
        <button class="config" onclick={() => (configurando = true)} title="Configuración">⚙</button>
```

Al final del `<section>`, junto a los otros modales:

```svelte
    {#if configurando}
        <CarteraConfig onCerrar={() => (configurando = false)} />
    {/if}
```

Y en el `<style>`:

```css
.config {
    background: #fff; border: 1.5px solid #e0e0e0; color: var(--violeta2);
    border-radius: 50%; width: 2.4em; height: 2.4em; font-size: 1em; cursor: pointer;
}
```

Ajustá el `<header>` para que agrupe los dos botones:

```svelte
    <header>
        <h2>Cartera de clientes</h2>
        <div class="acciones-header">
            <button class="config" onclick={() => (configurando = true)} title="Configuración">⚙</button>
            <button class="agregar" onclick={() => (agregando = true)}>+ Agregar cliente</button>
        </div>
    </header>
```

```css
.acciones-header { display: flex; gap: 0.6em; align-items: center; }
```

- [ ] **Step 3: Verificar en el navegador**

```bash
npm run dev
```

Abrí la Cartera, hacé clic en ⚙ y verificá que se listan las entidades y áreas reales de IspCube. Marcá las de tarjeta según el sondeo de la Task 1, guardá, y confirmá que un cliente de tarjeta pasa a mostrar `(tarjeta)` en su detalle.

- [ ] **Step 4: Commit**

```bash
git add src/routes/admin/_components/mantenimiento/Dashboard/cartera/
git commit -m "feat: configuracion de medios de pago y dias de corte de la Cartera"
```

---

### Task 20: Verificación final

- [ ] **Step 1: Suite completa**

```bash
npx vitest run
```

Expected: todos verdes. Deberían ser ~330 tests (los 249 de base más los ~80 nuevos).

- [ ] **Step 2: Los dos builds**

```bash
npm run build
npm run build:node
```

Expected: ambos sin errores. Recordá que el build estático **no** emite los endpoints de `/api/cartera/`: es esperado, la Cartera solo funciona en el deploy Node.

- [ ] **Step 3: Repaso funcional en el navegador**

Con `npm run dev`, y logueado en `/admin`:

| Qué probar | Qué esperar |
|---|---|
| Agregar un cliente real | Aparece con nombre, deuda y puntos de pago |
| Agregar un número inexistente | "No encontramos ese número de cliente" |
| Agregar dos veces el mismo | "Ese cliente ya está en tu cartera" |
| Un cliente instalado hace más de 2 meses | Chip "Contactar (2 meses)" |
| Cargar una nota tipo Llamada | El chip de seguimiento desaparece, también al volver a la lista |
| Cargar una nota tipo Nota interna | El chip de seguimiento **sigue** |
| Filtro "Con alerta" | Solo los que tienen chips |
| Abrir un cliente con tickets | El chip de tickets desaparece al cerrar |

- [ ] **Step 4: Commit final**

```bash
git add -A
git commit -m "feat: Cartera de clientes completa"
```

---

## Notas de despliegue

La Cartera **solo funciona en el build Node** (`npm run build:node` → `build-node/`). El build estático no emite los `+server.js`, así que en ese deploy el panel cargaría la lista desde PocketBase pero fallaría al agregar clientes o sincronizar.

Antes de desplegar, confirmá que estas variables están en el entorno del servidor Node de Hostinger:

- `ISPCUBE_API_URL`, `ISPCUBE_USERNAME`, `ISPCUBE_PASSWORD`, `ISPCUBE_API_KEY`, `ISPCUBE_CLIENT_ID`
- `VITE_POCKETBASE_URL`

Ver `DEPLOY.md` y la memoria sobre la migración a adapter-node.

---

## Desviaciones del plan durante la ejecución

### Task 2 — deduplicación de pedidos de token en vuelo

El plan solo pedía cachear el token resuelto. La revisión notó que dos llamadas
concurrentes con el cache frío disparaban cada una su propio POST al endpoint de
token — y que la Task 11 (`Promise.all([getTickets, getCobranzas])`) y la Task 12
(concurrencia 4) iban a golpear eso de lleno. Se agregó un mapa de pedidos en
vuelo. `forzar: true` lo saltea a propósito: quien fuerza sabe que el token en
camino puede ser el podrido.

### Task 4 — unificar `getCustomerByCode` sobre `getAutenticado`

Ver la nota al principio de la Task 4. Resumen: el cache de token de la Task 2
podía dejar sin auto-reparo ante 401 justo al único camino en producción.

### Tasks 3 y 4 — un payload que no es array ya no se lava en lista vacía

**El plan especificaba** `Array.isArray(r.data) ? r.data : []` en `getTickets` y
`getCobranzas`. **Se cambió a** `{ok: false, reason: 'invalid'}`.

Por qué: si IspCube devuelve un objeto de error con HTTP 200 —un patrón que esta
API usa—, la versión del plan lo convertía en lista vacía. Para tickets es
tolerable; para cobranzas no, porque las alertas de mora se calculan sobre esa
lista y "la API contestó cualquier cosa" quedaba indistinguible de "este cliente
no pagó". El resultado habría sido un asesor llamando a alguien que sí pagó.

El 404 **sigue** mapeando a lista vacía: un cliente sin tickets ni cobranzas es
un caso normal.

Aguas abajo esto ya estaba contemplado sin saberlo: `/api/cartera/sync` hace
`cobranzas.ok ? pagosDeCobranzas(...) : null`, y el store hace
`if (datos.pagos)` antes de pisar el histórico. Con `ok: false` el snapshot
conserva los pagos que ya tenía en vez de sobrescribirlos con una lista vacía.
