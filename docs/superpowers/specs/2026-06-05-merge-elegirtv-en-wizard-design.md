# Merge de `elegirtv` en el paso de TV del wizard `elegirplan`

**Fecha:** 2026-06-05
**Estado:** Aprobado (diseño)

## Problema

En el wizard "Elegí tu plan" (`/elegirplan`), cuando el usuario elige **Internet + TV**,
el paso de TV (`Step4TV.svelte`) quedó muy escueto: tres `OptionCard` mínimas
(label, subtitle, logo, precio) y un chequeo de instalación. La página `/tv/elegirtv`
en cambio tiene una experiencia rica (tarjetas con features, grilla de canales,
recomendador, modal de detalle con adicionales).

Queremos **traer esa estructura y esas tarjetas al paso de TV del wizard**, manteniendo
el flujo del wizard: los CTA finales del paso de TV **no** deben ir directo a WhatsApp
con solo el plan de TV, sino continuar el wizard (adicionales → resumen).

## Decisiones tomadas

1. **El modal de TV mantiene su selección de adicionales + mini-total**, pero su CTA final
   **continúa el wizard** llevando los adicionales elegidos, en vez de abrir WhatsApp.
2. **Pack Fútbol y Cine son adicionales de las tarjetas/modal de TV**, no un paso final del
   wizard. El paso `adicionales` del wizard pasa a mostrar **solo Telefonía**.
3. **Se trae toda la estructura de elegirtv** al paso de TV: aviso "no es por cable"
   (con sus modales "Mi TV no es smart" / "¿Es compatible?"), tarjetas ricas y el
   recomendador `AyudameElegirTv`.
4. **Estrategia de componentes:** promover los componentes de TV a `$lib/components/tv/`
   (una sola fuente de verdad, ambas páginas importan de ahí).

## Arquitectura

### 1. Librería compartida `$lib/components/tv/`

Se mueven desde `src/routes/tv/elegirtv/` a `$lib/components/tv/`:

- `tvData.js` — `TV_SERVICES`, `serviceByKey`, `ADDON_PACK_FUTBOL`, `ADDON_CINE`, `INCOMPATIBLES`
- `TvServiceCard.svelte`
- `TvServiceModal.svelte` (parametrizado, ver abajo)
- `GrillaViewer.svelte`
- `InfoModal.svelte`
- `AyudameElegirTv.svelte`

Los imports internos a `$lib/components/elegirplan/data.js` (`formatPrice`, `WHATSAPP_PHONE`)
no cambian de ruta. Los imports relativos a `./tvData.js` siguen siendo relativos.

### 2. `TvServiceModal` parametrizado (flow-agnóstico)

Nuevas props:

- `onConfirm(service, chosenAddons)` — se llama después de confirmar el chequeo de
  instalación. Reemplaza el `window.open` de WhatsApp hardcodeado.
- `initialSelected` (opcional) — siembra los checkboxes de adicionales para que la
  selección previa persista al reabrir el modal.
- `ctaLabel` (opcional, default `"Lo quiero"`).

El sub-flujo interno se mantiene idéntico: detalle → adicionales → total → CTA →
`TvCheckModal` (chequeo de instalación) → **`onConfirm`**. La construcción de la URL de
WhatsApp sale del modal y pasa al `onConfirm` de la página elegirtv.

### 3. `/tv/elegirtv/+page.svelte` (página existente, sigue funcionando)

- Actualizar imports a `$lib/components/tv/...`.
- Pasar `onConfirm={(service, addons) => window.open(buildTvWhatsappUrl(service, addons, precios), '_blank', 'noopener')}`.
- La lógica de armado del mensaje de WhatsApp (hoy dentro del modal) se mueve acá o a un
  helper en `tvData.js` (`buildTvWhatsappUrl`).
- Comportamiento para el usuario: **sin cambios**.

### 4. Paso de TV del wizard — `Step4TV.svelte` reconstruido

Renderiza, usando los componentes compartidos:

- `StepHeader` (título del wizard — se mantiene la chrome del wizard; el `<h1>` de
  elegirtv se descarta por redundante)
