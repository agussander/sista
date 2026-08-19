/**
 * Lectura de novedades desde el servidor, para el `load` de las rutas publicas.
 *
 * Va por `fetch` pelado y no por el SDK, igual que `pocketbase.js`: para dos
 * GET alcanza, y con `fetchImpl` inyectable el modulo se testea sin red ni
 * mocks del SDK.
 *
 * Todas las consultas van anonimas. La proteccion de los borradores es la List
 * rule de la coleccion (`publicada = true || @request.auth.id != ""`); el
 * filtro por `publicada` que se manda aca es deliberadamente redundante, para
 * que aflojar la regla en PocketBase no publique borradores de golpe.
 */
import { ordenarNovedades } from '../novedades.js';

const COLECCION = 'novedades';

/** Los slugs que genera `slugify`: minusculas, numeros y guiones. */
const SLUG_VALIDO = /^[a-z0-9-]{1,120}$/;

const sinBarra = (baseUrl) => String(baseUrl ?? '').replace(/\/+$/, '');

/**
 * Las novedades publicadas, ya ordenadas para mostrar.
 * Ante cualquier falla devuelve `[]`: la seccion se muestra vacia, no rota.
 *
 * @returns {Promise<object[]>}
 */
export async function listarPublicadas(baseUrl, { fetchImpl = fetch } = {}) {
	const filtro = encodeURIComponent('(publicada=true)');
	const url = `${sinBarra(baseUrl)}/api/collections/${COLECCION}/records?perPage=200&filter=${filtro}`;

	try {
		const res = await fetchImpl(url, { signal: AbortSignal.timeout(10_000) });
		if (!res.ok) {
			console.error(`[novedades] PocketBase respondio ${res.status} al listar`);
			return [];
		}
		const body = await res.json();
		if (!Array.isArray(body.items)) {
			console.error('[novedades] respuesta inesperada al listar: "items" no es un array', body);
			return [];
		}
		if (typeof body.totalItems === 'number' && body.totalItems > body.items.length) {
			console.error(
				`[novedades] listado truncado: hay ${body.totalItems} novedades publicadas y solo se pidieron ${body.items.length}`
			);
		}
		return ordenarNovedades(body.items);
	} catch (error) {
		console.error('[novedades] error al listar novedades:', error);
		return [];
	}
}

/**
 * Una novedad publicada por su slug, o `null` si no existe, esta en borrador o
 * falla la consulta.
 *
 * El slug se valida contra `SLUG_VALIDO` antes de interpolarlo en el filtro:
 * viene de la URL, y sin validar cualquiera podria escribir filtros arbitrarios
 * de PocketBase desde la barra de direcciones (por ejemplo, pedir los
 * borradores).
 *
 * @returns {Promise<object|null>}
 */
export async function traerPorSlug(baseUrl, slug, { fetchImpl = fetch } = {}) {
	if (!SLUG_VALIDO.test(String(slug ?? ''))) return null;

	const filtro = encodeURIComponent(`(publicada=true && slug='${slug}')`);
	const url = `${sinBarra(baseUrl)}/api/collections/${COLECCION}/records?perPage=1&filter=${filtro}`;

	try {
		const res = await fetchImpl(url, { signal: AbortSignal.timeout(10_000) });
		if (!res.ok) {
			console.error(`[novedades] PocketBase respondio ${res.status} para "${slug}"`);
			return null;
		}
		const body = await res.json();
		if (!Array.isArray(body.items)) {
			console.error(
				`[novedades] respuesta inesperada de PocketBase para "${slug}": "items" no es un array`,
				body
			);
			return null;
		}
		return body.items[0] ?? null;
	} catch (error) {
		console.error('[novedades] error al traer la novedad:', error);
		return null;
	}
}

/**
 * URL de un archivo de PocketBase. Aca no hay SDK, que es quien normalmente
 * arma esta URL (`pb.files.getURL`), asi que se arma a mano.
 *
 * @param {string} baseUrl
 * @param {object} record Registro con `collectionId` e `id`
 * @param {string} nombreArchivo
 * @param {string} [thumb] Por ejemplo '600x400'
 * @returns {string|null}
 */
export function urlArchivo(baseUrl, record, nombreArchivo, thumb) {
	if (!record || !nombreArchivo) return null;

	const url = `${sinBarra(baseUrl)}/api/files/${record.collectionId}/${record.id}/${encodeURIComponent(nombreArchivo)}`;
	return thumb ? `${url}?thumb=${encodeURIComponent(thumb)}` : url;
}

/**
 * Pasa un registro crudo de PocketBase a la forma que consumen las paginas,
 * con las URLs de imagen ya resueltas. Asi los componentes no necesitan saber
 * ni la baseUrl ni como se arman los archivos.
 */
export function aNovedadPublica(baseUrl, record) {
	return {
		id: record.id,
		slug: record.slug,
		titulo: record.titulo ?? '',
		fecha: record.fecha ?? '',
		bajada: record.bajada ?? '',
		cuerpo: record.cuerpo ?? '',
		destacada: !!record.destacada,
		imagen: urlArchivo(baseUrl, record, record.imagen, '600x400'),
		imagenGrande: urlArchivo(baseUrl, record, record.imagen, '1200x0')
	};
}
