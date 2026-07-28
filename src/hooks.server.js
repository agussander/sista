import { env } from '$env/dynamic/private';
import { shouldBlockIndexing, NOINDEX_VALUE } from '$lib/server/robotsHeader.js';

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
	const response = await resolve(event);

	if (shouldBlockIndexing(env.SITE_ENV)) {
		response.headers.set('X-Robots-Tag', NOINDEX_VALUE);
	}

	return response;
}
