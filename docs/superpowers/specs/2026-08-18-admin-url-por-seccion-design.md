# Admin: URL propia por pestaña

## Contexto

El panel `/admin` es una sola ruta SvelteKit (`src/routes/admin/+page.svelte`),
prerenderizada. Adentro, `Dashboard.svelte` guarda qué pestaña está activa en
un `$state` local (`selected`) que no se refleja en la URL — salvo un `?view=`
legacy que solo usan 2 links internos de "Conectar la ciudad". Recargar la
página, o mandarle a alguien un link directo a una sección, siempre cae en el
home grid.

El catálogo de secciones válidas ya vive centralizado en dos lugares
consistentes entre sí:
- `panelSecciones.js` — las 6 principales del sidebar (título + `content` +
  ícono).
- `adminPermisos.js` → `PERMISO_POR_SECCION` — las 12 claves totales
  (incluidas las anidadas: `formulario_calidad`, `formulario_calidad_2`,
  `ruleta`, `conectarlaciudad`, `sorteo-conectarlaciudad`, `tolosano`), cada
  una mapeada al permiso que la habilita.

Nota de contexto: en paralelo hay otra sesión agregando una sección nueva al
admin (relacionada a precios/tarifario). Este cambio es deliberadamente
genérico — no toca nada específico de `precios` ni asume una lista fija de
secciones más allá de las que ya están en `panelSecciones.js` /
`adminPermisos.js` — para no pisar ese trabajo.

## Objetivo

Que la URL refleje la pestaña activa (`/admin/cartera`, `/admin/precios`,
etc.) para las 12 secciones navegables, con:
- **Deep-link real**: entrar directo a `/admin/cartera` (logueado) te deja en
  Cartera.
- **Persistencia al refrescar**: recargar la página mantiene la sección.
- Bonus gratis de usar navegación real: botón atrás/adelante del navegador
  anda entre secciones.

## Alcance descartado

- **Shallow routing (`pushState`)** sin ruta real: descartado porque un
  refresh o link directo a `/admin/cartera` tiraría 404 en producción — viola
  el objetivo de deep-link.
- **Una carpeta de ruta por sección** (`admin/cartera/+page.svelte`, etc.):
  descartado por duplicación — cada sección nueva necesitaría un archivo de
  ruta a mano además de su entrada en `panelSecciones.js`/`adminPermisos.js`,
  justo el tipo de fricción que hay que evitar con el trabajo concurrente en
  otra sección.

## Diseño

### Ruta

- `src/routes/admin/+page.svelte` se mueve a
  `src/routes/admin/[[section]]/+page.svelte` (mismo contenido). El parámetro
  opcional (`[[section]]`) matchea tanto `/admin` como `/admin/<lo-que-sea>`
  con **la misma instancia de componente** — SvelteKit no remonta al navegar
  entre valores del mismo parámetro, así que no se re-dispara `onMount` (nada
  de resuscribirse dos veces al realtime de "llamenme", ni de repetir el
  chequeo de sesión).
- Se agrega `src/routes/admin/[[section]]/+page.js` con
  `export const prerender = false;`. Esta ruta puntual queda SSR dinámica en
  el deploy Node (matchea cualquier `section` sin mantener una lista de
  `entries()` a mano). El resto del sitio sigue prerenderizado sin cambios.
- Efecto en el build estático legacy (`npm run build:static`, FTP a
  sista.com.ar): esta ruta deja de emitirse ahí — pero el panel admin ya
  depende de endpoints `/api/...` que tampoco existen en ese build (no se
  emiten los `+server.js`), así que Cartera y compañía ya eran no-funcionales
  en el sitio estático. No se pierde nada que funcionara hoy.

### Sincronización `selected` ↔ URL

- En `Dashboard.svelte`, `selected` arranca desde `$page.params.section` (via
  `$app/stores`, que es lo que ya usa el archivo) en vez de `null` a secas.
  Sigue siendo `$state` para que la UI reaccione al toque.
- Click en una pestaña (`Sidebar.svelte`: `handleMainItemClick` y los items de
  `expandableContent`) pasa de asignar `selected = item.content` a llamar
  `goto(`/admin/${item.content}`, { noScroll: true, keepFocus: true })`. El
  `$effect` que sincroniza `selected` con `$page.params.section` recoge el
  cambio.
- Volver al home (grid de íconos, hoy dispara con `selected = null`) navega a
  `goto('/admin')`.
- **Sección desconocida en la URL** (typo, ruta vieja): no hay redirect ni
  404 — simplemente no matchea ningún `{:else if}` en `Content.svelte` y se ve
  el home grid, igual que hoy con un `selected` inválido.
- **Permisos**: sin cambios. `Content.svelte` ya banca mostrar "No tenés
  permiso para ver esta sección" cuando `selected` no está permitido para el
  usuario, y eso sigue igual venga `selected` de la URL o de un click.
- **Login**: entrar a `/admin/cartera` sin sesión muestra `Login` (el gate en
  `+page.svelte` no mira `section`). Al loguearse, el mismo componente
  re-renderiza mostrando `Dashboard`, que ya lee `cartera` del parámetro de
  ruta — no hace falta redirect post-login.

### Migración del `?view=` legacy

Los únicos 2 usos de `?view=` son internos, dentro de "Conectar la ciudad":
- `Conectarlaciudad.svelte` → `goto('/admin?view=sorteo-conectarlaciudad')`
  pasa a `goto('/admin/sorteo-conectarlaciudad')`.
- `SorteoConectarlaciudad.svelte` → link
  `/admin?view=conectarlaciudad` pasa a `/admin/conectarlaciudad`.

El `$effect` en `Dashboard.svelte` que leía `$page.url.searchParams.get('view')`
se saca (queda muerto una vez migrados los 2 links).

### Limpieza

`adminStore.js` exporta un `selected` (persisted store de localStorage) que
nadie importa — quedó de un intento anterior de persistir la pestaña activa,
superado en la práctica por el `$state` local de `Dashboard.svelte`. Se saca
para no dejar dos mecanismos con el mismo nombre y propósito (uno muerto, uno
en uso). `sidebarCollapsed` (otro persisted, en `Dashboard.svelte`) no se
toca — es un concepto distinto.

## Plan de pruebas (manual, `npm run dev`)

- Click en cada una de las 6 pestañas principales → URL cambia a
  `/admin/<pestaña>` y el contenido correcto se muestra.
- Refrescar en `/admin/cartera` (logueado) → aterriza en Cartera, no en home.
- Entrar directo a `/admin/cartera` sin sesión → `Login`, y al loguearse cae
  en Cartera sin redirect extra.
- Atrás/adelante del navegador entre dos pestañas → funciona.
- `/admin/asdasd` (sección inexistente) → home grid, sin romper nada.
- Los 2 links internos de "Conectar la ciudad" (ida y vuelta al sorteo) siguen
  funcionando con las rutas nuevas.
- Cambiar de pestaña no duplica la suscripción realtime de "Quiero que me
  llamen" (sin sonidos/notificaciones repetidas).
- Mobile: seleccionar una pestaña sigue cerrando el sidebar como hoy.
- `npm run build` (target Node, el que corre en prod) levanta sin errores.
- `npm run build:static` sigue buildeando sin errores (la ruta con sección
  queda afuera de ese output, a propósito).
