# Chips de conexiones en el detalle de cliente

Fecha: 2026-08-05
Estado: por implementar

## El problema

En el modal de detalle de un cliente de la Cartera no hay forma de ver qué
conexión (o conexiones) tiene contratada sin salir a IspCube. Se quiere ver
de un vistazo el plan de cada conexión, con nombres cortos para los planes
más comunes en vez del nombre completo que devuelve IspCube.

## Decisiones tomadas

| Decisión | Elegido | Por qué |
|---|---|---|
| Origen de los datos | Snapshot sincronizado, no fetch en vivo | `GET /api/customer` (ya se pide en cada sync) trae `connections[]` anidado; no hace falta un request nuevo |
| Ubicación en la UI | Chips sueltos arriba del `<dl class="datos">` | Mismo lugar/patrón visual que los chips de alertas, sin pelear por ancho con Medio de pago / Cuenta |
| Contenido del chip | Solo nombre del plan (sin estado) | Más limpio; el estado de la conexión no forma parte de este pedido |
| Nombres desconocidos | Nombre completo truncado con CSS + `title` | No hace falta lógica de truncado en JS; el hover muestra el nombre completo |
| Diccionario de nombres cortos | Archivo de código estático | Lo mantiene quien toca código, sin UI de administración para esto |
| Sin conexiones | Chip gris "Sin conexiones" | La fila queda siempre visible, no depende de contar `length` en la plantilla |

## Arquitectura

```
sync/+server.js
  └─ normalizarCliente(crudo)  →  suma `connections: [{plan_id, plan_nombre}]`
       (cartera/normalizar.js)      leído de `crudo.connections[]`, defensivo

carteraStore (cliente)
  └─ guarda `connections` en cartera_clientes.connections (json), igual que
     ya hace con `pagos`/`tickets`

ClienteDetalle.svelte
  └─ nuevo bloque `.conexiones` (chips), usa `nombreCortoPlan()`
       (cartera/planes.js, puro, sin red)
```

### 1. `normalizarCliente()` — `src/lib/cartera/normalizar.js`

Se agrega un campo `connections` al objeto que devuelve, leyendo
`crudo.connections`:

```js
connections: Array.isArray(c.connections)
  ? c.connections.map((cx) => ({
      plan_id: cx?.plan_id ?? null,
      plan_nombre: typeof cx?.plan_name === 'string' ? cx.plan_name : ''
    }))
  : []
```

**Riesgo abierto:** la forma exacta de cada item de `connections[]` no está
documentada (`docs/ispcube-api.md` solo dice "Anidados"). Se asume
`plan_id`/`plan_name` porque es el nombre de campo que usa el resto de la API
(`GET /api/connection` documenta `plan_id`) pero hay que confirmarlo contra
una respuesta real en el primer sync de prueba. Si el nombre viene con otra
clave, es un cambio de una línea en este mapeo — no afecta al resto del
diseño. Con `connections` ausente o no-array, el resultado es `[]` (mismo
criterio defensivo que ya usa el resto de la función).

No se agrega un test que dependa de la forma real hasta confirmarla; el test
que sí se escribe (ver Tests) cubre el contrato defensivo (array vacío,
items sin `plan_name`, `crudo` sin `connections`).

### 2. Persistencia — `scripts/crear-colecciones-cartera.js`

Se agrega `json('connections')` a los `fields` de `cartera_clientes`
(línea 328, junto a `pagos`/`tickets`). Mismo mecanismo de migración
idempotente que ya usa el resto del archivo — correrlo de nuevo agrega el
campo sin tocar los existentes.

El guardado real lo sigue haciendo el navegador con el token del asesor
(`carteraStore`), como ya pasa con `pagos`/`tickets`; `sync/+server.js` no
escribe en PocketBase y no necesita cambios más allá de que
`normalizarCliente` ya viaja completo en `datos`.

### 3. Diccionario — `src/lib/cartera/planes.js` (nuevo, puro)

```js
/** Nombres cortos para los planes más comunes, por `plan_id` de IspCube. */
export const NOMBRES_PLAN = {
  // 27: 'Power',
};

/** @param {number|string|null} planId @param {string} nombreCompleto */
export function nombreCortoPlan(planId, nombreCompleto) {
  return NOMBRES_PLAN[planId] ?? nombreCompleto;
}
```

Arranca vacío o con los pares que el usuario ya conoce; se completa con el
tiempo a medida que aparecen planes nuevos en producción.

### 4. `ClienteDetalle.svelte`

Bloque nuevo entre `.alertas` (línea 133-149) y `<dl class="datos">`
(línea 151):

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

CSS: reusa `.chip` (línea 211) más una clase `.chip.conexion` (color propio,
ej. fondo violeta claro) y `.chip.conexion.vacia` (gris, mismo tratamiento
que un estado vacío en el resto del archivo). El truncado va en `.chip.conexion`:
`max-width`, `overflow: hidden`, `text-overflow: ellipsis`, `white-space: nowrap`.

## Tests

`src/lib/cartera/normalizar.test.js` (agregar casos al describe existente
de `normalizarCliente`):

- `crudo.connections` ausente → `connections: []`
- `crudo.connections` no es array → `connections: []`
- item sin `plan_name` → `plan_nombre: ''`, `plan_id` se preserva
- item con `plan_id`/`plan_name` válidos → se mapean tal cual

`src/lib/cartera/planes.test.js` (nuevo):

- `plan_id` presente en `NOMBRES_PLAN` → devuelve el nombre corto
- `plan_id` ausente del diccionario → devuelve `nombreCompleto` tal cual
- `nombreCompleto` vacío y sin match → devuelve `''` (no revienta)

## Fuera de alcance

- Estado de la conexión (activa/suspendida) en el chip — se decidió que el
  chip solo muestra el plan.
- Fetch en vivo de conexiones (patrón de `TicketsCliente`) — se decidió usar
  el snapshot.
- UI para administrar el diccionario de nombres cortos — vive en código.
- Enriquecer con nodo/OLT/IP (`GET /api/connection`) — no se pidió, y
  agregaría un request por cliente que hoy no existe.
