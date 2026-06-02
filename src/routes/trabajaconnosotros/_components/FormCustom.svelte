<script>
import { onMount } from "svelte";
import MultipleCustom from "./MultipleCustom.svelte";
import OptionsCustom from "./OptionsCustom.svelte";
import FileCustom from "./FileCustom.svelte";
import InputCustom from "./InputCustom.svelte";
import SelectCustom from "./SelectCustom.svelte";

let {field, value=$bindable(), next, prev, alert, onDataChange} = $props();

// Notificar cambios en los datos inmediatamente
$effect(() => {
    if (value !== undefined && onDataChange) {
        onDataChange();
    }
});



</script>


<div class='wrap'>
    {#if field?.type == 'multipleCustom'}
        <MultipleCustom bind:values={value[field.name]}
        {next} {prev} {field}
        ></MultipleCustom>
    {:else if field?.type == 'optionsCustom'}
        <OptionsCustom bind:value={value[field.name]}
        {next} {prev} {field}
        ></OptionsCustom>
    {:else if field?.type == 'select'}
        <SelectCustom  bind:value
        {next} {prev} {field}
        ></SelectCustom>
    {:else if field?.type == 'file'}
        <FileCustom {field} {next} {prev} bind:value={value[field.name]}></FileCustom>
    {:else}
        <InputCustom {field} {next} {prev} bind:value></InputCustom>
    {/if}
</div>

<style>
@import '../styles.scss';
.wrap{
    background: white;
    border-radius: var(--border-radius);
    padding: 2em 1em;
    width: 100vw;
    max-width: 30em;
    display: flex;
    flex-flow: column;
}


</style>