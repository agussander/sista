import { describe, it, expect } from 'vitest';
import { fechaDeAlerta, pesoPagos, ordenar, direccionInicial } from './orden.js';

/** Fila minima; se le pisan solo los campos que cada test necesita. */
const fila = (over = {}) => ({
	cliente: { code: '000001', nombre: 'Cliente', connections: [] },
	alertas: [],
	urgencia: null,
	edad: null,
	ciudad: '',
	puntos: [],
	ultimoContacto: '',
	alta: '2026-01-01',
	...over
});

const codes = (filas) => filas.map((f) => f.cliente.code);

describe('fechaDeAlerta', () => {
	it('sin alertas no hay fecha', () => {
		expect(fechaDeAlerta([])).toBe('');
	});

	it('completa el mes de la mora al dia 1', () => {
		expect(fechaDeAlerta([{ tipo: 'mora_1', desde: '2026-08' }])).toBe('2026-08-01');
	});

	it('recorta la fecha-hora de un ticket', () => {
		expect(fechaDeAlerta([{ tipo: 'tickets', desde: '2026-08-04 14:30:00' }])).toBe('2026-08-04');
	});

	it('se queda con la mas vieja de todas', () => {
		const alertas = [
			{ tipo: 'tickets', desde: '2026-08-04 14:30:00' },
			{ tipo: 'recordatorio', desde: '2026-07-19' },
			{ tipo: 'mora_1', desde: '2026-08' }
		];
		expect(fechaDeAlerta(alertas)).toBe('2026-07-19');
	});

	it('las alertas sin fecha (NAP) no aportan nada', () => {
		expect(fechaDeAlerta([{ tipo: 'nap_faltante', desde: null }])).toBe('');
		expect(
			fechaDeAlerta([
				{ tipo: 'nap_faltante', desde: null },
				{ tipo: 'mora_1', desde: '2026-08' }
			])
		).toBe('2026-08-01');
	});

	it('un `desde` con basura no se cuela como fecha', () => {
		expect(fechaDeAlerta([{ tipo: 'x', desde: 'ayer' }])).toBe('');
		expect(fechaDeAlerta([{ tipo: 'x', desde: '2026' }])).toBe('');
		expect(fechaDeAlerta([{ tipo: 'x', desde: 20260804 }])).toBe('');
		expect(fechaDeAlerta([{ tipo: 'x', desde: undefined }])).toBe('');
	});

	it('el mes completado al dia 1 gana contra cualquier dia de ese mismo mes', () => {
		// "2026-08" (mora, desde principio de mes) tiene que salir ANTES que un
		// ticket del 4 de agosto, no despues.
		expect(
			fechaDeAlerta([
				{ tipo: 'tickets', desde: '2026-08-04 09:00:00' },
				{ tipo: 'mora_1', desde: '2026-08' }
			])
		).toBe('2026-08-01');
	});

	it('sin argumento no explota', () => {
		expect(fechaDeAlerta(undefined)).toBe('');
	});
});

describe('pesoPagos', () => {
	it('el rojo pesa mas que el amarillo', () => {
		expect(pesoPagos([{ estado: 'rojo' }])).toBe(3);
		expect(pesoPagos([{ estado: 'amarillo' }])).toBe(1);
	});

	it('verde y pendiente no suman', () => {
		expect(pesoPagos([{ estado: 'verde' }, { estado: 'pendiente' }])).toBe(0);
	});

	it('suma todos los puntos', () => {
		expect(pesoPagos([{ estado: 'rojo' }, { estado: 'rojo' }, { estado: 'amarillo' }])).toBe(7);
	});

	it('un estado desconocido o ausente no suma ni rompe', () => {
		expect(pesoPagos([{ estado: 'violeta' }, {}, null])).toBe(0);
		expect(pesoPagos([])).toBe(0);
		expect(pesoPagos(undefined)).toBe(0);
	});
});

