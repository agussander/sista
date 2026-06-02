# Informe de revisión de seguridad — Sitio Sista

**Fecha:** 4 de marzo de 2025  
**Alcance:** Código fuente del proyecto (SvelteKit, PHP, PocketBase, formularios y administración).

---

## Resumen ejecutivo

Se identificaron **vulnerabilidades críticas y altas** por credenciales y secretos expuestos en el repositorio y en el código cliente, protección insuficiente del panel de administración, y configuración insegura en correo y APIs. Se recomienda priorizar la rotación de todas las credenciales expuestas y la aplicación de las mejoras indicadas.

---

## 1. Credenciales y secretos expuestos

### 1.1 Crítico — Credenciales de API IspCube en frontend

**Ubicación:** `src/routes/solicitudbaja2&np9277zhw/_components/Paso1.svelte`

En el código cliente (visible en el navegador) aparecen:

- **api-key:** `9d248fca-8cc3-48b3-94cd-d8b22cfeab6b`
- **client-id:** `734`
- **username:** `api_web`
- **password:** `oXzNeXt$FV2xmTtXrkNQJeF1`

Cualquier usuario que abra la consola o inspeccione el JS puede obtener estas credenciales y usarlas contra `https://sista.ispcube.online/api/sanctum/token` y el resto de la API.

**Acción:** Mover todo el flujo de login y llamadas a IspCube al backend (por ejemplo endpoints SvelteKit o PHP que no expongan estas credenciales). El frontend solo debe enviar DNI/datos de usuario; el servidor debe autenticarse con IspCube y devolver solo lo necesario.

---

### 1.2 Crítico — Contraseña SMTP en repositorio

**Ubicación:** `static/assets/includes/MailHandler.php`

- **Usuario SMTP:** `contactoweb@sista.com.ar`
- **Contraseña:** `4sT9x65!o`
- **Host:** `mail.sista.ar`, puerto 587

La contraseña queda en texto plano en un archivo que se sirve/copia en el despliegue. Si el repo es público o se filtra, el correo queda comprometido.

**Acción:** Usar variables de entorno en el servidor (por ejemplo `getenv('SMTP_PASSWORD')`) y no commitear nunca la contraseña. Añadir `static/assets/includes/` o un archivo de config que cargue secretos a `.gitignore` si ahí se definieran, y rotar la contraseña SMTP tras el cambio.

---

### 1.3 Crítico — Secret key de reCAPTCHA en código

**Ubicación:** `static/assets/includes/form-handler.php`

- **Clave secreta reCAPTCHA v3:** `6Lf2xAIsAAAAAOQrW5Ssxznu6_3MbbL2plAAQ3es`

La secret key no debe estar en el frontend ni en archivos que se versionen; en este caso está en PHP que se despliega. Si el repo es accesible, un atacante puede validar tokens de captcha desde sus propios scripts.

**Acción:** Pasar la secret key por variable de entorno (por ejemplo `RECAPTCHA_SECRET_KEY`) y cargarla en el PHP en tiempo de ejecución. Rotar la clave en la consola de Google reCAPTCHA después del cambio.

---

### 1.4 Alto — Credenciales IspCube repetidas en PHP

**Ubicaciones:**

- `static/assets/send-ticket-ispcube.php` (usuario, contraseña, api-key, client-id)
- `static/assets/client-handler.php` (usuario, contraseña, reCAPTCHA Enterprise key en URL)

Mismas credenciales que en 1.1, pero en servidor. El riesgo principal es que estén en el repositorio y que no se roten al cambiar una sola parte.

**Acción:** Centralizar en un único archivo de configuración (o env) que no se suba al repo. Usar variables de entorno para usuario, contraseña, api-key y client-id. Revisar si la clave de reCAPTCHA Enterprise en `client-handler.php` es una API key secreta; si es así, también por env.

---

### 1.5 Medio — Clave reCAPTCHA (sitio) y debug en frontend

**Ubicación:** `src/routes/solicitudbaja2&np9277zhw/_components/Paso1.svelte`

- **RECAPTCHA_SITE_KEY:** `6LdBk_YmAAAAAJAM7B2-HXaobQq3lyQt6u5hNDGa` (la clave de sitio es pública por diseño, pero conviene no mezclarla con secretos).
- **recaptchaDebugMode:** fijado a `true`, lo que deja logging de depuración activo en producción.

**Acción:** Poner la site key en `import.meta.env.VITE_RECAPTCHA_SITE_KEY` (o similar) para no hardcodear. Desactivar debug en producción (por ejemplo `recaptchaDebugMode = import.meta.env.DEV` o variable de entorno).

---

## 2. Autenticación y panel de administración

### 2.1 Alto — Protección del admin solo en cliente

**Ubicaciones:** `src/routes/admin/+page.svelte`, `src/routes/admin/_components/adminStore.js`

El acceso al panel se controla con:

- `{#if !$token || !$record}` para mostrar Login o Dashboard.
- Token y record guardados en store persistido (por defecto `localStorage` con `svelte-persisted-store`).

