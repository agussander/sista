# Formulario "Quiero que me llamen" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capturar leads de callback desde el hero (nombre + número), guardarlos en PocketBase vía un proxy PHP con reCAPTCHA + aviso por email, y listarlos en una pestaña del admin.

**Architecture:** El componente Svelte `LlamenmeForm` (en el hero) postea a `static/assets/send-llamenme.php`. El PHP verifica reCAPTCHA v3 (helper reutilizable), chequea un honeypot, valida los campos, hace un POST sin auth a la colección `quiero_que_me_llamen` de PocketBase (createRule público) y manda un email best-effort a agustin@sista.ar. El admin lee la colección con la auth de `users` y la muestra en una tabla.

**Tech Stack:** SvelteKit (adapter-static, Svelte 5), PHP 8.4 (en el host), PocketBase (pockethost), reCAPTCHA v3, PHPMailer (vía `MailHandler`).

**Spec:** `docs/superpowers/specs/2026-06-08-quiero-que-me-llamen-form-design.md`

---

## Notas de testing

- El sitio es estático + PHP en el host; el PHP no se unit-testea: se verifica con un server local `php -S` y `curl` para los branches que cortan antes de la red (honeypot, token vacío). El happy-path completo (reCAPTCHA válido + write real a pb + email) se verifica manual al deployar.
- Los componentes Svelte se verifican con `npm run build` (no hay script `check`). El layout del hero se revisa a ojo en `npm run dev` (el preview MCP no funciona en este entorno).
- `LlamenmeForm.svelte` se escribe en **modo legacy** (plain `let` reactivo + `on:submit` / `on:ready`) para calcar `Form1.svelte`, que ya funciona con el `Recaptcha.svelte` (que usa `createEventDispatcher`). El viewer del admin usa **runes** (`$state`) como el resto de `Dashboard/`.

## File Structure

- **Crear** `static/assets/includes/recaptcha-verify.php` — helper `verify_recaptcha()` reutilizable.
- **Crear** `static/assets/send-llamenme.php` — endpoint: honeypot + reCAPTCHA + validación + write pb + email.
- **Crear** `src/lib/components/home/LlamenmeForm.svelte` — formulario del hero (form + estados).
- **Modificar** `src/lib/components/home/Hero.svelte` — layout 2 columnas (texto + form).
- **Crear** `src/routes/admin/_components/mantenimiento/Dashboard/llamenme/Llamenme.svelte` — viewer/tabla.
- **Modificar** `src/routes/admin/_components/mantenimiento/Dashboard/Sidebar.svelte` — ítem de menú.
- **Modificar** `src/routes/admin/_components/mantenimiento/Dashboard/Content.svelte` — ruteo del viewer.

---

## Task 1: Helper reutilizable de reCAPTCHA (PHP)

**Files:**
- Create: `static/assets/includes/recaptcha-verify.php`

- [ ] **Step 1: Crear el helper**

`static/assets/includes/recaptcha-verify.php`:

```php
<?php
/**
 * Verificación server-side de reCAPTCHA v3.
 * Extraído del flujo de form-handler.php para reusar en endpoints nuevos
 * sin tocar las forms existentes.
 */
if (!function_exists('verify_recaptcha')) {
    /**
     * @param  string|null $token    Token g-recaptcha-response del cliente
     * @param  string|null $remoteip IP del cliente (opcional)
     * @return array{ok: bool, reason: string, score: float|null}
     */
    function verify_recaptcha($token, $remoteip = null) {
        $token = is_string($token) ? trim($token) : '';
        if ($token === '') {
            return ['ok' => false, 'reason' => 'empty', 'score' => null];
        }

        $secretKey = getenv('RECAPTCHA_SECRET_KEY') ?: '';
        if ($secretKey === '') {
            error_log('verify_recaptcha: RECAPTCHA_SECRET_KEY no configurada');
            return ['ok' => false, 'reason' => 'config', 'score' => null];
        }

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, 'https://www.google.com/recaptcha/api/siteverify');
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
            'secret'   => $secretKey,
            'response' => $token,
            'remoteip' => $remoteip,
        ]));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        $raw = curl_exec($ch);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($curlError) {
            error_log('verify_recaptcha cURL error: ' . $curlError);
            return ['ok' => false, 'reason' => 'network', 'score' => null];
        }

        $data = json_decode($raw, true);
        if (!$data || !isset($data['success'])) {
            error_log('verify_recaptcha respuesta inválida: ' . $raw);
            return ['ok' => false, 'reason' => 'invalid', 'score' => null];
        }

        $score = isset($data['score']) ? (float) $data['score'] : null;
        if (!$data['success']) {
            return ['ok' => false, 'reason' => 'failed', 'score' => $score];
        }
        if ($score !== null && $score < 0.5) {
            return ['ok' => false, 'reason' => 'low_score', 'score' => $score];
        }
        return ['ok' => true, 'reason' => 'ok', 'score' => $score];
    }
}
```

- [ ] **Step 2: Verificar que el archivo parsea y el branch offline funciona**

Run:
```bash
php -l static/assets/includes/recaptcha-verify.php
php -r "require 'static/assets/includes/recaptcha-verify.php'; echo json_encode(verify_recaptcha('')), PHP_EOL;"
```
Expected:
- Primera línea: `No syntax errors detected in ...`
- Segunda línea: `{"ok":false,"reason":"empty","score":null}`

- [ ] **Step 3: Commit**

```bash
git add static/assets/includes/recaptcha-verify.php
git commit -m "feat: helper verify_recaptcha reutilizable"
```

---

## Task 2: Endpoint PHP `send-llamenme.php`

**Files:**
- Create: `static/assets/send-llamenme.php`

- [ ] **Step 1: Crear el endpoint**

`static/assets/send-llamenme.php`:

```php
<?php
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

require_once __DIR__ . '/includes/load_env.php';
require_once __DIR__ . '/includes/recaptcha-verify.php';
require_once __DIR__ . '/includes/MailHandler.php';

header('Content-Type: application/json');
ob_start();

function json_out($payload) {
    ob_clean();
    echo json_encode($payload);
    exit;
}

// 1. Honeypot: si vino lleno, es bot
$honeypot = isset($_POST['website']) ? trim($_POST['website']) : '';
if ($honeypot !== '') {
    json_out(['success' => false, 'message' => 'spam']);
}

// 2. reCAPTCHA v3
$token = $_POST['g-recaptcha-response'] ?? '';
$captcha = verify_recaptcha($token, $_SERVER['REMOTE_ADDR'] ?? null);
if (!$captcha['ok']) {
    json_out(['success' => false, 'message' => 'recaptcha', 'reason' => $captcha['reason']]);
}

// 3. Validación de campos
$nombre = isset($_POST['nombre']) ? trim($_POST['nombre']) : '';
$numero = isset($_POST['numero']) ? trim($_POST['numero']) : '';
if ($nombre === '') {
    json_out(['success' => false, 'message' => 'incompleto', 'field' => 'nombre']);
}
if ($numero === '') {
    json_out(['success' => false, 'message' => 'incompleto', 'field' => 'numero']);
}
$nombre = mb_substr($nombre, 0, 80);
$numero = mb_substr($numero, 0, 40);

// 4. Write a PocketBase (fuente de verdad)
$pbUrl = rtrim(getenv('VITE_POCKETBASE_URL') ?: 'https://sista.pockethost.io', '/');
$pbEndpoint = $pbUrl . '/api/collections/quiero_que_me_llamen/records';

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $pbEndpoint);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['nombre' => $nombre, 'numero' => $numero]));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 10);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
$pbRaw = curl_exec($ch);
$pbStatus = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$pbError = curl_error($ch);
curl_close($ch);

if ($pbError || $pbStatus < 200 || $pbStatus >= 300) {
    error_log('send-llamenme pb error (' . $pbStatus . '): ' . ($pbError ?: $pbRaw));
    json_out(['success' => false, 'message' => 'pb']);
}

// 5. Email best-effort (el lead ya está guardado en pb)
try {
    $mailHandler = new MailHandler();
    $mailHandler->setTo('agustin@sista.ar');
    $templatePath = __DIR__ . '/correo_template.html';
    $mailResult = $mailHandler->send('Quiero que me llamen', [
        'title'  => 'Quiero que me llamen',
        'Nombre' => $nombre,
        'Numero' => $numero,
    ], $templatePath);
    if (empty($mailResult['success'])) {
        error_log('send-llamenme email falló: ' . ($mailResult['error'] ?? 'desconocido'));
    }
} catch (Throwable $e) {
    error_log('send-llamenme email excepción: ' . $e->getMessage());
}

// 6. OK
json_out(['success' => true]);
```

