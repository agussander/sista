/**
 * Alta de registros en PocketBase desde el servidor.
 *
 * Para llamenme y para bajas, PocketBase es la fuente de verdad: si esto falla,
 * el formulario devuelve error aunque el mail hubiera salido. El SDK
 * `pocketbase` no se usa aca porque para un POST suelto alcanza con `fetch` y
 * asi el modulo queda testeable sin mocks del SDK.
 *
 * La escritura va anonima: sin token ni header `Authorization`. Este modulo no
 * implementa ninguna capa de seguridad propia — toda la proteccion de la
 * coleccion depende de la Create Rule configurada en PocketBase, mas el
 * reCAPTCHA que corre antes, en el endpoint que llama a `createRecord`.
 */

/**
 * @param {string} baseUrl URL de PocketBase, con o sin barra final
 * @param {string} collection Nombre de la coleccion
 * @param {Record<string, unknown>} data Cuerpo del registro
 * @param {{ fetchImpl?: typeof fetch }} [options]
 * @returns {Promise<{ok: boolean, status: number, body: string}>} `status` es
 *   el HTTP status de PocketBase cuando la request llego a destino (2xx-5xx).
 *   `status: 0` es un sentinel que significa "no llegue a PocketBase" —
 *   timeout, DNS, conexion rechazada, etc. — y no un status real, para que el
 *   llamador pueda distinguir "PocketBase me rechazo" de "no pude ni
 *   preguntarle". `body` es el texto crudo de la respuesta (o el mensaje del
 *   error de red); ningun endpoint lo usa hoy para decidir nada, se devuelve
 *   solo como dato de diagnostico para quien loguee o depure el caso.
 */
export async function createRecord(baseUrl, collection, data, { fetchImpl = fetch } = {}) {
	const url = `${baseUrl.replace(/\/+$/, '')}/api/collections/${encodeURIComponent(collection)}/records`;

	try {
		const res = await fetchImpl(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(data),
			signal: AbortSignal.timeout(10_000)
		});

		const body = await res.text();
		if (!res.ok) {
			console.error(`[pocketbase] ${collection} respondio ${res.status}: ${body}`);
			return { ok: false, status: res.status, body };
		}
		return { ok: true, status: res.status, body };
	} catch (error) {
		console.error(`[pocketbase] error de red en ${collection}:`, error);
		return { ok: false, status: 0, body: String(error) };
	}
}
