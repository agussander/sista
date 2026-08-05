# Cartera — conexiones y promos activas (integrado) — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar a la Cartera de clientes (1) chips con el plan contratado de cada
conexión y (2) promos activas + alerta de vencimiento, ambas derivadas del mismo
`connections[]` que ya trae el sync de IspCube, sin request nuevo.

**Architecture:** Capa pura en `src/lib/cartera/` (normalización, fechas, alertas, un
diccionario de nombres de plan) + dos campos JSON nuevos en `cartera_clientes` +
UI en `Cartera.svelte` (lista) y `ClienteDetalle.svelte` (detalle). Sigue el patrón
existente de alertas (`seguimiento`, `mora_1`, `mora_2`, `tickets`, `recordatorio`):
cómputo puro, snapshot en PocketBase, chip en la lista, sección en el detalle.

**Tech Stack:** SvelteKit 5 (runes), Vitest, PocketBase (JS SDK + API REST desde
`scripts/crear-colecciones-cartera.js`).

**Spec:** [`docs/superpowers/specs/2026-08-05-cartera-conexiones-promos-integracion-design.md`](../specs/2026-08-05-cartera-conexiones-promos-integracion-design.md)
(y los dos diseños que integra, referenciados ahí).

---

## Nota sobre el Task 4 (migración de PocketBase)

Los dos diseños originales decían "agregar `json('promos')`/`json('connections')` al
literal de `fields` de `cartera_clientes` en `crear()`". Eso alcanza para una instancia
nueva, pero **no para la de producción**: `crear()` es idempotente por colección entera
(`scripts/crear-colecciones-cartera.js:205-224`) — si `cartera_clientes` ya existe, la
salta completa y el campo nuevo del literal nunca se manda. La única función que hoy
modifica una colección existente es `ponerCampoOpcional`
(`scripts/crear-colecciones-cartera.js:234-281`), y solo cambia `required` de un campo
que ya existe — no agrega uno nuevo. El Task 4 escribe la función que falta,
`agregarCampoSiFalta`, con el mismo patrón (GET → PATCH, dry-run, solo un 404 cuenta
como "no existe").

---

### Task 1: `fechas.js` — `diferenciaDias`

**Files:**
- Modify: `src/lib/cartera/fechas.js`
- Test: `src/lib/cartera/fechas.test.js`

- [ ] **Step 1: Escribir los tests que fallan**

Agregar al final de `src/lib/cartera/fechas.test.js` (después del `describe('compararFechaHora', ...)`):

```js
import { diferenciaDias } from './fechas.js';
```

(sumar `diferenciaDias` al import existente de la línea 2-11, no un import nuevo)

```js
describe('diferenciaDias', () => {
	it('da 0 para el mismo dia', () => {
		expect(diferenciaDias({ anio: 2026, mes: 7, dia: 15 }, { anio: 2026, mes: 7, dia: 15 })).toBe(0);
	});

	it('da 1 para el dia siguiente', () => {
		expect(diferenciaDias({ anio: 2026, mes: 7, dia: 15 }, { anio: 2026, mes: 7, dia: 16 })).toBe(1);
	});

	it('da -1 para el dia anterior', () => {
		expect(diferenciaDias({ anio: 2026, mes: 7, dia: 15 }, { anio: 2026, mes: 7, dia: 14 })).toBe(-1);
	});

	it('cruza el fin de mes', () => {
		expect(diferenciaDias({ anio: 2026, mes: 7, dia: 31 }, { anio: 2026, mes: 8, dia: 1 })).toBe(1);
	});

	it('cruza el fin de anio', () => {
		expect(diferenciaDias({ anio: 2026, mes: 12, dia: 31 }, { anio: 2027, mes: 1, dia: 1 })).toBe(1);
	});

	it('cruza un 29 de febrero bisiesto', () => {
		expect(diferenciaDias({ anio: 2024, mes: 2, dia: 28 }, { anio: 2024, mes: 3, dia: 1 })).toBe(2);
	});
});
```

- [ ] **Step 2: Correr los tests, confirmar que fallan**

Run: `npx vitest run src/lib/cartera/fechas.test.js`
Expected: FAIL — `diferenciaDias` no está exportado por `./fechas.js`.

- [ ] **Step 3: Implementar `diferenciaDias`**

Agregar al final de `src/lib/cartera/fechas.js`, después de `compararFechaHora`:

```js

/**
 * Cantidad de dias desde el 1 de enero del año 1 (proleptico gregoriano) hasta
 * `partes`. Algoritmo "days_from_civil" de Howard Hinnant: no depende de
 * `Date` ni de huso horario, coherente con el resto de este modulo.
 *
 * @param {Partes} partes
 * @returns {number}
 */
function diaJuliano({ anio, mes, dia }) {
	const y = mes <= 2 ? anio - 1 : anio;
	const era = Math.floor((y >= 0 ? y : y - 399) / 400);
	const yoe = y - era * 400; // [0, 399]
	const doy = Math.floor((153 * (mes + (mes > 2 ? -3 : 9)) + 2) / 5) + dia - 1; // [0, 365]
	const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy; // [0, 146096]
	return era * 146097 + doe - 719468;
}

/**
 * Dias de diferencia entre dos fechas (b - a). Puede dar negativo si `b` es
 * anterior a `a`.
 *
 * @param {Partes} a
 * @param {Partes} b
 * @returns {number}
 */
export function diferenciaDias(a, b) {
	return diaJuliano(b) - diaJuliano(a);
}
```

- [ ] **Step 4: Correr los tests, confirmar que pasan**

Run: `npx vitest run src/lib/cartera/fechas.test.js`
Expected: PASS (todos, incluidos los 39 ya existentes)

- [ ] **Step 5: Commit**

```bash
git add src/lib/cartera/fechas.js src/lib/cartera/fechas.test.js
git commit -m "feat(cartera): diferenciaDias en fechas.js"
```

---

### Task 2: `normalizar.js` — extracción unificada de `connections`/`promos`

**Files:**
- Modify: `src/lib/cartera/normalizar.js`
- Test: `src/lib/cartera/normalizar.test.js`

- [ ] **Step 1: Escribir los tests que fallan**

