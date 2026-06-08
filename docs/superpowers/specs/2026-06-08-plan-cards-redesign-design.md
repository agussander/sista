# Rediseño de tarjetas de planes — Home

**Fecha:** 2026-06-08  
**Archivo principal:** `src/lib/components/home/Price.svelte`  
**Datos:** `src/lib/stores.js`

---

## Objetivo

Simplificar las tarjetas de planes en la página de inicio. Tarjetas más delgadas y legibles, eliminando el botón "Me interesa" por tarjeta y la animación de stack en mobile. Un único CTA de "Solicitar ahora" debajo de toda la grilla dirige al WhatsApp.

---

## Estructura de la tarjeta

Cada tarjeta muestra dos filas:

```
┌─────────────────────────────────────┐
│  Home                       $X.XXX  │
│  75mb  ·  Uso básico                │
└─────────────────────────────────────┘
```

- **Fila 1:** nombre del plan (izquierda, semi-bold, capitalizado) + precio en magenta (derecha)
- **Fila 2:** mb en violeta/bold + descripción corta en gris
- **Altura:** ~6.5em
- **Sin botón** por tarjeta
- **Hover:** translateY(-2px) + sombra aumentada (sin scale)

---

## Datos — `stores.js`

### Campo `desc` nuevo (por plan)

| Plan   | desc                              |
|--------|-----------------------------------|
| home   | Uso básico                        |
| fast   | Ideal para streaming y trabajo    |
| power  | Mayor velocidad, más dispositivos |
| gamer  | Tráfico simétrico para gaming     |
| worker | Simétrico para trabajo remoto     |
| max    | El máximo rendimiento disponible  |

### Cambio en `items`

Reemplazar todas las variantes de "Wi-fi Dual Band" / "Wifi Dual Band" / "Wi-Fi Dual Band" por `"Ilimitado"` en todos los planes. Los `items` siguen siendo usados por `PlanDetails.svelte` (modal de detalle).

---

## Layout

### Desktop (≥1024px)

- Grid de 3 columnas, cards de ~20em de ancho, gap de 1em
- `cont-outer` centra la grilla (igual que ahora)

### Mobile (<880px)

- Columna única
- Cards al 100% del contenedor, max-width ~28rem, centradas
- Gap de 0.75em entre tarjetas
- **Eliminar toda la lógica de stack:** `isMobileStack`, `applyStack`, `clearStackStyles`, `scheduleUpdate`, listeners de scroll/resize, `wrapperEl`, `cardEls`, `rafId`. El componente deja de ser interactivo en mobile.
- Las tarjetas dejan de tener `role="button"` / `onclick` / `onkeydown` (ya no abren el modal)

---

## CTA — Debajo de la grilla

Un único botón centrado debajo del grid:

- **Texto:** "Solicitar ahora"
- **Estilo:** botón WhatsApp (verde, con ícono)
- **Link:** `https://api.whatsapp.com/send?phone=5492213541906&text=Hola!%20Quisiera%20información%20sobre%20los%20planes`
- `target="_blank" rel="noopener noreferrer"`

---

## Archivos afectados

| Archivo | Cambio |
|---------|--------|
| `src/lib/stores.js` | Agregar `desc` a cada plan; reemplazar "Wifi Dual Band" variantes por "Ilimitado" en `items` |
| `src/lib/components/home/Price.svelte` | Rediseño completo de template y estilos; eliminación de lógica de stack |

---

## Archivos NO afectados

- `src/lib/components/ui/PlanDetails.svelte` — sigue usando `items` del store, sin cambios
- `src/lib/components/layout/Modal.svelte` — sin cambios
