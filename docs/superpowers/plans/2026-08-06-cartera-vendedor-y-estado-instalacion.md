# Cartera: alta automática por vendedor y estado de instalación — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sumar automáticamente a la Cartera los clientes que le corresponden a cada asesor por vendedor de IspCube, reemplazar la fecha de instalación tipeada a mano por la fecha real de cierre del ticket de reserva de NAP, y mostrar un estado de instalación derivado con sus alertas.

**Architecture:** Dos módulos puros nuevos/ampliados (`normalizar.js` para leer el ticket de NAP del crudo de IspCube, `instalacion.js` nuevo para derivar el estado), un endpoint nuevo (`/api/cartera/candidatos`) que pagina `customers_list` filtrando por vendedor, y cambios en el store de Svelte que consumen todo eso: al cargar la Cartera, buscan candidatos y los crean; al sincronizar un cliente existente, detectan la transición a "instalado" y completan la fecha real.

**Tech Stack:** SvelteKit, PocketBase (JS SDK), Vitest, IspCube REST API.

---

## Prerrequisito externo (no es una tarea de este plan)

El campo `id_vendedor` en la colección `users` de PocketBase lo carga el
usuario a mano, fuera de este repo (ids ya confirmados en la conversación:
Leonardo Costante = 6, gustavo bruno = 35, MARTINEZ FELIPE = 5, Agustin
Sander = 64). Sin ese campo seteado en su propio usuario, un asesor
simplemente no participa del descubrimiento automático — el código de este
plan lo trata como opcional en todo momento.

## File Structure

- Modificar `src/lib/cartera/normalizar.js` — sumar `resumenAltaNap` y sus
  dos constantes (`CATEGORIA_ALTA_NAP`, `ESTADO_ANULADO`).
- Crear `src/lib/cartera/instalacion.js` — `estadoInstalacionDe`, función
  pura nueva.
- Crear `src/lib/cartera/instalacion.test.js`.
- Modificar `src/lib/cartera/alertas.js` — alertas `nap_faltante` y
  `nap_anulado`.
- Modificar `src/lib/server/ispcube.js` — `getCustomersPage`.
- Modificar `src/routes/api/cartera/sync/+server.js` — sumar `alta_nap` a
  la respuesta.
- Modificar `src/routes/api/cartera/cliente/[code]/+server.js` — idem.
- Crear `src/routes/api/cartera/candidatos/+server.js` — endpoint nuevo.
- Crear `src/routes/api/cartera/candidatos/server.test.js` (guardias de auth).
- Crear `src/routes/api/cartera/candidatos/candidatos.test.js` (paginado y filtrado).
- Modificar `scripts/crear-colecciones-cartera.js` — 3 campos nuevos +
  `fecha_instalacion` pasa a opcional.
- Modificar `src/routes/admin/_components/mantenimiento/Dashboard/cartera/carteraStore.svelte.js`
  — `agregar()` sin fecha manual, `guardarSnapshot()` con la transición de
  estado, descubrimiento de candidatos en `cargar()`.
- Modificar `src/routes/admin/_components/mantenimiento/Dashboard/cartera/AgregarCliente.svelte`
  — sacar el campo de fecha.
- Modificar `src/routes/admin/_components/mantenimiento/Dashboard/cartera/Cartera.svelte`
  — chips nuevos, badges "nuevo"/"instalado", estado de instalación en la fila.

---

### Task 1: `resumenAltaNap` en `normalizar.js`

**Files:**
- Modify: `src/lib/cartera/normalizar.js`
- Test: `src/lib/cartera/normalizar.test.js`

- [ ] **Step 1: Escribir los tests que fallan**

Agregar al final de `src/lib/cartera/normalizar.test.js` (después del último
`describe` existente, mismo archivo, sin tocar lo que ya hay):

```js
describe('resumenAltaNap', () => {
	const ticket = (over = {}) => ({
		id: 1,
		ticket_category_id: 69,
		ticket_status_id: 3,
		created_at: '2026-08-01T10:00:00.000000Z',
		closed_date: '2026-08-05 15:22:00',
		...over
	});

	it('sin tickets de la categoria 69, existe es false', () => {
		const r = resumenAltaNap([{ ...ticket(), ticket_category_id: 40 }], {
			estadosCerrados: [3]
		});
		expect(r).toEqual({ existe: false, cerrado: false, anulado: false, closed_date: '' });
	});

	it('con un ticket cerrado (status en estadosCerrados)', () => {
		const r = resumenAltaNap([ticket({ ticket_status_id: 3 })], { estadosCerrados: [3] });
		expect(r).toEqual({ existe: true, cerrado: true, anulado: false, closed_date: '2026-08-05' });
	});

	it('con un ticket abierto (status fuera de estadosCerrados)', () => {
		const r = resumenAltaNap([ticket({ ticket_status_id: 1, closed_date: null })], {
			estadosCerrados: [3]
		});
		expect(r).toEqual({ existe: true, cerrado: false, anulado: false, closed_date: '' });
	});

	it('con un ticket anulado (status_id 8), cerrado es false y anulado true', () => {
		const r = resumenAltaNap([ticket({ ticket_status_id: 8, closed_date: null })], {
			estadosCerrados: [3]
		});
		expect(r).toEqual({ existe: true, cerrado: false, anulado: true, closed_date: '' });
	});

	it('con varios tickets de la categoria, gana el mas reciente por created_at', () => {
		const viejo = ticket({
			id: 1,
			ticket_status_id: 8,
			created_at: '2026-07-01T10:00:00.000000Z',
			closed_date: null
		});
		const nuevo = ticket({
			id: 2,
			ticket_status_id: 3,
			created_at: '2026-08-01T10:00:00.000000Z',
			closed_date: '2026-08-05 15:22:00'
		});
		const r = resumenAltaNap([viejo, nuevo], { estadosCerrados: [3] });
		expect(r).toEqual({ existe: true, cerrado: true, anulado: false, closed_date: '2026-08-05' });
	});

	it('descarta tickets borrados (deleted_at)', () => {
		const r = resumenAltaNap([{ ...ticket(), deleted_at: '2026-08-01T00:00:00Z' }], {
			estadosCerrados: [3]
		});
		expect(r.existe).toBe(false);
	});

	it('tolera un array vacio o no-array sin explotar', () => {
		expect(resumenAltaNap([], { estadosCerrados: [3] }).existe).toBe(false);
		expect(resumenAltaNap(null, { estadosCerrados: [3] }).existe).toBe(false);
		expect(resumenAltaNap(undefined, { estadosCerrados: [3] }).existe).toBe(false);
	});
});
```

Actualizar el import de arriba del archivo para sumar `resumenAltaNap`:

```js
import { normalizarCliente, perfilDe, resumenTickets, resumenAltaNap } from './normalizar.js';
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npx vitest run src/lib/cartera/normalizar.test.js`
Expected: FAIL — `resumenAltaNap is not a function` (o `is not exported`).

- [ ] **Step 3: Implementar `resumenAltaNap`**

En `src/lib/cartera/normalizar.js`, agregar después de `resumenTickets`
(al final del archivo):

