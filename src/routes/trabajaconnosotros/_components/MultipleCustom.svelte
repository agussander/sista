<script>
import { slide } from 'svelte/transition';
import AlertCustom from './AlertCustom.svelte';
import NavigationButtons from './NavigationButtons.svelte';
let { values=$bindable(), field, next, prev}= $props();

// Estado para controlar si cada elemento está en modo edición o visualización
let editingStates = $state({});

const add = (e) => {
    e.preventDefault();
    const newValue = field.options.flat().reduce((acc, option) => {
        if (option?.name) {
            acc[option.name] = '';
        }
        return acc;
    }, {});
    const newIndex = values ? values.length : 0;
    values= values ? [...values, newValue] : [newValue];
    // El nuevo elemento empieza en modo edición
    editingStates[newIndex] = true;
}

const del = (i) => {
    values = values.filter((_, j) => j !== i);
    // Limpiar el estado de edición del elemento eliminado
    delete editingStates[i];
    // Reindexar los estados
    const newEditingStates = {};
    Object.keys(editingStates).forEach(key => {
        const index = parseInt(key);
        if (index > i) {
            newEditingStates[index - 1] = editingStates[key];
        } else if (index < i) {
            newEditingStates[index] = editingStates[key];
        }
    });
    editingStates = newEditingStates;
}

const accept = (i) => {
    editingStates[i] = false;
}

const edit = (i) => {
    editingStates[i] = true;
}

const displayAlert = () => {

}

</script>





<h4>{field.label}</h4>
<p>{field.detail}</p>

{#each values as item,i}
    <div in:slide>
        {#if editingStates[i] !== false}
            <!-- Modo edición para esta tarjeta -->
            {#each field.options as option,j}
                <label class:disabled={option.name=='fin' && values[i].enCurso}>{option.label}
                    <input type={option.type} bind:value={values[i][option.name]} >
                </label>
            {/each}
            <label class='check'>
                <input type="checkbox" bind:checked={values[i].enCurso} onchange={()=>{
                    if (values[i].enCurso) {
                        values[i].fin = '';
                    }
                }}>
                En curso
            </label>
            <span class="button-group">
                <button class='btn-accept-small' onclick={()=>accept(i)}>Aceptar</button>
                <button class='btn-delete-small' onclick={()=>del(i)}>Eliminar</button>
            </span>
        {:else}
            <!-- Modo visualización para esta tarjeta -->
            <button class="edit-btn" onclick={()=>edit(i)}>Editar</button>
            {#each field.options as option,j}
                <div class="display-field">
                    <strong>{option.label}:</strong>
                    <span>
                        {#if option.name === 'fin' && item.enCurso}
                            En curso
                        {:else}
                            {item[option.name] || 'No especificado'}
                        {/if}
                    </span>
                </div>
            {/each}
        {/if}
    </div>
{/each}

<button class='btn-3' onclick={add}>+ Agregar</button>

<NavigationButtons {next} {prev}></NavigationButtons>


<style>
@import '../styles.scss';
div{
    display: flex;
    flex-direction: column;
    gap: .5em;
    outline: 1px solid rgb(214, 214, 214);
    padding: 1em;
    border-radius: 10px;
    margin-bottom: 1em;
    position: relative;
}
.check{
    display: flex;
    gap: .5em;
    align-items: center;
    font-size: .9em;
}
input[type=checkbox]{
    width: 1em;
    height: 1em;
}
.disabled{
    filter: grayscale();
    opacity:.7;
    pointer-events: none;
}
.btn-3{
    width: max-content;
    padding: .6em 2em;
    margin: 0 auto  ;
}

/* Estilos para el grupo de botones */
.button-group {
    display: inline;
    gap: 0.5em;
    margin: 0.5em 0;
}

.button-group:hover {
    opacity: 1 !important;
}

/* Estilos para el botón Aceptar pequeño (dentro de cada tarjeta) */
.btn-accept-small {
    background: var(--violeta2);
    color: white;
    border: none;
    padding: 0.5em 1em;
    border-radius: 0.3em;
    font-weight: 500;
    cursor: pointer;
    font-size: 0.9em;
    transition: all 0.2s ease;
    flex: 1;
}

.btn-accept-small:hover {
    background: var(--violeta2-hover);
    transform: translateY(-1px);
}

/* Estilos para el botón Eliminar pequeño */
.btn-delete-small {
    background: #f5f5f5;
    color: #666;
    border: 1px solid #ddd;
    padding: 0.5em 1em;
    border-radius: 0.3em;
    font-weight: 500;
    cursor: pointer;
    font-size: 0.9em;
    transition: all 0.2s ease;
    flex: 1;
}

.btn-delete-small:hover {
    background: #e0e0e0;
    color: #333;
    transform: translateY(-1px);
}

/* Estilos para el modo visualización - aplicado a div cuando no está en edición */
div:has(.display-field) {
    background: #f9f9f9;
}

.display-field {
    display: flex;
    flex-direction: column;
    gap: 0;
    outline: none;
    padding: 0 1em;
    margin-bottom: 0;
}

.display-field strong {
    color: var(--violeta2);
    font-size: 0.9em;
}

.display-field span {
    color: #333;
    font-size: 1em;
}

.edit-btn {
    background: transparent;
    color: var(--violeta2);
    padding: 0.5em 1em;
    border-radius: 0.3em;
    font-weight: 500;
    cursor: pointer;
    position: absolute;
    top: 0.5em;
    right: 0.5em;
    font-size: 0.8em;
    transition: all 0.2s ease;
    z-index: 100;
}

.edit-btn:hover {
    background: var(--violeta2);
    color: white;
}

</style>


