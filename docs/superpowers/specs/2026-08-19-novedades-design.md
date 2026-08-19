# Sección de novedades

## Contexto

Hoy "Novedades" existe en tres lugares, ninguno conectado con los otros:

1. **El home** muestra un carrusel (`src/lib/components/home/Novedades.svelte`)
   que lee un array hardcodeado en `src/lib/stores.js` (`noticias`, hoy con una
   sola entrada: la tienda). Las imágenes viven en `static/images/noticias/` y
   cada tarjeta abre un link externo con `window.open`. Cambiar una novedad es
   editar código y volver a deployar.
2. **El admin** ya tiene el hueco hecho: `novedades` está declarado en
   `panelSecciones.js` (sidebar + grilla de inicio), en `PERMISOS` y en
   `PERMISO_POR_SECCION` (`adminPermisos.js`), y `Content.svelte` ya importa y
   renderiza `novedades/Novedades.svelte` — un archivo **vacío, 0 bytes**. La
   sección aparece en el panel y no hace nada.
3. **PocketBase** ya tiene una colección `novedades`. Está completamente
   cerrada: cualquier lectura anónima devuelve
   `403 "Only superusers can perform this action."`, que en PocketBase
   significa List Rule en `nil` (una colección inexistente devuelve 404, como
   se verificó contra `tecnicos`). Ni siquiera un usuario logueado del panel
   puede listarla, y el chequeo de auth corre antes que la validación de
   filtros, así que **su schema no se puede inspeccionar desde afuera**.

No existe ninguna página pública de novedades: no hay forma de leer una
novedad completa ni de compartir el link de una sola.

### Restricciones del proyecto que condicionan el diseño

- `src/routes/+layout.js` declara `prerender = true` **global**. Las páginas
  públicas que necesitan datos frescos los traen del navegador en `onMount`
  (patrón de `src/routes/precios/+page.svelte`), y así siguen siendo
  prerenderizables.
- El repo buildea a **dos targets** desde el mismo código: `npm run build` →
  `build/` (adapter-node, el sitio vivo) y `npm run build:static` →
  `build-static/` (adapter-static, el sitio legacy `sista.com.ar`, que se
  actualiza a mano). Con `strict: false`, una ruta no prerenderizable
  simplemente no se emite en el build estático, en silencio.
- El módulo de servidor `src/lib/server/pocketbase.js` habla con PocketBase por
  `fetch` pelado (no por el SDK) e inyecta `fetchImpl` para poder testearse sin
  mocks del SDK. La URL sale de `env.VITE_POCKETBASE_URL` con
  `'https://sista.pockethost.io'` de fallback.

## Objetivo

Una sección de novedades cargable desde el panel, con listado en tarjetas y
vista completa por novedad, y un home que lea de la misma fuente.

Criterios de éxito:
- Cargás una novedad en `/admin` y aparece en `/novedades/` y en el carrusel
  del home, sin deployar.
- El link de una novedad puntual, pegado en WhatsApp o Facebook, muestra la
  foto y el título de **esa** novedad.
- Una novedad en borrador no es visible desde afuera, ni siquiera pidiéndola
  por URL directa.

## Decisiones tomadas

- **Fuente única**: el carrusel del home migra a PocketBase. Se elimina el
  array `noticias` de `stores.js`.
- **Campos**: título, fecha, imagen, cuerpo, bajada, publicada, destacada.
- **Sin campo de link externo**. La novedad de la tienda pasa a tener su
  destino dentro del cuerpo.
- **Cuerpo en texto plano**, con párrafos por salto de línea. Las URLs sueltas
  se detectan al renderizar y se convierten en links clickeables.
- **Detalle en página propia renderizada en el servidor**, que es lo único que
  da preview real al compartir.

## Alcance descartado

- **Editor con formato / Markdown** para el cuerpo: descartado a favor de texto
  plano. El autolink de URLs cubre el único caso concreto que había (la
  tienda).
- **Campo de link externo** y **modal sobre el listado**: descartados en
  brainstorming.
- **Paginado** del listado: el volumen de novedades no lo justifica. Se
  muestran todas.
- **Endurecer las reglas de escritura con el campo `permisos`**: ver
  "Limitación conocida".

## Diseño

### Colección `novedades` en PocketBase

Configuración manual, fuera del repo: la colección está cerrada a
superusuarios y el equipo de desarrollo no maneja esas credenciales.

