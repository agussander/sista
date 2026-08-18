// Ruta dinámica: `section` puede ser cualquiera de las secciones del panel
// (ver PERMISO_POR_SECCION en $lib/adminPermisos.js), no un set finito conocido
// al momento del build. Con prerender=true (heredado del layout raíz) haría
// falta mantener una lista de `entries()` a mano y cualquier sección nueva que
// no esté en esa lista tiraría 404 en producción. Server-rendering dinámico
// evita ese mantenimiento: el deploy Node (el que importa, ver svelte.config.js)
// resuelve cualquier valor de `section` sin build-time list.
export const prerender = false;
