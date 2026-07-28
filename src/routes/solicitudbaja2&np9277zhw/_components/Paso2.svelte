<script>
import { datosBaja, paso } from './bajaStore';
import StepButtons from './StepButtons.svelte';

const handleContainerClick = (e) => {
    // El input y el label ya togglean el checkbox nativamente (por el atributo "for");
    // si dejamos que este handler también actúe, el click sobre esos elementos
    // burbujea al div y se togglea dos veces, anulando el cambio.
    if(e.target.closest('input, label')) return;
    $datosBaja.consentimientoEntrega = !$datosBaja.consentimientoEntrega;
}
</script>

<p>
    Dependerá del cierre de ciclo de facturación, la fecha de suspensión
    del servicio y la posible emisión de una factura posterior a la solicitud de baja. Recordá
    que tenés que devolver los equipos entregados al momento de la contratación y saldar
    la deuda, en caso de corresponder.
</p>

<div class="checkbox-container" role="button" tabindex="0" on:click={handleContainerClick} on:keydown={(e) => { if(e.key === 'Enter' && !e.target.closest('input, label')){ $datosBaja.consentimientoEntrega = !$datosBaja.consentimientoEntrega; } }}>
    <input type="checkbox" name="ok" bind:checked={$datosBaja.consentimientoEntrega} id="consentimiento">
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