<!-- src/routes/admin/_components/mantenimiento/Dashboard/cartera/AnotacionesCliente.svelte -->
<script>
// Bitacora del cliente: el formulario para dejar una anotacion y la lista de
// las que ya hay. Vive aparte de ClienteDetalle porque su estado (carga de
// notas, guardado, error) no tiene nada que ver con el snapshot de IspCube que
// muestra el resto del panel.
import { onMount } from 'svelte';
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
        await carteraStore.agregarNota(cliente.id, tipo, texto.trim());
        texto = '';
        await cargar();
    } catch (e) {
        console.error(e);
        error = 'No se pudo guardar la anotación.';
    } finally {
        guardando = false;
    }
}

const fmt = (iso) => (iso ? new Date(iso).toLocaleDateString('es-AR') : '—');

onMount(cargar);
</script>

<section class="bloque">
    <h4>Anotaciones</h4>

    <form onsubmit={(e) => { e.preventDefault(); guardar(); }}>
        <div class="tipos">
            {#each TIPOS as t}
                <button
                    type="button"
                    class:activo={tipo === t.value}
                    onclick={() => (tipo = tipo === t.value ? '' : t.value)}
                >{t.label}</button>
            {/each}
        </div>
        <textarea
            bind:value={texto}
            placeholder="Qué hablaron, qué quedó pendiente…"
            rows="3"
            disabled={guardando}
        ></textarea>
        <button type="submit" class="guardar" disabled={guardando || !texto.trim()}>
            {guardando ? 'Guardando…' : 'Guardar anotación'}
        </button>
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
.tipos { display: flex; gap: 0.4em; flex-wrap: wrap; margin-bottom: 0.8em; }
.tipos button {
    border: 1.5px solid #e0e0e0; background: #fff; color: var(--violeta2);
    border-radius: 2em; padding: 0.4em 1em; cursor: pointer; font-size: 0.9em;
}
.tipos button.activo { background: var(--violeta2); color: #fff; border-color: var(--violeta2); }
textarea {
    width: 100%; padding: 0.8em 1em; border: 2px solid #e5e7eb; border-radius: 0.8em;
    font-family: inherit; font-size: 1em; box-sizing: border-box; resize: vertical;
}
textarea:focus { outline: none; border-color: var(--violeta2); }
.guardar {
    background: var(--violeta2); color: #fff; border: none; border-radius: 2em;
    padding: 0.7em 1.4em; font-weight: 600; cursor: pointer; margin-top: 0.8em;
}
.guardar:disabled { opacity: 0.6; cursor: not-allowed; }
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
