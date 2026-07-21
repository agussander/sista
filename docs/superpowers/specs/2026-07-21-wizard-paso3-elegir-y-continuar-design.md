# Paso 3 (Internet) del wizard: click expande info, botón explícito para avanzar

## Contexto

En el wizard de "elegir plan" (`src/lib/components/elegirplan/`), el Paso 3
(`Step3Internet.svelte`) usa `OptionCard.svelte` para listar los planes de
Internet. Hoy, clickear en cualquier parte de la tarjeta selecciona el plan
**y avanza inmediatamente** al paso siguiente (`onclick={() => { setInternetPlan(plan.key); next(); }}`).
Existe además un botón interno "Más información" que expande una lista de
detalles (`details`) sin disparar la selección.

Este comportamiento es inconsistente con el Paso 4 (TV), donde clickear una
tarjeta (`TvServiceCard`) solo abre un modal informativo, y el usuario debe
confirmar explícitamente con un botón "Elegir y continuar" dentro del modal
para avanzar.

## Objetivo

Alinear el Paso 3 con ese mismo principio: **click = ver información, nunca
avanza solo**; avanzar requiere un botón explícito "Elegir y continuar".

Alcance: solo `Step3Internet.svelte` y `OptionCard.svelte`. Paso 1
(`Step1Tipo.svelte`) y Paso 5 (`Step5Adicionales.svelte`) usan `OptionCard`
sin `details` y no cambian su comportamiento actual (click sigue
seleccionando/alternando de inmediato).

## Diseño

### `OptionCard.svelte`

- Cuando la tarjeta recibe `details` no vacío, el click en cualquier parte
  del cuerpo de la tarjeta (y Enter/Space con foco en la tarjeta) alterna
  expandir/colapsar en vez de invocar `onclick` (que hoy selecciona y
  avanza).
- Cuando no hay `details` (Paso 1, Paso 5), el comportamiento no cambia:
  el click sigue invocando `onclick` directamente.
- Dentro del bloque expandido (`.details`, ya existente, donde vive el link
  "¿Qué es simétrico?"), se agrega un botón nuevo con label configurable
  (`ctaLabel`, default `"Elegir y continuar"`) que invoca `onclick` (la
  función de selección+avance que ya recibe el componente). Este botón es
  la única forma de avanzar cuando la tarjeta tiene `details`.
- El botón "Más información" / chevron existente se mantiene como
  affordance visual y sigue mostrando el mismo estado expandido/colapsado.
- Expansión tipo acordeón: solo una tarjeta puede estar expandida a la vez
  entre las tarjetas de un mismo listado. Esto requiere que el estado de
  "expandido" pueda ser controlado desde el padre en vez de ser
  puramente interno:
  - Nuevos props opcionales: `expanded` (boolean) y `onToggleExpand`
    (callback). Si `onToggleExpand` está definido, el componente es
    "controlado": usa el valor de `expanded` recibido y delega el toggle
    al callback en vez de manejar estado propio.
  - Si no se pasan, `OptionCard` sigue manejando su propio estado interno
    (comportamiento actual, sin acordeón) — no rompe otros usos futuros.

### `Step3Internet.svelte`

- Nuevo estado local `expandedPlan = $state(null)` (key del plan
  expandido, o `null`).
- Cada `OptionCard` del `#each` recibe:
  - `expanded={expandedPlan === plan.key}`
  - `onToggleExpand={() => (expandedPlan = expandedPlan === plan.key ? null : plan.key)}`
  - `ctaLabel="Elegir y continuar"`
  - `onclick` se mantiene igual (`() => { setInternetPlan(plan.key); next(); }`),
    ahora solo se dispara desde el botón nuevo dentro del detalle expandido.

### Fuera de alcance

- Paso 1 y Paso 5 no cambian.
- No se toca `TvServiceCard` / `Step4TV` (ya tienen este patrón).
- No se agrega contenido nuevo de "detalles" — los planes de Internet ya
  traen `details={plan.features}` desde `data.js`.

## Testing

- Verificación manual en navegador (Paso 3): click en una tarjeta expande
  sus detalles y colapsa cualquier otra tarjeta previamente expandida;
  el botón "Elegir y continuar" selecciona el plan y avanza al paso
  siguiente; Enter/Space con foco en la tarjeta también expande en vez de
  avanzar.
- `data.test.js` no debería verse afectado (no testea `OptionCard` ni
  `Step3Internet` directamente); no se agregan tests nuevos dado que el
  proyecto no tiene tests de componentes Svelte existentes para este
  árbol.
