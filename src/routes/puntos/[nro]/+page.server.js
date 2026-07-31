/**
 * Resuelve el numero de cliente que viene en el QR de la plataforma de puntos.
 *
 * Prueba de concepto: valida el circuito camara -> URL -> API IspCube -> nombre
 * en pantalla. No hay modelo de puntos todavia.
 */
import { getCustomerByCode } from '$lib/server/ispcube.js';
import { ispcubeConfig } from '$lib/server/ispcubeDeps.js';
import { toTitleCase } from '$lib/formatName.js';

// Consulta una API en cada request: no se puede prerenderizar. Es la razon por
// la que `svelte.config.js` necesita `strict: false` en adapter-static.
export const prerender = false;

/** Solo digitos, igual que en `ispcube.js`. */
const NRO_VALIDO = /^\d{1,12}$/;

/** @type {import('./$types').PageServerLoad} */
export async function load({ params }) {
	// El parametro sale de la URL, asi que se muestra en pantalla solo si tiene
	// forma de numero de cliente. Svelte ya escapa el valor, pero reflejar texto
	// arbitrario igual rompe el diseño de la pagina.
	const nro = NRO_VALIDO.test(params.nro) ? params.nro : '';

	const result = await getCustomerByCode(params.nro, ispcubeConfig());

	if (result.ok) {
		return { estado: 'ok', nro, nombre: toTitleCase(result.customer.name) };
	}

	// El detalle tecnico ya quedo en el log del servidor; al navegador solo va
	// la distincion entre "no existe" y "algo se rompio".
	return {
		estado: result.reason === 'not_found' ? 'no_encontrado' : 'error',
		nro,
		nombre: ''
	};
}
