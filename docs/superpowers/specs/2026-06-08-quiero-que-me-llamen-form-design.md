# Formulario "Quiero que me llamen" en el hero

Fecha: 2026-06-08

## Objetivo

Capturar leads de callback desde el hero de la home con un formulario corto y
eficiente (nombre + número), enviar los datos de forma segura a PocketBase y
poder verlos desde el panel de administración.

## Decisiones tomadas

- **Envío seguro:** proxy PHP + reCAPTCHA v3 (patrón de `Form1`), no create
  directo desde el cliente.
- **Colección pb:** `quiero_que_me_llamen` con campos `nombre` y `numero`
  (el `createRule` ya está abierto a público; la config de pb la maneja el
  usuario).
- **UX al enviar:** confirmación inline (el form se reemplaza por un mensaje),
  sin navegar a `/gracias`.
- **Email:** además de guardar en pb, se manda email de aviso del lead vía
  `MailHandler` (best-effort, no bloquea el éxito).
- **Layout:** en el hero. Desktop: a la derecha del texto. Mobile: apilado
  debajo del texto, antes de la sección Fibra Óptica/TV (`What`).

## Componentes y cambios

### 1. `src/lib/components/home/LlamenmeForm.svelte` (nuevo)

Formulario compacto, on-brand (verde/violeta).

- Campos:
  - `nombre` — `input[type=text]`, requerido.
  - `numero` — `input[type=tel]`, requerido.
  - `website` — honeypot oculto (anti-bot), debe quedar vacío.
- Sin título/heading: la acción está en el botón **"Quiero que me llamen"**.
- Usa `Recaptcha.svelte` (reCAPTCHA v3, acción `llamenme`), igual que `Form1`:
  espera `ready` antes de habilitar el submit.
- Al enviar:
  1. Ejecuta reCAPTCHA y obtiene token.
  2. Arma `FormData` con `nombre`, `numero`, `website`, `g-recaptcha-response`.
  3. `POST` a `/assets/send-llamenme.php`.
  4. Parsea JSON `{ success, message }`.
- Estados:
  - `idle`: form visible.
  - `loading`: botón "Enviando…", deshabilitado.
  - `success`: el form se reemplaza por mensaje inline
    "¡Listo! Te llamamos a la brevedad." (sin recargar ni navegar).
  - `error`: mensaje de error con opción de reintentar (vuelve a `idle`).

### 2. `src/lib/components/home/Hero.svelte` (modificar)

- Envolver el bloque `.text` existente + `<LlamenmeForm>` en un contenedor flex
  (`.hero-content`).
- Desktop (`min-width: 768px`): `flex-direction: row` — texto izquierda, form
  derecha.
- Mobile: `flex-direction: column` — texto y luego el form. Como `What` (Fibra
  Óptica / TV) viene después del hero, el form queda naturalmente antes de esa
  sección.
- El form debe tener `position: relative` + `z-index` por encima de
  `.lines-wrapper` (líneas animadas de fondo).
- No romper las transiciones `fly`/`fade` existentes del bloque de texto.

### 3. `static/assets/send-llamenme.php` (nuevo) + `static/assets/includes/recaptcha-verify.php` (nuevo)

**`recaptcha-verify.php`**: helper compartido que extrae la verificación de
reCAPTCHA v3 actualmente embebida en `form-handler.php`.

- Función `verify_recaptcha(string $token, ?string $remoteip): array`
  devuelve `['ok' => bool, 'reason' => string]`.
- Verifica con `https://www.google.com/recaptcha/api/siteverify` vía cURL,
  usando `getenv('RECAPTCHA_SECRET_KEY')`, score mínimo `0.5`.
- **No** se modifica `form-handler.php` (evitar regresión en forms existentes);
  el helper lo consume solo el endpoint nuevo.

**`send-llamenme.php`**:

- `require` de `load_env.php`, `recaptcha-verify.php`, `MailHandler.php`.
- `header('Content-Type: application/json')`, output buffering como en
  `form-handler.php`.
