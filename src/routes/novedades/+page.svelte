<script>
import { MetaTags } from 'svelte-meta-tags';
import NovedadCard from '$lib/components/novedades/NovedadCard.svelte';

let { data } = $props();
</script>

<MetaTags
    title="Novedades | Sista"
    description="Novedades, promociones y anuncios de Sista."
    robots="index, follow"
></MetaTags>

<div class="cont">
    <h1>Novedades</h1>

    {#if data.novedades.length === 0}
        <p class="vacio">Todavía no hay novedades publicadas.</p>
    {:else}
        <div class="grilla">
            {#each data.novedades as novedad (novedad.id)}
                <NovedadCard {novedad}></NovedadCard>
            {/each}
        </div>
    {/if}
</div>

<style>
.cont {
    max-width: 68em;
    width: 90%;
    margin: 3em auto 6em;
}

h1 {
    color: var(--violeta1);
    margin-bottom: 1.2em;
}

.grilla {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5em;
}

.vacio {
    color: #6b7280;
}

@media (min-width: 40em) {
    .grilla {
        grid-template-columns: repeat(2, 1fr);
    }
}

@media (min-width: 62em) {
    .grilla {
        grid-template-columns: repeat(3, 1fr);
    }
}
</style>
