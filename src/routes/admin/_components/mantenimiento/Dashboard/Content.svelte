<script>
import EncuestaDeCalidad from "./encuestas/EncuestaDeCalidad.svelte";
import Ruleta from "./ruleta/Ruleta.svelte";
import Precios from "./precios/Precios.svelte";
import Novedades from "./novedades/Novedades.svelte";
import Trabajos from "./trabajos/Trabajos.svelte";
import Tecnicos from "./tecnicos/Tecnicos.svelte";
import Conectarlaciudad from "./conectarlaciudad/Conectarlaciudad.svelte";
import SorteoConectarlaciudad from "./conectarlaciudad/SorteoConectarlaciudad.svelte";
import TolosanoCodigos from "./tolosano/TolosanoCodigos.svelte";
import Llamenme from "./llamenme/Llamenme.svelte";

let {selected=false} = $props();
</script>

<section>
    {#if selected}
        {#if selected.startsWith('formulario')}
            <EncuestaDeCalidad {selected}></EncuestaDeCalidad>
        {:else if selected === 'ruleta'}
            <Ruleta></Ruleta>
        {:else if selected === 'conectarlaciudad'}
            <Conectarlaciudad></Conectarlaciudad>
        {:else if selected === 'sorteo-conectarlaciudad'}
            <SorteoConectarlaciudad></SorteoConectarlaciudad>
        {:else if selected === 'tolosano'}
            <TolosanoCodigos></TolosanoCodigos>
        {:else if selected === 'precios'}
            <Precios></Precios>
        {:else if selected === 'novedades'}
            <Novedades></Novedades>
        {:else if selected === 'trabajos'}
            <Trabajos></Trabajos>
        {:else if selected === 'tecnicos'}
            <Tecnicos></Tecnicos>
        {:else if selected === 'llamenme'}
            <Llamenme></Llamenme>
        {/if}
    {/if}
</section>
