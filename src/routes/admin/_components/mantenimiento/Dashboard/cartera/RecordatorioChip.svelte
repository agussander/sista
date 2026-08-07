<!-- src/routes/admin/_components/mantenimiento/Dashboard/cartera/RecordatorioChip.svelte -->
<script>
// Recordatorio del cliente: lo que el asesor se anota para hacer en una fecha.
// Un solo chip arriba del detalle en vez de una seccion propia: "+ Recordatorio"
// si no hay ninguno pendiente, o "{accion} {fecha}" si lo hay. Un cliente tiene
// como mucho un recordatorio pendiente a la vez -el chip de agregar no aparece
// si ya hay uno cargado-, asi que no hace falta una lista.
import { carteraStore } from './carteraStore.svelte.js';
import { partesFecha } from '$lib/cartera/fechas.js';
import { proximoRecordatorio } from '$lib/cartera/alertas.js';

let { cliente } = $props();

const actual = $derived(carteraStore.recordatoriosDe(cliente.id)[0] ?? null);

// Mismo calculo que la fila de la lista (`proximoRecordatorio`), para que el
// semaforo del chip no diverja del de `Cartera.svelte`: antes este componente
// tenia su propio chequeo de "vencido" que juntaba "hoy" y "vencido" en un
// solo estado amber, asi que un recordatorio de un dia anterior se veia rojo
// en la lista pero amber aca.
const estado = $derived(actual ? proximoRecordatorio([actual], hoyPartes())?.estado ?? null : null);

let abierto = $state(false);
let wrapperEl = $state(null);

// Con un recordatorio ya cargado el popover tiene dos vistas: la ficha (texto,
// fecha, "Listo" y "Editar") y el formulario de edicion (fecha y texto). Este
// flag dice en cual esta.
let editando = $state(false);

let fecha = $state('');
let texto = $state('');
let guardando = $state(false);
let completando = $state(false);
let eliminando = $state(false);
let error = $state('');

function hoyPartes() {
    const d = new Date();
    return { anio: d.getFullYear(), mes: d.getMonth() + 1, dia: d.getDate() };
}

// Version corta para el chip ("15/9"), sin ceros a la izquierda ni anio: tiene
// que entrar junto al texto sin alargar demasiado la fila del header.
function fmtCorta(iso) {
    const p = partesFecha(iso);
    return p ? `${p.dia}/${p.mes}` : iso;
}

// Version completa para el popover, con ceros y anio. Mismo motivo que en el
// resto de Cartera para no usar `new Date(iso)`: un "2026-08-04" se interpreta
// en UTC y en Argentina (UTC-3) se muestra corrido un dia.
function fmtFecha(iso) {
    const p = partesFecha(iso);
    if (!p) return iso;
    return `${String(p.dia).padStart(2, '0')}/${String(p.mes).padStart(2, '0')}/${p.anio}`;
}

function toggle() {
    abierto = !abierto;
    error = '';
    editando = false;
}

function cerrar() {
    abierto = false;
    editando = false;
}

// La edicion arranca con la fecha y el texto actuales del recordatorio
// cargados: lo normal es ajustar algo puntual, no escribir todo de cero.
function abrirEditar() {
    fecha = actual?.fecha ?? '';
    texto = actual?.texto ?? '';
    error = '';
    editando = true;
}

// Con `showPicker()` un click en cualquier parte del input (no solo el icono
// de calendario nativo) abre el selector: sin esto, clickear sobre los
// segmentos de dia/mes/anio en Chrome solo los deja listos para escribir a
// mano, sin mostrar el calendario. El try/catch es porque `showPicker` no
// existe en todos los navegadores (Safari/Firefox ya abren con cualquier
// click) y porque puede tirar si se llama mientras ya esta abierto.
function abrirCalendario(e) {
    try {
        e.currentTarget.showPicker?.();
    } catch {}
}

// Cierra al clickear afuera del chip/popover. Solo escucha mientras esta
// abierto: nada de un listener global permanente para algo que casi siempre
// esta cerrado.
$effect(() => {
    if (!abierto) return;
    function onClick(e) {
        if (wrapperEl && !wrapperEl.contains(e.target)) cerrar();
    }
    window.addEventListener('click', onClick, true);
    return () => window.removeEventListener('click', onClick, true);
});

async function agregar() {
    if (!fecha || !texto.trim()) return;
    guardando = true;
    error = '';
    try {
        await carteraStore.crearRecordatorio(cliente.id, fecha, texto.trim());
        fecha = '';
        texto = '';
        cerrar();
    } catch (e) {
        console.error(e);
        error = 'No se pudo guardar el recordatorio.';
    } finally {
        guardando = false;
    }
}

async function completar() {
    completando = true;
    error = '';
    try {
        await carteraStore.completarRecordatorio(actual);
        cerrar();
    } catch (e) {
        console.error(e);
        error = 'No se pudo marcar el recordatorio como listo.';
    } finally {
        completando = false;
    }
}

