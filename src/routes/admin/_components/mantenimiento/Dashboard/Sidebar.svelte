<script>
import { slide } from 'svelte/transition';
let {
    record,
    logout,
    selected = $bindable(null)
} = $props();

const mainItems = [
    {
        title: 'Precios',
        content: 'precios',
        icon: '<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'
    },
    {
        title: 'Novedades',
        content: 'novedades',
        icon: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M2 10h20"/>'
    },
    {
        title: 'Trabajos',
        content: 'trabajos',
        icon: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'
    },
    {
        title: 'Técnicos',
        content: 'tecnicos',
        icon: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>'
    },
    {
        title: 'Quiero que me llamen',
        content: 'llamenme',
        icon: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>'
    }
];

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

<div class="wrap sidebar-content">
    <div>
        <div class="folders">
            {#each mainItems as item}
                <button class='main-item'
                class:selected={selected==item.content}
                onclick={() => handleMainItemClick(item)}
                >
                <svg class="item-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    {@html item.icon}
                </svg>
                <span>{item.title}</span>
                </button>
            {/each}

            <div class="separator"></div>

            {#each expandableContent as c}
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
        </div>
    </div>
    <button class="btn logout-btn" onclick={logout}>
        <svg class="logout-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        Cerrar sesión
    </button>
</div>

<style>
.wrap{
    padding: 1.2em 1.2em 1.2em 1.2em;
    background: transparent;
    width: 100%;
    height: calc(100vh - 7.5em);
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
.main-item {
    padding: 0.7em 1em;
    display: flex;
    align-items: center;
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
    stroke: white;
}
.item-icon {
    width: 1.3em;
    height: 1.3em;
    stroke: var(--violeta2);
    flex-shrink: 0;
    transition: stroke 0.18s;
}
.main-item:hover .item-icon {
    stroke: #5a1e7a;
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
</style>