# Tickets en tarjetas dentro del detalle de cliente

Fecha: 2026-08-04
Estado: aprobado, sin implementar

## El problema

En el detalle de un cliente de la Cartera, los tickets ocupan una celda del
`<dl>` de datos y dicen esto:

```
TICKETS
2 abiertos · 7 cerrados
Último: 12/07/2026 · categoría #3 · estado #1
```

Eso alcanza para saber que *existen* tickets, no para saber qué pasó. Los
números de categoría y estado son ids crudos de IspCube que nadie puede leer, y
de los otros ocho tickets no se ve nada.

Lo que se quiere: un carrusel horizontal de tarjetas, una por ticket, que
muestre número, categoría y estado de un vistazo, y que se pueda abrir para ver
el detalle completo con el hilo de mensajes.

## Por qué hoy no se puede

El snapshot en `cartera_clientes` guarda solo el resumen que devuelve
`resumenTickets()`: `{abiertos, cerrados, ultimo}`. La lista de tickets nunca se
persiste, y con razón — el payload crudo de `/api/tickets` trae el texto
completo de cada comentario, sin cota de tamaño.

## Decisiones tomadas

| Decisión | Elegido | Por qué |
|---|---|---|
| Origen de los datos | En vivo al abrir el detalle | 1 request de IspCube por apertura, siempre fresco, PocketBase no engorda |
| Profundidad del detalle | Metadata + hilo de mensajes | Es lo que hace útil abrir el ticket |
| Alcance del carrusel | Todos los tickets, más nuevo primero | El filtro de `areas_soporte` se queda solo en el conteo y la alerta |
| Comentarios internos | Se muestran, y son el caso normal | Casi todo el hilo es interno; lo excepcional es el mensaje visible al cliente |

## Arquitectura

Cuatro piezas, cada una testeable por separado.

```
ClienteDetalle.svelte
  └─ TicketsCliente.svelte ──fetch──> GET /api/cartera/tickets/[code]
                                        ├─ getTickets()            (ispcube.js)
                                        ├─ getCatalogosTickets()   (ispcube.js, cacheado)
                                        └─ normalizarTickets()     (cartera/tickets.js, puro)
```

El snapshot de PocketBase no participa: sigue guardando `{abiertos, cerrados,
ultimo}` como hoy, y el endpoint nuevo no escribe nada en ningún lado.

### 1. `getCatalogosTickets(config, options)` en `src/lib/server/ispcube.js`

Devuelve `{ok: true, categorias, estados, prioridades, areas}` pidiendo
`/api/tickets/category_list`, `/api/tickets/status_list`,
`/api/tickets/priority_list` y `/api/tickets/areas_list`.

Serial, no `Promise.all`, por la misma razón que `getCatalogos()`: si el primero
falla no tiene sentido gastar requests facturados en los otros tres.

No se fusiona con `getCatalogos()` (que sirve a la pantalla de configuración con
entidades + áreas) porque son dos consumidores con necesidades distintas, y
juntarlos haría que configurar la Cartera gaste cinco requests en vez de dos.

### 2. Cache de catálogos

Los cuatro catálogos son estables y la API de IspCube se factura por consumo. El
endpoint cachea el resultado en memoria del proceso con TTL de 1 h, replicando
el patrón que ya usa `src/routes/api/cartera/catalogos/+server.js`.

Un fallo de catálogos **no** rompe el endpoint: se responde con los tickets y
`catalogos: null`, y la UI cae a mostrar `#id` — exactamente lo que se ve hoy.
Perder los nombres degrada la pantalla; no traer los tickets la vacía.

### 3. `normalizarTickets(crudos, catalogos)` en `src/lib/cartera/tickets.js`

Módulo nuevo, puro, sin red. No va en `normalizar.js`: ese archivo traduce
respuestas de IspCube a **lo que se guarda en el snapshot**, y esto es un modelo
de vista que no se guarda en ningún lado.

Cada ticket sale así:

```js
{
  id, numero, fecha, cerrado,
  area:      { id, nombre },
  categoria: { id, nombre, color },
  estado:    { id, nombre },
  prioridad: { id, nombre },
  asignado, visita,
  hilo: [{ fecha, autor, interno, texto }]
}
```

Reglas:

- Se descartan los tickets con `deleted_at`.
- El orden es por `created_at` descendente, comparado con `compararFechaHora()`
  de `fechas.js`, no con `>` sobre strings — mismo cuidado que ya tiene
  `resumenTickets()` con los `created_at` que llegan con espacio en vez de `T`.
- Se cortan los **30 más nuevos**. Es una cota al payload, no un filtro de
  producto: un cliente de cartera con más de 30 tickets no existe hoy.
- `numero` es `ticket_number ?? id`. La API documenta `ticket_number` en la
  respuesta del alta, pero no está confirmado que venga en el listado; el id es
  el respaldo.
