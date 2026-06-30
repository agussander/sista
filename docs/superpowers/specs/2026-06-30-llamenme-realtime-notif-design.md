# Notificación realtime + paginación — admin "Quiero que me llamen"

Fecha: 2026-06-30

## Objetivo

En el panel de administración, avisar al instante cuando llega una nueva
solicitud de "Quiero que me llamen": reproducir un sonido de gallo y mostrar un
puntito de notificación, **estés en cualquier sección del admin** (no hace falta
tener abierto el panel de Quiero que me llamen). Además, paginar la lista de
solicitudes de a 10 por página.

## Contexto actual

- Backend: PocketBase (`src/lib/pocketbase.js`), colección `quiero_que_me_llamen`.
- El formulario público (`LlamenmeForm.svelte`) crea registros vía un endpoint
  PHP; el admin los lee desde PocketBase.
- `Llamenme.svelte` hoy carga `getList(1, 200, { sort: '-created' })` en su
  `onMount` y muestra una tabla con asignación de agente. Se monta sólo cuando
  el panel está seleccionado.
- El sonido ya está en `static/assets/gallo-sfx.mp3` (servido como
  `/assets/gallo-sfx.mp3`).
- PocketBase tiene realtime nativo (SSE) vía `pb.collection(...).subscribe()`.

## Decisiones de diseño

- **Paginación cliente** (no servidor): se trae la lista y se pagina en el
  navegador. Los leads nuevos por realtime se insertan al instante y quedan
  visibles en la página 1. Más simple y consistente con el sonido en vivo.
- **El sonido suena sólo para arribos nuevos** (evento `create` de realtime),
  no en la carga inicial.
- **El sonido y el contador viven a nivel admin**, no dentro de `Llamenme.svelte`,
  para que funcionen aunque el panel no esté abierto.
- **Puntito de notificación sólo visual** (un dot), sin número.

## Arquitectura

### Nuevo: store de runes `llamenmeStore.svelte.js`

Ubicación: junto al componente del panel
(`src/routes/admin/_components/mantenimiento/Dashboard/llamenme/llamenmeStore.svelte.js`).
Fuente única de verdad. Sigue el patrón de `wizardState.svelte.js` (estado con
runes en un `.svelte.js`).

Estado expuesto (runes `$state`):
- `leads: []` — todas las solicitudes traídas, ordenadas `-created`.
- `unread: 0` — cantidad de arribos nuevos sin ver (para el puntito).
- `newIds: Set<string>` — ids recién llegados por realtime, para el highlight.
- `loading`, `error`, `started`.

API:
- `load()` — fetch inicial `getList(1, 200, { sort: '-created' })`. Idempotente.
- `start()` — si `started`, no hace nada. Marca `started = true`, llama a `load()`
  y abre la suscripción realtime `pb.collection('quiero_que_me_llamen').subscribe('*', handler)`.
  - `create`: si el id no está ya en `leads`, lo prepende; `unread++`; agrega el
    id a `newIds` (y lo quita a los ~3s con `setTimeout`); reproduce el gallo.
  - `update`: reemplaza la fila en `leads` por `e.record` si existe.
  - `delete`: filtra la fila de `leads`.
- `stop()` — cierra la suscripción (`unsubscribe()`) y resetea `started`.
- `markRead()` — `unread = 0`.
- `assign(lead, value)` — mueve acá la lógica de asignación optimista que hoy
  está en `Llamenme.svelte` (update PocketBase + rollback ante error), operando
  sobre `leads`.

Audio:
- Una instancia `Audio('/assets/gallo-sfx.mp3')` creada una vez en el módulo.
- `playGallo()` hace `audio.currentTime = 0; audio.play().catch(() => {})` para
  no romper si el navegador bloquea el autoplay.
- `primeAudio()` — reproduce y pausa el audio en silencio una vez, para
  habilitar el autoplay posterior. Lo llama el Dashboard en el primer click.

### `Dashboard.svelte` — dueño del ciclo de vida

