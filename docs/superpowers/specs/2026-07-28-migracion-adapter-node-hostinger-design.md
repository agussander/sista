# Migración a adapter-node en Hostinger

**Fecha:** 2026-07-28
**Estado:** Diseño aprobado, pendiente de plan de implementación

## Problema

El sitio es SvelteKit estático (`adapter-static`, `prerender = true` en `src/routes/+layout.js`) desplegado por FTP a `sista.com.ar` y `httpdocs`. Los formularios no son estáticos: dependen de **8 endpoints PHP** en `static/assets/`, que leen SMTP, reCAPTCHA y credenciales de IspCube desde `.env` vía `includes/load_env.php`.

Se quiere pasar a Node (`adapter-node`) para:

1. Unificar el backend y sacar los secrets de archivos PHP que viven dentro de `static/`.
2. Habilitar contenido dinámico desde PocketBase sin rebuild.
3. Resolver en producción los proxies `/lineavip` e `/internacional`, que hoy solo existen en dev.
4. Tener lugar para lógica de servidor a futuro.

Restricción dura: **no romper el deploy actual**. Producción tiene que seguir funcionando y ser recuperable en cualquier momento.

### El riesgo central

Si un proceso Node sirve el dominio, Apache y PHP dejan de intervenir. Los `.php` quedarían dentro de `static/` y SvelteKit los serviría **como texto plano**: se publicaría el código de los handlers, y los formularios dejarían de funcionar. Esto condiciona toda la migración.

## Contexto de hosting

- Plan **Business** de Hostinger. Node.js disponible en hPanel (Business y Cloud; Premium no alcanza).
- En hPanel las **Web Apps son entidades separadas de los Websites** (Business: 5 web apps + 50 websites). La app Node y el sitio PHP actual conviven en el mismo plan, cada uno en su dominio.
- Deploy desde GitHub con build automático en cada push.
- Node 18.x–24.x soportado.
- Durante la migración se usa un **subdominio temporal de Hostinger** (`*.hostingersite.com`).

## Enfoque elegido

**Migración por fases sobre un subdominio, con build dual desde un solo repo.**

Producción (`sista.com.ar`, estático + PHP por FTP) queda intacta durante todas las fases. El rollback en cualquier punto es apuntar el dominio de vuelta.

Alternativas descartadas:

- **Big bang** (migrar todo y mover el dominio de una): los formularios manejan bajas, contacto y postulaciones. Un SMTP mal configurado falla en silencio; nadie se entera hasta que un cliente reclama.
- **Híbrido permanente** (Node para el sitio, PHP en `forms.sista.ar` con CORS): menos trabajo inicial, pero deja dos runtimes, dos deploys, CORS que mantener, y los secrets donde están. Contradice el objetivo de seguridad.

---

## Fase 0 — El mismo sitio, servido por Node

Sin lógica nueva. El objetivo es que el sitio renderice igual, no filtre nada y no se indexe.

### Build dual

`svelte.config.js` elige adapter por variable de entorno:

```js
adapter: process.env.ADAPTER === 'node'
    ? adapterNode({ out: 'build-node' })
    : adapterStatic()
```

`out: 'build-node'` es obligatorio, no cosmético: **ambos adapters escriben en `build/` por defecto**. Sin eso, un build Node pisa el `build/` estático que usa `deploy.sh`, y el siguiente `./deploy.sh --no-build` sube una app Node por FTP a producción.

- Se agrega `@sveltejs/adapter-node` a devDependencies.
- Se agrega `build-node/` a `.gitignore`.
- `deploy.sh` y el flujo FTP **no se tocan**.

Comandos resultantes:

```bash
npm run build              # → build/       estático, deploy actual
ADAPTER=node npm run build # → build-node/  app Node
```

### `prerender` se mantiene

`prerender = true` sigue vigente con adapter-node: las páginas se pregeneran y el server las sirve. Se sacan rutas del prerender de a una, recién cuando se necesiten dinámicas (Fase 3). `trailingSlash: 'always'` se preserva.

### Exclusión de los PHP

Script `scripts/prepare-node-build.js`, post-build, que **borra `assets/**/*.php` de `build-node/client/`**.

Es un script y no una reestructuración de `static/` a propósito: no toca el flujo estático, y en Fase 1 los PHP quedan obsoletos y el script se elimina.

**Consecuencia aceptada:** en Fase 0 los formularios del subdominio no funcionan. Es el comportamiento correcto para una beta; se resuelven en Fase 1.

### Bloqueo de indexación

`robots.txt` hoy dice `Allow: /`. El subdominio serviría contenido idéntico a `sista.com.ar`: riesgo de contenido duplicado y de que un `hostingersite.com` compita con el dominio real.

