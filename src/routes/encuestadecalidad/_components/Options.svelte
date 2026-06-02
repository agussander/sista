<script>
export let data, title, res;
</script>


<h2>{title}</h2>
<div>
{#each data as option}
<!-- svelte-ignore a11y-click-events-have-key-events -->
<label on:click={()=>res=option} class:selected={res==option}>
        <input type="radio"
        value={option}
        bind:group={res}>
        {option}
</label>
{/each}
</div>

<style>
h2{
    font-size: 1em;
    text-transform: none;
    text-align: left;
    font-weight: 500;
}
div{
    display: flex;
    flex-flow: column-reverse;
}
label{
    display: block;
    text-transform:capitalize;
    margin-bottom: .5em;
}
.selected{
    font-weight: 500;
}
</style>

