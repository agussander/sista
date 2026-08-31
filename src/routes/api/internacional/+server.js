/**
 * Cuadro tarifario internacional en JSON: una entrada por prefijo, en el orden
 * del Excel.
 *
 * Existe para que nadie tenga que scrapear /internacional. La pagina y este
 * endpoint leen el mismo modulo, asi que no pueden desincronizarse.
 *
 * `precio` va crudo, en dolares y sin formatear. La columna G de la hoja no
 * sale: son notas internas.
 *
 * Es publico y sin token, como la pagina: son precios de lista.
 */
import { json } from '@sveltejs/kit';
import {
	TITULO,
	VIGENCIA,
	ENCABEZADOS,
	FILAS
} from '$lib/tarifario/hojaInternacional.js';

export const prerender = false;
export const trailingSlash = 'ignore';

/**
 * Las filas se guardan como tuplas para que el modulo no pese el triple; a la
 * API salen como objetos, que es lo que espera cualquier cliente.
 */
const destinos = FILAS.map(([prefijo, destino, tipo, precio]) => ({
	prefijo,
	destino,
	tipo,
	precio
}));

/** @type {import('./$types').RequestHandler} */
export function GET() {
	return json(
		{
			titulo: TITULO,
			vigencia: VIGENCIA,
			moneda: 'USD',
			encabezados: ENCABEZADOS,
			total: destinos.length,
			destinos
		},
		{
			headers: { 'cache-control': 'public, max-age=1800' }
		}
	);
}
