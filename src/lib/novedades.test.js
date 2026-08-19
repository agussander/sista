import { describe, it, expect } from 'vitest';
import {
	slugify,
	slugUnico,
	parseCuerpo,
	resumenDe,
	ordenarNovedades,
	formatFecha,
	fechaParaInput
} from './novedades.js';

describe('slugify', () => {
	it('pasa a minusculas y une con guiones', () => {
		expect(slugify('Nueva Tienda Sista')).toBe('nueva-tienda-sista');
	});

	it('saca tildes y signos', () => {
		expect(slugify('¡Promoción: 50% off!')).toBe('promocion-50-off');
	});

	it('no deja guiones en las puntas', () => {
		expect(slugify('  Hola  ')).toBe('hola');
	});

	it('devuelve vacio si no hay nada usable', () => {
		expect(slugify('¿¡!?')).toBe('');
		expect(slugify(null)).toBe('');
	});
});

describe('slugUnico', () => {
	it('devuelve el slug base si esta libre', () => {
		expect(slugUnico('Nueva Tienda', ['otra-cosa'])).toBe('nueva-tienda');
	});

	it('agrega -2 ante colision', () => {
		expect(slugUnico('Nueva Tienda', ['nueva-tienda'])).toBe('nueva-tienda-2');
	});

	it('sigue subiendo el numero si -2 tambien esta tomado', () => {
		expect(slugUnico('Nueva Tienda', ['nueva-tienda', 'nueva-tienda-2'])).toBe('nueva-tienda-3');
	});
});

describe('parseCuerpo', () => {
	it('convierte cada linea en un parrafo y descarta las vacias', () => {
		const out = parseCuerpo('Primero\n\nSegundo');
		expect(out).toHaveLength(2);
		expect(out[0]).toEqual([{ tipo: 'texto', valor: 'Primero' }]);
		expect(out[1]).toEqual([{ tipo: 'texto', valor: 'Segundo' }]);
	});

	it('detecta una URL sola como link', () => {
		expect(parseCuerpo('https://tiendasista.com')).toEqual([
			[{ tipo: 'link', valor: 'https://tiendasista.com' }]
		]);
	});

	it('parte el texto alrededor del link', () => {
		expect(parseCuerpo('Entra a https://a.com ya')).toEqual([
			[
				{ tipo: 'texto', valor: 'Entra a ' },
				{ tipo: 'link', valor: 'https://a.com' },
				{ tipo: 'texto', valor: ' ya' }
			]
		]);
	});

	it('deja afuera del link el punto que cierra la oracion', () => {
		expect(parseCuerpo('Entra a https://a.com.')).toEqual([
			[
				{ tipo: 'texto', valor: 'Entra a ' },
				{ tipo: 'link', valor: 'https://a.com' },
				{ tipo: 'texto', valor: '.' }
			]
		]);
	});

	it('no rompe una url con parentesis balanceados', () => {
		expect(
			parseCuerpo('Ver https://es.wikipedia.org/wiki/PHP_(lenguaje) para mas info')
		).toEqual([
			[
				{ tipo: 'texto', valor: 'Ver ' },
				{ tipo: 'link', valor: 'https://es.wikipedia.org/wiki/PHP_(lenguaje)' },
				{ tipo: 'texto', valor: ' para mas info' }
			]
		]);
	});

	it('deja afuera del link un parentesis que es puntuacion de la oracion', () => {
		expect(parseCuerpo('(mira https://a.com)')).toEqual([
			[
				{ tipo: 'texto', valor: '(mira ' },
				{ tipo: 'link', valor: 'https://a.com' },
				{ tipo: 'texto', valor: ')' }
			]
		]);
	});

	it('devuelve lista vacia si no hay texto', () => {
		expect(parseCuerpo('')).toEqual([]);
		expect(parseCuerpo(null)).toEqual([]);
	});
});

describe('resumenDe', () => {
	it('usa la bajada si existe', () => {
		expect(resumenDe({ bajada: 'Corta', cuerpo: 'Larguisimo' })).toBe('Corta');
	});

	it('cae al cuerpo si no hay bajada', () => {
		expect(resumenDe({ bajada: '   ', cuerpo: 'Del cuerpo' })).toBe('Del cuerpo');
	});

	it('corta en el ultimo espacio y agrega puntos suspensivos', () => {
		expect(resumenDe({ cuerpo: 'uno dos tres cuatro' }, 12)).toBe('uno dos…');
	});

	it('si la ventana no tiene ningun espacio, hace un corte duro en la palabra', () => {
		expect(resumenDe({ cuerpo: 'unapalabrasuperlarguisima' }, 10)).toBe('unapalabra…');
	});

	it('no corta si entra entero', () => {
		expect(resumenDe({ cuerpo: 'corto' }, 40)).toBe('corto');
	});

	it('tolera una novedad sin campos', () => {
		expect(resumenDe(null)).toBe('');
	});
});

describe('ordenarNovedades', () => {
	it('pone las destacadas primero', () => {
		const out = ordenarNovedades([
			{ id: 'a', fecha: '2026-08-10', destacada: false },
			{ id: 'b', fecha: '2026-01-01', destacada: true }
		]);
		expect(out.map((n) => n.id)).toEqual(['b', 'a']);
	});

	it('dentro del mismo grupo ordena por fecha descendente', () => {
		const out = ordenarNovedades([
			{ id: 'vieja', fecha: '2026-01-01', destacada: false },
			{ id: 'nueva', fecha: '2026-08-10', destacada: false }
		]);
		expect(out.map((n) => n.id)).toEqual(['nueva', 'vieja']);
	});

	it('no muta la lista original', () => {
		const base = [{ id: 'a', fecha: '2026-01-01' }, { id: 'b', fecha: '2026-08-10' }];
		ordenarNovedades(base);
		expect(base.map((n) => n.id)).toEqual(['a', 'b']);
	});

	it('no rompe con fechas ausentes o invalidas, y deja las validas primero', () => {
		let out;
		expect(() => {
			out = ordenarNovedades([
				{ id: 'sinFecha', fecha: undefined, destacada: false },
				{ id: 'nueva', fecha: '2026-08-10', destacada: false },
				{ id: 'nula', fecha: null, destacada: false },
				{ id: 'vieja', fecha: '2026-01-01', destacada: false }
			]);
		}).not.toThrow();
		expect(out[0].id).toBe('nueva');
	});
});

describe('formatFecha', () => {
	// Vitest corre en America/Argentina/Buenos_Aires (UTC-3). Sin fijar la zona
	// al formatear, una fecha guardada a las 00:00Z se mostraria un dia antes.
	it('no se corre un dia por la zona horaria', () => {
		expect(formatFecha('2026-08-19 00:00:00.000Z')).toBe('19 de agosto de 2026');
	});

	it('devuelve vacio si la fecha no sirve', () => {
		expect(formatFecha('')).toBe('');
		expect(formatFecha('cualquier cosa')).toBe('');
	});
});

describe('fechaParaInput', () => {
	it('devuelve el formato que espera un input date', () => {
		expect(fechaParaInput('2026-08-19 00:00:00.000Z')).toBe('2026-08-19');
	});

	it('devuelve vacio si no hay fecha', () => {
		expect(fechaParaInput(null)).toBe('');
	});
});
