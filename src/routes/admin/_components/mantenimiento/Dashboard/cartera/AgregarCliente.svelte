<!-- src/routes/admin/_components/mantenimiento/Dashboard/cartera/AgregarCliente.svelte -->
<script>
// Alta en dos pasos: primero se valida el numero contra IspCube y se muestra el
// nombre para que el asesor confirme que es quien cree, y recien despues se
// pide la fecha de instalacion.
//
// La fecha la carga el asesor y no sale de IspCube a proposito: en IspCube las
// altas se cargan desde el principio del mes siguiente, asi que su `start_date`
// es casi siempre el dia 1 y no sirve para agendar el llamado de los 2 meses.
import { carteraStore } from './carteraStore.svelte.js';

let { onCerrar } = $props();

// `hoyISO` no sale del store (es privado ahi, y no depende de datos de
// IspCube): se calcula aca nomas, en hora local, para no repetir el bug de
// `toISOString` (que es UTC y puede correr el dia).
function hoyISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

let code = $state('');
let fecha = $state(hoyISO());
let guardando = $state(false);
let error = $state('');

async function guardar() {
    error = '';
    guardando = true;
    const r = await carteraStore.agregar(code.trim(), fecha);
    guardando = false;

    if (r.ok) onCerrar();
    else error = r.error;
}
</script>

<div
    class="fondo"
    role="presentation"
    onclick={onCerrar}
    onkeydown={(e) => e.key === 'Escape' && onCerrar()}
>
    <div
        class="modal"
        role="dialog"
        aria-label="Agregar cliente"
        tabindex="-1"
        onclick={(e) => e.stopPropagation()}
        onkeydown={(e) => e.stopPropagation()}
    >
        <h3>Agregar cliente</h3>

        <form onsubmit={(e) => { e.preventDefault(); guardar(); }}>
            <label for="code">Número de cliente</label>
            <input
                id="code"
                bind:value={code}
                placeholder="003566"
                inputmode="numeric"
                disabled={guardando}
            />
            <p class="ayuda">Con los ceros adelante, tal como figura en IspCube.</p>

            <label for="fecha">Fecha de instalación</label>
            <input id="fecha" type="date" bind:value={fecha} disabled={guardando} />
            <p class="ayuda">
                Desde acá se cuentan los dos meses para el llamado de seguimiento. No uses la fecha de
                alta de IspCube: ahí todas caen el día 1.
            </p>

            {#if error}<p class="error">{error}</p>{/if}

            <div class="acciones">
                <button type="button" class="cancelar" onclick={onCerrar} disabled={guardando}>
                    Cancelar
                </button>
                <button type="submit" class="confirmar" disabled={guardando || !code.trim()}>
                    {guardando ? 'Buscando…' : 'Agregar'}
                </button>
            </div>
        </form>
    </div>
</div>

<style>
.fondo {
    position: fixed; inset: 0; background: rgba(0, 0, 0, 0.45);
    display: flex; align-items: center; justify-content: center; padding: 1.5em; z-index: 50;
}
.modal {
    background: #fff; border-radius: 1.2em; padding: 2em; width: 100%; max-width: 26em;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}
h3 { margin: 0 0 1.2em; color: var(--violeta2); }
label { display: block; font-weight: 600; color: #374151; margin-bottom: 0.5em; }
input {
    width: 100%; padding: 0.8em 1em; border: 2px solid #e5e7eb; border-radius: 0.8em;
    font-size: 1em; box-sizing: border-box; font-family: inherit;
}
input:focus { outline: none; border-color: var(--violeta2); }
.ayuda { color: #6b7280; font-size: 0.85em; margin: 0.4em 0 1.4em; }
.error { color: #dc2626; font-size: 0.92em; margin: 0 0 1em; }
.acciones { display: flex; gap: 0.8em; justify-content: flex-end; }
.acciones button {
    border-radius: 2em; padding: 0.7em 1.4em; font-size: 1em; cursor: pointer; border: none;
}
.cancelar { background: #fff; border: 1.5px solid #e0e0e0; color: var(--violeta2); }
.confirmar { background: var(--violeta2); color: #fff; font-weight: 600; }
.confirmar:disabled, .cancelar:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
