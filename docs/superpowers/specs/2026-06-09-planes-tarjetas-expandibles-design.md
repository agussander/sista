# Tarjetas de planes expandibles — Diseño

**Fecha:** 2026-06-09
**Componente principal:** `src/lib/components/home/Price.svelte`

## Objetivo

Hacer que las 6 tarjetas de planes de la home se puedan abrir. Al abrirse:

- **Desktop:** la tarjeta crece desde su posición exacta hasta llenar todo el
  contenedor de las 6 tarjetas (animación tipo FLIP).
- **Mobile:** la tarjeta crece *un poco* en el lugar y despliega más información
  + botón (estilo acordeón, no hasta llenar el contenedor).

Al abrirse se muestran las características del plan (`items`) y un botón
**"Pedir este plan"** que lleva a WhatsApp con un mensaje prellenado.

Además: una etiqueta **"Simétrico"** visible en las tarjetas simétricas, y dentro
de la tarjeta abierta de un plan simétrico, un link **"¿Qué es simétrico?"** que
abre el `SimetricoModal` ya existente.

## Estado actual

- `Price.svelte` recorre el store `priceInfo` (`src/lib/stores.js`) y renderiza 6
  tarjetas. Cada plan tiene `plan`, `mb`, `desc`, `items[]`.
- El array `items[]` ya existe en el store pero **hoy no se muestra**.
- Planes simétricos: **gamer, worker, max** (sus `items` incluyen
  `'Tráfico simétrico'`).
- Existe `src/lib/components/elegirplan/SimetricoModal.svelte` con una explicación
  pulida de "¿Qué es internet simétrico?" (barras bajada/subida). Se reutiliza.
- Layout: desktop = grid de 3 columnas (2 filas de 3); mobile = una sola tarjeta
  blanca con filas separadas por líneas. Breakpoint actual: `min-width: 1024px`.

## Diseño

### 1. Datos y detección de simétrico

Agregar un flag explícito `symmetric: true` a **gamer, worker, max** en
`src/lib/stores.js` (más claro que detectar el string `'Tráfico simétrico'` en
`items`). El array `items[]` pasa a usarse como la lista de características que se
muestra al abrir la tarjeta.

### 2. Estructura de componentes

- **`Price.svelte`** (orquestador): mantiene el estado `openIndex` (solo un plan
  abierto a la vez), decide desktop-FLIP vs mobile-acordeón vía
  `matchMedia('(min-width: 1024px)')` (reactivo a cambios de tamaño), y maneja el
  estado de apertura del `SimetricoModal`.
- **`PlanDetails.svelte`** (nuevo): el contenido que se revela — lista de
  características (`items`), precio (`$X/mes`), botón **"Pedir este plan"**
  (WhatsApp) y, solo si `symmetric`, un link **"¿Qué es simétrico?"**. Se reutiliza
  tanto en el overlay de desktop como en el acordeón de mobile, para que el
  contenido sea idéntico.
  - Props: `plan` (objeto del store), `price` (string ya formateado), `symmetric`
    (boolean), `onSimetrico` (callback que abre el modal).
- **`SimetricoModal.svelte`**: se reutiliza tal cual, importándolo en
  `Price.svelte` desde su ruta actual en `elegirplan/`.

### 3. Interacción en desktop (FLIP, sin reflow)

Las 6 tarjetas permanecen en su lugar por debajo. Al hacer click se renderiza un
**panel overlay separado** dentro de `.cont` (que pasa a `position: relative`), y
se anima con FLIP desde el rect medido de la tarjeta clickeada → `inset: 0` del
contenedor:

1. Capturar el rect de la tarjeta clickeada relativo a `.cont` → setear CSS vars
   `--t / --l / --w / --h`.
2. El overlay arranca en esa caja y, en el siguiente frame, transiciona
   `top/left/width/height` a `0/0/100%/100%` (~250–300ms, ease). El contenido
   aparece con un fade levemente retrasado.
3. Una atenuación sutil (dim) cubre las tarjetas de atrás. Cierra con **✕**,
   **Escape**, o click en el dim (revierte la animación).

Renderizar un overlay dedicado (en vez de promover la tarjeta clickeada a
`absolute`) evita que el grid de abajo haga reflow.

El contenedor mantiene su altura natural (2 filas) durante la apertura, así el
overlay calza exactamente sobre el área de las 6 tarjetas.

### 4. Interacción en mobile (acordeón)

El layout sigue siendo la tarjeta blanca apilada. Al tocar una fila de plan se
revela una sección `PlanDetails` **debajo de esa fila** vía la transición `slide`
de Svelte — crece un poco, muestra características + botón de WhatsApp (+ link de
simétrico si corresponde). Tocar otra fila cierra la anterior. No crece hasta
llenar el contenedor.

### 5. Etiqueta de simétrico

Un chip pequeño **"Simétrico"** en la tarjeta colapsada (arriba a la derecha en
desktop, en línea junto al nombre del plan en mobile) para gamer/worker/max.
Dentro de la vista expandida, el link "¿Qué es simétrico?" abre `SimetricoModal`.

### 6. CTA de WhatsApp

Link prellenado por plan al número existente (`5492213541906`), por ejemplo:
*"Hola! Quiero contratar el plan Gamer (300mb)"*. El texto se arma con el nombre
del plan (capitalizado) y los `mb`, URL-encoded. `target="_blank"` +
`rel="noopener noreferrer"`.

### 7. Accesibilidad

- Las tarjetas pasan a ser `<button>` reales (Enter/Space para abrir).
- `Escape` cierra.
- Al abrir, el foco se mueve dentro del panel; al cerrar, vuelve a la tarjeta que
  lo abrió.

## Fuera de alcance (YAGNI)

- No se agrega un nuevo modal ni se mueve `SimetricoModal` de carpeta.
- No se cambia el endpoint de precios ni la lógica de PocketBase.
- No se rediseñan la "ayuda-card" ni el CTA inferior de "Solicitar ahora".
