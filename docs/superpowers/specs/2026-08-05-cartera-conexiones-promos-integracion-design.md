# Cartera — integración de conexiones y promos activas — diseño

Fecha: 2026-08-05
Estado: por implementar

## Contexto

Dos diseños previos, escritos en sesiones separadas, agregan cada uno una feature a la
Cartera a partir de la misma fuente de datos (`connections[]`, ya presente en la respuesta
de `GET /api/customer` que el sync pide hoy):

- [`2026-08-04-cartera-promos-activas-design.md`](./2026-08-04-cartera-promos-activas-design.md):
  promos activas por conexión y alerta `promo_venciendo`.
- [`2026-08-05-cartera-chips-conexiones-design.md`](./2026-08-05-cartera-chips-conexiones-design.md):
  chips de plan contratado en el detalle del cliente.

La mayoría de cada diseño queda sin cambios y no se repite acá — este documento cubre
**solo la integración**: los puntos donde ambos tocan el mismo código y las decisiones que
hubo que tomar para que convivan. Para el detalle completo de cada feature (razones de cada
decisión, CSS, tests no afectados por la integración), ver los dos documentos originales.

## Qué cambia por la integración

### 1. `normalizarCliente()` — un solo recorrido de `connections[]`

Los dos diseños originales recorrían `crudo.connections` por separado: `promosDe()` (spec de
promos) y un `.map()` inline (spec de conexiones). Quedan unificados en una sola función
interna de `src/lib/cartera/normalizar.js`, `conexionesDe(crudo)`, que filtra las conexiones
borradas una sola vez y arma los dos arrays desde ahí:

```js
/**
 * @param {any} crudo
 * @returns {{
 *   connections: {plan_id: number|null, plan_nombre: string}[],
 *   promos: {conexion_id: number, plan_nombre: string, promo_nombre: string,
 *     beneficio: string, inicio: string, fin: string}[]
 * }}
 */
function conexionesDe(crudo) {
	const vivas = (Array.isArray(crudo?.connections) ? crudo.connections : [])
		.filter((c) => !c?.delete_date && !c?.deleted_in_provider);

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

`normalizarCliente` suma `...conexionesDe(c)` a lo que ya devuelve, quedando con dos campos
nuevos: `connections` y `promos`.

**Por qué un solo recorrido y no dos funciones separadas:** ambas listas parten del mismo
filtro de "conexión viva" (`!delete_date && !deleted_in_provider`). El spec de promos ya lo
aplicaba; el spec de conexiones no lo mencionaba, y sin él el chip de plan mostraría
conexiones dadas de baja en IspCube. Con un solo recorrido ese filtro se escribe una vez y
no puede desincronizarse entre las dos listas.

**Corrección de un dato asumido:** el spec de conexiones dejaba abierto si el nombre del
plan viene como `plan_id`/`plan_name` planos en cada item de `connections[]`, a confirmar
contra una respuesta real. El spec de promos, un día después, sondeó una respuesta real
(cliente `012377`) y confirmó la forma real: el plan viene anidado, `c.plan.name`, no
`c.plan_name`. La integración usa el dato confirmado (`c.plan?.name`) en vez de la
suposición sin confirmar. El fragmento real de esa sección 1 del spec de promos sirve de
fixture también para el test de `connections`.

Con `connections` ausente, no-array, o sin conexiones vivas, ambos campos quedan en `[]`
(mismo criterio defensivo que ya usa el resto de la función).

### 2. PocketBase: dos campos, un solo paso de migración

`scripts/crear-colecciones-cartera.js`, sección `cartera_clientes` (línea ~328, junto a
`json('pagos')` / `json('tickets')`): se agregan `json('promos')` y `json('connections')` en
la misma pasada. Mismo mecanismo idempotente que ya usa el script — correrlo de nuevo agrega
los campos sin tocar los existentes. Dry-run primero, como ya es el patrón del repo para este
script.

### 3. `ClienteDetalle.svelte` — único componente con overlap de ubicación

Los dos diseños agregan bloques a este archivo en zonas distintas, que no compiten por el
mismo lugar. De arriba a abajo, después de la integración:

1. `.alertas` (existente) — gana la rama `{:else if a.tipo === 'promo_venciendo'}` del spec
   de promos.
2. **Bloque `.conexiones`** (nuevo, spec de conexiones) — chips de plan contratado.
3. `<dl class="datos">` (existente, sin cambios).
4. `TicketsCliente` (existente, sin cambios).
5. Sección "Pagos" (existente, sin cambios).
6. **Sección "Promos activas"** (nueva, spec de promos) — entre Pagos y `AnotacionesCliente`.
7. `AnotacionesCliente` (existente, sin cambios).

Cada bloque nuevo va exactamente donde su spec original lo ubicaba. El único elemento
compartido entre ambos es el helper local `fmtFecha` (formateo `DD/MM/AAAA` a mano, sin
`new Date(iso)`) que ya preveía el spec de promos para la rama de alerta y la sección de
promos activas — se define una sola vez en el `<script>` del componente y no hace falta
tocarlo por la parte de conexiones, que no formatea fechas.

### 4. El resto, sin cambios

- `alertas.js` / `fechas.js`: `diferenciaDias`, `promosActivas`, quinto parámetro de
  `alertasDe`, alerta `promo_venciendo` — igual que el spec de promos.
- `src/lib/cartera/planes.js` (nuevo): `NOMBRES_PLAN` + `nombreCortoPlan()` — igual que el
  spec de conexiones.
- `carteraStore.svelte.js`: `alertasDeCliente` pasa `cliente.promos ?? []` como quinto
  argumento — igual que el spec de promos. Sin estado nuevo para `connections`: se lee
  directo de `actual.connections`, como ya decidía el spec de conexiones.
- `Cartera.svelte`: chips `.promo` / `.promo_venciendo`, peso, etiqueta, filtro — igual que
  el spec de promos. El spec de conexiones no toca este archivo (decisión ya tomada: los
  chips de plan son solo de detalle).

## Tests

Unión de los dos planes de test originales, con un ajuste: los casos de
`normalizar.test.js` para `connections` y `promos` comparten la fixture del fragmento real
(cliente `012377`, sección 1 del spec de promos) en vez de tener cada uno la suya, porque
ambos ahora salen del mismo `conexionesDe()`. Se agrega un caso nuevo para el filtro de
conexión borrada (`delete_date` o `deleted_in_provider`) aplicado también a `connections`,
que el spec de conexiones no cubría.

## Orden de implementación

1. `fechas.js`: `diferenciaDias` + test.
2. `normalizar.js`: `conexionesDe()` unificada (con el fix de `plan.name`) + test.
3. `planes.js` (nuevo) + test.
4. Script: campos `promos` y `connections` en `cartera_clientes`. Dry-run primero.
5. `alertas.js`: `promosActivas`, quinto parámetro de `alertasDe`, alerta `promo_venciendo`
   + tests.
6. `carteraStore.svelte.js`: pasar `cliente.promos` en `alertasDeCliente`.
7. `Cartera.svelte`: chips de promo, peso, etiqueta, filtro.
8. `ClienteDetalle.svelte`: bloque `.conexiones`, rama de alerta `promo_venciendo`, sección
   "Promos activas".

Los pasos 1–6 se verifican con tests. El 7 y 8 son interfaz, verificación manual en el
navegador.
