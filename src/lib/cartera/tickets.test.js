import { describe, it, expect } from 'vitest';
import { normalizarTickets, fechaLegible, TOPE_TICKETS } from './tickets.js';

const CATALOGOS = {
	areas: [{ id: 6, name: 'Soporte Tecnico' }],
	categorias: [
		{ id: 3, name: 'Sin servicio', color: '#ff0000', ticketarea_id: 6 },
		{ id: 4, name: 'Lentitud', color: '#00ff00', ticketarea_id: 6 }
	],
	estados: [
		{ id: 1, name: 'Abierto' },
		{ id: 5, name: 'Resuelto' }
	],
	prioridades: [{ id: 2, name: 'Alta' }]
};

/** Un ticket crudo de `/api/tickets`, con lo minimo para ser valido. */
function ticket(extra = {}) {
	return {
		id: 100,
		ticket_area_id: 6,
		ticket_category_id: 3,
		ticket_status_id: 1,
		ticket_priority_id: 2,
		created_at: '2026-07-01T10:00:00.000000Z',
		items: [],
		...extra
	};
}

const opciones = (extra = {}) => ({ catalogos: CATALOGOS, estadosCerrados: [5], ...extra });

describe('fechaLegible', () => {
	it('devuelve vacio cuando no hay forma de fecha', () => {
		expect(fechaLegible(null)).toBe('');
		expect(fechaLegible('sin fecha')).toBe('');
	});

	it('formatea el formato con espacio tal cual vino, sin correr el dia', () => {
		// El caso que rompe `new Date(str)`: sin zona, Safari lo rechaza y
		// Chrome lo toma como local. Aca las partes se leen por texto y el dia
		// que se muestra es el que dice el string.
		expect(fechaLegible('2026-07-01 10:05:00')).toBe('1/7/2026');
		expect(fechaLegible('2026-07-01 10:05:00', { conHora: true })).toBe('1/7/2026 10:05');
	});

	it('pasa a hora local el formato UTC de IspCube', () => {
		// 2026-07-01T01:00Z es el 30/06 a las 22 en Argentina (UTC-3): mostrar
		// "1/7" seria un dia de mas. La suite corre con TZ=America/Argentina.
		expect(fechaLegible('2026-07-01T01:00:00.000000Z', { conHora: true })).toBe('30/6/2026 22:00');
	});

	it('acepta una fecha sin hora', () => {
		expect(fechaLegible('2026-07-03')).toBe('3/7/2026');
	});
});

describe('normalizarTickets - entradas invalidas', () => {
	it('devuelve [] cuando la entrada no es un array', () => {
		expect(normalizarTickets(null, opciones())).toEqual([]);
		expect(normalizarTickets({ status: false }, opciones())).toEqual([]);
	});

	it('descarta los elementos nulos de la lista', () => {
		expect(normalizarTickets([null, undefined, ticket()], opciones())).toHaveLength(1);
	});

	it('descarta los tickets borrados', () => {
		const lista = [ticket({ id: 1 }), ticket({ id: 2, deleted_at: '2026-07-02 09:00:00' })];

		const r = normalizarTickets(lista, opciones());

		expect(r.map((t) => t.id)).toEqual([1]);
	});
});

