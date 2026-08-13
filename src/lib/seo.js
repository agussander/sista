/**
 * Origen canonico del sitio.
 *
 * Es el apex, SIN `www`: `sista.ar` y `www.sista.ar` resuelven las dos al mismo
 * contenido, asi que hay que elegir una y declararla, o Google las trata como
 * dos sitios duplicados. Vive aca, en un solo lugar, porque antes el dominio
 * estaba hardcodeado en el JSON-LD del layout, en `static/robots.txt` y en las
 * 7 URLs de `static/sitemap.xml` — y al mudarse a `sista.ar` quedaron todas
 * apuntando al dominio viejo.
 *
 * Los dos archivos de `static/` no pueden importar de aca (son estaticos, se
 * copian tal cual al build), asi que si esto cambia hay que actualizarlos a
 * mano. Es la unica duplicacion que queda y esta anotada en los dos archivos.
 */
export const SITE_ORIGIN = 'https://sista.ar';

/**
 * Arma la URL canonica absoluta de una pagina a partir de su path.
 *
 * Normaliza a la forma que el sitio realmente sirve: barra final siempre,
 * porque `src/routes/+layout.js` declara `trailingSlash: 'always'` y si el
 * canonical no matchea la URL servida Google lo ignora.
 *
 * Descarta query y hash a proposito: un canonical con `?utm_source=...` le
 * estaria diciendo a Google que cada campaña es una pagina distinta.
 *
 * @param {string} pathname Path de la pagina (ej. `/formasdepago`)
 * @returns {string} URL absoluta con barra final (ej. `https://sista.ar/formasdepago/`)
 */
export function canonicalUrl(pathname) {
	const path = typeof pathname === 'string' ? pathname : '';

	// El canonical describe la pagina, no como se llego a ella.
	const sinQuery = path.split(/[?#]/)[0];

	// Colapsa barras repetidas y recorta las de los extremos para poder volver a
	// armar el path con una sola forma posible.
	const segmentos = sinQuery.split('/').filter(Boolean);

	return segmentos.length === 0 ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}/${segmentos.join('/')}/`;
}
