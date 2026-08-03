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
import Cartera from "./cartera/Cartera.svelte";
import { seccionPermitida } from '$lib/adminPermisos.js';

let {selected=false, record=null} = $props();

// `selected` puede llegar apuntando a una seccion que el usuario ya no tiene
// habilitada: el Sidebar filtra lo que muestra, pero no controla `selected`
// (es del Dashboard), y nada impide que quede un valor viejo -por ejemplo si
// los permisos cambiaron en caliente, o si en el futuro `selected` se
// persiste entre sesiones. Sin esta guarda, esta rama renderizaria el
// componente igual.
const permitido = $derived(!selected || seccionPermitida(selected, record?.permisos));
</script>

<section>
    {#if selected && !permitido}
        <p class="sin-permiso">No tenés permiso para ver esta sección.</p>
    {:else if selected}
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
        {:else if selected === 'cartera'}
            <Cartera></Cartera>
        {/if}
    {/if}
</section>

<style>
.sin-permiso {
    padding: 2em;
    color: #6b7280;
}
</style>
