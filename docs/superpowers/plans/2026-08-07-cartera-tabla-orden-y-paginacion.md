# Cartera: lista en columnas, orden por alertas y paginación — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir la lista de tarjetas de la Cartera en una tabla de nueve columnas, con orden por defecto "qué atender hoy", orden por click en cada encabezado y paginación de a 20.

**Architecture:** Tres módulos puros nuevos en `src/lib/cartera/` (`edad.js`, `orden.js`, `paginacion.js`), cada uno con tests de vitest y sin dependencias de Svelte. `normalizarCliente` suma dos campos al snapshot (`doc_number`, `ciudad`) y el store los persiste en los tres caminos que escriben un cliente. `Cartera.svelte` se queda solo con estado de UI (columna activa, dirección, página) y render.

**Tech Stack:** SvelteKit 2 + Svelte 5 (runes), vitest, PocketBase, API de IspCube.

**Spec:** [`docs/superpowers/specs/2026-08-07-cartera-tabla-orden-y-paginacion-design.md`](../specs/2026-08-07-cartera-tabla-orden-y-paginacion-design.md)

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/lib/cartera/edad.js` | DNI → año de nacimiento → edad estimada. Nada más. |
| `src/lib/cartera/orden.js` | Clave de orden compuesta por alertas + comparadores por columna. |
| `src/lib/cartera/paginacion.js` | Qué números de página dibujar (con elipsis). |
| `src/lib/cartera/normalizar.js` | Suma `doc_number` y `ciudad` al snapshot. |
| `.../cartera/carteraStore.svelte.js` | Persiste los dos campos nuevos. |
| `.../cartera/Cartera.svelte` | Tabla, encabezados de orden, paginación. |
| `docs/ispcube-api.md` | Documenta los dos campos de la API. |

**Nota sobre `paginacion.js`:** el spec no lo listaba. Se separa porque `paginasVisibles` es lógica con casos borde reales (menos páginas que el ancho de la ventana, la página actual pegada a un extremo) que merece test propio, y no tiene nada que ver con ordenar.

---

## Task 1: Estimar la edad a partir del DNI

**Files:**
- Create: `src/lib/cartera/edad.js`
- Test: `src/lib/cartera/edad.test.js`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/cartera/edad.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { dniDe, estimarAnioNacimiento, estimarEdad } from './edad.js';

describe('dniDe', () => {
	it('un DNI de 8 digitos pasa tal cual', () => {
		expect(dniDe('20909528')).toBe(20909528);
	});

	it('saca los puntos de un DNI escrito a mano', () => {
		expect(dniDe('20.909.528')).toBe(20909528);
	});

	it('de un CUIL de persona fisica extrae el DNI del medio', () => {
		expect(dniDe('20-20909528-5')).toBe(20909528);
		expect(dniDe('27-30987654-3')).toBe(30987654);
		expect(dniDe('20209095285')).toBe(20909528);
	});

	it('un CUIT de empresa no es una persona', () => {
		expect(dniDe('30-71234567-8')).toBe(null);
		expect(dniDe('33712345678')).toBe(null);
		expect(dniDe('34712345678')).toBe(null);
	});

	it('vacio, nulo o sin digitos da null', () => {
		expect(dniDe('')).toBe(null);
		expect(dniDe(null)).toBe(null);
		expect(dniDe(undefined)).toBe(null);
		expect(dniDe('sin datos')).toBe(null);
	});

	it('mas de 11 digitos no es ni DNI ni CUIT', () => {
		expect(dniDe('123456789012')).toBe(null);
	});
});

describe('estimarAnioNacimiento', () => {
	it('interpola entre dos anclas', () => {
		// 20.909.528 cae entre 20M (1968) y 22M (1971).
		expect(estimarAnioNacimiento('20909528')).toBe(1969);
	});

	it('sobre un ancla exacta devuelve su anio', () => {
		expect(estimarAnioNacimiento('30000000')).toBe(1983);
		expect(estimarAnioNacimiento('44000000')).toBe(2002);
	});

	it('la serie de extranjeros (90M+) no se estima', () => {
		expect(estimarAnioNacimiento('95000000')).toBe(null);
	});

	it('por debajo de la primera ancla no se estima', () => {
		expect(estimarAnioNacimiento('500000')).toBe(null);
	});

	it('por encima de la ultima ancla no se extrapola', () => {
		expect(estimarAnioNacimiento('70000000')).toBe(null);
	});

	it('funciona igual entrando por un CUIL', () => {
		expect(estimarAnioNacimiento('20-20909528-5')).toBe(1969);
	});
});

describe('estimarEdad', () => {
	it('resta el anio de nacimiento al anio actual', () => {
		expect(estimarEdad('20909528', 2026)).toBe(57);
	});

	it('sin estimacion de nacimiento, sin edad', () => {
		expect(estimarEdad('95000000', 2026)).toBe(null);
		expect(estimarEdad('', 2026)).toBe(null);
	});

	it('una edad imposible se descarta en vez de mostrarse', () => {
		expect(estimarEdad('30000000', 1950)).toBe(null);
	});
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/lib/cartera/edad.test.js`
Expected: FAIL — `Failed to resolve import "./edad.js"`.

- [ ] **Step 3: Escribir la implementación**

Crear `src/lib/cartera/edad.js`:

```js
/**
 * Edad aproximada de un cliente a partir de su numero de documento.
 *
 * En Argentina el DNI se asigna de forma aproximadamente secuencial al
 * inscribir el nacimiento, asi que el numero acota el anio en que nacio su
 * titular. Esto es una ESTIMACION, no un dato: el margen real ronda los tres
 * anios, y por eso la UI la muestra con una tilde (`~57`) y nunca como la edad
 * a secas.
 *
 * No hay ninguna fuente oficial que publique la tabla; las anclas de abajo son
 * puntos de referencia de uso comun, y entre ellas se interpola linealmente.
 * Cuando el numero cae fuera de lo que la tabla puede sostener -la serie de
 * extranjeros, un CUIT de empresa, un numero anterior o posterior a las
 * anclas- la respuesta es `null` y la columna muestra un guion. Preferimos no
 * decir nada antes que decir un numero inventado.
 */

/**
 * Pares `[dni, anio de nacimiento]`, ascendentes por DNI.
 *
 * Los extremos importan tanto como los puntos del medio: por debajo del primero
 * la secuencia deja de ser confiable (libretas de enrolamiento y civicas, dos
 * series separadas hasta fines de los 60) y por encima del ultimo estariamos
 * extrapolando hacia numeros que todavia no se emitieron.
 */
const ANCLAS = [
	[1_000_000, 1920],
	[3_000_000, 1932],
	[5_000_000, 1943],
	[7_000_000, 1948],
	[10_000_000, 1952],
	[12_000_000, 1957],
	[14_000_000, 1961],
	[16_000_000, 1963],
	[18_000_000, 1966],
	[20_000_000, 1968],
	[22_000_000, 1971],
	[24_000_000, 1974],
	[26_000_000, 1977],
	[28_000_000, 1980],
	[30_000_000, 1983],
	[32_000_000, 1986],
	[34_000_000, 1988],
	[36_000_000, 1991],
	[38_000_000, 1994],
	[40_000_000, 1997],
	[42_000_000, 2000],
	[44_000_000, 2002],
	[46_000_000, 2005],
	[48_000_000, 2008],
	[50_000_000, 2010],
	[52_000_000, 2012],
	[54_000_000, 2014],
	[56_000_000, 2016],
	[58_000_000, 2018],
	[60_000_000, 2020]
];

/** Primer DNI de la serie que la RENAPER reserva a extranjeros. */
const SERIE_EXTRANJEROS = 90_000_000;

/** Prefijos de CUIT/CUIL que corresponden a una persona fisica. */
const PREFIJOS_PERSONA = ['20', '23', '24', '27'];

/**
 * El DNI que hay detras de un `doc_number` de IspCube, como numero.
 *
 * El campo es texto libre del otro lado: puede venir el DNI pelado, con puntos,
 * o el CUIT/CUIL entero (con guiones o sin ellos). Un CUIT de empresa
 * (prefijos 30, 33, 34) devuelve `null`: no hay persona de la cual estimar una
 * edad.
 *
 * @param {unknown} docNumber
 * @returns {number | null}
 */
export function dniDe(docNumber) {
	const digitos = String(docNumber ?? '').replace(/\D/g, '');
	if (digitos === '') return null;

	if (digitos.length === 11) {
		if (!PREFIJOS_PERSONA.includes(digitos.slice(0, 2))) return null;
		// CUIL = 2 de prefijo + 8 de DNI + 1 verificador.
		return Number(digitos.slice(2, 10));
	}

	// Mas de 11 digitos no es ninguna de las dos cosas; menos, es un DNI
	// (posiblemente viejo y corto, que `estimarAnioNacimiento` va a descartar).
	if (digitos.length > 11) return null;
	return Number(digitos);
}

/**
 * Anio de nacimiento estimado, o `null` si el numero no lo permite.
 *
 * @param {unknown} docNumber
 * @returns {number | null}
 */
export function estimarAnioNacimiento(docNumber) {
	const dni = dniDe(docNumber);
	if (dni === null) return null;

	// Redundante con el tope de la tabla (90M > 60M), pero explicito: la serie
	// de extranjeros no es secuencial por nacimiento y no se estima ni aunque
	// algun dia las anclas lleguen mas arriba.
	if (dni >= SERIE_EXTRANJEROS) return null;

	const [primerDni] = ANCLAS[0];
	const [ultimoDni] = ANCLAS[ANCLAS.length - 1];
	if (dni < primerDni || dni > ultimoDni) return null;

	for (let i = 1; i < ANCLAS.length; i++) {
		const [dniAnterior, anioAnterior] = ANCLAS[i - 1];
		const [dniActual, anioActual] = ANCLAS[i];
		if (dni > dniActual) continue;

		const avance = (dni - dniAnterior) / (dniActual - dniAnterior);
		return Math.round(anioAnterior + avance * (anioActual - anioAnterior));
	}

	return null;
}

/**
 * Edad aproximada en anios cumplidos-ish: no sabemos el mes de nacimiento, asi
 * que es la resta de anios y nada mas. Un resultado imposible (negativo, o mas
 * de 120) se descarta: significa que el `anioActual` o el documento estan mal,
 * y mostrar "-3" seria peor que no mostrar nada.
 *
 * @param {unknown} docNumber
 * @param {number} anioActual
 * @returns {number | null}
 */
export function estimarEdad(docNumber, anioActual) {
	const nacimiento = estimarAnioNacimiento(docNumber);
	if (nacimiento === null) return null;

	const edad = anioActual - nacimiento;
	return edad >= 0 && edad <= 120 ? edad : null;
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/lib/cartera/edad.test.js`
Expected: PASS — 15 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/cartera/edad.js src/lib/cartera/edad.test.js
git commit -m "feat(cartera): estimar la edad del cliente a partir del DNI"
```

---

## Task 2: El orden de la lista

**Files:**
- Create: `src/lib/cartera/orden.js`
- Test: `src/lib/cartera/orden.test.js`

`orden.js` trabaja sobre "filas": el objeto que `Cartera.svelte` ya arma por cliente. Su forma, que este módulo asume y la Task 5 construye:

```
{
  cliente: {code, nombre, connections},
  alertas: [{tipo, desde}],
  urgencia: 'alta' | 'media' | 'baja' | null,
  edad: number | null,
  ciudad: string,          // '' si no se sabe
  puntos: [{estado}],
  ultimoContacto: string,  // 'YYYY-MM-DD' o ''
  alta: string             // 'YYYY-MM-DD' o ''
}
```

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/cartera/orden.test.js`:

```js
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
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/lib/cartera/orden.test.js`
Expected: FAIL — `Failed to resolve import "./orden.js"`.

- [ ] **Step 3: Escribir la implementación**

Crear `src/lib/cartera/orden.js`:

```js
/**
 * El orden de la lista de la Cartera.
 *
 * Dos modos, y la diferencia entre ellos es el punto del modulo:
 *
 *   - El orden POR DEFECTO responde "que atiendo hoy": primero todo lo que
 *     tiene alerta, de mas urgente a menos, y dentro de cada nivel lo que hace
 *     mas tiempo que espera.
 *   - El orden POR COLUMNA responde otra pregunta ("quienes son mis clientes
 *     mas viejos", "quien vive en Ensenada") y por eso NO sube las alertas
 *     arriba. Si lo hiciera, la primera pantalla seria siempre la misma y el
 *     boton no serviria para nada.
 *
 * Trabaja sobre las "filas" que arma `Cartera.svelte`, no sobre el registro
 * crudo del cliente: la urgencia y las alertas ya vienen calculadas de ahi, y
 * recalcularlas por comparacion seria O(n log n) veces el mismo trabajo.
 */

/**
 * @typedef {object} Fila
 * @property {{code: string, nombre: string, connections?: unknown[]}} cliente
 * @property {{tipo: string, desde: string | null}[]} alertas
 * @property {'alta' | 'media' | 'baja' | null} urgencia
 * @property {number | null} edad
 * @property {string} ciudad
 * @property {{estado: string}[]} puntos
 * @property {string} ultimoContacto
 * @property {string} alta
 */

/** Menor es mas urgente. `null` (sin alertas) nunca llega a compararse aca. */
const RANGO_URGENCIA = { alta: 0, media: 1, baja: 2 };

/**
 * Cuanto "duele" cada punto de pago. Es la unica escala de la tabla que no sale
 * de un campo directo: un rojo (vencido sin pagar) pesa el triple que un
 * amarillo (pago fuera de termino), y verde y pendiente no suman nada.
 */
const PESO_PUNTO = { rojo: 3, amarillo: 1 };

/**
 * `desde` normalizado a `"YYYY-MM-DD"`, comparable como string.
 *
 * Llega en tres formas segun la alerta: `"2026-08"` (mora y seguimiento usan
 * `claveMes`), `"2026-08-04"` (recordatorio, promo) y `"2026-08-04 14:30:00"`
 * (tickets, que necesitan la hora para su propia comparacion). El mes se
 * completa al dia 1 -es lo mas viejo que ese mes puede ser- y la fecha-hora se
 * recorta.
 *
 * @param {unknown} desde
 * @returns {string} `''` si no hay fecha utilizable
 */
function normalizarDesde(desde) {
	if (typeof desde !== 'string') return '';
	if (/^\d{4}-\d{2}$/.test(desde)) return `${desde}-01`;
	if (/^\d{4}-\d{2}-\d{2}/.test(desde)) return desde.slice(0, 10);
	return '';
}

/**
 * La fecha de la alerta mas vieja del cliente.
 *
 * Un pendiente viejo urge mas que uno reciente -mismo criterio que usa
 * `proximoRecordatorio` para elegir cual mostrar-, asi que la fila se ordena
 * por la mas vieja de todas, no por la mas nueva.
 *
 * @param {{desde?: unknown}[]} alertas
 * @returns {string} `''` si ninguna alerta tiene fecha
 */
export function fechaDeAlerta(alertas) {
	let masVieja = '';
	for (const alerta of alertas ?? []) {
		const fecha = normalizarDesde(alerta?.desde);
		if (!fecha) continue;
		if (!masVieja || fecha < masVieja) masVieja = fecha;
	}
	return masVieja;
}

/**
 * Cuanto "debe" el historial de pagos visible del cliente. Mas alto es peor.
 *
 * @param {{estado?: string}[]} puntos
 * @returns {number}
 */
export function pesoPagos(puntos) {
	let total = 0;
	for (const punto of puntos ?? []) total += PESO_PUNTO[punto?.estado] ?? 0;
	return total;
}

/** @param {string} a @param {string} b */
const cmpTexto = (a, b) => a.localeCompare(b, 'es-AR');

/** @param {number} a @param {number} b */
const cmpNumero = (a, b) => a - b;

/**
 * Definicion de cada columna ordenable.
 *
 * `valor` devuelve `null` cuando la fila no tiene ese dato: esas filas salen de
 * la comparacion y van al final SIEMPRE, en las dos direcciones. Sin esto,
 * invertir el orden por edad subiria arriba de todo a los treinta clientes sin
 * DNI cargado, que es exactamente lo contrario de lo que buscaba quien hizo
 * click.
 *
 * `contacto` no usa esa via a proposito: "nunca contactado" no es un dato
 * faltante, es el valor mas viejo posible, y tiene que competir como tal.
 */
const COLUMNAS = {
	codigo: { dir: 'asc', valor: (f) => f.cliente.code, comparar: cmpTexto },
	nombre: { dir: 'asc', valor: (f) => f.cliente.nombre, comparar: cmpTexto },
	edad: { dir: 'desc', valor: (f) => f.edad, comparar: cmpNumero },
	ciudad: { dir: 'asc', valor: (f) => f.ciudad || null, comparar: cmpTexto },
	conexiones: {
		dir: 'desc',
		valor: (f) => (Array.isArray(f.cliente.connections) ? f.cliente.connections.length : 0),
		comparar: cmpNumero
	},
	contacto: { dir: 'asc', valor: (f) => f.ultimoContacto, comparar: cmpTexto },
	pagos: {
		dir: 'desc',
		valor: (f) => (f.puntos?.length ? pesoPagos(f.puntos) : null),
		comparar: cmpNumero
	},
	alta: { dir: 'desc', valor: (f) => f.alta, comparar: cmpTexto }
};

/**
 * Direccion con la que arranca una columna al hacerle click por primera vez.
 * Siempre la que responde la pregunta interesante: los mas nuevos, los mayores,
 * los peores pagadores, el contacto mas viejo.
 *
 * @param {string} columna
 * @returns {'asc' | 'desc'}
 */
export function direccionInicial(columna) {
	return COLUMNAS[columna]?.dir ?? 'desc';
}

/**
 * El orden por defecto, y tambien el desempate de cualquier orden por columna:
 * asi dos filas con la misma ciudad siempre salen en el mismo orden entre
 * renders, en vez de depender de como venia el array.
 *
 * @param {Fila} a
 * @param {Fila} b
 */
function compararDefecto(a, b) {
	const grupoA = a.alertas.length > 0 ? 0 : 1;
	const grupoB = b.alertas.length > 0 ? 0 : 1;
	if (grupoA !== grupoB) return grupoA - grupoB;

	if (grupoA === 0) {
		const urgenciaA = RANGO_URGENCIA[a.urgencia] ?? 3;
		const urgenciaB = RANGO_URGENCIA[b.urgencia] ?? 3;
		if (urgenciaA !== urgenciaB) return urgenciaA - urgenciaB;

		const fechaA = fechaDeAlerta(a.alertas);
		const fechaB = fechaDeAlerta(b.alertas);
		if (fechaA !== fechaB) {
			// Una alerta sin fecha (las dos de NAP) no puede competir por
			// antiguedad: va ultima dentro de su nivel de urgencia.
			if (!fechaA) return 1;
			if (!fechaB) return -1;
			return fechaA < fechaB ? -1 : 1;
		}
	}

	// Alta mas nueva arriba, y el code como ultimo recurso para que el orden sea
	// total (dos clientes dados de alta el mismo dia no pueden quedar sueltos).
	if (a.alta !== b.alta) return a.alta < b.alta ? 1 : -1;
	return cmpTexto(a.cliente.code, b.cliente.code);
}

/**
 * Devuelve una copia ordenada. Nunca muta lo que recibe: el array de entrada es
 * un `$derived` de Svelte y ordenarlo en el lugar dispararia el derived de
 * nuevo.
 *
 * @param {Fila[]} filas
 * @param {string} columna `'alertas'` para el orden compuesto por defecto
 * @param {'asc' | 'desc'} direccion Ignorada cuando `columna` es `'alertas'`
 * @returns {Fila[]}
 */
export function ordenar(filas, columna = 'alertas', direccion = 'desc') {
	const copia = [...filas];
	const col = COLUMNAS[columna];
	if (!col) return copia.sort(compararDefecto);

	const signo = direccion === 'desc' ? -1 : 1;

	/** @type {Fila[]} */
	const conDato = [];
	/** @type {Fila[]} */
	const sinDato = [];
	for (const f of copia) (col.valor(f) === null ? sinDato : conDato).push(f);

	conDato.sort((a, b) => signo * col.comparar(col.valor(a), col.valor(b)) || compararDefecto(a, b));
	sinDato.sort(compararDefecto);

	return [...conDato, ...sinDato];
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/lib/cartera/orden.test.js`
Expected: PASS — 24 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/cartera/orden.js src/lib/cartera/orden.test.js
git commit -m "feat(cartera): orden por alertas y comparadores por columna"
```

---

## Task 3: Los números de página

**Files:**
- Create: `src/lib/cartera/paginacion.js`
- Test: `src/lib/cartera/paginacion.test.js`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/cartera/paginacion.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { paginasVisibles, POR_PAGINA } from './paginacion.js';

describe('paginasVisibles', () => {
	it('con pocas paginas las muestra todas, sin elipsis', () => {
		expect(paginasVisibles(1, 5)).toEqual([1, 2, 3, 4, 5]);
		expect(paginasVisibles(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
	});

	it('con una sola pagina devuelve solo esa', () => {
		expect(paginasVisibles(1, 1)).toEqual([1]);
	});

	it('sin paginas devuelve una lista vacia', () => {
		expect(paginasVisibles(1, 0)).toEqual([]);
	});

	it('parado al principio, la elipsis va del lado derecho', () => {
		expect(paginasVisibles(1, 10)).toEqual([1, 2, '…', 10]);
	});

	it('parado en el medio, hay elipsis de los dos lados', () => {
		expect(paginasVisibles(5, 10)).toEqual([1, '…', 4, 5, 6, '…', 10]);
	});

	it('parado al final, la elipsis va del lado izquierdo', () => {
		expect(paginasVisibles(10, 10)).toEqual([1, '…', 9, 10]);
	});

	it('no pone elipsis por un solo numero salteado', () => {
		expect(paginasVisibles(4, 8)).toEqual([1, '…', 3, 4, 5, '…', 8]);
		expect(paginasVisibles(3, 8)).toEqual([1, 2, 3, 4, '…', 8]);
	});
});

describe('POR_PAGINA', () => {
	it('son 20', () => {
		expect(POR_PAGINA).toBe(20);
	});
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/lib/cartera/paginacion.test.js`
Expected: FAIL — `Failed to resolve import "./paginacion.js"`.