| Campo | Tipo | Requerido | Notas |
|---|---|---|---|
| `titulo` | text | sí | |
| `slug` | text (índice único) | sí | Deriva del título; es la URL |
| `fecha` | date | sí | La fecha que se muestra. Separada de `created` para poder fechar hacia atrás |
| `bajada` | text | no | Resumen corto para la tarjeta |
| `cuerpo` | text largo | no | Texto plano |
| `imagen` | file (máx 1, imagen) | no | Con thumbs habilitados |
| `publicada` | bool | no | |
| `destacada` | bool | no | |

Si la colección ya tiene campos con otros nombres, se renombran a estos: el
código asume exactamente este vocabulario.

**Reglas de acceso:**

- **List** y **View**: `publicada = true || @request.auth.id != ""`
  El público ve solo las publicadas. Cualquier usuario logueado del panel ve
  también los borradores, que es lo que necesita el admin para editarlos.
- **Create**, **Update**, **Delete**: `@request.auth.id != ""`

Que la regla de lectura filtre los borradores es lo que hace que "borrador" sea
una garantía y no una convención de la interfaz: el `load` del servidor también
consulta anónimo, así que un borrador no se filtra ni por error de programación
en el front.

### Lógica compartida: `src/lib/novedades.js`

Funciones puras, sin dependencias, usadas por el público y por el admin. Con
tests en vitest (`src/lib/novedades.test.js`), siguiendo el patrón de
`llamenmeLogic.js`.

- `slugify(titulo)` — minúsculas, sin tildes, espacios a guiones, sin
  caracteres raros.
- `slugUnico(titulo, slugsExistentes)` — `slugify` más sufijo `-2`, `-3`… ante
  colisión. Necesario porque el índice único de PocketBase rechazaría el
  guardado con un error críptico.
- `parseCuerpo(texto)` — parte el texto en párrafos y cada párrafo en tramos
  `{tipo: 'texto' | 'link', valor}`. **Cada salto de línea abre un párrafo
  nuevo** y las líneas vacías se descartan: para quien escribe, "enter" es
  "párrafo nuevo", sin reglas que aprender. **No devuelve HTML**:
  devuelve datos que Svelte dibuja con `{#each}`, así el cuerpo nunca puede
  inyectar markup. Es la razón de no usar `{@html}`, a diferencia del carrusel
  actual.
- `resumenDe(novedad, max)` — la bajada si existe; si no, un recorte del cuerpo
  cortado en el último espacio antes del límite.
- `ordenarNovedades(lista)` — destacadas primero, después por `fecha`
  descendente.
- `formatFecha(fecha)` — `es-AR`.

### Lectura desde el servidor: `src/lib/server/novedades.js`

Lee PocketBase por `fetch` con `fetchImpl` inyectable, igual que
`src/lib/server/pocketbase.js`, para poder testearlo sin red.

- `listarPublicadas(baseUrl, {fetchImpl})` — pide con
  `filter=(publicada=true)` y ordena con `ordenarNovedades`.
- `traerPorSlug(baseUrl, slug, {fetchImpl})` — `null` si no existe o no está
  publicada.
- `urlArchivo(baseUrl, record, nombreArchivo, thumb)` — arma
  `{baseUrl}/api/files/{collectionId}/{id}/{archivo}` con `?thumb=` opcional.
  Hace falta porque acá no se usa el SDK, que es quien normalmente construye
  esta URL (`pb.files.getURL`).

El filtro explícito por `publicada` es redundante con la regla de PocketBase, a
propósito: si algún día alguien afloja la regla, el servidor sigue sin publicar
borradores.

### Rutas públicas

**`/novedades/`** — `+page.server.js` con `prerender = false` y un `load` que
llama a `listarPublicadas`. `+page.svelte` dibuja una grilla responsive de
`NovedadCard` verticales: 3 por fila en escritorio, 2 en tablet y 1 en celular,
sin paginado. Si no hay ninguna novedad publicada, un mensaje corto en lugar de
una grilla vacía.

**`/novedades/[slug]/`** — `+page.server.js` con `prerender = false`; el `load`
llama a `traerPorSlug` y tira `error(404)` si no hay nada. `+page.svelte`
muestra imagen, fecha, título, bajada y el cuerpo renderizado por
`CuerpoNovedad`, más un link de vuelta al listado. Los `MetaTags` usan el
título, la bajada y la imagen de la novedad — es lo que hace que el preview al
compartir sea el correcto.

**Consecuencia sobre el build estático**: al no ser prerenderizables, estas dos
rutas no se emiten en `build-static/`. El sitio legacy `sista.com.ar` no va a
tener sección de novedades. Es aceptable porque ese sitio se mantiene a mano,
pero es una pérdida real y silenciosa (con `strict: false` el build no avisa).

