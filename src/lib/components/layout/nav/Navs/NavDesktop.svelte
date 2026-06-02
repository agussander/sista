<script>
import {page} from '$app/stores'
import {goto} from '$app/navigation'
import MenuLinks from './MenuLinks.svelte';
import { onMount, tick } from 'svelte';
import { fly } from 'svelte/transition';

// import * as animateScroll from "svelte-scrollto"

// import {scrollto} from "svelte-scrollto";

let scrollY = 0;
let h = 0;
let showMasMenu = false;
let masContainer;
let mounted = false;

$: navDown = (scrollY > h - 200) || ($page.url.pathname !== '/');
$: showLogo = navDown || ($page.url.pathname !== '/');

const handleLogo=()=>{
        goto("/");
}

const toggleMasMenu = () => {
    showMasMenu = !showMasMenu;
}

const closeMasMenu = () => {
    showMasMenu = false;
}

const handleMasLink = (path) => {
    goto(path);
    closeMasMenu();
}

onMount(async () => {
    // Esperar un tick para asegurar que el estado inicial esté correcto
    await tick();
    mounted = true;
    
    const handleClickOutside = (event) => {
        if (masContainer && !masContainer.contains(event.target)) {
            closeMasMenu();
        }
    };

    if (typeof window !== 'undefined') {
        document.addEventListener('click', handleClickOutside);
    }
    
    return () => {
        if (typeof window !== 'undefined') {
            document.removeEventListener('click', handleClickOutside);
        }
    };
});

</script>
<svelte:window bind:scrollY={scrollY} bind:innerHeight={h}></svelte:window>

{#if mounted}
    <nav class:down={navDown} transition:fly={{ y: -20, duration: 500 }}>
        <img on:click={handleLogo} class="logo" class:show={showLogo} src="/images/Sista-logo-violeta.svg" alt="Sista logo">
        <div class="center">
            <MenuLinks></MenuLinks>
            <div class="mas-container" bind:this={masContainer}>
                <button class="mas-button" on:click={toggleMasMenu} class:active={showMasMenu} aria-label="Abrir menú Más" aria-expanded={showMasMenu}>
                    Más
                    <svg class="dropdown-arrow" class:rotated={showMasMenu} width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
                {#if showMasMenu}
                    <div class="mas-dropdown">
                        <a href="/formasdepago" on:click={() => handleMasLink('/formasdepago')}>Formas de pago</a>
                        <a href="/acerca-de" on:click={() => handleMasLink('/acerca-de')}>Sobre nosotros</a>
                        <a href="/precios" on:click={() => handleMasLink('/precios')}>Precios</a>
                        <a href="/tv" on:click={() => handleMasLink('/tv')}>TV</a>
                    </div>
                {/if}
            </div>
            <a href="https://clientes.sista.com.ar" target="_blank">Clientes</a>
            <a target="_blank" href="https://api.whatsapp.com/send?phone=5492213541906&text=Hola!%20Quisiera%20m%C3%A1s%20informaci%C3%B3n%20sobre%20Sista." class="wsp-icon" alt="Iniciar conversación en whatsapp"></a>
        </div>
    </nav>
{/if}

<style>
nav {
    position: fixed;
    top: 1em;
    left: 50%;
    width: calc(100% - 10em);
    transform: translateX(-50%);
    display: flex;
    justify-content: flex-end;
    align-items: center;
    transition: all ease 400ms;
    z-index: 1000;
    background: transparent;
    padding: 1em 1em;
    box-sizing: border-box;
    margin: 0;
    min-height: auto;
    border-radius: 1em;
}
.down{
    background: white;
    box-shadow: 0 0.4em .5em rgba(0, 0, 0, 0.05);
}
.center{
    display: flex;
    align-items: center;
    animation: slideInRight 0.3s ease-out;
}

@keyframes slideInRight {
    from {
        opacity: 0;
        transform: translateX(1em);
    }
    to {
        opacity: 1;
        transform: translateX(0);
    }
}

.logo {
    display: none;
    transition: all ease 400ms;
    cursor:pointer;
    width: 9em;
    padding-left: 0;
    padding-top: 0;
    padding-right: auto;
    margin-right: auto;
    filter: none;
    opacity: 0;
    position: absolute;
    left: 2em;
}

.logo.show {
    display: block;
    opacity: 1;
    animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
    from {
        opacity: 0;
    }
    to {
        opacity: 1;
    }
}

a {
    color: var(--violeta1);
    font-size: 1rem;
    margin-left: 1.5em;
    cursor:pointer;
    transition: color ease 400ms;
}

.mas-container {
    position: relative;
    margin-left: 1.5em;
}

.mas-button {
    color: var(--violeta1);
    font-size: 1rem;
    background: none;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.4em;
    padding: 0;
    transition: color ease 400ms;
    font-family: inherit;
    font-weight: 500;
}

.mas-button:hover {
    color: var(--violeta1);
}

.dropdown-arrow {
    transition: transform ease 400ms;
}

.dropdown-arrow.rotated {
    transform: rotate(180deg);
}

.mas-dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 0.5em;
    background: white;
    border-radius: 0.6em;
    box-shadow: 0 0.4em 1em rgba(0, 0, 0, 0.15);
    padding: 0.5em 0;
    min-width: 12em;
    z-index: 1001;
    animation: slideDown 0.2s ease-out;
}

@keyframes slideDown {
    from {
        opacity: 0;
        transform: translateY(-0.5em);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.mas-dropdown a {
    display: block;
    padding: 0.7em 1.2em;
    margin: 0;
    color: var(--violeta1);
    text-decoration: none;
    transition: background ease 200ms;
}

.wsp-icon {
    display:inline-block;
    background: url("/images/wsp-violet.svg")no-repeat;
    background-size: cover;
    background-position: center;
    width: 1.8em;
    height: 1.8em;
    margin-right: 0;
    transition: background ease 400ms;
}

</style>