- [ ] **Step 3: Escribir la implementación**

Crear `src/lib/cartera/paginacion.js`:

```js
/**
 * Que numeros de pagina dibujar debajo de la lista.
 *
 * Vive aparte de `orden.js` porque no tiene nada que ver con ordenar, y aparte
 * del componente porque sus casos borde son reales: menos paginas que huecos,
 * la pagina actual pegada a un extremo, y un solo numero salteado (donde poner
 * "…" en lugar del numero ocuparia lo mismo y diria menos).
 */

/** Clientes por pagina. */
export const POR_PAGINA = 20;

/**
 * Hasta cuantas paginas se muestran enteras, sin elipsis. Siete es lo que entra
 * comodo: primera, ultima, la actual, sus dos vecinas y las dos elipsis.
 */
const SIN_ELIPSIS = 7;

/**
 * @param {number} actual Pagina actual, 1-based
 * @param {number} total Cantidad de paginas
 * @returns {(number | '…')[]}
 */
export function paginasVisibles(actual, total) {
	if (total <= 0) return [];
	if (total <= SIN_ELIPSIS) return Array.from({ length: total }, (_, i) => i + 1);

	const numeros = [...new Set([1, actual - 1, actual, actual + 1, total])]
		.filter((n) => n >= 1 && n <= total)
		.sort((a, b) => a - b);

	/** @type {(number | '…')[]} */
	const salida = [];
	let anterior = 0;
	for (const n of numeros) {
		// Un solo numero salteado no se reemplaza por "…": ocuparia lo mismo y
		// escondería una pagina a la que se podria ir de un click.
		if (n - anterior === 2) salida.push(anterior + 1);
		else if (n - anterior > 2) salida.push('…');
		salida.push(n);
		anterior = n;
	}
	return salida;
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/lib/cartera/paginacion.test.js`
Expected: PASS — 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/cartera/paginacion.js src/lib/cartera/paginacion.test.js
git commit -m "feat(cartera): numeros de pagina con elipsis"
```

---

## Task 4: `doc_number` y `ciudad` en el snapshot

**Files:**
- Modify: `src/lib/cartera/normalizar.js` (el `return` de `normalizarCliente` y su JSDoc)
- Test: `src/lib/cartera/normalizar.test.js`

- [ ] **Step 1: Escribir el test que falla**

Agregar al final del `describe('normalizarCliente', ...)` en `src/lib/cartera/normalizar.test.js`, justo antes de la llave que lo cierra:

```js
	it('guarda el documento crudo, sin interpretarlo', () => {
		expect(normalizarCliente({ ...crudo, doc_number: '20909528' }).doc_number).toBe('20909528');
	});

	it('sin documento, string vacio', () => {
		expect(normalizarCliente(crudo).doc_number).toBe('');
		expect(normalizarCliente({ ...crudo, doc_number: null }).doc_number).toBe('');
		expect(normalizarCliente({ ...crudo, doc_number: 20909528 }).doc_number).toBe('');
	});

	it('saca la ciudad del objeto anidado, tal cual viene', () => {
		const c = normalizarCliente({ ...crudo, city: { id: 2, name: 'PUNTA LARA' } });
		expect(c.ciudad).toBe('PUNTA LARA');
	});

	it('sin ciudad, string vacio', () => {
		expect(normalizarCliente(crudo).ciudad).toBe('');
		expect(normalizarCliente({ ...crudo, city: null }).ciudad).toBe('');
		expect(normalizarCliente({ ...crudo, city: {} }).ciudad).toBe('');
	});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/lib/cartera/normalizar.test.js`
Expected: FAIL — 4 tests rojos, con `expected undefined to be '20909528'` y similares.

- [ ] **Step 3: Escribir la implementación**

En `src/lib/cartera/normalizar.js`, dentro de `normalizarCliente`, agregar los dos campos al objeto que devuelve — entre `entity_nombre` y `comercial_activity`:

```js
		entity_nombre: typeof c.entity?.name === 'string' ? c.entity.name : '',
		// Documento y ciudad se guardan CRUDOS, tal como los manda IspCube. El
		// documento lo interpreta `edad.js` (puede ser un DNI o un CUIL) y la
		// ciudad la muestra la lista pasada por `toTitleCase`. Normalizar aca
		// haria que el snapshot y la API dejaran de coincidir sin que quede
		// registrado donde se transformo.
		doc_number: typeof c.doc_number === 'string' ? c.doc_number : '',
		ciudad: typeof c.city?.name === 'string' ? c.city.name : '',
		// Campo de texto libre de "datos personales" en IspCube. Normalmente es
```

Y en el JSDoc de `normalizarCliente`, agregar los dos campos al `@returns`, después de `entity_nombre: string,`:

```js
 *   entity_id: number | null, entity_nombre: string,
 *   doc_number: string, ciudad: string, comercial_activity: string,
```

(reemplaza la línea `*   entity_id: number | null, entity_nombre: string, comercial_activity: string,`)

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/lib/cartera/normalizar.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/cartera/normalizar.js src/lib/cartera/normalizar.test.js
git commit -m "feat(cartera): sumar doc_number y ciudad al snapshot del cliente"
```

---

## Task 5: Persistir los dos campos nuevos

**Files:**
- Modify: `.../Dashboard/cartera/carteraStore.svelte.js` — tres lugares

Los tres caminos que escriben un registro de cliente tienen que guardarlos. Si los campos todavía no existen en PocketBase, las claves extra se ignoran y nada se rompe: por eso este cambio se puede desplegar antes de tocar el admin.

- [ ] **Step 1: Guardarlos en el descubrimiento por vendedor**

En `descubrirCandidatosDeVendedor`, dentro del `pb.collection(CLIENTES).create({...})`, agregar las dos claves justo después de `nombre: candidato.nombre,`:

```js
					nombre: candidato.nombre,
					doc_number: candidato.doc_number,
					ciudad: candidato.ciudad,
					estado: candidato.estado,
```

- [ ] **Step 2: Guardarlos en cada sincronización**

En `guardarSnapshot`, dentro del objeto `parche`, agregar las dos claves justo después de `nombre: datos.nombre,`:

```js
		const parche = {
			nombre: datos.nombre,
			doc_number: datos.doc_number,
			ciudad: datos.ciudad,
			estado: datos.estado,
```

- [ ] **Step 3: Guardarlos al agregar un cliente a mano**

En `agregar`, dentro del objeto `registro`, agregar las dos claves justo después de `nombre: datos.cliente.nombre,`:

```js
				nombre: datos.cliente.nombre,
				doc_number: datos.cliente.doc_number,
				ciudad: datos.cliente.ciudad,
				estado: datos.cliente.estado,
```

- [ ] **Step 4: Verificar que la suite entera sigue verde**

Run: `npm test`
Expected: PASS, sin tests nuevos rojos. (El store no tiene tests propios; esto confirma que no se rompió nada aguas arriba.)

- [ ] **Step 5: Commit**

```bash
git add "src/routes/admin/_components/mantenimiento/Dashboard/cartera/carteraStore.svelte.js"
git commit -m "feat(cartera): persistir doc_number y ciudad en los tres caminos de alta"
```

---

## Task 6: La tabla

**Files:**
- Modify: `.../Dashboard/cartera/Cartera.svelte` (reemplazo completo)

Reemplazar el contenido entero de `src/routes/admin/_components/mantenimiento/Dashboard/cartera/Cartera.svelte` por lo siguiente. Es un reemplazo total y no un parche: cambian el `<script>`, el template y los estilos a la vez, y aplicarlo por partes deja el archivo sin compilar en el medio.

- [ ] **Step 1: Reemplazar el archivo**

````svelte
<!-- src/routes/admin/_components/mantenimiento/Dashboard/cartera/Cartera.svelte -->
<script>
import { onMount } from 'svelte';
import Spinner from '$lib/components/ui/Spinner.svelte';
import { carteraStore } from './carteraStore.svelte.js';
import AgregarCliente from './AgregarCliente.svelte';
import ClienteDetalle from './ClienteDetalle.svelte';
import CarteraConfig from './CarteraConfig.svelte';
import { puntosPorMes } from '$lib/cartera/pagos.js';
import { diaCorteDe, promosActivas } from '$lib/cartera/alertas.js';
import { partesFecha, diferenciaDias } from '$lib/cartera/fechas.js';
import { fechaLegible } from '$lib/cartera/tickets.js';
import { desdeCuando } from '$lib/cartera/relativo.js';
import { estadoInstalacionDe } from '$lib/cartera/instalacion.js';
import { describirConexion } from '$lib/cartera/planes.js';
import { estimarEdad } from '$lib/cartera/edad.js';
import { ordenar, direccionInicial } from '$lib/cartera/orden.js';
import { paginasVisibles, POR_PAGINA } from '$lib/cartera/paginacion.js';
import { toTitleCase } from '$lib/formatName.js';

const clientes = $derived(carteraStore.clientes);
const loading = $derived(carteraStore.loading);
const config = $derived(carteraStore.config);

let busqueda = $state('');
let filtro = $state('todos');
let abierto = $state(null);
let agregando = $state(false);
let configurando = $state(false);

// Columna activa y direccion. `alertas` es el orden compuesto por defecto: no
// tiene direccion que invertir, porque no ordena por un campo sino por "que
// atiendo hoy".
let orden = $state({ columna: 'alertas', direccion: 'desc' });
let pagina = $state(1);

// El tiempo relativo de cada fila tiene que envejecer solo. Sin este reloj,
// `desdeCuando` se evalua una sola vez al pintar y una pestania abierta desde
// la maniana sigue diciendo lo mismo a la tarde.
//
// 30 s y no 60 s para que el salto de "recién" a "hace 1 min" no se atrase
// hasta un minuto entero.
let ahora = $state(Date.now());

/** Partes de la fecha de hoy, en hora local. */
function hoyPartes() {
    const d = new Date();
    return { anio: d.getFullYear(), mes: d.getMonth() + 1, dia: d.getDate() };
}

// El banner de error del store es un string compartido: lo escriben cargar(),
// sincronizar() y archivar(), y una sincronizacion de fondo puede pisar un
// mensaje mas especifico (p. ej. el 403 de "no tenes permiso") con uno
// generico. Por eso el banner es descartable y se "reabre" solo cuando el
// texto cambia, no cuando el store simplemente lo repite.
//
// `ultimoError` se limpia apenas `carteraStore.error` vuelve a '': sin esto,
// un archivar() que falla dos veces seguidas (la primera se descarta, el
// error se borra solo a los 3s, la segunda repite el mismo string) nunca
// reabre el banner, porque `error !== ultimoError` da false las dos veces.
// Al resetear `ultimoError` cuando el error se apaga, la proxima vez que
// aparezca -sea el mismo texto o no- vuelve a contar como "nuevo".
let errorDescartado = $state(false);
let ultimoError = $state('');
$effect(() => {
    if (carteraStore.error) {
        if (carteraStore.error !== ultimoError) {
            ultimoError = carteraStore.error;
            errorDescartado = false;
        }
    } else {
        ultimoError = '';
    }
});

// Peso de cada alerta para que la fila comunique urgencia de un vistazo: un
// cliente con mora vencida se nota mas que uno que solo tiene el recordatorio
// de seguimiento, aun antes de leer los chips. Un recordatorio propio pesa como
// un ticket: lo puso el asesor a proposito, no lo dedujo el sistema.
const PESO = {
    mora_2: 3,
    mora_1: 2,
    tickets: 2,
    recordatorio: 2,
    promo_venciendo: 2,
    nap_faltante: 2,
    nap_anulado: 2,
    seguimiento: 1
};

function urgenciaDe(alertas) {
    if (alertas.length === 0) return null;
    const total = alertas.reduce((acc, a) => acc + (PESO[a.tipo] ?? 1), 0);
    if (total >= 3) return 'alta';
    if (total >= 2) return 'media';
    return 'baja';
}

// Las alertas salen del registro del cliente y nada mas: la de seguimiento usa
// `ultimo_contacto`, que el store mantiene al guardar una nota de contacto. Sin
// eso, saber si alguien ya llamo costaria una consulta por fila. La urgencia se
// calcula aca, una vez por cliente, para no recalcularla dos veces por fila en
// el template.
// `promosActivas` y `proximoRecordatorio` son informativos, no alertas: no
// pasan por `alertasDeCliente` ni suman a la urgencia. Un cliente con una promo
// que vence en 8 meses, o con un recordatorio para dentro de 10 dias, no tiene
// nada urgente por eso. Se calculan en el mismo derived que ya arma la lista
// para no recorrer los clientes tres veces.
//
// Los puntos de pago y la edad tambien se calculan aca y no en el template: son
// las dos operaciones caras por fila, y `ordenar` las necesita igual.
const conAlertas = $derived.by(() => {
    const hoy = hoyPartes();
    return clientes.map((c) => {
        const alertas = carteraStore.alertasDeCliente(c);
        const activas = promosActivas(c.promos ?? [], hoy);
        const proximo = carteraStore.proximoRecordatorioDe(c);
        return {
            cliente: c,
            alertas,
            urgencia: urgenciaDe(alertas),
            chips: chipsDe(c, alertas, activas, proximo),
            estadoInstalacion: estadoInstalacionDe(c),
            edad: estimarEdad(c.doc_number, hoy.anio),
            ciudad: c.ciudad ? toTitleCase(c.ciudad) : '',
            puntos: puntosDe(c, hoy).filter((p) => p.estado !== 'gris'),
            ultimoContacto: c.ultimo_contacto ?? '',
            // `created` de respaldo: `start_date` es la fecha de alta de
            // IspCube y siempre viene, pero un registro a medio sincronizar
            // podria no tenerla todavia, y la columna no puede quedar vacia.
            alta: c.start_date || (c.created ?? '').slice(0, 10)
        };
    });
});

const FILTROS = [
    { value: 'todos', label: 'Todos' },
    { value: 'alerta', label: 'Con alerta' },
    { value: 'seguimiento', label: 'Seguimiento 2 meses' },
    { value: 'mora', label: 'En mora' },
    { value: 'tickets', label: 'Tickets nuevos' },
    { value: 'nap_faltante', label: 'Sin reserva de NAP' },
    { value: 'nap_anulado', label: 'NAP anulado' },
    { value: 'recordatorio', label: 'Recordatorios' },
    { value: 'promo_venciendo', label: 'Promos por vencer' }
];

// Los encabezados, en el mismo orden que las columnas de la grilla. Las
// etiquetas son cortas a proposito: cada una tiene que entrar en el ancho de su
// columna sin envolver.
const COLUMNAS = [
    { key: 'codigo', label: 'Código' },
    { key: 'nombre', label: 'Nombre' },
    { key: 'edad', label: 'Edad aprox' },
    { key: 'ciudad', label: 'Ciudad' },
    { key: 'conexiones', label: 'Conexiones' },
    { key: 'contacto', label: 'Contacto' },
    { key: 'pagos', label: 'Pagos' },
    { key: 'alertas', label: 'Alertas' },
    { key: 'alta', label: 'Alta' }
];

