# Deploy

El sitio corre en **Hostinger como app Node** (SvelteKit + `adapter-node`) y se
despliega solo: **cada push a `main` dispara el build**. No hay que correr nada a
mano.

El deploy viejo por FTP (`deploy.sh`) quedó solo para el **sitio legacy** de
sista.com.ar, que se actualiza a mano y cada vez menos. Está al final de este
documento.

---

## 1. Deploy normal

```bash
git push origin main
```

Eso es todo. Hostinger detecta el push, corre `npm run build` y reinicia la app.
Tarda ~1:30.

### Verificar que salió bien

```bash
curl -sI https://ghostwhite-okapi-714606.hostingersite.com/ | head -1
```

Esperado: `HTTP/2 200`. Si da **503**, el proceso Node no arrancó — ver
[Cuando algo falla](#3-cuando-algo-falla).

### Ver el estado del build

```bash
curl -s "https://developers.hostinger.com/api/hosting/v1/accounts/u784612252/websites/ghostwhite-okapi-714606.hostingersite.com/nodejs/builds?per_page=3" -H "Authorization: Bearer $HOSTINGER_API_TOKEN"
```

Estados: `pending` → `running` → `completed` / `failed`.

---

## 2. Por qué el build se llama `build` y sale a `build/`

**No tocar los nombres.** Suena a detalle cosmético y no lo es.

Hostinger **no persiste la configuración de build en ningún lado**: no existe
endpoint para leerla ni fijarla (`/nodejs`, `/nodejs/settings`, `/nodejs/config`
y variantes dan 404), y cada build lleva su config en el body del request. Así
que cuando llega un push, Hostinger **autodetecta** el proyecto, y para un
SvelteKit siempre asume la convención:

```
npm run build   →   build/   →   server.js adentro
```

Mientras el repo se salía de esa convención (el build Node vivía en `build-node/`
bajo el script `build:node`), el build automático de cada push generaba el
**estático**, no encontraba `build/server.js` y el sitio quedaba en **503** hasta
relanzarlo a mano por API. Pasó exactamente así el 31/07/2026.

Por eso hoy:

| Comando | Salida | Para qué |
|---|---|---|
| `npm run build` | `build/` (app Node, con `server.js`) | **el deploy real** |
| `npm run build:static` | `build-static/` | sitio legacy por FTP |

El `server.js` que corre en producción **no** es el de la raíz del repo: lo emite
`scripts/prepare-node-build.js` *adentro* de `build/`, porque Hostinger resuelve
el `entry_file` relativo al output directory. El de la raíz es solo para correr
local. Ver los comentarios en [svelte.config.js](svelte.config.js).

### Correr la app Node localmente

```bash
npm run build && node build/server.js
```

---

## 3. Cuando algo falla

### El sitio da 503

Significa que el proceso Node no arrancó: casi siempre el build no dejó un
`build/server.js` válido. Revisar los logs del último build:

```bash
curl -s "https://developers.hostinger.com/api/hosting/v1/accounts/u784612252/websites/ghostwhite-okapi-714606.hostingersite.com/nodejs/builds?per_page=1" -H "Authorization: Bearer $HOSTINGER_API_TOKEN"
```

Y con el `uuid` que devuelve:

```bash
curl -s "https://developers.hostinger.com/api/hosting/v1/accounts/u784612252/websites/ghostwhite-okapi-714606.hostingersite.com/nodejs/builds/UUID/logs" -H "Authorization: Bearer $HOSTINGER_API_TOKEN"
```

En el JSON del build, chequear que `options` diga `build_script: "build"`,
`output_directory: "build"`, `entry_file: "server.js"`. Si dice otra cosa, algo
rompió la convención de la sección 2.

### Relanzar un build a mano

Si hace falta forzar un deploy sin pushear (o el automático quedó mal
configurado):

```bash
curl -X POST "https://developers.hostinger.com/api/hosting/v1/accounts/u784612252/websites/ghostwhite-okapi-714606.hostingersite.com/nodejs/builds" -H "Authorization: Bearer $HOSTINGER_API_TOKEN" -H "Content-Type: application/json" -d '{"node_version":24,"app_type":"svelte-kit","build_script":"build","output_directory":"build","entry_file":"server.js","source_type":"git"}'
```

El token está en el bloque `env` de `~/.claude/settings.json`. Ojo: el MCP de
Hostinger **no** sirve para esto — hardcodea `source_type: archive`, así que solo
despliega por archivo, no por git.

### Cosas que solo se pueden tocar desde hPanel

No tienen endpoint en la API:

- La **rama** conectada de GitHub.
- Las **variables de entorno** (incluida `SITE_ENV`).

### Otras trampas conocidas

- **`SITE_ENV` tiene que llegar al BUILD, no solo al runtime.** El `robots.txt`
  se decide en build time: si en el cutover a producción no está seteado, el
  sitio sale con `Disallow: /`.
- **Hostinger intercepta `/robots.txt` en los subdominios `*.hostingersite.com`**
  y sirve el suyo. Se nota porque es la única respuesta sin `X-Robots-Tag`. En el
  dominio real hay que verificar que sí se sirva el de la app.
- **Renombrar el dominio del sitio en hPanel exige redesplegar.** El vhost se
  mueve pero los archivos no: queda en 503 hasta que corra un build nuevo.
- **`ORIGIN`**: la protección CSRF de SvelteKit rechaza los POST con `FormData`
  cuyo `Origin` no matchee. Hoy funciona porque adapter-node deriva el origen del
  header `Host`; conviene setear `ORIGIN` explícito en hPanel antes de que un
  cambio de proxy lo rompa.

---

## 4. Sitio legacy por FTP (`deploy.sh`)

Solo para actualizar a mano sista.com.ar mientras siga vivo.

```bash
./deploy.sh
```

Hace `npm run build:static` (sale a `build-static/`) y lo sube por FTP a
`httpdocs/` y `sista.com.ar/`, de forma **incremental**: `lftp mirror` compara
por tamaño y existencia (`--ignore-time`) y solo transfiere lo nuevo o distinto.

| Comando | Qué hace |
|---|---|
| `./deploy.sh` | Build estático + subida incremental a las 2 carpetas. |
| `./deploy.sh --dry-run` | Simulación: muestra qué subiría, sin tocar el server. |
| `./deploy.sh --no-build` | Sube lo que ya hay en `build-static/`. |
| `./deploy.sh --delete` | Además borra del server lo que ya no existe localmente. |
| `./deploy.sh --full` | Re-sube todo, ignorando la comparación. |

Requisitos: `brew install lftp` y el archivo `.deploy.env` con las credenciales
(está en `.gitignore`).

El script **aborta si el directorio a subir parece un build Node** (tiene
`server.js`, `handler.js` o `prerendered/`) o si no tiene `index.html`. Es a
propósito: `npm run build` ahora produce el build Node, y subir eso por FTP
rompería producción y publicaría el código del server.

En el build estático los formularios siguen hablando con los handlers PHP de
`static/assets/` — lo resuelve `src/lib/formEndpoints.js` según
`VITE_FORMS_BACKEND`. La Cartera y todo lo que dependa de `/api/` **no funciona**
en el estático: esas rutas solo existen en el build Node.