No existe `+layout.server.js` ni comprobación en servidor. Cualquier persona puede:

- Llamar directamente a la API de PocketBase si conoce la URL y las colecciones.
- Intentar inyectar un token falso en `localStorage` (según cómo esté configurado PocketBase, podría rechazarlo, pero la lógica de “quién es admin” no se valida en servidor).

**Acción:** Añadir un `+layout.server.js` en `src/routes/admin/` que compruebe sesión (cookie segura o token validado contra backend). Si la app es estática (adapter-static), las rutas bajo `/admin` deberían estar protegidas por un backend o un proxy que exija autenticación antes de servir el HTML/API. Alternativa: usar SvelteKit con adapter que permita `load` en servidor y validar ahí antes de devolver datos sensibles.

---

### 2.2 Medio — Token de admin en localStorage

**Ubicación:** `src/routes/admin/_components/adminStore.js`

Uso de `persisted('sista_auth_token', null)` (y equivalente para el record). Si el dominio es vulnerable a XSS, el token puede ser robado desde `localStorage`.

**Acción:** Valorar cookies `HttpOnly` + `Secure` + `SameSite` para la sesión de admin, manejadas por el servidor, de forma que el JS del cliente no pueda leer el token. Si se mantiene el token en cliente, al menos asegurar que no haya XSS (ver sección 4) y considerar corta expiración y renovación.

---

## 3. Configuración y datos sensibles

### 3.1 Alto — URL de PocketBase hardcodeada

**Ubicaciones:** Múltiples archivos en `src/` (Dashboard, Login, Tecnicos, Trabajos, precios, tolosano, encuestas, etc.)

En todos aparece:

```js
const pb = new PocketBase('https://sista.pockethost.io');
```

Si en el futuro se usan claves o entornos distintos, hay que tocar muchos archivos y el backend queda expuesto de forma fija.

**Acción:** Definir la base URL en una sola fuente, por ejemplo `import.meta.env.VITE_POCKETBASE_URL` (o variable de entorno en build), y usarla desde un módulo `src/lib/pocketbase.js` que exporte la instancia `pb`. En producción usar env del sistema/build, no valores por defecto sensibles.

---

### 3.2 Medio — IDs de registro PocketBase fijos

**Ubicaciones:**

- `src/routes/admin/_components/mantenimiento/Dashboard/tecnicos/Tecnicos.svelte`
- `src/routes/tecnicos/+page.svelte`

Se usa el ID `o7950s83wc0ny2u` para la colección `otros` (poliza/certificado ART). Si alguien descubre la URL de PocketBase y las reglas permiten lectura por ID, podría acceder a ese recurso sin pasar por la lógica de negocio.

**Acción:** Asegurar en PocketBase que la colección `otros` (y cualquier otra con datos sensibles) solo sea accesible con reglas que exijan autenticación y, si aplica, rol de admin. No confiar en “ocultar” el ID; la protección debe estar en el backend (PocketBase).

---

### 3.3 Bajo — Ruta con parámetro en la URL

**Ubicación:** Carpeta `src/routes/solicitudbaja2&np9277zhw/`

El segmento `&np9277zhw` parece un token de ofuscación para “proteger” el formulario de baja. Depender de la URL como único secreto es frágil (enlaces compartidos, logs, referrers).

**Acción:** No considerar esta ruta como control de acceso. Si el formulario debe ser restringido, usar autenticación real (por ejemplo solo usuarios logueados o un token de un solo uso validado en servidor).

---

## 4. Seguridad de formularios y backend PHP

### 4.1 Configuración SMTP insegura

**Ubicación:** `static/assets/includes/MailHandler.php`

```php
$this->mailer->SMTPOptions = [
    'ssl' => [
        'verify_peer' => false,
        'verify_peer_name' => false,
        'allow_self_signed' => true
    ]
];
```

Desactivar la verificación SSL permite ataques man-in-the-middle y pierde la confianza en el certificado del servidor de correo.

**Acción:** Eliminar esta configuración o usar `verify_peer => true` y `verify_peer_name => true` en producción. Si el servidor usa un certificado autofirmado, configurarlo correctamente en el servidor en lugar de desactivar la verificación de forma global.

---

### 4.2 CORS permisivo en PHP

**Ubicación:** `static/assets/send-ticket-ispcube.php`

```php
header('Access-Control-Allow-Origin: *');
```

Permite que cualquier origen envíe peticiones a este script. Si el endpoint devuelve datos sensibles o permite acciones privilegiadas, aumenta el riesgo de abuso desde otros sitios.

**Acción:** Restringir el origen al dominio del sitio (por ejemplo `https://sista.com.ar` o el dominio que corresponda). Evitar `*` en producción.

---

### 4.3 Formularios y validación

Los formularios que envían a `/assets/send-form-*.php` y similares usan reCAPTCHA (v3 o Enterprise) y en `form-handler.php` se valida el score. Eso está bien. Asegurar que:

