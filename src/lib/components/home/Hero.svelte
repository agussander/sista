<script>
    import AnimatedLines from '$lib/components/features/AnimatedLines.svelte';
    import LlamenmeForm from './LlamenmeForm.svelte';
    import { fade, fly } from 'svelte/transition';
    import { onMount } from 'svelte';
    import { scrollElement, setGlobalOptions } from 'svelte-scrolling';
    import { pb } from '$lib/pocketbase';
    import { computeInCallWindow } from '$lib/llamenme/visibility.js';
    import { fetchOverride } from '$lib/llamenme/config.js';

    setGlobalOptions({offset: -100});

    let mounted = false;
    // El form "quiero que me llamen" se muestra siempre. inCallWindow decide si,
    // al enviar, se avisa directo (dentro del horario 9–16:40 L–V ART, o forzado
    // "abierto") o se abre el modal de preferencia (fuera de horario / "cerrado").
    // Default con horario real hasta que llega el override del admin.
    let inCallWindow = computeInCallWindow('auto');

    const handleChipClick = () => {
        scrollElement('cobertura');
    };

    onMount(async () => {
        mounted = true;
        const override = await fetchOverride(pb);
        inCallWindow = computeInCallWindow(override);
    });
</script>

<section class="hero-section">
    <div class="hero-content">
        <div class="text">
            {#if mounted}
                <img class="logo-sista" src="/images/logo-sista.svg" alt="logo-sista"
                     transition:fade={{ duration: 600, delay: 0 }}>
                <h1 transition:fly={{ y: 30, duration: 700, delay: 200 }}>Internet por <br> Fibra Óptica</h1>
                <div class="wifi-tv" transition:fly={{ y: 30, duration: 700, delay: 400 }}>
                    <img class="icon-tv" src="/images/SVG/tv-green.svg" alt="icono-tv">
                    <img class="icon-wifi" src="/images/SVG/wifi-green.svg" alt="icono-wifi">
                    <p>WiFi + TV</p>
                </div>
                <div class="location-chips" transition:fly={{ y: 30, duration: 700, delay: 600 }}>
                    <span role="button" tabindex="0" onclick={handleChipClick} onkeydown={handleChipClick}>
                        <img class="location-icon" src="/images/icon-location-grey.svg" alt="Ubicación">
                        Punta Lara
                    </span>
                    <span role="button" tabindex="0" onclick={handleChipClick} onkeydown={handleChipClick}>
                        <img class="location-icon" src="/images/icon-location-grey.svg" alt="Ubicación">
                        Ensenada
                    </span>
                    <span role="button" tabindex="0" onclick={handleChipClick} onkeydown={handleChipClick}>
                        <img class="location-icon" src="/images/icon-location-grey.svg" alt="Ubicación">
                        Tolosa
                    </span>
                    <span role="button" tabindex="0" onclick={handleChipClick} onkeydown={handleChipClick}>
                        <img class="location-icon" src="/images/icon-location-grey.svg" alt="Ubicación">
                        El dique
                    </span>
                    <span role="button" tabindex="0" onclick={handleChipClick} onkeydown={handleChipClick}>
                        <img class="location-icon" src="/images/icon-location-grey.svg" alt="Ubicación">
                        Campamento
                    </span>
                    <span class="ver-todos" role="button" tabindex="0" onclick={handleChipClick} onkeydown={handleChipClick}>
                        + más
                    </span>
                </div>
            {/if}
        </div>
        {#if mounted}
            <div class="form-col" transition:fly={{ y: 30, duration: 700, delay: 800 }}>
                <LlamenmeForm {inCallWindow} />
            </div>
        {/if}
    </div>
    <div class="lines-wrapper">
        <div class="lines-cont">
            <AnimatedLines />
        </div>
    </div>

</section>

<style>
    .hero-section {
        position: relative;
        width: 100%;
        height: 110dvh;
        /* Violeta siempre, en CSS plano (no depende del tamaño del SVG interno,
           que en mobile es más chico que el hero -- ver .lines-wrapper). */
        background: var(--violeta1);
        /* overflow-x: hidden; */
        /* overflow-y visible: al scrollear, el relleno gris del SVG puede extenderse
           un poco más allá del borde inferior del hero sin recortarse en línea recta. */
        overflow-y: visible;
        /* crea stacking context para que el wrapper de líneas (z-index:-10) se
           pinte ENCIMA de este fondo blanco y no detrás de él. */
        isolation: isolate;
    }
    .hero-content {
        position: relative;
        z-index: 1;
        display: flex;
        flex-direction: column;
        gap: 2em;
    }
    .form-col {
        position: relative;
        z-index: 2;
        padding: 0 2em;
    }
    .logo-sista{
        max-width: 10em;
    }
    /* El SVG de líneas cubre todo el hero para que el violeta llegue hasta arriba
       y el límite violeta/blanco caiga exactamente sobre la línea de afuera. */
    .lines-wrapper {
        position: absolute;
        inset: 0;
        z-index: -10;
    }
    .lines-cont {
        position: absolute;
        inset: 0;
        z-index: 10;
        overflow: hidden;
        /* Sangría: el SVG se agranda un poco más allá del contenedor (que
           recorta con overflow:hidden), así los extremos irregulares de las
           líneas (donde no terminan parejas) quedan ocultos fuera de la vista
           en vez de generar un borde recto feo en el límite del hero. */
        scale: 1.1;
    }
    /* Cuando floatUpDown baja el fill-blanco, el fondo violeta del hero asoma
       en el borde inferior del contenedor (franja fija en el bottom). Ancla
       estática con el gris de página, detrás del SVG. */
    .lines-cont::before {
        content: '';
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        height: 2rem;
        background: var(--background);
        z-index: 0;
        pointer-events: none;
    }
    .lines-cont :global(.animated-lines) {
        position: relative;
        z-index: 1;
    }
    h1 {
        font-size: 3rem;
        text-transform: uppercase;
        font-weight: 900;
        color: #fff;
        line-height: 1.2;
    }
    .wifi-tv p { color: #fff; }
    .text {
        position: relative;
        top: 4em;
        padding: 0 2em;
    }
    .wifi-tv {
        display: flex;
        align-items: center;
        gap: .5em;
        margin-bottom: 1em;
        img{
            width: 2rem;
        }
        p{
            font-size: 1rem;
            font-weight: 500;
        }
    }
    .location-chips {
        display: flex;
        flex-wrap: wrap;
        gap: .5em;
        span{
            background: #e9e9e9;
            padding: .2em .6em;
            border-radius: 100px;
            font-size: .9em;
            font-weight: 500;
            color: #5f5f5f;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: .25em;
            img{
                width: 1em;
                height: 1em;
            }
        }
        .ver-todos {
            font-size: .9em;
            font-weight: 500;
            background: #dddddd;
            border: none;
            display: flex;
            align-items: center;
            gap: 0;
        }
    }
    @media (max-width: 768px) {
        h1 {
            font-size: 2.5rem;
            top: 15%;
        }
        .text {
            padding: 0 1em;
        }
        .hero-section {
            height: auto;
            min-height: 130vh;
            padding-bottom: 3em;
            display: flex;
            flex-direction: column;
        }
        .hero-content {
            flex: 1;
        }
        .form-col {
            margin-top:6em;
            margin-bottom: 10em;
        }
        .text {
            top: 4em;
        }
        /* En mobile el hero-section es angosto y muy alto (contenido apilado
           + min-height:100vh), y el SVG estira con preserveAspectRatio="none"
           de forma independiente en X e Y -> con un contenedor tan alto en
           relación al ancho, la curva queda deforme (mucho más "parada" que
           en desktop). Achicamos el alto del contenedor de líneas -acercando
           su proporción ancho/alto a la de desktop- y lo anclamos abajo. El
           fondo violeta es CSS aparte (arriba), no depende de este tamaño. */
        .lines-wrapper{
            overflow-x: hidden;
        }
        .lines-cont {
            inset: auto 0 0 0;
            height: 30em;
        }
    }
    @media (min-width: 768px) {
        .hero-section{
            padding-top: 2em;
        }
        /* El SVG con relleno gris solo cubre la zona inferior del hero (como
           antes con bottom:-40%). Si ocupa todo el alto, el fill-blanco tapa
           el violeta CSS en la parte superior y se ve una franja clara. */
        .lines-wrapper,
        .lines-cont {
            inset: auto 0 -4em 0;
            height: calc(90% + 4em);
            top: 6em;
        }
        .text {
            top: 5em;
            left: 4em;
        }
        h1{
            font-size: 4rem;
        }
        .logo-sista{
            width: 12em;
        }
        .hero-content {
            flex-direction: row;
            align-items: center;
        }
        .form-col {
            flex: 1;
            display: flex;
            justify-content: center;
            margin-top: 10em;
        }
    }
</style>
