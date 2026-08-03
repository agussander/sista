/**
 * Cliente de la API de IspCube.
 *
 * Cubre dos usos que llegaron por caminos separados y comparten el mismo host y
 * la misma autenticacion:
 *
 *   - alta de tickets de baja (`createTicket`), puerto de
 *     `static/assets/send-ticket-ispcube.php`;
 *   - consulta de un cliente por su numero (`getCustomerByCode`), que usa la
 *     pantalla de la plataforma de puntos.
 *
 * OJO: `createTicket` crea tickets REALES en el IspCube de produccion. No
 * dispararlo desde una verificacion automatica ni desde un test: todos los
 * tests de este modulo inyectan `fetchImpl`. `getCustomerByCode` es de solo
 * lectura.
 *
 * Como el resto de `src/lib/server/`, no lee `$env`: la config entra por
 * parametro y quien la lee es el `+server.js` (tickets) o `ispcubeDeps.js`
 * (puntos).
 */

/**
 * @typedef {object} IspcubeConfig
 * @property {string} baseUrl
 * @property {string} username
 * @property {string} password
 * @property {string} apiKey
 * @property {string} clientId
 */

/** Timeout heredado del PHP (`CURLOPT_TIMEOUT => 30`). */
const TIMEOUT_MS = 30_000;

/**
 * Timeout mas corto para la consulta de cliente: del otro lado hay alguien
 * mirando la pantalla despues de escanear un QR, y 30 segundos en blanco es
 * peor que un mensaje de error.
 */
const CUSTOMER_TIMEOUT_MS = 15_000;

/** @param {IspcubeConfig} config */
function apiHeaders({ apiKey, clientId }) {
	return {
		'Content-Type': 'application/json',
		Accept: 'application/json',
		'api-key': apiKey,
		'client-id': clientId
	};
}

/** @param {string} baseUrl */
function trimBase(baseUrl) {
	return baseUrl.replace(/\/+$/, '');
}

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

/**
 * Crea el ticket de baja.
 *
 * Traduce el status HTTP al mismo `{status, message}` que devolvia el PHP,
 * porque `Paso4.svelte` ramifica sobre `status` y no se quiere tocar esa UI.
 *
 * @param {IspcubeConfig} config
 * @param {{nro_cliente: string, dni_cliente: string, mensaje_ticket: string, form_type?: string}} datos
 * @param {string} bearerToken
 * @param {{ fetchImpl?: typeof fetch }} [options]
 * @returns {Promise<{status: string, message: string, ticket_id?: unknown, ticket_number?: unknown}>}
 */
export async function createTicket(config, datos, bearerToken, { fetchImpl = fetch } = {}) {
	const url = `${trimBase(config.baseUrl)}/tickets`;
	const payload = {
		subject: `Solicitud de Baja - Cliente: ${datos.nro_cliente}`,
		description: datos.mensaje_ticket,
		customer_id: datos.nro_cliente,
		customer_dni: datos.dni_cliente,
		form_type: datos.form_type
	};

	/** @type {{ok: boolean, status: number, text: () => Promise<string>}} */
	let res;
	/** @type {any} */
	let body;
	try {
		res = await fetchImpl(url, {
			method: 'POST',
			headers: { ...apiHeaders(config), Authorization: `Bearer ${bearerToken}` },
			body: JSON.stringify(payload),
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
		const raw = await res.text();
		// La API a veces contesta HTML (un 502 del proxy, por ejemplo). Se parsea
		// defensivamente para que el status HTTP siga mandando en la decision.
		try {
			body = JSON.parse(raw);
		} catch {
			body = {};
		}
	} catch (error) {
		const detail = error instanceof Error ? error.message : String(error);
		console.error('[ispcube] fallo el alta del ticket:', error);
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

/** Solo digitos. El zero-padding es significativo: `3566` NO es `003566`. */
const CODE_PATTERN = /^\d{1,12}$/;

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
 * Busca un cliente por su numero. Solo lectura.
 *
 * `reason` puede ser `not_found`, `config`, `auth`, `api`, `invalid` o
 * `network`.
 *
 * @param {unknown} code Numero de cliente, con sus ceros ("003566")
 * @param {IspcubeConfig} config
 * @param {{ fetchImpl?: typeof fetch }} [options]
 * @returns {Promise<CustomerResult>}
 */
export async function getCustomerByCode(code, config, { fetchImpl = fetch } = {}) {
	// Un codigo mal formado se resuelve sin gastar una llamada, y cae en el
	// mismo `not_found` que un cliente inexistente para no confirmarle a quien
	// sondea si un codigo existe.
	if (typeof code !== 'string' || !CODE_PATTERN.test(code)) {
		return { ok: false, reason: 'not_found' };
	}

	const { baseUrl, username, password, apiKey, clientId } = config;
	if (!baseUrl || !username || !password || !apiKey || !clientId) {
		console.error('[ispcube] faltan credenciales: revisar las ISPCUBE_* del entorno');
		return { ok: false, reason: 'config' };
	}

	const token = await getAuthToken(config, { fetchImpl });
	if (!token) return { ok: false, reason: 'auth' };

	const url = `${trimBase(baseUrl)}/api/customer?code=${encodeURIComponent(code)}`;

	/** @type {any} */
	let res;
	try {
		res = await fetchImpl(url, {
			// `login-type` y `username` no son folklore: sin cualquiera de los dos
			// la consulta responde `400 {"status":false,"message":"<header>
			// requerido"}` aunque el bearer sea valido. `apiHeaders` no los trae
			// porque el alta de tickets no los necesita.
			//
			// Es justo lo que le falta a `static/assets/client-handler.php`, y por
			// eso su busqueda por DNI devuelve "DNI not found" para todo cliente
			// valido.
			headers: {
				...apiHeaders(config),
				'login-type': 'api',
				username,
				Authorization: `Bearer ${token}`
			},
			signal: AbortSignal.timeout(CUSTOMER_TIMEOUT_MS)
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
