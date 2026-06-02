<script>
import { pb } from '$lib/pocketbase';
import { page } from '$app/stores';
import { token, record } from '../adminStore';
import Sidebar from './Dashboard/Sidebar.svelte';
import Content from './Dashboard/Content.svelte';

let selected = $state(null);

$effect(() => {
    const view = $page.url.searchParams.get('view');
    if (view === 'sorteo-conectarlaciudad') selected = 'sorteo-conectarlaciudad';
    else if (view === 'conectarlaciudad') selected = 'conectarlaciudad';
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
        {#if !sidebarCollapsed}
            <Sidebar bind:selected {logout} record={$record}></Sidebar>
        {/if}
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
                        <svg class="panel-icon" xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                        Precios
                    </button>
                    <button class="panel-btn" onclick={() => handlePanelSelect('novedades')}>
                        <svg class="panel-icon" xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M2 10h20"/></svg>
                        Novedades
                    </button>
                    <button class="panel-btn" onclick={() => handlePanelSelect('trabajos')}>
                        <svg class="panel-icon" xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        Trabajos
                    </button>
                    <button class="panel-btn" onclick={() => handlePanelSelect('tecnicos')}>
                        <svg class="panel-icon" xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                        Técnicos
                    </button>
                    <button class="panel-btn" onclick={() => handlePanelSelect('ruleta')}>
                        <svg class="panel-icon" xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
                        Ruleta
                    </button>
                </div>
            </div>
        {:else}
            <Content {selected} />
        {/if}
    </main>
</section>




<style>
.dashboard-layout {
    display: flex;
    min-height: 100vh;
    width: 100vw;
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
    
    .panel-menu {
        gap: 1.5em;
    }
    
    .panel-btn {
        min-width: 8em;
        min-height: 8em;
        padding: 1.5em 1.5em 1em 1.5em;
        font-size: 1.1em;
    }
    
    .panel-icon {
        width: 32px;
        height: 32px;
        margin-bottom: 0.8em;
    }
}
.home-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: calc(100vh - 10em);
}
.panel-menu {
    display: flex;
    flex-direction: row;
    gap: 2.5em;
    justify-content: center;
    align-items: center;
    flex-wrap: wrap;
    max-width: 60em;
}
.panel-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: #f7f6fb;
    border: 2px solid #ede7f6;
    border-radius: 1.5em;
    padding: 2.5em 2.5em 1.5em 2.5em;
    font-size: 1.3em;
    color: var(--violeta2);
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 2px 12px 0 rgba(112,40,162,0.06);
    transition: background 0.18s, border 0.18s, color 0.18s, box-shadow 0.18s, transform 0.18s;
    min-width: 10em;
    min-height: 10em;
}
.panel-btn:hover {
    background: var(--violeta2);
    border-color: var(--violeta2);
    color: white;
    box-shadow: 0 4px 18px 0 rgba(112,40,162,0.20);
    transform: translateY(-0.3em);
}
.panel-btn:hover .panel-icon {
    color: white;
    stroke: white;
}
.panel-icon {
    margin-bottom: 1em;
    color: var(--violeta2);
    stroke: var(--violeta2);
    transition: color 0.18s, stroke 0.18s;
}
</style>