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

async function eliminar() {
    const ok = await novedadesAdmin.eliminar(editando.id);
    if (ok) editando = null;
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
            onEliminar={eliminar}
            onCancelar={cerrarForm}
        ></NovedadForm>
    {:else}
        <div class="header">
            <h1>Novedades</h1>
            <p>Las novedades que se ven en el sitio y en el inicio</p>
        </div>

        <!-- El error de escritura (borrar una fila, por ejemplo) va arriba de
             la grilla; el de carga va en el lugar de la grilla, mas abajo. -->
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
        {:else}
            <div class="grilla">
                <button class="tarjeta tarjeta-nueva" onclick={abrirNueva}>
                    <span class="mas" aria-hidden="true">+</span>
                    <span>Nueva novedad</span>
                </button>

                {#each novedadesAdmin.novedades as novedad (novedad.id)}
                    <div class="tarjeta">
                        {#if novedadesAdmin.urlImagen(novedad, '600x400')}
                            <img class="img" src={novedadesAdmin.urlImagen(novedad, '600x400')} alt="">
                        {:else}
                            <div class="img sin-img">Sin foto</div>
                        {/if}

                        <div class="cuerpo">
                            {#if !novedad.publicada || novedad.destacada}
                                <div class="chips">
                                    {#if !novedad.publicada}<span class="chip borrador">Borrador</span>{/if}
                                    {#if novedad.destacada}<span class="chip destacada">Destacada</span>{/if}
                                </div>
                            {/if}
                            <span class="fecha">{formatFecha(novedad.fecha)}</span>
                            <strong class="titulo">{novedad.titulo}</strong>
                            {#if novedad.bajada}<p class="bajada">{novedad.bajada}</p>{/if}
                            <button class="btn-editar" onclick={() => abrirEditar(novedad)}>Editar</button>
                        </div>
                    </div>
                {/each}
            </div>

            {#if novedadesAdmin.novedades.length === 0}
                <p class="sin-novedades">Todavía no cargaste ninguna novedad.</p>
            {/if}
        {/if}
    {/if}
</div>

<style>
.cont {
    padding: 2em;
}

.header {
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

.sin-novedades {
    color: #6b7280;
    margin: 1.5em 0 0;
}

.grilla {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5em;
}

@media (min-width: 40em) {
    .grilla {
        grid-template-columns: repeat(2, 1fr);
    }
}

@media (min-width: 62em) {
    .grilla {
        grid-template-columns: repeat(3, 1fr);
    }
}

.tarjeta {
    display: flex;
    flex-flow: column;
    background: white;
    border-radius: 0.6em;
    overflow: hidden;
    box-shadow: 0 0 0.5em rgba(133, 133, 133, 0.4);
    height: 100%;
}

.img,
.sin-img {
    height: 11em;
    width: 100%;
    flex-shrink: 0;
    object-fit: cover;
}

.sin-img {
    background: #f3f4f6;
    color: #9ca3af;
    font-size: 0.85em;
    display: grid;
    place-items: center;
}

.cuerpo {
    padding: 1.2em 1.1em;
    display: flex;
    flex-flow: column;
    gap: 0.4em;
    flex: 1;
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

.borrador {
    background: #f3f4f6;
    color: #4b5563;
}

.destacada {
    background: #fef3c7;
    color: #92400e;
}

.fecha {
    font-size: 0.8em;
    color: #6b7280;
}

.titulo {
    color: var(--violeta1);
    font-size: 1.05em;
    line-height: 1.3;
}

.bajada {
    margin: 0;
    font-size: 0.9em;
    line-height: 1.5;
    color: #444;
    flex: 1;
}

.btn-editar {
    align-self: flex-start;
    margin-top: 0.4em;
    background: #e5e7eb;
    color: #374151;
    border: none;
    padding: 0.5em 1.2em;
    border-radius: 0.4em;
    font-size: 0.85em;
    font-weight: 600;
    cursor: pointer;
}

.btn-editar:hover {
    background: #d1d5db;
}

.tarjeta-nueva {
    align-items: center;
    justify-content: center;
    gap: 0.5em;
    background: #faf9ff;
    border: 2px dashed #c4b5fd;
    color: var(--violeta1);
    cursor: pointer;
    padding: 2em 1em;
    font-size: 1em;
    font-weight: 600;
    min-height: 12em;
}

.tarjeta-nueva:hover {
    background: #f3f0ff;
    border-color: var(--violeta2);
}

.mas {
    font-size: 2.2em;
    line-height: 1;
    font-weight: 400;
}
</style>
