import { describe, it, expect } from 'vitest';
import { describirConexion } from './planes.js';

describe('describirConexion — internet', () => {
	it('plan HOME con numero de f de dos digitos', () => {
		expect(describirConexion('Servicio de internet basico HOME f50')).toEqual({
			etiqueta: 'Home',
			categoria: 'internet'
		});
	});

	it('nombre real de produccion: Internet con mayuscula y f de tres digitos', () => {
		expect(describirConexion('Servicio de Internet basico POWER F131')).toEqual({
			etiqueta: 'Power',
			categoria: 'internet'
		});
	});

	it.each(['FAST', 'GAMER', 'WORKER', 'MAX'])('plan %s reconocido', (plan) => {
		expect(describirConexion(`Servicio de internet basico ${plan} f20`)).toEqual({
			etiqueta: plan[0] + plan.slice(1).toLowerCase(),
			categoria: 'internet'
		});
	});
});

describe('describirConexion — tv', () => {
	it('Gigared, con "cuenta y orden" y sin espacio entre servicio y tv', () => {
		expect(
			describirConexion(
				'Serviciotv basico Gigared (por cuenta y orden cuit 30-00000000-0 TELCOM VENTURES DE ARGENTINA S.A.)'
			)
		).toEqual({ etiqueta: 'Gigared', categoria: 'tv' });
	});

	it('OTT se muestra como Antina', () => {
		expect(
			describirConexion(
				'Servicio tv basico OTT ( Por cuenta y orden cuit 30-69642889-8 TELCOM VENTURES DE ARGENTINA S.A.)'
			)
		).toEqual({ etiqueta: 'Antina', categoria: 'tv' });
	});

	// Nombres reales del catalogo de IspCube (`GET /api/plans/plans_list`):
	// a diferencia de Gigared/OTT, los planes DGO no dicen "servicio tv
	// basico" — arrancan directo con "DGO ".
	it.each(['DGO Lite', 'DGO Plus', 'DGO Total', 'DGO Full', 'DGO Futbol Total', 'DGO Futbol', 'DGO Paramount', 'DGO Universal'])(
		'%s se muestra como DGO',
		(nombre) => {
			expect(describirConexion(nombre)).toEqual({ etiqueta: 'DGO', categoria: 'tv' });
		}
	);

	// Combo real de Antina que no dice "servicio tv basico" ni "OTT": no hay
	// regla pedida para el, asi que se muestra tal cual (categoria 'otro') en
	// vez de adivinar a que nombre corto corresponde.
	it('un plan de tv sin regla conocida no se adivina, se muestra tal cual', () => {
		const nombre =
			'Básico + Cine (86 señales + HBO + Universal Por cuenta y orden cuit 30-69642889-8 TELCOM VENTURES DE ARGENTINA S.A.)';
		expect(describirConexion(nombre)).toEqual({ etiqueta: nombre, categoria: 'otro' });
	});

	it('adicional con pack futbol, sin acento en el texto crudo', () => {
		expect(describirConexion('Adicional TV Pack Futbol')).toEqual({
			etiqueta: 'Pack fútbol',
			categoria: 'tv'
		});
	});

	it('pack futbol con acento en el texto crudo', () => {
		expect(describirConexion('Adicional TV Pack Fútbol')).toEqual({
			etiqueta: 'Pack fútbol',
			categoria: 'tv'
		});
	});
});

describe('describirConexion — otros', () => {
	it('telefonia', () => {
		expect(describirConexion('Servicio de telefonia basica')).toEqual({
			etiqueta: 'Telefonía',
			categoria: 'telefonia'
		});
	});

	it('nombre no reconocido devuelve el original con categoria otro', () => {
		expect(describirConexion('Algun servicio nuevo sin mapear')).toEqual({
			etiqueta: 'Algun servicio nuevo sin mapear',
			categoria: 'otro'
		});
	});

	it('nombreCompleto vacio o null no revienta', () => {
		expect(describirConexion('')).toEqual({ etiqueta: '', categoria: 'otro' });
		expect(describirConexion(null)).toEqual({ etiqueta: '', categoria: 'otro' });
	});
});
