/**
 * Saca el `<noscript>` de Google Tag Manager del HTML de una pagina.
 *
 * Ese bloque vive en `src/app.html`, o sea en el shell, fuera del arbol de
 * componentes: el layout no puede condicionarlo como hace con GTM, GA4 y el
 * Pixel. Sin esto, las rutas internas (`$lib/tracking.js`) igual dispararian el
 * iframe de GTM para visitantes sin JavaScript.
 *
 * Se resuelve en `hooks.server.js` con `transformPageChunk`, que corre tambien
 * en tiempo de prerender —que es cuando se genera el HTML de estas paginas—, no
 * solo al servir dinamico.
 *
 * Saca tambien los comentarios que envuelven al bloque, para no dejar un
 * `<!-- Google Tag Manager (noscript) -->` suelto apuntando a nada.
 *
 * @param {string} html HTML de la pagina
 * @returns {string} El mismo HTML sin el bloque de GTM
 */
export function sacarGtmNoscript(html) {
	if (typeof html !== 'string' || html === '') return '';

	return html.replace(
		/[ \t]*<!--\s*Google Tag Manager \(noscript\)\s*-->\s*<noscript>[\s\S]*?<\/noscript>\s*<!--\s*End Google Tag Manager \(noscript\)\s*-->\n?/gi,
		''
	);
}