describe('ordenar — orden por defecto', () => {
	it('los clientes con alerta van antes que los que no tienen', () => {
		const filas = [
			fila({ cliente: { code: 'sin', nombre: 'A', connections: [] }, alta: '2026-08-01' }),
			fila({
				cliente: { code: 'con', nombre: 'B', connections: [] },
				alertas: [{ tipo: 'nap_faltante', desde: null }],
				urgencia: 'media',
				alta: '2026-01-01'
			})
		];
		expect(codes(ordenar(filas, 'alertas', 'desc'))).toEqual(['con', 'sin']);
	});

	it('entre alertas, la roja va antes que la amarilla y esa antes que la violeta', () => {
		const conUrgencia = (code, urgencia) =>
			fila({
				cliente: { code, nombre: code, connections: [] },
				alertas: [{ tipo: 'mora_1', desde: '2026-08' }],
				urgencia
			});
		const filas = [conUrgencia('baja', 'baja'), conUrgencia('alta', 'alta'), conUrgencia('media', 'media')];
		expect(codes(ordenar(filas, 'alertas', 'desc'))).toEqual(['alta', 'media', 'baja']);
	});

	it('a igual urgencia, gana la alerta mas vieja', () => {
		const conFecha = (code, desde) =>
			fila({
				cliente: { code, nombre: code, connections: [] },
				alertas: [{ tipo: 'recordatorio', desde }],
				urgencia: 'media'
			});
		const filas = [conFecha('nueva', '2026-08-05'), conFecha('vieja', '2026-06-01')];
		expect(codes(ordenar(filas, 'alertas', 'desc'))).toEqual(['vieja', 'nueva']);
	});

	it('una alerta sin fecha ordena ultima dentro de su urgencia', () => {
		const filas = [
			fila({
				cliente: { code: 'sinFecha', nombre: 'a', connections: [] },
				alertas: [{ tipo: 'nap_faltante', desde: null }],
				urgencia: 'media'
			}),
			fila({
				cliente: { code: 'conFecha', nombre: 'b', connections: [] },
				alertas: [{ tipo: 'mora_1', desde: '2026-08' }],
				urgencia: 'media'
			})
		];
		expect(codes(ordenar(filas, 'alertas', 'desc'))).toEqual(['conFecha', 'sinFecha']);
	});

	it('a igual fecha de alerta, arriba el alta mas nueva', () => {
		const conAlta = (code, alta) =>
			fila({
				cliente: { code, nombre: code, connections: [] },
				alertas: [{ tipo: 'mora_1', desde: '2026-08' }],
				urgencia: 'media',
				alta
			});
		const filas = [conAlta('vieja', '2025-01-01'), conAlta('nueva', '2026-08-01')];
		expect(codes(ordenar(filas, 'alertas', 'desc'))).toEqual(['nueva', 'vieja']);
	});

	it('los que no tienen alerta se ordenan solo por alta descendente', () => {
		const conAlta = (code, alta) => fila({ cliente: { code, nombre: code, connections: [] }, alta });
		const filas = [conAlta('a', '2024-05-01'), conAlta('c', '2026-08-01'), conAlta('b', '2025-05-01')];
		expect(codes(ordenar(filas, 'alertas', 'desc'))).toEqual(['c', 'b', 'a']);
	});

	it('no muta el array que recibe', () => {
		const filas = [
			fila({ cliente: { code: 'z', nombre: 'z', connections: [] }, alta: '2020-01-01' }),
			fila({ cliente: { code: 'a', nombre: 'a', connections: [] }, alta: '2026-01-01' })
		];
		ordenar(filas, 'alertas', 'desc');
		expect(codes(filas)).toEqual(['z', 'a']);
	});
});

