/**
 * Cuadro tarifario de Linea VIP en JSON.
 *
 * Existe para que nadie tenga que scrapear /lineavip. La pagina y este endpoint
 * leen el mismo modulo, asi que no pueden desincronizarse.
 *
 * Los numeros van crudos, sin redondear ni formatear: la pagina los pinta con
 * el formato de celda del Excel ("$ 21.451"), pero quien automatiza quiere el
 * valor. `cargoInicial` sale numero en los planes de radio y el texto "--" en
 * los de fibra, igual que en la hoja.
 *
 * Es publico y sin token, como la pagina: son precios de lista.
 */
import { json } from '@sveltejs/kit';
import {
	TITULO,
	VIGENCIA,
	VERSION,
	ENCABEZADOS,
	PLANES,
	APARATO,
	NOTA_INTERNACIONAL,
	LINK_INTERNACIONAL,
	NOTAS
} from '$lib/tarifario/hojaLineaVip.js';

export const prerender = false;
export const trailingSlash = 'ignore';

/** @type {import('./$types').RequestHandler} */
export function GET() {
	return json(
		{
			titulo: TITULO,
			vigencia: VIGENCIA,
			version: VERSION,
			moneda: 'ARS',
			encabezados: ENCABEZADOS,
			planes: PLANES,
			aparato: APARATO,
			notas: [NOTA_INTERNACIONAL, ...NOTAS],
			linkInternacional: LINK_INTERNACIONAL
		},
		{
			// Los precios cambian una vez por mes: media hora de cache le ahorra
			// trabajo al server sin que nadie vea un tarifario viejo.
			headers: { 'cache-control': 'public, max-age=1800' }
		}
	);
}
