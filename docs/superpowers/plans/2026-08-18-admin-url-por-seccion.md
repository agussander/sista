# Admin: URL propia por pestaña Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la URL de `/admin` refleje la pestaña activa (`/admin/cartera`, `/admin/precios`, etc.) para las 12 secciones navegables del panel, con deep-link real y persistencia al refrescar.

**Architecture:** `src/routes/admin/+page.svelte` se muda a una ruta con parámetro opcional `src/routes/admin/[[section]]/+page.svelte` (matchea `/admin` y `/admin/<section>` con la misma instancia de componente, sin remount al cambiar de sección) y se le desactiva el prerender puntual para que quede SSR dinámica en el deploy Node. `Dashboard.svelte` pasa de guardar la pestaña activa en un `$state` propio a derivarla de `$page.params.section`; los sitios que hoy mutan `selected` directamente (`Sidebar.svelte`, el grid de home, y 2 links internos de "Conectar la ciudad") pasan a navegar con `goto()`.

**Tech Stack:** SvelteKit 2 (runes), Vitest (sin tests de componente en este repo — la verificación de este plan es manual vía `npm run dev` + navegador, más `curl` para confirmar que las rutas no tiran 404).

**Spec:** `docs/superpowers/specs/2026-08-18-admin-url-por-seccion-design.md`

---

## Antes de empezar

Todo este trabajo vive bajo `src/routes/admin/` y no toca nada de `precios/` ni de `panelSecciones.js`/`adminPermisos.js` (hay otra sesión trabajando en una sección nueva de precios en paralelo — no se le agregan ni quitan entradas a esas listas acá).

---

### Task 1: Mudar `/admin` a la ruta con parámetro opcional `[[section]]`

**Files:**
- Move: `src/routes/admin/+page.svelte` → `src/routes/admin/[[section]]/+page.svelte`
- Create: `src/routes/admin/[[section]]/+page.js`

- [ ] **Step 1: Mover el archivo con git**

```bash
mkdir -p "src/routes/admin/[[section]]"
git mv "src/routes/admin/+page.svelte" "src/routes/admin/[[section]]/+page.svelte"
```

- [ ] **Step 2: Arreglar los imports relativos del archivo movido**

El archivo bajó un nivel de carpeta, así que sus 4 imports relativos a `./_components/...` ahora apuntan a una carpeta que no existe (`src/routes/admin/[[section]]/_components/`). Hay que subirlos a `../_components/...`.

En `src/routes/admin/[[section]]/+page.svelte`, cambiar:

```js
import EncuestaDeCalidad from './_components/mantenimiento/Dashboard/encuestas/EncuestaDeCalidad.svelte';
import Login from './_components/Login.svelte';
import {token, record} from './_components/adminStore'
import Dashboard from './_components/mantenimiento/Dashboard.svelte';
```

por:

```js
import EncuestaDeCalidad from '../_components/mantenimiento/Dashboard/encuestas/EncuestaDeCalidad.svelte';
import Login from '../_components/Login.svelte';
import {token, record} from '../_components/adminStore'
import Dashboard from '../_components/mantenimiento/Dashboard.svelte';
```

(`import { pb } from '$lib/pocketbase';` no cambia — es un alias absoluto, no relativo.)

- [ ] **Step 3: Crear `+page.js` con prerender desactivado**

Create `src/routes/admin/[[section]]/+page.js`:

```js
// Ruta dinámica: `section` puede ser cualquiera de las secciones del panel
// (ver PERMISO_POR_SECCION en $lib/adminPermisos.js), no un set finito conocido
// al momento del build. Con prerender=true (heredado del layout raíz) haría
// falta mantener una lista de `entries()` a mano y cualquier sección nueva que
// no esté en esa lista tiraría 404 en producción. Server-rendering dinámico
// evita ese mantenimiento: el deploy Node (el que importa, ver svelte.config.js)
// resuelve cualquier valor de `section` sin build-time list.
export const prerender = false;
```

- [ ] **Step 4: Verificar que el build de desarrollo levanta las dos formas de la ruta**

Run: `npm run dev` (dejalo corriendo en background) y en otra terminal:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/admin
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/admin/cartera
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/admin/lo-que-sea
```

Expected: las 3 devuelven `200` (la última porque `[[section]]` matchea cualquier valor a nivel de ruta — la validación de si es una sección real pasa después, en el cliente, en el Task 2).

- [ ] **Step 5: Commit**

```bash
git add "src/routes/admin/[[section]]/+page.svelte" "src/routes/admin/[[section]]/+page.js"
git commit -m "$(cat <<'EOF'
refactor(admin): mudar /admin a ruta con parametro opcional [[section]]

