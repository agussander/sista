<script>
import { pb } from '$lib/pocketbase';
import { onMount } from 'svelte';
    import { record } from '../../../adminStore';
    import Record from './Record.svelte';

let records = $state([]);
let i =$state(0);
let mostrarDatos = $state(true);
let selectedPuntaje = $state(100);
let isSubmitting = $state(false);

const puntajes = [0, 100, 150, 200];

const updateConectarlaciudad = async (participante, puntaje) => {
    try {
        // Buscar el registro en conectarlaciudad usando el número de ruleta
        const conectarlaciudadRecord = await pb.collection('conectarlaciudad').getFirstListItem(
            `ruleta=${participante.number}`
        );
        
        // Obtener el puntaje total actual
        const currentPuntajeTotal = conectarlaciudadRecord.puntaje_total || 0;
        
        // Sumar el nuevo puntaje al total
        const newPuntajeTotal = currentPuntajeTotal + puntaje;
        
        // Actualizar el registro en conectarlaciudad
        await pb.collection('conectarlaciudad').update(conectarlaciudadRecord.id, {
            participo_ruleta: true,
            puntaje_total: newPuntajeTotal
        });
    } catch (err) {
        console.error('Error al actualizar conectarlaciudad:', err);
        throw err; // Lanzar el error para que el componente pueda manejarlo
    }
};

const darPremio = async()=>{
    const participante = records.filter(f=>!f.participo)[i];
    if (!participante || isSubmitting) return;
    
    isSubmitting = true;
    try {
        // Actualizar en participantes_ruleta
        await pb.collection('participantes_ruleta').update(`${participante.id}`, {
            "participo": true
        });
        
        // Actualizar también en conectarlaciudad y sumar puntaje
        await updateConectarlaciudad(participante, selectedPuntaje);
        
        if(!records.filter(f=>!f.participo)[i]){
            i=0;
        }
    } catch (err) {
        console.error('Error al dar premio:', err);
        alert('Error al actualizar el puntaje. Por favor, intentá nuevamente.');
    } finally {
        isSubmitting = false;
    }
}
const pasar = ()=>{
    i++;
    if(!records.filter(f=>!f.participo)[i]){
        i=0;
    }
}

const change = async(puntaje, id, currentEstado = null)=>{
    const participante = records.find(r => r.id === id);
    if (!participante) return;

    try {
        // Si se pasa un puntaje, es para asignar puntaje y marcar como participó
        if (puntaje) {
            // Actualizar en participantes_ruleta
            await pb.collection('participantes_ruleta').update(`${id}`, {
                "participo": true
            });
            
            // Actualizar también en conectarlaciudad y sumar puntaje
            await updateConectarlaciudad(participante, puntaje);
        } else {
            // Si no hay puntaje, es para cambiar el estado del checkbox
            const nuevoEstado = currentEstado !== null ? !currentEstado : !participante.participo;
            
            // Actualizar en participantes_ruleta
            await pb.collection('participantes_ruleta').update(`${id}`, {
                "participo": nuevoEstado
            });
            
            // Actualizar también en conectarlaciudad
            try {
                const conectarlaciudadRecord = await pb.collection('conectarlaciudad').getFirstListItem(
                    `ruleta=${participante.number}`
                );
                await pb.collection('conectarlaciudad').update(conectarlaciudadRecord.id, {
                    participo_ruleta: nuevoEstado
                });
            } catch (err) {
                console.error('Error al actualizar conectarlaciudad:', err);
            }
        }
    } catch (err) {
        console.error('Error al actualizar participante:', err);
        throw err; // Lanzar el error para que el componente pueda manejarlo
    }
}


pb.collection('participantes_ruleta').subscribe('*', function (e) {
    console.log(e.action);
    if(e.action=='update'){
        records[records.findIndex((r)=>r.id==e.record.id)] = e.record;
    } else if(e.action=='create'){
        records.push(e.record);
    }
}, { /* other options like: filter, expand, custom headers, etc. */ });

onMount(async () => {
    records = await pb.collection('participantes_ruleta').getFullList({
        sort: 'created',
    });
});
</script>

