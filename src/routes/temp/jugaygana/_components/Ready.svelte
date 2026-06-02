<script>
import { onMount } from "svelte";
import { scrollTop } from 'svelte-scrolling'
import { number, paso, recordId } from './stores.svelte.js';
import GraciasPorJugar from "./GraciasPorJugar.svelte";
import { pb } from '$lib/pocketbase';



onMount(async()=>{
    scrollTop();
    if($recordId){
        pb.collection('participantes_ruleta').subscribe($recordId, function (e) {
        console.log(e.action);
        console.log(e.record["participo"])
        if(e.record["participo"]){
            $paso=3;
        } else{
            $paso=2
        };
    }, {});
    }
});
</script>


{#if $paso==2}
    <main>
        <div>
            <p style="color: var(--magenta); font-weight: 500">¡Ya puedes jugar!</p>
            <p><strong>Tu número es:</strong></p>
            <h2>S-{$number}</h2>
        </div>
    </main>
{:else}
    <GraciasPorJugar></GraciasPorJugar>
{/if}

<style>
    *{
        text-align: center;
    }
    main{
        height: 100vh;
        display: grid;
        place-items: center;
    }
    h2{
        font-size: 8em;
        margin: 0;
        line-height: 1em;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    div{
        margin-top: -10em;
    }
    /* span{
        font-weight: 300;
        font-size: 5rem;
    } */
    p{
        font-size: 1.5em;
    }
</style>