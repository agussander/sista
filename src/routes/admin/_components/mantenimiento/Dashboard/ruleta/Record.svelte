<script>
import { pb } from '$lib/pocketbase';

let {r, klass, mostrarDatos, change} = $props();

let selectedPuntaje = $state(null);
let isSubmitting = $state(false);

const puntajes = [100, 150, 200];

const handleSubmit = async () => {
    if (!selectedPuntaje || isSubmitting) return;
    
    isSubmitting = true;
    try {
        await change(selectedPuntaje, r.id);
        selectedPuntaje = null;
    } catch (error) {
        console.error('Error al enviar puntaje:', error);
    } finally {
        isSubmitting = false;
    }
};

</script>

<div class="row {klass}">
    <div>
        <div>
            <p><strong>S-{r.number}</strong></p>
            <p>{r.nombre}</p>
        </div>
        {#if mostrarDatos}
            <div>
                <p>{r.telefono}</p>
                <p>{r.ciudad}</p>
            </div>
        {/if}
        <div class="puntaje-selector">
            {#if !r.participo}
                <select bind:value={selectedPuntaje} disabled={isSubmitting}>
                    <option value={null}>Seleccionar puntaje</option>
                    {#each puntajes as puntaje}
                        <option value={puntaje}>{puntaje} puntos</option>
                    {/each}
                </select>
                <button 
                    onclick={handleSubmit} 
                    disabled={!selectedPuntaje || isSubmitting}
                    class="btn-enviar"
                >
                    {isSubmitting ? 'Enviando...' : 'Enviar'}
                </button>
            {:else}
                <div class="participo">
                    <input type="checkbox" checked={r.participo}
                    onchange={()=>change(null, r.id, r.participo)}
                    >
                </div>
            {/if}
        </div>
    </div>
</div>

<style>
.row{
    justify-content: space-between;
    padding: 1em;
    background: var(--background);
    border-radius: 1em;
    border: var(--border);
}
.row>div{
    display: flex;
    gap: 2em;
    justify-content: space-between;
    align-items: center;
}
strong{
    font-size: 2em;
}
.puntaje-selector{
    display: flex;
    flex-direction: column;
    gap: 0.5em;
    align-items: flex-end;
    min-width: 150px;
}
select{
    padding: 0.5em;
    border: 1px solid #ccc;
    border-radius: 0.5em;
    font-size: 1em;
    width: 100%;
}
select:disabled{
    opacity: 0.6;
    cursor: not-allowed;
}
.btn-enviar{
    padding: 0.5em 1em;
    background: var(--violeta1, #7028a2);
    color: white;
    border: none;
    border-radius: 0.5em;
    cursor: pointer;
    font-weight: 600;
    width: 100%;
    transition: opacity 0.2s;
}
.btn-enviar:disabled{
    opacity: 0.6;
    cursor: not-allowed;
}
.btn-enviar:not(:disabled):hover{
    opacity: 0.9;
}
.participo{
    display: flex;
    align-items: center;
    justify-content: flex-end;
}
.participo input{
    width: 2em;
    height: 2em;
}
.siguientes{
    --background: white;
}
.anteriores{
    --background: rgb(223, 209, 232);
    --border: 1px solid rgb(219, 219, 219);
}

@media (max-width: 768px) {
    .row {
        padding: 0.875em;
    }
    
    .row > div {
        flex-direction: column;
        gap: 1em;
        align-items: flex-start;
        width: 100%;
    }
    
    strong {
        font-size: 1.5em;
    }
    
    .puntaje-selector {
        width: 100%;
        min-width: unset;
        align-items: stretch;
    }
    
    .participo {
        justify-content: flex-start;
        width: 100%;
    }
    
    .participo input {
        width: 1.5em;
        height: 1.5em;
    }
}
</style>