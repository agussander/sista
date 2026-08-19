<script>
// Alta y edicion de una novedad. No habla con PocketBase: junta los datos, los
// valida y se los pasa al que lo invoca (`Novedades.svelte`), que es quien
// llama al store.
import { untrack } from 'svelte';
import { fechaParaInput, slugify } from '$lib/novedades.js';
import { novedadesAdmin } from './novedadesAdmin.svelte.js';

let { novedad = null, onGuardar, onCancelar } = $props();

// Los campos se siembran UNA sola vez con lo que trae `novedad` y despues
// viven por su cuenta: mientras la persona escribe, el formulario manda, no la
// prop. `untrack` deja eso escrito en el codigo, en vez de que Svelte avise
// (`state_referenced_locally`) que la lectura no es reactiva y parezca un
// descuido.
//
// Que alcance con sembrarlos una vez depende de `Novedades.svelte`: para pasar
// de editar una novedad a editar otra hay que volver a la lista, y ahi el
// `{#if editando}` desmonta este componente. Nunca se reusa la misma instancia
// con otra novedad.
const inicial = untrack(() => ({
    esEdicion: !!novedad,
    titulo: novedad?.titulo ?? '',
    fecha: fechaParaInput(novedad?.fecha) || new Date().toISOString().slice(0, 10),
    bajada: novedad?.bajada ?? '',
    cuerpo: novedad?.cuerpo ?? '',
    publicada: novedad?.publicada ?? false,
    destacada: novedad?.destacada ?? false,
    // La foto que ya tenia cargada, para mostrarla mientras no elijan otra.
    imagenActual: novedad ? novedadesAdmin.urlImagen(novedad, '600x400') : null
}));

const esEdicion = inicial.esEdicion;

let titulo = $state(inicial.titulo);
let fecha = $state(inicial.fecha);
let bajada = $state(inicial.bajada);
let cuerpo = $state(inicial.cuerpo);
let publicada = $state(inicial.publicada);
let destacada = $state(inicial.destacada);
let imagen = $state(null);
let errorLocal = $state('');

// Vista previa: la imagen recien elegida si hay una, si no la que ya tenia.
let previewNueva = $state(null);
const preview = $derived(previewNueva ?? inicial.imagenActual);
let arrastrando = $state(false);

function aplicarImagen(file) {
    imagen = file;
    previewNueva = file ? URL.createObjectURL(file) : null;
}

function elegirImagen(event) {
    aplicarImagen(event.currentTarget.files?.[0] ?? null);
}

function onDragOver(event) {
    event.preventDefault();
    arrastrando = true;
}

function onDragLeave() {
    arrastrando = false;
}

function onDrop(event) {
    event.preventDefault();
    arrastrando = false;
    const file = event.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) {
        aplicarImagen(file);
    }
}

function enviar(event) {
    event.preventDefault();
    if (!titulo.trim()) {
        errorLocal = 'La novedad necesita un título.';
        return;
    }
    if (!fecha) {
        errorLocal = 'La novedad necesita una fecha.';
        return;
    }
    // La direccion de la novedad se arma con el titulo. Un titulo sin ninguna
    // letra ni numero -solo emojis o solo signos- no deja nada para armarla, y
    // PocketBase rechaza el alta con un error que no explica por que. Al
    // editar no se valida: la direccion ya esta hecha y no se toca.
    if (!esEdicion && !slugify(titulo)) {
        errorLocal = 'El título necesita al menos una letra o un número, porque con él se arma la dirección de la novedad.';
        return;
    }
    errorLocal = '';
    onGuardar({ titulo, fecha, bajada, cuerpo, publicada, destacada, imagen });
}
</script>

