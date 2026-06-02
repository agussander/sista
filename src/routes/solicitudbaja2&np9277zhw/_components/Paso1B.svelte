
<script>
import {pasoCompleto, datosBaja} from './bajaStore.js'
import StepButtons from './StepButtons.svelte';

let rehacer=[];

const check=()=>{
    if(
    $datosBaja.servicio!=='seleccionar' &&
    $datosBaja.motivo!=='seleccionar'){
        $pasoCompleto=2;
    } else{
        $pasoCompleto=1;
    }
}


</script>

<!--Select Servicio-->
<label>
    ¿Qué servicio querés dar de baja?
    <!-- svelte-ignore a11y-no-onchange -->
    <select
    class:rehacer={rehacer.includes('servicio')}
    bind:value={$datosBaja.servicio}
    on:change={()=>check()}>
        <option value="seleccionar" disabled selected>Seleccionar</option>
        <option value="Sista TV">TV</option>
        <option value="Telefonía">Telefonía</option>
        <option value="Internet">Internet (todos)</option>
    </select>
</label>

<!--Motivo-->
<label>
    Motivo de la baja
    <!-- svelte-ignore a11y-no-onchange -->
    <select bind:value={$datosBaja.motivo}
    on:change={()=>check()}
    class:rehacer={rehacer.includes('motivo')}>
        <option value="seleccionar" disabled selected>Seleccionar</option>
        <option value="Mudanza">Mudanza</option>
        <option value="Problemas técnicos">Problemas técnicos</option>
        <option value="Problemas económicos">Problemas económicos</option>
        <option value="Otro">Otro</option>
    </select>
</label>


{#if $datosBaja.motivo=='Otro'}
<label>
    Motivo:
    <textarea></textarea>
</label>
{/if}

<StepButtons></StepButtons>

<style>
.rehacer{
    border-color: var(--magenta);
}
small{
    font-size: 1em;
    font-weight: 300;
}

label{
    display: block;
    margin-bottom: .5em;
    color: var(--text);
    font-size: 1em;
    font-weight: 500;
    margin-bottom: 2em;

}
input,textarea{
    border-color: var(--violeta2);
    border-style: solid;
    border-width: 1.5px;
    border-radius: 5px;
    font-family: sans-serif;
    font-weight: 1em;
    padding: .2em .4em;
    display: block;
    width: 100%;
}
textarea{
    width: 100%;
    resize: vertical;
    height: 5em;
    margin-top: .4em;
    border-color: var(--violeta2);
    border-style: solid;
    border-width: .1em;
    border-radius: 5px;
    font-family: sans-serif;
    font-weight: 1em;
}

select{
font-family: 'nexa';
border-radius: 5px;
font-size: 1rem;
padding: .3em .5em;
border-color: var(--violeta);
border-width: 1.5px;
font-weight: 400;
color: var(--text);
background: white;
display: block;
width: 100%;
}
select:focus{
border-color: var(--violeta2-hover);
outline: none;
}
</style>