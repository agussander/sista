# Deploy del sitio (FTP, incremental)

El sitio es **SvelteKit estático** (`adapter-static`): el resultado del build queda
en `build/` y eso es lo que se sube por FTP a **sista.ar**, a las carpetas
**`httpdocs`** y **`sista.com.ar`**.

La subida es **incremental**: se compara lo local contra lo que ya está en el
servidor y **sólo se transfieren los archivos nuevos o que cambiaron**. No re-sube
todo cada vez.

---

## 1. Requisito (una sola vez): instalar `lftp`

```bash
brew install lftp
```

`lftp` es el que hace la comparación y la subida incremental por FTP. (`rsync` no
sirve acá porque no funciona sobre FTP puro).

## 2. Credenciales (una sola vez)

Ya está el archivo **`.deploy.env`** con el host, usuario y contraseña.
Está en `.gitignore`, así que **no se sube al repo**. Si lo tenés que recrear:

```bash
cp .deploy.env.example .deploy.env   # y completá la contraseña
```

## 3. Deployar

```bash
./deploy.sh
```

Eso hace, en orden:
1. `npm run build` (genera `build/`).
2. Sube `build/` a `httpdocs/` (incremental).
3. Sube `build/` a `sista.com.ar/` (incremental).

---

## Opciones

| Comando                  | Qué hace |
|--------------------------|----------|
| `./deploy.sh`            | Build + subida incremental a las 2 carpetas. |
| `./deploy.sh --dry-run`  | **Simulación**: muestra qué subiría/borraría, sin tocar el server. Ideal para probar la primera vez. |
| `./deploy.sh --no-build` | No regenera el build; sube lo que ya hay en `build/`. |
| `./deploy.sh --delete`   | Además **borra del server** los archivos que ya no existen localmente (limpia assets viejos con hash). |
| `./deploy.sh --full`     | Re-sube **todo**, ignorando la comparación. |
| `./deploy.sh --help`     | Ayuda. |

Recomendado la primera vez:

```bash
./deploy.sh --dry-run     # revisás la lista
./deploy.sh               # subís de verdad
```

---

## ¿Cómo decide qué subir? (la parte de "sólo las diferencias")

`lftp mirror` compara cada archivo local con el del servidor. Se usa la opción
**`--ignore-time`**, que compara por **tamaño y existencia** en vez de por fecha.

¿Por qué no por fecha? Porque cada `npm run build` reescribe TODOS los archivos
con fecha nueva, así que comparar por fecha re-subiría todo siempre. En cambio:

- Los assets de Vite (`_app/immutable/...`) llevan un **hash en el nombre**. Si el
  contenido cambia, cambia el nombre → es un archivo "nuevo" y se sube; si no
  cambió, mismo nombre y mismo tamaño → **se saltea**.
- HTML y demás se comparan por tamaño; si cambió el contenido, se sube.

Caso límite muy raro: si editás un archivo y queda **exactamente del mismo tamaño**,
la comparación no lo detecta. En ese caso forzá con `./deploy.sh --full`.

---

## Notas

- **Seguridad:** `deploy.sh` intenta FTPS (cifrado) si el servidor lo ofrece
  (`FTP_SSL=true` en `.deploy.env`). Si tu hosting no lo soporta y falla la
  conexión, poné `FTP_SSL=no` en `.deploy.env` para usar FTP plano.
- **Borrado:** por defecto **no borra nada** del server (más seguro). Con el tiempo
  se acumulan assets viejos con hash; cada tanto corré `./deploy.sh --delete` para
  limpiarlos. Cuidado: `--delete` borra del server cualquier archivo que no esté en
  `build/` (si hay algo subido a mano en `httpdocs/`, lo elimina).
- Los archivos PHP de `assets/` (mailers, etc.) forman parte del build y se suben
  junto con el resto.