describe('ordenar — por columna', () => {
	it('por alta invierte con la direccion, sin subir las alertas', () => {
		const filas = [
			fila({ cliente: { code: 'viejo', nombre: 'a', connections: [] }, alta: '2020-01-01' }),
			fila({
				cliente: { code: 'nuevoConAlerta', nombre: 'b', connections: [] },
				alertas: [{ tipo: 'mora_2', desde: '2026-08' }],
				urgencia: 'alta',
				alta: '2026-08-01'
			})
		];
		expect(codes(ordenar(filas, 'alta', 'desc'))).toEqual(['nuevoConAlerta', 'viejo']);
		expect(codes(ordenar(filas, 'alta', 'asc'))).toEqual(['viejo', 'nuevoConAlerta']);
	});

	it('por nombre usa el orden alfabetico del castellano', () => {
		const conNombre = (code, nombre) => fila({ cliente: { code, nombre, connections: [] } });
		const filas = [conNombre('3', 'Zaracho'), conNombre('1', 'Álvarez'), conNombre('2', 'Benitez')];
		expect(codes(ordenar(filas, 'nombre', 'asc'))).toEqual(['1', '2', '3']);
	});

	it('por edad, los sin estimacion quedan al final en las dos direcciones', () => {
		const conEdad = (code, edad) => fila({ cliente: { code, nombre: code, connections: [] }, edad });
		const filas = [conEdad('sin', null), conEdad('joven', 25), conEdad('mayor', 70)];
		expect(codes(ordenar(filas, 'edad', 'desc'))).toEqual(['mayor', 'joven', 'sin']);
		expect(codes(ordenar(filas, 'edad', 'asc'))).toEqual(['joven', 'mayor', 'sin']);
	});

	it('por ciudad, las vacias quedan al final', () => {
		const conCiudad = (code, ciudad) => fila({ cliente: { code, nombre: code, connections: [] }, ciudad });
		const filas = [conCiudad('sin', ''), conCiudad('p', 'Punta Lara'), conCiudad('e', 'Ensenada')];
		expect(codes(ordenar(filas, 'ciudad', 'asc'))).toEqual(['e', 'p', 'sin']);
	});

	it('por conexiones cuenta cuantas tiene', () => {
		const conConexiones = (code, n) =>
			fila({ cliente: { code, nombre: code, connections: Array.from({ length: n }, () => ({})) } });
		const filas = [conConexiones('una', 1), conConexiones('tres', 3), conConexiones('dos', 2)];
		expect(codes(ordenar(filas, 'conexiones', 'desc'))).toEqual(['tres', 'dos', 'una']);
	});

	it('por conexiones, a igual cantidad desempata por el plan mas alto', () => {
		const conPlan = (code, planNombre) =>
			fila({
				cliente: {
					code,
					nombre: code,
					connections: [{ plan_nombre: `Servicio de internet basico ${planNombre} f20` }]
				}
			});
		const filas = [conPlan('home', 'HOME'), conPlan('max', 'MAX'), conPlan('gamer', 'GAMER')];
		expect(codes(ordenar(filas, 'conexiones', 'desc'))).toEqual(['max', 'gamer', 'home']);
		expect(codes(ordenar(filas, 'conexiones', 'asc'))).toEqual(['home', 'gamer', 'max']);
	});

	it('por conexiones, la cantidad manda antes que el plan', () => {
		const conCantidadYPlan = (code, n, planNombre) =>
			fila({
				cliente: {
					code,
					nombre: code,
					connections: Array.from({ length: n }, () => ({
						plan_nombre: `Servicio de internet basico ${planNombre} f20`
					}))
				}
			});
		const filas = [conCantidadYPlan('unaMax', 1, 'MAX'), conCantidadYPlan('dosHome', 2, 'HOME')];
		expect(codes(ordenar(filas, 'conexiones', 'desc'))).toEqual(['dosHome', 'unaMax']);
	});

	it('por conexiones, sin plan de internet residencial queda al fondo del desempate', () => {
		const conConexion = (code, connections) => fila({ cliente: { code, nombre: code, connections } });
		const filas = [
			conConexion('sprint', [{ plan_nombre: 'SPRINT BANDA 94' }]),
			conConexion('home', [{ plan_nombre: 'Servicio de internet basico HOME f20' }])
		];
		expect(codes(ordenar(filas, 'conexiones', 'desc'))).toEqual(['home', 'sprint']);
	});

	it('por contacto, "nunca" cuenta como el mas viejo y no queda al final', () => {
		const conContacto = (code, ultimoContacto) =>
			fila({ cliente: { code, nombre: code, connections: [] }, ultimoContacto });
		const filas = [
			conContacto('reciente', '2026-08-01'),
			conContacto('nunca', ''),
			conContacto('viejo', '2026-02-01')
		];
		expect(codes(ordenar(filas, 'contacto', 'asc'))).toEqual(['nunca', 'viejo', 'reciente']);
	});

	it('por pagos, el peor comportamiento primero y los sin puntos al final', () => {
		const conPuntos = (code, puntos) => fila({ cliente: { code, nombre: code, connections: [] }, puntos });
		const filas = [
			conPuntos('sano', [{ estado: 'verde' }, { estado: 'verde' }]),
			conPuntos('sinPuntos', []),
			conPuntos('malo', [{ estado: 'rojo' }, { estado: 'amarillo' }])
		];
		expect(codes(ordenar(filas, 'pagos', 'desc'))).toEqual(['malo', 'sano', 'sinPuntos']);
	});

	it('a igualdad de valor cae al orden por defecto', () => {
		const conCiudad = (code, ciudad, alta) =>
			fila({ cliente: { code, nombre: code, connections: [] }, ciudad, alta });
		const filas = [
			conCiudad('vieja', 'Ensenada', '2020-01-01'),
			conCiudad('nueva', 'Ensenada', '2026-08-01')
		];
		expect(codes(ordenar(filas, 'ciudad', 'asc'))).toEqual(['nueva', 'vieja']);
	});

	it('una columna desconocida cae al orden por defecto en vez de romper', () => {
		const filas = [
			fila({ cliente: { code: 'a', nombre: 'a', connections: [] }, alta: '2020-01-01' }),
			fila({ cliente: { code: 'b', nombre: 'b', connections: [] }, alta: '2026-01-01' })
		];
		expect(codes(ordenar(filas, 'inventada', 'asc'))).toEqual(['b', 'a']);
	});

	it('una lista vacia sigue siendo una lista vacia', () => {
		expect(ordenar([], 'alta', 'desc')).toEqual([]);
		expect(ordenar([], 'alertas', 'desc')).toEqual([]);
	});

	it('sin la columna ni la direccion, ordena por defecto', () => {
		const filas = [
			fila({ cliente: { code: 'nuevoSinAlerta', nombre: 'a', connections: [] }, alta: '2026-08-01' }),
			fila({
				cliente: { code: 'viejoConAlerta', nombre: 'b', connections: [] },
				alertas: [{ tipo: 'mora_2', desde: '2026-08' }],
				urgencia: 'alta',
				alta: '2020-01-01'
			})
		];
		// El de la alerta primero aunque su alta sea mucho mas vieja: eso es lo
		// que distingue el orden por defecto de un `alta desc`.
		expect(codes(ordenar(filas))).toEqual(['viejoConAlerta', 'nuevoSinAlerta']);
	});

	it('la direccion invierte de verdad en cada columna, no solo en alta', () => {
		const conCiudad = (code, ciudad) => fila({ cliente: { code, nombre: code, connections: [] }, ciudad });
		const filas = [conCiudad('e', 'Ensenada'), conCiudad('p', 'Punta Lara')];
		expect(codes(ordenar(filas, 'ciudad', 'asc'))).toEqual(['e', 'p']);
		expect(codes(ordenar(filas, 'ciudad', 'desc'))).toEqual(['p', 'e']);
	});

	it('por codigo ordena numericamente gracias a los ceros a la izquierda', () => {
		const conCode = (code) => fila({ cliente: { code, nombre: code, connections: [] } });
		const filas = [conCode('015614'), conCode('003566'), conCode('015601')];
		expect(codes(ordenar(filas, 'codigo', 'asc'))).toEqual(['003566', '015601', '015614']);
	});

	it('la cola de sin-dato tambien queda ordenada, no en cualquier orden', () => {
		const conEdad = (code, edad, alta) =>
			fila({ cliente: { code, nombre: code, connections: [] }, edad, alta });
		const filas = [
			conEdad('sinVieja', null, '2020-01-01'),
			conEdad('conEdad', 40, '2021-01-01'),
			conEdad('sinNueva', null, '2026-01-01')
		];
		// Los dos sin edad van al final, y entre ellos por alta descendente.
		expect(codes(ordenar(filas, 'edad', 'desc'))).toEqual(['conEdad', 'sinNueva', 'sinVieja']);
		expect(codes(ordenar(filas, 'edad', 'asc'))).toEqual(['conEdad', 'sinNueva', 'sinVieja']);
	});

	it('el desempate NO se invierte con la direccion', () => {
		const conCiudad = (code, alta) =>
			fila({ cliente: { code, nombre: code, connections: [] }, ciudad: 'Ensenada', alta });
		const filas = [conCiudad('vieja', '2020-01-01'), conCiudad('nueva', '2026-01-01')];
		// Misma ciudad en las dos filas: el orden lo decide el desempate, que es
		// el mismo mire para donde mire la columna.
		expect(codes(ordenar(filas, 'ciudad', 'asc'))).toEqual(['nueva', 'vieja']);
		expect(codes(ordenar(filas, 'ciudad', 'desc'))).toEqual(['nueva', 'vieja']);
	});

	it('el desempate por columna no mira alertas', () => {
		const conAlerta = fila({
			cliente: { code: 'conAlerta', nombre: 'a', connections: [{}] },
			alertas: [{ tipo: 'mora_2', desde: '2026-08' }],
			urgencia: 'alta',
			alta: '2020-01-01'
		});
		const sinAlerta = fila({
			cliente: { code: 'sinAlerta', nombre: 'b', connections: [{}] },
			alta: '2026-08-01'
		});

		// Las dos empatan en conexiones -una cada una, que es el caso normal de
		// casi toda la cartera-, asi que manda el desempate. Tiene que ser el
		// alta y NO la alerta: si mirara alertas, "ordenar por conexiones"
		// seria el orden por defecto con otro nombre, porque el grupo empatado
		// es practicamente la lista entera.
		expect(codes(ordenar([conAlerta, sinAlerta], 'conexiones', 'desc'))).toEqual([
			'sinAlerta',
			'conAlerta'
		]);
		expect(codes(ordenar([conAlerta, sinAlerta], 'conexiones', 'asc'))).toEqual([
			'sinAlerta',
			'conAlerta'
		]);
	});

	it('pero el orden por defecto si las mira', () => {
		const conAlerta = fila({
			cliente: { code: 'conAlerta', nombre: 'a', connections: [{}] },
			alertas: [{ tipo: 'mora_2', desde: '2026-08' }],
			urgencia: 'alta',
			alta: '2020-01-01'
		});
		const sinAlerta = fila({
			cliente: { code: 'sinAlerta', nombre: 'b', connections: [{}] },
			alta: '2026-08-01'
		});

		// Control del test de arriba: el mismo par de filas, y aca la alerta si
		// manda aunque el alta sea seis anios mas vieja. Sin este contraste, el
		// otro test podria estar pasando por cualquier motivo.
		expect(codes(ordenar([sinAlerta, conAlerta], 'alertas', 'desc'))).toEqual([
			'conAlerta',
			'sinAlerta'
		]);
	});

	it('sin puntos no es lo mismo que todos los puntos en verde', () => {
		const conPuntos = (code, puntos, alta) =>
			fila({ cliente: { code, nombre: code, connections: [] }, puntos, alta });
		const filas = [
			conPuntos('sinPuntos', [], '2026-01-01'),
			conPuntos('sano', [{ estado: 'verde' }], '2020-01-01')
		];
		// `sano` pesa 0 igual que la ausencia de puntos, pero no es un dato
		// faltante: compite, y por eso va antes aunque su alta sea mas vieja.
		expect(codes(ordenar(filas, 'pagos', 'desc'))).toEqual(['sano', 'sinPuntos']);
		expect(codes(ordenar(filas, 'pagos', 'asc'))).toEqual(['sano', 'sinPuntos']);
	});

	it('un nombre o un alta vacios ordenan ultimos, no primeros', () => {
		const f = (code, over) => fila({ cliente: { code, nombre: code, connections: [] }, ...over });
		const porNombre = [
			fila({ cliente: { code: 'sin', nombre: '', connections: [] } }),
			fila({ cliente: { code: 'con', nombre: 'Alvarez', connections: [] } })
		];
		expect(codes(ordenar(porNombre, 'nombre', 'asc'))).toEqual(['con', 'sin']);

		const porAlta = [f('sinAlta', { alta: '' }), f('conAlta', { alta: '2020-01-01' })];
		expect(codes(ordenar(porAlta, 'alta', 'asc'))).toEqual(['conAlta', 'sinAlta']);
	});
});

