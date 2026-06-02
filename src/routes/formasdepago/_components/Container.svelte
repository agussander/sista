<script>
import { browser } from '$app/environment';
import { page } from '$app/stores';
import { get } from 'svelte/store';
import { onSelect, show } from "$lib/stores";
import { mediosDePago } from './index';

import SelectMedio from "./SelectMedio.svelte";
import ShowMedio from "./ShowMedio.svelte";

$: if (browser) {
    const sp = $page.url.searchParams;
    const gs = sp.get('g');
    const os = sp.get('o');
    if (gs !== null && gs !== '' && os !== null && os !== '') {
        const gi = parseInt(gs, 10);
        const oi = parseInt(os, 10);
        const groups = get(mediosDePago);
        if (!Number.isNaN(gi) && !Number.isNaN(oi) && groups[gi]?.opciones?.[oi]) {
            show.set([groups[gi], groups[gi].opciones[oi]]);
            onSelect.set(true);
        } else {
            onSelect.set(false);
        }
    } else {
        onSelect.set(false);
    }
}

</script>
<div class="card">
    <div class="cont" style="transform: translateX({$onSelect?  "-100%" : "0"})">
        <div  class="col">
            <SelectMedio></SelectMedio>
        </div>
        <div  class="col">
            <ShowMedio></ShowMedio>
        </div>
    </div>
</div>

<style>
.card {
    background: white;
    box-shadow: 0px 0px .5em rgba(100, 100, 100, .5);
    border-radius: 1rem;
    margin: 0 auto 2em;
    max-width: 32em;
    overflow:hidden;
    padding: 1em 0;

}

.col {
    min-width:100%;
    padding: 1em 1.5em;
}

.cont{
    display:flex;
    max-width:100%;
}
@media (min-width: 700px){
    .card{
        padding: 1.5em 1em;
    }
}
</style>
