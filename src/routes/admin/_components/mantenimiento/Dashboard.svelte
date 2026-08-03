<script>
import { onMount, onDestroy } from 'svelte';
import { pb } from '$lib/pocketbase';
import { page } from '$app/stores';
import { token, record } from '../adminStore';
import { llamenmeStore, primeAudio } from './Dashboard/llamenme/llamenmeStore.svelte.js';
import Sidebar from './Dashboard/Sidebar.svelte';
import Content from './Dashboard/Content.svelte';

let selected = $state(null);

$effect(() => {
    const view = $page.url.searchParams.get('view');
    if (view === 'sorteo-conectarlaciudad') selected = 'sorteo-conectarlaciudad';
    else if (view === 'conectarlaciudad') selected = 'conectarlaciudad';
});

// Realtime de "Quiero que me llamen": vive a nivel admin para que el sonido y el
// puntito funcionen estés en la sección que estés.
onMount(() => {
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
let sidebarCollapsed = $state(false);
let sidebarOpen = $state(false);
let windowWidth = $state(0);

const logout = async()=>{
    pb.authStore.clear();
    $token=null;
}

const handlePanelSelect = (option) => {
    selected = option;
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
        <Sidebar bind:selected {logout} record={$record} collapsed={sidebarCollapsed} llamenmeUnread={llamenmeStore.unread}></Sidebar>
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
                <div class="panel-menu">
                    <button class="panel-btn" onclick={() => handlePanelSelect('precios')}>
                        <span class="panel-icon-wrap">
                            <svg class="panel-icon" xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                        </span>
                        <span class="panel-label">Precios</span>
                    </button>
                    <button class="panel-btn" onclick={() => handlePanelSelect('novedades')}>
                        <span class="panel-icon-wrap">
                            <svg class="panel-icon" xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M2 10h20"/></svg>
                        </span>
                        <span class="panel-label">Novedades</span>
                    </button>
                    <button class="panel-btn" onclick={() => handlePanelSelect('trabajos')}>
                        <span class="panel-icon-wrap">
                            <svg class="panel-icon" xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        </span>
                        <span class="panel-label">Trabajos</span>
                    </button>
                    <button class="panel-btn" onclick={() => handlePanelSelect('tecnicos')}>
                        <span class="panel-icon-wrap">
                            <svg class="panel-icon" xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                        </span>
                        <span class="panel-label">Técnicos</span>
                    </button>
                    <button class="panel-btn" onclick={() => handlePanelSelect('llamenme')}>
                        <span class="panel-icon-wrap">
                            {#if llamenmeStore.unread > 0}
                                <span class="notif-dot" aria-label="Nuevas solicitudes"></span>
                            {/if}
                            <svg class="panel-icon" xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                        </span>
                        <span class="panel-label">Quiero que me llamen</span>
                    </button>
                </div>
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
    padding-top: 7.5em;
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
    padding: 7.5em 2em 2em 2em;
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
        padding: 4.5em 1em 1em 1em;
    }
}

@media (max-width: 768px) {
    .mobile-menu-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        top: 7em;
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
    padding-top: 7.5em;
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
        padding-top: 7.5em;
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
    min-height: calc(100vh - 12em);
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
    color: var(--violeta2);
    stroke: var(--violeta2);
    transition: stroke 0.18s, color 0.18s;
}
.panel-btn:hover .panel-icon {
    color: white;
    stroke: white;
}
.panel-label {
    font-size: 1.08em;
    line-height: 1.25;
    text-align: center;
}
</style>