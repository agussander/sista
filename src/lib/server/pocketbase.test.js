import { describe, it, expect } from 'vitest';
import { createRecord } from './pocketbase.js';

function fakeFetch(response, calls) {
	return async (url, init) => {
		calls?.push({ url, init });
		return response;
	};
}

const OK = { ok: true, status: 200, json: async () => ({ id: 'abc' }), text: async () => '{}' };

describe('createRecord', () => {
	it('postea al endpoint de la coleccion', async () => {
		const calls = [];
		await createRecord('https://sista.pockethost.io', 'quiero_que_me_llamen', { numero: '221' }, {
			fetchImpl: fakeFetch(OK, calls)
		});

		expect(calls[0].url).toBe(
			'https://sista.pockethost.io/api/collections/quiero_que_me_llamen/records'
		);
		expect(calls[0].init.method).toBe('POST');
		expect(JSON.parse(calls[0].init.body)).toEqual({ numero: '221' });
	});

	it('saca la barra final de la base url', async () => {
		const calls = [];
		await createRecord('https://sista.pockethost.io/', 'bajas', {}, {
			fetchImpl: fakeFetch(OK, calls)
		});

		expect(calls[0].url).toBe('https://sista.pockethost.io/api/collections/bajas/records');
	});

	it('devuelve ok true cuando pocketbase acepta', async () => {
		const res = await createRecord('https://pb', 'c', {}, { fetchImpl: fakeFetch(OK) });
		expect(res.ok).toBe(true);
	});

	it('devuelve ok false con el status cuando pocketbase rechaza', async () => {
		const res = await createRecord('https://pb', 'c', {}, {
			fetchImpl: fakeFetch({
				ok: false,
				status: 400,
				text: async () => '{"message":"Failed to create record."}'
			})
		});

		expect(res.ok).toBe(false);
		expect(res.status).toBe(400);
	});

	it('devuelve ok false si la red falla', async () => {
		const res = await createRecord('https://pb', 'c', {}, {
			fetchImpl: async () => {
				throw new Error('ECONNREFUSED');
			}
		});

		expect(res.ok).toBe(false);
		expect(res.status).toBe(0);
	});
});
