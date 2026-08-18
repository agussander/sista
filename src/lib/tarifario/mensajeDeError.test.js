import { describe, expect, it } from 'vitest';
import { mensajeDeError } from './fetchTarifario.js';

describe('mensajeDeError', () => {
	it('distingue "no hay tarifario publicado" del resto', () => {
		expect(mensajeDeError({ status: 404 })).toMatch(/no hay un tarifario publicado/i);
	});

	// PocketBase contesta "Only superusers can perform this action" cuando las
	// reglas de la coleccion estan cerradas. Eso no lo puede leer un visitante.
	it('no filtra el mensaje interno de PocketBase', () => {
		const crudo = { status: 403, message: 'Only superusers can perform this action.' };
		const mensaje = mensajeDeError(crudo);

		expect(mensaje).not.toMatch(/superuser/i);
		expect(mensaje).toMatch(/no pudimos cargar/i);
	});

	it('aguanta cualquier cosa que le tiren', () => {
		expect(mensajeDeError(null)).toMatch(/no pudimos cargar/i);
		expect(mensajeDeError(new Error('boom'))).toMatch(/no pudimos cargar/i);
		expect(mensajeDeError(undefined)).toMatch(/no pudimos cargar/i);
	});
});
