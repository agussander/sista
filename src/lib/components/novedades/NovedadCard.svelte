<script>
// Tarjeta de novedad. La comparten el listado y el carrusel del home, para
// que las dos superficies no se despeguen visualmente cuando se toque una.
import { formatFecha, resumenDe } from '$lib/novedades.js';

let { novedad } = $props();

const resumen = $derived(resumenDe(novedad));
</script>

<a class="card" href="/novedades/{novedad.slug}/">
    {#if novedad.imagen}
        <!-- Sin imagen no se renderiza el bloque: un hueco gris se ve peor
             que una tarjeta solo de texto.

             La url va entre comillas (como en el resto del repo): sin ellas,
             un parentesis en el nombre del archivo corta el token `url()` y el
             navegador descarta la regla entera, sin imagen ni error visible. -->
        <div class="img" style="background-image: url('{novedad.imagen}');"></div>
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
    align-items: stretch;
    justify-content: flex-start;
    gap: 0;
    background: white;
    border-radius: 0.6em;
    overflow: hidden;
    box-shadow: 0 0 0.5em rgba(133, 133, 133, 0.4);
    text-decoration: none;
    color: inherit;
    height: 100%;
}

.card:hover {
    /* Anula el fade de `a:hover` global: esta tarjeta no quiere efecto de hover. */
    opacity: 1;
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
    /* El h3 global fuerza mayusculas; el titulo de la novedad tiene que
       mostrarse tal cual se cargo. */
    text-transform: none;
}

p {
    margin: 0;
    font-size: 0.9em;
    line-height: 1.5;
    color: #444;
}
</style>