async function guardarEdicion() {
    if (!fecha || !texto.trim()) return;
    if (fecha === actual?.fecha && texto.trim() === actual?.texto) return;
    guardando = true;
    error = '';
    try {
        await carteraStore.editarRecordatorio(actual, fecha, texto.trim());
        cerrar();
    } catch (e) {
        console.error(e);
        error = 'No se pudieron guardar los cambios.';
    } finally {
        guardando = false;
    }
}

async function eliminar() {
    eliminando = true;
    error = '';
    try {
        await carteraStore.eliminarRecordatorio(actual);
        cerrar();
    } catch (e) {
        console.error(e);
        error = 'No se pudo eliminar el recordatorio.';
    } finally {
        eliminando = false;
    }
}
</script>

<!-- El keydown es solo para capturar Escape antes de que llegue al `svelte:window`
     del modal padre (ver `cerrar`); el div no representa ningun control propio,
     asi que no necesita un rol interactivo. -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class="recordatorio"
    bind:this={wrapperEl}
    onkeydown={(e) => { if (e.key === 'Escape') { cerrar(); e.stopPropagation(); } }}
>
    {#if actual}
        <button
            class="chip activo"
            class:hoy={estado === 'hoy'}
            class:vencido={estado === 'vencido'}
            onclick={toggle}
            aria-haspopup="true"
            aria-expanded={abierto}
            title={actual.texto}
        >
            <span class="etiqueta">{actual.texto} · {fmtCorta(actual.fecha)}</span>
            <span class="flecha" aria-hidden="true">
                <svg viewBox="0 0 10 6"><path d="M0 0h10L5 6z" /></svg>
            </span>
        </button>
    {:else}
        <button class="chip agregar" onclick={toggle} aria-haspopup="true" aria-expanded={abierto}>
            <span class="etiqueta">+ Recordatorio</span>
            <span class="flecha" aria-hidden="true">
                <svg viewBox="0 0 10 6"><path d="M0 0h10L5 6z" /></svg>
            </span>
        </button>
    {/if}

    {#if abierto}
        <div class="popover" role="dialog" aria-label="Recordatorio">
            {#if actual && editando}
                <form onsubmit={(e) => { e.preventDefault(); guardarEdicion(); }}>
                    <input
                        type="date"
                        bind:value={fecha}
                        disabled={guardando || eliminando}
                        onclick={abrirCalendario}
                        aria-label="Fecha del recordatorio"
                    />
                    <input
                        type="text"
                        bind:value={texto}
                        placeholder="Qué hay que hacer…"
                        disabled={guardando || eliminando}
                        aria-label="Texto del recordatorio"
                    />
                    {#if error}<p class="error">{error}</p>{/if}
                    <div class="acciones">
                        <button
                            type="submit"
                            class="hecho"
                            disabled={guardando || eliminando || !fecha || !texto.trim() || (fecha === actual.fecha && texto.trim() === actual.texto)}
                        >
                            {guardando ? 'Guardando…' : 'Guardar'}
                        </button>
                        <button type="button" class="secundario" onclick={() => (editando = false)} disabled={guardando || eliminando}>
                            Cancelar
                        </button>
                        <button type="button" class="eliminar" onclick={eliminar} disabled={guardando || eliminando}>
                            {eliminando ? 'Eliminando…' : 'Eliminar'}
                        </button>
                    </div>
                </form>
            {:else if actual}
                <p class="texto-completo">{actual.texto}</p>
                <p class="fecha-completa">{fmtFecha(actual.fecha)}</p>
                {#if error}<p class="error">{error}</p>{/if}
                <div class="acciones">
                    <button class="hecho" onclick={completar} disabled={completando}>
                        {completando ? 'Guardando…' : '✓ Listo'}
                    </button>
                    <button class="secundario" onclick={abrirEditar} disabled={completando}>
                        Editar
                    </button>
                </div>
            {:else}
                <form onsubmit={(e) => { e.preventDefault(); agregar(); }}>
                    <!-- Se admite una fecha pasada a proposito: el asesor puede estar
                         cargando algo que quedo pendiente de antes, y en ese caso el
                         chip se muestra vencido de inmediato, que es lo correcto. -->
                    <input
                        type="date"
                        bind:value={fecha}
                        disabled={guardando}
                        onclick={abrirCalendario}
                        aria-label="Fecha del recordatorio"
                    />
                    <input
                        type="text"
                        bind:value={texto}
                        placeholder="Qué hay que hacer…"
                        disabled={guardando}
                        aria-label="Texto del recordatorio"
                    />
                    {#if error}<p class="error">{error}</p>{/if}
                    <button type="submit" class="guardar" disabled={guardando || !fecha || !texto.trim()}>
                        {guardando ? 'Guardando…' : 'Guardar'}
                    </button>
                </form>
            {/if}
        </div>
    {/if}
</div>

<style>
.recordatorio { position: relative; display: inline-block; }
/* CTA del header, no un chip informativo: rectangulo redondeado como el resto
   de los botones del modal, no una pastilla. */
/* El padding vive en las dos mitades, no en el boton: asi el divisor llega de
   borde a borde en vez de quedar flotando con aire arriba y abajo. */
.chip {
    font-size: 0.85em; padding: 0; border-radius: 0.6em; font-weight: 600;
    border: 1.5px solid transparent; cursor: pointer; max-width: 13em; overflow: hidden;
    white-space: nowrap; display: inline-flex; align-items: stretch;
    font-family: inherit;
}
.etiqueta {
    padding: 0.45em 0.9em; overflow: hidden; text-overflow: ellipsis; min-width: 0;
}
/* Divisor derivado del color del texto: cada variante (agregar, activo,
   vencido) lo hereda sola, tambien en hover. */
.flecha {
    display: flex; align-items: center; padding: 0 0.55em;
    border-left: 1.5px solid color-mix(in srgb, currentColor 30%, transparent);
    flex: none;
}
.flecha svg { width: 0.6em; height: auto; fill: currentColor; display: block; }
.chip.agregar {
    background: #fff; color: var(--violeta2); border-color: #ddd0ea;
}
.chip.agregar:hover { background: var(--violeta2); color: #fff; border-color: var(--violeta2); }
.chip.activo { background: #d1fae5; color: #065f46; border-color: #a7e5c8; }
.chip.activo:hover { background: #b8f0da; }
/* Mismo semaforo de 3 colores que el chip de la lista (`.chip.rec-*` en
   Cartera.svelte): "hoy" es amber, "vencido" (ya paso) es rojo. Antes este
   chip solo distinguia dos estados y usaba amber para los dos, asi que un
   recordatorio de un dia anterior se veia rojo en la lista pero amber aca. */
.chip.activo.hoy { background: #fef3c7; color: #92400e; border-color: #fadf9a; }
.chip.activo.hoy:hover { background: #fde9ab; }
.chip.activo.vencido { background: #fee2e2; color: #991b1b; border-color: #fecaca; }
.chip.activo.vencido:hover { background: #fcd2d2; }
/* Anclado a la derecha: el chip vive arriba a la derecha del modal, asi que
   abrirlo hacia la izquierda es lo unico que lo deja adentro del panel. */
.popover {
    position: absolute; top: calc(100% + 0.4em); right: 0; z-index: 10;
    background: #fff; border: 1.5px solid #ececec; border-radius: 0.9em;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12); padding: 1em; width: 18em;
    text-align: left;
}
form { display: flex; flex-direction: column; gap: 0.6em; }
input {
    padding: 0.6em 0.9em; border: 2px solid #e5e7eb; border-radius: 0.7em;
    font-family: inherit; font-size: 0.95em; box-sizing: border-box; width: 100%;
}
input:focus { outline: none; border-color: var(--violeta2); }
.guardar, .hecho {
    background: var(--violeta2); color: #fff; border: 1.5px solid var(--violeta2);
    border-radius: 0.6em; padding: 0.5em 1em; font-weight: 600; cursor: pointer;
    font-size: 0.88em; font-family: inherit;
}
.guardar:hover:not(:disabled), .hecho:hover:not(:disabled) {
    background: color-mix(in srgb, var(--violeta2) 85%, #000);
}
.guardar:disabled, .hecho:disabled { opacity: 0.6; cursor: not-allowed; }
/* Cancelar (y, en edicion, Eliminar) acompañan a la accion principal, no
   compiten con ella. `wrap` porque en edicion son tres botones en un popover
   de 18em: sin esto se apretaban o desbordaban. */
.acciones { display: flex; align-items: center; gap: 0.5em; flex-wrap: wrap; }
.secundario {
    background: #fff; color: #6b7280; border: 1.5px solid #e5e7eb;
    border-radius: 0.6em; padding: 0.5em 1em; font-weight: 600; cursor: pointer;
    font-size: 0.88em; font-family: inherit;
}
.secundario:hover:not(:disabled) { border-color: #d1d5db; background: #f9fafb; color: #4b5563; }
.secundario:disabled { opacity: 0.6; cursor: not-allowed; }
/* Pegado al borde derecho, separado de Guardar/Cancelar: es la unica accion
   destructiva del popover y no deberia confundirse con las demas. */
.eliminar {
    margin-left: auto; background: #fff; color: #b91c1c; border: 1.5px solid #fecaca;
    border-radius: 0.6em; padding: 0.5em 1em; font-weight: 600; cursor: pointer;
    font-size: 0.88em; font-family: inherit;
}
.eliminar:hover:not(:disabled) { background: #fef2f2; border-color: #fca5a5; }
.eliminar:disabled { opacity: 0.6; cursor: not-allowed; }
.texto-completo { margin: 0 0 0.3em; color: #374151; }
.fecha-completa { margin: 0 0 0.8em; color: #9ca3af; font-size: 0.85em; }
.error { color: #dc2626; font-size: 0.85em; margin: 0; }
</style>