<form onsubmit={enviar}>
    <h2>{esEdicion ? 'Editar novedad' : 'Nueva novedad'}</h2>

    <label>
        Título
        <input type="text" bind:value={titulo} maxlength="120" placeholder="Nueva tienda Sista">
    </label>

    <label>
        Fecha
        <input type="date" bind:value={fecha}>
    </label>

    <label>
        Bajada <span class="ayuda">Una o dos líneas, es lo que se lee en la tarjeta</span>
        <input type="text" bind:value={bajada} maxlength="200">
    </label>

    <label>
        Cuerpo <span class="ayuda">Cada enter es un párrafo nuevo. Si pegás una dirección web queda como link.</span>
        <textarea bind:value={cuerpo} rows="10"></textarea>
    </label>

    <div
        class="dropzone"
        class:arrastrando
        ondragover={onDragOver}
        ondragleave={onDragLeave}
        ondrop={onDrop}
    >
        <label>
            Imagen <span class="ayuda">Arrastrá una imagen acá, o hacé clic para elegirla</span>
            <input type="file" accept="image/*" onchange={elegirImagen}>
        </label>
    </div>

    {#if preview}
        <img class="preview" src={preview} alt="Vista previa">
    {/if}

    <div class="checks">
        <label class="check">
            <input type="checkbox" bind:checked={publicada}>
            Publicada <span class="ayuda">Si está destildada, no la ve nadie desde afuera</span>
        </label>
        <label class="check">
            <input type="checkbox" bind:checked={destacada}>
            Destacada <span class="ayuda">Aparece primera en el listado</span>
        </label>
    </div>

    {#if errorLocal}<p class="error">{errorLocal}</p>{/if}
    {#if novedadesAdmin.error}<p class="error">{novedadesAdmin.error}</p>{/if}

    <div class="acciones">
        <button type="button" class="btn-cancelar" onclick={onCancelar} disabled={novedadesAdmin.guardando}>
            Cancelar
        </button>
        <button type="submit" class="btn-guardar" disabled={novedadesAdmin.guardando}>
            {novedadesAdmin.guardando ? 'Guardando…' : 'Guardar'}
        </button>
    </div>
</form>

<style>
form {
    display: flex;
    flex-flow: column;
    gap: 1.2em;
    max-width: 45em;
}

h2 {
    color: var(--violeta1);
    margin: 0;
}

label {
    display: flex;
    flex-flow: column;
    gap: 0.4em;
    font-weight: 600;
    color: #495057;
    font-size: 0.9em;
}

.ayuda {
    font-weight: 400;
    color: #6b7280;
    font-size: 0.85em;
}

input[type='text'],
input[type='date'],
textarea {
    padding: 0.7em 0.9em;
    border: 1px solid #ced4da;
    border-radius: 0.4em;
    font-size: 1em;
    font-family: inherit;
    font-weight: 400;
}

input[type='text']:focus,
input[type='date']:focus,
textarea:focus {
    outline: none;
    border-color: var(--violeta2);
}

textarea {
    resize: vertical;
    line-height: 1.6;
}

.dropzone {
    border: 2px dashed #ced4da;
    border-radius: 0.6em;
    padding: 0.6em 0.9em;
    transition: border-color 0.15s, background-color 0.15s;
}

.dropzone.arrastrando {
    border-color: var(--violeta2);
    background: #f5f3ff;
}

.dropzone label {
    gap: 0.3em;
}

.preview {
    max-width: 22em;
    width: 100%;
    border-radius: 0.5em;
}

.checks {
    display: flex;
    flex-flow: column;
    gap: 0.8em;
}

.check {
    flex-flow: row;
    align-items: center;
    gap: 0.5em;
}

.error {
    color: #b91c1c;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 0.4em;
    padding: 0.7em 1em;
    margin: 0;
}

.acciones {
    display: flex;
    gap: 0.8em;
}

.acciones button {
    padding: 0.7em 1.5em;
    border: none;
    border-radius: 0.4em;
    font-size: 0.95em;
    font-weight: 600;
    cursor: pointer;
}

.btn-guardar {
    background: var(--violeta1);
    color: white;
}

.btn-guardar:hover:not(:disabled) {
    background: var(--violeta2);
}

.btn-cancelar {
    background: #e5e7eb;
    color: #374151;
}

.acciones button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}
</style>
