<script>
import { MetaTags } from 'svelte-meta-tags';
import CuerpoNovedad from '$lib/components/novedades/CuerpoNovedad.svelte';
import ContactButtons from '$lib/components/ui/ContactButtons.svelte';
import { formatFecha, resumenDe } from '$lib/novedades.js';
import { OG_IMAGE_DEFAULT } from '$lib/seo.js';

let { data } = $props();

const novedad = $derived(data.novedad);

// El fallback no es decorativo: `bajada` y `cuerpo` son opcionales, y con las
// dos vacias `resumenDe` devuelve '', con lo cual `svelte-meta-tags` no emite
// NINGUNA etiqueta de descripcion. Una novedad sin descripcion se comparte en
// WhatsApp sin texto, que es justo lo que esta pagina existe para evitar.
const descripcion = $derived(resumenDe(novedad, 200) || 'Novedades de Sista');

// La nota comparte con su propia imagen; sin ella, la de marca por defecto.
const imagenOg = $derived(novedad.imagenGrande || OG_IMAGE_DEFAULT);
</script>

<MetaTags
    title="{novedad.titulo} | Sista"
    description={descripcion}
    robots="index, follow"
    openGraph={{
        type: 'article',
        title: novedad.titulo,
        description: descripcion,
        siteName: 'Sista',
        images: novedad.imagenGrande
            ? [{ url: novedad.imagenGrande, alt: novedad.titulo }]
            : [{ url: OG_IMAGE_DEFAULT, width: 2500, height: 1307, alt: 'Sista' }]
    }}
    twitter={{
        cardType: 'summary_large_image',
        image: imagenOg,
        imageAlt: novedad.titulo
    }}
></MetaTags>

<article class="cont">
    <a class="volver" href="/novedades/">← Volver a novedades</a>

    <time datetime={novedad.fecha}>{formatFecha(novedad.fecha)}</time>
    <h1>{novedad.titulo}</h1>
    {#if novedad.bajada}<p class="bajada">{novedad.bajada}</p>{/if}

    {#if novedad.imagenGrande}
        <img src={novedad.imagenGrande} alt={novedad.titulo} fetchpriority="high" decoding="async">
    {/if}

    <div class="cuerpo">
        <CuerpoNovedad texto={novedad.cuerpo}></CuerpoNovedad>
    </div>

    <ContactButtons></ContactButtons>
</article>

<style>
.cont {
    max-width: 44em;
    width: 90%;
    margin: 3em auto 6em;
}

.volver {
    display: inline-block;
    margin-bottom: 2em;
    color: var(--violeta2);
    text-decoration: none;
    font-size: 0.9em;
}

.volver:hover {
    text-decoration: underline;
}

time {
    display: block;
    font-size: 0.85em;
    color: #6b7280;
    margin-bottom: 0.4em;
}

h1 {
    color: var(--violeta1);
    margin: 0 0 0.4em;
    line-height: 1.2;
}

.bajada {
    font-size: 1.15em;
    color: #444;
    line-height: 1.6;
    margin: 0 0 1.5em;
}

img {
    width: 100%;
    height: auto;
    border-radius: 0.6em;
    margin-bottom: 2em;
}

.cuerpo {
    margin-bottom: 3em;
}
</style>
