<script>
import {datosBaja, pasoCompleto, paso} from './bajaStore'
import StepButtons from './StepButtons.svelte';
let isChecked;

const handleCheck=()=>{
    $datosBaja.consentimientoEntrega=!$datosBaja.consentimientoEntrega;
    if($datosBaja.consentimientoEntrega){
        $datosBaja.consentimientoEntrega;
        $pasoCompleto=3;
    } else{
        $pasoCompleto=2;
    }
}
</script>

<p>
    Dependerá del cierre de ciclo de facturación, la fecha de suspensión
    del servicio y la posible emisión de una factura posterior a la solicitud de baja. Recordá
    que tenés que devolver los equipos entregados al momento de la contratación y saldar
    la deuda, en caso de corresponder.
</p>

<div class="checkbox-container" role="button" tabindex="0" on:click={()=>handleCheck()} on:keydown={(e) => e.key === 'Enter' && handleCheck()}>
    <input type="checkbox" name="ok" checked={$datosBaja.consentimientoEntrega} id="consentimiento">
    <label for="consentimiento">Estoy de acuerdo</label>
</div>

<StepButtons
    on:siguiente={()=> $paso++}
></StepButtons>


<style>
.checkbox-container {
    display: flex;
    align-items: center;
    gap: 0.5em;
    color: var(--text);
    border: 1.5px solid var(--violeta2);
    width: 14em;
    padding: 1em;
    border-radius: 6px;
    cursor: pointer;
    outline: none;
}

.checkbox-container:focus {
    border-color: var(--violeta2-hover);
    box-shadow: 0 0 0 2px rgba(111, 66, 193, 0.2);
}

.checkbox-container label {
    cursor: pointer;
    border: none;
    padding: 0;
    width: auto;
    margin: 0;
}
</style>