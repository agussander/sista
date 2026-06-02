<script>
import { onMount, tick } from "svelte";
import { slide, fade, fly } from "svelte/transition";
import { navbarY } from "$lib/stores";
import MenuLinks from "./MenuLinks.svelte";
import {goto} from '$app/navigation'
import { scrollTo } from 'svelte-scrolling'
import {page} from '$app/stores'

let y;
let menu = false;
let scrollY = 0;
let h = 0;
let mounted = false;

$: navDown = (scrollY > h - 200) || ($page.url.pathname !== '/');

onMount(async () => {
    // Esperar un tick para que el estado se evalúe correctamente
    await tick();
    mounted = true;
    $navbarY = y;
});
</script>

<svelte:window bind:scrollY={scrollY} bind:innerHeight={h}></svelte:window>

{#if mounted}
    <div class="fixed-cont" style="height:{y-1}px">
        <nav class="navbar" class:down={navDown} transition:fly={{ y: -20, duration: 500 }}>
            <div class="flex" bind:clientHeight={y}>
                <img on:click={()=> goto('/')} class="logo" src="/images/Sista-logo-violeta.svg" alt="Sista logo">
                <div class="icons-cont">
                    <button type="button" on:click={()=>menu=!menu} class="menu-icon" aria-label="Abrir menú">
                        <span></span>
                        <span></span>
                        <span></span>
                    </button>
                    <a href="https://api.whatsapp.com/send?phone=5492213541906&text=Hola!%20Quisiera%20m%C3%A1s%20informaci%C3%B3n%20sobre%20Sista." class="wsp-icon" aria-label="Iniciar conversación en WhatsApp" target='_blank'></a>
                </div>
            </div>
        </nav>
    </div>
{/if}

{#if menu}
    <div class="menu-overlay" style={`padding-top:${(y || 0) + 12}px`}>
        <button type="button" class="menu-backdrop" aria-label="Cerrar menú" on:click={()=>menu=false}></button>
        <div class="menu-shell" transition:slide>
            <div class="menu-header">
                <span></span>
                <button type="button" class="close-btn" aria-label="Cerrar menú" on:click={()=>menu=false}></button>
            </div>

            <div class="menu-links">
                <MenuLinks></MenuLinks>
                <a class="menu-link" href="/formasdepago" on:click={()=>menu=false}>Formas de pago</a>
                <a class="menu-link" href="/acerca-de" on:click={()=>menu=false}>Sobre nosotros</a>
                <a class="menu-link" href="/precios" on:click={()=>menu=false}>Precios</a>
                <a class="menu-link" href="/tv" on:click={()=>menu=false}>TV</a>
            </div>

            <div class="menu-actions">
                <a href="https://api.whatsapp.com/send?phone=5492213541906&text=Hola!%20Quisiera%20m%C3%A1s%20informaci%C3%B3n%20sobre%20Sista." class="menu-chip primary" target='_blank'>
                    <span class="wsp-icon-inline"></span>
                    Iniciar conversación
                </a>
                <a href="https://clientes.sista.com.ar" target='_blank' class="menu-chip ghost">
                    Clientes
                </a>
            </div>
        </div>
    </div>
{/if}


<style>
nav {
    position: fixed;
    top: 1em;
    left: 1em;
    right: 1em;
    width: calc(100% - 2em);
    box-sizing: border-box;
    background: transparent;
    padding: 1em;
    margin: 0;
    z-index: 1000;
    transition: all ease 400ms;
    border-radius: 1.2em;
    .logo{
        opacity: 0;
    }
}

nav.down {
    padding: .8em .2em .8em 1em;
    background-color: white;
    .logo{
        opacity: 1;
    }
}

.menu-overlay {
    position: fixed;
    inset: 0;
    z-index: 1200;
    display: flex;
    justify-content: center;
    padding: 1.2em;
    align-items: flex-start;
    overflow-y: auto;
}

.menu-backdrop {
    position: absolute;
    inset: 0;
    border: none;
    background: rgba(0,0,0,.3);
    padding: 0;
    cursor: pointer;
}

.menu-shell {
    display: flex;
    flex-flow: column;
    gap: 1.2em;
    color: var(--violeta1);
    font-size: 1em;
    background: white;
    border-radius: 1.2em;
    padding: 1.6em;
    box-shadow: 0 1.6em 3.2em rgba(0,0,0,.15);
    width: min(24em, 100%);
    border: .08em solid rgba(102,37,124,.1);
    position: relative;
    isolation: isolate;
}

.menu-actions {
    display: flex;
    flex-direction: column;
    gap: .8em;
    width: 100%;
}

.menu-chip {
    width: 100%;
    text-align: center;
    padding: .9em 1.4em;
    border-radius: 999em;
    text-decoration: none;
    font-weight: 600;
    letter-spacing: .05em;
    border: .08em solid transparent;
    transition: transform 200ms ease, background 200ms ease, color 200ms ease;
}

.menu-chip.primary {
    background: var(--violeta1);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5em;
}

.menu-chip.ghost {
    background: transparent;
    color: var(--violeta1);
    border-color: rgba(102,37,124,.4);
}

.menu-chip:hover,
.menu-chip:focus-visible {
    transform: translateY(-.08em);
}

.menu-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    letter-spacing: .08em;
    font-size: .9em;
    color: var(--violeta1);
}

.close-btn {
    width: 2.2em;
    height: 2.2em;
    border-radius: 50%;
    border: .08em solid rgba(102,37,124,.3);
    background: transparent;
    position: relative;
    cursor: pointer;
}

.close-btn::before,
.close-btn::after {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    width: 1.2em;
    height: .08em;
    background: var(--violeta1);
    transform-origin: center;
}

.close-btn::before {
    transform: translate(-50%, -50%) rotate(45deg);
}

.close-btn::after {
    transform: translate(-50%, -50%) rotate(-45deg);
}

.menu-links {
    display: flex;
    flex-direction: column;
    gap: .6em;
}

.menu-links :global(span) {
    display: block;
    margin: 0;
    padding: .7em 0;
    font-size: 1.1em;
    color: var(--violeta1);
    letter-spacing: .03em;
    border-bottom: .05em solid rgba(102,37,124,.1);
}

.menu-links :global(span:last-child) {
    border-bottom: none;
}

.menu-link {
    display: block;
    text-decoration: none;
    padding: .7em 0;
    font-size: 1.1em;
    color: var(--violeta1);
    letter-spacing: .03em;
    border-top: .05em solid rgba(102,37,124,.1);
}

.menu-link:hover,
.menu-link:focus-visible {
    color: var(--violeta1);
    opacity: 0.7;
}

.flex {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.fixed-cont {
    width: 100%;
    background: transparent;
}

.logo {
    display: block;
    width: 9em;
    height: auto;
    cursor: pointer;
    transition: all ease 400ms;
    flex-shrink: 0;
}

.icons-cont {
    display: flex;
    align-items: center;
    gap: .5em;
}

.wsp-icon {
    background: url("/images/wsp-violet.svg")no-repeat;
    background-size: cover;
    background-position: center;
    width: 1.8em;
    height: 1.8em;
    display: inline-block;
    transition: background ease 400ms;
    margin-left: 1em;
    margin-right:0;
}

nav.down .wsp-icon {
    background: url("/images/wsp-violet.svg")no-repeat;
    background-size: cover;
    background-position: center;
    margin-right:1em
}

.wsp-icon-inline {
    background: url("/images/wsp-violet.svg")no-repeat;
    background-size: cover;
    background-position: center;
    width: 1.4em;
    height: 1.4em;
    display: inline-block;
    flex-shrink: 0;
    filter: brightness(0) invert(1);
}

.menu-icon {
    width: 1.8em;
    height: 1.5em;
    position: relative;
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 0;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 0.3em;
}

.menu-icon span {
    display: block;
    width: 100%;
    height: 0.22em;
    background: var(--violeta1);
    border-radius: 0.15em;
    transition: all ease 400ms;
}

</style>
