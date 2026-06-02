<script>
import Form from "./_components/Form.svelte";
import Start from "./_components/Start.svelte";
import Ready from "./_components/Ready.svelte";
import { recordId, paso, number, participo } from "./_components/stores.svelte.js";


const debug = ()=>{
    console.log($participo,$recordId)
    $recordId = null;
    $paso = 0;
    $number = null;
    $participo = false;
}


</script>

{#if $paso==0}
    <Start onclick={()=>$paso=1}></Start>
{:else if $paso==1}
    <Form sent={()=>$paso=2}></Form>
{:else}
    <Ready></Ready>
{/if}
<br>
<!-- <button onclick={debug}>Debug=erase</button> -->