Prepara el terreno para que la URL refleje la pestaña activa. Sin
cambio de comportamiento todavia: selected sigue arrancando en null
pase lo que pase en la URL, eso es el proximo paso.
EOF
)"
```

---

### Task 2: `Dashboard.svelte` deriva la pestaña activa de la URL

**Files:**
- Modify: `src/routes/admin/_components/mantenimiento/Dashboard.svelte`

- [ ] **Step 1: Agregar el import de `goto`**

En `src/routes/admin/_components/mantenimiento/Dashboard.svelte`, cambiar:

```js
import { onMount, onDestroy } from 'svelte';
import { pb } from '$lib/pocketbase';
import { page } from '$app/stores';
```

por:

```js
import { onMount, onDestroy } from 'svelte';
import { goto } from '$app/navigation';
import { pb } from '$lib/pocketbase';
import { page } from '$app/stores';
```

- [ ] **Step 2: Derivar `selected` del parámetro de ruta en vez de un `$state` local**

Cambiar:

```js
let selected = $state(null);
```

por:

```js
let selected = $derived($page.params.section ?? null);
```

- [ ] **Step 3: Sacar el `$effect` legacy de `?view=`**

Borrar este bloque completo (lo reemplaza la migración de esos 2 links a rutas reales en el Task 4):

```js
$effect(() => {
    const view = $page.url.searchParams.get('view');
    if (view === 'sorteo-conectarlaciudad') selected = 'sorteo-conectarlaciudad';
    else if (view === 'conectarlaciudad') selected = 'conectarlaciudad';
});
```

- [ ] **Step 4: `handlePanelSelect` navega en vez de mutar `selected`**

Cambiar:

```js
const handlePanelSelect = (option) => {
    selected = option;
    sidebarOpen = false; // Cerrar sidebar en móvil al seleccionar
}
```

por:

```js
const handlePanelSelect = (option) => {
    goto(`/admin/${option}`, { noScroll: true, keepFocus: true });
    sidebarOpen = false; // Cerrar sidebar en móvil al seleccionar
}
```

- [ ] **Step 5: Verificar en el navegador**

Con `npm run dev` corriendo, entrá a `/admin`, logueate, y desde el grid de home hacé click en cualquier tarjeta (por ejemplo "Novedades"). Confirmá:
- La URL de la barra de direcciones cambia a `/admin/novedades`.
- El contenido de esa sección se muestra (el click en el sidebar todavía no navega — eso es el Task 3, así que probalo solo desde el grid de home por ahora).

- [ ] **Step 6: Commit**

```bash
git add src/routes/admin/_components/mantenimiento/Dashboard.svelte
git commit -m "$(cat <<'EOF'
feat(admin): Dashboard deriva la seccion activa de la URL

selected pasa de $state local a $derived($page.params.section), y
handlePanelSelect navega con goto() en vez de mutar estado local. Se
saca el $effect legacy que leia ?view= (los 2 links que lo usaban se
migran en el proximo commit).
EOF
)"
```

---

### Task 3: `Sidebar.svelte` navega con `goto` en vez de mutar un prop bindable

**Files:**
- Modify: `src/routes/admin/_components/mantenimiento/Dashboard/Sidebar.svelte`
- Modify: `src/routes/admin/_components/mantenimiento/Dashboard.svelte`

- [ ] **Step 1: Agregar el import de `goto` en Sidebar**

En `src/routes/admin/_components/mantenimiento/Dashboard/Sidebar.svelte`, cambiar:

```js
import { slide } from 'svelte/transition';
import { seccionPermitida } from '$lib/adminPermisos.js';
import { PANEL_SECCIONES } from './panelSecciones.js';
```

por:

```js
import { slide } from 'svelte/transition';
import { goto } from '$app/navigation';
import { seccionPermitida } from '$lib/adminPermisos.js';
import { PANEL_SECCIONES } from './panelSecciones.js';
```

- [ ] **Step 2: `selected` pasa de bindable a prop de solo lectura**

Cambiar:

```js
let {
    record,
    logout,
    selected = $bindable(null),
    collapsed = false,
    llamenmeUnread = 0
} = $props();
```

por:

```js
let {
    record,
    logout,
    selected = null,
    collapsed = false,
    llamenmeUnread = 0
} = $props();
```

- [ ] **Step 3: `handleMainItemClick` navega en vez de asignar**

Cambiar:

```js
const handleMainItemClick = (item) => {
    selected = item.content;
};
```

por:

```js
const handleMainItemClick = (item) => {
    goto(`/admin/${item.content}`, { noScroll: true, keepFocus: true });
};
```

- [ ] **Step 4: El botón de cada item anidado (`expandableContent`) también navega**

En el markup, cambiar:

```svelte
<button class="child"
class:selected={selected==child.content}
onclick={() => { selected = child.content; }}
>
    <span>{child.title}</span>
