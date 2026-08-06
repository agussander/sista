# Cartera: alta automática por vendedor y estado de instalación

Fecha: 2026-08-06

## Problema

Hoy sumar un cliente a la Cartera es un trabajo manual: el asesor busca el
código en IspCube, lo tipea en un formulario, y además escribe a mano la
fecha de instalación (de la que depende directamente cuándo el cliente
"debería" empezar a pagar — ver `primerMesFacturable` en `pagos.js`). Dos
problemas se desprenden de esto:

1. **Clientes que nunca se cargan.** Si el asesor se olvida de sumar a
   alguien, ese cliente no tiene seguimiento en la Cartera y nadie se entera.
   IspCube ya sabe qué clientes le corresponden a cada vendedor
   (`seller_id`): no hace falta que el asesor los busque uno por uno.
2. **La fecha de instalación es un dato que ya existe en otro lado, cargado
   a mano.** El proceso interno de instalación pasa siempre por un ticket de
   categoría "ALTA RESERVA DE NAP" (id **69** en IspCube): mientras no está
   cerrado, el cliente no está instalado; cuando se cierra, `closed_date` es
   la fecha real de instalación. Pedirle al asesor que la tipee es un dato
   duplicado y propenso a error.

Además, hoy no hay ninguna señal en la Cartera de **en qué etapa de
instalación** está un cliente recién sumado (¿pagó pero no tiene conexión
todavía? ¿tiene conexión pero el NAP sigue en trámite? ¿ya está instalado?),
ni de si ese trámite se cayó (ticket anulado) o directamente no existe
(un cliente habilitado sin el ticket que el proceso exige).

## Contexto verificado contra la API real

Sondeado en vivo el 2026-08-06 (sin escribir nada, ver conversación):

- `seller_id` viene en `GET /api/customers/customers_list`, que no tiene
  filtro por vendedor — hay que traerlo y filtrar en nuestro código — pero
  sí viene ordenado por más reciente primero y el doc lo marca como
  cacheado del lado de IspCube.
- `GET /api/tickets/category_list` confirma **id 69 = "ALTA RESERVA DE
  NAP"**. `GET /api/tickets/status_list` confirma **id 3 = "Cerrado"** (ya
  es el que usa `estados_cerrados` de `cartera_config`) e **id 8 =
  "ANULADO"**.
- Un ticket cerrado trae `closed_date` (ej. `"2026-08-05 15:22:00"`),
  **distinto** de `updated_at` y del `start_date` del cliente. Verificado
  con un caso real: alta del cliente 1/8, `closed_date` del ticket de NAP
  5/8 — confirma que alta e instalación son fechas distintas, como señaló
  el usuario.
- `cartera_clientes.start_date` (la fecha de alta de IspCube) **ya existe**
  en el snapshot desde `normalizarCliente` — es un campo distinto de
  `fecha_instalacion` desde siempre. No hace falta renombrar nada.