describe('normalizarTickets - orden', () => {
	it('deja primero el mas nuevo', () => {
		const lista = [
			ticket({ id: 1, created_at: '2026-05-01T10:00:00.000000Z' }),
			ticket({ id: 2, created_at: '2026-07-01T10:00:00.000000Z' }),
			ticket({ id: 3, created_at: '2026-06-01T10:00:00.000000Z' })
		];

		const r = normalizarTickets(lista, opciones());

		expect(r.map((t) => t.id)).toEqual([2, 3, 1]);
	});

	it('ordena bien mezclando los dos formatos de fecha de IspCube', () => {
		// El de las 10 viene con espacio y el de las 9 con "T". Comparados como
		// strings el espacio ordena antes que la T y el mas viejo quedaria
		// primero; por eso se compara por partes, no con `>`.
		const lista = [
			ticket({ id: 1, created_at: '2026-07-01T09:00:00.000000Z' }),
			ticket({ id: 2, created_at: '2026-07-01 10:00:00' })
		];

		const r = normalizarTickets(lista, opciones());

		expect(r.map((t) => t.id)).toEqual([2, 1]);
	});

	it('manda al final los tickets sin fecha legible, sin descartarlos', () => {
		const lista = [
			ticket({ id: 1, created_at: null }),
			ticket({ id: 2, created_at: '2026-01-01T10:00:00.000000Z' })
		];

		const r = normalizarTickets(lista, opciones());

		expect(r.map((t) => t.id)).toEqual([2, 1]);
		expect(r[1].fecha).toBe('');
	});

	it('corta en los TOPE_TICKETS mas nuevos', () => {
		const lista = Array.from({ length: TOPE_TICKETS + 5 }, (_, i) =>
			ticket({ id: i, created_at: `2026-07-01T10:00:${String(i).padStart(2, '0')}.000000Z` })
		);

		const r = normalizarTickets(lista, opciones());

		expect(r).toHaveLength(TOPE_TICKETS);
		// El mas nuevo es el de segundo mas alto: el corte se hace despues de
		// ordenar, no sobre el orden en que vino la respuesta.
		expect(r[0].id).toBe(TOPE_TICKETS + 4);
	});
});

describe('normalizarTickets - catalogos', () => {
	it('traduce area, categoria, estado y prioridad a nombres', () => {
		const [t] = normalizarTickets([ticket()], opciones());

		expect(t.area).toEqual({ id: 6, nombre: 'Soporte Tecnico' });
		expect(t.categoria).toEqual({ id: 3, nombre: 'Sin servicio', color: '#ff0000' });
		expect(t.estado).toEqual({ id: 1, nombre: 'Abierto' });
		expect(t.prioridad).toEqual({ id: 2, nombre: 'Alta' });
	});

	it('sin catalogos conserva los ids y deja el nombre vacio', () => {
		const [t] = normalizarTickets([ticket()], opciones({ catalogos: null }));

		expect(t.categoria).toEqual({ id: 3, nombre: '', color: '' });
		expect(t.estado).toEqual({ id: 1, nombre: '' });
	});

	it('un id que no esta en el catalogo queda sin nombre', () => {
		const [t] = normalizarTickets([ticket({ ticket_category_id: 99 })], opciones());

		expect(t.categoria).toEqual({ id: 99, nombre: '', color: '' });
	});

	it('cruza los ids aunque el catalogo los traiga como string', () => {
		const catalogos = { ...CATALOGOS, estados: [{ id: '1', name: 'Abierto' }] };

		const [t] = normalizarTickets([ticket()], opciones({ catalogos }));

		expect(t.estado.nombre).toBe('Abierto');
	});

	it('descarta un color que no es un hexadecimal', () => {
		// El color se pinta con un `style:` inline; algo como `url(...)` seria
		// una peticion a un servidor ajeno disparada por un dato de la API.
		const catalogos = {
			...CATALOGOS,
			categorias: [{ id: 3, name: 'Sin servicio', color: 'url(http://malo/x.png)' }]
		};

		const [t] = normalizarTickets([ticket()], opciones({ catalogos }));

		expect(t.categoria.color).toBe('');
	});

	it('acepta el hexadecimal corto', () => {
		const catalogos = { ...CATALOGOS, categorias: [{ id: 3, name: 'X', color: ' #F00 ' }] };

		const [t] = normalizarTickets([ticket()], opciones({ catalogos }));

		expect(t.categoria.color).toBe('#F00');
	});

	it('deja el id en null cuando el ticket no lo trae', () => {
		const [t] = normalizarTickets([ticket({ ticket_priority_id: null })], opciones());

		expect(t.prioridad).toEqual({ id: null, nombre: '' });
	});
});

