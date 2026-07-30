import { describe, it, expect } from 'vitest';
import { verifyRecaptcha, MIN_SCORE, RECAPTCHA_VERIFY_URL } from './recaptcha.js';

/** fetch falso que responde con el JSON dado. Guarda el body para inspeccionarlo. */
function fakeFetch(json, { calls } = {}) {
	return async (url, init) => {
		calls?.push({ url, init });
		return { ok: true, json: async () => json };
	};
}

describe('verifyRecaptcha', () => {
	it('rechaza un token vacio sin llamar a Google', async () => {
		const calls = [];
		const res = await verifyRecaptcha('', {
			secret: 's3cr3t',
			fetchImpl: fakeFetch({ success: true }, { calls })
		});

		expect(res).toEqual({ ok: false, reason: 'empty', score: null });
		expect(calls).toHaveLength(0);
	});

	it('trata como vacio un token que es solo espacios o no es string', async () => {
		const opts = { secret: 's3cr3t', fetchImpl: fakeFetch({ success: true }) };
		expect((await verifyRecaptcha('   ', opts)).reason).toBe('empty');
		expect((await verifyRecaptcha(null, opts)).reason).toBe('empty');
		expect((await verifyRecaptcha(undefined, opts)).reason).toBe('empty');
	});

	it('falla con reason config si no hay secret', async () => {
		const res = await verifyRecaptcha('tok', {
			secret: '',
			fetchImpl: fakeFetch({ success: true })
		});

		expect(res).toEqual({ ok: false, reason: 'config', score: null });
	});

	it('acepta un token valido con score alto', async () => {
		const res = await verifyRecaptcha('tok', {
			secret: 's3cr3t',
			fetchImpl: fakeFetch({ success: true, score: 0.9 })
		});

		expect(res).toEqual({ ok: true, reason: 'ok', score: 0.9 });
	});

	it('acepta v2 (respuesta sin score)', async () => {
		const res = await verifyRecaptcha('tok', {
			secret: 's3cr3t',
			fetchImpl: fakeFetch({ success: true })
		});

		expect(res).toEqual({ ok: true, reason: 'ok', score: null });
	});

	it('rechaza por score bajo', async () => {
		const res = await verifyRecaptcha('tok', {
			secret: 's3cr3t',
			fetchImpl: fakeFetch({ success: true, score: 0.3 })
		});

		expect(res).toEqual({ ok: false, reason: 'low_score', score: 0.3 });
	});

	it('el umbral exacto pasa', async () => {
		const res = await verifyRecaptcha('tok', {
			secret: 's3cr3t',
			fetchImpl: fakeFetch({ success: true, score: MIN_SCORE })
		});

		expect(res.ok).toBe(true);
	});

	it('rechaza cuando Google dice success false', async () => {
		const res = await verifyRecaptcha('tok', {
			secret: 's3cr3t',
			fetchImpl: fakeFetch({ success: false, 'error-codes': ['timeout-or-duplicate'] })
		});

		expect(res).toEqual({ ok: false, reason: 'failed', score: null });
	});

	it('rechaza una respuesta sin la clave success', async () => {
		const res = await verifyRecaptcha('tok', {
			secret: 's3cr3t',
			fetchImpl: fakeFetch({ cualquier: 'cosa' })
		});

		expect(res).toEqual({ ok: false, reason: 'invalid', score: null });
	});

	it('devuelve network si fetch explota', async () => {
		const res = await verifyRecaptcha('tok', {
			secret: 's3cr3t',
			fetchImpl: async () => {
				throw new Error('ECONNRESET');
			}
		});

		expect(res).toEqual({ ok: false, reason: 'network', score: null });
	});

	it('postea secret, response y remoteip a la url de Google', async () => {
		const calls = [];
		await verifyRecaptcha('tok', {
			secret: 's3cr3t',
			remoteIp: '1.2.3.4',
			fetchImpl: fakeFetch({ success: true, score: 0.9 }, { calls })
		});

		expect(calls[0].url).toBe(RECAPTCHA_VERIFY_URL);
		expect(calls[0].init.method).toBe('POST');
		const body = new URLSearchParams(calls[0].init.body);
		expect(body.get('secret')).toBe('s3cr3t');
		expect(body.get('response')).toBe('tok');
		expect(body.get('remoteip')).toBe('1.2.3.4');
	});

	it('omite remoteip cuando no se conoce la ip', async () => {
		const calls = [];
		await verifyRecaptcha('tok', {
			secret: 's3cr3t',
			fetchImpl: fakeFetch({ success: true, score: 0.9 }, { calls })
		});

		expect(new URLSearchParams(calls[0].init.body).has('remoteip')).toBe(false);
	});
});
