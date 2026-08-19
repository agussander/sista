<script>
// Seccion Novedades del panel. Ya estaba declarada en `panelSecciones.js` y en
// `adminPermisos.js`, y `Content.svelte` ya la renderiza: este archivo existia
// vacio.
import { onMount } from 'svelte';
import Spinner from '$lib/components/ui/Spinner.svelte';
import { formatFecha } from '$lib/novedades.js';
import { novedadesAdmin } from './novedadesAdmin.svelte.js';
import NovedadForm from './NovedadForm.svelte';

// null = viendo la lista | 'nueva' = alta | un record = edicion
let editando = $state(null);
let confirmandoBorrado = $state(null);

onMount(() => {
    novedadesAdmin.cargar();
});

async function guardar(datos) {
    const ok = editando === 'nueva'
        ? await novedadesAdmin.crear(datos)
        : await novedadesAdmin.actualizar(editando.id, datos);

    // Si fallo, el formulario sigue abierto con lo que la persona escribio:
    // cerrarlo le perderia el texto.
    if (ok) editando = null;
}

async function eliminar(novedad) {
    const ok = await novedadesAdmin.eliminar(novedad.id);
    if (ok) confirmandoBorrado = null;
}

// El error de una escritura fallida no tiene por que seguir a la vista
// siguiente: sin esto, un slug duplicado al guardar quedaba pegado a la lista
// despues de cancelar, y de ahi a cualquier formulario nuevo que se abriera.
// `errorCarga` no se toca: ese describe el estado de la lista y solo lo
// resuelve volver a cargarla.
function abrirNueva() {
    novedadesAdmin.limpiarError();
    editando = 'nueva';
}

function abrirEditar(novedad) {
    novedadesAdmin.limpiarError();
    editando = novedad;
}

function cerrarForm() {
    novedadesAdmin.limpiarError();
    editando = null;
}
</script>

