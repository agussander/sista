<!-- src/routes/admin/_components/mantenimiento/Dashboard/cartera/RecordatorioChip.svelte -->
<script>
// Recordatorio del cliente: lo que el asesor se anota para hacer en una fecha.
// Un solo chip arriba del detalle en vez de una seccion propia: "+ Recordatorio"
// si no hay ninguno pendiente, o "{accion} {fecha}" si lo hay. Un cliente tiene
// como mucho un recordatorio pendiente a la vez -el chip de agregar no aparece
// si ya hay uno cargado-, asi que no hace falta una lista.
import { carteraStore } from './carteraStore.svelte.js';
import { partesFecha, compararFechas } from '$lib/cartera/fechas.js';

let { cliente } = $props();

const actual = $derived(carteraStore.recordatoriosDe(cliente.id)[0] ?? null);

let abierto = $state(false);
let wrapperEl = $state(null);

let fecha = $state('');
let texto = $state('');
let guardando = $state(false);
let completando = $state(false);
let error = $state('');

function hoyPartes() {
    const d = new Date();
    return { anio: d.getFullYear(), mes: d.getMonth() + 1, dia: d.getDate() };
}

function vencido(r) {
    const p = partesFecha(r.fecha);
    return !!p && compararFechas(hoyPartes(), p) >= 0;
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
}

function cerrar() {
    abierto = false;
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
        error = 'No se pudo marcar el recordatorio como hecho.';
    } finally {
        completando = false;
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
            class:vencido={vencido(actual)}
            onclick={toggle}
            aria-haspopup="true"
            aria-expanded={abierto}
            title={actual.texto}
        >
            {actual.texto} · {fmtCorta(actual.fecha)}
        </button>
    {:else}
        <button class="chip agregar" onclick={toggle} aria-haspopup="true" aria-expanded={abierto}>
            + Recordatorio
        </button>
    {/if}

    {#if abierto}
        <div class="popover" role="dialog" aria-label="Recordatorio">
            {#if actual}
                <p class="texto-completo">{actual.texto}</p>
                <p class="fecha-completa">{fmtFecha(actual.fecha)}</p>
                {#if error}<p class="error">{error}</p>{/if}
                <button class="hecho" onclick={completar} disabled={completando}>
                    {completando ? 'Guardando…' : 'Marcar hecho'}
                </button>
            {:else}
                <form onsubmit={(e) => { e.preventDefault(); agregar(); }}>
                    <!-- Se admite una fecha pasada a proposito: el asesor puede estar
                         cargando algo que quedo pendiente de antes, y en ese caso el
                         chip se muestra vencido de inmediato, que es lo correcto. -->
                    <input
                        type="date"
                        bind:value={fecha}
                        disabled={guardando}
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
.recordatorio { position: relative; display: inline-block; margin-top: 0.5em; }
.chip {
    font-size: 0.85em; padding: 0.4em 0.9em; border-radius: 1em; font-weight: 600;
    border: none; cursor: pointer; max-width: 16em; overflow: hidden;
    text-overflow: ellipsis; white-space: nowrap; display: inline-block;
}
.chip.agregar {
    background: #fff; color: var(--violeta2); border: 1.5px dashed #d1c4e9;
}
.chip.agregar:hover { background: #f5f2fa; }
.chip.activo { background: #d1fae5; color: #065f46; }
/* Mismo amber que las alertas de mora: un pendiente vencido es urgente, no un
   error del sistema. */
.chip.activo.vencido { background: #fef3c7; color: #92400e; }
.popover {
    position: absolute; top: calc(100% + 0.4em); left: 0; z-index: 10;
    background: #fff; border: 1.5px solid #ececec; border-radius: 0.9em;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12); padding: 1em; width: 18em;
}
form { display: flex; flex-direction: column; gap: 0.6em; }
input {
    padding: 0.6em 0.9em; border: 2px solid #e5e7eb; border-radius: 0.7em;
    font-family: inherit; font-size: 0.95em; box-sizing: border-box; width: 100%;
}
input:focus { outline: none; border-color: var(--violeta2); }
.guardar, .hecho {
    background: var(--violeta2); color: #fff; border: none; border-radius: 2em;
    padding: 0.6em 1.2em; font-weight: 600; cursor: pointer; font-size: 0.92em;
}
.guardar:disabled, .hecho:disabled { opacity: 0.6; cursor: not-allowed; }
.texto-completo { margin: 0 0 0.3em; color: #374151; }
.fecha-completa { margin: 0 0 0.8em; color: #9ca3af; font-size: 0.85em; }
.error { color: #dc2626; font-size: 0.85em; margin: 0; }
</style>
