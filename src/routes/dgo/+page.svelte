<script>
    import ChannelGrid from '$lib/components/features/ChannelGrid.svelte';
</script>

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
    <p class='p1'>DGO es el <strong>servicio de streaming de DirecTV</strong> que ofrece una completa programación online con canales en vivo, transmisiones deportivas, catálogo de contenido on demand, packs de deportes y películas y accesos a otras aplicaciones como Universal y Paramount+. Podés contratarlo de manera individual o junto con tu servicio de Internet de SISTA
        </p>
        <p>
        A continuación podés consultar la grilla de canales del plan FULL de DGO
    </p>
    <ChannelGrid />

    <img
        class="deportes-banner"
        src="https://cdn-cms74.hub.directvgo.com/documents/91224/96298/DGO-deportes-nov2025.jpg/061e24d6-03b0-3028-6ae0-1b7d1c5d92b2?t=1761602835313"
        alt="DGO Deportes: LaLiga, Copa Mundial FIFA 2026 y CONMEBOL Sudamericana en DSPORTS"
        loading="lazy"
    >

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
</section>

<style>
    section{
        width: 100vw;
        padding: 6em 1em 2em;
        justify-content: center;
    }
    p{
        max-width: 50em;
        margin: 0 auto;
    }
    .p1{
        font-size: 1.2em;
        margin-bottom: 1em;
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
    .deportes-banner{
        display: block;
        max-width: 55em;
        margin: 2em auto 0;
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