/**
 * Candidatos para sumar a la Cartera por vendedor de IspCube.
 *
 * Pagina `GET /api/customers/customers_list` (viene ordenado por mas
 * reciente primero) y filtra por `seller_id` en este codigo -la API no
 * tiene filtro por vendedor, se probo `?seller_id=` y lo ignora, sondeado el
 * 2026-08-06-. No trae tickets ni cobranzas: eso lo completa el primer sync
 * normal de cada cliente (ver `descubrirCandidatosDeVendedor` en el store),
 * que ademas es donde se calcula `alta_nap`.
 *
 * Acotado por dos lados, para que un vendedor sin actividad reciente (o un
 * `antes` mal calculado) no dispare una paginada completa de toda la base:
 * un tope duro de paginas (`MAX_PAGINAS`) y `antes`, la fecha de alta mas
 * vieja que el asesor ya tiene en su cartera.
 */
import { json } from '@sveltejs/kit';
import { getCustomersPage } from '$lib/server/ispcube.js';
import { ispcubeConfig, pocketbaseUrl } from '$lib/server/ispcubeDeps.js';
import { verificarPermiso } from '$lib/server/adminAuth.js';
import { normalizarCliente } from '$lib/cartera/normalizar.js';
import { partesFecha, compararFechas } from '$lib/cartera/fechas.js';

export const prerender = false;
export const trailingSlash = 'ignore';

const TAMANO_PAGINA = 100;

/** 5 paginas x 100 = 500 clientes como mucho por llamada. */
const MAX_PAGINAS = 5;

/** @type {import('./$types').RequestHandler} */
export async function GET({ request, url }) {
	const auth = await verificarPermiso(request, pocketbaseUrl(), 'cartera');
	if (!auth.ok) {
		const status = auth.reason === 'sin_permiso' ? 403 : 401;
		return json({ error: auth.reason }, { status });
	}

	const vendedor = Number(url.searchParams.get('vendedor'));
	if (!Number.isFinite(vendedor) || vendedor <= 0) {
		return json({ error: 'vendedor_invalido' }, { status: 400 });
	}

	const antes = partesFecha(url.searchParams.get('antes'));
	if (!antes) return json({ error: 'antes_invalido' }, { status: 400 });

	const cfg = ispcubeConfig();
	const candidatos = [];

	for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
		const offset = pagina * TAMANO_PAGINA;
		const res = await getCustomersPage(offset, TAMANO_PAGINA, cfg);
		if (!res.ok || res.customers.length === 0) break;

		for (const crudo of res.customers) {
			const fecha = partesFecha(crudo?.start_date);
			// Sin fecha reconocible se prefiere incluirlo (no se puede juzgar su
			// antiguedad) a descartarlo en silencio.
			if (fecha && compararFechas(fecha, antes) < 0) continue;
			if (Number(crudo?.seller_id) === vendedor) candidatos.push(normalizarCliente(crudo));
		}

		const paginaCompleta = res.customers.length === TAMANO_PAGINA;
		const ultimaFecha = partesFecha(res.customers[res.customers.length - 1]?.start_date);
		if (!paginaCompleta) break;
		if (ultimaFecha && compararFechas(ultimaFecha, antes) < 0) break;
	}

	return json({ candidatos });
}