- Flujo:
  1. Si `website` (honeypot) no está vacío → `{ success:false, message:'spam' }`.
  2. `verify_recaptcha(...)`; si falla → `{ success:false, message:'recaptcha' }`.
  3. Validar `nombre` y `numero`: `trim`, requeridos, límite de largo (p. ej.
     `nombre` ≤ 80, `numero` ≤ 40). Si falta alguno →
     `{ success:false, message:'incompleto', field }`.
  4. **Write a pb** (fuente de verdad): `POST` sin auth a
     `{$pbUrl}/api/collections/quiero_que_me_llamen/records` con cuerpo JSON
     `{ "nombre": ..., "numero": ... }` vía cURL.
     `$pbUrl = getenv('VITE_POCKETBASE_URL') ?: 'https://sista.pockethost.io'`.
     Si la respuesta no es 2xx → `{ success:false, message:'pb' }` (loguea el
     cuerpo de error) y **no** se intenta el email.
  5. **Email best-effort**: si el write a pb fue OK, `MailHandler->send(...)`
     con subject "Quiero que me llamen" y campos `Nombre`, `Número`. Si el mail
     falla, se loguea pero igual `{ success:true }` (el lead ya está guardado).
  6. `{ success:true }`.
- No requiere secrets nuevos: usa `RECAPTCHA_SECRET_KEY`, `SMTP_*`,
  `VITE_POCKETBASE_URL` (ya en `.env.example`).

### 4. Pestaña en admin

**`src/routes/admin/_components/mantenimiento/Dashboard/llamenme/Llamenme.svelte`** (nuevo):

- `onMount`: `pb.collection('quiero_que_me_llamen').getList(1, 200, { sort: '-created' })`.
- Tabla con columnas: **Nombre**, **Número** (link `https://wa.me/<numero>` y/o
  `tel:`), **Fecha** (formateada `es-AR` con fecha+hora).
- Encabezado con contador de leads y botón "Refrescar".
- Estados de carga (`Spinner`) y vacío ("Todavía no hay solicitudes").
- Manejo de error si la lectura falla (p. ej. permisos).

**`Sidebar.svelte`** (modificar): agregar a `mainItems` un ítem
`{ title: 'Quiero que me llamen', content: 'llamenme', icon: <teléfono> }`.

**`Content.svelte`** (modificar): importar `Llamenme` y agregar
`{:else if selected === 'llamenme'}<Llamenme />`.

## Flujo de datos

```
LlamenmeForm (cliente)
  └─ reCAPTCHA token + nombre + numero + honeypot
     └─ POST /assets/send-llamenme.php
          ├─ verify_recaptcha (Google siteverify)
          ├─ honeypot check
          ├─ validación nombre/numero
          ├─ POST pb /api/collections/quiero_que_me_llamen/records  ← fuente de verdad
          └─ MailHandler->send (aviso, best-effort)
     └─ { success } → confirmación inline

Admin /admin (auth users)
  └─ Llamenme.svelte → pb.collection('quiero_que_me_llamen').getList → tabla
```

## Manejo de errores

| Caso | Resultado |
|------|-----------|
| Honeypot lleno | `success:false` (`spam`), no escribe nada |
| reCAPTCHA inválido/score bajo | `success:false` (`recaptcha`) |
| Campo faltante | `success:false` (`incompleto`, `field`) |
| Falla write pb | `success:false` (`pb`), sin email; usuario reintenta |
| Falla email (pb OK) | `success:true`, error logueado |
| Lectura admin sin permiso | mensaje de error en el viewer |

## Supuestos y riesgos

- **Reglas de lectura en pb:** el admin se autentica como `users`; para listar
  los leads, `listRule`/`viewRule` de `quiero_que_me_llamen` deben permitir auth
  (`@request.auth.id != ""`). Lo configura el usuario.
- **createRule público:** el gate de reCAPTCHA cubre el flujo normal, pero un bot
  podría postear directo a pb. El honeypot mitiga parcialmente. Cerrar createRule
  + autenticar el PHP sería lo máximo en seguridad; se deja público por decisión
  del usuario.

## Testing / verificación

- PHP no es unit-testeable sin servidor; verificación manual:
  - Submit válido → registro aparece en pb y en la pestaña admin; llega email.
  - Honeypot lleno / sin token → rechazo.
  - Campos vacíos → rechazo client-side (required) y server-side.
- Svelte: `npm run build` debe pasar sin errores; revisar layout desktop/mobile
  del hero.

## Fuera de alcance

- Cambios en `form-handler.php` o en las forms existentes.
- Configuración de la colección/reglas de PocketBase (la hace el usuario).
- Validación avanzada de formato telefónico / normalización internacional.
