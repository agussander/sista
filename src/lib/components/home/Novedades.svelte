<script>
// Carrusel de novedades del inicio.
//
// Los datos se traen desde el NAVEGADOR y no con un `load` de servidor a
// proposito: el home esta prerenderizado (`prerender = true` en
// `src/routes/+layout.js`) y tiene que seguir estandolo. Es el mismo patron
// que `src/routes/precios/+page.svelte`.
//
// El scroll es nativo (scroll-snap), no manejado por JS: en mobile se ve una
// tarjeta entera y un pedacito de la siguiente, y en desktop el snap avanza
// de a dos (ver `.slide:nth-child(odd)` en el media query).
import { onMount } from 'svelte';
import { pb } from '$lib/pocketbase';
import { ordenarNovedades } from '$lib/novedades.js';
import NovedadCard from '$lib/components/novedades/NovedadCard.svelte';

const MAX = 5;

let novedades = $state([]);

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
});
</script>

{#if novedades.length > 0}
    <section>
        <div class="background2"></div>
        <h2>Novedades</h2>
        <div class="cont">
            <div class="carousel">
                {#each novedades as novedad (novedad.id)}
                    <div class="slide">
                        <NovedadCard {novedad}></NovedadCard>
                    </div>
                {/each}
            </div>
        </div>
        <a class="ver-todas" href="/novedades/">Ver todas las novedades</a>
    </section>
{/if}

<style>
h2 {
    position: relative;
    z-index: 10;
    margin: 0 0 1em;
}

.cont {
    max-width: 80em;
    width: 92%;
    margin: 0 auto;
    position: relative;
}

.carousel {
    display: flex;
    gap: 1em;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    scroll-behavior: smooth;
    padding: 0.6em 0 1em;
    scrollbar-width: none;
}

.carousel::-webkit-scrollbar {
    display: none;
}

.slide {
    flex: 0 0 85%;
    scroll-snap-align: start;
}

@media (min-width: 900px) {
    .slide {
        flex: 0 0 30%;
        scroll-snap-align: none;
    }

    .slide:nth-child(odd) {
        scroll-snap-align: start;
    }
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
