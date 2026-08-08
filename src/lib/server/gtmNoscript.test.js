import { describe, it, expect } from 'vitest';
import { sacarGtmNoscript } from './gtmNoscript.js';

// El markup real de src/app.html, con el salto de linea del medio.
const NOSCRIPT_GTM = `		<!-- Google Tag Manager (noscript) -->
		<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-W3WFBRF7"
		height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
		<!-- End Google Tag Manager (noscript) -->`;

describe('sacarGtmNoscript', () => {
	it('saca el iframe de GTM aunque abarque varias lineas', () => {
		const html = `<body>\n${NOSCRIPT_GTM}\n<h1>Hola</h1></body>`;

		const resultado = sacarGtmNoscript(html);

		expect(resultado).not.toContain('googletagmanager.com/ns.html');
		expect(resultado).not.toContain('<noscript>');
	});

	it('no toca el resto del documento', () => {
		const html = `<body>\n${NOSCRIPT_GTM}\n<h1>Hola</h1></body>`;

		expect(sacarGtmNoscript(html)).toContain('<h1>Hola</h1>');
	});

	it('deja intacto un noscript que no sea de GTM', () => {
		const pixel =
			'<noscript><img height="1" width="1" src="https://www.facebook.com/tr?id=1"/></noscript>';

		expect(sacarGtmNoscript(pixel)).toBe(pixel);
	});

	it('devuelve el html igual si no hay nada que sacar', () => {
		expect(sacarGtmNoscript('<body><h1>Hola</h1></body>')).toBe('<body><h1>Hola</h1></body>');
	});

	it('es idempotente', () => {
		const html = `<body>\n${NOSCRIPT_GTM}\n</body>`;

		expect(sacarGtmNoscript(sacarGtmNoscript(html))).toBe(sacarGtmNoscript(html));
	});

	it('tolera un html vacio o que no sea string', () => {
		expect(sacarGtmNoscript('')).toBe('');
		expect(sacarGtmNoscript(null)).toBe('');
		expect(sacarGtmNoscript(undefined)).toBe('');
	});
});