- [ ] **Step 2: Lint**

Run: `php -l static/assets/send-llamenme.php`
Expected: `No syntax errors detected in static/assets/send-llamenme.php`

- [ ] **Step 3: Levantar server local y testear branches offline**

Run (en background o en otra terminal):
```bash
php -S 127.0.0.1:8799 -t static/assets >/tmp/php-llamenme.log 2>&1 &
sleep 1
echo "--- honeypot ---"; curl -s -X POST -F 'website=bot' -F 'nombre=x' -F 'numero=1' http://127.0.0.1:8799/send-llamenme.php; echo
echo "--- token vacío ---"; curl -s -X POST -F 'nombre=x' -F 'numero=1' http://127.0.0.1:8799/send-llamenme.php; echo
```
Expected:
- honeypot → `{"success":false,"message":"spam"}`
- token vacío → `{"success":false,"message":"recaptcha","reason":"empty"}`

Nota: el happy-path (reCAPTCHA real + write a pb + email) NO se testea acá; se verifica manual al deployar (ver Task 7).

- [ ] **Step 4: Bajar el server local**

Run: `kill %1 2>/dev/null || pkill -f 'php -S 127.0.0.1:8799'`

- [ ] **Step 5: Commit**

```bash
git add static/assets/send-llamenme.php
git commit -m "feat: endpoint send-llamenme.php (reCAPTCHA + honeypot + write pb + email)"
```

---

## Task 3: Componente `LlamenmeForm.svelte`

**Files:**
- Create: `src/lib/components/home/LlamenmeForm.svelte`

- [ ] **Step 1: Crear el componente (modo legacy, calcando Form1)**

`src/lib/components/home/LlamenmeForm.svelte`:

```svelte
<script>
    import { onMount } from 'svelte';
    import Recaptcha from '$lib/components/ui/Recaptcha.svelte';

    let loading = false;
    let mounted = false;
    let recaptchaReady = false;
    let submitted = false;
    let errorMsg = '';
    let nombre = '';
    let numero = '';
    let website = ''; // honeypot
    let recaptchaComponent;

    onMount(() => {
        mounted = true;
    });

    function handleRecaptchaReady() {
        recaptchaReady = true;
    }

    async function handleSubmit(event) {
        event.preventDefault();
        errorMsg = '';

        if (!recaptchaReady || !recaptchaComponent) {
            errorMsg = 'Esperá un momento e intentá de nuevo.';
            return;
        }

        loading = true;
        try {
            const token = await recaptchaComponent.execute('llamenme');
            if (!token) {
                errorMsg = 'No se pudo verificar reCAPTCHA. Intentá de nuevo.';
                loading = false;
                return;
            }

            const formData = new FormData();
            formData.append('nombre', nombre);
            formData.append('numero', numero);
            formData.append('website', website);
            formData.append('g-recaptcha-response', token);

            const response = await fetch('/assets/send-llamenme.php', {
                method: 'POST',
                body: formData
            });
            const result = await response.json();

            if (result.success) {
                submitted = true;
            } else {
                errorMsg = 'No pudimos enviar tus datos. Intentá de nuevo.';
                loading = false;
            }
        } catch (error) {
            console.error('Error:', error);
            errorMsg = 'Ocurrió un error. Intentá de nuevo.';
            loading = false;
        }
    }
</script>

<div class="llamenme">
    {#if submitted}
        <div class="success">
            <p class="success-title">¡Listo!</p>
            <p class="success-text">Te llamamos a la brevedad.</p>
        </div>
    {:else}
        <form on:submit={handleSubmit}>
            <input name="nombre" type="text" placeholder="Nombre" bind:value={nombre} required>
            <input name="numero" type="tel" placeholder="Número de teléfono" bind:value={numero} required>

            <!-- honeypot: invisible para humanos, los bots lo completan -->
            <input
                class="hp"
                type="text"
                name="website"
                tabindex="-1"
                autocomplete="off"
                bind:value={website}
                aria-hidden="true"
            >

            {#if mounted}
                <Recaptcha bind:this={recaptchaComponent} on:ready={handleRecaptchaReady} />
            {/if}

            {#if errorMsg}
                <p class="error">{errorMsg}</p>
            {/if}

            <button type="submit" class="btn-primary btn-full" disabled={!recaptchaReady || loading}>
                {loading ? 'Enviando…' : 'Quiero que me llamen'}
            </button>
        </form>
    {/if}
</div>

<style>
    .llamenme {
        background: #fff;
        padding: 1.5em;
        border-radius: 0.8rem;
        box-shadow: 0 0.5em 1.5em rgba(0, 0, 0, 0.15);
        width: 100%;
        max-width: 22em;
        box-sizing: border-box;
    }
    form {
        display: flex;
        flex-direction: column;
        gap: 1em;
    }
    input {
        border: 1.5px solid #ddd;
        border-radius: 0.4em;
        font-size: 1em;
        width: 100%;
        font-family: 'nexa';
        height: 2.6em;
        padding: 0.2em 0.7em;
        box-sizing: border-box;
    }
    input:focus {
        outline: none;
        border-color: var(--violeta1);
    }
    .hp {
        position: absolute;
        left: -9999px;
        width: 1px;
        height: 1px;
        opacity: 0;
        pointer-events: none;
    }
    .error {
        color: var(--magenta);
        font-size: 0.9em;
        margin: 0;
    }
    button[disabled] {
        opacity: 0.5;
        cursor: not-allowed;
    }
    .success {
        text-align: center;
        padding: 1em 0;
    }
    .success-title {
        font-size: 1.4em;
        font-weight: 900;
        color: var(--violeta1);
        margin: 0 0 0.3em;
    }
    .success-text {
        margin: 0;
        color: #444;
    }
</style>
```

- [ ] **Step 2: Verificar que compila**

Run: `npm run build`
Expected: build termina sin errores (sale `✓ built in ...`). Ignorar warnings de a11y/deprecación preexistentes.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/home/LlamenmeForm.svelte
git commit -m "feat: componente LlamenmeForm (form quiero que me llamen)"
```

---

## Task 4: Integrar el form en el hero

**Files:**
- Modify: `src/lib/components/home/Hero.svelte`

- [ ] **Step 1: Importar el componente**

En el bloque `<script>` de `src/lib/components/home/Hero.svelte`, agregar el import junto a los otros (debajo de `import AnimatedLines ...`):

```js
    import LlamenmeForm from './LlamenmeForm.svelte';