Agregar al final de `src/lib/cartera/normalizar.test.js`, antes del `describe('perfilDe', ...)`:

```js
describe('normalizarCliente: connections y promos', () => {
	// Cliente 012377, sondeo real contra IspCube (GET /api/customer): dos
	// conexiones vivas (una con promo activa, una sin promo) y una tercera
	// dada de baja, agregada a mano para probar el filtro.
	const crudo = {
		connections: [
			{
				id: 35914,
				plan_id: 27,
				delete_date: null,
				deleted_in_provider: 0,
				promotion_id: 63,
				promotion_start_date: '2026-09-01 00:00:00',
				promotion_end_date: '2026-10-31 23:59:59',
				plan: { id: 27, name: 'Servicio de Internet basico POWER F131' },
				promotion: {
					id: 63,
					name: 'PROMOCION CHEQUE CARGO CONEXION',
					bill_detail: 'Bonificacion Cargo Conexión',
					value: '10000.00',
					months: 2
				}
			},
			{
				id: 40021,
				plan_id: 31,
				delete_date: null,
				deleted_in_provider: 0,
				promotion_id: null,
				promotion_start_date: null,
				promotion_end_date: null,
				plan: { id: 31, name: 'Plan TV Basico' }
			},
			{
				id: 50000,
				plan_id: 99,
				delete_date: '2026-01-01 00:00:00',
				deleted_in_provider: 0,
				promotion_id: 70,
				promotion_start_date: '2026-01-01 00:00:00',
				promotion_end_date: '2026-12-31 23:59:59',
				plan: { id: 99, name: 'Plan Borrado' },
				promotion: { id: 70, name: 'Promo Borrada', bill_detail: 'x' }
			}
		]
	};

	it('connections mapea plan_id y plan_nombre de las conexiones vivas', () => {
		const c = normalizarCliente(crudo);
		expect(c.connections).toEqual([
			{ plan_id: 27, plan_nombre: 'Servicio de Internet basico POWER F131' },
			{ plan_id: 31, plan_nombre: 'Plan TV Basico' }
		]);
	});

	it('connections excluye la conexion borrada', () => {
		const c = normalizarCliente(crudo);
		expect(c.connections.some((cx) => cx.plan_id === 99)).toBe(false);
	});

	it('promos solo incluye la conexion con promotion_id y fecha de fin, viva', () => {
		const c = normalizarCliente(crudo);
		expect(c.promos).toEqual([
			{
				conexion_id: 35914,
				plan_nombre: 'Servicio de Internet basico POWER F131',
				promo_nombre: 'PROMOCION CHEQUE CARGO CONEXION',
				beneficio: 'Bonificacion Cargo Conexión',
				inicio: '2026-09-01',
				fin: '2026-10-31'
			}
		]);
	});

	it('promos excluye una conexion borrada aunque tenga promotion_id', () => {
		const c = normalizarCliente(crudo);
		expect(c.promos.some((p) => p.conexion_id === 50000)).toBe(false);
	});

	it('una conexion sin plan.name da plan_nombre vacio y conserva plan_id', () => {
		const c = normalizarCliente({
			connections: [{ id: 1, plan_id: 5, plan: {} }]
		});
		expect(c.connections).toEqual([{ plan_id: 5, plan_nombre: '' }]);
	});

	it('una conexion con promotion_id pero sin promotion_end_date no entra en promos', () => {
		const c = normalizarCliente({
			connections: [
				{
					id: 2,
					plan_id: 5,
					promotion_id: 10,
					promotion_start_date: '2026-01-01 00:00:00',
					promotion_end_date: null,
					plan: { name: 'Plan X' },
					promotion: { name: 'Promo X', bill_detail: 'y' }
				}
			]
		});
		expect(c.promos).toEqual([]);
	});

	it('una conexion con promotion_id pero sin promotion.name no entra en promos', () => {
		const c = normalizarCliente({
			connections: [
				{
					id: 3,
					plan_id: 5,
					promotion_id: 11,
					promotion_start_date: '2026-01-01 00:00:00',
					promotion_end_date: '2026-02-01 00:00:00',
					plan: { name: 'Plan X' },
					promotion: {}
				}
			]
		});
		expect(c.promos).toEqual([]);
	});

	it('connections ausente da dos arrays vacios', () => {
		const c = normalizarCliente({});
		expect(c.connections).toEqual([]);
		expect(c.promos).toEqual([]);
	});

	it('connections no es array da dos arrays vacios', () => {
		const c = normalizarCliente({ connections: 'no es un array' });
		expect(c.connections).toEqual([]);
		expect(c.promos).toEqual([]);
	});
});
```

- [ ] **Step 2: Correr los tests, confirmar que fallan**

Run: `npx vitest run src/lib/cartera/normalizar.test.js`
Expected: FAIL — `c.connections`/`c.promos` son `undefined`.

- [ ] **Step 3: Implementar `conexionesDe` y sumarla a `normalizarCliente`**

En `src/lib/cartera/normalizar.js`, agregar la función antes de `normalizarCliente`
(después del comentario del bloque, antes de la línea `export function normalizarCliente`):

```js
/**
 * Conexiones y promos de un cliente, extraidas de `crudo.connections`.
 *
 * Un cliente puede tener mas de una conexion (por ejemplo internet + TV), cada
 * una con su propio plan y, opcionalmente, su propia promo. Las dos listas
 * salen de un solo recorrido con un solo filtro de "conexion viva": evita que
 * `connections` y `promos` puedan desincronizarse sobre que cuenta como dada
 * de baja.
 *
 * @param {any} crudo
 * @returns {{
 *   connections: {plan_id: number|null, plan_nombre: string}[],
 *   promos: {conexion_id: number, plan_nombre: string, promo_nombre: string,
 *     beneficio: string, inicio: string, fin: string}[]
 * }}
 */
function conexionesDe(crudo) {
	const vivas = (Array.isArray(crudo?.connections) ? crudo.connections : []).filter(
		(c) => !c?.delete_date && !c?.deleted_in_provider
	);

	const connections = vivas.map((c) => ({
		plan_id: c?.plan_id ?? null,
		plan_nombre: typeof c?.plan?.name === 'string' ? c.plan.name : ''
	}));

	const promos = vivas
		.filter((c) => c?.promotion_id)
		.map((c) => ({
			conexion_id: c.id,
			plan_nombre: typeof c.plan?.name === 'string' ? c.plan.name : '',
			promo_nombre: typeof c.promotion?.name === 'string' ? c.promotion.name : '',
			beneficio: typeof c.promotion?.bill_detail === 'string' ? c.promotion.bill_detail : '',
			inicio: typeof c.promotion_start_date === 'string' ? c.promotion_start_date.slice(0, 10) : '',
			fin: typeof c.promotion_end_date === 'string' ? c.promotion_end_date.slice(0, 10) : ''
		}))
		.filter((p) => p.promo_nombre && p.fin);

	return { connections, promos };
}
```

