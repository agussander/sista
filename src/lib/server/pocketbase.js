/**
 * Alta de registros en PocketBase desde el servidor.
 *
 * Para llamenme y para bajas, PocketBase es la fuente de verdad: si esto falla,
 * el formulario devuelve error aunque el mail hubiera salido. El SDK
 * `pocketbase` no se usa aca porque para un POST suelto alcanza con `fetch` y
 * asi el modulo queda testeable sin mocks del SDK.
 */

/**
 * @param {string} baseUrl URL de PocketBase, con o sin barra final
 * @param {string} collection Nombre de la coleccion
 * @param {Record<string, unknown>} data Cuerpo del registro
 * @param {{ fetchImpl?: typeof fetch }} [options]
 * @returns {Promise<{ok: boolean, status: number, body: string}>}
 */
export async function createRecord(baseUrl, collection, data, { fetchImpl = fetch } = {}) {
	const url = `${baseUrl.replace(/\/+$/, '')}/api/collections/${collection}/records`;

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