- En el servidor se validan y sanitizan todos los campos (longitud, tipo, formato).
- No se confía solo en validación en cliente para datos críticos.
- Los archivos PHP no exponen mensajes de error detallados al usuario (ya se usa `display_errors = 0`; mantener `log_errors = 1`).

---

## 5. PocketBase y lógica de negocio

### 5.1 Tolosano — Códigos WiFi

**Ubicación:** `src/routes/tolosano/+page.svelte`

Flujo actual:

1. El usuario envía nombre, mail y teléfono.
2. Se crea un registro en `tolosano_data` (create público si las reglas lo permiten).
3. Se obtiene el primer código con `used = false` y se marca como `used = true`.

Si las reglas de PocketBase permiten a cualquiera:

- Listar o filtrar `tolosano` y actualizar registros, un atacante podría marcar todos como usados o consumir códigos en masa.
- Crear en `tolosano_data` sin límite, podría llenar la base o abusar del almacenamiento.

**Acción:** Revisar en el panel de PocketBase las reglas de las colecciones `tolosano` y `tolosano_data`. Para `tolosano`, solo el backend (o un usuario autenticado de admin) debería poder leer y actualizar `used`. Para `tolosano_data`, restringir create a lo necesario (por ejemplo límite por IP o por sesión si se implementa). Idealmente, la asignación y el marcado de códigos debería hacerse desde un endpoint de servidor (SvelteKit o PHP) que valide captcha y límites antes de llamar a PocketBase.

---

### 5.2 Encuestas y trabajos

**Ubicaciones:** `src/routes/encuestadecalidad/`, `src/routes/trabajaconnosotros/_components/send.js`, etc.

Se hace `pb.collection(...).create(...)` desde el cliente. Si las reglas de PocketBase permiten create sin autenticación, está bien para formularios públicos, pero hay que asegurar:

- Límites de tasa (rate limiting) en PocketBase o en un proxy para evitar spam.
- Que las colecciones no permitan update/delete anónimo ni listado público de datos personales.

---

## 6. Headers de seguridad y buenas prácticas

- No se encontraron cabeceras como **Content-Security-Policy**, **X-Frame-Options**, **X-Content-Type-Options** en el código del proyecto. Dependen del servidor (hosting/proxy).
- El proyecto usa **adapter-static**: no hay `+server.js` ni `+layout.server.js` en las rutas revisadas, por lo que no hay capa SvelteKit en servidor para añadir headers desde la app.

**Acción:** Configurar en el servidor web o CDN (Nginx, Apache, Cloudflare, Vercel, etc.) al menos:

- **Content-Security-Policy** restrictiva (evitar `unsafe-inline` donde no haga falta).
- **X-Frame-Options: DENY** o **SAMEORIGIN**.
- **X-Content-Type-Options: nosniff**.
- **Referrer-Policy** (por ejemplo `strict-origin-when-cross-origin`).

---

## 7. Dependencias

**Ubicación:** `package.json`

No se ha ejecutado un escáner de vulnerabilidades (npm audit / Snyk). Se recomienda hacerlo de forma periódica.

**Acción:** Ejecutar `npm audit` y corregir vulnerabilidades críticas/altas. Considerar `npm audit fix` y actualizar dependencias con parches de seguridad.

---

## 8. Checklist de prioridades

| Prioridad | Acción |
|-----------|--------|
| **Inmediata** | Rotar todas las credenciales expuestas (IspCube, SMTP, reCAPTCHA) tras moverlas a variables de entorno. |
| **Inmediata** | Mover credenciales de IspCube fuera del frontend: usar solo backend (PHP o futuro API) para login y llamadas a la API. |
| **Inmediata** | Quitar contraseña y secret key de reCAPTCHA del código; usar env en PHP. |
| **Alta** | Proteger la ruta `/admin` en servidor (layout server o proxy) y no depender solo de `localStorage` + condición en cliente. |
| **Alta** | Centralizar URL de PocketBase en env y un único módulo. Revisar reglas de colecciones (otros, tolosano, tolosano_data, trabajos, encuestas). |
| **Media** | Eliminar `verify_peer = false` en MailHandler; restringir CORS en send-ticket-ispcube.php. |
| **Media** | Desactivar recaptchaDebugMode en producción; configurar CSP y headers de seguridad en el servidor. |
| **Baja** | Revisar IDs fijos de PocketBase y uso de la ruta “secreta” del formulario de baja. |

---

## 9. Archivos sensibles a no versionar (recomendación)

Si se introduce un archivo de configuración local que cargue secretos desde env, asegurarse de que esté en `.gitignore`. Actualmente `.gitignore` incluye `.env` y `.env.*`, lo cual es correcto. Los archivos PHP en `static/assets/` **sí** están versionados; por tanto las credenciales no deben seguir en ellos, sino leerse de variables de entorno en el entorno de despliegue.

---

*Este informe se basa en una revisión estática del código. No sustituye una auditoría de penetración ni un análisis de la configuración real del servidor y de PocketBase en producción.*