</button>
```

por:

```svelte
<button class="child"
class:selected={selected==child.content}
onclick={() => goto(`/admin/${child.content}`, { noScroll: true, keepFocus: true })}
>
    <span>{child.title}</span>
</button>
```

- [ ] **Step 5: El call site en Dashboard.svelte deja de usar `bind:`**

En `src/routes/admin/_components/mantenimiento/Dashboard.svelte`, cambiar:

```svelte
<Sidebar bind:selected {logout} record={$record} collapsed={sidebarCollapsed} llamenmeUnread={llamenmeStore.unread}></Sidebar>
```

por:

```svelte
<Sidebar {selected} {logout} record={$record} collapsed={sidebarCollapsed} llamenmeUnread={llamenmeStore.unread}></Sidebar>
```

- [ ] **Step 6: Verificar en el navegador**

Con `npm run dev` corriendo y sesión logueada:
- Click en cada uno de los 6 items principales del sidebar (Precios, Novedades, Trabajos, Técnicos, Quiero que me llamen, Cartera de clientes) → la URL cambia a `/admin/<seccion>` en cada caso y el sidebar resalta el item activo.
- Abrí "Otros" y "Encuesta de calidad", click en un item anidado (ej. Ruleta) → URL cambia a `/admin/ruleta`.
- Botón atrás del navegador después de un par de clicks → vuelve a la sección anterior sin recargar la página (mirá que no parpadee el layout completo, señal de que no hubo remount).
- Refrescá la página estando en `/admin/cartera` → seguís en Cartera, no en el grid de home.

- [ ] **Step 7: Commit**

```bash
git add src/routes/admin/_components/mantenimiento/Dashboard/Sidebar.svelte src/routes/admin/_components/mantenimiento/Dashboard.svelte
git commit -m "$(cat <<'EOF'
feat(admin): Sidebar navega por URL en vez de mutar estado local

selected deja de ser un prop bindable: ahora es de solo lectura, y
tanto los items principales como los anidados navegan con goto() a
/admin/<seccion>. Junto con el Task 2, la URL queda como unica fuente
de verdad de la seccion activa.
EOF
)"
```

---

### Task 4: Migrar los 2 links internos que usan `?view=`

**Files:**
- Modify: `src/routes/admin/_components/mantenimiento/Dashboard/conectarlaciudad/Conectarlaciudad.svelte:7`
- Modify: `src/routes/admin/_components/mantenimiento/Dashboard/conectarlaciudad/SorteoConectarlaciudad.svelte:158`

- [ ] **Step 1: `Conectarlaciudad.svelte` navega a la ruta real**

Cambiar:

```js
function irASorteo() {
    goto('/admin?view=sorteo-conectarlaciudad');
}
```

por:

```js
function irASorteo() {
    goto('/admin/sorteo-conectarlaciudad');
}
```

- [ ] **Step 2: `SorteoConectarlaciudad.svelte` linkea a la ruta real**

Cambiar:

```svelte
<a href="/admin?view=conectarlaciudad" class="btn-header btn-link">Volver a Conectar la ciudad</a>
```

por:

```svelte
<a href="/admin/conectarlaciudad" class="btn-header btn-link">Volver a Conectar la ciudad</a>
```

- [ ] **Step 3: Verificar en el navegador**

Con sesión logueada y permiso de `conectarlaciudad`: entrá a `/admin/conectarlaciudad`, click en "Ir al sorteo" (o el botón equivalente que llama a `irASorteo`) → URL pasa a `/admin/sorteo-conectarlaciudad` y se ve la pantalla del sorteo. Click en "Volver a Conectar la ciudad" → URL vuelve a `/admin/conectarlaciudad`.

- [ ] **Step 4: Commit**

```bash
git add "src/routes/admin/_components/mantenimiento/Dashboard/conectarlaciudad/Conectarlaciudad.svelte" "src/routes/admin/_components/mantenimiento/Dashboard/conectarlaciudad/SorteoConectarlaciudad.svelte"
git commit -m "$(cat <<'EOF'
refactor(admin): migrar los links de Conectar la ciudad de ?view= a rutas reales

