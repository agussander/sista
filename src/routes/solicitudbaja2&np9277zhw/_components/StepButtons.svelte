<script>
import {paso, pasoCompleto} from './bajaStore'

let { disabled = false, siguiente } = $props();

let isAble = $derived(($pasoCompleto==$paso || $paso==0 || $paso==5) && !disabled);

let siguienteText = $derived($paso==4 || $paso==5 ? 'Solicitar Baja' : 'Siguiente')

const handleSiguiente = ()=>{
    if (siguiente) {
        siguiente();
    } else {
        $paso++
    }
}

</script>

<div class="buttons">

    {#if $paso<6}
    <button class="btn-1"
    class:isAble
    onclick={handleSiguiente}
    disabled={!isAble}
        >{siguienteText}</button>
    {/if}

    {#if $paso>0 && $paso<6}
        <button class="btn-2"
        class:isAble
        onclick={()=>$paso--}
        >Atrás</button>
    {/if}
</div>
<!-- <button
onclick={()=>console.log('Debug - paso:', $paso, 'pasoCompleto:', $pasoCompleto, 'isAble:', isAble)}>
    Debug
</button> -->

<style>
.buttons{

    width: 100%;
    display: flex;
    flex-direction: row-reverse;
    justify-content: space-between;
    margin-top: 2em;
    gap: 2em
}
.btn-1{
    max-width: 50%;
    justify-self: right;
    background-color: gray;
    pointer-events: none;

}
.btn-2{
    font-family: inherit;
    font-size: .9em;
    font-weight: 500;
    color: var(--violeta2);
    background-color: white;
    background:none!important;
    border: 1.5px solid var(--violeta2);
    border-radius: 100px;
    padding: .3em 1em;
}

.isAble{
    background: var(--violeta2);
    background-color: var(--violeta2);
    pointer-events: all;
}
</style>