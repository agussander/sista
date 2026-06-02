<script>
import { onMount } from "svelte";

let {data,selected} = $props();

const isComment = {
        'formulario_calidad': ['otros','mejora'],
        'formulario_calidad_2': ['general_adicional','comunicacion_adicional']
};

let comments=$derived(getComments(data))

const getComments = (d)=>{
    let ac = [];
    console.log('d',d,selected)
    for(let i=0; i<d.length; i++){
        let com1 = d[i][isComment[selected][1]];
        if(com1){
        let res = {title: isComment[selected][1], text: com1}
        ac[i]= [res] || []
        }
        let com2 = d[i][isComment[selected][0]]
        if(com2){
            let res = {title: isComment[selected][0], text: com2}
            ac[i]= [...ac[i], res] || []
        }
    }
    return ac
}




let datos = [];

let showPanelMenu = $state(false);

</script>


{#each data as d,i}
    <div class="header">
        <p><small>{d.updated.slice(0,10)}</p> 
    </div>
    <div class="boxes">
        {#each comments[i] as comment}
            <div class="box">
                <p class='title'>{comment.title}</p>
                <p>{comment.text}</p>
            </div>
        {/each}
        <div class="datos">
            {#if selected=='formulario_calidad'}
                <p>General: {d.general}</p>
                <p>Atención: {d.atencion}</p>
                <p>Interrupciones: {d.interrupciones}</p>
            {:else}
                <p>General: {d.general}</p>
                <p>Atención: {d.comunicacion}</p>
                <p>Lo recomendaría: {d.recomendable}</p>
            {/if}
            <!-- {#each datos as d}
                <p><strong>{d.title}:</strong> {d.text}</p>
            {/each} -->
        </div>
    </div>
{/each}

<style>
.header{
    background: lightgray;
    padding: .1em .2em;
}
.boxes{
    display: flex;
    gap: 1em;
    margin-bottom: 1em;
}
.box{
    border: 1px solid lightgray;
    padding: .5em;
    width: 18em;
}
.datos{
    border: 1px solid lightgray;
    padding: .5em;
}
.title{
    font-size: .9rem;
    font-weight: 500;
}
</style>
