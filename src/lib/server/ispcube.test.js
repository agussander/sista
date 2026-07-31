import { describe, it, expect } from 'vitest';
import { getAuthToken, createTicket } from './ispcube.js';

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