Dos capas, porque `robots.txt` solo evita el crawl — una URL enlazada puede indexarse igual:

1. El mismo script escribe `robots.txt` con `Disallow: /` cuando `SITE_ENV !== 'production'`.
2. `src/hooks.server.js` agrega `X-Robots-Tag: noindex, nofollow` bajo la misma condición. Esta es la capa que realmente garantiza no indexación.

### `.htaccess` deja de aplicar

`static/.htaccess` es Apache puro. En la app Node no rige:

- `ErrorDocument 404` → lo cubre `src/routes/+error.svelte` nativamente.
- Bloqueo de `.env` por HTTP → deja de existir como red de contención. Mitigado porque los secrets pasan a variables de entorno de hPanel y no a archivos servibles.

### Configuración en hPanel

- Web App desde GitHub. Build: `ADAPTER=node npm run build`. Start: `node build-node/index.js`.
- Node 20. Se agrega `engines` a `package.json` (`.npmrc` tiene `engine-strict=true`).
- `SITE_ENV=beta`. Los secrets no hacen falta todavía.

Las tres variables `VITE_` (`VITE_POCKETBASE_URL`, `VITE_RECAPTCHA_SITE_KEY`, `VITE_RECAPTCHA_SITE_KEY_BAJA`) tienen fallback hardcodeado en el código, así que un build sin configurarlas igual levanta. Conviene setearlas igual para no depender del fallback.

### Criterios de aceptación

- El sitio renderiza igual que producción: home, precios, elegirplan, dgo, tv.
- `curl -I` sobre el subdominio devuelve `X-Robots-Tag: noindex`.
- `/assets/send-llamenme.php` devuelve **404, no el código fuente**.
- PocketBase responde: precios y grillas cargan.
- Una ruta inexistente muestra `+error.svelte`, no un error crudo de Node.
- `npm run build && ls build/` sigue produciendo el estático de siempre, intacto.

---

## Fase 1 — Los PHP pasan a endpoints Node

### Estructura

Tres módulos en `src/lib/server/` (SvelteKit garantiza que no lleguen al cliente), que replican los tres includes actuales:

| Módulo Node | Reemplaza a | Responsabilidad |
|---|---|---|
| `recaptcha.js` | `includes/recaptcha-verify.php` | `verifyRecaptcha(token, ip)` → `{ok, reason, score}`. Mismo umbral 0.5. |
| `mailer.js` | `includes/MailHandler.php` | nodemailer sobre el mismo SMTP. Renderiza el `correo_template.html` existente (placeholders `[data]` y `[title]`). |
| `formHandler.js` | `includes/form-handler.php` | Honeypot → reCAPTCHA → validación de campos → mail. Misma config: `subject`, `fields`, `optional_fields`, `custom_recipient`, `reply_to`. |

Más 8 `+server.js` finos en `src/routes/api/`, cada uno aportando solo su config. Se agrega `nodemailer` como dependencia; PHPMailer no se porta.

### El contrato JSON no cambia

Los componentes ramifican sobre `{success, message}` con `message` ∈ `recaptcha` / `incompleto` / `spam` / `pb` / `error`. Los endpoints Node devuelven exactamente lo mismo, así que la lógica de UI de los 8 formularios no se modifica.

### Resolución de URLs (preserva el build dual)

Cambiar los `fetch` de `/assets/send-llamenme.php` a `/api/llamenme` dejaría al **build estático sin formularios**: apuntaría a rutas que no existen en `sista.com.ar`, y se perdería el rollback.

Módulo `src/lib/formEndpoints.js` que resuelve según el target de build:

```js
export const LLAMENME = import.meta.env.VITE_FORMS_BACKEND === 'node'
    ? '/api/llamenme'
    : '/assets/send-llamenme.php';
```

Los 8 call sites importan de ahí. El build Node se hace con `VITE_FORMS_BACKEND=node`; el estático sin esa variable sigue hablando PHP. Mismo código fuente.

### Endpoints a portar

| Endpoint PHP | Call site actual |
|---|---|
| `send-llamenme.php` | `src/lib/components/home/LlamenmeForm.svelte:71` |
| `send-form-contacto.php` | `src/lib/components/forms/Form1.svelte:46` |
| `send-form-empresas.php` | `src/lib/components/forms/Form2.svelte:46` |
| `send-form-modal.php` | `src/lib/components/layout/Modal.svelte:48` |
| `send-form-baja2.php` | `src/routes/solicitudbaja/+page.svelte:50` |
| `send-ticket-ispcube.php` | `src/routes/solicitudbaja2&np9277zhw/_components/Paso4.svelte:47` |
| `send-email-baja.php` | `src/routes/solicitudbaja2&np9277zhw/_components/Paso4.svelte:103` |
| `form-trabajo.php` | `src/routes/trabajaconnosotros2/+page.svelte:40` |

