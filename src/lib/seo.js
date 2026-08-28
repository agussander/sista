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

/**
 * Imagen `og:image` de marca por defecto (2500×1307, ratio 1.91:1, el que piden
 * Facebook/Instagram/WhatsApp). Vive en `static/images/`.
 */
export const OG_IMAGE_DEFAULT = `${SITE_ORIGIN}/images/Og-sista.png`;

/**
 * Rutas que ya declaran su propia `og:image` en el `<MetaTags>` de la pagina.
 *
 * El layout raiz agrega una `og:image` de marca por defecto (`OG_IMAGE_DEFAULT`)
 * para que CUALQUIER pagina compartida por WhatsApp/Instagram/Facebook muestre
 * una tarjeta decente — antes, una pagina sin `<MetaTags>` (ej. `/trabajos`, que
 * es solo un redirect) no tenia ninguna, y el crawler agarraba el logo del nav y
 * lo recortaba mal.
 *
 * Pero si la pagina ya trae su propia imagen, las dos etiquetas conviven en el
 * `<head>` y los crawlers usan la PRIMERA que ven — que seria la generica del
 * layout —, asi que en esas rutas el fallback NO se emite.
 *
 * Compara con `startsWith`: `/tv/` cubre `/tv/`, `/tv/elegirtv/` y
 * `/tv/masinformacion/`. Cada nota de novedades (`/novedades/<slug>/`) trae la
 * imagen de la nota; la portada `/novedades/` no, y si lleva el fallback.
 */
const RUTAS_CON_OG_PROPIA = ['/dgo/', '/antinaplay/', '/gigaredplay/', '/tv/', '/elegirplan/'];

/**
 * ¿La ruta ya define su propia `og:image` y por lo tanto NO lleva el fallback
 * de marca del layout?
 *
 * @param {string} pathname Path de la pagina (ej. `/tv/elegirtv/`)
 * @returns {boolean}
 */
export function tieneOgPropia(pathname) {
	const path = typeof pathname === 'string' ? pathname : '';

	// Una nota puntual de novedades (no la portada) comparte con su propia imagen.
	if (path.startsWith('/novedades/') && path !== '/novedades/') return true;

	return RUTAS_CON_OG_PROPIA.some((prefijo) => path.startsWith(prefijo));
}