const visibles = $derived(
    conAlertas.filter(({ cliente, alertas }) => {
        const q = busqueda.trim().toLowerCase();
        if (q && !cliente.nombre.toLowerCase().includes(q) && !cliente.code.includes(q)) return false;

        if (filtro === 'todos') return true;
        if (filtro === 'alerta') return alertas.length > 0;
        if (filtro === 'mora') return alertas.some((a) => a.tipo.startsWith('mora'));
        return alertas.some((a) => a.tipo === filtro);
    })
);

const ordenadas = $derived(ordenar(visibles, orden.columna, orden.direccion));

const totalPaginas = $derived(Math.max(1, Math.ceil(ordenadas.length / POR_PAGINA)));
// La pagina se clampea al derivar y no al setear: si el filtro achica la lista
// mientras estas en la 7, `pagina` sigue valiendo 7 hasta el proximo cambio, y
// sin esto la tabla quedaria vacia por un frame.
const paginaActual = $derived(Math.min(pagina, totalPaginas));
const enPagina = $derived(
    ordenadas.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA)
);
const numerosPagina = $derived(paginasVisibles(paginaActual, totalPaginas));
const desdeFila = $derived(ordenadas.length === 0 ? 0 : (paginaActual - 1) * POR_PAGINA + 1);
const hastaFila = $derived(Math.min(paginaActual * POR_PAGINA, ordenadas.length));

// Cualquier cosa que cambie QUE se ve vuelve a la primera pagina. Sin esto,
// buscar algo estando en la pagina 5 muestra una lista vacia y parece que no
// hubo resultados.
$effect(() => {
    busqueda;
    filtro;
    orden.columna;
    orden.direccion;
    pagina = 1;
});

function ordenarPor(key) {
    // `alertas` es un orden compuesto de cuatro criterios, no un campo: darlo
    // vuelta pondria arriba a los clientes sin nada que hacer, que es
    // exactamente lo contrario de para lo que existe.
    if (key === 'alertas') {
        orden = { columna: 'alertas', direccion: 'desc' };
        return;
    }
    if (orden.columna === key) {
        orden = { columna: key, direccion: orden.direccion === 'asc' ? 'desc' : 'asc' };
        return;
    }
    orden = { columna: key, direccion: direccionInicial(key) };
}

function irA(n) {
    if (n < 1 || n > totalPaginas) return;
    pagina = n;
}

// Las celdas de codigo y nombre son seleccionables (ver los estilos), pero la
// fila entera sigue siendo un boton: soltar el mouse al terminar de arrastrar
// cuenta como click y abriria el detalle encima de lo que acabas de
// seleccionar. Con esto, si hay algo seleccionado el click no hace nada.
function abrir(cliente) {
    if (window.getSelection?.()?.toString()) return;
    abierto = cliente;
}

const ETIQUETAS = {
    seguimiento: 'Contactar (2 meses)',
    mora_1: 'No pagó',
    mora_2: 'Mora vencida',
    // Singular: la alerta nace de comparar `tickets.ultimo` contra
    // `tickets_vistos_hasta`, o sea "hay algo posterior a tu ultima mirada".
    // El plural sugeria un contador de tickets abiertos, que es otra cosa.
    tickets: 'Ticket nuevo',
    recordatorio: 'Recordatorio',
    promo_venciendo: 'Promo por vencer',
    nap_faltante: 'Sin reserva de NAP',
    nap_anulado: 'NAP anulado'
};

const ETIQUETA_ESTADO_PUNTO = {
    verde: 'Pagó en término',
    amarillo: 'Pagó fuera de término',
    rojo: 'Sin pago, vencido',
    pendiente: 'Todavía no vence este mes',
    gris: 'Todavía no se le facturaba'
};

const ETIQUETA_ESTADO_INSTALACION = {
    pendiente_pago: 'Pendiente de pago',
    instalacion_pendiente: 'Instalación pendiente'
};

// Orden de lectura de los chips de una fila, de mas a menos urgente. Los chips
// COEXISTEN: un cliente con mora vencida, ticket nuevo, recordatorio y promo
// por vencer muestra los cuatro. Esto solo decide de izquierda a derecha,
// nunca esconde ninguno.
const ORDEN_CHIP = {
    mora_2: 0,
    mora_1: 1,
    tickets: 2,
    nap_faltante: 3,
    nap_anulado: 3,
    recordatorio: 4,
    promo_venciendo: 5,
    seguimiento: 6,
    promo: 7
};

// El color del semaforo no puede ser el unico canal (misma regla que siguen los
// puntos de pago y el resto de los chips): esto es lo que lee un lector de
// pantalla antes del texto del recordatorio.
const SR_RECORDATORIO = {
    vencido: 'Recordatorio vencido:',
    hoy: 'Recordatorio para hoy:',
    proximo: 'Recordatorio próximo:'
};

// Version corta para el chip ("15/9"), sin ceros ni anio: tiene que entrar
// junto al texto sin descuadrar la fila. La completa va en el `title`.
// Mismo criterio que `RecordatorioChip`, y mismo motivo para no usar
// `new Date(iso)`: un "2026-08-04" se interpreta en UTC y en Argentina (UTC-3)
// se muestra corrido un dia.
function fmtCorta(iso) {
    const p = partesFecha(iso);
    return p ? `${p.dia}/${p.mes}` : iso;
}

function fmtFecha(iso) {
    const p = partesFecha(iso);
    if (!p) return iso;
    return `${String(p.dia).padStart(2, '0')}/${String(p.mes).padStart(2, '0')}/${p.anio}`;
}

/** dd/mm/aa: la columna de alta tiene 5.4em y el anio de cuatro digitos no entra. */
function fmtAlta(iso) {
    const p = partesFecha(iso);
    if (!p) return '—';
    return `${String(p.dia).padStart(2, '0')}/${String(p.mes).padStart(2, '0')}/${String(p.anio).slice(-2)}`;
}

/**
 * Hace cuanto fue el ultimo contacto, en la unidad mas grande que se lea bien.
 *
 * Toma `ahora` en vez de leer el reloj adentro para que Svelte sepa que
 * depende de el: es lo que hace que la columna envejezca sola sin recargar.
 * No usa `desdeCuando` porque `ultimo_contacto` es una FECHA sin hora
 * (`"2026-08-04"`) y `Date.parse` la leeria en UTC, corriendo el dia en
 * Argentina.
 */
function haceCuanto(iso, ahora) {
    const p = partesFecha(iso);
    if (!p) return null;

    const d = new Date(ahora);
    const dias = diferenciaDias(p, { anio: d.getFullYear(), mes: d.getMonth() + 1, dia: d.getDate() });

    if (dias <= 0) return 'hoy';
    if (dias === 1) return 'ayer';
    if (dias < 30) return `hace ${dias} d`;
    if (dias < 365) return `hace ${Math.floor(dias / 30)} m`;
    return `hace ${Math.floor(dias / 365)} a`;
}

function cuandoVence(dias) {
    if (dias === 0) return 'vence hoy';
    if (dias < 0) return `hace ${-dias} ${dias === -1 ? 'día' : 'días'}`;
    return `en ${dias} ${dias === 1 ? 'día' : 'días'}`;
}

function tituloTicket(cliente) {
    const f = fechaLegible(cliente.tickets?.ultimo?.fecha, { conHora: true });
    return f ? `Último ticket: ${f}` : null;
}

/**
 * Los chips de una fila, ya ordenados.
 *
 * Cada chip es `{tipo, mod, texto, titulo, sr}`: `tipo` da la clase base y la
 * posicion en `ORDEN_CHIP`, `mod` es una clase extra (solo la usa el semaforo
 * del recordatorio) y `sr` es el texto que solo oye un lector de pantalla.
 */
function chipsDe(cliente, alertas, activas, proximo) {
    const chips = [];

    for (const a of alertas) {
        // El recordatorio se dibuja aparte, desde `proximoRecordatorioDe`: la
        // alerta solo existe cuando ya vencio y el chip tiene que verse antes
        // tambien. Si se dibujaran los dos, un recordatorio vencido saldria
        // duplicado.
        if (a.tipo === 'recordatorio') continue;

        chips.push({
            tipo: a.tipo,
            mod: '',
            texto: ETIQUETAS[a.tipo],
            titulo: a.tipo === 'tickets' ? tituloTicket(cliente) : (a.texto ?? null),
            sr: ''
        });
    }

    if (proximo) {
        const r = proximo.recordatorio;
        chips.push({
            tipo: 'recordatorio',
            mod: `rec-${proximo.estado}`,
            texto: `${r.texto} · ${fmtCorta(r.fecha)}`,
            titulo: `${fmtFecha(r.fecha)} · ${cuandoVence(proximo.dias)}`,
            sr: SR_RECORDATORIO[proximo.estado]
        });
    }

    if (activas.length > 0) {
        chips.push({
            tipo: 'promo',
            mod: '',
            texto: activas[0].promo_nombre,
            titulo: activas[0].promo_nombre,
            sr: 'Promo activa:'
        });
    }

    return chips.sort((a, b) => ORDEN_CHIP[a.tipo] - ORDEN_CHIP[b.tipo]);
}

function puntosDe(cliente, hoy) {
    const instalacion = partesFecha(cliente.fecha_instalacion);
    if (!instalacion) return [];
    return puntosPorMes(cliente.pagos ?? [], {
        perfil: cliente.perfil_pago,
        diaCorte: diaCorteDe(cliente.perfil_pago, config),
        instalacion,
        hoy,
        meses: 6
    });
}

