<script>
import StepButtons from "./StepButtons.svelte";

import { paso } from './bajaStore';
import Paso1B from "./Paso1B.svelte";
import Paso2 from "./Paso2.svelte";
import Paso3 from "./Paso3.svelte";
import Paso4 from "./Paso4.svelte";
import Paso5 from "./Paso5.svelte";

</script>

<div>
    {#if $paso==0}
        <p>Solo la persona titular del servicio puede solicitar la baja del mismo. Complete todos los pasos hasta obtener su número de trámite.<br>En caso de imposibilidad de ser solicitada por el titular, comuníquese a través del 0221-644-2600</p>
        <StepButtons></StepButtons>
    {:else if $paso==1}
        <Paso1></Paso1>
    {:else if $paso==2}
        <Paso1B></Paso1B>
    {:else if $paso==3}
        <Paso2></Paso2>
    {:else if $paso==4}
        <Paso3></Paso3>
    {:else if $paso==5}
        <Paso4></Paso4>
    {:else if $paso==6}

       

        <Paso5></Paso5>
    {/if}
</div>


<style>
div{
    display: flex;
    flex-flow:column ;
}


</style>