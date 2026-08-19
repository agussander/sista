<script>
// Tarjeta de novedad. La comparten el listado (`vertical`) y el carrusel del
// home (`horizontal` en pantallas anchas), para que las dos superficies no se
// despeguen visualmente cuando se toque una.
import { formatFecha, resumenDe } from '$lib/novedades.js';

let { novedad, orientacion = 'vertical' } = $props();

const resumen = $derived(resumenDe(novedad));
</script>

<a class="card {orientacion}" href="/novedades/{novedad.slug}/">
    {#if novedad.imagen}
        <!-- Sin imagen no se renderiza el bloque: un hueco gris se ve peor
             que una tarjeta solo de texto. -->
        <div class="img" style="background-image: url({novedad.imagen});"></div>
    {/if}
    <div class="texto">
        <time datetime={novedad.fecha}>{formatFecha(novedad.fecha)}</time>
        <h3>{novedad.titulo}</h3>
        {#if resumen}<p>{resumen}</p>{/if}
    </div>
</a>

<style>
.card {
    display: flex;
    flex-flow: column;
    background: white;
    border-radius: 0.6em;
    overflow: hidden;
    box-shadow: 0 0 0.5em rgba(133, 133, 133, 0.4);
    text-decoration: none;
    color: inherit;
    height: 100%;
    transition: transform ease 300ms, box-shadow ease 300ms;
}

.card:hover {
    transform: translateY(-0.25em);
    box-shadow: 0 0.3em 1em rgba(133, 133, 133, 0.55);
}

.img {
    background-position: center;
    background-size: cover;
    background-repeat: no-repeat;
    height: 11em;
    width: 100%;
    flex-shrink: 0;
}

.texto {
    padding: 1.2em 1.1em;
    display: flex;
    flex-flow: column;
    gap: 0.4em;
}

time {
    font-size: 0.8em;
    color: #6b7280;
}

h3 {
    margin: 0;
    font-size: 1.15em;
    font-weight: 600;
    color: var(--magenta);
    line-height: 1.3;
}

p {
    margin: 0;
    font-size: 0.9em;
    line-height: 1.5;
    color: #444;
}

@media (min-width: 700px) {
    .card.horizontal {
        flex-flow: row nowrap;
    }

    .card.horizontal .img {
        width: 55%;
        height: auto;
        min-height: 9em;
    }

    .card.horizontal .texto {
        justify-content: center;
    }
}
</style>