- `onMount` → `llamenmeStore.start()`. `onDestroy` → `llamenmeStore.stop()`.
  El Dashboard está montado siempre que el usuario está logueado, así el realtime
  y el sonido funcionan en cualquier sección.
- Priming de audio: un listener de `click` en `window` que llama `primeAudio()`
  una sola vez (se autoremueve). Cubre el bloqueo de autoplay de los navegadores.
- `$effect`: cuando `selected === 'llamenme'` → `llamenmeStore.markRead()`.
- Puntito en el botón "Quiero que me llamen" del home-screen: badge visible
  cuando `llamenmeStore.unread > 0`.

### `Sidebar.svelte` — puntito en el ítem del menú

- Recibe `unread` como prop (lo pasa el Dashboard desde el store).
- En el `main-item` cuyo `content === 'llamenme'`, renderiza un dot cuando
  `unread > 0` y `selected !== 'llamenme'`.
- El dot funciona también en estado colapsado (posicionado sobre el icono).

### `Llamenme.svelte` — paginación + tabla

- Deja de cargar y suscribir por su cuenta. Lee `llamenmeStore.leads`,
  `loading`, `error`, `newIds`.
- Paginación cliente:
  - `page = $state(1)`, `perPage = 10`.
  - `$derived`: `totalPages = Math.max(1, Math.ceil(leads.length / perPage))`
    y `visible = leads.slice((page-1)*perPage, page*perPage)`.
  - Si `page > totalPages` (p. ej. tras borrados), clampear a `totalPages`.
  - El `{#each}` itera `visible`.
  - Controles: « Anterior · "Página X de Y" · Siguiente », deshabilitados en
    los extremos. No se muestran si hay una sola página.
- Cuando llega un lead nuevo (cambia `leads` por un id en `newIds`), saltar a
  `page = 1` para que sea visible. Implementado con un `$effect` que observa el
  largo/primer id, sin pisar la navegación manual del usuario en otras páginas
  salvo arribo nuevo.
- Fila con id en `newIds`: clase `.is-new` con highlight temporal (~3s).
- "Refrescar" llama `llamenmeStore.load()`.
- Asignación de agente usa `llamenmeStore.assign(...)`.

## Flujo de datos

1. Usuario entra al admin → `Dashboard` monta → `store.start()` → `load()` +
   `subscribe`.
2. Llega una solicitud nueva → PocketBase emite `create` → handler prepende,
   `unread++`, suena el gallo, marca `newIds`.
3. Puntito aparece en el Sidebar y en el botón del home-screen.
4. Usuario abre el panel "Quiero que me llamen" → `markRead()` apaga el puntito;
   ve la fila resaltada en la página 1.
5. Usuario navega páginas de a 10; asigna agentes.

## Manejo de errores

- Fallo de `load()`: `error` seteado, se muestra en el panel (igual que hoy).
- Fallo de `subscribe()`: capturar y loguear; el panel sigue funcionando con
  carga manual ("Refrescar"). No romper el admin por un fallo de SSE.
- `audio.play()` rechazado (autoplay bloqueado): se ignora; el priming en el
  primer click lo resuelve para los siguientes.
- Asignación: update optimista con rollback ante error (comportamiento actual).

## Testing / verificación

- Existe `data.test.js` en el proyecto (Vitest). Para este cambio, la lógica
  testeable es la paginación y la reducción de eventos realtime sobre `leads`.
  Si la lógica del store se factoriza en funciones puras (p. ej. `applyCreate`,
  `applyDelete`, cálculo de páginas), se cubren con tests unitarios.
- Verificación manual: crear un registro en `quiero_que_me_llamen` desde
  PocketBase con el admin abierto en otra sección → debe sonar el gallo y
  aparecer el puntito; abrir el panel → puntito apagado, fila resaltada,
  paginación de a 10.

## Fuera de alcance

- Notificaciones del navegador (Web Notifications API) / push.
- Contador numérico en el puntito.
- Paginación del lado del servidor.
- Persistencia del estado "leído" entre recargas (al recargar, `unread` arranca
  en 0; el realtime sólo cuenta arribos durante la sesión abierta).
