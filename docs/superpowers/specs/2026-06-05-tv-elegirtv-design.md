# Diseño — Página `/tv/elegirtv`

**Fecha:** 2026-06-05
**Objetivo:** Versión nueva (A/B) de la explicación de planes de TV. Los usuarios no
terminan de entender `/tv`; esta versión pone el foco en **3 tarjetas grandes** (una por
servicio) con modales explicativos y CTA a WhatsApp estilo wizard.

## Concepto

- Mobile-first; en desktop las 3 tarjetas pasan a una fila de 3.
- **Sin CTA grande en la página de las 3 tarjetas.** El CTA vive en el modal de cada servicio.
- El modal arma un mensaje de WhatsApp con el servicio elegido + adicionales seleccionados
  (mismo espíritu que el wizard `/elegirplan`).

## Datos / precios

- Precios desde PocketBase: `pb.collection('precios').getFirstListItem('')` (mismo patrón que
  `ElegirPlanWizard.svelte`).
- Campos usados: `gigared`, `antina`, `dgo_full`, `pack_futbol`, y `cine` (este último puede no
  existir aún → fallback).
- **Fallback "Consultar"** cuando el precio es 0 o el campo no existe. Se reutiliza
  `formatPrice` de `src/lib/components/elegirplan/data.js`.
- `WHATSAPP_PHONE` también se reutiliza de ese módulo.

## Estructura de archivos

```
src/routes/tv/elegirtv/
├── +page.svelte            # carga precios de PB; render de las 3 cards; estado de modal + grilla
├── tvData.js               # contenido estático de los 3 servicios
├── TvServiceCard.svelte    # tarjeta grande
├── TvServiceModal.svelte   # modal explicativo + adicionales + CTA WhatsApp
└── GrillaViewer.svelte     # overlay full-screen: imagen (Gigared/Antina) o <ChannelGrid/> (DGO)
```

## Contenido de los servicios (`tvData.js`)

Cada feature tiene `type: 'pos' | 'neg' | 'neutral'` → ícono ✓ / ✗ / •.

### Gigared Play — campo `gigared`, logo `logo-gigared.png`, warnMagisXuper: true
- neutral: 86 canales
- neg: No tiene El 13 y TN
- neg: No tiene HD
- neutral: Hasta 2 TV
- pos: Todos los partidos de Argentina
- Grilla: imagen `grilla-gigaplay.png`

### Antina Play — campo `antina`, logo `logo-antina.png`, warnMagisXuper: true
- neutral: 79 canales
- neutral: Algunos canales HD
- neutral: Hasta 2 TV
- pos: Todos los partidos de Argentina
- Grilla: imagen `grilla antina play.png`
- Adicional propio: Cine (Canales HBO y Universal) — campo `cine`

### DGO — campo `dgo_full`, logo `logo-dgo.png`, warnMagisXuper: false
- neutral: Full HD
- neutral: Hasta 4 TV
- pos: Mundial completo, todos los partidos (exclusivo)
- Grilla: componente interactivo `<ChannelGrid />` (no imagen)

### Adicionales
- Todos: **Pack Fútbol** — campo `pack_futbol`
- Solo Antina: **Cine (HBO y Universal)** — campo `cine`

## Componentes

### `TvServiceCard.svelte`
Props: `service` (de tvData), `price` (formateado), `onOpen`, `onGrilla`.
Contenido: logo · precio/mes (o "Consultar") · botón texto **"Ver canales"** (→ `onGrilla`,
`stopPropagation`) · lista de features con íconos ✓/✗/• · chips de adicionales (`+ Pack Fútbol`,
y en Antina `+ Cine (HBO y Universal)`). Tocar el cuerpo → `onOpen` (modal).

### `TvServiceModal.svelte`
Props: `service`, `precios`, `onGrilla`, `onclose`.
- Header: logo + nombre + precio.
- Descripción ampliada + features.
- Botón **"¿Qué canales tiene?"** → `onGrilla`.
- Aviso Magis/Xuper (solo si `warnMagisXuper`), estilo tomado de `TvCheckModal.svelte`
  (logos `magis-logo.png`, `xuper-logo.jpg`).
- Sección adicionales con toggles (Pack Fútbol siempre; Cine solo Antina), cada uno con su
  precio/Consultar.
- CTA final **"Lo quiero"** → WhatsApp con mensaje pre-armado:
  ```
  ¡Hola Sista! Me interesa el servicio de TV {Nombre} ({precio}/mes)
  Adicionales: Pack Fútbol, Cine (HBO y Universal)
  ```
  (línea de adicionales sólo si hay alguno tildado).

### `GrillaViewer.svelte`
Overlay full-screen scrolleable. Props: `service`, `onclose`.
- Si `service.grilla.type === 'image'` → muestra la imagen.
- Si `service.grilla.type === 'channelgrid'` (DGO) → renderiza `<ChannelGrid />`.
- Cierra con botón ✕ / Escape / click en backdrop.

## Estado en `+page.svelte`
- `precios` (cargado de PB en `onMount`), `loading`.
- `openService` (null | key) → controla `TvServiceModal`.
- `grillaService` (null | key) → controla `GrillaViewer`.
- Selección de adicionales por servicio vive en el modal (estado local del modal, se resetea al
  abrir cada servicio).

## Estilo
- Variables de marca: `--violeta1` `rgb(102,37,124)`, `--magenta` `#E72B65`, `--verde` `#52FFB6`,
  `--background` `#F5F5F5`.
- Botones globales: `.btn-primary`, `.btn-secondary`, `.btn-text`, `.btn-whatsapp`, `.btn-full`.
- Desktop: `@media (min-width: 768px)` → grid de 3 columnas para las tarjetas.

## Fuera de alcance
- No se modifica `/tv` existente.
- No se crea el campo `cine` en PocketBase (lo agrega el usuario; el código ya lo contempla con
  fallback "Consultar").
