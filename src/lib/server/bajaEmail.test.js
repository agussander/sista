import { describe, it, expect } from 'vitest';
import { renderBajaEmail } from './bajaEmail.js';

const DATOS = {
	nro_cliente: '1234',
	dni_cliente: '30111222',
	mensaje_ticket: '<strong>Cliente:</strong> Ada'
};

describe('renderBajaEmail', () => {
	it('incluye el numero de cliente y el dni', () => {
		const html = renderBajaEmail(DATOS);
		expect(html).toContain('1234');
		expect(html).toContain('30111222');
	});

	it('incrusta el mensaje del ticket como html', () => {
		const html = renderBajaEmail(DATOS);
		expect(html).toContain('<strong>Cliente:</strong> Ada');
	});

	it('muestra el bloque de tramite cuando hay numero', () => {
		const html = renderBajaEmail({ ...DATOS, numero_tramite: 'T-99' });
		expect(html).toContain('T-99');
		expect(html).toContain('Número de Trámite Generado');
	});

	it('omite el bloque de tramite cuando no hay numero', () => {
		const html = renderBajaEmail(DATOS);
		expect(html).not.toContain('Número de Trámite Generado');
	});

	it('trata null como ausencia de tramite', () => {
		const html = renderBajaEmail({ ...DATOS, numero_tramite: null });
		expect(html).not.toContain('Número de Trámite Generado');
	});

	it('trata el string vacio como ausencia de tramite', () => {
		const html = renderBajaEmail({ ...DATOS, numero_tramite: '' });
		expect(html).not.toContain('Número de Trámite Generado');
	});
});
