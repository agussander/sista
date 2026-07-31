import { describe, it, expect } from 'vitest';
import { renderMailTemplate, escapeHtml, labelFor } from './mailTemplate.js';

const TEMPLATE = '<h1>[title]</h1><ul>[data]</ul>';

describe('escapeHtml', () => {
	it('escapa como htmlspecialchars con ENT_QUOTES', () => {
		expect(escapeHtml('<b>&"\'')).toBe('&lt;b&gt;&amp;&quot;&#039;');
	});

	it('escapa el ampersand antes que el resto', () => {
		expect(escapeHtml('&lt;')).toBe('&amp;lt;');
	});

	it('convierte saltos de linea en <br />', () => {
		expect(escapeHtml('a\nb')).toBe('a<br />\nb');
	});
});

describe('labelFor', () => {
	it('reemplaza guiones y guiones bajos por espacios', () => {
		expect(labelFor('fecha_de_alta')).toBe('Fecha de alta');
		expect(labelFor('reply-to')).toBe('Reply to');
	});

	it('deja intacta una etiqueta ya capitalizada', () => {
		expect(labelFor('Nombre')).toBe('Nombre');
	});
});

describe('renderMailTemplate', () => {
	it('reemplaza [title] con el titulo', () => {
		const html = renderMailTemplate(TEMPLATE, { title: 'Contacto Web' });
		expect(html).toContain('<h1>Contacto Web</h1>');
	});

	it('arma un <li> por cada campo, sin incluir title', () => {
		const html = renderMailTemplate(TEMPLATE, {
			title: 'Contacto Web',
			Nombre: 'Ada',
			Contacto: '221-555'
		});

		expect(html).toContain("<li><span class='label'>Nombre:</span><div class='value'>Ada</div></li>");
		expect(html).toContain("<li><span class='label'>Contacto:</span><div class='value'>221-555</div></li>");
		expect(html).not.toContain("<span class='label'>Title:</span>");
	});

	it('omite los campos vacios', () => {
		const html = renderMailTemplate(TEMPLATE, { title: 'X', Nombre: 'Ada', Empresa: '' });
		expect(html).toContain('Ada');
		expect(html).not.toContain('Empresa');
	});

	it('omite null y undefined', () => {
		const html = renderMailTemplate(TEMPLATE, { title: 'X', A: null, B: undefined, C: 'ok' });
		expect(html).not.toContain("<span class='label'>A:</span>");
		expect(html).not.toContain("<span class='label'>B:</span>");
		expect(html).toContain('ok');
	});

	it('escapa el contenido para que no se inyecte html', () => {
		const html = renderMailTemplate(TEMPLATE, {
			title: 'X',
			Mensaje: '<script>alert(1)</script>'
		});

		expect(html).not.toContain('<script>alert(1)</script>');
		expect(html).toContain('&lt;script&gt;');
	});

	it('conserva los saltos de linea de un textarea', () => {
		const html = renderMailTemplate(TEMPLATE, { title: 'X', Mensaje: 'linea1\nlinea2' });
		expect(html).toContain('linea1<br />\nlinea2');
	});

	it('respeta el orden en que vienen los campos', () => {
		const html = renderMailTemplate(TEMPLATE, { title: 'X', Primero: '1', Segundo: '2' });
		expect(html.indexOf('Primero')).toBeLessThan(html.indexOf('Segundo'));
	});

	it('sirve un template sin placeholders sin romperse', () => {
		expect(renderMailTemplate('<p>hola</p>', { title: 'X', A: '1' })).toBe('<p>hola</p>');
	});

	it('cae a un html por defecto si no hay template', () => {
		const html = renderMailTemplate('', { title: 'Aviso', Nombre: 'Ada' });
		expect(html).toContain('<h2>Aviso</h2>');
		expect(html).toContain('<strong>Nombre:</strong> Ada');
	});

	it('sustituye placeholders directos propios del template, no solo [title]', () => {
		const html = renderMailTemplate('<p>[foo]</p>', { title: 'X', foo: 'hola' });
		expect(html).toContain('<p>hola</p>');
	});

	it('escapa los placeholders directos, incluido [title], para no inyectar html', () => {
		const html = renderMailTemplate(TEMPLATE, {
			title: 'Nueva postulación - <script>alert(1)</script>'
		});

		expect(html).not.toContain('<script>alert(1)</script>');
		expect(html).toContain('&lt;script&gt;');
	});
});
