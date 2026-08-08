# Cartera: escrituras en lote contra PocketBase — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bajar de 23 a 3 los requests que la Cartera hace a PocketBase en cada apertura, agrupando las escrituras en un solo lote y cacheando `cartera_config` por sesión.

**Architecture:** Se extrae el cálculo del parche del snapshot a una función pura (`src/lib/cartera/parche.js`) para que el store pueda armar los 20 parches antes de escribirlos. Un módulo nuevo (`src/lib/pbLote.js`) manda esas escrituras por la Batch API de PocketBase y **degrada a escrituras una por una** si el lote falla o si la Batch API está apagada en el servidor — así el lote es siempre una optimización y nunca un requisito. `cartera_config` pasa a leerse una vez por sesión desde `sessionStorage`.

**Tech Stack:** SvelteKit 2 + Svelte 5 (runes), `pocketbase@0.22.1` (ya trae `pb.createBatch()`), vitest (`environment: 'node'`).

**Spec:** `docs/superpowers/specs/2026-08-08-cartera-escrituras-en-lote-design.md`

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/lib/cartera/parche.js` *(nuevo)* | Función pura: de `(actual, datos, config, hoy)` al objeto que se escribe en `cartera_clientes`. Toda la lógica de transición de `instalado_aviso`, `alta_nap` y `fecha_instalacion`. |
| `src/lib/cartera/parche.test.js` *(nuevo)* | Tests de lo anterior, sin PocketBase. |
| `src/lib/pbLote.js` *(nuevo)* | `escribirLote(pb, operaciones)`: batch con degradación a una-por-una. No sabe nada de la Cartera. |
| `src/lib/pbLote.test.js` *(nuevo)* | Tests con un `pb` falso. |
| `src/lib/cartera/configCache.js` *(nuevo)* | Leer/guardar/olvidar `cartera_config` en un `Storage`. |
| `src/lib/cartera/configCache.test.js` *(nuevo)* | Tests con un `Storage` falso. |
| `carteraStore.svelte.js` *(modificar)* | Usa las tres piezas. Pierde `guardarSnapshot`. |
| `CarteraConfig.svelte` *(modificar)* | Invalida el caché de config al guardar. |

**Nota sobre `pb` como parámetro:** `escribirLote` recibe el cliente de PocketBase en vez de importarlo de `$lib/pocketbase`. Es el mismo criterio que ya usa `src/lib/server/` (módulos puros que no importan sus dependencias, ver el spec de la Fase 1): permite testear con un objeto falso sin `vi.mock` ni depender de que el alias `$lib` resuelva dentro de un mock.

---

### Task 1: `construirParche` — extraer el cálculo del snapshot

Refactor puro: al terminar esta tarea el comportamiento es idéntico, pero la lógica queda testeable y lista para batchear.

**Files:**
- Create: `src/lib/cartera/parche.js`
- Test: `src/lib/cartera/parche.test.js`
- Modify: `src/routes/admin/_components/mantenimiento/Dashboard/cartera/carteraStore.svelte.js:482-550`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/cartera/parche.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { construirParche } from './parche.js';

const HOY = { anio: 2026, mes: 8, dia: 8 };
const CONFIG = { entidades_tarjeta: [7], areas_soporte: [], estados_cerrados: [] };

/** Un cliente en el estado 'pendiente_pago': sin conexiones, sin alta_nap. */
const clienteBase = (extra = {}) => ({
	id: 'rec1',
	code: '001',
	perfil_manual: false,
	perfil_pago: 'ventanilla',
	connections: [],
	alta_nap: null,
	fecha_instalacion: '',
	pagos: [],
	...extra
});

/** Datos de /sync que dejan al cliente 'instalado'. */
const datosInstalado = (extra = {}) => ({
	nombre: 'PEREZ JUAN',
	doc_number: '20123456',
	ciudad: 'PUNTA LARA',
	estado: 'activo',
	start_date: '2026-07-01',
	entity_id: 3,
	entity_nombre: 'CAJA',
	debt: 0,
	duedebt: 0,
	connections: [{ id: 1 }],
	promos: [],
	alta_nap: { existe: true, cerrado: true, anulado: false, closed_date: '2026-08-05' },
	...extra
});

describe('construirParche', () => {
	it('prende instalado_aviso en la transicion a instalado', () => {
		const p = construirParche(clienteBase(), datosInstalado(), CONFIG, HOY);
		expect(p.instalado_aviso).toBe(true);
	});

	it('apaga instalado_aviso si ya estaba instalado', () => {
		const actual = clienteBase({
			connections: [{ id: 1 }],
			alta_nap: { existe: true, cerrado: true, anulado: false, closed_date: '2026-08-05' }
		});
		const p = construirParche(actual, datosInstalado(), CONFIG, HOY);
		expect(p.instalado_aviso).toBe(false);
	});

	it('sella fecha_instalacion con closed_date en la transicion', () => {
		const p = construirParche(clienteBase(), datosInstalado(), CONFIG, HOY);
		expect(p.fecha_instalacion).toBe('2026-08-05');
	});

	it('no pisa una fecha_instalacion que ya estaba cargada', () => {
		const p = construirParche(
			clienteBase({ fecha_instalacion: '2026-01-01' }),
			datosInstalado(),
			CONFIG,
			HOY
		);
		expect(p.fecha_instalacion).toBeUndefined();
	});

	it('conserva el alta_nap guardado si /sync no trajo tickets', () => {
		const guardada = { existe: true, cerrado: false, anulado: false, closed_date: '' };
		const p = construirParche(
			clienteBase({ alta_nap: guardada }),
			datosInstalado({ alta_nap: undefined }),
			CONFIG,
			HOY
		);
		expect(p.alta_nap).toEqual(guardada);
	});

	it('sin alta_nap en ningun lado usa el vacio, no null', () => {
		const p = construirParche(clienteBase(), datosInstalado({ alta_nap: undefined }), CONFIG, HOY);
		expect(p.alta_nap).toEqual({ existe: false, cerrado: false, anulado: false, closed_date: '' });
	});

	it('con perfil_manual respeta el perfil guardado', () => {
		const actual = clienteBase({ perfil_manual: true, perfil_pago: 'tarjeta' });
		const p = construirParche(actual, datosInstalado({ entity_id: 3 }), CONFIG, HOY);
		expect(p.perfil_pago).toBe('tarjeta');
	});

	it('sin perfil_manual recalcula el perfil con la config', () => {
		const p = construirParche(clienteBase(), datosInstalado({ entity_id: 7 }), CONFIG, HOY);
		expect(p.perfil_pago).toBe('tarjeta');
	});

	it('siempre apaga el flag nuevo', () => {
		const p = construirParche(clienteBase(), datosInstalado(), CONFIG, HOY);
		expect(p.nuevo).toBe(false);
	});

	it('no incluye pagos ni tickets si /sync no los trajo', () => {
		const p = construirParche(clienteBase(), datosInstalado(), CONFIG, HOY);
		expect(p).not.toHaveProperty('pagos');
		expect(p).not.toHaveProperty('tickets');
	});

	it('normaliza connections y promos a array', () => {
		const p = construirParche(
			clienteBase(),
			datosInstalado({ connections: null, promos: undefined }),
			CONFIG,
			HOY
		);
		expect(p.connections).toEqual([]);
		expect(p.promos).toEqual([]);
	});
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx vitest run src/lib/cartera/parche.test.js`
Expected: FAIL — `Failed to resolve import "./parche.js"`.

