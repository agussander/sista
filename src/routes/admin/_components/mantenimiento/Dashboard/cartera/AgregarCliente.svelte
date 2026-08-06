<!-- src/routes/admin/_components/mantenimiento/Dashboard/cartera/AgregarCliente.svelte -->
<script>
// Alta en dos pasos: primero se valida el numero contra IspCube y se muestra
// el nombre para que el asesor confirme que es quien cree.
//
// Ya no se pide la fecha de instalacion: se completa sola cuando el ticket de
// "alta reserva de NAP" cierra (ver carteraStore.agregar y el spec del
// 2026-08-06). Antes se pedia a mano porque `start_date` de IspCube no sirve
// para esto -no es la fecha de instalacion real-, pero ahora hay una fuente
// mejor que tipearla: el cierre del ticket.
import { carteraStore } from './carteraStore.svelte.js';

let { onCerrar } = $props();

let code = $state('');
let guardando = $state(false);
let error = $state('');

async function guardar() {
    error = '';
    guardando = true;
    const r = await carteraStore.agregar(code.trim());
    guardando = false;

    if (r.ok) onCerrar();
    else error = r.error;
}
</script>

<!--
    Escape en `svelte:window`: ver el comentario en ClienteDetalle.svelte. El
    onkeydown que vivia en `.fondo` nunca disparaba porque el foco esta siempre
    dentro de `.modal`, que cortaba la burbuja con su propio stopPropagation.
-->
<svelte:window onkeydown={(e) => e.key === 'Escape' && onCerrar()} />

<!--
    El cierre por teclado ya existe (Escape arriba, mas el boton "Cancelar");
    este backdrop solo suma el cierre por click como comodidad para mouse, asi
    que no necesita su propio par de teclado.
-->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
    class="fondo"
    role="presentation"
    onclick={onCerrar}
>
    <div
        class="modal"
        role="dialog"
        aria-label="Agregar cliente"
        tabindex="-1"
        onclick={(e) => e.stopPropagation()}
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
    display: flex; align-items: center; justify-content: center; padding: 1.5em; z-index: 1100;
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