```js
/**
 * Categoria del ticket de reserva de NAP en IspCube: "ALTA RESERVA DE NAP".
 * Sondeado en vivo el 2026-08-06 contra `GET /api/tickets/category_list`.
 * Hardcodeado a proposito -no configurable como `areas_soporte`-: el nombre
 * del proceso no va a cambiar en mucho tiempo, y si algun dia cambia, se
 * actualiza aca.
 */
const CATEGORIA_ALTA_NAP = 69;

/**
 * Estado "ANULADO" de un ticket en IspCube. Sondeado el 2026-08-06 contra
 * `GET /api/tickets/status_list`. Distinto de `estados_cerrados`
 * (`cartera_config`): un ticket anulado no es lo mismo que uno cerrado, y la
 * Cartera necesita distinguirlos para la alerta `nap_anulado`.
 */
const ESTADO_ANULADO = 8;

/**
 * Estado del ticket de "ALTA RESERVA DE NAP" mas reciente de un cliente.
 *
 * De aca sale la fecha real de instalacion (`closed_date`, NO `start_date`
 * del cliente: son fechas distintas, ver el spec del 2026-08-06) y el estado
 * de instalacion derivado (`estadoInstalacionDe` en `instalacion.js`).
 *
 * @param {unknown} tickets Respuesta cruda de `getTickets`
 * @param {{estadosCerrados: unknown[]}} opciones Misma lista que usa `resumenTickets`
 * @returns {{existe: boolean, cerrado: boolean, anulado: boolean, closed_date: string}}
 */
export function resumenAltaNap(tickets, { estadosCerrados }) {
	if (!Array.isArray(tickets)) {
		return { existe: false, cerrado: false, anulado: false, closed_date: '' };
	}

	const cerrados = (Array.isArray(estadosCerrados) ? estadosCerrados : []).map(String);

	/** @type {any} */
	let masReciente = null;
	for (const t of tickets) {
		if (!t || t.deleted_at) continue;
		if (t.ticket_category_id !== CATEGORIA_ALTA_NAP) continue;

		if (!masReciente) {
			masReciente = t;
			continue;
		}
		const fecha = partesFechaHora(t.created_at);
		const fechaPrevia = partesFechaHora(masReciente.created_at);
		if (fecha && fechaPrevia && compararFechaHora(fecha, fechaPrevia) > 0) masReciente = t;
	}

	if (!masReciente) return { existe: false, cerrado: false, anulado: false, closed_date: '' };

	const cerrado = cerrados.includes(String(masReciente.ticket_status_id));

	return {
		existe: true,
		cerrado,
		anulado: masReciente.ticket_status_id === ESTADO_ANULADO,
		// Igual que `start_date` en `normalizarCliente`: se guarda la fecha
		// sola, la hora nunca es significativa aca.
		closed_date:
			cerrado && typeof masReciente.closed_date === 'string'
				? masReciente.closed_date.slice(0, 10)
				: ''
	};
}
```

`partesFechaHora` y `compararFechaHora` ya están importados arriba del
archivo (`import { partesFechaHora, compararFechaHora } from './fechas.js';`)
— no hace falta tocar ese import.

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npx vitest run src/lib/cartera/normalizar.test.js`
Expected: PASS, todos los tests incluidos los preexistentes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/cartera/normalizar.js src/lib/cartera/normalizar.test.js
git commit -m "feat(cartera): resumenAltaNap lee el estado del ticket de reserva de NAP"
```

---

### Task 2: `estadoInstalacionDe` en `instalacion.js` (nuevo módulo)

**Files:**
- Create: `src/lib/cartera/instalacion.js`
- Test: `src/lib/cartera/instalacion.test.js`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/cartera/instalacion.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { estadoInstalacionDe } from './instalacion.js';

const altaNap = (over = {}) => ({ existe: true, cerrado: false, anulado: false, ...over });