- [ ] **Step 3: Escribir `src/lib/cartera/parche.js`**

Este código sale tal cual de `guardarSnapshot` (`carteraStore.svelte.js:486-542`). Los comentarios se mudan con él: explican decisiones que no se deducen del código.

```js
/**
 * El parche que se escribe en `cartera_clientes` a partir de lo que devolvio
 * `/api/cartera/sync` para un cliente.
 *
 * Vive separado del store por dos motivos. Uno, es la logica con mas sutileza
 * del sync -la transicion de `instalado_aviso`- y aca se puede testear sin
 * PocketBase de por medio. Dos, el store necesita armar todos los parches
 * ANTES de escribir ninguno, para poder mandarlos en un solo lote.
 */
import { perfilDe } from './normalizar.js';
import { estadoInstalacionDe } from './instalacion.js';
import { fusionarPagos } from './pagos.js';

/**
 * @param {any} actual Registro de `cartera_clientes` tal cual esta en el store
 * @param {any} datos Datos frescos de `/api/cartera/sync` para ese code
 * @param {any} config Config normalizada de la cartera
 * @param {{anio: number, mes: number, dia: number}} hoy
 * @returns {Record<string, any>}
 */
export function construirParche(actual, datos, config, hoy) {
	const perfil = actual.perfil_manual
		? actual.perfil_pago
		: perfilDe(datos.entity_id, config.entidades_tarjeta, datos.comercial_activity);

	const connections = Array.isArray(datos.connections) ? datos.connections : [];
	// `datos.alta_nap` puede faltar si `/sync` no pudo traer tickets esta vez
	// (IspCube caido puntual): se conserva el ultimo valor conocido en vez de
	// perderlo.
	const altaNap = datos.alta_nap ??
		actual.alta_nap ?? { existe: false, cerrado: false, anulado: false, closed_date: '' };

	// La transicion se detecta comparando el estado ANTES de este parche contra
	// el que resulta de aplicarlo. La formula se escribe en CADA sync, nunca
	// solo cuando da true: la sync siguiente a una transicion encuentra
	// `estadoViejo === 'instalado'` (porque ya quedo guardado asi) y da false
	// sola, sin logica de "apagar" aparte.
	const estadoViejo = estadoInstalacionDe(actual);
	const estadoNuevo = estadoInstalacionDe({ connections, alta_nap: altaNap });
	const instaladoAviso = estadoNuevo === 'instalado' && estadoViejo !== 'instalado';

	const parche = {
		nombre: datos.nombre,
		// Si la coleccion todavia no tiene estos dos campos, PocketBase ignora
		// las claves extra y el update pasa igual: se pueden desplegar el codigo
		// y el cambio de schema en cualquier orden.
		doc_number: datos.doc_number,
		ciudad: datos.ciudad,
		estado: datos.estado,
		start_date: datos.start_date,
		entity_id: datos.entity_id,
		entity_nombre: datos.entity_nombre,
		perfil_pago: perfil,
		debt: datos.debt,
		duedebt: datos.duedebt,
		connections,
		promos: Array.isArray(datos.promos) ? datos.promos : [],
		alta_nap: altaNap,
		// Mismo mecanismo exacto que instalado_aviso: se escribe false en cada
		// sync sin condicion, asi que la primera sync despues de crearse (con
		// nuevo:true) lo apaga sola.
		nuevo: false,
		instalado_aviso: instaladoAviso,
		sincronizado: new Date().toISOString()
	};

	if (instaladoAviso && !actual.fecha_instalacion) {
		parche.fecha_instalacion = altaNap.closed_date;
	}

	if (datos.pagos) {
		parche.pagos = fusionarPagos(actual.pagos, datos.pagos, hoy);
	}
	if (datos.tickets) parche.tickets = datos.tickets;

	return parche;
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npx vitest run src/lib/cartera/parche.test.js`
Expected: PASS, 11 tests.

