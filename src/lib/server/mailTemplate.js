/**
 * Render del cuerpo HTML de los mails. Puerto de `MailHandler::buildHtmlBody`
 * de `static/assets/includes/MailHandler.php`.
 *
 * El template (`static/assets/correo_template.html`) tiene dos placeholders:
 * `[title]` y `[data]`. `[data]` se expande a un `<li>` por campo. Se replica el
 * markup exacto que produce el PHP (comillas simples incluidas) para que los
 * mails que llegan no cambien de aspecto durante la migracion.
 */

/**
 * Equivalente a `htmlspecialchars($v, ENT_QUOTES)` + `nl2br()` de PHP.
 *
 * @param {string} value
 * @returns {string}
 */
export function escapeHtml(value) {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#039;')
		.replace(/\r\n|\n\r|\n|\r/g, '<br />\n');
}

/**
 * Equivalente a `ucfirst(str_replace(['_','-'], ' ', $key))`.
 *
 * En la practica las claves ya vienen capitalizadas desde la config de cada
 * formulario ('Nombre', 'Contacto'), asi que casi siempre es identidad. Se
 * replica igual para no cambiar el mail de ningun formulario existente.
 *
 * @param {string} key
 * @returns {string}
 */
export function labelFor(key) {
	const spaced = key.replaceAll('_', ' ').replaceAll('-', ' ');
	return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * @param {Record<string, unknown>} data Campos del mail. `title` es especial.
 * @returns {string}
 */
function buildDefaultBody(data) {
	const { title, ...rest } = data;
	let html = `<h2>${title ?? ''}</h2>`;
	for (const [key, value] of Object.entries(rest)) {
		if (value === null || value === undefined || value === '') continue;
		html += `<p><strong>${labelFor(key)}:</strong> ${value}</p>`;
	}
	return html;
}

/**
 * @param {string} templateHtml Contenido de `correo_template.html`. Vacio = default.
 * @param {Record<string, unknown>} data `title` mas un par label/valor por campo
 * @returns {string}
 */
export function renderMailTemplate(templateHtml, data) {
	if (!templateHtml) return buildDefaultBody(data);

	let body = templateHtml;

	if (body.includes('[data]')) {
		let list = '';
		for (const [key, value] of Object.entries(data)) {
			if (key === 'title') continue;
			if (value === null || value === undefined || value === '') continue;
			list += `<li><span class='label'>${labelFor(key)}:</span><div class='value'>${escapeHtml(
				String(value)
			)}</div></li>\n`;
		}
		body = body.replaceAll('[data]', list);
	}

	// Estos placeholders directos incluyen [title], y title puede traer texto
	// escrito por un visitante (p.ej. el asunto de una postulacion incluye el
	// apellido que carga la persona en el formulario). Por eso se escapan igual
	// que los valores de [data], a diferencia del PHP original, que los
	// insertaba crudos y quedaba abierto a inyeccion de HTML en el mail.
	for (const [key, value] of Object.entries(data)) {
		body = body.replaceAll(
			`[${key}]`,
			value === null || value === undefined ? '' : escapeHtml(String(value))
		);
	}

	return body;
}