describe('estadoInstalacionDe', () => {
	it('sin conexiones activas, pendiente_pago sin importar el ticket', () => {
		expect(
			estadoInstalacionDe({ connections: [], alta_nap: altaNap({ cerrado: true }) })
		).toBe('pendiente_pago');
	});

	it('habilitado con el ticket cerrado, instalado', () => {
		expect(
			estadoInstalacionDe({ connections: [{ plan_id: 1 }], alta_nap: altaNap({ cerrado: true }) })
		).toBe('instalado');
	});

	it('habilitado sin ticket de NAP, instalacion_pendiente', () => {
		expect(
			estadoInstalacionDe({ connections: [{ plan_id: 1 }], alta_nap: { existe: false, cerrado: false, anulado: false } })
		).toBe('instalacion_pendiente');
	});

	it('habilitado con el ticket abierto (no cerrado, no anulado), instalacion_pendiente', () => {
		expect(
			estadoInstalacionDe({ connections: [{ plan_id: 1 }], alta_nap: altaNap({ cerrado: false, anulado: false }) })
		).toBe('instalacion_pendiente');
	});

	it('habilitado con el ticket anulado, instalacion_pendiente (la alerta es aparte)', () => {
		expect(
			estadoInstalacionDe({ connections: [{ plan_id: 1 }], alta_nap: altaNap({ cerrado: false, anulado: true }) })
		).toBe('instalacion_pendiente');
	});

	it('sin connections en el cliente (undefined), no explota y da pendiente_pago', () => {
		expect(estadoInstalacionDe({ alta_nap: altaNap({ cerrado: true }) })).toBe('pendiente_pago');
	});

	it('sin alta_nap en el cliente (null, todavia no llego el primer sync), instalacion_pendiente si esta habilitado', () => {
		expect(estadoInstalacionDe({ connections: [{ plan_id: 1 }], alta_nap: null })).toBe(
			'instalacion_pendiente'
		);
	});
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/lib/cartera/instalacion.test.js`
Expected: FAIL — no se puede resolver el módulo `./instalacion.js`.

- [ ] **Step 3: Implementar `estadoInstalacionDe`**

Crear `src/lib/cartera/instalacion.js`:

```js
/**
 * Estado de instalacion de un cliente de la Cartera.
 *
 * No se guarda como campo propio: se deriva de dos campos que si vive en el
 * snapshot, `connections` y `alta_nap` (ver `resumenAltaNap` en
 * `normalizar.js`). Modulo aparte de `alertas.js` porque no es una alerta
 * -no suma a la urgencia de la fila- sino un estado informativo, mismo
 * criterio que separo `relativo.js` de `alertas.js`.
 */

/**
 * @param {{
 *   connections?: unknown[],
 *   alta_nap?: {existe: boolean, cerrado: boolean, anulado: boolean} | null
 * }} cliente
 * @returns {'pendiente_pago' | 'instalacion_pendiente' | 'instalado'}
 */
export function estadoInstalacionDe(cliente) {
	const conexiones = Array.isArray(cliente?.connections) ? cliente.connections : [];
	// Sin conexion activa no importa que diga el ticket: no hay nada mas que
	// mirar todavia. `pendiente_pago` porque en la practica la conexion se
	// habilita cuando se acredita el primer pago.
	if (conexiones.length === 0) return 'pendiente_pago';

	return cliente?.alta_nap?.cerrado ? 'instalado' : 'instalacion_pendiente';
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/lib/cartera/instalacion.test.js`
Expected: PASS, los 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/cartera/instalacion.js src/lib/cartera/instalacion.test.js
git commit -m "feat(cartera): estadoInstalacionDe deriva pendiente_pago/instalacion_pendiente/instalado"
```

---

### Task 3: Alertas `nap_faltante` y `nap_anulado` en `alertas.js`

**Files:**
- Modify: `src/lib/cartera/alertas.js`
- Test: `src/lib/cartera/alertas.test.js`

- [ ] **Step 1: Escribir los tests que fallan**

Agregar al final de `src/lib/cartera/alertas.test.js`:

```js
describe('alertas de la reserva de NAP', () => {
	const CONFIG_NAP = CONFIG;

	it('sin conexiones activas, no alerta aunque falte el ticket', () => {
		const r = alertasDe(
			{ ...base, connections: [], alta_nap: { existe: false, cerrado: false, anulado: false } },
			{ anio: 2026, mes: 8, dia: 6 },
			CONFIG_NAP
		);
		expect(tipos(r)).not.toContain('nap_faltante');
		expect(tipos(r)).not.toContain('nap_anulado');
	});

	it('habilitado y sin ticket de NAP, nap_faltante', () => {
		const r = alertasDe(
			{
				...base,
				connections: [{ plan_id: 1 }],
				alta_nap: { existe: false, cerrado: false, anulado: false }
			},
			{ anio: 2026, mes: 8, dia: 6 },
			CONFIG_NAP
		);
		expect(tipos(r)).toContain('nap_faltante');
		expect(tipos(r)).not.toContain('nap_anulado');
	});

	it('habilitado y el ticket de NAP anulado, nap_anulado', () => {
		const r = alertasDe(
			{
				...base,
				connections: [{ plan_id: 1 }],
				alta_nap: { existe: true, cerrado: false, anulado: true }
			},
			{ anio: 2026, mes: 8, dia: 6 },
			CONFIG_NAP
		);
		expect(tipos(r)).toContain('nap_anulado');
		expect(tipos(r)).not.toContain('nap_faltante');
	});

	it('habilitado y el ticket de NAP cerrado, sin alertas de NAP', () => {
		const r = alertasDe(
			{
				...base,
				connections: [{ plan_id: 1 }],
				alta_nap: { existe: true, cerrado: true, anulado: false }
			},
			{ anio: 2026, mes: 8, dia: 6 },
			CONFIG_NAP
		);
		expect(tipos(r)).not.toContain('nap_faltante');
		expect(tipos(r)).not.toContain('nap_anulado');
	});

	it('habilitado y el ticket de NAP abierto (no cerrado, no anulado), sin alertas de NAP', () => {
		const r = alertasDe(
			{
				...base,
				connections: [{ plan_id: 1 }],
				alta_nap: { existe: true, cerrado: false, anulado: false }
			},
			{ anio: 2026, mes: 8, dia: 6 },
			CONFIG_NAP
		);
		expect(tipos(r)).not.toContain('nap_faltante');
		expect(tipos(r)).not.toContain('nap_anulado');
	});
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npx vitest run src/lib/cartera/alertas.test.js`
Expected: FAIL en "habilitado y sin ticket de NAP, nap_faltante" y en
"habilitado y el ticket de NAP anulado, nap_anulado" (los otros tres pasan
de casualidad porque esperan que NO aparezca nada).

- [ ] **Step 3: Implementar el bloque de alertas**

En `src/lib/cartera/alertas.js`, dentro de `alertasDe`, agregar el bloque
nuevo justo antes de `return alertas;` (al final de la función, después del
bloque `--- Promo por vencer ---`):

```js
	// --- Reserva de NAP ------------------------------------------------------
	// Solo se evalua habilitado: sin conexion activa, no tener el ticket
	// todavia es lo esperable (el proceso de instalacion ni arranco), no una
	// anomalia. Mutuamente excluyentes: sin ticket no hay ticket anulado que
	// mostrar.
	if (Array.isArray(cliente?.connections) && cliente.connections.length > 0) {
		if (!cliente?.alta_nap?.existe) {
			alertas.push({ tipo: 'nap_faltante', desde: null });
		} else if (cliente.alta_nap.anulado) {
			alertas.push({ tipo: 'nap_anulado', desde: null });
		}
	}

	return alertas;
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npx vitest run src/lib/cartera/alertas.test.js`
Expected: PASS, todos los tests incluidos los preexistentes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/cartera/alertas.js src/lib/cartera/alertas.test.js
git commit -m "feat(cartera): alertas nap_faltante y nap_anulado"
```

---

### Task 4: `getCustomersPage` en `ispcube.js`

**Files:**
- Modify: `src/lib/server/ispcube.js`
- Test: `src/lib/server/ispcube.test.js`

- [ ] **Step 1: Escribir los tests que fallan**

Agregar al final de `src/lib/server/ispcube.test.js`:

```js
describe('getCustomersPage', () => {
	beforeEach(() => limpiarCacheToken());

	const okAuth = res(200, { token: 'tok' });

	it('pagina con limit y offset, con todos los headers obligatorios', async () => {
		const calls = [];
		await getCustomersPage(200, 100, CONFIG, {
			fetchImpl: fakeFetch([okAuth, res(200, [])], calls)
		});

		expect(calls[1].url).toBe(
			'https://sista.ispcube.online/api/customers/customers_list?limit=100&offset=200'
		);
		expect(calls[1].init.headers['login-type']).toBe('api');
		expect(calls[1].init.headers.username).toBe('u');
		expect(calls[1].init.headers.Authorization).toBe('Bearer tok');
	});

	it('devuelve los clientes cuando la api responde un array', async () => {
		const customers = [{ id: 1, code: '000001', seller_id: 6, start_date: '2026-08-01 00:00:00' }];
		const r = await getCustomersPage(0, 100, CONFIG, {
			fetchImpl: fakeFetch([okAuth, res(200, customers)])
		});

		expect(r).toEqual({ ok: true, customers });
	});

	it('devuelve invalid si un 200 no trae un array', async () => {
		const r = await getCustomersPage(0, 100, CONFIG, {
			fetchImpl: fakeFetch([okAuth, res(200, { status: false, message: 'algo raro' })])
		});

		expect(r).toEqual({ ok: false, reason: 'invalid' });
	});

	it('propaga el reason ante un error de la api', async () => {
		const r = await getCustomersPage(0, 100, CONFIG, {
			fetchImpl: fakeFetch([okAuth, res(500, {})])
		});

		expect(r).toEqual({ ok: false, reason: 'api' });
	});
});
```

Actualizar el import de arriba del archivo para sumar `getCustomersPage`:

```js
import {
	getAuthToken,
	createTicket,
	getCustomerByCode,
	getTickets,
	getCobranzas,
	getCatalogos,
	getPlanCatalog,
	getCustomersPage,
	limpiarCacheToken,
	limpiarCachePlanes
} from './ispcube.js';
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npx vitest run src/lib/server/ispcube.test.js`
Expected: FAIL — `getCustomersPage is not a function` (o `is not exported`).

- [ ] **Step 3: Implementar `getCustomersPage`**

En `src/lib/server/ispcube.js`, agregar después de `getCobranzas` (buscar
dónde termina esa función y agregar la nueva a continuación, antes de
`getCatalogos`):

```js
/**
 * Una pagina de `GET /api/customers/customers_list`, el payload de cliente
 * mas rico de la API (trae `connections`, `seller_id`, `start_date`, etc.).
 * Solo lectura.
 *
 * No hay forma de filtrar por vendedor en la API -se probo `?seller_id=` y
 * la API lo ignora, sondeado el 2026-08-06-: quien llama filtra `customers`
 * por `seller_id` en su propio codigo, pagina por pagina.
 *
 * @param {number} offset
 * @param {number} limit
 * @param {IspcubeConfig} config
 * @param {{ fetchImpl?: typeof fetch }} [options]
 * @returns {Promise<{ok: true, customers: any[]} | {ok: false, reason: string}>}
 */
export async function getCustomersPage(offset, limit, config, options = {}) {
	const r = await getAutenticado(
		`/api/customers/customers_list?limit=${limit}&offset=${offset}`,
		config,
		options
	);

	if (!r.ok) return { ok: false, reason: r.reason };
	// Mismo motivo que en getTickets: un 200 que no trae un array puede ser un
	// objeto de error de IspCube con status HTTP 200.
	if (!Array.isArray(r.data)) return { ok: false, reason: 'invalid' };
	return { ok: true, customers: r.data };
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npx vitest run src/lib/server/ispcube.test.js`
Expected: PASS, todos los tests incluidos los preexistentes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/ispcube.js src/lib/server/ispcube.test.js
git commit -m "feat(cartera): getCustomersPage pagina customers_list"
```

---

### Task 5: `alta_nap` en las respuestas de sync y cliente/[code]

**Files:**
- Modify: `src/routes/api/cartera/sync/+server.js`
- Modify: `src/routes/api/cartera/sync/snapshot.test.js`
- Modify: `src/routes/api/cartera/cliente/[code]/+server.js`
- Create: `src/routes/api/cartera/cliente/[code]/cliente.test.js`

- [ ] **Step 1: Escribir el test que falla, para `/api/cartera/sync`**

En `src/routes/api/cartera/sync/snapshot.test.js`, agregar dentro de
`describe('POST /api/cartera/sync - resiliencia de snapshotDe', ...)` un
test nuevo (junto al que ya existe ahí):

```js
	it('suma alta_nap a los datos, leido de los mismos tickets que resumenTickets', async () => {
		vi.mocked(getCustomerByCode).mockResolvedValue(clienteSano('003566'));
		vi.mocked(getTickets).mockResolvedValue({
			ok: true,
			tickets: [
				{
					id: 1,
					ticket_category_id: 69,
					ticket_status_id: 3,
					created_at: '2026-08-01T10:00:00.000000Z',
					closed_date: '2026-08-05 15:22:00'
				}
			]
		});

		const r = await post({ codes: ['003566'], estadosCerrados: [3] });

		expect(r.status).toBe(200);
		const body = await r.json();
		expect(body.resultados[0].datos.alta_nap).toEqual({
			existe: true,
			cerrado: true,
			anulado: false,
			closed_date: '2026-08-05'
		});
	});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/routes/api/cartera/sync/snapshot.test.js`
Expected: FAIL — `body.resultados[0].datos.alta_nap` es `undefined`.

- [ ] **Step 3: Escribir el test que falla, para `/api/cartera/cliente/[code]`**

El `server.test.js` que ya existe ahí (visto: solo prueba las guardias
401/403, con `$lib/server/ispcube.js` mockeado para que TIRE si se llama —
no sirve para probar una respuesta 200). Mismo criterio que Task 6: un
archivo aparte para el caso funcional, con `verificarPermiso` mockeado.

Crear `src/routes/api/cartera/cliente/[code]/cliente.test.js`:

```js
/**
 * Comportamiento de GET /api/cartera/cliente/[code] con verificarPermiso
 * mockeado (la guardia ya esta cubierta en server.test.js).
 */
import { describe, it, expect, vi } from 'vitest';
import { GET } from './+server.js';
import { getCustomerByCode, getTickets, getCobranzas, getPlanCatalog } from '$lib/server/ispcube.js';

vi.mock('$lib/server/adminAuth.js', () => ({
	verificarPermiso: vi.fn(async () => ({ ok: true, usuarioId: 'usuario-1' }))
}));

vi.mock('$lib/server/ispcube.js', () => ({
	getCustomerByCode: vi.fn(),
	getTickets: vi.fn(),
	getCobranzas: vi.fn(),
	getPlanCatalog: vi.fn()
}));

const get = (qs = '') =>
	GET({
		request: new Request(`http://x/api/cartera/cliente/003566${qs}`),
		params: { code: '003566' },
		url: new URL(`http://x/api/cartera/cliente/003566${qs}`)
	});

describe('GET /api/cartera/cliente/[code] - alta_nap', () => {
	it('suma alta_nap a la respuesta, leido del mismo getTickets que ya se pedia', async () => {
		vi.mocked(getCustomerByCode).mockResolvedValue({
			ok: true,
			customer: { code: '003566', name: 'CLIENTE', status: 'enabled', crudo: { code: '003566', name: 'CLIENTE', status: 'enabled' } }
		});
		vi.mocked(getTickets).mockResolvedValue({
			ok: true,
			tickets: [
				{
					id: 1,
					ticket_category_id: 69,
					ticket_status_id: 8,
					created_at: '2026-08-01T10:00:00.000000Z',
					closed_date: null
				}
			]
		});
		vi.mocked(getCobranzas).mockResolvedValue({ ok: true, cobranzas: [] });
		vi.mocked(getPlanCatalog).mockResolvedValue({ ok: true, porId: new Map() });

		const r = await get('?cerrados=3');

		expect(r.status).toBe(200);
		const body = await r.json();
		expect(body.alta_nap).toEqual({ existe: true, cerrado: false, anulado: true, closed_date: '' });
	});
});
```

- [ ] **Step 4: Correr el test y verificar que falla**

Run: `npx vitest run src/routes/api/cartera/cliente/[code]/cliente.test.js`
Expected: FAIL — `body.alta_nap` es `undefined`.

- [ ] **Step 5: Implementar en ambos endpoints**

En `src/routes/api/cartera/sync/+server.js`, actualizar el import:

```js
import { normalizarCliente, resumenTickets, resumenAltaNap } from '$lib/cartera/normalizar.js';
```

Y dentro de `snapshotDe`, sumar `alta_nap` al objeto `datos` devuelto:

```js
		return {
			code,
			ok: true,
			datos: {
				...normalizarCliente(cliente.customer.crudo ?? cliente.customer, nombrePorId),
				tickets: tickets.ok
					? resumenTickets(tickets.tickets, { areasSoporte, estadosCerrados })
					: null,
				// Mismos tickets crudos que ya trajo `getTickets` arriba: no es un
				// request extra a IspCube.
				alta_nap: tickets.ok ? resumenAltaNap(tickets.tickets, { estadosCerrados }) : null,
				pagos: cobranzas.ok ? pagosDeCobranzas(cobranzas.cobranzas) : null
			}
		};
```

En `src/routes/api/cartera/cliente/[code]/+server.js`, mismo import:

```js
import { normalizarCliente, resumenTickets, resumenAltaNap } from '$lib/cartera/normalizar.js';
```

Y en el `json(...)` que arma la respuesta:

```js
	return json({
		cliente: normalizarCliente(cliente.customer.crudo ?? cliente.customer, planes.ok ? planes.porId : undefined),
		tickets: tickets.ok
			? resumenTickets(tickets.tickets, { areasSoporte, estadosCerrados })
			: { error: tickets.reason },
		alta_nap: tickets.ok ? resumenAltaNap(tickets.tickets, { estadosCerrados }) : null,
		pagos: cobranzas.ok ? pagosDeCobranzas(cobranzas.cobranzas) : { error: cobranzas.reason }
	});
```

- [ ] **Step 6: Correr los tests y verificar que pasan**

Run: `npx vitest run src/routes/api/cartera/sync/snapshot.test.js "src/routes/api/cartera/cliente/[code]/cliente.test.js" "src/routes/api/cartera/cliente/[code]/server.test.js"`
Expected: PASS, todos los tests incluidos los preexistentes (el `server.test.js` de guardias no cambió, pero conviene correrlo junto para confirmar que nada se rompió).

- [ ] **Step 7: Commit**

```bash
git add src/routes/api/cartera/sync/+server.js src/routes/api/cartera/sync/snapshot.test.js \
  "src/routes/api/cartera/cliente/[code]/+server.js" "src/routes/api/cartera/cliente/[code]/cliente.test.js"
git commit -m "feat(cartera): sync y cliente/[code] devuelven alta_nap"
```

---

### Task 6: Endpoint `/api/cartera/candidatos`

**Files:**
- Create: `src/routes/api/cartera/candidatos/+server.js`
- Create: `src/routes/api/cartera/candidatos/server.test.js`
- Create: `src/routes/api/cartera/candidatos/candidatos.test.js`

`vi.mock` de Vitest se aplica a TODO el archivo (se hoistea al principio),
no se puede mezclar en el mismo archivo un test que necesita la
`verificarPermiso` real (para probar 401/403) con uno que la mockea para
saltarse el permiso. Por eso, mismo criterio que `sync/server.test.js` +
`sync/snapshot.test.js`: dos archivos separados.

- [ ] **Step 1: Escribir el test de guardias que falla**

Crear `src/routes/api/cartera/candidatos/server.test.js`:

```js
/**
 * Ver el comentario en ../catalogos/server.test.js: mismo motivo, mismo
 * patron. El comportamiento (paginado, filtro por vendedor, corte por
 * `antes` y por tope de paginas) se prueba aparte, en candidatos.test.js,
 * con verificarPermiso mockeado.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { GET } from './+server.js';
import * as ispcube from '$lib/server/ispcube.js';

vi.mock('$lib/server/ispcube.js', () => ({
	getCustomersPage: vi.fn(async () => {
		throw new Error('getCustomersPage no debe llamarse sin autenticacion');
	})
}));

afterEach(() => {
	vi.unstubAllGlobals();
});

const get = (qs, headers = {}) =>
	GET({ request: new Request(`http://x${qs}`, { headers }), url: new URL(`http://x${qs}`) });

describe('GET /api/cartera/candidatos - guardia de autenticacion', () => {
	it('devuelve 401 cuando falta el header Authorization', async () => {
		const r = await get('/api/cartera/candidatos?vendedor=64&antes=2026-07-01');
		expect(r.status).toBe(401);
	});

	it('no llama a IspCube cuando falta el header Authorization', async () => {
		await get('/api/cartera/candidatos?vendedor=64&antes=2026-07-01');
		expect(ispcube.getCustomersPage).not.toHaveBeenCalled();
	});
});

describe('GET /api/cartera/candidatos - guardia de autorizacion', () => {
	const stubFetchSinPermiso = () =>
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => ({
				ok: true,
				status: 200,
				json: async () => ({ record: { id: 'user-1', permisos: ['precios'] } })
			}))
		);

	it('devuelve 403 cuando el token es valido pero falta el permiso cartera', async () => {
		stubFetchSinPermiso();
		const r = await get('/api/cartera/candidatos?vendedor=64&antes=2026-07-01', {
			Authorization: 'Bearer tok-valido'
		});
		expect(r.status).toBe(403);
	});
});
```

- [ ] **Step 2: Correr el test de guardias y verificar que falla**

Run: `npx vitest run src/routes/api/cartera/candidatos/server.test.js`
Expected: FAIL — no existe `./+server.js` todavía.

- [ ] **Step 3: Escribir el test funcional que falla**

Crear `src/routes/api/cartera/candidatos/candidatos.test.js`:

```js
/**
 * Comportamiento de /api/cartera/candidatos con verificarPermiso mockeado
 * (la guardia ya esta cubierta en server.test.js) y getCustomersPage
 * mockeado para controlar el paginado sin pegarle a IspCube.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './+server.js';
import { getCustomersPage } from '$lib/server/ispcube.js';

vi.mock('$lib/server/adminAuth.js', () => ({
	verificarPermiso: vi.fn(async () => ({ ok: true, usuarioId: 'usuario-1' }))
}));

vi.mock('$lib/server/ispcube.js', () => ({
	getCustomersPage: vi.fn()
}));

const get = (qs) => GET({ request: new Request(`http://x${qs}`), url: new URL(`http://x${qs}`) });

beforeEach(() => {
	vi.mocked(getCustomersPage).mockReset();
});

describe('GET /api/cartera/candidatos - validacion de query params', () => {
	it('vendedor ausente o no numerico da 400', async () => {
		const r = await get('/api/cartera/candidatos?antes=2026-07-01');
		expect(r.status).toBe(400);
		expect((await r.json()).error).toBe('vendedor_invalido');
	});

	it('antes ausente o mal formado da 400', async () => {
		const r = await get('/api/cartera/candidatos?vendedor=64');
		expect(r.status).toBe(400);
		expect((await r.json()).error).toBe('antes_invalido');
	});
});

describe('GET /api/cartera/candidatos - filtrado y paginado', () => {
	const cliente = (over = {}) => ({
		id: 1,
		code: '000001',
		name: 'CLIENTE UNO',
		status: 'enabled',
		start_date: '2026-08-01 00:00:00',
		seller_id: 64,
		entity_id: null,
		debt: '0.00',
		duedebt: '0.00',
		connections: [],
		...over
	});

	it('filtra por seller_id, descarta a los de otro vendedor', async () => {
		vi.mocked(getCustomersPage)
			.mockResolvedValueOnce({
				ok: true,
				customers: [cliente({ code: '000001', seller_id: 64 }), cliente({ code: '000002', seller_id: 6 })]
			})
			.mockResolvedValue({ ok: true, customers: [] });

		const r = await get('/api/cartera/candidatos?vendedor=64&antes=2026-01-01');
		const body = await r.json();

		expect(body.candidatos.map((c) => c.code)).toEqual(['000001']);
	});

	it('descarta candidatos con start_date anterior a antes', async () => {
		vi.mocked(getCustomersPage)
			.mockResolvedValueOnce({
				ok: true,
				customers: [cliente({ code: '000001', seller_id: 64, start_date: '2025-01-01 00:00:00' })]
			})
			.mockResolvedValue({ ok: true, customers: [] });

		const r = await get('/api/cartera/candidatos?vendedor=64&antes=2026-01-01');
		const body = await r.json();

		expect(body.candidatos).toEqual([]);
	});

	it('corta de pedir mas paginas cuando la ultima fecha de la pagina ya es anterior a antes', async () => {
		vi.mocked(getCustomersPage).mockResolvedValue({
			ok: true,
			customers: Array.from({ length: 100 }, (_, i) =>
				cliente({ code: String(i).padStart(6, '0'), seller_id: 64, start_date: '2025-01-01 00:00:00' })
			)
		});

		await get('/api/cartera/candidatos?vendedor=64&antes=2026-01-01');

		expect(getCustomersPage).toHaveBeenCalledTimes(1);
	});

	it('respeta el tope duro de paginas aunque toda la pagina siga siendo reciente', async () => {
		vi.mocked(getCustomersPage).mockResolvedValue({
			ok: true,
			customers: Array.from({ length: 100 }, (_, i) =>
				cliente({ code: String(i).padStart(6, '0'), seller_id: 6, start_date: '2026-08-01 00:00:00' })
			)
		});

		await get('/api/cartera/candidatos?vendedor=64&antes=2026-01-01');

		expect(getCustomersPage).toHaveBeenCalledTimes(5);
	});
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npx vitest run src/routes/api/cartera/candidatos/server.test.js src/routes/api/cartera/candidatos/candidatos.test.js`
Expected: FAIL en ambos archivos — no existe `./+server.js` todavía.

- [ ] **Step 3: Implementar el endpoint**

Crear `src/routes/api/cartera/candidatos/+server.js`:

```js
/**
 * Candidatos para sumar a la Cartera por vendedor de IspCube.
 *
 * Pagina `GET /api/customers/customers_list` (viene ordenado por mas
 * reciente primero) y filtra por `seller_id` en este codigo -la API no
 * tiene filtro por vendedor, se probo `?seller_id=` y lo ignora, sondeado el
 * 2026-08-06-. No trae tickets ni cobranzas: eso lo completa el primer sync
 * normal de cada cliente (ver `descubrirCandidatosDeVendedor` en el store),
 * que ademas es donde se calcula `alta_nap`.
 *
 * Acotado por dos lados, para que un vendedor sin actividad reciente (o un
 * `antes` mal calculado) no dispare una paginada completa de toda la base:
 * un tope duro de paginas (`MAX_PAGINAS`) y `antes`, la fecha de alta mas
 * vieja que el asesor ya tiene en su cartera.
 */
import { json } from '@sveltejs/kit';
import { getCustomersPage } from '$lib/server/ispcube.js';
import { ispcubeConfig, pocketbaseUrl } from '$lib/server/ispcubeDeps.js';
import { verificarPermiso } from '$lib/server/adminAuth.js';
import { normalizarCliente } from '$lib/cartera/normalizar.js';
import { partesFecha, compararFechas } from '$lib/cartera/fechas.js';

export const prerender = false;
export const trailingSlash = 'ignore';

const TAMANO_PAGINA = 100;

/** 5 paginas x 100 = 500 clientes como mucho por llamada. */
const MAX_PAGINAS = 5;

/** @type {import('./$types').RequestHandler} */
export async function GET({ request, url }) {
	const auth = await verificarPermiso(request, pocketbaseUrl(), 'cartera');
	if (!auth.ok) {
		const status = auth.reason === 'sin_permiso' ? 403 : 401;
		return json({ error: auth.reason }, { status });
	}

	const vendedor = Number(url.searchParams.get('vendedor'));
	if (!Number.isFinite(vendedor) || vendedor <= 0) {
		return json({ error: 'vendedor_invalido' }, { status: 400 });
	}

	const antes = partesFecha(url.searchParams.get('antes'));
	if (!antes) return json({ error: 'antes_invalido' }, { status: 400 });

	const cfg = ispcubeConfig();
	const candidatos = [];

	for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
		const offset = pagina * TAMANO_PAGINA;
		const res = await getCustomersPage(offset, TAMANO_PAGINA, cfg);
		if (!res.ok || res.customers.length === 0) break;

		for (const crudo of res.customers) {
			const fecha = partesFecha(crudo?.start_date);
			// Sin fecha reconocible se prefiere incluirlo (no se puede juzgar su
			// antiguedad) a descartarlo en silencio.
			if (fecha && compararFechas(fecha, antes) < 0) continue;
			if (Number(crudo?.seller_id) === vendedor) candidatos.push(normalizarCliente(crudo));
		}

		const paginaCompleta = res.customers.length === TAMANO_PAGINA;
		const ultimaFecha = partesFecha(res.customers[res.customers.length - 1]?.start_date);
		if (!paginaCompleta) break;
		if (ultimaFecha && compararFechas(ultimaFecha, antes) < 0) break;
	}

	return json({ candidatos });
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npx vitest run src/routes/api/cartera/candidatos/server.test.js src/routes/api/cartera/candidatos/candidatos.test.js`
Expected: PASS, todos los tests de los dos archivos.

- [ ] **Step 5: Commit**

```bash
git add src/routes/api/cartera/candidatos/+server.js src/routes/api/cartera/candidatos/server.test.js \
  src/routes/api/cartera/candidatos/candidatos.test.js
git commit -m "feat(cartera): endpoint /api/cartera/candidatos"
```

---

### Task 7: Migración de esquema en `crear-colecciones-cartera.js`

**Files:**
- Modify: `scripts/crear-colecciones-cartera.js`

- [ ] **Step 1: Agregar las migraciones**

En `scripts/crear-colecciones-cartera.js`, en la sección
`--- migraciones de campos ---` de `main()`, después de la línea
`await agregarCampoSiFalta('cartera_clientes', json('connections'));`,
agregar:

```js
	// `alta_nap`, `nuevo` e `instalado_aviso` nacen con el alta automatica por
	// vendedor y el estado de instalacion derivado (spec del 2026-08-06).
	// `fecha_instalacion` nacio required porque la tipeaba el asesor a mano;
	// ahora se completa sola cuando se detecta que el ticket de NAP cerro, asi
	// que un cliente recien creado (a mano o por vendedor) puede no tenerla
	// todavia.
	await agregarCampoSiFalta('cartera_clientes', json('alta_nap'));
	await agregarCampoSiFalta('cartera_clientes', booleano('nuevo'));
	await agregarCampoSiFalta('cartera_clientes', booleano('instalado_aviso'));
	await ponerCampoOpcional('cartera_clientes', 'fecha_instalacion');
```

- [ ] **Step 2: Verificar en seco**

Run: `node scripts/crear-colecciones-cartera.js --dry-run`

Expected: entre otras líneas ya conocidas (colecciones que se saltean por ya
existir), aparecen estas cuatro nuevas:

```
- cartera_clientes.alta_nap: SE AGREGARIA.
- cartera_clientes.nuevo: SE AGREGARIA.
- cartera_clientes.instalado_aviso: SE AGREGARIA.
- cartera_clientes.fecha_instalacion: SE PONDRIA opcional.
```

Si en cambio dice "ya existe, se saltea" o "ya es opcional, se saltea" para
alguno, revisar que el nombre del campo coincida exacto con lo que ya hay en
producción antes de seguir.

- [ ] **Step 3: Aplicar contra PocketBase**

Esto requiere las credenciales de superuser de PocketBase (se piden por
consola, ver el comentario al inicio del script) — no es automatizable en
CI, lo corre quien tenga esas credenciales:

Run: `node scripts/crear-colecciones-cartera.js`

Expected: las mismas cuatro líneas de arriba, ahora sin "SE AGREGARIA"/"SE
PONDRIA", terminando en "agregado."/"ahora es opcional.".

- [ ] **Step 4: Commit**

```bash
git add scripts/crear-colecciones-cartera.js
git commit -m "feat(cartera): migracion de esquema para alta por vendedor y estado de instalacion"
```

---

### Task 8: `carteraStore.svelte.js` — `agregar()` sin fecha manual

**Files:**
- Modify: `src/routes/admin/_components/mantenimiento/Dashboard/cartera/carteraStore.svelte.js`

No hay test unitario del store (no existe hoy, ver los archivos de test que
sí hay en el directorio: son todos de los módulos que el store importa). La
verificación de esta tarea es manual, en el Task 13.

- [ ] **Step 1: Actualizar el import de `instalacion.js`**

Al inicio de `carteraStore.svelte.js`, sumar el import nuevo junto a los que
ya están:

```js
import { estadoInstalacionDe } from '$lib/cartera/instalacion.js';
```

- [ ] **Step 2: Reemplazar `agregar()`**

Reemplazar la función `agregar` completa (desde
`async function agregar(code, fechaInstalacion) {` hasta su `}` de cierre)
por:

```js
async function agregar(code) {
	if (!/^\d{1,12}$/.test(code)) {
		return { ok: false, error: 'El número de cliente son solo dígitos.' };
	}
	if (clientes.some((c) => c.code === code)) {
		return { ok: false, error: 'Ese cliente ya está en tu cartera.' };
	}

	try {
		const existente = await buscarExistente(code);
		if (existente && !existente.archivado) {
			return { ok: false, error: 'Ese cliente ya está en tu cartera.' };
		}
		if (existente && existente.archivado) {
			// Se reactiva tal cual estaba, sin tocar su fecha_instalacion: ya la
			// tenia cargada (a mano de antes de este cambio, o completada sola por
			// un sync), y no hay motivo para pisarla.
			const restaurado = await pb.collection(CLIENTES).update(existente.id, { archivado: false });
			clientes = [restaurado, ...clientes];
			return { ok: true, cliente: restaurado };
		}

		const res = await fetch(`/api/cartera/cliente/${encodeURIComponent(code)}`, {
			headers: { Authorization: `Bearer ${pb.authStore.token}` }
		});

		if (res.status === 404) return { ok: false, error: 'No encontramos ese número de cliente.' };
		if (res.status === 401) return { ok: false, error: ERROR_401 };
		if (res.status === 403) return { ok: false, error: ERROR_403 };
		if (!res.ok) return { ok: false, error: 'No pudimos consultar IspCube. Probá de nuevo.' };

		const datos = await res.json();
		const connections = Array.isArray(datos.cliente.connections) ? datos.cliente.connections : [];
		const altaNap = datos.alta_nap ?? { existe: false, cerrado: false, anulado: false, closed_date: '' };
		// Caso borde: un cliente que se agrega a mano cuando su ticket de NAP ya
		// estaba cerrado desde antes (por ejemplo, se cargo tarde). No dispara el
		// aviso "instalado" -no es una transicion, es su estado de entrada-, pero
		// si completa la fecha real de una.
		const estado = estadoInstalacionDe({ connections, alta_nap: altaNap });

		const registro = {
			asesor: pb.authStore.record.id,
			code,
			fecha_instalacion: estado === 'instalado' ? altaNap.closed_date : '',
			nombre: datos.cliente.nombre,
			estado: datos.cliente.estado,
			start_date: datos.cliente.start_date,
			entity_id: datos.cliente.entity_id,
			entity_nombre: datos.cliente.entity_nombre,
			perfil_pago: perfilDe(datos.cliente.entity_id, config.entidades_tarjeta, datos.cliente.comercial_activity),
			perfil_manual: false,
			debt: datos.cliente.debt,
			duedebt: datos.cliente.duedebt,
			connections,
			promos: Array.isArray(datos.cliente.promos) ? datos.cliente.promos : [],
			pagos: Array.isArray(datos.pagos) ? datos.pagos : [],
			tickets: datos.tickets?.error ? null : datos.tickets,
			alta_nap: altaNap,
			nuevo: false,
			instalado_aviso: false,
			tickets_vistos_hasta: '',
			ultimo_contacto: '',
			sincronizado: new Date().toISOString(),
			archivado: false
		};

		const creado = await pb.collection(CLIENTES).create(registro);
		clientes = [creado, ...clientes];
		return { ok: true, cliente: creado };
	} catch (e) {
		console.error(e);
		return { ok: false, error: 'No se pudo agregar el cliente.' };
	}
}
```

- [ ] **Step 3: Verificación de tipos/lint**

Run: `npm run check`
Expected: sin errores nuevos atribuibles a este archivo (puede haber avisos
preexistentes ajenos a este cambio; no son responsabilidad de esta tarea).

- [ ] **Step 4: Commit**

```bash
git add src/routes/admin/_components/mantenimiento/Dashboard/cartera/carteraStore.svelte.js
git commit -m "feat(cartera): agregar() ya no pide fecha de instalacion a mano"
```

---

### Task 9: `carteraStore.svelte.js` — `guardarSnapshot()` con `alta_nap`, `instalado_aviso` y `nuevo`

**Files:**
- Modify: `src/routes/admin/_components/mantenimiento/Dashboard/cartera/carteraStore.svelte.js`

- [ ] **Step 1: Reemplazar `guardarSnapshot`**

Reemplazar la función `guardarSnapshot` completa por:

```js
async function guardarSnapshot(code, datos) {
	const actual = clientes.find((c) => c.code === code);
	if (!actual) return;

	const perfil = actual.perfil_manual
		? actual.perfil_pago
		: perfilDe(datos.entity_id, config.entidades_tarjeta, datos.comercial_activity);

	const connections = Array.isArray(datos.connections) ? datos.connections : [];
	// `datos.alta_nap` puede faltar si `/sync` no pudo traer tickets esta vez
	// (IspCube caido puntual): se conserva el ultimo valor conocido en vez de
	// perderlo.
	const altaNap = datos.alta_nap ?? actual.alta_nap ?? {
		existe: false,
		cerrado: false,
		anulado: false,
		closed_date: ''
	};

	// La transicion se detecta comparando el estado ANTES de este parche
	// contra el que resulta de aplicarlo. La formula se escribe en CADA sync,
	// nunca solo cuando da true: la sync siguiente a una transicion encuentra
	// `estadoViejo === 'instalado'` (porque ya quedo guardado asi) y da false
	// sola, sin logica de "apagar" aparte.
	const estadoViejo = estadoInstalacionDe(actual);
	const estadoNuevo = estadoInstalacionDe({ connections, alta_nap: altaNap });
	const instaladoAviso = estadoNuevo === 'instalado' && estadoViejo !== 'instalado';

	const parche = {
		nombre: datos.nombre,
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
		parche.pagos = fusionarPagos(actual.pagos, datos.pagos, hoyPartes());
	}
	if (datos.tickets) parche.tickets = datos.tickets;

	try {
		const guardado = await pb.collection(CLIENTES).update(actual.id, parche);
		clientes = clientes.map((c) => (c.id === guardado.id ? guardado : c));
	} catch (e) {
		console.error('[cartera] no se pudo guardar el snapshot de', code, e);
	}
}
```

- [ ] **Step 2: Verificación de tipos/lint**

Run: `npm run check`
Expected: sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add src/routes/admin/_components/mantenimiento/Dashboard/cartera/carteraStore.svelte.js
git commit -m "feat(cartera): guardarSnapshot detecta la transicion a instalado y completa la fecha"
```

---

### Task 10: `carteraStore.svelte.js` — descubrimiento de candidatos por vendedor

**Files:**
- Modify: `src/routes/admin/_components/mantenimiento/Dashboard/cartera/carteraStore.svelte.js`

- [ ] **Step 1: Sumar `sumarMeses` al import de `fechas.js`**

Cambiar:

```js
import { partesFecha } from '$lib/cartera/fechas.js';
```

por:

```js
import { partesFecha, sumarMeses } from '$lib/cartera/fechas.js';
```

- [ ] **Step 2: Refactorizar `hoyISO` para reusar un formateador**

Buscar la función privada `hoyISO()` (la que usa `marcarContactado`) y
reemplazarla por:

```js
/** `{anio, mes, dia}` a `"YYYY-MM-DD"`. */
function fechaISO(partes) {
	return `${partes.anio}-${String(partes.mes).padStart(2, '0')}-${String(partes.dia).padStart(2, '0')}`;
}

/**
 * Fecha de hoy como `YYYY-MM-DD`, sin pasar por toISOString (que es UTC).
 *
 * No se exporta: hoy por hoy solo la usan `marcarContactado` (para sellar
 * `ultimo_contacto`) y `descubrirCandidatosDeVendedor` (para el fallback de
 * `antes` con una cartera vacia), y ninguna depende de datos de IspCube (a
 * diferencia de `fechas.js`, que solo parsea fechas que vienen de la API).
 */
function hoyISO() {
	return fechaISO(hoyPartes());
}
```

(Es el mismo comentario de antes, actualizado para mencionar el segundo uso
que se suma en el próximo Step.)

- [ ] **Step 3: Agregar `descubrirCandidatosDeVendedor`**

Agregar esta función nueva, después de `refrescarVencidos` (antes de
`sincronizar`, o en cualquier punto del archivo antes de que `cargar` la
use — el orden de declaración de funciones no importa en JS, pero para
mantener el archivo legible conviene cerca de `refrescarVencidos`, que
cumple un rol parecido: dispara trabajo de fondo al cargar):

```js
/**
 * Busca clientes nuevos por vendedor y los suma solos a la cartera.
 *
 * Sin `id_vendedor` en el usuario autenticado (columna que se carga a mano
 * en PocketBase, fuera de este codigo), no hace nada: el asesor simplemente
 * no participa. Ver el spec del 2026-08-06.
 */
async function descubrirCandidatosDeVendedor() {
	const idVendedor = pb.authStore.record?.id_vendedor;
	if (!idVendedor) return;

	const activos = clientes.filter((c) => !c.archivado && c.start_date);
	// YYYY-MM-DD compara bien como string (mismo criterio que ya usa pagos.js
	// con las claves de mes): no hace falta pasar por partesFecha/compararFechas
	// para un minimo.
	const antes =
		activos.length > 0
			? activos.reduce((min, c) => (c.start_date < min ? c.start_date : min), activos[0].start_date)
			: fechaISO(sumarMeses(hoyPartes(), -1));

	try {
		const res = await fetch(
			`/api/cartera/candidatos?vendedor=${encodeURIComponent(idVendedor)}&antes=${antes}`,
			{ headers: { Authorization: `Bearer ${pb.authStore.token}` } }
		);
		if (!res.ok) return;

		const { candidatos } = await res.json();
		const conocidos = new Set(clientes.map((c) => c.code));

		for (const candidato of candidatos) {
			if (conocidos.has(candidato.code)) continue;
			conocidos.add(candidato.code);

			try {
				const creado = await pb.collection(CLIENTES).create({
					asesor: pb.authStore.record.id,
					code: candidato.code,
					fecha_instalacion: '',
					nombre: candidato.nombre,
					estado: candidato.estado,
					start_date: candidato.start_date,
					entity_id: candidato.entity_id,
					entity_nombre: candidato.entity_nombre,
					perfil_pago: perfilDe(candidato.entity_id, config.entidades_tarjeta, candidato.comercial_activity),
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
				});
				clientes = [creado, ...clientes];
			} catch (e) {
				// Un create que rebota (por ejemplo el indice unico si dos pestanias
				// corren el descubrimiento a la vez) no debe tumbar a los demas
				// candidatos del lote.
				console.error('[cartera] no se pudo sumar el candidato', candidato.code, e);
			}
		}
	} catch (e) {
		console.error('[cartera] fallo el descubrimiento de candidatos por vendedor:', e);
	}
}
```

- [ ] **Step 4: Engancharlo en `cargar()`**

En `cargar()`, junto a la línea que ya dispara `refrescarVencidos()` sin
`await` al final de la función, agregar la línea nueva justo debajo:

```js
	// Deliberadamente sin await: la lista pinta con el snapshot tal cual esta,
	// y el refresco contra IspCube llega despues y va actualizando filas. Pero
	// sincronizar() es async y puede rechazar (fetch caido, etc.); sin este
	// catch esa promesa quedaria colgando como una unhandled rejection.
	refrescarVencidos().catch((e) => console.error('[cartera] fallo el refresco automatico:', e));
	// Mismo criterio: no bloquea el pintado de la lista existente.
	descubrirCandidatosDeVendedor().catch((e) =>
		console.error('[cartera] fallo el descubrimiento de candidatos:', e)
	);
}
```

- [ ] **Step 5: Verificación de tipos/lint**

Run: `npm run check`
Expected: sin errores nuevos.

- [ ] **Step 6: Commit**

```bash
git add src/routes/admin/_components/mantenimiento/Dashboard/cartera/carteraStore.svelte.js
git commit -m "feat(cartera): descubrir y sumar clientes nuevos por vendedor al cargar"
```

---

### Task 11: `AgregarCliente.svelte` — sacar el campo de fecha

**Files:**
- Modify: `src/routes/admin/_components/mantenimiento/Dashboard/cartera/AgregarCliente.svelte`

- [ ] **Step 1: Sacar el estado y la llamada a `hoyISO`/`fecha`**

Reemplazar el bloque `<script>` completo por:

```svelte
<script>
// Alta en dos pasos: primero se valida el numero contra IspCube y se muestra
// el nombre para que el asesor confirme que es quien cree.
//
// Ya no se pide la fecha de instalacion: se completa sola cuando el ticket de
// "alta reserva de NAP" cierra (ver carteraStore.agregar y el spec del
// 2026-08-06). Antes se pedia a mano porque `start_date` de IspCube no sirve
// para esto -no es la fecha de instalacion real-, pero ahora hay una fuente
// mejor que tipearla: el cierre del ticket.
import { carteraStore } from './carteraStore.svelte.js';

let { onCerrar } = $props();

let code = $state('');
let guardando = $state(false);
let error = $state('');

async function guardar() {
    error = '';
    guardando = true;
    const r = await carteraStore.agregar(code.trim());
    guardando = false;

    if (r.ok) onCerrar();
    else error = r.error;
}
</script>
```

- [ ] **Step 2: Sacar el input de fecha del formulario**

Quitar estas dos líneas del `<form>` (el label y el input de "Fecha de
instalación"):

```svelte
            <label for="fecha">Fecha de instalación</label>
            <input id="fecha" type="date" bind:value={fecha} disabled={guardando} />
```

El resto del `<form>` (input de código, ayuda, error, botones) queda igual.

- [ ] **Step 3: Verificación manual**

Con el dev server corriendo, abrir "Agregar cliente": el formulario debe
mostrar solo el campo de número de cliente, sin el de fecha. (La
verificación completa en el navegador es el Task 13; este paso es solo para
confirmar que el componente no quedó roto visualmente antes de seguir.)

- [ ] **Step 4: Commit**

```bash
git add src/routes/admin/_components/mantenimiento/Dashboard/cartera/AgregarCliente.svelte
git commit -m "feat(cartera): sacar el campo de fecha de instalacion del alta manual"
```

---

### Task 12: `Cartera.svelte` — chips nuevos, badges y estado de instalación

**Files:**
- Modify: `src/routes/admin/_components/mantenimiento/Dashboard/cartera/Cartera.svelte`

- [ ] **Step 1: Import de `estadoInstalacionDe`**

Sumar junto a los imports existentes:

```js
import { estadoInstalacionDe } from '$lib/cartera/instalacion.js';
```

- [ ] **Step 2: `PESO`, `ETIQUETAS` y `ORDEN_CHIP`**

Cambiar la constante `PESO`:

```js
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
```

Cambiar `ETIQUETAS` (sumar dos claves, mismo objeto):

```js
const ETIQUETAS = {
	seguimiento: 'Contactar (2 meses)',
	mora_1: 'No pagó',
	mora_2: 'Mora vencida',
	tickets: 'Ticket nuevo',
	recordatorio: 'Recordatorio',
	promo_venciendo: 'Promo por vencer',
	nap_faltante: 'Sin reserva de NAP',
	nap_anulado: 'NAP anulado'
};
```

Cambiar `ORDEN_CHIP` (los nap entran entre `tickets` y `recordatorio`,
comparten posición porque son mutuamente excluyentes):

```js
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
```

Sumar, junto a `ETIQUETA_ESTADO_PUNTO`, el mapa para el estado de
instalación (sin entrada para `instalado`: nunca se muestra):

```js
const ETIQUETA_ESTADO_INSTALACION = {
	pendiente_pago: 'Pendiente de pago',
	instalacion_pendiente: 'Instalación pendiente'
};
```

- [ ] **Step 3: Sumar `estadoInstalacion` al derived `conAlertas`**

Dentro de `conAlertas`, agregar el campo al objeto que se devuelve por
cliente:

```js
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
			estadoInstalacion: estadoInstalacionDe(c)
		};
	});
});
```

- [ ] **Step 4: Destructurar `estadoInstalacion` en el `{#each}` y agregar los badges**

Cambiar la línea del `{#each}`:

```svelte
{#each visibles as { cliente, alertas, urgencia, chips, estadoInstalacion } (cliente.id)}
```

Y dentro de esa fila, reemplazar el bloque `.quien` actual:

```svelte
                        <div class="quien">
                            <strong>{cliente.nombre}</strong>
                            <span class="code">{cliente.code}</span>
                        </div>
```

por:

```svelte
                        <div class="quien">
                            <div class="nombre-linea">
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
                            </div>
                            <span class="code">{cliente.code}</span>
                            {#if estadoInstalacion !== 'instalado'}
                                <span class="estado-instalacion">
                                    {ETIQUETA_ESTADO_INSTALACION[estadoInstalacion]}
                                </span>
                            {/if}
                        </div>
```

- [ ] **Step 5: CSS**

Agregar, junto a las reglas `.chip.*` existentes:

```css
/* Mismo amber que mora_1/tickets: anomalia de proceso, no un vencimiento,
   pero tampoco algo para ignorar. */
.chip.nap_faltante, .chip.nap_anulado { background: #fef3c7; color: #92400e; }
```

Reemplazar la regla `.quien` existente y agregar las nuevas, junto a donde
está `.quien`/`.quien strong`/`.code`:

```css
.quien { display: flex; flex-direction: column; gap: 0.15em; min-width: 0; }
.nombre-linea { display: flex; align-items: center; gap: 0.4em; min-width: 0; }
.nombre-linea strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.code { color: #9ca3af; font-size: 0.85em; }
/* "Nuevo": mismo cyan que .chip.promo (informativo, deducido de IspCube).
   "Instalado": mismo verde que .chip.rec-proximo. Cero paletas nuevas. */
.badge {
    font-size: 0.68em; font-weight: 700; padding: 0.15em 0.55em; border-radius: 1em;
    white-space: nowrap; text-transform: uppercase; letter-spacing: 0.02em; flex-shrink: 0;
}
.badge.nuevo { background: #cffafe; color: #155e75; }
.badge.instalado { background: #d1fae5; color: #065f46; }
/* Discreto a proposito: instalacion_pendiente/pendiente_pago se muestran,
   pero sin la fuerza visual de una alerta -no lo son-. */
.estado-instalacion { color: #92400e; font-size: 0.78em; font-weight: 600; }
```

(Borrar la regla `.quien strong { ... }` vieja: la reemplaza
`.nombre-linea strong` de arriba, mismo estilo, nuevo selector porque
`strong` ahora vive un nivel más adentro.)

- [ ] **Step 6: Verificación de tipos/lint**

Run: `npm run check`
Expected: sin errores nuevos.

- [ ] **Step 7: Commit**

```bash
git add src/routes/admin/_components/mantenimiento/Dashboard/cartera/Cartera.svelte
git commit -m "feat(cartera): chips de NAP, badges nuevo/instalado y estado de instalacion en la fila"
```

---

### Task 13: Verificación manual en el navegador

**Files:** ninguno (solo verificación)

- [ ] **Step 1: Levantar el dev server y correr toda la suite**

Run: `npm test`
Expected: PASS, 0 fallos.

- [ ] **Step 2: Verificar el alta manual sin fecha**

Con el dev server levantado, abrir la Cartera, click en "Agregar cliente",
cargar un número de cliente real que exista en IspCube y confirmar. El
formulario no debe pedir fecha. El cliente creado debe aparecer en la lista;
si todavía no está habilitado, la fila debe mostrar "Pendiente de pago" (o
"Instalación pendiente" si ya tiene conexión pero el ticket de NAP sigue
abierto) debajo del código.

- [ ] **Step 3: Verificar el descubrimiento por vendedor**

En un usuario de PocketBase con `id_vendedor` cargado (ver el prerrequisito
al inicio de este plan), abrir la Cartera y confirmar en las devtools
(pestaña Network) que se dispara un `GET /api/cartera/candidatos?...`. Si
devuelve candidatos nuevos, deben aparecer en la lista con el badge "Nuevo"
junto al nombre.

- [ ] **Step 4: Verificar que el badge "Nuevo" se apaga solo**

Sobre uno de esos clientes recién creados, forzar un sync (botón "↻
Actualizar", o esperar a que corra el automático: como se crean con
`sincronizado` vacío, `aRefrescar` los toma como prioritarios en la
siguiente carga de la página). Recargar la página: el badge "Nuevo" ya no
debe aparecer.

- [ ] **Step 5: Verificar el aviso "Instalado"**

Sobre un cliente en estado `instalacion_pendiente` (habilitado, ticket de
NAP todavía abierto), cerrar el ticket en IspCube (o esperar a que se cierre
en el flujo real) y forzar un sync. La fila debe mostrar el badge "Instalado
✓" y la columna de puntos de pago debe empezar a considerar la fecha real de
instalación (visible al abrir el detalle del cliente, o comparando contra
`fecha_instalacion` en PocketBase). Un segundo sync posterior debe hacer
desaparecer el badge.

- [ ] **Step 6: Verificar las alertas de NAP**

Con un cliente habilitado sin ticket de NAP (o con uno anulado, si hay algún
caso real a mano), confirmar que aparece el chip correspondiente
("Sin reserva de NAP" / "NAP anulado") en color ámbar, y que suma al borde
de urgencia de la fila igual que mora/tickets.

---

## Self-Review

**Cobertura del spec:** las tres secciones del spec
(`docs/superpowers/specs/2026-08-06-cartera-vendedor-y-estado-instalacion-design.md`)
tienen tarea: descubrimiento por vendedor + badge "nuevo" → Tasks 4, 6, 7,
10, 12; fecha de instalación automática → Tasks 1, 5, 8, 9, 11; estado de
instalación + alertas del NAP → Tasks 1, 2, 3, 9, 12. El cambio de esquema
(sección 6 del spec) → Task 7.

**Placeholders:** ninguno queda; el único texto "placeholder" que aparece en
el plan (Task 2, Step 1) es intencional y se corrige explícitamente dentro
del mismo step, con el código final ya escrito sin ambigüedad.

**Consistencia de tipos:** `estadoInstalacionDe(cliente)` se llama siempre
con `{connections, alta_nap}` (Tasks 2, 3 vía `alertasDe` que recibe el
`cliente` completo — mismo shape —, 9, 12). `resumenAltaNap(tickets,
{estadosCerrados})` se llama siempre con esa misma firma (Tasks 1, 5). El
shape de `alta_nap` (`{existe, cerrado, anulado, closed_date}`) es el mismo
en `normalizar.js`, `instalacion.js`, `alertas.js`, ambos endpoints y el
store.

## Execution Handoff

Plan completo, guardado en
`docs/superpowers/plans/2026-08-06-cartera-vendedor-y-estado-instalacion.md`.
