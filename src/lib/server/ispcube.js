/**
 * Alta de tickets en IspCube. Puerto de `static/assets/send-ticket-ispcube.php`.
 *
 * OJO: esto crea tickets REALES en el IspCube de produccion. No dispararlo
 * desde una verificacion automatica ni desde un test: todos los tests de este
 * modulo inyectan `fetchImpl`.
 *
 * Como el resto de `src/lib/server/`, no lee `$env`: la config entra por
 * parametro y el `+server.js` es el unico que toca las variables de entorno.
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
 * Obtiene un bearer token de IspCube.
 *
 * Solo se usa como fallback: el cliente normalmente manda el token que ya tiene
 * de haber consultado los datos del abonado en un paso anterior del wizard.
 *
 * @param {IspcubeConfig} config
 * @param {{ fetchImpl?: typeof fetch }} [options]
 * @returns {Promise<string | null>} `null` si no se pudo obtener
 */
export async function getAuthToken(config, { fetchImpl = fetch } = {}) {
	const url = `${trimBase(config.baseUrl)}/api/sanctum/token`;
	try {
		const res = await fetchImpl(url, {
			method: 'POST',
			headers: { ...apiHeaders(config), 'login-type': 'api' },
			body: JSON.stringify({ username: config.username, password: config.password }),
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
		const data = await res.json();
		return data?.data?.token ?? null;
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
