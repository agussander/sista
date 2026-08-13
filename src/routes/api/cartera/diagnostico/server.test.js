/**
 * TEMPORAL, igual que el endpoint que cubre. Borrar junto con el.
 *
 * Lo unico que importa afirmar es que el endpoint no repita el pecado que
 * vino a diagnosticar: `pedirToken` se come el status y el `cause` del error,
 * y por eso tres fallas distintas se ven iguales. Estos tests fijan que aca
 * cada una salga distinguible, y que la guardia de admin siga puesta -el
 * cuerpo de la respuesta trae detalle de IspCube que no corresponde publicar-.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { GET } from './+server.js';

vi.mock('$lib/server/ispcubeDeps.js', () => ({
	ispcubeConfig: () => ({
		baseUrl: 'https://ispcube',
		username: 'usuario',
		password: 'clave-secreta',
		apiKey: 'key',
		clientId: '123'
	}),
	pocketbaseUrl: () => 'http://pb'
}));

const CON_TOKEN = {
	request: new Request('http://x/api/cartera/diagnostico', {
		headers: { Authorization: 'Bearer tok-valido' }
	})
};

const SIN_TOKEN = { request: new Request('http://x/api/cartera/diagnostico') };

/**
 * Enruta el fetch por host: el endpoint pega primero a ipify y despues a
 * IspCube, y cada test quiere controlar solo el segundo.
 *
 * @param {(url: string) => any} ispcube Que hace el POST del token
 */
function stubFetch(ispcube) {
	vi.stubGlobal(
		'fetch',
		vi.fn(async (url) => {
			const u = String(url);
			if (u.includes('pb')) {
				return {
					ok: true,
					json: async () => ({ record: { id: 'u1', permisos: ['cartera'] } })
				};
			}
			if (u.includes('ipify')) return { json: async () => ({ ip: '203.0.113.7' }) };
			return ispcube(u);
		})
	);
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('GET /api/cartera/diagnostico', () => {
	it('sin token no llama a IspCube ni expone nada', async () => {
		const espia = vi.fn();
		stubFetch(espia);

		const res = await GET(SIN_TOKEN);

		expect(res.status).toBe(401);
		expect(espia).not.toHaveBeenCalled();
	});

	it('una conexion rechazada llega con su code, no como "fetch failed"', async () => {
		stubFetch(() => {
			const error = new TypeError('fetch failed');
			error.cause = Object.assign(new Error('connect ECONNREFUSED 186.65.87.252:443'), {
				code: 'ECONNREFUSED',
				errno: -61
			});
			throw error;
		});

		const { token } = await (await GET(CON_TOKEN)).json();

		expect(token.status).toBeNull();
		expect(token.error.causa.code).toBe('ECONNREFUSED');
	});

	it('un 403 con HTML de Apache llega con status y cuerpo', async () => {
		stubFetch(() => ({
			status: 403,
			headers: { get: (h) => (h === 'server' ? 'Apache/2.4.6 (CentOS)' : 'text/html') },
			text: async () => '<html><body><h1>Forbidden</h1></body></html>'
		}));

		const { token } = await (await GET(CON_TOKEN)).json();

		expect(token.status).toBe(403);
		expect(token.hayToken).toBe(false);
		expect(token.cuerpo).toContain('Forbidden');
	});

	it('la huella de las credenciales no filtra los valores', async () => {
		stubFetch(() => ({
			status: 200,
			headers: { get: () => 'application/json' },
			text: async () => JSON.stringify({ token: '147310|abc' })
		}));

		const res = await GET(CON_TOKEN);
		const cuerpo = await res.json();

		expect(cuerpo.token.hayToken).toBe(true);
		expect(cuerpo.salida.ip).toBe('203.0.113.7');
		expect(cuerpo.credenciales.ISPCUBE_PASSWORD.largo).toBe('clave-secreta'.length);
		// El valor de la clave no puede aparecer en ningun lado de la respuesta.
		expect(JSON.stringify(cuerpo)).not.toContain('clave-secreta');
	});
});