- [ ] **Step 5: Hacer que el store use `construirParche`**

En `carteraStore.svelte.js`, agregar el import junto a los otros de `$lib/cartera/` (después de la línea 16, `import { CONFIG_DEFAULT, normalizarConfig } ...`):

```js
import { construirParche } from '$lib/cartera/parche.js';
```

Reemplazar el cuerpo entero de `guardarSnapshot` (líneas 482-550) por:

```js
async function guardarSnapshot(code, datos) {
	const actual = clientes.find((c) => c.code === code);
	if (!actual) return;

	const parche = construirParche(actual, datos, config, hoyPartes());

	try {
		const guardado = await pb.collection(CLIENTES).update(actual.id, parche);
		clientes = clientes.map((c) => (c.id === guardado.id ? guardado : c));
	} catch (e) {
		console.error('[cartera] no se pudo guardar el snapshot de', code, e);
	}
}
```

Quitar de los imports del store los que ya no use nadie más en el archivo. Verificar con:

```bash
grep -n "perfilDe\|estadoInstalacionDe\|fusionarPagos" src/routes/admin/_components/mantenimiento/Dashboard/cartera/carteraStore.svelte.js
```

Si un símbolo solo aparece en su línea de `import`, borrar ese import.

- [ ] **Step 6: Correr toda la suite**

Run: `npm test`
Expected: PASS. Ningún test existente debe cambiar de resultado — este paso es refactor puro.

- [ ] **Step 7: Commit**

```bash
git add src/lib/cartera/parche.js src/lib/cartera/parche.test.js src/routes/admin/_components/mantenimiento/Dashboard/cartera/carteraStore.svelte.js
git commit -m "refactor(cartera): extraer construirParche del store"
```

---

### Task 2: `escribirLote` — batch con degradación

**Files:**
- Create: `src/lib/pbLote.js`
- Test: `src/lib/pbLote.test.js`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/pbLote.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { escribirLote, reiniciarDeteccionDeLote } from './pbLote.js';

/**
 * Un `pb` falso. `batch` decide que hace `send()`: devolver resultados o
 * tirar un error. `sueltas` registra las escrituras una-por-una.
 */
function pbFalso({ batchSend, updateSuelta } = {}) {
	const registro = { opsDelLote: [], sueltas: [], lotesEnviados: 0 };

	const pb = {
		createBatch() {
			const ops = [];
			const sub = {
				create: (datos) => ops.push({ accion: 'create', datos }),
				update: (id, datos) => ops.push({ accion: 'update', id, datos })
			};
			return {
				collection: () => sub,
				send: async () => {
					registro.lotesEnviados++;
					registro.opsDelLote.push(ops);
					if (!batchSend) throw Object.assign(new Error('sin batch'), { status: 400 });
					return batchSend(ops);
				}
			};
		},
		collection: () => ({
			create: async (datos) => {
				registro.sueltas.push({ accion: 'create', datos });
				return { id: 'nuevo', ...datos };
			},
			update: async (id, datos) => {
				registro.sueltas.push({ accion: 'update', id, datos });
				if (updateSuelta) return updateSuelta(id, datos);
				return { id, ...datos };
			}
		})
	};

	return { pb, registro };
}

const ops = (n) =>
	Array.from({ length: n }, (_, i) => ({
		coleccion: 'cartera_clientes',
		accion: 'update',
		id: `rec${i}`,
		datos: { nombre: `N${i}` }
	}));