<div class="cont">
    {#if editando}
        <NovedadForm
            novedad={editando === 'nueva' ? null : editando}
            onGuardar={guardar}
            onCancelar={cerrarForm}
        ></NovedadForm>
    {:else}
        <div class="header">
            <div>
                <h1>Novedades</h1>
                <p>Las novedades que se ven en el sitio y en el inicio</p>
            </div>
            <button class="btn-nueva" onclick={abrirNueva}>Nueva novedad</button>
        </div>

        <!-- El error de escritura (borrar una fila, por ejemplo) va arriba de
             la lista; el de carga va en el lugar de la lista, mas abajo. -->
        {#if novedadesAdmin.error}
            <p class="error">{novedadesAdmin.error}</p>
        {/if}

        {#if novedadesAdmin.cargando}
            <div class="centro"><Spinner label="Cargando novedades..."></Spinner></div>
        {:else if novedadesAdmin.errorCarga}
            <!-- No alcanza con "no hay novedades": si la carga fallo, la lista
                 esta vacia porque no pudimos traerla, no porque no haya nada. -->
            <div class="vacio">
                <p>{novedadesAdmin.errorCarga}</p>
                <button class="reintentar" onclick={() => novedadesAdmin.cargar()}>Reintentar</button>
            </div>
        {:else if novedadesAdmin.novedades.length === 0}
            <div class="vacio">
                <p>Todavía no cargaste ninguna novedad.</p>
            </div>
        {:else}
            <ul class="lista">
                {#each novedadesAdmin.novedades as novedad (novedad.id)}
                    <li class="fila">
                        {#if novedadesAdmin.urlImagen(novedad)}
                            <img src={novedadesAdmin.urlImagen(novedad)} alt="">
                        {:else}
                            <div class="sin-img">Sin foto</div>
                        {/if}

                        <div class="datos">
                            <strong>{novedad.titulo}</strong>
                            <span class="fecha">{formatFecha(novedad.fecha)}</span>
                            <div class="chips">
                                {#if novedad.publicada}
                                    <span class="chip publicada">Publicada</span>
                                {:else}
                                    <span class="chip borrador">Borrador</span>
                                {/if}
                                {#if novedad.destacada}<span class="chip destacada">Destacada</span>{/if}
                            </div>
                        </div>

                        <div class="acciones">
                            {#if confirmandoBorrado === novedad.id}
                                <span class="confirmar">¿Seguro?</span>
                                <button class="btn-borrar" onclick={() => eliminar(novedad)} disabled={novedadesAdmin.guardando}>
                                    {novedadesAdmin.guardando ? 'Borrando…' : 'Sí, borrar'}
                                </button>
                                <button class="btn-sec" onclick={() => (confirmandoBorrado = null)} disabled={novedadesAdmin.guardando}>No</button>
                            {:else}
                                <button class="btn-sec" onclick={() => abrirEditar(novedad)}>Editar</button>
                                <button class="btn-borrar" onclick={() => (confirmandoBorrado = novedad.id)}>
                                    Eliminar
                                </button>
                            {/if}
                        </div>
                    </li>
                {/each}
            </ul>
        {/if}
    {/if}
</div>

<style>
.cont {
    padding: 2em;
}

.header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1em;
    flex-wrap: wrap;
    margin-bottom: 2em;
}

h1 {
    color: #333;
    margin: 0 0 0.3em;
    font-size: 2em;
}

.header p {
    color: #666;
    margin: 0;
}

.btn-nueva {
    background: var(--violeta1);
    color: white;
    border: none;
    padding: 0.8em 1.5em;
    border-radius: 0.4em;
    font-size: 0.95em;
    font-weight: 600;
    cursor: pointer;
}

.btn-nueva:hover {
    background: var(--violeta2);
}

.centro {
    padding: 3em;
    display: grid;
    place-items: center;
}

.vacio {
    color: #6b7280;
    padding: 2em 0;
    display: flex;
    flex-flow: column;
    align-items: flex-start;
    gap: 0.8em;
}

.vacio p {
    margin: 0;
}

.reintentar {
    background: white;
    border: 1.5px solid #e0e0e0;
    color: var(--violeta2);
    border-radius: 2em;
    padding: 0.5em 1.2em;
    font-size: 0.92em;
    font-weight: 600;
    cursor: pointer;
}

.error {
    color: #b91c1c;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 0.4em;
    padding: 0.8em 1em;
}

.lista {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-flow: column;
    gap: 0.8em;
}

.fila {
    display: flex;
    align-items: center;
    gap: 1.2em;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.6em;
    padding: 1em;
    flex-wrap: wrap;
}

.fila img,
.sin-img {
    width: 7em;
    height: 4.6em;
    border-radius: 0.4em;
    object-fit: cover;
    flex-shrink: 0;
}

.sin-img {
    background: #f3f4f6;
    color: #9ca3af;
    font-size: 0.75em;
    display: grid;
    place-items: center;
}

.datos {
    display: flex;
    flex-flow: column;
    gap: 0.35em;
    flex: 1;
    min-width: 12em;
}

.datos strong {
    color: var(--violeta1);
}

.fecha {
    font-size: 0.85em;
    color: #6b7280;
}

.chips {
    display: flex;
    gap: 0.4em;
    flex-wrap: wrap;
}

.chip {
    font-size: 0.75em;
    font-weight: 600;
    padding: 0.2em 0.6em;
    border-radius: 1em;
}

.publicada {
    background: #dcfce7;
    color: #166534;
}

.borrador {
    background: #f3f4f6;
    color: #4b5563;
}

.destacada {
    background: #fef3c7;
    color: #92400e;
}

.acciones {
    display: flex;
    gap: 0.5em;
    align-items: center;
}

.confirmar {
    font-size: 0.85em;
    color: #b91c1c;
    font-weight: 600;
}

.acciones button {
    padding: 0.5em 1em;
    border: none;
    border-radius: 0.4em;
    font-size: 0.85em;
    font-weight: 600;
    cursor: pointer;
}

.acciones button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.btn-sec {
    background: #e5e7eb;
    color: #374151;
}

.btn-borrar {
    background: #dc2626;
    color: white;
}
</style>
