<!-- src/routes/admin/_components/mantenimiento/Dashboard/cartera/AnotacionesCliente.svelte -->
<script>
// Bitacora del cliente: el formulario para dejar una anotacion y la lista de
// las que ya hay. Vive aparte de ClienteDetalle porque su estado (carga de
// notas, guardado, error) no tiene nada que ver con el snapshot de IspCube que
// muestra el resto del panel.
import Spinner from '$lib/components/ui/Spinner.svelte';
import { carteraStore } from './carteraStore.svelte.js';

let { cliente } = $props();

let notas = $state([]);
let cargando = $state(true);
// Sin tipo por defecto: es una etiqueta opcional, y preseleccionar uno hacia
// que el asesor guardara notas categorizadas sin haberlo decidido.
let tipo = $state('');
let texto = $state('');
let guardando = $state(false);
let error = $state('');

const TIPOS = [
    { value: 'llamada', label: 'Llamada' },
    { value: 'whatsapp', label: 'WhatsApp' },
    { value: 'visita', label: 'Visita' },
    { value: 'nota', label: 'Nota interna' }
];

async function cargar() {
    cargando = true;
    try {
        notas = await carteraStore.notasDe(cliente.id);
    } catch (e) {
        console.error(e);
        error = 'No se pudieron cargar las anotaciones.';
    } finally {
        cargando = false;
    }
}

async function guardar() {
    if (!texto.trim()) return;
    guardando = true;
    error = '';
    try {
        // Sin `cargar()` explicito: `agregarNota` incrementa `notasVersion` y de
        // la recarga se encarga el efecto de abajo, igual que cuando la nota la
        // escribe el chip de recordatorio.
        await carteraStore.agregarNota(cliente.id, tipo, texto.trim());
        texto = '';
    } catch (e) {
        console.error(e);
        error = 'No se pudo guardar la anotación.';
    } finally {
        guardando = false;
    }
}

const fmt = (iso) => (iso ? new Date(iso).toLocaleDateString('es-AR') : '—');

// Carga inicial y recarga ante cada anotacion nueva, venga de este formulario o
// del chip de recordatorio (que escribe las anotaciones automaticas). Leer
// `notasVersion` aca es lo que suscribe el efecto.
$effect(() => {
    carteraStore.notasVersion;
    cargar();
});
</script>

<section class="bloque">
    <h4>Anotaciones</h4>

    <form onsubmit={(e) => { e.preventDefault(); guardar(); }}>
        <!-- El campo es una sola caja: el textarea pierde su borde y lo pone
             `.campo`, para que los chips de medio de contacto y el boton de
             guardar vivan adentro del mismo recuadro en vez de flotar sueltos
             arriba y abajo. El foco del textarea lo marca `:focus-within`. -->
        <div class="campo">
            <textarea
                bind:value={texto}
                placeholder="Qué hablaron, qué quedó pendiente…"
                rows="3"
                disabled={guardando}
            ></textarea>
            <div class="barra">
                <!-- `aria-pressed` y no un grupo de radios: son toggles de verdad -que
                     el activo se pueda apagar es justamente el punto- y ninguno viene
                     elegido. Sin esto, cual esta activo se cuenta solo por color. -->
                <div class="tipos">
                    {#each TIPOS as t}
                        <button
                            type="button"
                            aria-pressed={tipo === t.value}
                            class:activo={tipo === t.value}
                            disabled={guardando}
                            onclick={() => (tipo = tipo === t.value ? '' : t.value)}
                        >{t.label}</button>
                    {/each}
                </div>
                <button type="submit" class="guardar" disabled={guardando || !texto.trim()}>
                    {guardando ? 'Guardando…' : 'Guardar'}
                </button>
            </div>
        </div>
    </form>

    {#if error}<p class="error">{error}</p>{/if}

    {#if cargando}
        <Spinner />
    {:else if notas.length === 0}
        <p class="vacio">Todavía no hay anotaciones.</p>
    {:else}
        <ul class="bitacora">
            {#each notas as n (n.id)}
                <li>
                    <div class="meta">
                        {#if n.tipo}
                            <span class="tipo {n.tipo}">{TIPOS.find((t) => t.value === n.tipo)?.label ?? n.tipo}</span>
                        {/if}
                        <span class="cuando">{fmt(n.created)}</span>
                    </div>
                    <p>{n.texto}</p>
                </li>
            {/each}
        </ul>
    {/if}
</section>

<style>
.bloque { border-top: 1px solid #ececec; padding-top: 1.5em; margin-top: 1.5em; }
h4 { margin: 0 0 1em; color: var(--violeta2); font-size: 1.05em; }
.campo {
    border: 2px solid #e5e7eb; border-radius: 0.8em; background: #fff;
    padding: 0.2em 0.2em 0.4em;
}
.campo:focus-within { border-color: var(--violeta2); }
textarea {
    display: block; width: 100%; padding: 0.7em 0.8em 0.2em; border: none;
    background: transparent; font-family: inherit; font-size: 1em;
    box-sizing: border-box; resize: vertical;
}
textarea:focus { outline: none; }
/* Los chips a la izquierda y el guardar pegado a la derecha, en la misma fila
   del pie del campo. */
.barra {
    display: flex; align-items: center; gap: 0.6em; flex-wrap: wrap;
    padding: 0 0.5em; margin-top: 0.2em;
}
.tipos { display: flex; gap: 0.35em; flex-wrap: wrap; }
.tipos button {
    border: 1.5px solid #e5e7eb; background: #fff; color: #6b7280;
    border-radius: 0.5em; padding: 0.3em 0.7em; cursor: pointer;
    font-size: 0.78em; font-weight: 600; font-family: inherit;
}
.tipos button:hover:not(:disabled) { border-color: #d1d5db; background: #f9fafb; color: #4b5563; }
.tipos button.activo { background: var(--violeta2); color: #fff; border-color: var(--violeta2); }
.tipos button:disabled { opacity: 0.6; cursor: not-allowed; }
.guardar {
    margin-left: auto; background: var(--violeta2); color: #fff; border: none;
    border-radius: 0.5em; padding: 0.45em 1em; font-weight: 600; cursor: pointer;
    font-size: 0.85em; font-family: inherit;
}
.guardar:hover:not(:disabled) { background: color-mix(in srgb, var(--violeta2) 85%, #000); }
.guardar:disabled { opacity: 0.5; cursor: not-allowed; }
.bitacora { list-style: none; padding: 0; margin: 1.5em 0 0; display: flex; flex-direction: column; gap: 0.8em; }
.bitacora li { background: #faf8fd; border-radius: 0.8em; padding: 0.9em 1.1em; }
.meta { display: flex; gap: 0.8em; align-items: center; margin-bottom: 0.4em; }
.tipo { font-size: 0.75em; padding: 0.2em 0.7em; border-radius: 1em; background: #ede7f6; color: #5a1e7a; }
.tipo.nota { background: #f3f4f6; color: #6b7280; }
.cuando { color: #9ca3af; font-size: 0.8em; }
.bitacora p { margin: 0; color: #374151; }
.vacio { color: #9ca3af; }
.error { color: #dc2626; font-size: 0.92em; }
</style>