Modificar `normalizarCliente` (la función y su JSDoc) para sumar los campos nuevos:

```js
/**
 * Un cliente de `GET /api/customer`, reducido a lo que usa la Cartera.
 *
 * @param {any} crudo
 * @returns {{code: string, nombre: string, estado: string, start_date: string,
 *   entity_id: number | null, entity_nombre: string, debt: number, duedebt: number,
 *   connections: {plan_id: number|null, plan_nombre: string}[],
 *   promos: {conexion_id: number, plan_nombre: string, promo_nombre: string,
 *     beneficio: string, inicio: string, fin: string}[]}}
 */
export function normalizarCliente(crudo) {
	const c = crudo ?? {};

	return {
		code: typeof c.code === 'string' ? c.code : '',
		nombre: typeof c.name === 'string' ? toTitleCase(c.name) : '',
		estado: typeof c.status === 'string' ? c.status : '',
		// `start_date` viene como "2026-05-01 00:00:00"; el snapshot guarda la
		// fecha sola porque la hora nunca es significativa.
		start_date: typeof c.start_date === 'string' ? c.start_date.slice(0, 10) : '',
		entity_id: c.entity_id ?? null,
		entity_nombre: typeof c.entity?.name === 'string' ? c.entity.name : '',
		debt: Number(c.debt) || 0,
		duedebt: Number(c.duedebt) || 0,
		...conexionesDe(c)
	};
}
```

- [ ] **Step 4: Correr los tests, confirmar que pasan**

Run: `npx vitest run src/lib/cartera/normalizar.test.js`
Expected: PASS (todos, incluidos los ya existentes)

- [ ] **Step 5: Commit**

```bash
git add src/lib/cartera/normalizar.js src/lib/cartera/normalizar.test.js
git commit -m "feat(cartera): extraer connections y promos de connections[] en normalizarCliente"
```

---

### Task 3: `planes.js` (nuevo) — diccionario de nombres cortos

**Files:**
- Create: `src/lib/cartera/planes.js`
- Test: `src/lib/cartera/planes.test.js`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/cartera/planes.test.js`:

```js
import { describe, it, expect, afterEach } from 'vitest';
import { NOMBRES_PLAN, nombreCortoPlan } from './planes.js';

describe('nombreCortoPlan', () => {
	afterEach(() => {
		delete NOMBRES_PLAN[27];
	});

	it('plan_id ausente del diccionario devuelve el nombre completo', () => {
		expect(nombreCortoPlan(999, 'Servicio de Internet basico POWER F131')).toBe(
			'Servicio de Internet basico POWER F131'
		);
	});

	it('plan_id presente en el diccionario devuelve el nombre corto', () => {
		NOMBRES_PLAN[27] = 'Power';
		expect(nombreCortoPlan(27, 'Servicio de Internet basico POWER F131')).toBe('Power');
	});

	it('nombreCompleto vacio y sin match no revienta', () => {
		expect(nombreCortoPlan(1, '')).toBe('');
	});

	it('plan_id null sin match devuelve el nombre completo', () => {
		expect(nombreCortoPlan(null, 'Plan X')).toBe('Plan X');
	});
});
```

- [ ] **Step 2: Correr el test, confirmar que falla**

Run: `npx vitest run src/lib/cartera/planes.test.js`
Expected: FAIL — no se puede resolver `./planes.js`.

- [ ] **Step 3: Implementar `planes.js`**

Crear `src/lib/cartera/planes.js`:

```js
/**
 * Nombres cortos para los planes mas comunes, por `plan_id` de IspCube.
 *
 * Arranca vacio; se completa con el tiempo a medida que aparecen planes
 * nuevos en produccion. Vive en codigo, sin UI de administracion: lo
 * mantiene quien toca codigo.
 *
 * @type {Record<number, string>}
 */
export const NOMBRES_PLAN = {
	// 27: 'Power',
};

/**
 * @param {number|string|null} planId
 * @param {string} nombreCompleto
 * @returns {string}
 */
export function nombreCortoPlan(planId, nombreCompleto) {
	return NOMBRES_PLAN[planId] ?? nombreCompleto;
}
```

- [ ] **Step 4: Correr el test, confirmar que pasa**

Run: `npx vitest run src/lib/cartera/planes.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/cartera/planes.js src/lib/cartera/planes.test.js
git commit -m "feat(cartera): diccionario de nombres cortos de plan"
```

---

### Task 4: PocketBase — campos `promos` y `connections` en `cartera_clientes`

**Files:**
- Modify: `scripts/crear-colecciones-cartera.js`

- [ ] **Step 1: Sumar los campos al literal de `crear()` (instancias nuevas)**

En `scripts/crear-colecciones-cartera.js`, dentro del `fields:` de `cartera_clientes`
(línea 328-329 actual), reemplazar:

```js
			json('pagos'),
			json('tickets'),
```

por:

```js
			json('pagos'),
			json('tickets'),
			json('promos'),
			json('connections'),
