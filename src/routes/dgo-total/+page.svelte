<script>
    import ChannelGrid from '$lib/components/features/ChannelGrid.svelte';
    import liteChannels from '$lib/data/dgo-lite-channels.json';
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
    <p class='p1'>Tu Plan Básico será migrado automáticamente el día 31/05 a partir de las primeras horas de la tarde al Plan DGO Total. Esta es la nueva grilla de DGO Total:</p>
    <ChannelGrid channels={liteChannels} />

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
</style>
