# Copia del layout original

Esta carpeta contiene el layout completo del sitio tal como estaba antes de activar "Sitio en construcción".

## Cómo restaurar el layout original

1. Copia los archivos de esta carpeta a `src/routes/`:
   - `+layout.svelte` → `src/routes/+layout.svelte`
   - `+layout.js` → `src/routes/+layout.js`

2. Sobrescribe los archivos actuales en `src/routes/`.

El `+layout.js` del proyecto no se modificó (sigue en `src/routes/+layout.js` con `prerender` y `trailingSlash`); solo se reemplazó el contenido de `+layout.svelte`.
