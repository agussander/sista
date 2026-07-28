<script>
    import { onMount } from 'svelte';
    import { MetaTags } from 'svelte-meta-tags';
    import { pb } from '$lib/pocketbase';
    import ChannelGrid from '$lib/components/features/ChannelGrid.svelte';
    import { serviceByKey } from '$lib/components/tv/tvData.js';
    import TvPriceSummary from '$lib/components/tv/TvPriceSummary.svelte';
    import TvServicesSection from '$lib/components/tv/TvServicesSection.svelte';

    const service = serviceByKey('dgo');

    let precios = $state({});
    let loading = $state(true);

    onMount(async () => {
        try {
            const record = await pb.collection('precios').getFirstListItem('');
            if (record) precios = record;
        } catch (e) {
            console.error('Error cargando precios desde PocketBase:', e);
        } finally {
            loading = false;
        }
    });
</script>

<MetaTags
    title="DGO (DIRECTV GO) · TV en vivo y on demand | Sista"
    description="DGO, el servicio de streaming de DirecTV: canales en vivo, deportes y contenido on demand. Sumalo a tu Internet de Sista."
    openGraph={{
        type: 'website',
        images: [
            {
                url: 'https://sista.com.ar/images/tv/logo-dgo-meta.png',
                width: 1200,
                height: 630,
                alt: 'DGO'
            }
        ]
    }}
    twitter={{
        cardType: 'summary_large_image',
        image: 'https://sista.com.ar/images/tv/logo-dgo-meta.png',
        imageAlt: 'DGO'
    }}
/>

<svelte:head>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
        href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap"
        rel="stylesheet"
    />
</svelte:head>

<section>
    <img class="logo" src="/images/logo-dgo.svg" alt="Logo de DGO">

    <TvPriceSummary {service} {precios} />

    <ChannelGrid />

    <div id="dispositivos-compatibles" class="dispositivos-section">
        <h2>Dispositivos compatibles</h2>
        <img
            class="compatibilidad-img"
            src="/images/tv/compatibiliad-DGO.png"
            alt="Dispositivos compatibles con DGO"
            loading="lazy"
        >
    </div>

    <div class="cta">
        <a href="https://wa.me/5492213541906?text=Hola!%20Quiero%20información%20sobre%20DGO" target="_blank" class="btn-wsp">
            <span class="wsp-icon"></span>
            Consultar por WhatsApp
        </a>
    </div>

    <div class="otras-opciones">
        <h2>Ver otras opciones</h2>
        <TvServicesSection {precios} {loading} cardsId="otras-cards" />
    </div>
</section>

<style>
    section{
        width: 100vw;
        padding: 6em 1em 2em;
        justify-content: center;
    }
    .otras-opciones {
        max-width: 64rem;
        margin: 5em auto 0;
    }
    .otras-opciones h2 {
        text-align: center;
        color: var(--violeta1);
        font-size: 2em;
        margin-bottom: 1.5em;
        text-transform: uppercase;
    }
    .logo{
        width: 100%;
        max-width: unset;
        height: 5em;
        margin-bottom: 2em;
    }
    img{
        width: 100%;
        max-width: 30em;
    }
    .cta{
        display: flex;
        justify-content: center;
        margin-top: 3em;
        margin-bottom: 2em;
    }
    .btn-wsp {
        display: inline-flex;
        align-items: center;
        gap: 0.8em;
        background: var(--verde);
        color: var(--violeta1);
        text-decoration: none;
        border-radius: 100px;
        padding: 1em 2em;
        font-size: 1em;
        font-weight: 700;
        text-transform: uppercase;
        box-shadow: 0 0.3em 1em rgba(0, 0, 0, 0.2);
        transition: all 0.3s ease;
    }
    .btn-wsp:hover {
        transform: translateY(-0.2em);
        box-shadow: 0 0.5em 1.5em rgba(0, 0, 0, 0.3);
        opacity: 1;
    }
    .wsp-icon {
        background: url("/images/wsp-violet.svg") no-repeat;
        background-size: cover;
        width: 2em;
        height: 2em;
    }
    .dispositivos-section {
        margin-top: 2em;
        padding: 3em 1em;
        max-width: 60em;
        margin-left: auto;
        margin-right: auto;
    }
    .dispositivos-section h2 {
        text-align: center;
        color: var(--violeta1);
        font-size: 2em;
        margin-bottom: 2em;
        text-transform: uppercase;
    }
    .compatibilidad-img {
        display: block;
        max-width: 55em;
        margin: 0 auto;
    }
</style>