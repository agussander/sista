/**
 * Guardia de los endpoints de administracion.
 *
 * Hasta ahora ningun endpoint del servidor autenticaba administradores: el
 * panel lee PocketBase directo desde el navegador y la seguridad la ponen las
 * reglas de la coleccion. Los endpoints de la Cartera son distintos: hacen de
 * proxy a IspCube, y sin guardia
 * `GET /api/cartera/cliente/003566` seria un enumerador publico de la base de
 * clientes de Sista.
 *
 * El token de PocketBase se valida contra el propio PocketBase en vez de
 * verificar el JWT localmente: no tenemos su secreto de firma, y ademas asi
 * una sesion revocada deja de funcionar en el acto.
 *
 * Como el resto de `src/lib/server/`, no lee `$env`: la URL entra por
 * parametro.
 */

/**
 * @param {{headers: {get: (name: string) => string | null}}} request
 * @param {string} pocketbaseUrl
 * @param {{ fetchImpl?: typeof fetch }} [options]
 * @returns {Promise<{ok: true, asesorId: string} | {ok: false, reason: string}>}
 *   `reason` puede ser `sin_token`, `token_invalido` o `network`.
 */
export async function verificarAsesor(request, pocketbaseUrl, { fetchImpl = fetch } = {}) {
	const header = request?.headers?.get('authorization') ?? null;
	if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
		return { ok: false, reason: 'sin_token' };
	}

	const token = header.slice('Bearer '.length).trim();
	if (!token) return { ok: false, reason: 'sin_token' };

	const url = `${pocketbaseUrl.replace(/\/+$/, '')}/api/collections/users/auth-refresh`;

	try {
		const res = await fetchImpl(url, {
			method: 'POST',
			// PocketBase espera el token pelado en Authorization, sin el "Bearer".
			headers: { 'Content-Type': 'application/json', Authorization: token },
			signal: AbortSignal.timeout(10_000)
		});

		if (!res.ok) return { ok: false, reason: 'token_invalido' };

		const data = await res.json();
		const asesorId = data?.record?.id;
		if (typeof asesorId !== 'string' || !asesorId) {
			return { ok: false, reason: 'token_invalido' };
		}

		return { ok: true, asesorId };
	} catch (error) {
		console.error('[adminAuth] no se pudo validar el token:', error);
		return { ok: false, reason: 'network' };
	}
}
