<script>
	import Precios from './../../../routes/admin/_components/mantenimiento/Dashboard/precios/Precios.svelte';
    import AnimatedLines from '$lib/components/features/AnimatedLines.svelte';
    import LlamenmeForm from './LlamenmeForm.svelte';
    import { fade, fly } from 'svelte/transition';
    import { onMount } from 'svelte';
    import { scrollElement, setGlobalOptions,scrollTo } from 'svelte-scrolling';
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';

    setGlobalOptions({offset: -100});

    let mounted = false;

    const handleChipClick = () => {
        scrollElement('cobertura');
    };

    onMount(() => {
        mounted = true;
    });
</script>

<section class="hero-section">
    <div class="hero-content">
        <div class="text">
            {#if mounted}
                <img class="logo-sista" src="/images/Sista-logo-violeta.svg" alt="logo-sista"
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
                <LlamenmeForm />
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
        height: 100vh;

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
    .lines-wrapper {
        position: absolute;
        width: 100%;
        height: 100%;
        z-index: -10;
        overflow: hidden;
        bottom: -25%;
    }
    .lines-cont {
        scale: 1.1;
        position: absolute;
        width: 100%;
        height: 100%;
        z-index: 10;
        overflow: hidden;
    }
    h1 {
        font-size: 3rem;
        text-transform: uppercase;
        font-weight: 900;
        color: var(--magenta);
        line-height: 1.2;
    }
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
            min-height: 100vh;
            padding-bottom: 3em;
            display: flex;
            flex-direction: column;
        }
        .hero-content {
            flex: 1;
        }
        .form-col {
            margin-top: auto;
        }
        .text {
            top: 2em;
        }
    }
    @media (min-width: 768px) {
        .hero-section{
            padding-top: 2em;
        }
        .text {
            top: 4em;
            left: 4em;
        }
        h1{
            font-size: 4rem;
        }
        .logo-sista{
            width: 12em;
        }
        .lines-wrapper{
            bottom: -40%;
        }
        .hero-content {
            flex-direction: row;
            align-items: center;
        }
        .form-col {
            flex: 1;
            display: flex;
            justify-content: center;
            padding: 0;
        }

    }
</style>

