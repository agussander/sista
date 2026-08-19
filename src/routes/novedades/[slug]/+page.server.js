/**
 * Una novedad completa.
 *
 * Se renderiza en el servidor para que los MetaTags de ESTA novedad (titulo,
 * bajada, imagen) esten en el HTML: es lo unico que hace que al pegar el link
 * en WhatsApp o Facebook aparezca la foto de la novedad y no el preview
 * generico del sitio.
 *
 * `prerender = false` pisa el `true` global de `src/routes/+layout.js`.
 */
import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { traerPorSlug, aNovedadPublica } from '$lib/server/novedades.js';

export const prerender = false;

/** @type {import('./$types').PageServerLoad} */
export async function load({ params }) {
	const baseUrl = env.VITE_POCKETBASE_URL || 'https://sista.pockethost.io';
	const registro = await traerPorSlug(baseUrl, params.slug);

	// Un borrador cae aca igual que un slug inexistente: `traerPorSlug` filtra
	// por `publicada`, asi que desde afuera no hay forma de distinguir "todavia
	// no la publicamos" de "no existe".
	if (!registro) error(404, 'No encontramos esta novedad');

	return { novedad: aNovedadPublica(baseUrl, registro) };
}
