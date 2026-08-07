<script>
import { slide } from 'svelte/transition';
import { seccionPermitida } from '$lib/adminPermisos.js';
import { PANEL_SECCIONES } from './panelSecciones.js';
let {
    record,
    logout,
    selected = $bindable(null),
    collapsed = false,
    llamenmeUnread = 0
} = $props();

const mainItems = PANEL_SECCIONES;

const expandableContent = [
    {
        title: 'Encuesta de calidad',
        childs: [
            {
                title: 'Octubre 2024',
                content: 'formulario_calidad'
            },
            {
                title: 'Diciembre 2024',
                content: 'formulario_calidad_2'
            }
        ]
    },
    {
        title: 'Otros',
        childs: [
            {
                title: 'Ruleta',
                content: 'ruleta'
            },
            {
                title: 'Conectar la ciudad',
                content: 'conectarlaciudad'
            },
            {
                title: 'Tolosano (códigos)',
                content: 'tolosano'
            }
        ]
    }
];

// Filtro por permiso: es conveniencia de interfaz, no seguridad (el servidor
// vuelve a chequear en cada endpoint de la Cartera y las reglas de coleccion
// rigen todo lo demas). Un grupo expandible se oculta entero si ninguno de
// sus hijos quedo habilitado, no solo si el grupo en si no tiene permiso
// propio (no lo tiene: son sus hijos los que lo tienen).
const permisos = $derived(record?.permisos);
const mainItemsPermitidos = $derived(
    mainItems.filter((item) => seccionPermitida(item.content, permisos))
);
const expandableContentPermitido = $derived(
    expandableContent
        .map((c) => ({ ...c, childs: c.childs.filter((ch) => seccionPermitida(ch.content, permisos)) }))
        .filter((c) => c.childs.length > 0)
);
// Un usuario sin ninguna seccion habilitada se queda con un panel vacio si no
// se dice nada: mejor un mensaje explicito que invite a pedir permisos que un
// sidebar en blanco que parece roto.
const sinPermisos = $derived(
    mainItemsPermitidos.length === 0 && expandableContentPermitido.length === 0
);

let opened = $state(null)

const switch_ = (c) =>{
    opened == c.title ? 
    opened = null :
    opened = c.title;
}

const handleMainItemClick = (item) => {
    selected = item.content;
};
</script>

