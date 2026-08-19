<script>
// Dibuja el cuerpo de una novedad. `parseCuerpo` devuelve datos, no HTML, asi
// que Svelte escapa el texto solo: nada de lo que se cargue en el panel puede
// inyectar markup en la pagina.
import { parseCuerpo } from '$lib/novedades.js';

let { texto = '' } = $props();

const parrafos = $derived(parseCuerpo(texto));
</script>

{#each parrafos as tramos}
    <p>
        {#each tramos as tramo}
            {#if tramo.tipo === 'link'}
                <a href={tramo.valor} target="_blank" rel="noopener noreferrer">{tramo.valor}</a>
            {:else}{tramo.valor}{/if}
        {/each}
    </p>
{/each}

<style>
p {
    margin: 0 0 1em;
    line-height: 1.7;
}

a {
    color: var(--violeta2);
    overflow-wrap: anywhere;
}
</style>