<section>
    <div class="main">
        <p>Siguiente:</p>
        {#if records.filter(f=>!f.participo)[i]}
            <p class="main-text">S-{
            records.filter(f=>!f.participo)[i]?.number}</p>
            <p class="main-nombre">{records.filter(f=>!f.participo)[i]?.nombre}</p>
        {:else}
                <p>Nadie</p>
        {/if}
        <div class="buttons">
            <div class="puntaje-controls">
                <select bind:value={selectedPuntaje} disabled={isSubmitting || !records.filter(f=>!f.participo)[i]}>
                    {#each puntajes as puntaje}
                        <option value={puntaje}>{puntaje} puntos</option>
                    {/each}
                </select>
                <button onclick={darPremio} class="btn-1" disabled={isSubmitting || !records.filter(f=>!f.participo)[i]}>
                    {isSubmitting ? 'Cargando...' : 'Cargar puntaje'}
                </button>
            </div>
            <button onclick={pasar} disabled={isSubmitting}>Pasar a otro</button>
        </div>
    </div>
    <div style="margin-bottom: 0">
        <button onclick={()=>mostrarDatos=!mostrarDatos}
            class="btn-2">{mostrarDatos ? 'Ocultar' : 'Mostrar'} datos</button>
    </div>
    <div class="siguientes records">
        {#each records.filter(f=>!f.participo) as r (r.id)}
            <Record {change} {mostrarDatos} klass='siguientes' {r}></Record>
        {/each}
    </div>
    <div class="records anteriores">
        {#each records.filter(f=>f.participo) as r (r.id)}
            <Record {change} {mostrarDatos} klass='anteriores' {r}></Record>
        {/each}
    </div>
</section>

<style>
.main{
    font-size: 2em;
    margin-bottom: 2em;
    text-align: center;
}
.main-text{
    font-size: 4rem;
    font-weight: 600;
    line-height: 1em;
    margin-bottom: 0;
}
.main-nombre{
    font-size: 1.2rem;
    margin-top: .5em;
    margin-bottom: 2em;
}
.puntaje-controls{
    display: flex;
    gap: 0.5em;
    align-items: center;
    flex: 1;
}
.puntaje-controls select{
    padding: 0.75em;
    border: 1px solid #ccc;
    border-radius: 0.5em;
    font-size: 1rem;
    min-width: 150px;
}
.puntaje-controls select:disabled{
    opacity: 0.6;
    cursor: not-allowed;
}
.btn-1{
    flex: 1;
    min-width: 150px;
    max-width: 16em;
}
button{
    padding: 1em;
    cursor: pointer;
    pointer-events: all;
}
button:disabled{
    opacity: 0.6;
    cursor: not-allowed;
}
.buttons{
    display: flex;
    font-size: 1rem;
    width: 100%;
    justify-content: space-around;
    gap: 1em;
    align-items: center;
}
section{
    padding: 3em 2em;
    background: rgb(235, 235, 235);
}
.records{
    display: flex;
    flex-flow: column;
    gap: 1em;
    margin-bottom: 1em;
}
.btn-2{
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    text-decoration: underline;
    font-size: 1em;
}

@media (max-width: 768px) {
    .main {
        font-size: 1.2em;
        margin-bottom: 1.5em;
    }
    
    .main-text {
        font-size: 2.5rem;
    }
    
    .main-nombre {
        font-size: 1rem;
        margin-top: 0.3em;
        margin-bottom: 1.5em;
    }
    
    .buttons {
        flex-direction: column;
        gap: 1em;
        align-items: stretch;
    }
    
    .puntaje-controls {
        flex-direction: column;
        width: 100%;
        gap: 0.75em;
    }
    
    .puntaje-controls select {
        width: 100%;
        min-width: unset;
    }
    
    .btn-1 {
        width: 100%;
        min-width: unset;
        max-width: unset;
    }
    
    button {
        padding: 0.875em;
        font-size: 0.95rem;
    }
    
    section {
        padding: 1.5em 1em;
    }
}

</style>

