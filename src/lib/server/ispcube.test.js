import { describe, it, expect, beforeEach } from 'vitest';
import {
	getAuthToken,
	createTicket,
	getCustomerByCode,
	getTickets,
	getCobranzas,
	getCatalogos,
	limpiarCacheToken
} from './ispcube.js';

const CONFIG = {
	baseUrl: 'https://sista.ispcube.online',
	username: 'u',
	password: 'p',
	apiKey: 'k',
	clientId: '734'
};

// El cache de token es un Map a nivel de modulo: sin limpiarlo entre tests, un
// token cacheado en un test se filtra al siguiente y las cuentas de llamadas
// (`calls`) dan mal.
beforeEach(() => limpiarCacheToken());

const TICKET = {
	nro_cliente: '1234',
	dni_cliente: '30111222',
	mensaje_ticket: 'texto',
	form_type: 'baja2'
};

/** Respuesta con forma de `Response`, para que el modulo la trate como la real. */
const res = (status, body) => ({
	ok: status >= 200 && status < 300,
	status,
	text: async () => JSON.stringify(body),
	json: async () => body
});

function fakeFetch(responses, calls) {
	let i = 0;
	return async (url, init) => {
		calls?.push({ url, init });
		return responses[Math.min(i++, responses.length - 1)];
	};
}

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

	it('manda usuario y contrasena en el body', async () => {
		const calls = [];
		await getAuthToken(CONFIG, {
			fetchImpl: fakeFetch([res(200, { data: { token: 't' } })], calls)
		});

		expect(JSON.parse(calls[0].init.body)).toEqual({ username: 'u', password: 'p' });
	});

	it('acepta el token en la raiz, que es como lo devuelve la api hoy', async () => {
		const token = await getAuthToken(CONFIG, {
			fetchImpl: fakeFetch([res(200, { token: '145237|TKm9T1uu' })])
		});
		expect(token).toBe('145237|TKm9T1uu');
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

	it('deja el numero de tramite en null si la api no lo devuelve', async () => {
		const out = await createTicket(CONFIG, TICKET, 'b', { fetchImpl: fakeFetch([res(201, {})]) });
		expect(out.ticket_number).toBeNull();
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

	it('incluye el detalle del 422', async () => {
		const out = await createTicket(CONFIG, TICKET, 'b', {
			fetchImpl: fakeFetch([res(422, { errors: 'dni requerido' })])
		});
		expect(out.message).toContain('dni requerido');
	});

	it('reporta cualquier otro status', async () => {
		const out = await createTicket(CONFIG, TICKET, 'b', { fetchImpl: fakeFetch([res(500, {})]) });
		expect(out.status).toBe('error');
		expect(out.message).toContain('500');
	});

	it('no explota si la api responde algo que no es json', async () => {
		const out = await createTicket(CONFIG, TICKET, 'b', {
			fetchImpl: fakeFetch([{ ok: true, status: 201, text: async () => '<html>502</html>' }])
		});
		expect(out.status).toBe('success');
		expect(out.ticket_number).toBeNull();
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

const AUTH_OK = res(200, { data: { token: 't0k3n' } });

const CLIENTE_OK = res(200, {
	id: 7277,
	code: '003566',
	name: 'TALONE SANDRA ELIZABETH',
	status: 'enabled'
});

describe('getCustomerByCode', () => {
	it('devuelve code, name y status del cliente', async () => {
		const out = await getCustomerByCode('003566', CONFIG, {
			fetchImpl: fakeFetch([AUTH_OK, CLIENTE_OK])
		});

		expect(out).toEqual({
			ok: true,
			customer: { code: '003566', name: 'TALONE SANDRA ELIZABETH', status: 'enabled' }
		});
	});

	it('consulta ?code= respetando los ceros a la izquierda', async () => {
		const calls = [];
		await getCustomerByCode('003566', CONFIG, {
			fetchImpl: fakeFetch([AUTH_OK, CLIENTE_OK], calls)
		});

		expect(calls[1].url).toBe('https://sista.ispcube.online/api/customer?code=003566');
	});

	it('manda el bearer y el header username en la consulta', async () => {
		const calls = [];
		await getCustomerByCode('003566', CONFIG, {
			fetchImpl: fakeFetch([AUTH_OK, CLIENTE_OK], calls)
		});

		expect(calls[1].init.headers.Authorization).toBe('Bearer t0k3n');
		// Sin estos dos la api responde 400 "<header> requerido", aunque el
		// bearer sea valido. Son los que le faltan al client-handler.php.
		expect(calls[1].init.headers.username).toBe('u');
		expect(calls[1].init.headers['login-type']).toBe('api');
	});

	it('devuelve not_found cuando la api responde 404', async () => {
		const out = await getCustomerByCode('999999', CONFIG, {
			fetchImpl: fakeFetch([AUTH_OK, res(404, { result: true, message: 'Cliente no encontrado' })])
		});

		expect(out).toEqual({ ok: false, reason: 'not_found' });
	});

	it('rechaza un codigo con formato invalido sin llamar a la api', async () => {
		const calls = [];
		const fetchImpl = fakeFetch([AUTH_OK, CLIENTE_OK], calls);

		expect(await getCustomerByCode('abc', CONFIG, { fetchImpl })).toEqual({
			ok: false,
			reason: 'not_found'
		});
		expect(await getCustomerByCode('', CONFIG, { fetchImpl })).toEqual({
			ok: false,
			reason: 'not_found'
		});
		expect(await getCustomerByCode('1'.repeat(13), CONFIG, { fetchImpl })).toEqual({
			ok: false,
			reason: 'not_found'
		});
		expect(calls).toHaveLength(0);
	});

	it('falla con reason config si falta una credencial, sin llamar a la api', async () => {
		const calls = [];
		const out = await getCustomerByCode(
			'003566',
			{ ...CONFIG, apiKey: '' },
			{ fetchImpl: fakeFetch([AUTH_OK, CLIENTE_OK], calls) }
		);

		expect(out).toEqual({ ok: false, reason: 'config' });
		expect(calls).toHaveLength(0);
	});

	it('devuelve auth si no se pudo obtener el token, sin consultar el cliente', async () => {
		const calls = [];
		const out = await getCustomerByCode('003566', CONFIG, {
			fetchImpl: fakeFetch([res(200, { data: {} })], calls)
		});

		expect(out).toEqual({ ok: false, reason: 'auth' });
		expect(calls).toHaveLength(1);
	});

	it('devuelve api cuando la api responde 500', async () => {
		const out = await getCustomerByCode('003566', CONFIG, {
			fetchImpl: fakeFetch([AUTH_OK, res(500, { message: 'boom' })])
		});

		expect(out).toEqual({ ok: false, reason: 'api' });
	});

	it('devuelve invalid si la respuesta no trae name', async () => {
		const out = await getCustomerByCode('003566', CONFIG, {
			fetchImpl: fakeFetch([AUTH_OK, res(200, { code: '003566' })])
		});

		expect(out).toEqual({ ok: false, reason: 'invalid' });
	});

	it('devuelve invalid si la respuesta no es json', async () => {
		const out = await getCustomerByCode('003566', CONFIG, {
			fetchImpl: fakeFetch([
				AUTH_OK,
				{
					ok: true,
					status: 200,
					json: async () => {
						throw new Error('no es json');
					}
				}
			])
		});

		expect(out).toEqual({ ok: false, reason: 'invalid' });
	});

	it('devuelve network si fetch explota en la consulta', async () => {
		let n = 0;
		const out = await getCustomerByCode('003566', CONFIG, {
			fetchImpl: async () => {
				n += 1;
				if (n === 1) return AUTH_OK;
				throw new Error('ECONNRESET');
			}
		});

		expect(out).toEqual({ ok: false, reason: 'network' });
	});
});

describe('cache del token', () => {
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

	it('no cachea una respuesta sin token (el 401 es incidental: getAuthToken no mira el status)', async () => {
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

	it('dedupe pedidos concurrentes: dos llamadas sin await entre medio hacen un solo request', async () => {
		const calls = [];
		/** @type {Array<(value: unknown) => void>} */
		const resolvers = [];
		// No resuelve enseguida: si la deduplicacion fallara y las dos llamadas
		// dispararan su propio fetch, las dos quedarian colgadas hasta que este
		// test las resuelva a mano, exponiendo la concurrencia real en vez de
		// depender del orden en que corren las microtasks.
		const fetchImpl = (url, init) => {
			calls.push({ url, init });
			return new Promise((resolve) => resolvers.push(resolve));
		};

		const a = getAuthToken(CONFIG, { fetchImpl });
		const b = getAuthToken(CONFIG, { fetchImpl });

		resolvers.forEach((resolve) => resolve(res(200, { token: 'tok-1' })));

		const [tokenA, tokenB] = await Promise.all([a, b]);

		expect(tokenA).toBe('tok-1');
		expect(tokenB).toBe('tok-1');
		expect(calls).toHaveLength(1);
	});

	it('con forzar: true no se cuelga de un pedido en vuelo: dispara el suyo', async () => {
		const calls = [];
		/** @type {Array<(value: unknown) => void>} */
		const resolvers = [];
		const fetchImpl = (url, init) => {
			calls.push({ url, init });
			return new Promise((resolve) => resolvers.push(resolve));
		};

		// La primera queda en vuelo (no se resuelve todavia).
		const enVuelo = getAuthToken(CONFIG, { fetchImpl });
		// forzar dispara la suya en vez de colgarse de la anterior.
		const forzada = getAuthToken(CONFIG, { fetchImpl, forzar: true });

		expect(calls).toHaveLength(2);

		resolvers[0](res(200, { token: 'tok-viejo' }));
		resolvers[1](res(200, { token: 'tok-nuevo' }));

		expect(await enVuelo).toBe('tok-viejo');
		expect(await forzada).toBe('tok-nuevo');
	});
});

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
