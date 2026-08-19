<script>
// Carrusel de novedades del inicio.
//
// Los datos se traen desde el NAVEGADOR y no con un `load` de servidor a
// proposito: el home esta prerenderizado (`prerender = true` en
// `src/routes/+layout.js`) y tiene que seguir estandolo. Es el mismo patron
// que `src/routes/precios/+page.svelte`.
import { onDestroy, onMount } from 'svelte';
import { pb } from '$lib/pocketbase';
import { ordenarNovedades } from '$lib/novedades.js';
import NovedadCard from '$lib/components/novedades/NovedadCard.svelte';

const MAX = 5;
const INTERVALO_MS = 8000;

let novedades = $state([]);
let count = $state(0);
let tam = $state(0);
let interval = null;

onMount(async () => {
    try {
        const items = await pb.collection('novedades').getFullList({ filter: '(publicada=true)' });
        novedades = ordenarNovedades(items)
            .slice(0, MAX)
            .map((n) => ({
                id: n.id,
                slug: n.slug,
                titulo: n.titulo,
                fecha: n.fecha,
                bajada: n.bajada ?? '',
                cuerpo: n.cuerpo ?? '',
                imagen: n.imagen ? pb.files.getURL(n, n.imagen, { thumb: '600x400' }) : null
            }));
    } catch (error) {
        // Si PocketBase no responde, la seccion no se muestra y el resto del
        // home queda intacto.
        console.error('[novedades] no se pudieron cargar en el home:', error);
        novedades = [];
    }

    // Con una sola novedad no hay nada que rotar.
    if (novedades.length > 1) {
        interval = setInterval(
            () => (count = count < novedades.length - 1 ? count + 1 : 0),
            INTERVALO_MS
        );
    }
});

onDestroy(() => clearInterval(interval));
</script>

{#if novedades.length > 0}
    <section>
        <div class="background2"></div>
        <div class="cont">
            <h4>Novedades</h4>
            <div class="inner">
                <div class="carousel" style="transform: translateX(-{tam * count}px)">
                    {#each novedades as novedad (novedad.id)}
                        <div bind:clientWidth={tam} class="slide">
                            <NovedadCard {novedad} orientacion="horizontal"></NovedadCard>
                        </div>
                    {/each}
                </div>
            </div>
        </div>
        <a class="ver-todas" href="/novedades/">Ver todas las novedades</a>
    </section>
{/if}

<style>
h4 {
    position: absolute;
    top: 0;
    left: 50%;
    background: var(--magenta);
    z-index: 10;
    color: white;
    border-radius: 0.3em;
    font-size: 0.8em;
    transform: translate(-50%, -50%);
    margin: 0;
    font-weight: 600;
    padding: 0.2em 1em;
}

.cont {
    max-width: 30em;
    width: 80%;
    margin: 0 auto;
    position: relative;
}

.slide {
    min-width: 100%;
}

.carousel {
    display: flex;
    flex-flow: row nowrap;
    width: 100%;
    transition: all ease-in-out 600ms;
}

.inner {
    max-width: 100%;
    overflow-x: hidden;
    padding: 0.6em 0;
}

section {
    position: relative;
    padding: 2em 0 3em;
}

.background2 {
    height: 50%;
    width: 100%;
    position: absolute;
    bottom: 0;
    background: var(--violeta1);
    border-radius: 1em 1em 0 0;
}

.ver-todas {
    position: relative;
    z-index: 10;
    display: block;
    text-align: center;
    margin-top: 1.5em;
    color: white;
    font-size: 0.9em;
    font-weight: 600;
    text-decoration: none;
}

.ver-todas:hover {
    text-decoration: underline;
}
</style>
