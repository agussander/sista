<script>
export let data, title, res;
export let icons = {};
export let variant = 'default';
</script>


<h2>{title}</h2>
<div class="chips" class:scale={variant === 'scale'}>
{#each data as option}
<!-- svelte-ignore a11y-click-events-have-key-events -->
<label on:click={()=>res=option} class:selected={res==option}>
        <input type="radio"
        value={option}
        bind:group={res}>
        {#if icons[option]}<span class="icon">{icons[option]}</span>{/if}
        <span class="label-text">{option}</span>
</label>
{/each}
</div>

<style>
h2{
    font-size: 1em;
    text-transform: none;
    text-align: left;
    font-weight: 500;
    color: #333;
    margin-bottom: .8em;
}
.chips{
    display: flex;
    flex-wrap: wrap;
    gap: .6em;
}
label{
    position: relative;
    display: flex;
    align-items: center;
    gap: .4em;
    padding: .7em 1.2em;
    border-radius: var(--border-radius);
    background: white;
    box-shadow: 0 .15em .6em rgba(0,0,0,.08);
    color: var(--violeta1);
    font-weight: 500;
    cursor: pointer;
    user-select: none;
}
label input{
    position: absolute;
    opacity: 0;
    width: 1px;
    height: 1px;
}
.icon{
    font-weight: 700;
}
.selected{
    background: var(--violeta1);
    color: white;
    box-shadow: 0 .15em .6em rgba(102,37,124,.35);
}
.chips.scale{
    display: grid;
    grid-template-columns: repeat(5, 1fr);
}
.scale label{
    justify-content: center;
    padding: .7em .3em;
}
</style>

