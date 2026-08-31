/**
 * Rutas de uso interno: no cargan GTM, GA4, el Meta Pixel ni el JSON-LD.
 *
 * Es una lista de EXCLUSION a proposito, no una de permitidos. El layout tenia
 * antes un `allowedPrefixes` con 13 prefijos y todo lo que no estuviera ahi caia
 * en una pantalla de "Sitio en mantenimiento". Nunca se noto porque un bug de
 * runes lo mantuvo apagado (`$derived(() => ...)` guarda la funcion, que siempre
 * es truthy, en vez de su resultado); para cuando se encontro, el sitio habia
 * crecido a 68 paginas y solo 16 seguian en la lista. Arreglar la runa sin mas
 * habria tapado 52 paginas vivas, incluidas /solicitudbaja, /condiciones y
 * /normativa.
 *
 * Con una denylist el default se invierte y deja de ser peligroso: una pagina
 * nueva se ve y se mide sola, sin que nadie tenga que acordarse de anotarla.
 * Solo hay que tocar esta lista para SACAR algo, y olvidarse cuesta una pagina
 * interna medida de mas, no una publica rota.
 *
 * `/puntos` NO esta aca: no tiene nav ni footer, pero es una pantalla de cara al
 * publico y se mide.
 *
 * `/lineavip` e `/internacional` si estan: son los cuadros tarifarios crudos,
 * que se pasan por link a quien los pide y no tienen que aparecer en Google. La
 * denylist les da el `noindex, nofollow` y les saca la URL canonica.
 */
export const RUTAS_INTERNAS = [
	'/admin',
	'/internacional',
	'/lineavip',
	'/mail-banner',
	'/tolosano'
];

/**
 * Decide si la pagina tiene que cargar los scripts de medicion.
 *
 * Compara por segmento, no por texto: `/administracion` no es `/admin`. Sin ese
 * limite, cualquier ruta futura que arranque con el mismo texto quedaria sin
 * medir y nadie se enteraria.
 *
 * @param {string} pathname Path de la pagina (ej. `/admin/cartera`)
 * @returns {boolean} `true` si hay que cargar GTM/GA4/Pixel
 */
export function shouldTrack(pathname) {
	// Ante un path raro, asumir publica: es el caso mucho mas comun y el costo de
	// equivocarse es medir una interna, no romper una publica.
	if (typeof pathname !== 'string' || pathname === '') return true;

	return !RUTAS_INTERNAS.some(
		(interna) => pathname === interna || pathname.startsWith(`${interna}/`)
	);
}
