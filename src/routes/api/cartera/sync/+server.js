/**
 * Devuelve snapshots frescos para una lista de numeros de cliente.
 *
 * NO escribe en PocketBase: el navegador guarda el resultado con el token del
 * propio asesor, y asi las reglas de la coleccion (`asesor = @request.auth.id`)
 * siguen siendo la unica autorizacion. El servidor no necesita una cuenta de
 * servicio con permisos amplios.
 *
 * Estrategia por-cliente: 3 requests de IspCube por codigo, mas el catalogo de
 * planes (`getPlanCatalog`) una sola vez por request a este endpoint -no por
 * codigo-, cacheado una hora, asi que en la practica casi siempre es 0. El
 * spec documenta una estrategia en bloque mucho mas barata; si el sondeo la
 * habilita, se reemplaza el cuerpo de `snapshotDe` y el contrato no cambia.
 */
import { json } from '@sveltejs/kit';
import { getCustomerByCode, getTickets, getCobranzas, getPlanCatalog } from '$lib/server/ispcube.js';
import { ispcubeConfig, pocketbaseUrl } from '$lib/server/ispcubeDeps.js';
import { verificarPermiso } from '$lib/server/adminAuth.js';
import { normalizarCliente, resumenTickets } from '$lib/cartera/normalizar.js';
import { pagosDeCobranzas } from '$lib/cartera/pagos.js';
import { idsFinitos } from '$lib/cartera/ids.js';

export const prerender = false;
export const trailingSlash = 'ignore';

/**
 * Tope de codigos por request. Es el limite duro del gasto de cuota que puede
 * provocar una sola llamada: 20 codigos x 3 requests = 60.
 */
const MAX_CODIGOS = 20;

/**
 * Cuantos clientes se consultan en paralelo, para no ametrallar a IspCube.
 * OJO: no es el pico real de requests concurrentes. Cada worker hace
 * `getCustomerByCode` y despues `Promise.all([getTickets, getCobranzas])`,
 * asi que en el peor caso (los 4 workers en esa segunda etapa a la vez) hay
 * 8 requests en vuelo, el doble de este numero.
 */
const CONCURRENCIA = 4;

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
	const auth = await verificarPermiso(request, pocketbaseUrl(), 'cartera');
	if (!auth.ok) {
		// sin_token/token_invalido: no sabemos quien es. sin_permiso: sabemos
		// quien es y no puede: por eso el codigo distinto (403, no 401).
		const status = auth.reason === 'sin_permiso' ? 403 : 401;
		return json({ error: auth.reason }, { status });
	}
	// auth.usuarioId no se usa: este endpoint no escribe en PocketBase (ver
	// comentario arriba del archivo), asi que no hay nada que atar al usuario.
	// El permiso ya se valido arriba.

	/** @type {any} */
	let body;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'body_invalido' }, { status: 400 });
	}

	// El tope se chequea sobre el array crudo, ANTES de filtrar por tipo: si se
	// chequeara despues, `{"codes": [1,2,...,10000, "003566", ...20 strings]}`
	// pasaria el tope (el filtro deja solo los 20 strings) y el servidor
	// parsearia y filtraria un array de 10000 elementos por request. La cuota
	// de IspCube sigue acotada a 60 de cualquier forma (son los 20 codigos los
	// que la determinan), pero el trabajo de CPU por pedido no.
	const codesCrudo = Array.isArray(body?.codes) ? body.codes : [];
	if (codesCrudo.length > MAX_CODIGOS) return json({ error: 'demasiados_codigos' }, { status: 400 });

	const codes = codesCrudo.filter((c) => typeof c === 'string');
	if (codes.length === 0) return json({ error: 'sin_codigos' }, { status: 400 });

	// Se coerciona a numero aca, en el borde: `areasSoporte` y
	// `estadosCerrados` vienen del body, controlado por quien llama. Sin esto
	// un item hostil como `{"toString":1,"valueOf":1}` termina en `String()`
	// dentro de `resumenTickets` y tira `TypeError: Cannot convert object to
	// primitive value`.
	const areasSoporte = Array.isArray(body?.areasSoporte) ? idsFinitos(body.areasSoporte) : [];
	const estadosCerrados = Array.isArray(body?.estadosCerrados) ? idsFinitos(body.estadosCerrados) : [];
	const cfg = ispcubeConfig();
	// Una sola vez por batch, no por codigo: cacheado adentro de
	// `getPlanCatalog`, asi que no suma un request de cuota por cliente.
	const planes = await getPlanCatalog(cfg);
	const nombrePorId = planes.ok ? planes.porId : undefined;

	const resultados = await enTandas(codes, CONCURRENCIA, (code) =>
		snapshotDe(code, cfg, { areasSoporte, estadosCerrados, nombrePorId })
	);

	return json({ resultados });
}

/**
 * Snapshot de un cliente. Nunca lanza: un fallo se devuelve como
 * `{ok: false, reason}` para que un cliente roto no tumbe la sincronizacion de
 * los demas.
 *
 * El try/catch no es cosmetico, es lo que hace cierta esa promesa. Los datos
 * de aca abajo (`normalizarCliente`, `resumenTickets`, `pagosDeCobranzas`)
 * hacen `String()`/`Number()` sobre campos que IspCube controla
 * (`ticket_area_id`, `debt`, `duedebt`, `total`). Si IspCube alguna vez
 * devuelve uno de esos campos como un objeto sin `toString` ni `valueOf`
 * invocables -algo fuera de nuestro control-, `String()`/`Number()` tiran
 * `TypeError` en vez de devolver texto o `NaN`. Sin este catch, ese
 * `TypeError` sube hasta `enTandas`, tumba el `Promise.all` del batch entero
 * y se pierden tambien los requests de IspCube ya pagados de los demas
 * clientes del lote.
 *
 * @param {string} code
 * @param {import('$lib/server/ispcube.js').IspcubeConfig} cfg
 * @param {{areasSoporte: number[], estadosCerrados: number[], nombrePorId?: Map<number, string>}} opciones
 */
async function snapshotDe(code, cfg, { areasSoporte, estadosCerrados, nombrePorId }) {
	try {
		const cliente = await getCustomerByCode(code, cfg);
		if (!cliente.ok) return { code, ok: false, reason: cliente.reason };

		const [tickets, cobranzas] = await Promise.all([getTickets(code, cfg), getCobranzas(code, cfg)]);

		return {
			code,
			ok: true,
			datos: {
				...normalizarCliente(cliente.customer.crudo ?? cliente.customer, nombrePorId),
				tickets: tickets.ok
					? resumenTickets(tickets.tickets, { areasSoporte, estadosCerrados })
					: null,
				pagos: cobranzas.ok ? pagosDeCobranzas(cobranzas.cobranzas) : null
			}
		};
	} catch (error) {
		console.error(`[cartera/sync] fallo el snapshot de ${code}:`, error);
		return { code, ok: false, reason: 'error' };
	}
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
