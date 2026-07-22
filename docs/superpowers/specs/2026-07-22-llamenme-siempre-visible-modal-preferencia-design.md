# "Quiero que me llamen" — siempre visible + modal de preferencia

**Fecha:** 2026-07-22

## Contexto

Hoy el formulario "Quiero que me llamen" (`LlamenmeForm.svelte`, dentro de
`Hero.svelte`) sólo se muestra dentro del horario de atención (lunes a viernes
9:30–16:30 ART, salvo override del admin). Fuera de ese horario el formulario
directamente no aparece. Al enviar, `send-llamenme.php` guarda `{ numero }` en
la colección de PocketBase `quiero_que_me_llamen` y manda un mail; luego se
muestra un modal con el aviso de "puede aparecer como spam".

## Objetivo

- El formulario está **siempre visible**.
- El horario de atención cambia a **lunes a viernes 9:00–16:40 ART**.
- **Dentro** del horario: al enviar, se muestra el aviso de spam directamente en
  la tarjeta (sin modal).
- **Fuera** del horario: al enviar, aparece un **modal con 3 opciones de
  preferencia de contacto**; la opción elegida se guarda en PocketBase.

## Comportamiento

### Visibilidad

- El form se renderiza siempre (una vez montado el `Hero`).
- Se elimina el gating `showLlamenme` que lo ocultaba fuera de horario.

### Ventana de atención (aviso vs modal)

Reemplaza la semántica "mostrar/ocultar form" por "aviso directo (dentro) vs
modal de preferencia (fuera)".

- Horario real: **lunes a viernes, 9:00 (inclusive) a 16:40 (inclusive)**, ART.
- Override del admin (`auto` | `abierto` | `cerrado`), sin cambios en el panel:
  - `abierto` → modo aviso (como si estuviera dentro de horario).
  - `cerrado` → modo modal (como si estuviera fuera de horario).
  - `auto` → usa el horario real.

### Envío — dentro de la ventana

1. Validar número (nativo `required`) → reCAPTCHA → POST a
   `send-llamenme.php` con `extra="en_horario"`.
2. La tarjeta muestra el éxito **con el aviso de spam integrado**:
   > ¡Listo! Te llamamos a la brevedad.
   > Puede aparecerte como número privado o spam.
3. No aparece modal.

### Envío — fuera de la ventana

1. Validar número → **abrir el modal** (todavía sin POST).
2. El modal muestra:
   - **Encabezado** (según día/hora ART, ver más abajo).
   - **3 opciones**, cada una con su aclaración:
     - "Llamenme en la mañana" — *de 9 a 13*
     - "Llamenme en la tarde" — *de 13 a 17*
     - "Hablar por WhatsApp" — *sublabel según el día*
3. Al elegir:
   - **Mañana / Tarde:** reCAPTCHA → POST con `extra="manana"` o `"tarde"` →
     cerrar modal → la tarjeta muestra el éxito (con aviso de spam).
   - **WhatsApp:** abrir `https://api.whatsapp.com/send?phone=5492213541906`
     inmediatamente (dentro del gesto del click, para evitar bloqueo de popup)
     y disparar el POST con `extra="whatsapp"` en segundo plano.

### Copys dependientes del día/hora (ART)

**Encabezado del modal:**

- Lunes a viernes **antes de las 9:00** → "Te llamamos hoy".
- Viernes (después de la ventana) o sábado → "Te llamamos el lunes".
- Resto (lunes a jueves después de la ventana, domingo) → "Te llamamos mañana".

**Sublabel de WhatsApp:**

- Lunes a viernes → "En línea hasta las 22:00".
- Sábado → "En línea hasta las 19:00".
- Domingo → "Guardia técnica".

## Arquitectura / archivos

### `src/lib/llamenme/visibility.js`

- `isWithinCallHours(now)`: cambiar `start` a `9*60` y `end` a `16*60+40`.
- Nueva `getBuenosAiresParts(now)` (o helper interno) que exponga weekday +
  minutos en ART (refactor del `Intl.DateTimeFormat` ya existente).
- Nueva `computeCallHeading(now)` → "Te llamamos hoy" | "…el lunes" | "…mañana"
  según la regla de encabezado.
- Nueva `computeWhatsappSublabel(now)` → texto según día.
- `computeFormVisible` pasa a representar **modo aviso**: renombrar/añadir
  `computeInCallWindow(override, now)` (misma lógica: `abierto`→true,
  `cerrado`→false, `auto`→`isWithinCallHours`). Actualizar los usos.

### `src/lib/components/home/Hero.svelte`

- Renderizar `LlamenmeForm` siempre (con `mounted`), sin `showLlamenme`.
- Tras `fetchOverride`, calcular `inCallWindow = computeInCallWindow(override)`
  y pasarlo como prop a `LlamenmeForm`. Default razonable antes de resolver el
  override: `computeInCallWindow('auto')` (horario real).

### `src/lib/components/home/LlamenmeForm.svelte`

- Nueva prop `inCallWindow` (boolean).
- `handleSubmit`: si `inCallWindow` → flujo directo (reCAPTCHA + POST
  `extra="en_horario"` + éxito). Si no → abrir modal.
- Modal reescrito: encabezado + 3 botones con sublabels, usando los helpers de
  `visibility.js`. Handlers `chooseManana` / `chooseTarde` / `chooseWhatsapp`.
- Un único helper `postLead(extra)` que ejecuta reCAPTCHA y hace el POST
  (reutilizado por todos los caminos salvo el redirect de WhatsApp, que hace el
  POST sin bloquear la apertura del chat).
- El aviso de spam se integra en el estado de éxito de la tarjeta.

### `static/assets/send-llamenme.php`

- Leer `extra` de `$_POST`, validar contra allowlist
  (`en_horario`, `manana`, `tarde`, `whatsapp`); si no coincide, guardar `""`.
- Incluir `extra` en el payload a PocketBase y en el mail (`Preferencia`).
- Sincronizar el cambio a `build/assets/send-llamenme.php` antes de subir por
  FTP (ver memoria de deploy static/ vs build/).

### PocketBase (manual, lo hace el usuario)

- Agregar campo **`extra`** (text) a la colección `quiero_que_me_llamen`.
- Valores esperados: `en_horario` | `manana` | `tarde` | `whatsapp`.

## Tests

- `src/lib/llamenme/visibility.test.js`:
  - Ajustar casos de `isWithinCallHours` a los nuevos límites 9:00 / 16:40
    (borde inferior 8:59 fuera / 9:00 dentro; borde superior 16:40 dentro /
    16:41 fuera).
  - `computeCallHeading`: casos viernes-mañana ("hoy"), viernes-noche ("lunes"),
    sábado ("lunes"), domingo ("mañana"), martes-noche ("mañana"),
    martes-mañana-temprano ("hoy").
  - `computeWhatsappSublabel`: L–V / sábado / domingo.
  - `computeInCallWindow`: override abierto/cerrado/auto.

## Fuera de alcance (YAGNI)

- No se cambia el panel de admin ni la lógica de override (sólo su semántica de
  consumo).
- No se agrega segundo PATCH a PocketBase: el `extra` viaja en el único POST.
- No se cambia el número ni el mensaje de WhatsApp respecto al resto del sitio.