function tituloPunto(p) {
    const base = `${p.mes} · ${ETIQUETA_ESTADO_PUNTO[p.estado] ?? p.estado}`;
    return p.dia ? `${base} (día ${p.dia})` : base;
}

// Refresco manual. El automatico solo corre al montar y solo toca snapshots de
// mas de 12 h, asi que un asesor que acaba de cobrarle a alguien tendria que
// esperar hasta medio dia para verlo reflejado. Este boton le da la salida.
//
// Refresca lo que el asesor esta mirando -la lista ya filtrada- y no la cartera
// entera, por dos razones: es lo que espera que pase, y el endpoint de sync
// rechaza mas de 20 codigos por llamada. El tope se aplica sobre los mas
// desactualizados, que son los que mas ganan con el refresco.
//
// Es la lista filtrada COMPLETA y no la pagina actual: que los dos numeros sean
// 20 es coincidencia -uno es el limite del endpoint, el otro el tamanio de
// pagina- y priorizar por antiguedad del snapshot es mejor criterio que
// "lo que quedo arriba".
const MAX_REFRESCO_MANUAL = 20;

const puedeRefrescar = $derived(visibles.length > 0 && !carteraStore.sincronizando);

function refrescarVisibles() {
    const codes = visibles
        .map(({ cliente }) => cliente)
        .sort((a, b) => (Date.parse(a.sincronizado) || 0) - (Date.parse(b.sincronizado) || 0))
        .slice(0, MAX_REFRESCO_MANUAL)
        .map((c) => c.code);

    carteraStore.sincronizar(codes);
}

onMount(() => {
    // El cuerpo con llaves no es cosmetico: `onMount(() => carteraStore.cargar())`
    // devolvia la Promise de `cargar`, y Svelte trata el valor de retorno de
    // `onMount` como la funcion de limpieza.
    carteraStore.cargar();

    const id = setInterval(() => (ahora = Date.now()), 30_000);
    return () => clearInterval(id);
});
</script>

