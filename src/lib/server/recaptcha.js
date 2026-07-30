/**
 * Verificacion server-side de reCAPTCHA. Puerto de
 * `static/assets/includes/recaptcha-verify.php`.
 *
 * No lee `$env` a proposito: el secret entra por parametro. Asi el modulo es
 * testeable con Vitest sin los modulos virtuales de SvelteKit, y el punto donde
 * se leen los secrets queda concentrado en los `+server.js`.
 */

export const RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

/** Umbral de la doc oficial de Google para v3. Mismo valor que usaba el PHP. */
export const MIN_SCORE = 0.5;

/**
 * @typedef {{ ok: boolean, reason: string, score: number | null }} RecaptchaResult
 */

/**
 * @param {string | null | undefined} token Token `g-recaptcha-response` del cliente
 * @param {object} options
 * @param {string} options.secret `RECAPTCHA_SECRET_KEY`
 * @param {string | null} [options.remoteIp] IP del visitante, si se conoce
 * @param {typeof fetch} [options.fetchImpl] Inyectable para tests
 * @returns {Promise<RecaptchaResult>}
 */
export async function verifyRecaptcha(token, { secret, remoteIp = null, fetchImpl = fetch }) {
	const clean = typeof token === 'string' ? token.trim() : '';
	if (clean === '') return { ok: false, reason: 'empty', score: null };
	if (!secret) {
		console.error('[recaptcha] RECAPTCHA_SECRET_KEY no configurada');
		return { ok: false, reason: 'config', score: null };
	}

	const body = new URLSearchParams({ secret, response: clean });
	if (remoteIp) body.set('remoteip', remoteIp);

	/** @type {any} */
	let data;
	try {
		const res = await fetchImpl(RECAPTCHA_VERIFY_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: body.toString(),
			signal: AbortSignal.timeout(10_000)
		});
		data = await res.json();
	} catch (error) {
		console.error('[recaptcha] error de red:', error);
		return { ok: false, reason: 'network', score: null };
	}

	if (!data || typeof data.success === 'undefined') {
		console.error('[recaptcha] respuesta invalida:', data);
		return { ok: false, reason: 'invalid', score: null };
	}

	// v2 no devuelve score; en ese caso solo vale `success`.
	const score = typeof data.score === 'number' ? data.score : null;

	if (!data.success) {
		console.error('[recaptcha] rechazado:', data['error-codes']);
		return { ok: false, reason: 'failed', score };
	}
	if (score !== null && score < MIN_SCORE) {
		return { ok: false, reason: 'low_score', score };
	}
	return { ok: true, reason: 'ok', score };
}
