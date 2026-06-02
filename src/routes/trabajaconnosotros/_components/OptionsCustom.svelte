<script>
import NavigationButtons from "./NavigationButtons.svelte";
let {field, value=$bindable(), next, prev} = $props();
</script>

<h4>{field.label}</h4>
<p>{field.detail}</p>
<div class="wrap">
    {#each field.options as option,i}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <label class:selected={value===option.value}
        onclick={()=>{value=option.value}}>
            <input type="radio"
            value={option.value}
            name={option.name}
            bind:group={value}>
            {option.label}
        </label>
    {/each}
</div>
<NavigationButtons {next} {prev}></NavigationButtons>

<style>
@import '../styles.scss';

.wrap{
    margin-bottom: 1.2em;
}
label{
    padding: .5em;
    font-weight: 500;
    cursor: pointer;
    background-color: var(--background);
    font-weight: 400;
    border-radius: .8em;
}
.selected{
    background: rgb(230, 230, 230);
    font-weight: 400;
    font-weight: 600;
}
[type="radio"]:focus {
    outline: none!important;
}
</style>