- el aviso "no es por cable" + sus dos `InfoModal` ("Mi TV no es smart" / "¿Es compatible?")
- las tres `TvServiceCard` ricas (features, "Ver canales" → `GrillaViewer`)
- `AyudameElegirTv` (onPick → abre el modal de ese servicio)
- `TvServiceModal` con:
  - `onConfirm` cableado a **commitear + avanzar el wizard** (no WhatsApp)
  - `initialSelected` sembrado desde `wizard.addons`
- Un botón `Continuar` que aparece solo cuando ya hay una TV elegida (para que, al volver
  desde un paso posterior, se pueda avanzar sin reabrir el modal); la tarjeta elegida se
  muestra seleccionada.

Estado local del paso (igual que la página elegirtv): `openKey`, `grillaKey`, `info`.

### 5. Estado del wizard — `wizardState.svelte.js`

- Agregar `cine: false` a `wizard.addons` (init + `resetWizard`).
- Nueva acción `chooseTvService(serviceKey, chosenAddonKeys)`:
  - `wizard.tvPlatform = serviceKey`
  - `wizard.addons.pack_futbol = chosenAddonKeys.includes('pack_futbol')`
  - `wizard.addons.cine = chosenAddonKeys.includes('cine')`
  - (limpia los TV-addons que el servicio elegido no ofrece)
  - `next()`
- El chequeo de instalación del paso de TV vive ahora dentro de `TvServiceModal`.
  `requestTv` / `confirmTv` / `cancelTvCheck` se mantienen **solo para el flujo de promo**.

### 6. `data.js`

- Eliminar `TV_PLATFORMS`; `TV_SERVICES` queda como única fuente de TV. `summaryItems` y
  `buildWhatsappUrl` resuelven la línea de TV vía `serviceByKey` (label + `priceField`);
  la lógica de "gratis" por promo (`PROMO.tvGratis`) no cambia.
- `ADDONS` redefinido con flag `tvAddon`:
  - `pack_futbol` (tvAddon: true, field `pack_futbol`)
  - `cine` (tvAddon: true, field `cine`, "Canales HBO y Universal")
  - `telefono` (tvAddon: false)
- `summaryItems` sigue iterando todos los adicionales seleccionados → Pack Fútbol / Cine /
  Telefonía aparecen como ítems de línea en el resumen + WhatsApp. Los ítems `tvAddon`
  llevan `step: 'tv'` para que "editar" en el resumen reabra el paso de TV.

### 7. `Step5Adicionales.svelte`

`visibles = ADDONS.filter((a) => !a.tvAddon)` → solo queda Telefonía en este paso
(Pack Fútbol se movió al modal de TV). Se elimina la lógica `requiresTv`.

### 8. Modal de promo en `ElegirPlanWizard.svelte`

`tvByKey(wizard.tvCheck)` → `serviceByKey(...)` (TV_SERVICES tiene logo/label/warnMagisXuper).

## Comportamiento / casos borde

- **Cine es solo de Antina**: el modal solo ofrece los adicionales que el servicio lista;
  al commitear se limpia `cine` si el servicio elegido no lo ofrece.
- **Cambiar de servicio volviendo atrás**: al reabrir el modal se siembra desde
  `wizard.addons`; al commitear se sobrescribe.
- **Pill de total en el header**: sigue exacto (lee `computeTotal`, que ya incluye los adicionales).
- **"Editar" en el resumen** sobre una línea de TV-addon → va al paso de TV.
- Pack Fútbol / Cine aparecen como ítems de línea propios en el **resumen** y el mensaje de
  WhatsApp (consistente con la transparencia de precios del codebase). Se *seleccionan* en
  el modal de TV, no en un paso aparte.

## Fuera de alcance

- Rediseño visual de las tarjetas o el modal (se reutiliza tal cual).
- Cambios en los flujos "Solo Internet" o "Promo" (más allá del swap `tvByKey → serviceByKey`).
- Cambios en la colección `precios` de PocketBase (se asume que existe el campo `cine`;
  si no, cae a "Consultar" como cualquier otro adicional).