Estos tres ids (**69**, **3** vía `estados_cerrados` ya configurado, **8**)
se hardcodean como constantes con comentario, sin pantalla de
configuración: decisión explícita del usuario ("el nombre está establecido
en el proceso y no va a cambiar en mucho tiempo").

## Alcance

Dentro:

- Un endpoint nuevo que, dado un `seller_id`, trae candidatos de
  `customers_list` acotado (no la cartera completa de un vendedor).
- Alta automática de esos candidatos en `cartera_clientes`, con badge
  "nuevo" en la fila.
- `fecha_instalacion` deja de pedirse por teclado: se completa sola desde
  `closed_date` del ticket de NAP, la vez que se detecta el cierre.
- Estado de instalación derivado (3 valores) y dos alertas nuevas
  (`nap_anulado`, `nap_faltante`).
- Badge transitorio "instalado" (una sola actualización).

Fuera:

- Pantalla de configuración para elegir la categoría/estado del NAP: van
  hardcodeados.
- Mapeo automático asesor → vendedor por email: el usuario carga
  `id_vendedor` a mano en PocketBase, columna nueva en `users`, fuera de
  este repo.
- Edición manual de `fecha_instalacion` una vez completada.
- Tocar `perfil_pago`/`perfil_manual`, promos, o cualquier alerta existente:
  todo lo que ya funciona sigue igual, esto solo agrega.

## Diseño

### 1. Descubrimiento de candidatos por vendedor

**Endpoint nuevo** `GET /api/cartera/candidatos?vendedor=<id_vendedor>&antes=<YYYY-MM-DD>`
(mismo patrón de auth que el resto de `/api/cartera/*`: `verificarPermiso`,
401/403 igual que hoy).

- Pagina `GET /api/customers/customers_list?limit=100&offset=N` (offset
  creciente), filtra en el server por `seller_id === vendedor`.
- Corta cuando: (a) una página entera queda con `start_date` anterior a
  `antes`, o (b) se llega a un tope duro de **5 páginas (500 clientes)**,
  lo que pase primero. El tope duro es la cota de gasto — igual que
  `MAX_CODIGOS` en `/sync` — para que un vendedor sin clientes recientes (o
  un `antes` mal calculado) no dispare una paginada completa de los 8361.
- Devuelve `{candidatos: [{code, nombre, start_date, estado, connections,
  entity_id, entity_nombre, comercial_activity, debt, duedebt}, ...]}`,
  pasado por `normalizarCliente` (reutilizado, ya sabe leer el crudo de
  IspCube). **Sin tickets ni cobranzas**: `customers_list` no los trae por
  cliente, y pedirlos uno por uno reintroduce el costo por cliente que se
  quería evitar. Se completan en el primer sync normal (ver más abajo).

**El store** (`carteraStore.svelte.js`), en `cargar()`, después de traer los
clientes de PocketBase:

- Si `pb.authStore.record.id_vendedor` no está seteado, no hace nada — el
  asesor simplemente no participa.
- Si está: calcula `antes` = la `start_date` más vieja entre los clientes
  activos ya cargados (o "hace 30 días" si la cartera está vacía, para
  acotar la primera corrida de un asesor nuevo), pide `/api/cartera/candidatos`.
- Para cada candidato cuyo `code` no esté ya en la lista completa (activos
  + archivados, para no revivir a alguien que se archivó a propósito),
  crea el registro en `cartera_clientes`:
  ```
  {
    asesor: pb.authStore.record.id,
    code, nombre, estado, start_date, entity_id, entity_nombre,
    perfil_pago: perfilDe(...), perfil_manual: false,
    debt, duedebt, connections, promos, // ambos ya vienen de normalizarCliente
    pagos: [], tickets: null, alta_nap: null,
    tickets_vistos_hasta: '', ultimo_contacto: '',
    fecha_instalacion: '',
    nuevo: true,
    instalado_aviso: false,
    sincronizado: '',      // <- vacío a propósito, ver abajo
    archivado: false
  }
  ```
  `sincronizado` vacío (no `new Date().toISOString()`) es deliberado: hace
  que `aRefrescar()` lo tome como candidato prioritario en la primerísima
  carga siguiente, así el primer sync real (el que sí trae tickets) llega
  rápido y no hay que esperar 12 h para saber su `alta_nap`.
- Falla en silencio por candidato individual (mismo criterio que
  `snapshotDe`): un `create` que rebota no debe tumbar el resto de la
  carga de la Cartera.

**El badge "nuevo":** mientras `nuevo === true`, un punto/etiqueta prolija
en la esquina de la fila (ver sección 4 de estilo). Se apaga solo:
`guardarSnapshot` (el sync normal de un cliente ya existente) siempre
escribe `nuevo: false` en su parche, sin condición — la primera vez que ese
cliente pasa por un sync después de haber sido creado, se apaga.

### 2. Estado de instalación derivado

Función pura nueva, `estadoInstalacionDe(cliente)` en
`src/lib/cartera/instalacion.js` (módulo propio, mismo criterio que
`relativo.js`: es una noción visual distinta a `alertas.js`, con sus
propios tests):

```
estadoInstalacionDe(cliente) → 'pendiente_pago' | 'instalacion_pendiente' | 'instalado'
```

- `cliente.connections.length === 0` → `'pendiente_pago'`. No importa el
  ticket: sin conexión activa no hay nada más que mirar.
- Si no, y `cliente.alta_nap?.cerrado` → `'instalado'`.
- Si no → `'instalacion_pendiente'` (cubre: sin ticket, ticket abierto,
  ticket anulado).

`instalado` es el estado esperado: no se resalta en la fila (texto neutro
o nada), a diferencia de los otros dos que sí se muestran.

### 3. `alta_nap` en el snapshot

Nueva función en `normalizar.js`, junto a `resumenTickets`:

```
resumenAltaNap(tickets, {estadosCerrados}) → {existe, cerrado, anulado, closed_date} | null
```

- Busca, entre los tickets crudos, el más reciente (por `created_at`) con
  `ticket_category_id === CATEGORIA_ALTA_NAP` (constante = 69, comentada
  con el sondeo que la respalda).
- Sin ninguno → `{existe: false, cerrado: false, anulado: false, closed_date: ''}`.
- Con uno → `existe: true`, `cerrado` = su `ticket_status_id` está en
  `estadosCerrados` (la misma lista que ya usa `resumenTickets`, sin
  criterio nuevo), `anulado` = `ticket_status_id === ESTADO_ANULADO`
  (constante = 8), `closed_date` = el campo del ticket, recortado a
  `YYYY-MM-DD` (mismo criterio que `start_date` en `normalizarCliente`).

Se llama en los dos lugares que ya arman `datos` a partir de tickets
crudos: `snapshotDe` en `/api/cartera/sync/+server.js` y el handler de
`/api/cartera/cliente/[code]/+server.js`. Ambos suman `alta_nap` a su
respuesta, al lado de `tickets`.

### 4. Alertas nuevas: `nap_anulado` y `nap_faltante`

En `alertasDe` (`alertas.js`), nuevo bloque, **solo se evalúa si el cliente
está habilitado** (`cliente.connections.length > 0` — antes de eso, no
tener ticket de NAP es lo esperable, no una anomalía):

```js
if (cliente.connections?.length > 0) {
  if (!cliente.alta_nap?.existe) {
    alertas.push({ tipo: 'nap_faltante', desde: null });
  } else if (cliente.alta_nap.anulado) {
    alertas.push({ tipo: 'nap_anulado', desde: null });
  }
}
```

Mutuamente excluyentes (sin ticket no hay ticket anulado que mostrar).
Igual que `mora_1`/`tickets`: quedan prendidas mientras la condición siga
siendo cierta, no se apagan solas. Entran a `chipsDe`/`ORDEN_CHIP` en
`Cartera.svelte` como un chip más:

- Color: ámbar `#fef3c7` / `#92400e` para ambas — el mismo tono que
  `mora_1`/`tickets`, reservando el rojo de `mora_2` para lo estrictamente
  financiero. Cero paletas nuevas.
- `PESO`: `2` para ambas (mismo peso que `tickets`/`mora_1`) — son una
  anomalía de proceso, no un vencimiento, pero tampoco algo para ignorar.
- `ORDEN_CHIP`: entre `tickets` y `recordatorio`.
- `ETIQUETAS`: `nap_faltante: 'Sin reserva de NAP'`, `nap_anulado: 'NAP anulado'`.

### 5. `fecha_instalacion` automática + aviso "instalado"

Ni `agregar()` (alta manual por código) ni el alta por vendedor (sección 1)
piden o completan `fecha_instalacion`: queda vacía hasta que el ticket de
NAP se cierra. Sin fecha, `alertasDe`/`pagos.js` simplemente no calculan
mora ni seguimiento para ese cliente — comportamiento que ya existe hoy
para cualquier cliente sin la fecha cargada, correcto porque no puede haber
mora de alguien que no está instalado.

**La transición se detecta comparando el estado viejo contra el nuevo**, en
el único lugar donde ambos conviven: `guardarSnapshot` (sync de un cliente
existente) y el momento de creación de `agregar()` (para el caso borde de
un cliente que se agrega cuando su NAP ya estaba cerrado desde antes).

```js
parche.alta_nap = datos.alta_nap; // ya viaja en la respuesta de /sync (seccion 3)

const estadoViejo = estadoInstalacionDe(actual);       // antes del parche
const estadoNuevo = estadoInstalacionDe({ ...actual, ...parche });

parche.instalado_aviso = estadoNuevo === 'instalado' && estadoViejo !== 'instalado';
if (parche.instalado_aviso && !actual.fecha_instalacion) {
  parche.fecha_instalacion = parche.alta_nap.closed_date; // ya viene YYYY-MM-DD
}
```

`instalado_aviso` se escribe en **cada** sync con esa misma fórmula, nunca
solo cuando es `true`: la sync inmediatamente después de una transición
encuentra `estadoViejo === 'instalado'` (porque ya quedó guardado así) y la
fórmula da `false` sola, sin lógica de "apagar" aparte. Mismo mecanismo
exacto que `nuevo` en la sección 1.

**El badge:** mientras `instalado_aviso === true`, una marca discreta en la
fila (ej. "Instalado ✓" con un tono suave, sin urgencia — no es una
alerta, no suma al peso de `urgenciaDe`). Se apaga en el próximo sync de
ese cliente, igual que "nuevo".

### 6. Cambios de esquema (`cartera_clientes`)

Tres campos nuevos, agregados con el mismo mecanismo que ya usa
`scripts/crear-colecciones-cartera.js` para sumar campos a una colección
existente sin tocar los que ya están:

| Campo             | Tipo             | Default |
|--------------------|------------------|---------|
| `alta_nap`         | json (opcional)  | `null`  |
| `nuevo`             | bool             | `false` |
| `instalado_aviso`   | bool             | `false` |

`fecha_instalacion` ya existe, no cambia de tipo ni de nombre. `id_vendedor`
en `users` queda **fuera** de este script — lo carga el usuario a mano en
PocketBase, como ya se acordó.

## Manejo de errores

- `/api/cartera/candidatos`: mismos 401/403 que el resto de `/api/cartera`.
  Si `customers_list` falla contra IspCube, devuelve `{candidatos: []}`
  con log de servidor — igual que otros fallos de IspCube en este panel, no
  tumba la carga del resto de la Cartera.
- Alta de un candidato que falla (`create` de PocketBase rebota, por
  ejemplo por el índice único `(asesor, code)` si dos pestañas corren el
  discovery al mismo tiempo): se ignora ese candidato puntual, log de
  consola, sigue con los demás — mismo criterio que `snapshotDe`.
- `resumenAltaNap` nunca lanza: ante tickets crudos raros devuelve
  `{existe: false, ...}`, igual que `resumenTickets` devuelve ceros.
- `estadoInstalacionDe` es función pura sin red: ante un `cliente` sin
  `connections` o sin `alta_nap` (todavía no llegó el primer sync completo)
  cae a `'pendiente_pago'`/`'instalacion_pendiente'` según corresponda, sin
  tirar.

## Testing

- `instalacion.test.js` (nuevo): los tres estados, con y sin `connections`,
  con y sin `alta_nap`, ticket abierto/cerrado/anulado.
- `normalizar.test.js`: casos de `resumenAltaNap` — sin tickets de la
  categoría, uno cerrado, uno anulado, uno abierto, varios (gana el más
  reciente por `created_at`).
- `alertas.test.js`: `nap_faltante` y `nap_anulado` — no aparecen sin
  conexión activa, aparecen/no aparecen según `alta_nap`, mutuamente
  excluyentes.
- Store (`carteraStore` no tiene test unitario hoy salvo los módulos que
  importa — se testean `instalacion.js`/`normalizar.js`/`alertas.js` por
  separado y la fórmula de auto-apagado de `nuevo`/`instalado_aviso` queda
  cubierta ahí, sin duplicar un test de integración de PocketBase).
- Endpoint `/api/cartera/candidatos` (nuevo `server.test.js`, mismo patrón
  que `sync/server.test.js`): filtra por `seller_id`, corta en el tope de
  páginas, corta por `antes`, 401/403.
- Verificación manual: un vendedor con candidatos reales, ver que aparecen
  con badge "nuevo", que un sync posterior lo apaga, y que un cliente cuyo
  ticket de NAP se cierra entre dos syncs muestra el aviso "instalado" una
  sola vez y completa `fecha_instalacion`.
