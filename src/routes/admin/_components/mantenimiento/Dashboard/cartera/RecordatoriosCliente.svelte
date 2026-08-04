<!-- src/routes/admin/_components/mantenimiento/Dashboard/cartera/RecordatoriosCliente.svelte -->
<script>
// Recordatorios del cliente: lo que el asesor se anota para hacer en una fecha.
// Va antes de las anotaciones a proposito: los recordatorios miran al futuro,
// la bitacora al pasado.
import { carteraStore } from './carteraStore.svelte.js';
import { partesFecha, compararFechas } from '$lib/cartera/fechas.js';

let { cliente } = $props();

let fecha = $state('');
let texto = $state('');
let guardando = $state(false);
let error = $state('');
// Id del recordatorio que se esta completando ahora mismo, para deshabilitar
// solo su boton y no los de los demas.
let completando = $state('');

const pendientes = $derived(carteraStore.recordatoriosDe(cliente.id));

function hoyPartes() {
    const d = new Date();
    return { anio: d.getFullYear(), mes: d.getMonth() + 1, dia: d.getDate() };
}

function vencido(r) {
    const p = partesFecha(r.fecha);
    return !!p && compararFechas(hoyPartes(), p) >= 0;
}

// Formateo por partes, sin `new Date(iso)`: un "2026-08-04" pasado por Date se
// interpreta en UTC y en Argentina (UTC-3) se muestra como el 3.
function fmtFecha(iso) {
    const p = partesFecha(iso);
    if (!p) return iso;
    return `${String(p.dia).padStart(2, '0')}/${String(p.mes).padStart(2, '0')}/${p.anio}`;
}

async function agregar() {
    if (!fecha || !texto.trim()) return;
    guardando = true;
    error = '';
    try {
        await carteraStore.crearRecordatorio(cliente.id, fecha, texto.trim());
        fecha = '';
        texto = '';
    } catch (e) {
        console.error(e);
        error = 'No se pudo guardar el recordatorio.';
    } finally {
        guardando = false;
    }
}

async function completar(r) {
    completando = r.id;
    error = '';
    try {
        await carteraStore.completarRecordatorio(r);
    } catch (e) {
        console.error(e);
        error = 'No se pudo marcar el recordatorio como hecho.';
    } finally {
        completando = '';
    }
}
</script>

<section class="bloque">
    <h4>Recordatorios</h4>

    <form onsubmit={(e) => { e.preventDefault(); agregar(); }}>
        <div class="campos">
            <!-- Se admite una fecha pasada a proposito: el asesor puede estar
                 cargando algo que quedo pendiente de antes, y en ese caso la
                 alerta se enciende de inmediato, que es lo correcto. -->
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
        </div>
        <button type="submit" class="guardar" disabled={guardando || !fecha || !texto.trim()}>
            {guardando ? 'Guardando…' : 'Agregar recordatorio'}
        </button>
    </form>

    {#if error}<p class="error">{error}</p>{/if}

    {#if pendientes.length === 0}
        <p class="vacio">Sin recordatorios pendientes.</p>
    {:else}
        <ul class="lista">
            {#each pendientes as r (r.id)}
                <li class:vencido={vencido(r)}>
                    <div class="que">
                        <span class="cuando">{fmtFecha(r.fecha)}</span>
                        <span class="texto">{r.texto}</span>
                    </div>
                    <button class="hecho" onclick={() => completar(r)} disabled={completando === r.id}>
                        {completando === r.id ? '…' : 'Hecho'}
                    </button>
                </li>
            {/each}
        </ul>
    {/if}
</section>

<style>
.bloque { border-top: 1px solid #ececec; padding-top: 1.5em; margin-top: 1.5em; }
h4 { margin: 0 0 1em; color: var(--violeta2); font-size: 1.05em; }
.campos { display: flex; flex-wrap: wrap; gap: 0.6em; }
input {
    padding: 0.7em 1em; border: 2px solid #e5e7eb; border-radius: 0.8em;
    font-family: inherit; font-size: 1em; box-sizing: border-box;
}
input[type='date'] { flex: 0 0 auto; }
input[type='text'] { flex: 1 1 14em; min-width: 0; }
input:focus { outline: none; border-color: var(--violeta2); }
.guardar {
    background: var(--violeta2); color: #fff; border: none; border-radius: 2em;
    padding: 0.7em 1.4em; font-weight: 600; cursor: pointer; margin-top: 0.8em;
}
.guardar:disabled { opacity: 0.6; cursor: not-allowed; }
.lista { list-style: none; padding: 0; margin: 1.2em 0 0; display: flex; flex-direction: column; gap: 0.6em; }
.lista li {
    display: flex; align-items: center; justify-content: space-between; gap: 1em;
    background: #faf8fd; border-radius: 0.8em; padding: 0.8em 1.1em;
    border-left: 4px solid transparent;
}
/* Mismo amber que las alertas de mora: un pendiente vencido es urgente, no un
   error del sistema. */
.lista li.vencido { border-left-color: #f0c674; background: #fffbeb; }
.que { display: flex; flex-direction: column; gap: 0.15em; min-width: 0; }
.cuando { color: #9ca3af; font-size: 0.8em; }
.texto { color: #374151; }
.hecho {
    background: #fff; border: 1.5px solid #e0e0e0; color: var(--violeta2);
    border-radius: 2em; padding: 0.4em 1em; cursor: pointer; font-size: 0.88em;
    flex-shrink: 0;
}
.hecho:disabled { opacity: 0.6; cursor: not-allowed; }
.vacio { color: #9ca3af; }
.error { color: #dc2626; font-size: 0.92em; }
</style>
