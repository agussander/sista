/** Valor del header `X-Robots-Tag` cuando hay que impedir la indexacion. */
export const NOINDEX_VALUE = 'noindex, nofollow';

/**
 * Decide si la respuesta debe llevar `X-Robots-Tag: noindex`.
 *
 * El default es bloquear: si `SITE_ENV` no esta configurada, es mas seguro no
 * indexar que indexar un entorno de pruebas por accidente. La contracara es que
 * el dia del cutover hay que setear `SITE_ENV=production` si o si.
 *
 * @param {string | undefined} siteEnv Valor de la env var `SITE_ENV`
 * @returns {boolean}
 */
export function shouldBlockIndexing(siteEnv) {
	return siteEnv !== 'production';
}