### Casos especiales

- **`send-llamenme`** no es solo mail: escribe en la colección `quiero_que_me_llamen` de PocketBase y **eso es la fuente de verdad**; el mail es best-effort. Si PocketBase falla → `message: 'pb'`. Si falla el mail → devuelve éxito igual. Ese orden se respeta tal cual.
- **`form-trabajo`** es el único que no usa `fetch`: es un `<form action>` nativo con `multipart/form-data`, adjunto de CV, y navegación a `gracias` o `error-form`. Va como form action de SvelteKit, no como endpoint JSON. Se deja para el final de la fase por ser el más distinto.
- **`send-ticket-ispcube`** pega contra la API de IspCube y necesita sus credenciales. **No mandar tickets de prueba a producción** al verificar.

### Secrets

`SMTP_PASSWORD`, `RECAPTCHA_SECRET_KEY`, `ISPCUBE_API_URL`, `ISPCUBE_USERNAME`, `ISPCUBE_PASSWORD`, `ISPCUBE_API_KEY` y `ISPCUBE_CLIENT_ID` pasan a Environment Variables de hPanel, leídas con `$env/dynamic/private`. Nunca en el repo, nunca en `static/`. Este es el grueso de la mejora de seguridad.

### Dependencia externa

Las site keys de reCAPTCHA están registradas para los dominios de Sista. **Hay que agregar el subdominio temporal en la consola de Google** o todo devuelve `message: 'recaptcha'` y parece un bug del código.

### Criterios de aceptación

- Los 8 formularios envían correctamente desde el subdominio.
- El mail llega con el mismo formato que produce `correo_template.html` hoy.
- `send-llamenme` deja el registro en `quiero_que_me_llamen`.
- Honeypot lleno → `message: 'spam'`, sin mail.
- Campo requerido vacío → `message: 'incompleto'` con el `field` correcto.
- Ningún secret aparece en el bundle del cliente ni en el repo.
- El build estático sigue apuntando a los `.php` y sus formularios siguen funcionando en producción.

---

## Fase 2 — Proxies de telefonía

`src/lib/telefonia/fetchLineaVip.js:7` y `fetchInternacional.js:8` piden `/lineavip/` y `/internacional/` al mismo origen. En `vite.config.js` están proxeados a `sista.com.ar` **solo en dev**. En el subdominio Node esas rutas darían 404.

Dos `+server.js` que proxean hacia `sista.com.ar`, replicando en producción lo que hoy solo existe en dev.

- Se preserva el `arrayBuffer` **crudo**: `decodeLineaVipHtml` decodifica el charset a mano. Si el proxy devuelve texto ya decodificado, se rompen los acentos.
- Cache de **5 minutos** (`Cache-Control: public, max-age=300`) para no pegarle a `sista.com.ar` en cada visita. Los precios de telefonía cambian con muy baja frecuencia; si hiciera falta refrescar antes, se reinicia la app.

### Criterios de aceptación

- Las tablas de Línea VIP e Internacional cargan en el subdominio.
- Los acentos se ven correctamente (verifica que el manejo de charset sobrevivió).

---

## Fuera de alcance

- **Fase 3 — Contenido dinámico desde PocketBase.** Depende de qué se quiere dinámico y del estado de las colecciones. Merece su propia ronda de diseño una vez que Fases 0-2 estén andando.
- **Fase 4 — Cutover del dominio.** Es configuración de hPanel más que código.
- **Auth server-side del `/admin`.** El panel autentica contra PocketBase enteramente en el cliente (`src/routes/admin/+page.svelte:11`). Pasar a Node **no lo asegura por sí solo**: quien protege los datos son las reglas de colección de PocketBase, antes y después. Node habilita hacerlo bien, pero es un proyecto aparte.
- Cualquier refactor no relacionado con la migración.

## Decisiones registradas

| Decisión | Razón |
|---|---|
| Build dual por env var en vez de branch o repo aparte | Un solo código fuente; el rollback es un comando, no un merge. |
| `out: 'build-node'` | Evita que el build Node pise el `build/` que consume `deploy.sh`. |
| Script de prune en vez de mover `static/assets/*.php` | No toca el flujo estático; los PHP se eliminan igual en Fase 1. |
| `formEndpoints.js` en vez de cambiar los `fetch` directamente | Sin esto el build estático se queda sin formularios y se pierde el rollback. |
| Mantener el contrato `{success, message}` | Evita tocar la lógica de UI de los 8 formularios. |
| `X-Robots-Tag` además de `robots.txt` | `robots.txt` evita el crawl, no la indexación de URLs enlazadas. |
