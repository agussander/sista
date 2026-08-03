/**
 * Devuelve snapshots frescos para una lista de numeros de cliente.
 *
 * NO escribe en PocketBase: el navegador guarda el resultado con el token del
 * propio asesor, y asi las reglas de la coleccion (`asesor = @request.auth.id`)
 * siguen siendo la unica autorizacion. El servidor no necesita una cuenta de
 * servicio con permisos amplios.
 *
 * Estrategia por-cliente: 3 requests de IspCube por codigo. El spec documenta
 * una estrategia en bloque mucho mas barata; si el sondeo la habilita, se
 * reemplaza el cuerpo de `snapshotDe` y el contrato no cambia.
 */
import { json } from '@sveltejs/kit';
import { getCustomerByCode, getTickets, getCobranzas } from '$lib/server/ispcube.js';
import { ispcubeConfig, pocketbaseUrl } from '$lib/server/ispcubeDeps.js';
import { verificarAsesor } from '$lib/server/adminAuth.js';
import { normalizarCliente, resumenTickets } from '$lib/cartera/normalizar.js';
import { pagosDeCobranzas } from '$lib/cartera/pagos.js';

export const prerender = false;
export const trailingSlash = 'ignore';

/**
 * Tope de codigos por request. Es el limite duro del gasto de cuota que puede
 * provocar una sola llamada: 20 codigos x 3 requests = 60.
 */
const MAX_CODIGOS = 20;

/** Cuantos clientes se consultan en paralelo, para no ametrallar a IspCube. */
const CONCURRENCIA = 4;

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
	const auth = await verificarAsesor(request, pocketbaseUrl());
	if (!auth.ok) return json({ error: auth.reason }, { status: 401 });

	/** @type {any} */
	let body;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'body_invalido' }, { status: 400 });
	}

	const codes = Array.isArray(body?.codes) ? body.codes.filter((c) => typeof c === 'string') : [];
	if (codes.length === 0) return json({ error: 'sin_codigos' }, { status: 400 });
	if (codes.length > MAX_CODIGOS) return json({ error: 'demasiados_codigos' }, { status: 400 });

	const areasSoporte = Array.isArray(body?.areasSoporte) ? body.areasSoporte : [];
	const estadosCerrados = Array.isArray(body?.estadosCerrados) ? body.estadosCerrados : [];
	const cfg = ispcubeConfig();

	const resultados = await enTandas(codes, CONCURRENCIA, (code) =>
		snapshotDe(code, cfg, { areasSoporte, estadosCerrados })
	);

	return json({ resultados });
}

/**
 * Snapshot de un cliente. Nunca lanza: un fallo se devuelve como
 * `{ok: false, reason}` para que un cliente roto no tumbe la sincronizacion de
 * los demas.
 *
 * @param {string} code
 * @param {import('$lib/server/ispcube.js').IspcubeConfig} cfg
 * @param {{areasSoporte: unknown[], estadosCerrados: unknown[]}} opciones
 */
async function snapshotDe(code, cfg, { areasSoporte, estadosCerrados }) {
	const cliente = await getCustomerByCode(code, cfg);
	if (!cliente.ok) return { code, ok: false, reason: cliente.reason };

	const [tickets, cobranzas] = await Promise.all([getTickets(code, cfg), getCobranzas(code, cfg)]);

	return {
		code,
		ok: true,
		datos: {
			...normalizarCliente(cliente.customer.crudo ?? cliente.customer),
			tickets: tickets.ok
				? resumenTickets(tickets.tickets, { areasSoporte, estadosCerrados })
				: null,
			pagos: cobranzas.ok ? pagosDeCobranzas(cobranzas.cobranzas) : null
		}
	};
}

/**
 * Corre `fn` sobre `items` con como mucho `n` en vuelo a la vez.
 *
 * @template T, R
 * @param {T[]} items
 * @param {number} n
 * @param {(item: T) => Promise<R>} fn
 * @returns {Promise<R[]>} En el mismo orden que `items`
 */
async function enTandas(items, n, fn) {
	const salida = new Array(items.length);
	let siguiente = 0;

	const trabajador = async () => {
		while (siguiente < items.length) {
			const i = siguiente++;
			salida[i] = await fn(items[i]);
		}
	};

	await Promise.all(Array.from({ length: Math.min(n, items.length) }, trabajador));
	return salida;
}
