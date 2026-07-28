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
                <div class="icons">
                    <div class="img"
                        class:mono={o.mono}
                        class:rounded={o.rounded}
                        style={o.mono
                            ? `-webkit-mask-image:url(/images/pago/${o.pic});mask-image:url(/images/pago/${o.pic})`
                            : `background-image:url(/images/pago/${o.pic})`}
                    ></div>
                    {#if o.pic2}
                        <div class="img"
                            class:rounded={o.rounded}
                            style="background-image:url(/images/pago/{o.pic2})"
                        ></div>
                    {/if}
                </div>
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
.icons{
    display:flex;
    align-items:center;
    gap:.4em;
    margin:0 .8em 0 0;
    flex-shrink:0;
}
.img{
    width:1.5em;
    height:1.5em;
    margin:0;
    background-size: contain;
    background-position: center;
    background-repeat: no-repeat;
    flex-shrink:0;
}
.img.rounded{
    border-radius: .3em;
}
.img.mono{
    background-image: none;
    background-color: var(--violeta1);
    -webkit-mask-size: contain;
    mask-size: contain;
    -webkit-mask-position: center;
    mask-position: center;
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
}
button:hover .img.mono{
    background-color: white;
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
    border-radius: 1rem;
    border-width: 1px;
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
    