<script>
import NavigationButtons from "./NavigationButtons.svelte";

let {field, value=$bindable(), next, prev} = $props();

const handleNext = (e) => {
    e.preventDefault();
    next();
}
</script>



<label>{field.label}
    <select bind:value={value[field.name]} name={field.name} requiered=true>
        <option value='seleccionar' disabled selected>Seleccionar</option>
        {#each field.options as {value, label}}
            <option value={value}>{label}</option>
        {/each}
    </select>
</label>
<NavigationButtons next={handleNext} {prev}></NavigationButtons>


<style>
label{
    align-self: center;
}
</style>