- `cerrado` se calcula contra `estados_cerrados` de `cartera_config`, que llega
  como query param igual que en `/api/cartera/cliente/[code]`.
- Sin catálogo, cada `{id, nombre}` queda con `nombre: ''` y la UI muestra el id.
- El hilo va en orden cronológico ascendente (el ticket se lee de arriba abajo).

### 4. `GET /api/cartera/tickets/[code]`

Solo lectura, permiso `cartera`, misma forma que `/api/cartera/cliente/[code]`:
401 si no sabemos quién es, 403 si sabemos y no puede, 404 si el code no existe,
502 si IspCube no responde.

Query params: `cerrados` (ids de estado que cuentan como cerrado), parseado con
`parseIds()` como en el endpoint de cliente.

Respuesta: `{tickets: [...], catalogos: true | null}`.

### 5. `TicketsCliente.svelte`

Componente nuevo en la carpeta `cartera/`. Aparte de `ClienteDetalle.svelte`,
que ya tiene 353 líneas — el carrusel más el panel expandido lo llevarían a
~600.

Props: `code`, `resumen` (el `actual.tickets` del snapshot). Los
`estados_cerrados` que manda como query param los lee de `carteraStore.config`,
igual que `ClienteDetalle` ya lee los días de corte.

**Carrusel.** `display: flex` + `overflow-x: auto` + `scroll-snap-type: x
proximity`, tarjetas de ancho fijo (~15em) con `scroll-snap-align: start`. Cada
tarjeta es un `<button>` — así el teclado y los lectores de pantalla funcionan
sin trabajo extra — con `aria-expanded` y `aria-controls` apuntando al panel.

Contenido de la tarjeta:

- número de ticket, destacado
- chip de estado (verde/gris según `cerrado`, con el nombre del estado)
- categoría, con una barra del `color` que trae el catálogo
- fecha

El color de la categoría nunca es el único canal de información: el nombre
siempre está escrito al lado.

**Expansión.** El detalle se abre **debajo** del carrusel, dentro del mismo
panel — no un modal sobre el modal. Muestra área, categoría, estado, prioridad,
asignado, fecha de creación, fecha de visita, y el hilo completo.

En el hilo, lo que se marca es el mensaje **visible para el cliente**, no el
interno: como los internos son el caso normal, marcarlos sería ruido en todas
las líneas.

Una sola tarjeta abierta a la vez; volver a clickear la abierta la cierra.

**Estados.**

| Situación | Qué se ve |
|---|---|
| Cargando | El resumen del snapshot + spinner |
| Error de red o 502 | El resumen del snapshot + "No pudimos traer el detalle de los tickets" |
| `tickets: []` | "Sin tickets registrados." |
| `catalogos: null` | Las tarjetas con `#3` en vez del nombre |

Nunca se queda en blanco: el resumen del snapshot ya está en memoria y no
depende de este fetch.

### 6. Cambio en `ClienteDetalle.svelte`

Los tickets salen del `<dl class="datos">`, donde compiten por ancho con Deuda e
Instalación, y pasan a una `<section class="bloque">` propia arriba de Pagos:

```
Tickets   2 abiertos · 7 cerrados
[carrusel]
```

El conteo sigue viniendo del snapshot y sigue respetando `areas_soporte`;
el carrusel muestra todos. Para que los números no parezcan contradecirse
cuando hay tickets de otras áreas, el encabezado aclara que el conteo es de las
áreas de soporte.

`marcarTicketsVistos()` no cambia: sigue disparándose al abrir el detalle.

## Tests

`src/lib/cartera/tickets.test.js`:

- descarta `deleted_at`
- ordena por `created_at` descendente, incluyendo el caso `"2026-07-01 10:00"`
  vs `"2026-07-01T09:00"` que rompe la comparación de strings
- corta en 30
- sin catálogos, deja el id y `nombre: ''`
- `numero` cae al id cuando no hay `ticket_number`
- `cerrado` respeta `estados_cerrados`; con la lista vacía, todo abierto
- ticket sin `items[]` → `hilo: []`
- entrada que no es array → `[]`

`src/routes/api/cartera/tickets/[code]/server.test.js`:

- 401 sin token, 403 sin permiso
- 404 cuando `getTickets` da `not_found`, 502 cuando da otro fallo
- catálogos caídos + tickets ok → 200 con `catalogos: null`
- el cache no vuelve a pedir catálogos dentro del TTL

## Fuera de alcance

- Guardar los tickets en el snapshot (se decidió en vivo).
- Crear o responder tickets desde la Cartera. Este endpoint es de solo lectura;
  el único alta de tickets del proyecto sigue siendo el de bajas.
- Un toggle "solo áreas de soporte" en el carrusel. Se puede sumar después si
  el ruido de otras áreas molesta.
- Adjuntos de los tickets.