<section>
    <header>
        <h2>Cartera de clientes</h2>
        <div class="acciones-header">
            <button
                class="refrescar"
                class:girando={carteraStore.sincronizando}
                onclick={refrescarVisibles}
                disabled={!puedeRefrescar}
                aria-label={carteraStore.sincronizando ? 'Actualizando' : 'Actualizar'}
                title="Volver a consultar IspCube para los clientes que estás viendo"
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                    stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="23 4 23 10 17 10" />
                    <polyline points="1 20 1 14 7 14" />
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
            </button>
            <button class="agregar" onclick={() => (agregando = true)}>+ Agregar cliente</button>
        </div>
    </header>

    <div class="controles">
        <input type="search" placeholder="Buscar por nombre o número" bind:value={busqueda} />
        <div class="filtros">
            {#each FILTROS as f}
                <button class:activo={filtro === f.value} onclick={() => (filtro = f.value)}>
                    {f.label}
                </button>
            {/each}
        </div>
    </div>

    {#if carteraStore.error && !errorDescartado}
        <p class="error">
            <span>{carteraStore.error}</span>
            <button class="cerrar-error" onclick={() => (errorDescartado = true)} aria-label="Descartar aviso">×</button>
        </p>
    {/if}

    {#if loading}
        <Spinner />
    {:else if ordenadas.length === 0}
        <div class="vacio">
            {#if clientes.length === 0 && carteraStore.error}
                <p>No pudimos cargar tu cartera. Revisá tu conexión e intentá de nuevo.</p>
                <button class="reintentar" onclick={() => carteraStore.cargar()}>Reintentar</button>
            {:else if clientes.length === 0}
                <p>Todavía no agregaste clientes a tu cartera.</p>
            {:else}
                <p>Ningún cliente coincide con el filtro.</p>
            {/if}
        </div>
    {:else}
        <div class="tabla">
            <div class="cabecera">
                {#each COLUMNAS as col}
                    {@const activa = orden.columna === col.key}
                    <button
                        class="th"
                        class:activa
                        onclick={() => ordenarPor(col.key)}
                        aria-label={col.key === 'alertas'
                            ? 'Ordenar por urgencia (orden por defecto)'
                            : `Ordenar por ${col.label}`}
                    >
                        <span class="th-texto">{col.label}</span>
                        <span class="flecha" aria-hidden="true">
                            {#if !activa}⇅{:else if col.key === 'alertas'}★{:else if orden.direccion === 'asc'}↑{:else}↓{/if}
                        </span>
                    </button>
                {/each}
            </div>

            <ul class="lista">
                {#each enPagina as fila (fila.cliente.id)}
                    {@const { cliente, urgencia, chips, estadoInstalacion, edad, ciudad, puntos, ultimoContacto, alta } = fila}
                    <li>
                        <!-- Tres `class:` sueltos y no un `class={...}` calculado:
                             un `class` dinamico en el mismo elemento que el
                             estatico es un atributo duplicado y Svelte no
                             compila. -->
                        <button
                            class="fila"
                            class:urgencia-baja={urgencia === 'baja'}
                            class:urgencia-media={urgencia === 'media'}
                            class:urgencia-alta={urgencia === 'alta'}
                            onclick={() => abrir(cliente)}
                            title="Actualizado {desdeCuando(cliente.sincronizado, ahora)}"
                        >
                            <span class="celda codigo seleccionable">
                                {cliente.code}
                                {#if carteraStore.refrescoFallido(cliente.code)}
                                    <span
                                        class="sync-fallo"
                                        title="No pudimos actualizar contra IspCube. Mostrando el último snapshot."
                                    >
                                        <span class="sr-only">Sin actualizar</span>
                                        ⟳
                                    </span>
                                {/if}
                            </span>

                            <!-- `data-code` lo lee el `::before` del layout
                                 mobile, donde la columna de codigo se oculta y
                                 el numero pasa a la linea del nombre. -->
                            <span class="celda quien seleccionable" data-code={cliente.code}>
                                <span class="nombre-linea">
                                    <strong>{cliente.nombre}</strong>
                                    {#if cliente.nuevo}
                                        <span
                                            class="badge nuevo"
                                            title="Sumado automáticamente por tu vendedor en IspCube"
                                        >
                                            Nuevo
                                        </span>
                                    {/if}
                                    {#if cliente.instalado_aviso}
                                        <span class="badge instalado" title="El ticket de reserva de NAP se cerró">
                                            Instalado ✓
                                        </span>
                                    {/if}
                                </span>
                                {#if estadoInstalacion !== 'instalado'}
                                    <span class="estado-instalacion">
                                        {ETIQUETA_ESTADO_INSTALACION[estadoInstalacion]}
                                    </span>
                                {/if}
                            </span>

                            <span class="celda edad">
                                {#if edad === null}
                                    <span class="vacia">—</span>
                                {:else}
                                    <span title="Estimado a partir del DNI (±3 años)">~{edad}</span>
                                {/if}
                            </span>

                            <span class="celda ciudad">
                                {#if ciudad}
                                    <span class="texto" title={ciudad}>{ciudad}</span>
                                {:else}
                                    <span class="vacia">—</span>
                                {/if}
                            </span>

                            <span class="celda conexiones">
                                {#each cliente.connections ?? [] as cx}
                                    {@const { etiqueta, categoria } = describirConexion(cx.plan_nombre)}
                                    <span class="chip conexion {categoria}" title={cx.plan_nombre}>{etiqueta}</span>
                                {:else}
                                    <span class="vacia">—</span>
                                {/each}
                            </span>

                            <span class="celda contacto">
                                {#if haceCuanto(ultimoContacto, ahora)}
                                    <span title="Último contacto: {fmtFecha(ultimoContacto)}">
                                        {haceCuanto(ultimoContacto, ahora)}
                                    </span>
                                {:else}
                                    <span class="vacia" title="Todavía no lo contactaron">nunca</span>
                                {/if}
                            </span>

                            <span class="celda pagos" title="Últimos 6 meses">
                                {#each puntos as p}
                                    <span class="punto {p.estado}" title={tituloPunto(p)}>
                                        <span class="sr-only">{ETIQUETA_ESTADO_PUNTO[p.estado] ?? p.estado}</span>
                                    </span>
                                {:else}
                                    <span class="vacia">—</span>
                                {/each}
                            </span>

                            <span class="celda alertas">
                                {#each chips as chip}
                                    <span class="chip {chip.tipo} {chip.mod}" title={chip.titulo}>
                                        {#if chip.sr}<span class="sr-only">{chip.sr}</span>{/if}
                                        {chip.texto}
                                    </span>
                                {:else}
                                    <span class="vacia">—</span>
                                {/each}
                            </span>

                            <span class="celda alta">{fmtAlta(alta)}</span>
                        </button>
                    </li>
                {/each}
            </ul>
        </div>

        <nav class="paginacion" aria-label="Paginación de la cartera">
            <span class="rango">{desdeFila}–{hastaFila} de {ordenadas.length}</span>
            {#if totalPaginas > 1}
                <div class="paginas">
                    <button onclick={() => irA(paginaActual - 1)} disabled={paginaActual === 1} aria-label="Página anterior">‹</button>
                    {#each numerosPagina as n}
                        {#if n === '…'}
                            <span class="salto" aria-hidden="true">…</span>
                        {:else}
                            <button
                                class:actual={n === paginaActual}
                                onclick={() => irA(n)}
                                aria-label="Página {n}"
                                aria-current={n === paginaActual ? 'page' : undefined}
                            >
                                {n}
                            </button>
                        {/if}
                    {/each}
                    <button onclick={() => irA(paginaActual + 1)} disabled={paginaActual === totalPaginas} aria-label="Página siguiente">›</button>
                </div>
            {/if}
        </nav>
    {/if}

    {#if agregando}
        <AgregarCliente onCerrar={() => (agregando = false)} />
    {/if}

    {#if abierto}
        <ClienteDetalle cliente={abierto} onCerrar={() => (abierto = null)} />
    {/if}

    {#if configurando}
        <CarteraConfig onCerrar={() => (configurando = false)} />
    {/if}
</section>

<style>
section { padding: 1.5em 2em; }
header { display: flex; align-items: center; justify-content: space-between; gap: 1em; }
h2 { color: var(--violeta2); margin: 0; }
.acciones-header { display: flex; gap: 0.6em; align-items: center; }
.refrescar {
    background: none; border: none; color: #9ca3af; cursor: pointer;
    width: 2.2em; height: 2.2em; padding: 0; border-radius: 0.5em;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.18s, color 0.18s;
}
.refrescar svg { width: 1.2em; height: 1.2em; }
.refrescar:hover:not(:disabled) { background: #f5f2fa; color: var(--violeta2); }
.refrescar:disabled { opacity: 0.55; cursor: not-allowed; }
/* Gira mientras `sincronizando` esta activo, no un spinner aparte: el mismo
   icono da el feedback de "en curso" sin sumar otro elemento al lado. */
.refrescar.girando svg { animation: girar 0.9s linear infinite; }
@keyframes girar {
    to { transform: rotate(360deg); }
}
.agregar {
    background: #fff; color: #6b7280; border: 1.5px solid #e0e0e0;
    border-radius: 0.6em; padding: 0.5em 0.9em; font-size: 0.88em;
    font-weight: 400; cursor: pointer; transition: background 0.18s, border-color 0.18s, color 0.18s;
}
.agregar:hover { background: #f5f2fa; border-color: #d1c4e9; color: var(--violeta2); }
.controles { display: flex; flex-wrap: wrap; gap: 1em; margin: 1.5em 0; align-items: center; }
input[type='search'] {
    flex: 1 1 18em; padding: 0.7em 1em; border: 2px solid #e5e7eb;
    border-radius: 0.8em; font-size: 1em; font-family: inherit;
}
input[type='search']:focus { outline: none; border-color: var(--violeta2); }
.filtros { display: flex; flex-wrap: wrap; gap: 0.4em; }
.filtros button {
    border: 1.5px solid #e0e0e0; background: #fff; color: var(--violeta2);
    border-radius: 2em; padding: 0.45em 1em; cursor: pointer; font-size: 0.92em;
}
.filtros button.activo { background: var(--violeta2); color: #fff; border-color: var(--violeta2); }

/* Una sola definicion de columnas para el encabezado y las filas: si vivieran
   en dos reglas distintas, tocar una sola descuadra la tabla entera.
   minmax(0, …) y no 1fr pelado: con `1fr` la columna no puede achicarse por
   debajo de su contenido, asi que un nombre largo empujaba a las demas fuera de
   la fila. */
.tabla {
    --cols: 4.6em minmax(0, 1.5fr) 4.2em 6.4em 7.6em 6em 5em minmax(0, 1.7fr) 5.4em;
    border: 1.5px solid #ececec; border-radius: 1em; background: #fff; overflow: hidden;
}
.cabecera, .fila {
    display: grid; grid-template-columns: var(--cols);
    gap: 0.7em; align-items: center;
}
.cabecera { background: #faf8fd; border-bottom: 1px solid #ececec; padding: 0 0.4em 0 0.9em; }
.th {
    display: flex; align-items: center; gap: 0.3em; min-width: 0;
    background: none; border: none; padding: 0.7em 0.2em; margin: 0;
    font: inherit; font-size: 0.72em; letter-spacing: 0.04em; color: #6b7280;
    text-align: left; cursor: pointer; border-radius: 0.4em;
    transition: color 0.15s;
}
.th-texto { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.th:hover { color: var(--violeta2); }
.th.activa { color: var(--violeta2); font-weight: 700; }
/* La flecha del criterio inactivo se ve igual, apagada: sin ella el encabezado
   no parece clickeable hasta que lo tocas. */
.flecha { opacity: 0.35; flex-shrink: 0; }
.th.activa .flecha { opacity: 1; }

.lista { list-style: none; padding: 0; margin: 0; }
li + li .fila { border-top: 1px solid #f3f4f6; }
.fila {
    width: 100%; padding: 0.6em 0.6em 0.6em 0.9em;
    background: none; border: none; cursor: pointer; text-align: left;
    font-size: 1em; font-family: inherit; color: inherit;
}
.fila:hover { background: #faf8fd; }
/* Con teclado no habia ninguna senial de donde estabas parado. */
.fila:focus-visible { outline: 2px solid var(--violeta2); outline-offset: -2px; background: #faf8fd; }
/* La urgencia se ve antes de leer los chips. `inset box-shadow` y no
   `border-left`: el borde cambiaria el ancho de la fila y las filas con alerta
   arrancarian corridas respecto de las que no tienen. */
.fila.urgencia-baja { box-shadow: inset 3px 0 0 #b9a7d9; }
.fila.urgencia-media { box-shadow: inset 3px 0 0 #f0c674; }
.fila.urgencia-alta { box-shadow: inset 3px 0 0 #ef4444; }

.celda { min-width: 0; display: flex; align-items: center; gap: 0.3em; font-size: 0.85em; }
.codigo { color: #9ca3af; font-variant-numeric: tabular-nums; }
/* Codigo y nombre se copian todo el dia. Dentro de un <button> el navegador no
   deja seleccionar; esto lo habilita, y `abrir()` ignora el click cuando hay
   algo seleccionado. */
.seleccionable { cursor: text; user-select: text; }
.quien { flex-direction: column; align-items: flex-start; gap: 0.05em; }
.nombre-linea { display: flex; align-items: center; gap: 0.4em; min-width: 0; max-width: 100%; }
.nombre-linea strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; font-weight: 600; }
.edad, .contacto, .alta { color: #6b7280; white-space: nowrap; }
.alta { font-variant-numeric: tabular-nums; }
.ciudad { color: #6b7280; }
/* El recorte va en el hijo y no en la celda: `.celda` es flex, y un nodo de
   texto suelto adentro de un flex container no se puede elipsizar. */
.ciudad .texto { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vacia { color: #d1d5db; }
/* Mismo tono amber que las alertas de mora, no rojo: un refresco fallido deja
   al cliente en el modo degradado esperado (snapshot viejo), no en un error. */
.sync-fallo { color: #92400e; }
/* "Nuevo": mismo cyan que .chip.promo (informativo, deducido de IspCube).
   "Instalado": mismo verde que .chip.rec-proximo. Cero paletas nuevas. */
.badge {
    font-size: 0.72em; font-weight: 700; padding: 0.15em 0.5em; border-radius: 1em;
    white-space: nowrap; text-transform: uppercase; letter-spacing: 0.02em; flex-shrink: 0;
}
.badge.nuevo { background: #cffafe; color: #155e75; }
.badge.instalado { background: #d1fae5; color: #065f46; }
/* Discreto a proposito: instalacion_pendiente/pendiente_pago se muestran,
   pero sin la fuerza visual de una alerta -no lo son-. */
.estado-instalacion { color: #92400e; font-size: 0.82em; font-weight: 600; }
.pagos { gap: 0.25em; }
.sr-only {
    position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
    overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
}
/* Cinco estados, cinco combinaciones de forma + borde + relleno: el color
   nunca es el unico canal, asi que siguen siendo distinguibles sin ver rojo
   ni verde. */
.punto { width: 0.75em; height: 0.75em; display: inline-block; box-sizing: border-box; flex-shrink: 0; }
.punto.verde { border-radius: 50%; background: #22c55e; border: 1.5px solid #16a34a; }
.punto.amarillo {
    border-radius: 50%; border: 1.5px solid #a16207;
    background: radial-gradient(circle at center, #fff 0 28%, #eab308 30% 100%);
}
.punto.rojo { border-radius: 0.2em; transform: rotate(45deg); background: #ef4444; border: 1.5px solid #b91c1c; }
.punto.pendiente { border-radius: 50%; background: transparent; border: 1.5px dashed #9ca3af; }
.punto.gris { border-radius: 50%; background: #f3f4f6; border: 1px solid #e5e7eb; }
/* Los chips coexisten: mora + ticket + recordatorio + promo pueden estar los
   cuatro. Envuelven a una segunda linea antes que empujar o recortar las otras
   columnas. */
.alertas, .conexiones { flex-wrap: wrap; gap: 0.3em; }
.chip {
    font-size: 0.88em; padding: 0.15em 0.6em; border-radius: 1em;
    white-space: nowrap; font-weight: 600;
}
.chip.seguimiento { background: #ede7f6; color: #5a1e7a; }
.chip.mora_1 { background: #fef3c7; color: #92400e; }
.chip.mora_2 { background: #fee2e2; color: #991b1b; }
.chip.tickets { background: #dbeafe; color: #1e40af; }
/* Cyan/teal: nuevo, no lo usa ningun otro chip. Distinto del verde de
   recordatorio -que significa "lo cargo el asesor"-, esto es informativo,
   deducido de IspCube. */
.chip.promo {
    background: #cffafe; color: #155e75;
    display: inline-block; max-width: 10em;
    overflow: hidden; text-overflow: ellipsis;
}
/* Mismo amber que mora_1: "atender pronto", no una falla ya consumada como mora_2. */
.chip.promo_venciendo { background: #fef3c7; color: #92400e; }
/* Mismo amber que mora_1/tickets: anomalia de proceso, no un vencimiento,
   pero tampoco algo para ignorar. */
.chip.nap_faltante, .chip.nap_anulado { background: #fef3c7; color: #92400e; }
/* Mas corto que en la version de tarjetas (era 14em): en una tabla de nueve
   columnas un recordatorio largo envolvia a tres lineas y estiraba la fila.
   El texto completo sigue en el `title`. */
.chip.recordatorio {
    display: inline-block; max-width: 8em;
    overflow: hidden; text-overflow: ellipsis;
}
/* Semaforo del recordatorio. Los tres colores ya existen en el panel: el verde
   es el de "lo cargo el asesor" del detalle, el ambar es el de mora_1
   ("atender pronto") y el rojo el de mora_2 ("ya se paso"). Cero paletas
   nuevas. */
.chip.rec-proximo { background: #d1fae5; color: #065f46; }
.chip.rec-hoy { background: #fef3c7; color: #92400e; }
.chip.rec-vencido { background: #fee2e2; color: #991b1b; }
/* Los chips de conexion reusan la escala de `describirConexion`: internet en
   violeta (el color del panel), TV en cyan, telefonia en gris. */
.chip.conexion { max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
.chip.conexion.internet { background: #ede7f6; color: #5a1e7a; }
.chip.conexion.tv { background: #cffafe; color: #155e75; }
.chip.conexion.telefonia { background: #f3f4f6; color: #4b5563; }
.chip.conexion.otro { background: #f3f4f6; color: #6b7280; }

.paginacion {
    display: flex; align-items: center; justify-content: space-between;
    gap: 1em; margin-top: 1em; font-size: 0.85em; color: #6b7280; flex-wrap: wrap;
}
.paginas { display: flex; gap: 0.3em; align-items: center; }
.paginas button {
    border: 1.5px solid #e5e7eb; background: #fff; color: var(--violeta2);
    border-radius: 0.5em; padding: 0.3em 0.65em; cursor: pointer;
    font-size: 1em; font-family: inherit; min-width: 2.1em;
}
.paginas button:hover:not(:disabled) { background: #f5f2fa; border-color: #d1c4e9; }
.paginas button.actual { background: var(--violeta2); color: #fff; border-color: var(--violeta2); }
.paginas button:disabled { opacity: 0.4; cursor: not-allowed; }
.salto { color: #d1d5db; padding: 0 0.15em; }

.vacio { color: #6b7280; padding: 2em 0; display: flex; flex-direction: column; align-items: flex-start; gap: 0.8em; }
.error {
    color: #991b1b; background: #fef2f2; border: 1px solid #fecaca; border-radius: 0.8em;
    padding: 0.7em 1em; margin: 1em 0 0; display: flex; align-items: center; justify-content: space-between; gap: 1em;
}
.cerrar-error { background: none; border: none; color: #991b1b; font-size: 1.3em; line-height: 1; cursor: pointer; padding: 0; }
.reintentar {
    background: #fff; border: 1.5px solid #e0e0e0; color: var(--violeta2);
    border-radius: 2em; padding: 0.5em 1.2em; cursor: pointer; font-size: 0.92em;
}

/* Nueve columnas no entran en un telefono. Se vuelve a la disposicion apilada,
   con areas: el nombre toma el ancho completo y los datos cortos comparten
   linea. Edad, ciudad y conexiones se ocultan -son contexto, no lo que se
   busca en un telefono-. El encabezado de orden tambien: no hay columnas
   contra las cuales alinearlo. El orden activo se conserva. */
@media (max-width: 900px) {
    section { padding: 1em; }
    .cabecera { display: none; }
    .fila {
        grid-template-columns: 1fr auto;
        grid-template-areas:
            'quien quien'
            'pagos alta'
            'alertas alertas';
        gap: 0.4em 0.8em; padding: 0.8em 0.9em;
    }
    .quien { grid-area: quien; }
    .pagos { grid-area: pagos; }
    .alta { grid-area: alta; justify-content: flex-end; }
    .alertas { grid-area: alertas; }
    .codigo, .edad, .ciudad, .conexiones, .contacto { display: none; }
    /* El codigo desaparece como celda pero no como dato: entra en la linea del
       nombre, que en mobile tiene el ancho entero. */
    .quien::before {
        content: attr(data-code); color: #9ca3af; font-size: 0.85em;
    }
}
</style>
````

- [ ] **Step 2: Verificar que compila y que los tipos cierran**

Run: `npm run check`
Expected: sin errores nuevos en `Cartera.svelte`. (El proyecto puede tener warnings preexistentes en otros archivos; solo importan los de este.)

- [ ] **Step 3: Correr la suite entera**

Run: `npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add "src/routes/admin/_components/mantenimiento/Dashboard/cartera/Cartera.svelte"
git commit -m "feat(cartera): lista en columnas con orden por encabezado y paginacion"
```

---

## Task 7: Documentar los dos campos de la API

**Files:**
- Modify: `docs/ispcube-api.md` — la tabla "Campos de `GET /api/customer`"

- [ ] **Step 1: Agregar las dos filas**

En la tabla de campos, después de la fila de `status`, insertar:

```markdown
| `doc_number` | **Documento del titular.** DNI pelado (`"20909528"`) o el CUIT/CUIL entero. La Cartera lo guarda crudo y lo interpreta [`edad.js`](../src/lib/cartera/edad.js) para estimar la edad. |
| `city {id, name, province, postal_code}` | **Ciudad del cliente.** La Cartera guarda `city.name` (`"PUNTA LARA"`, en mayúsculas) en `ciudad`. |
```

Y borrar `city{}` de la fila de campos anidados, que queda:

```markdown
| `phones[]`, `contact_emails[]`, `connections[]`, `customer_cbu[]` | Anidados. |
```

- [ ] **Step 2: Commit**

```bash
git add docs/ispcube-api.md
git commit -m "docs(ispcube): documentar doc_number y city en GET /api/customer"
```

---

## Task 8: Verificación en el navegador

**Files:** ninguno — es verificación.

- [ ] **Step 1: Crear los campos en PocketBase**

Esto lo hace el usuario, no el agente. En el admin de PocketBase, colección `cartera_clientes`, agregar dos campos `text` opcionales:

| Campo | Tipo |
|---|---|
| `doc_number` | text |
| `ciudad` | text |

Si todavía no están, seguir igual: las dos columnas van a mostrar `—` y nada se rompe.

- [ ] **Step 2: Levantar el preview**

`preview_start` con `{name: "dev"}` — la configuración ya está en `.claude/launch.json`. Nunca `npm run dev` por Bash.

- [ ] **Step 3: Abrir la Cartera y revisar la consola**

Navegar a la sección de Cartera del panel `/admin`. Correr `read_console_messages` con `onlyErrors: true`.
Expected: sin errores.

- [ ] **Step 4: Verificar la tabla y el orden por defecto**

Con `read_page`, confirmar:
- Nueve encabezados en el orden: Código, Nombre, Edad aprox, Ciudad, Conexiones, Contacto, Pagos, Alertas, Alta.
- El encabezado de Alertas está marcado como activo.
- Las primeras filas son las que tienen chips de alerta; las que no tienen chips están más abajo.

- [ ] **Step 5: Verificar el orden por columna**

Click en el encabezado "Alta" (`computer` con el `ref` que devolvió `read_page`). Confirmar con `read_page` que la columna Alta queda en orden descendente y que hay filas sin alerta arriba. Click de nuevo: la flecha se invierte y las altas más viejas suben.

Click en "Alertas": vuelve el orden por defecto.

- [ ] **Step 6: Verificar la paginación**

Confirmar que se ven 20 filas como máximo y que el pie dice `1–20 de N`. Click en la página 2 y confirmar que el rango pasa a `21–40 de N`. Escribir algo en el buscador y confirmar que vuelve a la página 1.

- [ ] **Step 7: Verificar la selección de texto**

Con `javascript_tool`, seleccionar el texto de una celda de nombre y disparar un click sobre la fila:

```js
const celda = document.querySelector('.fila .quien strong');
const rango = document.createRange();
rango.selectNodeContents(celda);
getSelection().removeAllRanges();
getSelection().addRange(rango);
celda.click();
({ seleccion: getSelection().toString(), modalAbierto: !!document.querySelector('dialog[open], .modal') })
```

Expected: `seleccion` con el nombre del cliente y ningún modal abierto.

- [ ] **Step 8: Verificar mobile**

`resize_window` con `preset: "mobile"`. Con `read_page`, confirmar que el encabezado de orden desapareció y que el nombre, los pagos, el alta y las alertas siguen visibles.

- [ ] **Step 9: Captura**

`resize_window` de vuelta a `desktop` y `computer {action: "screenshot"}` para mostrarle el resultado al usuario.

---

## Verificación final

- [ ] `npm test` — toda la suite verde
- [ ] `npm run check` — sin errores nuevos
- [ ] El preview muestra la tabla, ordena por columna y pagina sin errores de consola