describe('ordenar — estabilidad', () => {
	// Dos clientes con TODO igual salvo el code no pueden salir en un orden
	// distinto entre renders: la lista se repinta sola cada 30 s y las filas
	// saltarian de lugar solas.
	it('el code desempata cuando el alta tambien empata', () => {
		const conCode = (code) =>
			fila({ cliente: { code, nombre: 'Igual', connections: [] }, alta: '2026-01-01' });
		expect(codes(ordenar([conCode('c'), conCode('a'), conCode('b')], 'alertas', 'desc'))).toEqual([
			'a',
			'b',
			'c'
		]);
	});

	it('el resultado no depende del orden de entrada', () => {
		const armar = (codesEntrada) =>
			codesEntrada.map((code) =>
				fila({
					cliente: { code, nombre: code, connections: [] },
					alertas: [{ tipo: 'mora_1', desde: '2026-08' }],
					urgencia: 'media',
					alta: '2026-01-01'
				})
			);
		const unaVuelta = codes(ordenar(armar(['x', 'y', 'z']), 'alertas', 'desc'));
		const otraVuelta = codes(ordenar(armar(['z', 'x', 'y']), 'alertas', 'desc'));
		expect(unaVuelta).toEqual(otraVuelta);
	});
});

describe('direccionInicial', () => {
	it('las columnas donde interesa lo mas alto arrancan descendentes', () => {
		expect(direccionInicial('alta')).toBe('desc');
		expect(direccionInicial('edad')).toBe('desc');
		expect(direccionInicial('conexiones')).toBe('desc');
		expect(direccionInicial('pagos')).toBe('desc');
	});

	it('las alfabeticas y la de contacto arrancan ascendentes', () => {
		expect(direccionInicial('nombre')).toBe('asc');
		expect(direccionInicial('ciudad')).toBe('asc');
		expect(direccionInicial('codigo')).toBe('asc');
		expect(direccionInicial('contacto')).toBe('asc');
	});

	it('alertas no tiene direccion que elegir', () => {
		expect(direccionInicial('alertas')).toBe('desc');
	});
});
