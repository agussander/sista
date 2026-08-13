/**
 * TEMPORAL. Diagnostico de por que el server desplegado no consigue token de
 * IspCube. Borrar este archivo cuando el problema este cerrado.
 *
 * Existe porque `pedirToken` colapsa tres fallas distintas en un solo
 * `reason: 'auth'`: hace `res.json()` sin mirar el status y atrapa cualquier
 * excepcion, asi que "IspCube rechazo las credenciales", "Apache contesto 403
 * con HTML" y "no pude ni abrir la conexion" se ven exactamente igual desde
 * afuera. Y en Hostinger no hay forma de leer los `console.error` de runtime.
 *
 * Este endpoint hace el mismo POST a mano y devuelve lo que aquel se come: el
 * status, el content-type, un pedazo del cuerpo y -lo que de verdad importa-
 * el `cause.code` de undici, que es donde viven ECONNREFUSED / ETIMEDOUT /
 * ECONNRESET / ENOTFOUND. Ademas reporta la IP de salida del server (la que
 * hay que habilitar en el firewall) y una huella de las credenciales que
 * recibio el PROCESO, que no es lo mismo que lo que muestra hPanel.
 *
 * No toca `ispcube.js`: replica el request en vez de instrumentar el camino
 * caliente, para que un diagnostico temporal no pueda romper produccion.
 *
 * Solo lectura, y detras del mismo permiso de admin que el resto de la
 * Cartera: el cuerpo de la respuesta de IspCube puede traer detalle que no
 * corresponde publicar.
 */
import { json } from '@sveltejs/kit';
import { createHash } from 'node:crypto';
import { ispcubeConfig, pocketbaseUrl } from '$lib/server/ispcubeDeps.js';
import { verificarPermiso } from '$lib/server/adminAuth.js';

export const prerender = false;
export const trailingSlash = 'ignore';

/** Cuanto del cuerpo de IspCube se devuelve. Alcanza para ver si es el JSON de la API o un HTML de Apache. */
const TOPE_CUERPO = 400;

/**
 * Largo y prefijo de sha256 de un valor, nunca el valor.
 *
 * Sirve para comparar contra la huella del `.env` local sin que ninguna
 * credencial viaje al navegador ni quede en un log. 32 bits de hash de una
 * clave de 24 caracteres no la revelan; lo que revelan es si el proceso
 * recibio *otra cosa* de la que se cargo en hPanel.
 *
 * @param {string} valor
 */
function huella(valor) {
	return {
		largo: valor.length,
		sha: valor ? createHash('sha256').update(valor).digest('hex').slice(0, 8) : null
	};
}

/**
 * Desarma un error de fetch hasta el `cause`, que es donde undici deja el
 * motivo real: un `TypeError: fetch failed` pelado no distingue una conexion
 * rechazada de un DNS que no resuelve.
 *
 * @param {unknown} error
 */
function detalleError(error) {
	const e = /** @type {any} */ (error);
	return {
		name: e?.name ?? null,
		message: e?.message ?? String(error),
		causa: e?.cause
			? {
					name: e.cause.name ?? null,
					message: e.cause.message ?? null,
					// ECONNREFUSED (firewall que rechaza), ETIMEDOUT (paquetes
					// descartados en silencio), ECONNRESET, ENOTFOUND, o un error
					// de TLS. Es el campo que decide el diagnostico.
					code: e.cause.code ?? null,
					errno: e.cause.errno ?? null
				}
			: null
	};
}

/** @type {import('./$types').RequestHandler} */
export async function GET({ request }) {
	const auth = await verificarPermiso(request, pocketbaseUrl(), 'cartera');
	if (!auth.ok) {
		const status = auth.reason === 'sin_permiso' ? 403 : 401;
		return json({ error: auth.reason }, { status });
	}

	const cfg = ispcubeConfig();

	// 1. Desde que IP sale este server. Es el dato que hay que llevarle al
	//    firewall de IspCube, y no se puede deducir desde afuera: todo lo que
	//    resuelve publicamente son IPs del CDN de Hostinger.
	let salida;
	const t0 = Date.now();
	try {
		const res = await fetch('https://api.ipify.org?format=json', {
			signal: AbortSignal.timeout(10_000)
		});
		const data = await res.json();
		salida = { ip: data?.ip ?? null, ms: Date.now() - t0 };
	} catch (error) {
		salida = { ip: null, ms: Date.now() - t0, error: detalleError(error) };
	}

	// 2. Que credenciales tiene el PROCESO. Si esto no coincide con la huella
	//    del `.env`, el problema es la configuracion y no la red.
	const credenciales = {
		ISPCUBE_API_URL: { ...huella(cfg.baseUrl), valor: cfg.baseUrl },
		ISPCUBE_USERNAME: huella(cfg.username),
		ISPCUBE_PASSWORD: huella(cfg.password),
		ISPCUBE_API_KEY: huella(cfg.apiKey),
		ISPCUBE_CLIENT_ID: huella(cfg.clientId)
	};

	// 3. El POST del token, igual que `pedirToken` pero sin comerse nada.
	const url = `${cfg.baseUrl.replace(/\/+$/, '')}/api/sanctum/token`;
	let token;
	const t1 = Date.now();
	try {
		const res = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json',
				'api-key': cfg.apiKey,
				'client-id': cfg.clientId,
				'login-type': 'api'
			},
			body: JSON.stringify({ username: cfg.username, password: cfg.password }),
			signal: AbortSignal.timeout(30_000)
		});

		const crudo = await res.text();
		let hayToken = false;
		try {
			const data = JSON.parse(crudo);
			hayToken = Boolean(data?.data?.token ?? data?.token);
		} catch {
			// No es JSON: casi seguro un HTML de Apache. El cuerpo lo cuenta.
		}

		token = {
			ms: Date.now() - t1,
			status: res.status,
			contentType: res.headers.get('content-type'),
			server: res.headers.get('server'),
			hayToken,
			cuerpo: crudo.slice(0, TOPE_CUERPO)
		};
	} catch (error) {
		token = { ms: Date.now() - t1, status: null, error: detalleError(error) };
	}

	return json({ salida, credenciales, token });
}
