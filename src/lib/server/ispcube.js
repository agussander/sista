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
