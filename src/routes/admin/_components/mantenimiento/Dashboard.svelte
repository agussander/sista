<script>
import { onMount, onDestroy } from 'svelte';
import { goto } from '$app/navigation';
import { pb } from '$lib/pocketbase';
import { page } from '$app/stores';
import { token, record } from '../adminStore';
import { llamenmeStore, primeAudio } from './Dashboard/llamenme/llamenmeStore.svelte.js';
import Sidebar from './Dashboard/Sidebar.svelte';
import Content from './Dashboard/Content.svelte';
import { PANEL_SECCIONES } from './Dashboard/panelSecciones.js';
import { seccionPermitida } from '$lib/adminPermisos.js';

let selected = $derived($page.params.section ?? null);

// Misma lista y mismo filtro que usa el Sidebar (ver panelSecciones.js): antes
// esta grilla tenia sus cinco botones hardcodeados aparte, sin filtrar por
// permiso, y por eso quedo sin "Cartera de clientes" cuando se agrego. Con una
// sola fuente, la grilla y el sidebar nunca vuelven a desincronizarse.
const seccionesPermitidas = $derived(
    PANEL_SECCIONES.filter((item) => seccionPermitida(item.content, $record?.permisos))
);

// Realtime de "Quiero que me llamen": vive a nivel admin para que el sonido y el
// puntito funcionen estés en la sección que estés. Solo para quien tenga el
// permiso: el filtro de permisos tapa los botones, no la suscripción, asi que
// sin este guardia a un asesor al que le sacaban "llamenme" le desaparecia la
// seccion pero le seguia sonando el gallo con cada pedido nuevo.
onMount(() => {
    if (!seccionPermitida('llamenme', $record?.permisos)) return;
    llamenmeStore.start();
    llamenmeStore.loadOverride();
    // El autoplay de audio requiere un gesto previo del usuario: lo habilitamos
    // con el primer click en cualquier parte del admin.
    const onFirstClick = () => primeAudio();
    window.addEventListener('click', onFirstClick, { once: true });
    return () => window.removeEventListener('click', onFirstClick);
});

onDestroy(() => llamenmeStore.stop());

// Al abrir el panel, marcamos como leído (apaga el puntito).
$effect(() => {
    if (selected === 'llamenme') llamenmeStore.markRead();
});
const SIDEBAR_COLLAPSED_KEY = 'admin.sidebarCollapsed';
let sidebarCollapsed = $state(
    typeof localStorage !== 'undefined' && localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
);
let sidebarOpen = $state(false);
let windowWidth = $state(0);

$effect(() => {
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? '1' : '0');
    }
});

const logout = async()=>{
    pb.authStore.clear();
    $token=null;
}

const handlePanelSelect = (option) => {
    goto(`/admin/${option}`, { noScroll: true, keepFocus: true });
    sidebarOpen = false; // Cerrar sidebar en móvil al seleccionar
}

const toggleSidebar = () => {
    sidebarCollapsed = !sidebarCollapsed;
}

const toggleMobileSidebar = () => {
    sidebarOpen = !sidebarOpen;
}

const closeMobileSidebar = () => {
    sidebarOpen = false;
}

// Cerrar sidebar en móvil cuando cambia la selección
$effect(() => {
    if (selected && windowWidth <= 768) {
        sidebarOpen = false;
    }
});

</script>

<svelte:window bind:innerWidth={windowWidth} />

