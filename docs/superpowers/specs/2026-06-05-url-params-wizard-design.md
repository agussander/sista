# Diseño — URL params en `elegirplan` y `elegirtv`

**Fecha:** 2026-06-05
**Objetivo:** Que cada paso y cada selección del wizard quede reflejada en el enlace.
Copiar/pegar la URL debe reabrir el wizard en el mismo paso y con las mismas selecciones.

## Alcance

- `/elegirplan` — wizard multi-paso con branching (estado en `wizardState.svelte.js`).
- `/tv/elegirtv` — página de 3 tarjetas con modal de servicio.

Fuera de alcance:
- No se cambian visuales, branching ni el recomendador.
- En `/tv/elegirtv`: los toggles de adicionales y el visor de grilla **no** van a la URL (efímeros).
- Los overlays transitorios del wizard (`TvCheckModal`/`tvCheck`, `pendingPromo`, recomendador
  `showRecom`/`recom.usos`/`recom.personas`) **no** van a la URL: son ayudas efímeras; sólo su
  resultado (`plan`) es una selección compartible.

## Esquema de URL (query params, en español, siguiendo el patrón existente)

Precedente en el repo: `src/routes/formasdepago/_components/SelectMedio.svelte` usa
`goto('?...', { replaceState, noScroll, keepFocus })` + `$page.url`.

### `/elegirplan`

| Param  | Significado        | Valores |
|--------|--------------------|---------|
| `paso` | paso actual        | `tipo` · `promo` · `internet` · `tv` · `adicionales` · `resumen` |
| `tipo` | branch             | `internet` · `tv` |
| `plan` | plan de Internet   | `home` · `fast` · `power` · `gamer` · `worker` · `max` |
| `tv`   | plataforma de TV   | `dgo` · `antina` · `gigared` |
| `promo`| promo aplicada     | `1` (se omite cuando es false) |
| `add`  | adicionales        | lista separada por comas: `pack_futbol`, `cine`, `telefono` |

Param omitido = no seleccionado.

Ejemplo: `/elegirplan?paso=adicionales&tipo=tv&promo=1&plan=power&tv=gigared&add=cine`

### `/tv/elegirtv`

| Param | Significado | Valores |
|-------|-------------|---------|
| `tv`  | servicio cuyo modal está abierto | `dgo` · `antina` · `gigared` |

`?tv=dgo` abre el modal de ese servicio al cargar. Sin param → ningún modal abierto.

## Comportamiento del historial (back/forward)

Decisión: **Back = paso anterior.**

Un único `$effect` de sincronización serializa `wizard → query string` y llama a `goto`:
- **Cambió el paso** respecto del último sincronizado → `goto(url)` (apila historial) →
  el botón Atrás del navegador vuelve al paso anterior.
- **Sólo cambiaron selecciones** (mismo paso) → `goto(url, { replaceState: true })` → sin
  nueva entrada de historial.
- Siempre `{ noScroll: true, keepFocus: true }` (el wizard ya hace su propio
  `scrollIntoView` al cambiar de paso).

## Hidratación y guard del loop bidireccional

- En `onMount` y en cada cambio de `$page.url` (cubre Back/Forward y pegar enlace), se parsean
  los params → se escriben en `wizard`.
- El `resetWizard()` de `onMount` se **reemplaza** por "hidratar desde la URL". URL vacía →
  default `paso=tipo` (equivalente al reset actual).
- **Guard del loop:** en ambas direcciones se comparan query strings canónicas; si el `wizard`
  serializado ya es igual a la URL, no se hace nada. Así URL→estado→URL se estabiliza en una sola
  pasada, sin loop infinito.
- Toda la sincronización corre en cliente (los `$effect`/`onMount` no corren en SSR; igual se
  protege con `browser` si hace falta). Adapter estático + `robots noindex` → OK.

## Clamp de deep-link (paso válido más lejano)

Decisión: **Clampear al paso válido más lejano** (no confiar ciegamente en la URL).

Helper nuevo `clampStep(wizard, requestedStep)` en `data.js` (reusa `getFlow`):

1. Reconstruir `getFlow(wizard)` a partir de `tipo`/`promo` de la URL.
2. Si `requestedStep` no está en ese flow → caer al flow (paso por defecto).
3. Recorrer el flow: se puede aterrizar en un paso sólo si **todos los pasos previos** cumplen
   su requisito. Requisito para "pasar" cada paso:
   - `tipo` → requiere `tipo != null`
   - `internet` → requiere `plan` (`internetPlan != null`)
   - `tv` → requiere `tvPlatform != null`
   - `promo` y `adicionales` → nunca bloquean (decisión ya codificada en `tipo`/`promo`;
     adicionales son opcionales)
   - `resumen` → terminal
4. Aterrizar en `flow[min(requestedIndex, furthestAllowedIndex)]`.

Ejemplos:
- `?paso=resumen` sin selecciones → aterriza en `tipo`.
- `?paso=resumen&tipo=tv&promo=1&plan=power&tv=gigared` → aterriza en `resumen`.
- `?paso=tv&tipo=internet` (`tv` no está en el flow de internet) → cae al flow de internet.

## Archivos a tocar

- `src/lib/components/elegirplan/wizardState.svelte.js`
  - `hydrateFromParams(searchParams)` — parsea params → muta `wizard` (usa `clampStep` para el paso).
  - `toSearchParams(wizard)` — construye la `URLSearchParams` canónica desde el estado.
  - Helper para comparar query strings canónicas (guard).
- `src/lib/components/elegirplan/data.js`
  - `clampStep(wizard, requestedStep)` (reusa `getFlow`).
- `src/lib/components/elegirplan/ElegirPlanWizard.svelte`
  - `$effect` de sincronización estado→URL (push vs replace según cambie el paso).
  - `$effect` que hidrata desde `$page.url` en cada navegación.
  - `onMount`: hidratar desde la URL en vez de `resetWizard()`.
- `src/routes/tv/elegirtv/+page.svelte`
  - Sincronizar `openKey ↔ ?tv=` (hidratar en mount + cambios de URL; escribir con `goto` al
    abrir/cerrar el modal).

## Criterios de aceptación

1. Avanzar pasos en `/elegirplan` actualiza `?paso=` y agrega entradas de historial; Back vuelve
   al paso anterior con sus selecciones.
2. Cambiar una selección dentro de un paso actualiza la URL sin nueva entrada de historial.
3. Pegar una URL completa y válida reabre el wizard en ese paso con todas las selecciones.
4. Pegar una URL incompleta/incoherente aterriza en el paso válido más lejano (clamp), sin pantallas rotas.
5. En `/tv/elegirtv`, `?tv=dgo` abre el modal de DGO al cargar; abrir/cerrar el modal actualiza
   la URL; Back cierra el modal.
6. No hay loop de navegación (la sync se estabiliza en una pasada).