Ahora que /admin/<seccion> es una URL real para cualquier seccion
(Task 2/3), el query param ?view= que solo usaban estos 2 links queda
redundante.
EOF
)"
```

---

### Task 5: Sacar el store `selected` muerto de `adminStore.js`

**Files:**
- Modify: `src/routes/admin/_components/adminStore.js`

- [ ] **Step 1: Confirmar que nadie lo importa**

```bash
grep -rn "adminStore" --include="*.svelte" --include="*.js" src | grep -v node_modules
```

Expected: ningún resultado importa `{ selected }` desde `adminStore` (solo `token`, `record`).

- [ ] **Step 2: Sacar la línea**

En `src/routes/admin/_components/adminStore.js`, cambiar:

```js
import { persisted } from "svelte-persisted-store";

export const token = persisted('sista_auth_token', null);
export const record = persisted('sista_auth_record', null);
export const selected = persisted('sista_selected_option', null);
```

por:

```js
import { persisted } from "svelte-persisted-store";

export const token = persisted('sista_auth_token', null);
export const record = persisted('sista_auth_record', null);
```

- [ ] **Step 3: Commit**

```bash
git add src/routes/admin/_components/adminStore.js
git commit -m "$(cat <<'EOF'
chore(admin): sacar el store selected muerto de adminStore

Sin uso desde ningun lado (Dashboard.svelte ya tenia su propio $state
en paralelo). Con la seccion activa viviendo en la URL desde este
cambio, dejarlo hubiera sido un segundo mecanismo de persistencia con
el mismo nombre y proposito, uno de los dos siempre desactualizado.
EOF
)"
```

---

### Task 6: Regresión completa y verificación de builds

**Files:** ninguno (solo verificación).

- [ ] **Step 1: Pase manual completo en `npm run dev`**

Con sesión logueada (usuario con todos los permisos si es posible):
- Click en las 6 pestañas principales → cada una cambia la URL a `/admin/<pestaña>` y muestra el contenido correcto.
- `/admin/asdasd` tipeado a mano en la barra → cae en el grid de home, sin errores en consola.
- Cambiar de pestaña 3-4 veces seguidas y confirmar en la consola del navegador que no aparecen mensajes repetidos de la suscripción realtime de "Quiero que me llamen" (buscar logs de `llamenmeStore` o abrir Network y confirmar una sola conexión realtime activa).
- En una ventana angosta (mobile, <768px): abrir el sidebar con el botón hamburguesa, click en una sección → el sidebar se cierra y la URL cambia.

- [ ] **Step 2: Build del target Node (el que corre en producción)**

Run: `npm run build`
Expected: termina sin errores. Confirmar que existe `build/server.js` (igual que antes del cambio — ver el comentario en `svelte.config.js` sobre por qué ese nombre no se puede mover).

- [ ] **Step 3: Build del target estático legacy**

Run: `npm run build:static`
Expected: termina sin errores (la ruta `[[section]]` queda afuera del output estático a propósito — ver la sección "Efecto en el build estático legacy" del spec).

- [ ] **Step 4: Confirmar que no quedan referencias muertas a `?view=`**

```bash
grep -rn "?view=" --include="*.js" --include="*.svelte" src
```

Expected: sin resultados.

No hace falta commit en esta tarea — es solo verificación de lo hecho en las tareas 1 a 5. Si algo falla, volver a la tarea correspondiente y arreglarlo ahí (con su propio commit).

---

## Self-review (hecho al escribir este plan)

- **Cobertura del spec:** ruta dinámica + prerender=false (Task 1), `selected` derivado de la URL (Task 2), navegación por click en sidebar y grid de home (Task 2+3), migración de `?view=` (Task 4), limpieza del store muerto (Task 5), plan de pruebas del spec (Task 6). No quedan secciones del spec sin tarea.
- **Import relativo roto por el `git mv`:** detectado y corregido explícitamente en el Task 1 (los 4 imports de `+page.svelte` a `./_components/...`) — es el tipo de error silencioso que solo aparece al buildear, no antes.
- **Consistencia de nombres:** `selected`, `goto`, `$page.params.section` se usan igual en todas las tareas que los tocan (Task 2 y 3 son el mismo par productor/consumidor).