```

- [ ] **Step 2: Escribir `agregarCampoSiFalta` (instancia de producción, que ya existe)**

Agregar después de `ponerCampoOpcional` (después de la línea 281, antes de
`async function main() {`):

```js

/**
 * Agrega un campo nuevo a una coleccion que YA existe, si todavia no lo tiene.
 *
 * `crear()` es idempotente por coleccion entera (linea ~205): si
 * `cartera_clientes` ya existe en produccion, sumar un campo a su literal de
 * `fields` en este archivo no alcanza, `crear()` la saltea completa. Hace
 * falta el mismo tipo de PATCH que `ponerCampoOpcional`, pero agregando un
 * campo en vez de modificar uno existente.
 */
async function agregarCampoSiFalta(nombreColeccion, campo) {
	const res = await api(`/api/collections/${nombreColeccion}`);
	if (!res.ok) {
		// Igual que en ponerCampoOpcional(): solo un 404 cuenta como "no existe".
		if (res.status === 404) {
			console.log(`- ${nombreColeccion}.${campo.name}: la coleccion no existe, nada que migrar.`);
			return;
		}
		console.error(`- ${nombreColeccion}: no se pudo leer para migrar (${res.status})`, res.data);
		process.exit(1);
	}

	if (res.data.fields.some((f) => f.name === campo.name)) {
		console.log(`- ${nombreColeccion}.${campo.name}: ya existe, se saltea.`);
		return;
	}

	if (DRY_RUN) {
		console.log(`- ${nombreColeccion}.${campo.name}: SE AGREGARIA.`);
		return;
	}

	// Igual que en ponerCampoOpcional(): el PATCH reemplaza `fields` entero, hay
	// que mandar todos los campos existentes mas el nuevo.
	const fields = [...res.data.fields, campo];
	const patch = await api(`/api/collections/${nombreColeccion}`, {
		method: 'PATCH',
		body: { fields }
	});
	if (!patch.ok) {
		console.error(
			`- ${nombreColeccion}.${campo.name}: FALLO`,
			patch.status,
			JSON.stringify(patch.data, null, 2)
		);
		process.exit(1);
	}
	console.log(`- ${nombreColeccion}.${campo.name}: agregado.`);
}
```

- [ ] **Step 3: Llamarla en la sección de migraciones**

En `main()`, reemplazar:

```js
	console.log('\nMigraciones de campos:');
	await ponerCampoOpcional('cartera_notas', 'tipo');
```

por:

```js
	console.log('\nMigraciones de campos:');
	await ponerCampoOpcional('cartera_notas', 'tipo');
	await agregarCampoSiFalta('cartera_clientes', json('promos'));
	await agregarCampoSiFalta('cartera_clientes', json('connections'));
```

- [ ] **Step 4: Dry-run contra la instancia real**

Run: `node scripts/crear-colecciones-cartera.js --dry-run`
Expected: pide las credenciales del superuser por consola (o las toma de
`PB_SUPERUSER_EMAIL`/`PB_SUPERUSER_PASSWORD`/`PB_TOKEN` si están en el entorno);
en la sección "Migraciones de campos" debe imprimir:
```
- cartera_clientes.promos: SE AGREGARIA.
- cartera_clientes.connections: SE AGREGARIA.
```
Si en cambio dice "ya existe, se saltea" para alguno de los dos, revisar antes de
seguir (puede ser que ya se haya corrido esto antes).

- [ ] **Step 5: Correr de verdad**

Run: `node scripts/crear-colecciones-cartera.js`
Expected: misma salida que el dry-run pero con "agregado." en vez de "SE AGREGARIA.",
y termina con `Listo.`

- [ ] **Step 6: Commit**

```bash
git add scripts/crear-colecciones-cartera.js
git commit -m "feat(cartera): campos promos y connections en cartera_clientes"
```

---

### Task 5: `alertas.js` — `promosActivas` y alerta `promo_venciendo`

**Files:**
- Modify: `src/lib/cartera/alertas.js`
- Test: `src/lib/cartera/alertas.test.js`

- [ ] **Step 1: Escribir los tests que fallan**

En `src/lib/cartera/alertas.test.js`, cambiar el import de la línea 2:

```js
import { alertasDe, diaCorteDe } from './alertas.js';
```

por:

```js
import { alertasDe, diaCorteDe, promosActivas } from './alertas.js';
```

Agregar al final del archivo (después del último `describe('alerta de recordatorio', ...)`):

```js

describe('promosActivas', () => {
	const hoy = { anio: 2026, mes: 8, dia: 4 };

	it('una promo con fin futuro esta activa', () => {
		const r = promosActivas([{ fin: '2026-09-01', promo_nombre: 'A' }], hoy);
		expect(r).toHaveLength(1);
	});

	it('una promo con fin hoy esta activa (borde inclusive)', () => {
		const r = promosActivas([{ fin: '2026-08-04', promo_nombre: 'A' }], hoy);
		expect(r).toHaveLength(1);
	});

	it('una promo con fin pasado no esta activa', () => {
		const r = promosActivas([{ fin: '2026-08-03', promo_nombre: 'A' }], hoy);
		expect(r).toHaveLength(0);
	});

	it('sin promos devuelve un array vacio', () => {
		expect(promosActivas([], hoy)).toEqual([]);
		expect(promosActivas(undefined, hoy)).toEqual([]);
	});

	it('varias activas quedan ordenadas por fin ascendente', () => {
		const r = promosActivas(
			[
				{ fin: '2026-12-01', promo_nombre: 'La lejana' },
				{ fin: '2026-09-01', promo_nombre: 'La cercana' }
			],
			hoy
		);
		expect(r.map((p) => p.promo_nombre)).toEqual(['La cercana', 'La lejana']);
	});
});

describe('alerta de promo por vencer', () => {
	const hoy = { anio: 2026, mes: 8, dia: 4 };

	it('a 15 dias exactos del vencimiento enciende la alerta (borde inclusive)', () => {
		const r = alertasDe(base, hoy, CONFIG, [], [{ fin: '2026-08-19', promo_nombre: 'Promo A' }]);
		expect(tipos(r)).toContain('promo_venciendo');
	});

	it('a 16 dias del vencimiento no enciende la alerta', () => {
		const r = alertasDe(base, hoy, CONFIG, [], [{ fin: '2026-08-20', promo_nombre: 'Promo A' }]);
		expect(tipos(r)).not.toContain('promo_venciendo');
	});

	it('una promo ya vencida no enciende la alerta', () => {
		const r = alertasDe(base, hoy, CONFIG, [], [{ fin: '2026-08-01', promo_nombre: 'Promo vieja' }]);
		expect(tipos(r)).not.toContain('promo_venciendo');
	});

	it('con dos promos activas, la alerta usa la de vencimiento mas proximo', () => {
		const r = alertasDe(base, hoy, CONFIG, [], [
			{ fin: '2026-08-10', promo_nombre: 'La cercana' },
			{ fin: '2026-08-05', promo_nombre: 'La mas cercana' }
		]);
		const promo = r.find((a) => a.tipo === 'promo_venciendo');
		expect(promo.texto).toBe('La mas cercana');
		expect(promo.desde).toBe('2026-08-05');
	});

	it('llamar sin el quinto argumento sigue funcionando y no emite promo_venciendo', () => {
		expect(() => alertasDe(base, hoy, CONFIG, [])).not.toThrow();
		expect(tipos(alertasDe(base, hoy, CONFIG, []))).not.toContain('promo_venciendo');
	});
});
```

- [ ] **Step 2: Correr los tests, confirmar que fallan**

Run: `npx vitest run src/lib/cartera/alertas.test.js`
Expected: FAIL — `promosActivas` no está exportado, y `alertasDe` no acepta un quinto argumento.

- [ ] **Step 3: Implementar `promosActivas` y el quinto parámetro de `alertasDe`**

En `src/lib/cartera/alertas.js`, cambiar el import de fechas (líneas 14-21):

```js
import {
	partesFecha,
	partesFechaHora,
	claveMes,
	sumarMeses,
	compararFechas,
	compararFechaHora
} from './fechas.js';
```

por:

```js
import {
	partesFecha,
	partesFechaHora,
	claveMes,
	sumarMeses,
	compararFechas,
	compararFechaHora,
	diferenciaDias
} from './fechas.js';
```

Agregar, después de `const MESES_SEGUIMIENTO = 2;` (línea 25):

```js

/** Dias de aviso antes del vencimiento de una promo. */
const DIAS_AVISO_PROMO = 15;
```

Agregar, antes de `alertasDe` (después del `@typedef ConfigCartera`, antes de la línea
`export function alertasDe`):

```js
/**
 * Promos activas: `fin` todavia no paso. El arranque futuro cuenta como
 * activa igual — algunas promos se cargan con `promotion_start_date` del mes
 * que viene desde el dia de la instalacion.
 *
 * Toma el array de promos directo (`cliente.promos`), no el cliente entero:
 * mismo criterio que esta funcion recibe `recordatorios` como array.
 *
 * @param {any[]} promos
 * @param {import('./fechas.js').Partes} hoy
 * @returns {any[]} Ordenadas por `fin` ascendente
 */
export function promosActivas(promos, hoy) {
	return (Array.isArray(promos) ? promos : [])
		.map((p) => ({ p, fin: partesFecha(p?.fin) }))
		.filter(({ fin }) => fin && compararFechas(hoy, fin) <= 0)
		.sort((a, b) => compararFechas(a.fin, b.fin))
		.map(({ p }) => p);
}

```

Cambiar la firma y el JSDoc de `alertasDe` (línea 46-60):

```js
/**
 * Alertas activas de un cliente.
 *
 * Toma SOLO el registro del cliente, sin las notas: la lista muestra hasta 500
 * clientes y pedir las notas de cada uno para saber si alguien ya llamo seria
 * una consulta por fila. En su lugar, `cartera_notas` sigue siendo la bitacora
 * completa y `cliente.ultimo_contacto` es la marca que escribe el store cuando
 * el asesor aprieta «Marcar contactado».
 *
 * @param {any} cliente Registro de `cartera_clientes`
 * @param {import('./fechas.js').Partes} hoy
 * @param {ConfigCartera} config
 * @param {any[]} [recordatorios] Recordatorios PENDIENTES del cliente (`hecho = false`)
 * @param {any[]} [promos] `cliente.promos`, sin filtrar por vigencia
 * @returns {{tipo: string, desde: string | null, texto?: string}[]}
 */
export function alertasDe(cliente, hoy, config, recordatorios = [], promos = []) {
```

Agregar, justo antes del `return alertas;` final (después del bloque `// --- Recordatorios ---`):

```js

	// --- Promo por vencer ----------------------------------------------------
	// Una sola alerta con la de vencimiento mas proximo, igual que recordatorio.
	// `promosActivas` es informativa y la usa la UI directo (chip de la lista,
	// seccion del detalle); acá solo se usa para derivar esta alerta puntual.
	const activas = promosActivas(promos, hoy);
	if (activas.length > 0) {
		const proxima = activas[0];
		const fin = partesFecha(proxima.fin);
		if (fin && diferenciaDias(hoy, fin) <= DIAS_AVISO_PROMO) {
			alertas.push({ tipo: 'promo_venciendo', desde: proxima.fin, texto: proxima.promo_nombre });
		}
	}
```

- [ ] **Step 4: Correr los tests, confirmar que pasan**

Run: `npx vitest run src/lib/cartera/alertas.test.js`
Expected: PASS (todos, incluidos los ya existentes)

- [ ] **Step 5: Commit**

```bash
git add src/lib/cartera/alertas.js src/lib/cartera/alertas.test.js
git commit -m "feat(cartera): promosActivas y alerta promo_venciendo"
```

---

### Task 6: `carteraStore.svelte.js` — pasar `promos` a `alertasDeCliente`

**Files:**
- Modify: `src/routes/admin/_components/mantenimiento/Dashboard/cartera/carteraStore.svelte.js:178-180`

No hay archivo de test para este store (confirmado: no existe ningún `*.test.js` en esta
carpeta). Se verifica junto con la Task 7/8 en el navegador.

- [ ] **Step 1: Pasar el quinto argumento**

Reemplazar:

```js
function alertasDeCliente(cliente) {
	return alertasDe(cliente, hoyPartes(), config, recordatoriosDe(cliente.id));
}
```

por:

```js
function alertasDeCliente(cliente) {
	return alertasDe(cliente, hoyPartes(), config, recordatoriosDe(cliente.id), cliente.promos ?? []);
}
```

- [ ] **Step 2: Correr la suite completa para confirmar que nada se rompió**

Run: `npx vitest run src/lib/cartera`
Expected: PASS (todos)

- [ ] **Step 3: Commit**

```bash
git add src/routes/admin/_components/mantenimiento/Dashboard/cartera/carteraStore.svelte.js
git commit -m "feat(cartera): alertasDeCliente pasa cliente.promos a alertasDe"
```

---

### Task 7: `Cartera.svelte` — chips de promo en la lista

**Files:**
- Modify: `src/routes/admin/_components/mantenimiento/Dashboard/cartera/Cartera.svelte`

Sin tests de componente (no hay en este proyecto, ver spec). Se verifica a mano en el
navegador al final de este task.

- [ ] **Step 1: Import de `promosActivas`**

Reemplazar la línea 10:

```js
import { diaCorteDe } from '$lib/cartera/alertas.js';
```

por:

```js
import { diaCorteDe, promosActivas } from '$lib/cartera/alertas.js';
```

- [ ] **Step 2: `hoyPartes()` local**

Agregar después de `let configurando = $state(false);` (línea 21), antes del bloque de
`errorDescartado`/`ultimoError`:

```js

/** Partes de la fecha de hoy, en hora local. */
function hoyPartes() {
	const d = new Date();
	return { anio: d.getFullYear(), mes: d.getMonth() + 1, dia: d.getDate() };
}
```

- [ ] **Step 3: `PESO`, `conAlertas` con `promoTexto`, `ETIQUETAS`, `FILTROS`**

Reemplazar:

```js
const PESO = { mora_2: 3, mora_1: 2, tickets: 2, recordatorio: 2, seguimiento: 1 };
```

por:

```js
const PESO = { mora_2: 3, mora_1: 2, tickets: 2, recordatorio: 2, promo_venciendo: 2, seguimiento: 1 };
```

Reemplazar el bloque `conAlertas` (líneas 67-72):

```js
const conAlertas = $derived(
    clientes.map((c) => {
        const alertas = carteraStore.alertasDeCliente(c);
        return { cliente: c, alertas, urgencia: urgenciaDe(alertas) };
    })
);
```

por:

```js
// `promoTexto` es informativo, no una alerta: no pasa por alertasDeCliente ni
// suma a la urgencia (un cliente con una promo que vence en 8 meses no tiene
// nada urgente por eso). Se calcula en el mismo derived que ya arma
// conAlertas para no recorrer la lista de clientes dos veces.
const conAlertas = $derived.by(() => {
    const hoy = hoyPartes();
    return clientes.map((c) => {
        const alertas = carteraStore.alertasDeCliente(c);
        const activas = promosActivas(c.promos ?? [], hoy);
        return {
            cliente: c,
            alertas,
            urgencia: urgenciaDe(alertas),
            promoTexto: activas.length > 0 ? activas[0].promo_nombre : null
        };
    });
});
```

Reemplazar:

```js
const ETIQUETAS = {
    seguimiento: 'Contactar (2 meses)',
    mora_1: 'No pagó',
    mora_2: 'Mora vencida',
    tickets: 'Tickets nuevos',
    recordatorio: 'Recordatorio'
};
```

por:

```js
const ETIQUETAS = {
    seguimiento: 'Contactar (2 meses)',
    mora_1: 'No pagó',
    mora_2: 'Mora vencida',
    tickets: 'Tickets nuevos',
    recordatorio: 'Recordatorio',
    promo_venciendo: 'Promo por vencer'
};
```

Reemplazar `FILTROS` (líneas 74-81):

```js
const FILTROS = [
    { value: 'todos', label: 'Todos' },
    { value: 'alerta', label: 'Con alerta' },
    { value: 'seguimiento', label: 'Seguimiento 2 meses' },
    { value: 'mora', label: 'En mora' },
    { value: 'tickets', label: 'Tickets nuevos' },
    { value: 'recordatorio', label: 'Recordatorios' }
];
```

por:

```js
const FILTROS = [
    { value: 'todos', label: 'Todos' },
    { value: 'alerta', label: 'Con alerta' },
    { value: 'seguimiento', label: 'Seguimiento 2 meses' },
    { value: 'mora', label: 'En mora' },
    { value: 'tickets', label: 'Tickets nuevos' },
    { value: 'recordatorio', label: 'Recordatorios' },
    { value: 'promo_venciendo', label: 'Promos por vencer' }
];
```

(el filtro cae en la rama genérica `alertas.some((a) => a.tipo === filtro)` que ya existe
en `visibles`, línea 91 — no hace falta tocar esa función)

- [ ] **Step 4: Template — chip `.promo` y `title` del chip `promo_venciendo`**

Reemplazar el `{#each visibles as ...}` (línea 212) para incluir `promoTexto`:

```svelte
{#each visibles as { cliente, alertas, urgencia, promoTexto } (cliente.id)}
```

Reemplazar el bloque `.alertas` del template (líneas 228-248):

```svelte
                        <div class="alertas">
                            {#each alertas as a}
                                <span
                                    class="chip {a.tipo}"
                                    title={a.tipo === 'recordatorio' ? a.texto : null}
                                >
                                    {#if a.tipo === 'recordatorio'}
                                        <!-- El "Recordatorio:" va oculto y no escrito como en
                                             el detalle: aca el chip esta recortado a 14em y el
                                             prefijo se comeria la mitad del texto util. Pero
                                             sin el, un lector de pantalla lee "Llamar por el
                                             router" sin decir que es un recordatorio, y el
                                             color no le sirve de nada. -->
                                        <span class="sr-only">Recordatorio:</span>
                                        {a.texto || ETIQUETAS.recordatorio}
                                    {:else}
                                        {ETIQUETAS[a.tipo]}
                                    {/if}
                                </span>
                            {/each}
                        </div>
```

por:

```svelte
                        <div class="alertas">
                            {#if promoTexto}
                                <span class="chip promo" title={promoTexto}>{promoTexto}</span>
                            {/if}
                            {#each alertas as a}
                                <span
                                    class="chip {a.tipo}"
                                    title={a.tipo === 'recordatorio' || a.tipo === 'promo_venciendo' ? a.texto : null}
                                >
                                    {#if a.tipo === 'recordatorio'}
                                        <!-- El "Recordatorio:" va oculto y no escrito como en
                                             el detalle: aca el chip esta recortado a 14em y el
                                             prefijo se comeria la mitad del texto util. Pero
                                             sin el, un lector de pantalla lee "Llamar por el
                                             router" sin decir que es un recordatorio, y el
                                             color no le sirve de nada. -->
                                        <span class="sr-only">Recordatorio:</span>
                                        {a.texto || ETIQUETAS.recordatorio}
                                    {:else}
                                        {ETIQUETAS[a.tipo]}
                                    {/if}
                                </span>
                            {/each}
                        </div>
```

- [ ] **Step 5: CSS — `.chip.promo` y `.chip.promo_venciendo`**

Reemplazar:

```css
.chip.tickets { background: #dbeafe; color: #1e40af; }
```

por:

```css
.chip.tickets { background: #dbeafe; color: #1e40af; }
/* Cyan/teal: nuevo, no lo usa ningun otro chip. Distinto del verde de
   recordatorio -que significa "lo cargo el asesor"-, esto es informativo,
   deducido de IspCube. */
.chip.promo {
    background: #cffafe; color: #155e75;
    display: inline-block; max-width: 14em;
    overflow: hidden; text-overflow: ellipsis;
}
/* Mismo amber que mora_1: "atender pronto", no una falla ya consumada como mora_2. */
.chip.promo_venciendo { background: #fef3c7; color: #92400e; }
```

- [ ] **Step 6: Verificación manual en el navegador**

Iniciar el server de dev y abrir la Cartera:

```bash
npm run dev
```

En el navegador: abrir `/admin` → Cartera de clientes. Confirmar:
- Un cliente con `promos` en su registro (si no hay ninguno todavía en la base, se
  puede simular editando un registro en el admin de PocketBase y agregándole un array
  en `promos` con un objeto `{ fin: "<fecha futura>", promo_nombre: "Prueba" }`) muestra
  el chip cyan con el nombre de la promo.
- Si la fecha de esa promo está a ≤15 días, además aparece el chip amber "Promo por
  vencer", y el filtro "Promos por vencer" lo encuentra.
- Ningún chip existente (`seguimiento`, `mora_1`, `mora_2`, `tickets`, `recordatorio`)
  cambió de aspecto ni de comportamiento.

- [ ] **Step 7: Commit**

```bash
git add src/routes/admin/_components/mantenimiento/Dashboard/cartera/Cartera.svelte
git commit -m "feat(cartera): chip de promo activa y promo_venciendo en la lista"
```

---

### Task 8: `ClienteDetalle.svelte` — chips de conexión, alerta y "Promos activas"

**Files:**
- Modify: `src/routes/admin/_components/mantenimiento/Dashboard/cartera/ClienteDetalle.svelte`

Sin tests de componente. Se verifica a mano en el navegador al final de este task.

- [ ] **Step 1: Imports**

Reemplazar:

```js
import { diaCorteDe } from '$lib/cartera/alertas.js';
import { partesFecha } from '$lib/cartera/fechas.js';
```

por:

```js
import { diaCorteDe, promosActivas } from '$lib/cartera/alertas.js';
import { partesFecha } from '$lib/cartera/fechas.js';
import { nombreCortoPlan } from '$lib/cartera/planes.js';
```

- [ ] **Step 2: `hoy` compartido, y `activas` (promos activas)**

Reemplazar el bloque `puntos` (líneas 21-32):

```js
const puntos = $derived.by(() => {
    const instalacion = partesFecha(actual.fecha_instalacion);
    if (!instalacion) return [];
    const d = new Date();
    return puntosPorMes(actual.pagos ?? [], {
        perfil: actual.perfil_pago,
        diaCorte: diaCorteDe(actual.perfil_pago, config),
        instalacion,
        hoy: { anio: d.getFullYear(), mes: d.getMonth() + 1, dia: d.getDate() },
        meses: 6
    });
});
```

por:

```js
// Partes de "hoy" en hora local, compartido entre `puntos` y `activas` (las
// promos activas de mas abajo): no hace falta una segunda fuente de "hoy" en
// el mismo componente.
const hoy = $derived.by(() => {
    const d = new Date();
    return { anio: d.getFullYear(), mes: d.getMonth() + 1, dia: d.getDate() };
});

const puntos = $derived.by(() => {
    const instalacion = partesFecha(actual.fecha_instalacion);
    if (!instalacion) return [];
    return puntosPorMes(actual.pagos ?? [], {
        perfil: actual.perfil_pago,
        diaCorte: diaCorteDe(actual.perfil_pago, config),
        instalacion,
        hoy,
        meses: 6
    });
});

const activas = $derived(promosActivas(actual.promos ?? [], hoy));
```

- [ ] **Step 3: `fmtFecha` local**

Agregar después de la declaración de `plata` (línea 64), antes de `datosDe`:

```js

// Formateo por partes, sin `new Date(iso)`: un "2026-08-04" pasado por Date se
// interpreta en UTC y en Argentina (UTC-3) se muestra como el 3. Mismo motivo
// que el resto de fechas.js, y el mismo patron que ya usa RecordatorioChip.
// Un solo fmtFecha para la rama de alerta promo_venciendo y la seccion de
// promos activas de mas abajo.
function fmtFecha(iso) {
    const p = partesFecha(iso);
    if (!p) return iso;
    return `${String(p.dia).padStart(2, '0')}/${String(p.mes).padStart(2, '0')}/${p.anio}`;
}
```

- [ ] **Step 4: Rama `promo_venciendo` en el bloque de alertas**

Reemplazar el `{#each alertas as a}` (líneas 135-146):

```svelte
                {#each alertas as a}
                    {#if a.tipo === 'seguimiento'}
                        <span class="chip seguimiento">
                            {ETIQUETA_ALERTA.seguimiento}
                            <button class="marcar" onclick={marcarContactado} disabled={marcando}>
                                {marcando ? 'Guardando…' : 'Marcar contactado'}
                            </button>
                        </span>
                    {:else}
                        <span class="chip {a.tipo}">{ETIQUETA_ALERTA[a.tipo] ?? a.tipo}</span>
                    {/if}
                {/each}
```

por:

```svelte
                {#each alertas as a}
                    {#if a.tipo === 'seguimiento'}
                        <span class="chip seguimiento">
                            {ETIQUETA_ALERTA.seguimiento}
                            <button class="marcar" onclick={marcarContactado} disabled={marcando}>
                                {marcando ? 'Guardando…' : 'Marcar contactado'}
                            </button>
                        </span>
                    {:else if a.tipo === 'promo_venciendo'}
                        <span class="chip promo_venciendo">{a.texto} vence el {fmtFecha(a.desde)}</span>
                    {:else}
                        <span class="chip {a.tipo}">{ETIQUETA_ALERTA[a.tipo] ?? a.tipo}</span>
                    {/if}
                {/each}
```

- [ ] **Step 5: Bloque `.conexiones` entre `.alertas` y `<dl class="datos">`**

Insertar entre el `{/if}` que cierra el bloque `{#if errorAlerta}` (línea 148) y
`<dl class="datos">` (línea 151):

```svelte
        {#if (actual.connections?.length ?? 0) > 0}
            <div class="conexiones">
                {#each actual.connections as cx}
                    <span class="chip conexion" title={cx.plan_nombre}>
                        {nombreCortoPlan(cx.plan_id, cx.plan_nombre)}
                    </span>
                {/each}
            </div>
        {:else}
            <div class="conexiones">
                <span class="chip conexion vacia">Sin conexiones</span>
            </div>
        {/if}
```

- [ ] **Step 6: Sección "Promos activas" entre Pagos y `AnotacionesCliente`**

Insertar entre el `</section>` que cierra la sección de Pagos (línea 179) y
`<AnotacionesCliente {cliente} />` (línea 181):

```svelte
        {#if activas.length > 0}
            <section class="bloque">
                <h4>Promos activas</h4>
                <ul class="promos">
                    {#each activas as p}
                        <li>
                            <strong>{p.promo_nombre}</strong>
                            {#if p.plan_nombre}<span class="plan">{p.plan_nombre}</span>{/if}
                            {#if p.beneficio}<p class="beneficio">{p.beneficio}</p>{/if}
                            <span class="vence">vence el {fmtFecha(p.fin)}</span>
                        </li>
                    {/each}
                </ul>
            </section>
        {/if}
```

- [ ] **Step 7: CSS**

Reemplazar:

```css
.chip.tickets { background: #dbeafe; color: #1e40af; }
```

por:

```css
.chip.tickets { background: #dbeafe; color: #1e40af; }
/* Mismo amber que mora_1: "atender pronto", no una falla ya consumada. */
.chip.promo_venciendo { background: #fef3c7; color: #92400e; }
```

Agregar al final del bloque `<style>`, después de `.archivar { ... }`:

```css
/* Indigo: distinto del violeta de .chip.seguimiento (#ede7f6/#5a1e7a), para
   que un chip de plan no se confunda con la alerta de seguimiento. */
.conexiones { display: flex; flex-wrap: wrap; gap: 0.5em; margin: 0.8em 0 0; }
.chip.conexion {
    background: #e0e7ff; color: #3730a3;
    display: inline-block; max-width: 12em;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.chip.conexion.vacia { background: #f3f4f6; color: #6b7280; }
.promos { list-style: none; padding: 0; margin: 1em 0 0; display: flex; flex-direction: column; gap: 0.8em; }
.promos li { background: #ecfeff; border-radius: 0.8em; padding: 0.8em 1.1em; }
.promos strong { color: #155e75; }
.promos .plan { color: #6b7280; font-size: 0.85em; margin-left: 0.5em; }
.promos .beneficio { margin: 0.3em 0 0; color: #374151; font-size: 0.9em; }
.promos .vence { display: block; color: #9ca3af; font-size: 0.8em; margin-top: 0.3em; }
```

- [ ] **Step 8: Correr la suite completa para confirmar que nada se rompió**

Run: `npx vitest run src/lib/cartera`
Expected: PASS (todos)

- [ ] **Step 9: Verificación manual en el navegador**

```bash
npm run dev
```

En el navegador: abrir un cliente de la Cartera y confirmar:
- Con `connections` cargado en el registro (editable a mano en el admin de
  PocketBase si todavía no hay datos reales: `[{ "plan_id": 27, "plan_nombre":
  "Servicio de Internet basico POWER F131" }]`), aparecen los chips de plan arriba
  del `<dl>` de Medio de pago/Cuenta, con el nombre completo en el `title` al pasar
  el mouse.
- Sin `connections` (o array vacío), aparece el chip gris "Sin conexiones".
- Con `promos` cargado con una promo activa a ≤15 días, aparece la alerta
  `promo_venciendo` en `.alertas` con el texto "`<nombre>` vence el DD/MM/AAAA", y
  la sección "Promos activas" entre Pagos y las anotaciones, con nombre, plan,
  beneficio y fecha de vencimiento.
- Sin promos activas, la sección "Promos activas" no se renderiza.
- El chip de recordatorio en el header (`RecordatorioChip`, ya existente) y el resto
  del detalle no cambiaron.

- [ ] **Step 10: Commit**

```bash
git add src/routes/admin/_components/mantenimiento/Dashboard/cartera/ClienteDetalle.svelte
git commit -m "feat(cartera): chips de conexion, alerta promo_venciendo y seccion de promos activas en el detalle"
```

---

## Resumen de verificación final

- [ ] `npx vitest run src/lib/cartera` — todo verde (baseline 180 tests + los nuevos de
      este plan: 6 de `diferenciaDias`, 9 de `normalizarCliente`/connections-promos, 4 de
      `planes.js`, 11 de `promosActivas`/`promo_venciendo`).
- [ ] `node scripts/crear-colecciones-cartera.js --dry-run` corrido contra la instancia
      real una vez más, sin pendientes.
- [ ] Recorrido manual en el navegador de la lista y el detalle, con al menos un
      cliente con `connections` y `promos` cargados, cubriendo los casos del Step 6
      (Task 7) y el Step 9 (Task 8).
