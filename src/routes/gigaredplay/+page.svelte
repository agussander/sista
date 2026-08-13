<script>
	import { SITE_ORIGIN } from '$lib/seo.js';
    import { onMount } from 'svelte';
    import { MetaTags } from 'svelte-meta-tags';
    import { pb } from '$lib/pocketbase';
    import ChannelGrid from '$lib/components/features/ChannelGrid.svelte';
    import gigaredplayChannels from '$lib/data/gigaredplay-channels.json';
    import { serviceByKey } from '$lib/components/tv/tvData.js';
    import TvPriceSummary from '$lib/components/tv/TvPriceSummary.svelte';
    import TvAvailability from '$lib/components/tv/TvAvailability.svelte';
    import TvServicesSection from '$lib/components/tv/TvServicesSection.svelte';

    const service = serviceByKey('gigared');

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
    title="Gigared Play · TV en vivo y on demand | Sista"
    description="Gigared Play: canales en vivo y contenido on demand para sumar a tu Internet de Sista."
    openGraph={{
        type: 'website',
        images: [
            {
                url: `${SITE_ORIGIN}/images/tv/logo-gigared-meta.png`,
                width: 1200,
                height: 630,
                alt: 'Gigared Play'
            }
        ]
    }}
    twitter={{
        cardType: 'summary_large_image',
        image: `${SITE_ORIGIN}/images/tv/logo-gigared-meta.png`,
        imageAlt: 'Gigared Play'
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
    <img class="logo" src="/images/tv/logo-gigared.png" alt="Logo de Gigared Play">

    <TvPriceSummary {service} {precios} />

    <ChannelGrid channels={gigaredplayChannels} accent="#b74d8d" />

    <div class="cta">
        <a href="https://wa.me/5492213541906?text=Hola!%20Quiero%20información%20sobre%20Gigared%20Play" target="_blank" class="btn-wsp">
            <span class="wsp-icon"></span>
            Consultar por WhatsApp
        </a>
    </div>

    <TvAvailability stores={['googleplay']} warnMagisXuper={true} />

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
    .cta{
        display: flex;
        justify-content: center;
        margin-top: 3em;
    }
    .logo{
        width: 100%;
        max-width: 20em;
        height: auto;
        margin: 0 auto 2em;
        display: block;
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
</style>