```

- [ ] **Step 2: Envolver el texto + form en una columna flex**

Reemplazar el bloque actual (desde `<section class="hero-section">` hasta el cierre del `</div>` de `.text`):

```svelte
<section class="hero-section">
    <div class="text">
        {#if mounted}
            <img class="logo-sista" src="/images/Sista-logo-violeta.svg" alt="logo-sista" 
                 transition:fade={{ duration: 600, delay: 0 }}>
```

por una estructura con `.hero-content` que contenga `.text` y `.form-col`. El resultado de esa zona del markup debe quedar así (el contenido interno de `.text` no cambia):

```svelte
<section class="hero-section">
    <div class="hero-content">
        <div class="text">
            {#if mounted}
                <img class="logo-sista" src="/images/Sista-logo-violeta.svg" alt="logo-sista" 
                     transition:fade={{ duration: 600, delay: 0 }}>
                <h1 transition:fly={{ y: 30, duration: 700, delay: 200 }}>Internet por <br> Fibra Óptica</h1>
                <div class="wifi-tv" transition:fly={{ y: 30, duration: 700, delay: 400 }}>
                    <img class="icon-tv" src="/images/SVG/tv-green.svg" alt="icono-tv">
                    <img class="icon-wifi" src="/images/SVG/wifi-green.svg" alt="icono-wifi">
                    <p>WiFi + TV</p>
                </div>
                <div class="location-chips" transition:fly={{ y: 30, duration: 700, delay: 600 }}>
                    <span role="button" tabindex="0" onclick={handleChipClick} onkeydown={handleChipClick}>
                        <img class="location-icon" src="/images/icon-location-grey.svg" alt="Ubicación">
                        Punta Lara
                    </span>
                    <span role="button" tabindex="0" onclick={handleChipClick} onkeydown={handleChipClick}>
                        <img class="location-icon" src="/images/icon-location-grey.svg" alt="Ubicación">
                        Ensenada
                    </span>
                    <span role="button" tabindex="0" onclick={handleChipClick} onkeydown={handleChipClick}>
                        <img class="location-icon" src="/images/icon-location-grey.svg" alt="Ubicación">
                        Tolosa
                    </span>
                    <span role="button" tabindex="0" onclick={handleChipClick} onkeydown={handleChipClick}>
                        <img class="location-icon" src="/images/icon-location-grey.svg" alt="Ubicación">
                        El dique
                    </span>
                    <span role="button" tabindex="0" onclick={handleChipClick} onkeydown={handleChipClick}>
                        <img class="location-icon" src="/images/icon-location-grey.svg" alt="Ubicación">
                        Campamento
                    </span>
                    <span class="ver-todos" role="button" tabindex="0" onclick={handleChipClick} onkeydown={handleChipClick}>
                        + más
                    </span>
                </div>
            {/if}
        </div>
        {#if mounted}
            <div class="form-col" transition:fly={{ y: 30, duration: 700, delay: 800 }}>
                <LlamenmeForm />
            </div>
        {/if}
    </div>
    <div class="lines-wrapper">
        <div class="lines-cont">
            <AnimatedLines />
        </div>
    </div>

</section>
```

(Es decir: se agrega `<div class="hero-content">` envolviendo `.text`, se cierra `.text` antes de las líneas, y se inserta `.form-col` con el `<LlamenmeForm />` dentro de `.hero-content`.)

- [ ] **Step 3: Agregar estilos de layout**

En el `<style>` de `Hero.svelte`, agregar estas reglas nuevas (después de la regla `.hero-section { ... }`):

```css
    .hero-content {
        position: relative;
        z-index: 1;
        display: flex;
        flex-direction: column;
        gap: 2em;
    }
    .form-col {
        position: relative;
        z-index: 2;
        padding: 0 2em;
    }
```

Y dentro del media query existente `@media (min-width: 768px) { ... }`, agregar:

```css
        .hero-content {
            flex-direction: row;
            justify-content: space-between;
            align-items: center;
            padding-right: 4em;
        }
        .form-col {
            padding: 0;
            flex-shrink: 0;
        }
```

Y dentro del media query existente `@media (max-width: 768px) { ... }`, agregar (para que el hero crezca y no se pise con la sección siguiente en mobile):

```css
        .hero-section {
            height: auto;
            min-height: 100vh;
            padding-bottom: 2em;
        }
        .text {
            top: 2em;
        }
```

- [ ] **Step 4: Verificar build**

Run: `npm run build`
Expected: build sin errores.

- [ ] **Step 5: Revisar a ojo en dev (manual)**

Run: `npm run dev` y abrir la home. Confirmar:
- Desktop: el form aparece a la derecha del texto del hero.
- Mobile (devtools, ~390px): el form aparece debajo del texto, antes de las cards "Fibra Óptica / TV", sin pisarse.

(El preview MCP no funciona en este entorno; esta revisión es manual.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/home/Hero.svelte
git commit -m "feat: integrar LlamenmeForm en el hero (2 columnas desktop, apilado mobile)"
```

---

## Task 5: Viewer del admin `Llamenme.svelte`

**Files:**
- Create: `src/routes/admin/_components/mantenimiento/Dashboard/llamenme/Llamenme.svelte`

- [ ] **Step 1: Crear el viewer**

`src/routes/admin/_components/mantenimiento/Dashboard/llamenme/Llamenme.svelte`:

```svelte
<script>
import { pb } from '$lib/pocketbase';
import { onMount } from 'svelte';
import Spinner from '$lib/components/ui/Spinner.svelte';

let leads = $state([]);
let loading = $state(true);
let error = $state('');

onMount(load);

async function load() {
    loading = true;
    error = '';
    try {
        const res = await pb.collection('quiero_que_me_llamen').getList(1, 200, { sort: '-created' });
        leads = res.items;
    } catch (e) {
        console.error(e);
        error = 'No se pudieron cargar los datos.';
    } finally {
        loading = false;
    }
}

function formatDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('es-AR', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
    });
}
</script>

<div class="llamenme-admin">
    <div class="header">
        <h2>Quiero que me llamen</h2>
        <div class="actions">
            <span class="count">{leads.length} solicitud{leads.length === 1 ? '' : 'es'}</span>
            <button class="refresh" onclick={load} disabled={loading}>Refrescar</button>
        </div>
    </div>

    {#if loading}
        <div class="state"><Spinner size={40} color="var(--violeta1)" borderWidth={3} label="Cargando…" /></div>
    {:else if error}
        <div class="state error">{error}</div>
    {:else if leads.length === 0}
        <div class="state">Todavía no hay solicitudes.</div>
    {:else}
        <div class="table-wrap">
            <table>
                <thead>
                    <tr><th>Nombre</th><th>Número</th><th>Fecha</th></tr>
                </thead>
                <tbody>
                    {#each leads as l}
                        <tr>
                            <td>{l.nombre}</td>
                            <td>{l.numero}</td>
                            <td class="date">{formatDate(l.created)}</td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    {/if}
</div>

<style>
.llamenme-admin {
    max-width: 60em;
    margin: 0 auto;
}
.header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1em;
    margin-bottom: 1.5em;
}
.header h2 {
    margin: 0;
    color: var(--violeta1);
    font-size: 1.6em;
}
.actions {
    display: flex;
    align-items: center;
    gap: 1em;
}
.count {
    color: #666;
    font-size: 0.95em;
}
.refresh {
    background: var(--violeta1);
    color: #fff;
    border: none;
    border-radius: 0.4em;
    padding: 0.5em 1em;
    cursor: pointer;
    font-size: 0.9em;
}
.refresh:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
.state {
    padding: 3em 1em;
    text-align: center;
    color: #888;
}
.state.error {
    color: var(--magenta);
}
.table-wrap {
    overflow-x: auto;
    background: #fff;
    border-radius: 0.6em;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}
table {
    width: 100%;
    border-collapse: collapse;
}
th, td {
    text-align: left;
    padding: 0.8em 1em;
    border-bottom: 1px solid #eee;
}
th {
    background: #f7f6fb;
    color: var(--violeta1);
    font-weight: 600;
    font-size: 0.9em;
}
td.date {
    color: #666;
    white-space: nowrap;
}
</style>
```

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: build sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/routes/admin/_components/mantenimiento/Dashboard/llamenme/Llamenme.svelte
git commit -m "feat: viewer admin de leads quiero_que_me_llamen"
```

---

## Task 6: Registrar la pestaña en el admin

**Files:**
- Modify: `src/routes/admin/_components/mantenimiento/Dashboard/Sidebar.svelte`
- Modify: `src/routes/admin/_components/mantenimiento/Dashboard/Content.svelte`

- [ ] **Step 1: Agregar el ítem al menú**

En `Sidebar.svelte`, dentro del array `mainItems`, agregar como último elemento (después del objeto de `Técnicos`):

```js
    ,{
        title: 'Quiero que me llamen',
        content: 'llamenme',
        icon: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>'
    }
```

(Nota: el array ya existente termina en el objeto de Técnicos sin coma final; agregar la coma inicial mostrada arriba o, si se prefiere, poner la coma tras el `}` de Técnicos y pegar el objeto sin la coma inicial. El resultado debe ser un array válido de 5 objetos.)

- [ ] **Step 2: Rutear el viewer en Content**

En `Content.svelte`, agregar el import junto a los otros (después de `import TolosanoCodigos ...`):

```js
import Llamenme from "./llamenme/Llamenme.svelte";
```

Y dentro del bloque `{#if selected}`, agregar una rama nueva (por ejemplo después de la rama de `tecnicos`):

```svelte
        {:else if selected === 'llamenme'}
            <Llamenme></Llamenme>
```

- [ ] **Step 3: Verificar build**

Run: `npm run build`
Expected: build sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/routes/admin/_components/mantenimiento/Dashboard/Sidebar.svelte src/routes/admin/_components/mantenimiento/Dashboard/Content.svelte
git commit -m "feat: pestaña 'Quiero que me llamen' en el sidebar/content del admin"
```

---

## Task 7: Verificación end-to-end (manual, post-deploy)

**Files:** ninguno (verificación)

- [ ] **Step 1: Confirmar reglas de pb (responsabilidad del usuario)**

En PocketBase, colección `quiero_que_me_llamen`:
- `createRule`: público (ya configurado).
- `listRule` / `viewRule`: deben permitir auth de `users` (`@request.auth.id != ""`) para que el admin pueda listar. Confirmar/ajustar.

- [ ] **Step 2: Probar el flujo real en el sitio deployado**

- Cargar la home, completar Nombre + Número en el form del hero, enviar.
- Verificar que aparece la confirmación inline "¡Listo! Te llamamos a la brevedad."
- En PocketBase, confirmar que se creó el registro en `quiero_que_me_llamen`.
- Confirmar que llegó el email a `agustin@sista.ar`.

- [ ] **Step 3: Probar el admin**

- Entrar a `/admin`, loguear, abrir la pestaña "Quiero que me llamen".
- Confirmar que el lead recién creado aparece en la tabla con nombre, número y fecha.

- [ ] **Step 4: Finalizar la rama**

Usar la skill `superpowers:finishing-a-development-branch` para decidir merge/PR.

---

## Self-Review (completado por el autor del plan)

- **Cobertura del spec:** form en hero (Task 3+4), envío seguro PHP+reCAPTCHA (Task 1+2), honeypot (Task 2+3), write a pb (Task 2), email a agustin@sista.ar (Task 2), confirmación inline (Task 3), layout desktop/mobile (Task 4), pestaña admin con número sin link (Task 5+6), supuestos de reglas pb (Task 7). ✔
- **Placeholders:** ninguno; todo el código está completo. ✔
- **Consistencia de nombres:** `verify_recaptcha` (Task 1) se usa igual en Task 2; campos `nombre`/`numero` consistentes entre PHP, form y viewer; `selected === 'llamenme'` y `content: 'llamenme'` coinciden entre Sidebar y Content. ✔