describe('normalizarTickets - cerrado', () => {
	it('marca cerrado el ticket cuyo estado esta en estadosCerrados', () => {
		const lista = [ticket({ id: 1, ticket_status_id: 5 }), ticket({ id: 2, ticket_status_id: 1 })];

		const r = normalizarTickets(lista, opciones());

		expect(r.find((t) => t.id === 1).cerrado).toBe(true);
		expect(r.find((t) => t.id === 2).cerrado).toBe(false);
	});

	it('con estadosCerrados vacio nada esta cerrado', () => {
		// Es el default antes de configurar `cartera_config`, igual que en
		// `resumenTickets`: sin la lista no se puede saber, y decir "abierto"
		// deja al asesor mirando el ticket en vez de ignorandolo.
		const r = normalizarTickets([ticket({ ticket_status_id: 5 })], opciones({ estadosCerrados: [] }));

		expect(r[0].cerrado).toBe(false);
	});

	it('compara los estados como texto', () => {
		const r = normalizarTickets(
			[ticket({ ticket_status_id: '5' })],
			opciones({ estadosCerrados: [5] })
		);

		expect(r[0].cerrado).toBe(true);
	});
});

describe('normalizarTickets - numero', () => {
	it('usa ticket_number cuando viene', () => {
		const [t] = normalizarTickets([ticket({ id: 100, ticket_number: 'T-4521' })], opciones());

		expect(t.numero).toBe('T-4521');
	});

	it('cae al id cuando no hay ticket_number', () => {
		const [t] = normalizarTickets([ticket({ id: 100 })], opciones());

		expect(t.numero).toBe('100');
	});
});

describe('normalizarTickets - hilo', () => {
	it('deja el hilo vacio cuando el ticket no trae items', () => {
		const [t] = normalizarTickets([ticket({ items: undefined })], opciones());

		expect(t.hilo).toEqual([]);
	});

	it('normaliza cada item del hilo', () => {
		const lista = [
			ticket({
				items: [
					{
						content: 'El cliente reporta sin servicio',
						internal: false,
						user: { name: 'Ana' },
						created_at: '2026-07-01 10:05:00'
					}
				]
			})
		];

		const [t] = normalizarTickets(lista, opciones());

		expect(t.hilo).toEqual([
			{
				fecha: '2026-07-01 10:05:00',
				autor: 'Ana',
				interno: false,
				texto: 'El cliente reporta sin servicio'
			}
		]);
	});

	it('ordena el hilo del mas viejo al mas nuevo', () => {
		const lista = [
			ticket({
				items: [
					{ content: 'segundo', created_at: '2026-07-01 11:00:00' },
					{ content: 'primero', created_at: '2026-07-01 10:00:00' }
				]
			})
		];

		const [t] = normalizarTickets(lista, opciones());

		expect(t.hilo.map((i) => i.texto)).toEqual(['primero', 'segundo']);
	});

	it('trata como interno cualquier item que no diga explicitamente que es visible', () => {
		// `internal` ausente es el caso comun en la respuesta de IspCube. Suponer
		// "visible al cliente" ahi mostraria como publica una nota interna.
		const lista = [ticket({ items: [{ content: 'nota', internal: undefined }] })];

		const [t] = normalizarTickets(lista, opciones());

		expect(t.hilo[0].interno).toBe(true);
	});

	it('descarta los items vacios o nulos', () => {
		const lista = [ticket({ items: [null, { content: '   ' }, { content: 'algo' }] })];

		const [t] = normalizarTickets(lista, opciones());

		expect(t.hilo.map((i) => i.texto)).toEqual(['algo']);
	});
});

describe('normalizarTickets - campos sueltos', () => {
	it('copia asignado y visita cuando vienen', () => {
		const lista = [
			ticket({ assigned_user: { name: 'Bruno' }, visit_date: '2026-07-03 15:00:00' })
		];

		const [t] = normalizarTickets(lista, opciones());

		expect(t.asignado).toBe('Bruno');
		expect(t.visita).toBe('2026-07-03 15:00:00');
	});

	it('deja asignado y visita vacios cuando no vienen', () => {
		const [t] = normalizarTickets([ticket()], opciones());

		expect(t.asignado).toBe('');
		expect(t.visita).toBe('');
	});
});
