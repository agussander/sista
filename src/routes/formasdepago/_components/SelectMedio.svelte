<script>
import { goto } from '$app/navigation';
import { get } from 'svelte/store';
import { show, onSelect } from "$lib/stores";
import { mediosDePago } from './index';
import { scrollTop } from 'svelte-scrolling';

const select = (gi, oi) => {
    const groups = get(mediosDePago);
    const g = groups[gi];
    const o = g.opciones[oi];
    show.set([g, o]);
    onSelect.set(true);
    const q = new URLSearchParams({ g: String(gi), o: String(oi) });
    goto(`?${q.toString()}`, { replaceState: false, noScroll: true, keepFocus: true });
    scrollTop();
};
</script>


{#each $mediosDePago as g, gi}
    <div>
        <h3>{g.title}</h3>
        {#each g.opciones as o, oi}
            <button class="btn-secondary"
                on:click={()=>select(gi, oi)}>
                <div class="img" style="background-image:url(/images/pago/{o.pic})"></div>
                {o.title}
                {#if o.bold}
                    <span>
                    {o.bold}
                    </span>
                {/if}
                <img class="ahead" src="/images/ahead.svg" alt="ahead icon">
            </button>
        {/each}
    </div>
{/each}


<style>
.img{
    width:1.5em;
    height:1.5em;
    margin:0;
    background-size: contain;
    background-position: center;
    background-repeat: no-repeat;
    margin-right:.8em;
}
.ahead{
    position:absolute;
    right:1em;
    top:50%;
    transform: translateY(-50%);
}
button {
    display: flex;
    justify-content: left;
    padding-left:1em;
    position:relative;
    text-transform: none;
    font-size: 1rem;
    font-weight: 400;
    margin-bottom: .5em;
    text-align: left;
    width: 100%;
}

h3 {
    text-transform: uppercase;
    color: var(--magenta);
    margin-bottom: .6rem;
    font-size: 1.2em;
}
div{
    margin-bottom: 3em;
}
span{
    background: var(--violeta2);
    border-radius: 5px;
    padding: .3em;
    font-size: .8em;
    color: white;
    margin-left: .5em;
}
</style>
    