<section class="dashboard-layout">
    <div 
        class="sidebar-overlay" 
        class:active={sidebarOpen} 
        onclick={closeMobileSidebar}
        onkeydown={(e) => e.key === 'Escape' && closeMobileSidebar()}
        role="button"
        tabindex={sidebarOpen ? 0 : -1}
        aria-label="Cerrar menú"
        aria-hidden={!sidebarOpen}
    ></div>
    <aside class="sidebar" class:collapsed={sidebarCollapsed} class:mobile-open={sidebarOpen}>
        <div class="sidebar-header">
            <button class="sidebar-toggle" onclick={toggleSidebar} aria-label="Colapsar/Expandir sidebar">
                {#if sidebarCollapsed}
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="m9 18 6-6-6-6"/>
                    </svg>
                {:else}
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="m15 18-6-6 6-6"/>
                    </svg>
                {/if}
            </button>
            {#if !sidebarCollapsed}
                <h1 class="sidebar-title">Panel Admin</h1>
            {/if}
        </div>
        <Sidebar {selected} {logout} record={$record} collapsed={sidebarCollapsed} llamenmeUnread={llamenmeStore.unread}></Sidebar>
    </aside>
    <main class="main-content">
        <button class="mobile-menu-btn" onclick={toggleMobileSidebar} aria-label="Abrir menú">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
        </button>
        {#if !selected}
            <div class="home-screen">
                {#if seccionesPermitidas.length === 0}
                    <p class="sin-permisos">
                        Todavía no tenés secciones habilitadas. Pedile a un administrador que te asigne
                        permisos en tu usuario.
                    </p>
                {:else}
                    <div class="panel-menu">
                        {#each seccionesPermitidas as item}
                            <button class="panel-btn" onclick={() => handlePanelSelect(item.content)}>
                                <span class="panel-icon-wrap">
                                    {#if item.content === 'llamenme' && llamenmeStore.unread > 0}
                                        <span class="notif-dot" aria-label="Nuevas solicitudes"></span>
                                    {/if}
                                    <span class="panel-icon">{@html `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${item.icon}</svg>`}</span>
                                </span>
                                <span class="panel-label">{item.title}</span>
                            </button>
                        {/each}
                    </div>
                {/if}
            </div>
        {:else}
            <Content {selected} record={$record} />
        {/if}
    </main>
</section>




<style>
.dashboard-layout {
    display: flex;
    align-items: stretch;
    min-height: 100vh;
    width: 100%;
    background: #f7f7fa;
}
.sidebar {
    width: 17em;
    min-width: 17em;
    background: linear-gradient(180deg, #f7f6fb 60%, #ece9f6 100%);
    border-right: 1.5px solid #e0e0e0;
    box-shadow: 2px 0 8px rgba(0,0,0,0.04);
    height: 100vh;
    position: sticky;
    top: 0;
    left: 0;
    display: flex;
    flex-direction: column;
    z-index: 10;
    transition: width 0.3s ease, min-width 0.3s ease;
    overflow: hidden;
}
.sidebar.collapsed {
    width: 3.5em;
    min-width: 3.5em;
}

.sidebar-header {
    display: flex;
    align-items: center;
    padding: 1.5em 1.2em;
    border-bottom: 1px solid rgba(224, 224, 224, 0.5);
    gap: 0.8em;
    min-height: 4.5em;
}
.sidebar.collapsed .sidebar-header {
    justify-content: center;
    padding: 1.5em 0.6em;
}

.sidebar-title {
    font-size: 1.2em;
    font-weight: 600;
    color: var(--violeta2);
    margin: 0;
    white-space: nowrap;
}

.sidebar-toggle {
    background: var(--violeta2);
    color: white;
    border: none;
    border-radius: 0.5em;
    width: 2.2em;
    height: 2.2em;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(112,40,162,0.2);
    transition: all 0.2s ease;
    flex-shrink: 0;
}
.sidebar-toggle:hover {
    background: #5a1e7a;
    box-shadow: 0 3px 8px rgba(112,40,162,0.3);
    transform: scale(1.05);
}
.main-content {
    flex: 1 1 0%;
    min-width: 0;
    padding: 2em;
    background: #faf9fd;
    overflow-x: auto;
}
.mobile-menu-btn {
    display: none;
    position: fixed;
    top: 1em;
    left: 1em;
    z-index: 100;
}

.sidebar-overlay {
    display: none;
}

@media (max-width: 900px) {
    .sidebar {
        min-width: 14em;
        width: 14em;
    }
    .sidebar.collapsed {
        width: 3.5em;
        min-width: 3.5em;
    }
    .main-content {
        padding: 1em;
    }
}

@media (max-width: 768px) {
    .mobile-menu-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        top: 1em;
        left: 1em;
        z-index: 1001;
        background: var(--violeta2);
        color: white;
        border: none;
        border-radius: 0.5em;
        width: 2.5em;
        height: 2.5em;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(112,40,162,0.3);
        transition: all 0.2s ease;
    }
    
    .mobile-menu-btn:hover {
        background: #5a1e7a;
        transform: scale(1.05);
    }
    
    .sidebar-overlay {
        display: block;
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 1000;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.3s ease;
    }
    
    .sidebar-overlay.active {
        opacity: 1;
        pointer-events: all;
    }
    
    .sidebar {
        position: fixed;
        top: 0;
        left: 0;
        height: 100vh;
        z-index: 1001;
        transform: translateX(-100%);
        transition: transform 0.3s ease;
        width: 17em;
        min-width: 17em;
    }
    
    .sidebar.mobile-open {
        transform: translateX(0);
    }
    
    .sidebar.collapsed {
        width: 17em;
        min-width: 17em;
    }
    
    .main-content {
        padding: 1em;
        padding-top: 4.5em;
        width: 100%;
    }
    
    .home-screen {
        gap: 2em;
    }

    .home-title {
        font-size: 1.6em;
    }

    .panel-menu {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 1em;
        max-width: 26em;
    }

    .panel-btn {
        min-height: 8.5em;
        padding: 1.5em 1em 1.2em 1em;
    }
}
.home-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2.5em;
    min-height: calc(100vh - 6.5em);
}
.home-intro {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35em;
}
.home-eyebrow {
    font-size: 0.8em;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #b9a7d9;
}
.home-title {
    font-size: 2em;
    font-weight: 800;
    color: var(--violeta2);
    margin: 0;
    text-transform: none;
}
.home-subtitle {
    font-size: 1.05em;
    color: #8a7aa3;
    margin: 0;
}
.panel-menu {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(9.5em, 11em));
    gap: 1.4em;
    justify-content: center;
    align-items: stretch;
    width: 100%;
    max-width: 62em;
}
.panel-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    gap: 1em;
    background: #ffffff;
    border: 1.5px solid #ece7f5;
    border-radius: 1.2em;
    padding: 1.8em 1.2em 1.5em 1.2em;
    font-size: 1em;
    color: var(--violeta2);
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(112,40,162,0.04), 0 6px 16px -8px rgba(112,40,162,0.12);
    transition: border-color 0.18s, box-shadow 0.18s, transform 0.18s;
    min-height: 9.5em;
}
.panel-btn:hover {
    border-color: #d9cbef;
    box-shadow: 0 2px 6px rgba(112,40,162,0.06), 0 14px 28px -10px rgba(112,40,162,0.28);
    transform: translateY(-0.25em);
}
.panel-icon-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 3.4em;
    height: 3.4em;
    border-radius: 1em;
    background: #f3eefb;
    transition: background 0.18s;
    position: relative;
}
.notif-dot {
    position: absolute;
    top: 0.3em;
    right: 0.3em;
    width: 0.75em;
    height: 0.75em;
    border-radius: 50%;
    background: var(--magenta, #e6007e);
    box-shadow: 0 0 0 2px #fff;
    animation: notif-pulse 1.6s ease-in-out infinite;
}
@keyframes notif-pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.25); opacity: 0.75; }
}
.panel-btn:hover .panel-icon-wrap {
    background: var(--violeta2);
}
.panel-icon {
    width: 1.7em;
    height: 1.7em;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--violeta2);
    stroke: var(--violeta2);
    transition: stroke 0.18s, color 0.18s;
}
.panel-icon :global(svg) {
    width: 100%;
    height: 100%;
    display: block;
}
.panel-btn:hover .panel-icon {
    color: white;
    stroke: white;
}
.sin-permisos {
    max-width: 26em;
    padding: 1.2em 1.4em;
    background: #fff;
    border: 1.5px dashed #d9cbef;
    border-radius: 1em;
    color: #6b7280;
    font-size: 1em;
    line-height: 1.5;
    text-align: center;
}
.panel-label {
    font-size: 1.08em;
    line-height: 1.25;
    text-align: center;
}
</style>