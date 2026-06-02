import { redirect } from '@sveltejs/kit';

/** @type {import('./$types').LayoutLoad} */
export function load({ url }) {
	const path = url.pathname.replace(/\/$/, '') || '/';
	if (path !== '/conectarlaciudad') {
		throw redirect(302, '/conectarlaciudad');
	}
	return {};
}
