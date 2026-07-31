/**
 * Unica capa que lee `$env` para IspCube, igual que `endpointDeps.js` con el
 * mail y el captcha. Mantiene a `ispcube.js` puro y testeable.
 */
import { env } from '$env/dynamic/private';

/**
 * Los defaults son solo para la URL base (el host es publico y estable). Las
 * credenciales NO tienen fallback: si faltan, `getAuthToken` corta con
 * `reason: 'config'` y deja un console.error, en vez de fingir que hay
 * configuracion y fallar mas adelante con un error confuso.
 *
 * @returns {import('./ispcube.js').IspcubeConfig}
 */
export function ispcubeConfig() {
	return {
		baseUrl: (env.ISPCUBE_API_URL || 'https://sista.ispcube.online').replace(/\/+$/, ''),
		username: env.ISPCUBE_USERNAME || '',
		password: env.ISPCUBE_PASSWORD || '',
		apiKey: env.ISPCUBE_API_KEY || '',
		clientId: env.ISPCUBE_CLIENT_ID || ''
	};
}