<div class="wrap sidebar-content" class:collapsed>
    <div>
        {#if sinPermisos}
            {#if !collapsed}
                <p class="sin-permisos">
                    Todavía no tenés secciones habilitadas. Pedile a un administrador que te asigne
                    permisos en tu usuario.
                </p>
            {/if}
        {:else}
        <div class="folders">
            {#each mainItemsPermitidos as item}
                <button class='main-item'
                class:selected={selected==item.content}
                onclick={() => handleMainItemClick(item)}
                title={collapsed ? item.title : null}
                >
                <span class="icon-wrap">
                    <span class="item-icon">{@html `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${item.icon}</svg>`}</span>
                    {#if item.content === 'llamenme' && llamenmeUnread > 0 && selected !== 'llamenme'}
                        <span class="notif-dot" aria-label="Nuevas solicitudes"></span>
                    {/if}
                </span>
                <span class="item-label">{item.title}</span>
                </button>
            {/each}

            {#if !collapsed}
            <div class="separator"></div>

            {#each expandableContentPermitido as c}
                <button class='content'
                onclick={() => switch_(c)}
                >
                <div class="triangle"
                style="rotate: {opened==c.title ? 90 : 0}deg"
                >
                    <span>></span>
                </div>
                <span>{c.title}</span>
                </button>
                {#if opened == c.title}
                    <div transition:slide>
                        {#each c.childs as child}
                            <button class="child"
                            class:selected={selected==child.content}
                            onclick={() => { selected = child.content; }}
                            >
                                <span>{child.title}</span>
                            </button>
                        {/each}
                    </div>
                {/if}
            {/each}
            {/if}
        </div>
        {/if}
    </div>
    <button class="btn logout-btn" onclick={logout} title={collapsed ? 'Cerrar sesión' : null}>
        <svg class="logout-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        <span>Cerrar sesión</span>
    </button>
</div>

<style>
.wrap{
    padding: 1.2em 1.2em 1.2em 1.2em;
    background: transparent;
    width: 100%;
    height: calc(100vh - 4.5em);
    display: flex;
    flex-flow: column;
    justify-content: space-between;
    position: relative;
}
.folders {
    margin-top: 1.5em;
    display: flex;
    flex-direction: column;
    gap: 0.6em;
}
.sin-permisos {
    margin-top: 1.5em;
    padding: 1em 1.1em;
    background: #fff;
    border: 1.5px dashed #d9cbef;
    border-radius: 1em;
    color: #6b7280;
    font-size: 0.92em;
    line-height: 1.4;
}
.main-item {
    padding: 0.7em 1em;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 0.8em;
    border-radius: 1.2em;
    font-size: 1.08em;
    font-weight: 500;
    color: var(--violeta2);
    background: none;
    border: none;
    cursor: pointer;
    transition: background 0.18s, color 0.18s, box-shadow 0.18s;
    position: relative;
    width: 100%;
    text-align: left;
}
.main-item:hover {
    background: #ede7f6;
    color: #5a1e7a;
}
.main-item.selected {
    background: var(--violeta2);
    color: white;
    box-shadow: 0 2px 8px 0 rgba(112,40,162,0.2);
}
.main-item.selected span {
    color: white;
}
.main-item.selected .item-icon {
    color: white;
}
.icon-wrap {
    position: relative;
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
}
.notif-dot {
    position: absolute;
    top: -0.15em;
    right: -0.25em;
    width: 0.6em;
    height: 0.6em;
    border-radius: 50%;
    background: var(--magenta, #e6007e);
    box-shadow: 0 0 0 2px #f7f6fb;
    animation: notif-pulse 1.6s ease-in-out infinite;
}
@keyframes notif-pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.25); opacity: 0.75; }
}
.item-icon {
    width: 1.3em;
    height: 1.3em;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--violeta2);
    flex-shrink: 0;
    transition: color 0.18s;
}
.item-icon :global(svg) {
    width: 100%;
    height: 100%;
    display: block;
}
.main-item:hover .item-icon {
    color: #5a1e7a;
}
.separator {
    height: 1px;
    background: linear-gradient(90deg, transparent, #e0e0e0 20%, #e0e0e0 80%, transparent);
    margin: 1em 0;
}
.content {
    padding: 0.7em 1em;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: .7em;
    border-radius: 1.2em;
    font-size: 1.08em;
    font-weight: 500;
    color: var(--violeta2);
    background: none;
    border: none;
    cursor: pointer;
    transition: background 0.18s, color 0.18s;
    position: relative;
    width: 100%;
    text-align: left;
}
.content:hover {
    background: #ede7f6;
    color: #5a1e7a;
}
.triangle {
    font-weight: 400;
    color: #b9a7d9;
    display: flex;
    align-items: center;
    font-size: 1.1em;
    margin-right: 0.2em;
    transition: color 0.18s;
}
.content:hover .triangle {
    color: var(--violeta2);
}
.child {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    padding: .5em 1.2em;
    border-radius: 1.2em;
    margin: .2em 0;
    font-size: 0.98em;
    color: var(--violeta2);
    background: none;
    border: none;
    cursor: pointer;
    transition: background 0.18s, color 0.18s;
    width: 100%;
    text-align: left;
}
.child:hover {
    background: #ede7f6;
    color: #5a1e7a;
}
.child.selected {
    background: var(--violeta2);
    color: white;
    box-shadow: 0 2px 8px 0 rgba(112,40,162,0.15);
}
.child.selected span {
    color: white;
}
.logout-btn {
    margin-top: 2.5em;
}
.logout-btn {
    display: flex;
    align-items: center;
    gap: 0.7em;
    background: #fff;
    color: var(--violeta2);
    border: 1.5px solid #e0e0e0;
    border-radius: 2em;
    padding: 0.7em 1.3em;
    font-size: 1em;
    font-weight: 500;
    margin-top: 2em;
    margin-bottom: 1em;
    cursor: pointer;
    transition: background 0.2s, color 0.2s, border 0.2s;
    box-shadow: none;
}
.logout-btn:hover {
    background: #f5f5f5;
    color: var(--violeta2);
    border-color: #d1c4e9;
}
.logout-icon {
    width: 1.3em;
    height: 1.3em;
    stroke: var(--violeta2);
    flex-shrink: 0;
}

/* Estado colapsado: solo iconos */
.wrap.collapsed {
    padding: 1.2em 0.4em;
    align-items: center;
}
.wrap.collapsed .folders {
    align-items: center;
}
.wrap.collapsed .main-item {
    justify-content: center;
    gap: 0;
    padding: 0.7em 0;
    width: 2.6em;
}
.wrap.collapsed .main-item .item-label {
    display: none;
}
.wrap.collapsed .logout-btn {
    justify-content: center;
    gap: 0;
    padding: 0.7em;
    width: 2.6em;
}
.wrap.collapsed .logout-btn span {
    display: none;
}
</style>