# Página intermedia `/quiero-tv` — Design

**Fecha:** 2026-06-05

## Objetivo

Cambiar los CTA "Quiero tener TV" de `/tv` para que, en lugar de abrir WhatsApp,
lleven a una página intermedia que pregunta si el usuario ya tiene internet de
Sista y lo deriva al flujo correcto.

## Comportamiento

Nueva página en `/quiero-tv` con dos opciones:

- **"Ya tengo internet de Sista"** → `/tv/elegirtv` (elección de servicio de TV).
- **"No tengo internet de Sista"** → `/elegirplan` (wizard de armado de plan).

## Implementación

### 1. Nueva ruta: `src/routes/quiero-tv/+page.svelte`

- Reutiliza `OptionCard` (`$lib/components/elegirplan/OptionCard.svelte`) y
  `StepHeader` (`$lib/components/elegirplan/StepHeader.svelte`).
- Cada opción es un link (`<a href>`) envolviendo / usando `OptionCard` con ícono
  y subtítulo aclaratorio.
- `MetaTags` con `robots="noindex, nofollow"`, igual que `/elegirplan`.
- Encabezado: título "¿Querés sumar TV?" + subtítulo orientativo.

### 2. Cambios en `src/routes/tv/+page.svelte`

- Botón del hero (línea ~10) y botón de la sección features (línea ~86):
  - `href` pasa de la URL de WhatsApp a `/quiero-tv`.
  - Se quita `target="_blank"`, `rel="noopener noreferrer"`, la clase
    `btn-whatsapp` y el `<span class="wsp-icon">` (ícono de WhatsApp).
  - Quedan como CTA internos con estilo de botón primario.

### 3. Modo mantenimiento

- Agregar `'/quiero-tv'` a `allowedPrefixes` en `src/routes/+layout.svelte`
  para que la ruta sea accesible mientras el sitio está en mantenimiento.

## Notas

- La ruta real de elección de TV es `/tv/elegirtv` (no `/elegirtv`).
