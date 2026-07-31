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
