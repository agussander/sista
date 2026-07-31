import { describe, it, expect } from 'vitest';
import { getAuthToken, createTicket, getCustomerByCode } from './ispcube.js';

const CONFIG = {
	baseUrl: 'https://sista.ispcube.online',
	username: 'u',
	password: 'p',
	apiKey: 'k',
	clientId: '734'
};

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
