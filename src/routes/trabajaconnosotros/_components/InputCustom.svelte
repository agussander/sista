<script>
    import NavigationButtons from "./NavigationButtons.svelte";

let {field, value=$bindable(), next, prev} = $props();

// Solo inicializar si no hay datos guardados
if (!value || Object.keys(value).length === 0) {
    value = field.fields.reduce((acc, item) => {
        acc[item.name] = '';
        return acc;
    }, {});
}

</script>

<h4>{field.label}</h4>
<br>
{#each field.fields as item,i}
    <label>{item.label}
        <input
        type={item.type || 'text'} name={item.name}
        placeholder={item.placeholder} requiered=true
        bind:value={value[item.name]} min={item.min} max={item.max}
        accept={item.accept}
        />
    </label>
{/each}
<NavigationButtons {next} {prev}></NavigationButtons>

<style>
input{
    margin-bottom: 1em;
}
</style>