describe('escribirLote', () => {
	beforeEach(() => reiniciarDeteccionDeLote());

	it('manda un solo lote y devuelve los registros', async () => {
		const { pb, registro } = pbFalso({
			batchSend: (o) => o.map((x) => ({ status: 200, body: { id: x.id, ...x.datos } }))
		});

		const r = await escribirLote(pb, ops(3));

		expect(registro.lotesEnviados).toBe(1);
		expect(registro.sueltas).toHaveLength(0);
		expect(r).toEqual([
			{ ok: true, record: { id: 'rec0', nombre: 'N0' } },
			{ ok: true, record: { id: 'rec1', nombre: 'N1' } },
			{ ok: true, record: { id: 'rec2', nombre: 'N2' } }
		]);
	});

	it('parte en trozos de 20', async () => {
		const { pb, registro } = pbFalso({
			batchSend: (o) => o.map((x) => ({ status: 200, body: { id: x.id } }))
		});

		const r = await escribirLote(pb, ops(45));

		expect(registro.lotesEnviados).toBe(3);
		expect(registro.opsDelLote.map((o) => o.length)).toEqual([20, 20, 5]);
		expect(r).toHaveLength(45);
	});

	it('si el lote falla, reescribe una por una', async () => {
		const { pb, registro } = pbFalso();

		const r = await escribirLote(pb, ops(3));

		expect(registro.lotesEnviados).toBe(1);
		expect(registro.sueltas).toHaveLength(3);
		expect(r.every((x) => x.ok)).toBe(true);
	});

	it('una escritura suelta que falla no tumba a las demas', async () => {
		const { pb } = pbFalso({
			updateSuelta: (id) => {
				if (id === 'rec1') throw Object.assign(new Error('regla'), { status: 403 });
				return { id };
			}
		});

		const r = await escribirLote(pb, ops(3));

		expect(r[0].ok).toBe(true);
		expect(r[1].ok).toBe(false);
		expect(r[1].operacion.id).toBe('rec1');
		expect(r[2].ok).toBe(true);
	});

	it('con la Batch API apagada no reintenta el lote en la misma sesion', async () => {
		const { pb, registro } = pbFalso({
			batchSend: () => {
				throw Object.assign(new Error('Batch requests are not allowed.'), { status: 403 });
			}
		});

		await escribirLote(pb, ops(2));
		await escribirLote(pb, ops(2));

		expect(registro.lotesEnviados).toBe(1);
		expect(registro.sueltas).toHaveLength(4);
	});

	it('un fallo que no es 403 si deja reintentar el lote despues', async () => {
		const { pb, registro } = pbFalso();

		await escribirLote(pb, ops(1));
		await escribirLote(pb, ops(1));

		expect(registro.lotesEnviados).toBe(2);
	});

	it('con la lista vacia no toca PocketBase', async () => {
		const { pb, registro } = pbFalso();

		const r = await escribirLote(pb, []);

		expect(r).toEqual([]);
		expect(registro.lotesEnviados).toBe(0);
		expect(registro.sueltas).toHaveLength(0);
	});

	it('arma creates y updates en el mismo lote', async () => {
		const { pb, registro } = pbFalso({
			batchSend: (o) => o.map(() => ({ status: 200, body: {} }))
		});

		await escribirLote(pb, [
			{ coleccion: 'cartera_clientes', accion: 'create', datos: { code: '9' } },
			{ coleccion: 'cartera_clientes', accion: 'update', id: 'rec0', datos: { nombre: 'X' } }
		]);

		expect(registro.opsDelLote[0]).toEqual([
			{ accion: 'create', datos: { code: '9' } },
			{ accion: 'update', id: 'rec0', datos: { nombre: 'X' } }
		]);
	});
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx vitest run src/lib/pbLote.test.js`
Expected: FAIL — `Failed to resolve import "./pbLote.js"`.

- [ ] **Step 3: Escribir `src/lib/pbLote.js`**

```js
/**
 * Escrituras agrupadas contra PocketBase, con degradacion.
 *
 * La Batch API de PocketBase manda N escrituras en UN request, que es el
 * motivo de existir de este modulo: la Cartera hacia 20 `update()` sueltos por
 * apertura y agotaba el limite de requests por IP de PocketHost.
 *
 * Pero el lote es TRANSACCIONAL: si una de las 20 escrituras falla, se
 * revierten las 20 y vuelve un error. El codigo que lo usa necesita lo
 * contrario -que una escritura rota no se lleve puestas a las demas-, asi que
 * ante cualquier fallo del lote se rehace la tanda una por una, que es
 * exactamente lo que se hacia antes.
 *
 * De ahi la propiedad importante: el lote es una optimizacion, nunca un
 * requisito. Si la Batch API esta apagada en el servidor (responde
 * `403 "Batch requests are not allowed."`, que es lo que responde hoy
 * sista.pockethost.io) todo sigue funcionando igual que siempre, solo que sin
 * el ahorro.
 */

/**
 * Tope de escrituras por lote. PocketBase topea el batch en 50 por defecto
 * (`maxRequests` en Settings); 20 deja margen sin dejar de servir para el caso
 * que importa, que son los 20 snapshots de `MAX_POR_APERTURA`.
 */
const MAX_POR_LOTE = 20;

/**
 * Si vale la pena intentar el lote. Se apaga al primer 403/404 y no se vuelve
 * a prender: significa que el servidor no tiene la Batch API disponible, y
 * reintentarla en cada apertura seria pagar un request de mas para nada.
 *
 * Es estado de modulo -o sea, por carga de pagina-. Si el toggle se prende en
 * PocketBase, alcanza con recargar.
 */
let loteDisponible = true;

/** Solo para tests: vuelve a habilitar el intento de lote. */
export function reiniciarDeteccionDeLote() {
	loteDisponible = true;
}

/**
 * @typedef {object} Operacion
 * @property {string} coleccion Nombre de la coleccion
 * @property {'create'|'update'} accion
 * @property {string} [id] Requerido para `update`
 * @property {Record<string, any>} datos
 */

/**
 * @typedef {{ok: true, record: any} | {ok: false, error: any, operacion: Operacion}} Resultado
 */

/**
 * Escribe todas las operaciones y devuelve un resultado por cada una, en el
 * mismo orden que entraron.
 *
 * @param {any} pb Cliente de PocketBase (se pasa, no se importa: ver el plan)
 * @param {Operacion[]} operaciones
 * @returns {Promise<Resultado[]>}
 */
export async function escribirLote(pb, operaciones) {
	/** @type {Resultado[]} */
	const resultados = [];

	for (let i = 0; i < operaciones.length; i += MAX_POR_LOTE) {
		const trozo = operaciones.slice(i, i + MAX_POR_LOTE);
		resultados.push(...(await escribirTrozo(pb, trozo)));
	}

	return resultados;
}

/**
 * @param {any} pb
 * @param {Operacion[]} trozo
 * @returns {Promise<Resultado[]>}
 */
async function escribirTrozo(pb, trozo) {
	if (loteDisponible) {
		try {
			const batch = pb.createBatch();
			for (const op of trozo) {
				const sub = batch.collection(op.coleccion);
				if (op.accion === 'create') sub.create(op.datos);
				else sub.update(op.id, op.datos);
			}

			const respuesta = await batch.send();
			return respuesta.map((r) => ({ ok: true, record: r.body }));
		} catch (e) {
			// 403: la Batch API esta apagada. 404: el servidor es anterior a
			// PocketBase 0.23 y no tiene /api/batch. Un 403 tambien puede ser una
			// regla de coleccion que rechazo una escritura puntual, y en ese caso
			// apagar el lote es de mas -pero es inofensivo: lo unico que pasa es
			// que la sesion escribe una por una, como antes de este modulo-.
			if (e?.status === 403 || e?.status === 404) loteDisponible = false;

			// Cualquier otro fallo tambien cae aca. El lote es transaccional, asi
			// que no se escribio nada: se rehace una por una para no perder las
			// que si habrian andado.
		}
	}

	return unaPorUna(pb, trozo);
}

/**
 * @param {any} pb
 * @param {Operacion[]} trozo
 * @returns {Promise<Resultado[]>}
 */
async function unaPorUna(pb, trozo) {
	/** @type {Resultado[]} */
	const resultados = [];

	for (const op of trozo) {
		try {
			const record =
				op.accion === 'create'
					? await pb.collection(op.coleccion).create(op.datos)
					: await pb.collection(op.coleccion).update(op.id, op.datos);
			resultados.push({ ok: true, record });
		} catch (error) {
			resultados.push({ ok: false, error, operacion: op });
		}
	}

	return resultados;
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npx vitest run src/lib/pbLote.test.js`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pbLote.js src/lib/pbLote.test.js
git commit -m "feat(cartera): escrituras en lote contra PocketBase con degradacion"
```

---

### Task 3: Usar el lote para los snapshots

Acá se cobra el ahorro grande: 20 requests pasan a 1.

**Files:**
- Modify: `src/routes/admin/_components/mantenimiento/Dashboard/cartera/carteraStore.svelte.js` — el `for` de `sincronizar` (líneas 450-462) y `guardarSnapshot`

- [ ] **Step 1: Agregar el import**

Junto a los otros imports del store:

```js
import { escribirLote } from '$lib/pbLote.js';
```

- [ ] **Step 2: Reemplazar el loop de `sincronizar`**

Buscar en `sincronizar` el bloque que hoy es:

```js
		for (const r of resultados) {
			if (!r.ok) {
				fallosRefresco.add(r.code);
				continue;
			}
			fallosRefresco.delete(r.code);
			await guardarSnapshot(r.code, r.datos);
		}
```

Reemplazarlo por (conservando los comentarios que ya están arriba de ese `for`, que explican el `!r.ok`):

```js
		// Se arman TODOS los parches antes de escribir ninguno: es lo que
		// permite mandarlos en un solo request en vez de 20.
		const aEscribir = [];
		for (const r of resultados) {
			if (!r.ok) {
				fallosRefresco.add(r.code);
				continue;
			}
			fallosRefresco.delete(r.code);

			const actual = clientes.find((c) => c.code === r.code);
			// El cliente pudo haberse archivado mientras /sync estaba en vuelo.
			if (!actual) continue;

			aEscribir.push({
				coleccion: CLIENTES,
				accion: 'update',
				id: actual.id,
				datos: construirParche(actual, r.datos, config, hoyPartes())
			});
		}

		if (aEscribir.length > 0) {
			const escritos = await escribirLote(pb, aEscribir);

			const porId = new Map();
			for (const e of escritos) {
				if (e.ok) porId.set(e.record.id, e.record);
				else console.error('[cartera] no se pudo guardar el snapshot', e.operacion.id, e.error);
			}
			// Una sola reasignacion de `clientes` para toda la tanda, en vez de
			// una por cliente como hacia el loop de guardarSnapshot.
			if (porId.size > 0) clientes = clientes.map((c) => porId.get(c.id) ?? c);
		}
```

- [ ] **Step 3: Borrar `guardarSnapshot`**

Ya no la llama nadie. Verificar antes de borrar:

```bash
grep -n "guardarSnapshot" src/routes/admin/_components/mantenimiento/Dashboard/cartera/carteraStore.svelte.js
```

Expected: solo la línea de la declaración `async function guardarSnapshot(code, datos) {`. Si aparece alguna llamada más, no borrarla y revisar.

Borrar la función entera (la que quedó en el Step 5 de la Task 1).

- [ ] **Step 4: Correr toda la suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Chequeo de tipos**

Run: `npm run check`
Expected: sin errores nuevos respecto de `git stash && npm run check` (el proyecto puede tener avisos preexistentes; lo que importa es no sumar).

- [ ] **Step 6: Commit**

```bash
git add src/routes/admin/_components/mantenimiento/Dashboard/cartera/carteraStore.svelte.js
git commit -m "perf(cartera): un solo request para los 20 snapshots del sync"
```

---

### Task 4: Usar el lote para los candidatos nuevos

Sin esto, el primer día de un asesor sigue costando decenas de `create`.

**Files:**
- Modify: `src/routes/admin/_components/mantenimiento/Dashboard/cartera/carteraStore.svelte.js` — el `for` de `descubrirCandidatosDeVendedor` (líneas 348-394)

- [ ] **Step 1: Reemplazar el loop de creates**

Buscar el bloque que hoy empieza en `for (const candidato of nuevos) {` y termina antes del `} catch (e) {` de la función. Reemplazarlo por:

```js
		const aCrear = [];
		for (const candidato of nuevos) {
			if (existentes.has(candidato.code)) continue;

			aCrear.push({
				coleccion: CLIENTES,
				accion: 'create',
				datos: {
					asesor: pb.authStore.record.id,
					code: candidato.code,
					fecha_instalacion: '',
					nombre: candidato.nombre,
					doc_number: candidato.doc_number,
					ciudad: candidato.ciudad,
					estado: candidato.estado,
					start_date: candidato.start_date,
					entity_id: candidato.entity_id,
					entity_nombre: candidato.entity_nombre,
					perfil_pago: perfilDe(
						candidato.entity_id,
						config.entidades_tarjeta,
						candidato.comercial_activity
					),
					perfil_manual: false,
					debt: candidato.debt,
					duedebt: candidato.duedebt,
					connections: candidato.connections,
					promos: candidato.promos,
					pagos: [],
					tickets: null,
					alta_nap: null,
					nuevo: true,
					instalado_aviso: false,
					tickets_vistos_hasta: '',
					ultimo_contacto: '',
					// Vacio a proposito, no new Date().toISOString(): hace que
					// aRefrescar() lo tome como prioritario en la carga siguiente, asi
					// el primer sync real (el que trae tickets y calcula alta_nap)
					// llega pronto y no hay que esperar las 12h de FRESCO_MS.
					sincronizado: '',
					archivado: false
				}
			});
		}

		if (aCrear.length === 0) return;

		// Un solo request para todas las altas. Si el lote rebota -por ejemplo
		// porque dos pestanias corrieron el descubrimiento a la vez y una alta
		// choca contra el indice unico (asesor, code)-, escribirLote las rehace
		// una por una y solo se pierde la que choco, igual que antes.
		const creados = await escribirLote(pb, aCrear);

		const nuevosRegistros = [];
		for (const c of creados) {
			if (c.ok) nuevosRegistros.push(c.record);
			else
				console.error(
					'[cartera] no se pudo sumar el candidato',
					c.operacion.datos.code,
					JSON.stringify(c.error?.response ?? c.error)
				);
		}
		if (nuevosRegistros.length > 0) clientes = [...nuevosRegistros, ...clientes];
```

**Nota:** `perfilDe` se usa acá. Si en la Task 1 Step 5 se borró su import por creer que no lo usaba nadie más, hay que volver a agregarlo.

- [ ] **Step 2: Correr toda la suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/routes/admin/_components/mantenimiento/Dashboard/cartera/carteraStore.svelte.js
git commit -m "perf(cartera): un solo request para las altas de candidatos"
```

---

### Task 5: Caché de `cartera_config` en `sessionStorage`

**Files:**
- Create: `src/lib/cartera/configCache.js`
- Test: `src/lib/cartera/configCache.test.js`
- Modify: `carteraStore.svelte.js` — `cargarConfig` (líneas 97-111)
- Modify: `CarteraConfig.svelte` — `guardar()`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/cartera/configCache.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { leerConfigCache, guardarConfigCache, olvidarConfigCache } from './configCache.js';

/** Un Storage falso: los tests corren en `environment: 'node'`, sin sessionStorage. */
function almacenFalso() {
	const datos = new Map();
	return {
		getItem: (k) => (datos.has(k) ? datos.get(k) : null),
		setItem: (k, v) => datos.set(k, String(v)),
		removeItem: (k) => datos.delete(k)
	};
}

/** Un Storage que tira siempre: Safari en modo privado, cookies bloqueadas. */
const almacenRoto = {
	getItem: () => {
		throw new Error('denied');
	},
	setItem: () => {
		throw new Error('denied');
	},
	removeItem: () => {
		throw new Error('denied');
	}
};

const CONFIG = { dia_corte_1: 10, dia_corte_2: 20, dia_corte_tarjeta: 21, entidades_tarjeta: [7] };

describe('configCache', () => {
	it('devuelve null cuando no hay nada guardado', () => {
		expect(leerConfigCache(almacenFalso())).toBe(null);
	});

	it('devuelve lo que se guardo', () => {
		const a = almacenFalso();
		guardarConfigCache(a, CONFIG);
		expect(leerConfigCache(a)).toEqual(CONFIG);
	});

	it('olvidar borra lo guardado', () => {
		const a = almacenFalso();
		guardarConfigCache(a, CONFIG);
		olvidarConfigCache(a);
		expect(leerConfigCache(a)).toBe(null);
	});

	it('devuelve null si lo guardado no es JSON valido', () => {
		const a = almacenFalso();
		a.setItem('cartera_config_v1', '{roto');
		expect(leerConfigCache(a)).toBe(null);
	});

	it('sin almacen (SSR) devuelve null y no explota al guardar', () => {
		expect(leerConfigCache(null)).toBe(null);
		expect(() => guardarConfigCache(null, CONFIG)).not.toThrow();
		expect(() => olvidarConfigCache(null)).not.toThrow();
	});

	it('con un almacen que tira, degrada a null sin propagar', () => {
		expect(leerConfigCache(almacenRoto)).toBe(null);
		expect(() => guardarConfigCache(almacenRoto, CONFIG)).not.toThrow();
		expect(() => olvidarConfigCache(almacenRoto)).not.toThrow();
	});
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx vitest run src/lib/cartera/configCache.test.js`
Expected: FAIL — `Failed to resolve import "./configCache.js"`.

- [ ] **Step 3: Escribir `src/lib/cartera/configCache.js`**

```js
/**
 * Cache de `cartera_config` en el sessionStorage del navegador.
 *
 * La config se leia en cada apertura de la Cartera: un request a PocketBase
 * para traer algo que no cambia. Los dias de corte son los que son.
 *
 * Sin TTL a proposito. La invalidacion es explicita, desde la pantalla que la
 * edita. El hueco conocido: si un asesor guarda un cambio, otro asesor que ya
 * tenga la Cartera abierta sigue viendo la config vieja hasta que recargue.
 * Como la config no cambia, ese hueco no se paga casi nunca; si algun dia
 * empieza a cambiar seguido, la respuesta es ponerle un TTL corto, no
 * invalidacion cruzada.
 *
 * Todo degrada a "no hay cache" ante cualquier problema: sin `sessionStorage`
 * (SSR, o Safari en modo privado, donde tocarlo tira), o con un JSON roto de
 * una version anterior. El costo de degradar es un request; el costo de
 * propagar la excepcion seria que `cargarConfig` caiga en su catch y la
 * Cartera trabaje con los dias de corte por defecto, mostrando alertas de mora
 * equivocadas.
 */

const CLAVE = 'cartera_config_v1';

/**
 * El `sessionStorage` del navegador, o `null` si no hay.
 *
 * @returns {Storage | null}
 */
export function almacenDeSesion() {
	try {
		return typeof sessionStorage === 'undefined' ? null : sessionStorage;
	} catch {
		return null;
	}
}

/**
 * @param {Storage | null} almacen
 * @returns {any | null} La config cacheada, o `null` si no hay o no sirve
 */
export function leerConfigCache(almacen) {
	if (!almacen) return null;
	try {
		const crudo = almacen.getItem(CLAVE);
		return crudo ? JSON.parse(crudo) : null;
	} catch {
		return null;
	}
}

/**
 * @param {Storage | null} almacen
 * @param {any} config
 */
export function guardarConfigCache(almacen, config) {
	if (!almacen) return;
	try {
		almacen.setItem(CLAVE, JSON.stringify(config));
	} catch {
		// Sin cache se sigue funcionando: es solo un request de mas.
	}
}

/** @param {Storage | null} almacen */
export function olvidarConfigCache(almacen) {
	if (!almacen) return;
	try {
		almacen.removeItem(CLAVE);
	} catch {
		// Idem: si no se puede borrar es porque tampoco se pudo guardar.
	}
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npx vitest run src/lib/cartera/configCache.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 5: Usar el caché en `cargarConfig`**

En `carteraStore.svelte.js`, agregar el import:

```js
import { almacenDeSesion, leerConfigCache, guardarConfigCache } from '$lib/cartera/configCache.js';
```

Reemplazar `cargarConfig` (líneas 97-111) por:

```js
async function cargarConfig() {
	const almacen = almacenDeSesion();

	// El cacheado ya paso por normalizarConfig cuando se guardo, pero se
	// vuelve a normalizar igual: es barato, y asi un JSON viejo de una version
	// anterior del esquema no se cuela sin validar.
	const cacheada = leerConfigCache(almacen);
	if (cacheada) {
		config = normalizarConfig(cacheada);
		return;
	}

	try {
		const lista = await pb.collection(CONFIG).getList(1, 1);
		// `normalizarConfig` (no un `{ ...CONFIG_DEFAULT, ...record }` a mano)
		// porque un dia de corte en 0 -invalido, pero no "vacio"- pasaria un
		// spread o un `?? 10` sin que nadie lo note, y `alertas.js` lo usaria
		// tal cual: `hoy.dia > 0` es cierto todos los dias, para todos los
		// clientes de la cartera.
		if (lista.items.length > 0) {
			config = normalizarConfig(lista.items[0]);
			guardarConfigCache(almacen, config);
		}
	} catch (e) {
		// Sin config el panel funciona con los defaults: todos ventanilla, todas
		// las areas cuentan como soporte.
		console.error('[cartera] no se pudo leer la configuracion:', e);
	}
}
```

- [ ] **Step 6: Invalidar el caché al guardar la config**

En `CarteraConfig.svelte`, agregar al bloque de imports (después de la línea de `$lib/cartera/config.js`):

```js
import { almacenDeSesion, olvidarConfigCache } from '$lib/cartera/configCache.js';
```

En `guardar()`, entre el `create`/`update` y el `await carteraStore.cargar()`:

```js
		if (lista.items.length > 0) await pb.collection('cartera_config').update(lista.items[0].id, datos);
		else await pb.collection('cartera_config').create(datos);

		// Antes del cargar(): si no, el store releeria el cache viejo y la
		// pantalla se cerraria mostrando la config anterior.
		olvidarConfigCache(almacenDeSesion());

		await carteraStore.cargar();
		onCerrar();
```

- [ ] **Step 7: Correr toda la suite y el chequeo de tipos**

Run: `npm test && npm run check`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/cartera/configCache.js src/lib/cartera/configCache.test.js src/routes/admin/_components/mantenimiento/Dashboard/cartera/carteraStore.svelte.js src/routes/admin/_components/mantenimiento/Dashboard/cartera/CarteraConfig.svelte
git commit -m "perf(cartera): cachear cartera_config por sesion"
```

---

### Task 6: Verificación en vivo

Los tests cubren la lógica, pero no que PocketBase acepte el lote tal cual lo arma el SDK. Esto lo prueba contra el servidor real.

- [ ] **Step 1: Ver si la Batch API está encendida**

```bash
curl -s -X POST https://sista.pockethost.io/api/batch -H "Content-Type: application/json" -d '{"requests":[]}'
```

- Si responde `403 "Batch requests are not allowed."` → **está apagada**. Encenderla en Settings del admin de PocketBase (necesita superuser), con `maxRequests` en 50 o más. Sin esto, los pasos siguientes verifican la degradación, no el lote.
- Si responde otra cosa (un 400 por el body vacío) → está encendida, seguir.

- [ ] **Step 2: Levantar el dev server**

Run: `npm run dev`

- [ ] **Step 3: Abrir la Cartera con la pestaña de red abierta**

Entrar a `/admin`, loguearse, abrir la Cartera. En DevTools → Network, filtrar por `pockethost.io`.

Contar los requests de la apertura. Esperado:

| | esperado |
|---|---|
| `GET /api/collections/cartera_config/records` | 0 en la segunda apertura de la sesión, 1 en la primera |
| `GET /api/collections/cartera_clientes/records` | 1 |
| `GET /api/collections/cartera_recordatorios/records` | 1 |
| `POST /api/batch` | 1 (si había snapshots vencidos) |
| `PATCH /api/collections/cartera_clientes/records/*` | **0** |

Si aparecen `PATCH` sueltos, el lote está degradando: mirar la consola y el status del `POST /api/batch`.

- [ ] **Step 4: Verificar que los datos quedaron bien escritos**

Recargar la Cartera y comparar contra lo que mostraba antes: la columna de sincronización tiene que decir que se sincronizó recién, y ningún cliente puede haber perdido `pagos`, `tickets` ni `fecha_instalacion`. Abrir un par de detalles y confirmar que los tickets siguen ahí.

- [ ] **Step 5: Verificar la degradación**

Con la Batch API **apagada** (o apagándola un momento), recargar y abrir la Cartera. Esperado: vuelven los `PATCH` sueltos, la Cartera funciona igual, y en Network se ve **un solo** `POST /api/batch` con 403 en toda la sesión, no uno por apertura.

- [ ] **Step 6: Commit final si hubo ajustes**

```bash
git add -A
git commit -m "fix(cartera): ajustes de la verificacion en vivo del lote"
```

---

## Notas para quien ejecute

- **No subir `MAX_POR_APERTURA`.** Sigue en 20 y tiene que coincidir con `MAX_CODIGOS` de `/api/cartera/sync`; el comentario en `refresco.js:19-24` explica qué se rompe si divergen. El objetivo de este plan es gastar menos requests para los mismos 20 clientes, no refrescar más.
- **No mover escrituras al servidor.** `carteraStore` corre en el navegador y eso es deliberado: cada asesor gasta su propio cupo por IP. Pasar las escrituras a los endpoints Node uniría todas las IPs en una y empeoraría exactamente el problema que este plan resuelve.
- **El lote nunca puede ser obligatorio.** Si en algún momento parece más simple asumir que la Batch API está disponible, no lo es: hoy está apagada en producción y el código tiene que seguir andando así.
- **Dos comprobaciones del spec quedan solo en la verificación manual**, a propósito: que la segunda apertura no consulte `cartera_config`, y que guardar la config invalide el caché. Las dos viven en el store (`.svelte.js` con runes) y en un componente Svelte, y el proyecto no tiene infraestructura para testear ninguno de los dos —`vitest` corre con `environment: 'node'` y no hay un solo test de store en el repo—. Montar esa infraestructura es más trabajo que el plan entero. Los tres módulos nuevos sí están cubiertos por unit tests; lo que queda sin cubrir es el cableado, y eso lo verifica la Task 6 Steps 3 y 4.