### Componentes compartidos

- `src/lib/components/novedades/NovedadCard.svelte` — imagen (thumb), fecha,
  título y resumen; envuelta en un link a `/novedades/<slug>/`. La usan el
  listado y el carrusel del home, así las dos superficies no se despegan
  visualmente. Toma una prop `orientacion`: `'vertical'` (imagen arriba, la del
  listado) u `'horizontal'` (imagen al costado, que es la forma que ya tiene el
  carrusel del home en pantallas anchas). Si la novedad no tiene imagen, la
  tarjeta se dibuja sin el bloque de imagen en vez de dejar un hueco gris.
- `src/lib/components/novedades/CuerpoNovedad.svelte` — recibe el texto, lo
  pasa por `parseCuerpo` y lo dibuja.

### Home

`src/lib/components/home/Novedades.svelte` se reescribe: trae las novedades en
`onMount` desde el navegador con el `pb` compartido (patrón de `/precios`), lo
que **mantiene el home prerenderizado**. Conserva el carrusel automático y la
estética actual, pero cada tarjeta pasa a ser `NovedadCard` y linkea al
detalle en vez de abrir un `window.open`. Se agrega un "Ver todas" hacia
`/novedades/`.

Si no hay novedades o la consulta falla, la sección no se renderiza: hoy el
carrusel asume que siempre hay al menos un elemento.

Se elimina `noticias` de `src/lib/stores.js` (no lo referencia
`stores.test.js`) y queda sin uso `static/images/noticias/tienda-sista.png`.

### Navegación

Se agrega **Novedades** a `MenuLinks.svelte`. Los dos ítems actuales (Planes,
Contacto) son scroll a anclas del home vía `clickHandler`; este es una
navegación real a otra ruta, así que usa un link común y no ese handler.

### Admin

Se completa el archivo vacío, repartido en tres para que ninguno crezca de más:

- **`Novedades.svelte`** — orquesta. Lista todas las novedades (incluidos
  borradores) con chips de estado, botones de editar y eliminar (con
  confirmación), y "Nueva novedad". Maneja carga, error y vacío con `Spinner`,
  como el resto del panel.
- **`NovedadForm.svelte`** — alta y edición: título, fecha, bajada, cuerpo,
  imagen con vista previa, y los checks de publicada y destacada. Guarda con
  `FormData` (necesario por el archivo). Al crear, calcula el slug con
  `slugUnico` contra los slugs ya cargados; al editar, el slug **no cambia**,
  para no romper links ya compartidos.
- **`novedadesAdmin.svelte.js`** — el estado y las llamadas a PocketBase,
  separadas de la vista (patrón de `carteraStore.svelte.js` y
  `llamenmeStore.svelte.js`).

## Testing

`vitest` ya está configurado (`npm test`).

- `src/lib/novedades.test.js` — `slugify` (tildes, símbolos, espacios),
  `slugUnico` (colisión simple y múltiple), `parseCuerpo` (párrafos, URL sola,
  URL al final de una oración, texto sin URLs, texto vacío), `resumenDe`
  (con bajada, sin bajada, cuerpo más corto que el máximo), `ordenarNovedades`
  (destacadas primero, empate por fecha).
- `src/lib/server/novedades.test.js` — con `fetchImpl` falso: listado feliz,
  PocketBase devolviendo error, `traerPorSlug` sin resultados, y armado de
  `urlArchivo` con y sin thumb.

Verificación manual en el navegador, con el dev server: cargar una novedad
desde el panel, verla aparecer en el listado y en el home, abrir el detalle,
confirmar que un borrador no aparece y que su URL directa da 404.

## Limitación conocida

Cualquier usuario logueado del panel va a poder crear, editar y borrar
novedades, tenga o no el permiso `novedades` en su registro. El sistema de
`adminPermisos.js` decide qué se muestra en el sidebar y qué renderiza
`Content.svelte`, pero las escrituras salen del navegador directo a PocketBase,
donde la única barrera es la regla de la colección.

Esto **no es una regresión**: es exactamente cómo funcionan hoy `precios` y el
resto de las secciones que escriben. Se documenta para que quede explícito.

Se puede endurecer más adelante con una regla que mire el campo `permisos` del
usuario, del estilo `@request.auth.permisos ?~ 'novedades'`. No se hace ahora
porque el tipo real del campo en PocketBase no se puede inspeccionar (la
colección `users` tampoco es legible desde afuera) y esa sintaxis no funciona
igual si el campo es `json` que si es `select` múltiple. Es un cambio de
configuración, no de código, y se puede hacer sin tocar el repo.
