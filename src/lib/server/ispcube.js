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
 * Pedidos de token en vuelo, por clave. Sin esto, dos llamadas concurrentes
 * con el cache frio (arranque, redeploy, TTL vencido) disparan cada una su
 * propio POST al endpoint de token -que se factura- en vez de compartir uno.
 *
 * @type {Map<string, Promise<string | null>>}
 */
const pedidosEnVuelo = new Map();

/**
 * Vacia el cache de tokens. Existe para los tests: sin esto, un token cacheado
 * en un test se filtra al siguiente y las cuentas de llamadas dan mal.
 */
export function limpiarCacheToken() {
	cacheToken.clear();
	pedidosEnVuelo.clear();
}

/**
 * Pega al endpoint de sanctum y, si la respuesta trae token, lo cachea.
 *
 * @param {IspcubeConfig} config
 * @param {string} clave
 * @param {{ fetchImpl: typeof fetch, now: () => number }} options
 * @returns {Promise<string | null>}
 */
async function pedirToken(config, clave, { fetchImpl, now }) {
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
 * Obtiene un bearer token de IspCube, cacheado en memoria del proceso.
 *
 * El cache no es una optimizacion cosmetica: la API de IspCube se factura por
 * request (2,5 x conexiones activas por mes, ver `docs/ispcube-api.md`), y sin
 * el cada consulta de datos costaba dos llamadas en vez de una. Ademas de
 * cachear el token resuelto, dos llamadas concurrentes con el cache frio se
 * cuelgan del mismo pedido en vuelo en lugar de disparar cada una el suyo.
 *
 * @param {IspcubeConfig} config
 * @param {{ fetchImpl?: typeof fetch, now?: () => number, forzar?: boolean }} [options]
 *   `forzar` saltea el cache -pensado para los reintentos ante un 401, porque
 *   un token revocado del lado de IspCube seguiria cacheado hasta 23 h-, y
 *   tambien saltea el pedido en vuelo: quien pide `forzar` sabe que el token
 *   que hay (o el que ya esta en camino) esta podrido, asi que necesita uno
 *   nuevo de verdad, no colgarse de un fetch que arranco antes de saberlo.
 * @returns {Promise<string | null>} `null` si no se pudo obtener
 */
export async function getAuthToken(config, { fetchImpl = fetch, now = Date.now, forzar = false } = {}) {
	const clave = `${trimBase(config.baseUrl)}|${config.username}`;
	if (!forzar) {
		const guardado = cacheToken.get(clave);
		if (guardado && guardado.expira > now()) return guardado.token;

		const enVuelo = pedidosEnVuelo.get(clave);
		if (enVuelo) return enVuelo;
	}

	const pedido = pedirToken(config, clave, { fetchImpl, now });
	if (!forzar) {
		pedidosEnVuelo.set(clave, pedido);
		// Se limpia tanto si resuelve como si rechaza: `pedirToken` hoy siempre
		// resuelve (atrapa sus propios errores), pero si en el futuro dejara de
		// ser asi, un rechazo no debe envenenar la clave para siempre.
		pedido.finally(() => pedidosEnVuelo.delete(clave));
	}
	return pedido;
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
 * Busca un cliente por su numero. Solo lectura.
 *
 * `reason` puede ser `not_found`, `config`, `auth`, `api`, `invalid` o
 * `network`: los mismos que devuelve `getAutenticado`, mas `invalid` para el
 * caso propio de esta funcion (JSON valido pero sin el campo `name`).
 *
 * A diferencia de `getTickets`/`getCobranzas`, un code mal formado cae en
 * `not_found` en vez de `invalid`: esta funcion no esta detras de
 * autenticacion de admin -la abre quien escanea el QR de un cliente en la
 * plataforma de puntos- y no hay que confirmarle a quien sondea si un numero
 * de cliente existe o no. La asimetria con las otras dos es a proposito.
 *
 * @param {unknown} code Numero de cliente, con sus ceros ("003566")
 * @param {IspcubeConfig} config
 * @param {{ fetchImpl?: typeof fetch }} [options]
 * @returns {Promise<CustomerResult>}
 */
export async function getCustomerByCode(code, config, options = {}) {
	// Se corta antes de llamar a `getAutenticado`, que valida credenciales y
	// pediria un token: un code mal formado no debe ni gastar esa llamada.
	if (typeof code !== 'string' || !CODE_PATTERN.test(code)) {
		return { ok: false, reason: 'not_found' };
	}

	const r = await getAutenticado(
		`/api/customer?code=${encodeURIComponent(code)}`,
		config,
		options
	);

	if (!r.ok) return { ok: false, reason: r.reason };

	// `getAutenticado` ya cubrio "la respuesta no es JSON" bajo su propio
	// 'invalid'. Esto suma el otro caso de "no entiendo la respuesta": JSON
	// valido pero sin el campo que necesitamos. Que compartan el nombre del
	// reason es intencional -las dos significan lo mismo de cara a quien
	// llama-, no una colision accidental.
	if (!r.data || typeof r.data.name !== 'string') {
		console.error('[ispcube] respuesta sin el campo name:', r.data);
		return { ok: false, reason: 'invalid' };
	}

	return {
		ok: true,
		customer: {
			code: typeof r.data.code === 'string' ? r.data.code : code,
			name: r.data.name,
			status: typeof r.data.status === 'string' ? r.data.status : ''
		}
	};
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

	// Un 200 que no trae un array no es "sin tickets": IspCube a veces contesta
	// un objeto de error (`{"status":false,"message":"..."}`) con HTTP 200. Si
	// eso se lavara en lista vacia quedaria indistinguible de un cliente sin
	// tickets. El 404 (arriba) sigue siendo el unico camino legitimo a [].
	if (!Array.isArray(r.data)) {
		console.error('[ispcube] la respuesta de tickets no es un array:', r.data);
		return { ok: false, reason: 'invalid' };
	}

	return { ok: true, tickets: r.data };
}

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

	// Mismo motivo que en `getTickets`, pero aca importa mas: la Cartera calcula
	// las alertas de mora sobre esta lista. Si un payload que no es un array se
	// lavara en [], "la API contesto cualquier cosa" quedaria indistinguible de
	// "este cliente no pago este mes", y el asesor terminaria llamando a
	// alguien que si pago.
	if (!Array.isArray(r.data)) {
		console.error('[ispcube] la respuesta de cobranzas no es un array:', r.data);
		return { ok: false, reason: 'invalid' };
	}

	return { ok: true, cobranzas: r.data };
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
