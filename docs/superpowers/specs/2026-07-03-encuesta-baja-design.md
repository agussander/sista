# Encuesta de baja — diseño

## Contexto

Sista necesita una encuesta para clientes que dieron de baja el servicio, para entender motivos y detectar oportunidades de retención. El proyecto ya tiene un patrón establecido para este tipo de encuestas en `src/routes/encuestadecalidad/`, que guarda respuestas en PocketBase vía `pb.collection(...).create(...)`.

## Ruta

`/encuestadebaja`

- `src/routes/encuestadebaja/+page.svelte` — monta el componente de la encuesta (igual que `encuestadecalidad/+page.svelte`).
- `src/routes/encuestadebaja/_components/EncuestaBaja.svelte` — lógica y markup de la encuesta.
- `src/routes/encuestadebaja/_components/Options.svelte` — copia local del componente de radio-buttons existente en `encuestadecalidad/_components/Options.svelte` (mismo patrón: `title`, `data`, `bind:res`).

La carpeta `_components` se mantiene autocontenida dentro de la ruta, siguiendo la convención ya usada en `encuestadecalidad` y `admin`.

## Persistencia

> **Actualizado (2026-07-03):** decisión final del usuario durante implementación — la colección se llama **`encuestadebaja`** (sin guión bajo) con un único campo JSON **`data`** que contiene el objeto completo de `buildPayload()`, en vez de una columna por campo como se describe abajo. Ver la nota equivalente en el plan de implementación. El campo `id_cliente` también se eliminó (ya no se pide número de cliente).

Nueva colección PocketBase: ~~`encuesta_baja`~~ (ver nota arriba).

Campos de la colección (diseño original, superado por la nota de arriba):

| Campo | Tipo | Notas |
|---|---|---|
| `motivo` | select/text | motivo principal de la baja |
| `motivo_otro` | text | solo si `motivo` = "Otro" |
| `pago_medio` | text | solo si `motivo` = dificultades económicas |
| `pago_medio_otro` | text | solo si `pago_medio` = "otro" |
| `pago_inconvenientes` | bool | Sí/No |
| `pago_inconvenientes_comentario` | text | comentario libre |
| `contacto_previo` | bool | Sí/No |
| `contacto_no_motivo` | text | solo si `contacto_previo` = No |
| `contacto_no_otro` | text | solo si `contacto_no_motivo` = "otro" |
| `conformidad` | number | escala 1–10 |
| `que_diferente` | text | pregunta abierta |
| `volveria` | text | "si" / "tal_vez" / "no" |
| `volveria_condicion` | text | solo si `volveria` ≠ "no" |
| `comentarios` | text | opcional |
| `id_nombre` | text | opcional |
| `id_telefono` | text | opcional |
| `id_cliente` | text | opcional |

La colección debe crearse manualmente en el admin de PocketBase antes de que el formulario funcione en producción (no se puede crear vía código de la app).

## Flujo de la encuesta

Todas las preguntas se muestran en una sola página larga (como `encuestadecalidad`), no wizard paso a paso, salvo el ocultamiento condicional de sub-preguntas.

1. **Motivo principal de la baja** (radio, 1 opción, obligatorio)
   - No pude pagar por dificultades económicas
   - Me pareció que el precio no era acorde al servicio
   - Tuve problemas técnicos/de conexión sin resolver
   - Contraté otro proveedor
   - Ya no necesito el servicio (mudanza, etc.)
   - Otro → muestra input de texto obligatorio (`motivo_otro`)

2. **Condicional — solo si motivo = "dificultades económicas":**
   - ¿Qué medio de pago usabas habitualmente? (radio: efectivo, transferencia, débito automático, otro → texto obligatorio)
   - ¿Tuviste inconvenientes con la forma de pago o el proceso en sí? (Sí/No, obligatorio) + comentario libre (opcional)

3. **¿Antes de la baja, te comunicaste con nosotros para buscar una solución?** (Sí/No, obligatorio)
   - Condicional — solo si "No": ¿por qué no? (radio: no sabía que se podía, no tenía tiempo, no creí que hubiera solución, otro → texto obligatorio)

4. **Conformidad con el servicio antes de la baja** (escala 1–10, botones tipo radio, obligatorio)

5. **¿Qué podríamos haber hecho diferente para que sigas siendo cliente?** (textarea, opcional)

6. **¿Considerarías volver a contratar el servicio en el futuro?** (radio: Sí / Tal vez / No, obligatorio)
   - Condicional — solo si "Sí" o "Tal vez": ¿bajo qué condición? (textarea, opcional)

7. **Comentarios adicionales** (textarea, opcional)

8. **Datos de contacto (opcionales):** nombre, teléfono, número de cliente — al final del formulario, para permitir seguimiento sin ser obligatorios.

### Reglas de validación

- Campos obligatorios: pregunta 1, pregunta 3, pregunta 4, pregunta 6, y las sub-preguntas condicionales activas en su rama (medio de pago + Sí/No inconvenientes si aplica la rama de pago; motivo de no-contacto si aplica la rama de "No" se comunicó).
- Los campos "Otro" exigen texto no vacío cuando están seleccionados.
- El resto de las preguntas (5, comentario de inconvenientes, condición para volver, 7, datos de contacto) son opcionales.
- Botón "Enviar" deshabilitado (`class:disabled`) hasta que se cumplan las condiciones obligatorias vigentes, replicando el patrón reactivo (`$:`) de `EncuestaOct2024.svelte`.
- Cuando una rama condicional se oculta (por cambio de respuesta previa), sus valores se resetean a vacío antes de enviar, para no persistir datos huérfanos de una rama no visible.

### Envío

- Al enviar: `pb.collection('encuesta_baja').create({...data})`.
- Éxito: se reemplaza el formulario por un mensaje de agradecimiento (mismo texto/estilo que `encuestadecalidad`: "Gracias por compartirnos tu opinión" / "Ya puedes cerrar esta página").
- Error: `alert(...)` pidiendo revisar los campos obligatorios, se reactiva el botón de envío (mismo manejo que el ejemplo existente).
- Estado de carga: botón muestra "Cargando..." mientras se envía.

## Estética / UX

- Reutiliza el estilo visual de `encuestadecalidad` (contenedor centrado, ancho máximo ~30em, tipografía simple, labels seleccionables con clase `.selected`, escala de fuente ~1.1em).
- Sin reCAPTCHA: es una encuesta interna post-baja, no un formulario de contacto público expuesto a spam masivo (igual criterio que `encuestadecalidad`, a diferencia de `solicitudbaja` que sí lo usa).
- `<svelte:head><meta name="robots" content="noindex"></svelte:head>` para no indexar la página, igual que la encuesta de calidad.
- `MetaTags` con título "Sista - Encuesta de baja" y descripción breve.

## Fuera de alcance

- No se crea la colección de PocketBase mediante migración/script automatizado; se documenta la estructura de campos para creación manual en el admin.
- No se agrega ningún enlace de navegación pública hacia `/encuestadebaja` (se asume que el link se comparte directamente, por ejemplo desde un flujo de baja o email, igual que `encuestadecalidad`).
- No se integra con la lógica existente de `solicitudbaja` (son flujos independientes).
