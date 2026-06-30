# Switch habilitar/deshabilitar "Quiero que me llamen"

Fecha: 2026-06-30
Rama: `feat/llamenme-override-switch`

## Problema

El formulario "Quiero que me llamen" del Hero se muestra u oculta únicamente según
un horario de atención fijo, calculado en el cliente
(`isWithinCallHours()` en `src/lib/components/home/Hero.svelte`): lunes a viernes
de 9:30 a 16:30 hora de Buenos Aires. No hay forma de intervenir manualmente:
no se puede esconder el form un día puntual (agentes ausentes) ni mostrarlo fuera
de horario, y el admin no tiene visibilidad de si en este momento está visible.

## Objetivo

Agregar al panel de admin "Quiero que me llamen" un control manual que, **además**
de la activación/desactivación automática por horario, permita forzar el form
visible u oculto en cualquier momento, y que muestre el estado actual (si se está
viendo ahora y por qué).

## Decisiones tomadas (brainstorming)

1. **Modelo: override de 3 estados** que se superpone al horario.
   - `auto` → sigue el horario existente.
   - `abierto` → form siempre visible (aunque sea fuera de horario).
   - `cerrado` → form siempre oculto (aunque sea dentro de horario).
2. **Propagación: próxima carga.** Hero lee el estado en `onMount`; el visitante
   ve el cambio al entrar/recargar. Sin realtime en la web pública.
3. **Persistencia: nueva colección singleton** `llamenme_config` en PocketBase
   (la crea el usuario en PocketHost, no se puede crear por código desde acá).

## Arquitectura

### 1. Lógica pura compartida — `src/lib/llamenme/visibility.js` (+ `.test.js`)

Se extrae `isWithinCallHours(now = new Date())` desde `Hero.svelte` (hoy inline)
a este módulo, sin cambios de comportamiento. Se agrega:

```js
// override: 'auto' | 'abierto' | 'cerrado' (cualquier otro valor => auto)
export function computeFormVisible(override, now = new Date()) {
    if (override === 'abierto') return true;
    if (override === 'cerrado') return false;
    return isWithinCallHours(now); // 'auto' o desconocido
}
```

Módulo sin runes ni efectos, testeable con Vitest. Sigue el patrón de
`src/routes/admin/_components/mantenimiento/Dashboard/llamenme/llamenmeLogic.js`.

Constante exportada con los valores válidos para reutilizar en UI y validación:
`export const OVERRIDE_VALUES = ['auto', 'abierto', 'cerrado'];`

### 2. Acceso a config — `src/lib/llamenme/config.js`

Lee/escribe el override en la colección singleton. No importa `pb` directamente;
lo recibe por parámetro para poder testear con un `pb` mockeado.

```js
const COLLECTION = 'llamenme_config';

// Devuelve 'auto'|'abierto'|'cerrado'. Fail-open: ante cualquier error
// devuelve 'auto' para que la web caiga al horario automático.
export async function fetchOverride(pb) { /* getFirstListItem('') */ }

// Actualiza el registro singleton (o lo crea si no existe). Devuelve el valor
// guardado. Lanza el error para que el llamador (admin) pueda hacer rollback.
export async function saveOverride(pb, value) { /* update/create */ }
```

`fetchOverride` devuelve el `override` del registro, normalizado contra
`OVERRIDE_VALUES` (si viniera vacío/raro → `'auto'`).

### 3. Admin — `Llamenme.svelte` + `llamenmeStore.svelte.js`

El store (`llamenmeStore.svelte.js`) gana:
- `override` (rune `$state`, default `'auto'`).
- `loadOverride()` → `fetchOverride(pb)` y setea `override`.
- `setOverride(value)` → asignación **optimista con rollback** (mismo patrón que
  `assign`): setea `override` al instante, llama `saveOverride(pb, value)`, y si
  falla restaura el valor previo y muestra un error temporal.
- getters `override` agregados al objeto exportado.

El Dashboard ya arranca el store; se engancha `loadOverride()` en ese arranque
(junto a `start()`), de modo que el estado esté disponible apenas se abre el admin.

En `Llamenme.svelte`, en el header del panel:
- Un **control segmentado de 3 botones**: Auto / Abierto / Cerrado, resaltando el
  activo, que llaman a `llamenmeStore.setOverride(...)`.
- Una **línea de estado** que muestra, calculado con `computeFormVisible(override, now)`
  + `isWithinCallHours(now)`:
  - Si visible ahora: "El formulario está **visible** ahora" + motivo
    ("por horario de atención" si `auto`, "forzado abierto" si `abierto`).
  - Si oculto ahora: "El formulario está **oculto** ahora" + motivo
    ("fuera de horario" si `auto`, "forzado cerrado" si `cerrado`).

  El "ahora" se calcula en el cliente en el momento del render; no necesita
  actualizarse en vivo (es informativo).

### 4. Hero.svelte

- Importa `isWithinCallHours` y `computeFormVisible` desde
  `src/lib/llamenme/visibility.js` (se elimina la copia inline).
- En `onMount`: `const override = await fetchOverride(pb);`
  `showLlamenme = computeFormVisible(override, new Date());`
- `fetchOverride` ya es fail-open (devuelve `'auto'` ante error), así que si
  PocketBase no responde, el form cae al comportamiento por horario actual.

### 5. Schema PocketBase (manual — lo hace el usuario en PocketHost)

Colección **`llamenme_config`**:
- Campo `override`: tipo **select**, single, valores `auto`, `abierto`, `cerrado`,
  default `auto`, requerido.
- Crear **un** registro inicial con `override = auto`.
- Reglas API:
  - **List / View: públicas** (Hero las lee sin autenticación).
  - **Update: solo autenticado** (admin). Create/Delete: solo admin (no se usan
    desde la web pública en operación normal; `saveOverride` usa update sobre el
    singleton existente).

## Testing

- `src/lib/llamenme/visibility.test.js` (Vitest):
  - `computeFormVisible`: `'abierto'` → true y `'cerrado'` → false sin importar la
    hora; `'auto'`/desconocido → delega en `isWithinCallHours`.
  - `isWithinCallHours`: dentro de horario (mié 12:00 ART) → true; fuera de horario
    (mié 20:00 ART) → false; fin de semana → false; bordes 9:30 y 16:30.
- (Opcional) `src/lib/llamenme/config.test.js` con `pb` mockeado: `fetchOverride`
  normaliza y hace fail-open a `'auto'`; `saveOverride` propaga el error.

## Fuera de alcance (YAGNI)

- Realtime en la web pública (decidido: próxima carga).
- Override temporal con auto-reversión al siguiente cambio de horario.
- Editar el horario de atención desde el admin (sigue hardcodeado en `visibility.js`).
- Programar ventanas/feriados.
