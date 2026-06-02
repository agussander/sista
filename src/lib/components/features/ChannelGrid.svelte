<script>
    import defaultChannels from '$lib/data/dgo-channels.json';

    let { channels = defaultChannels } = $props();

    // Orden de categorías (no vacías) tal como aparecen por primera vez.
    const categorias = [
        ...new Set(channels.map((c) => c.categoria?.trim()).filter(Boolean))
    ];
    const tieneCategorias = categorias.length > 0;

    let categoriaActiva = $state('Todos');

    const filtros = ['Todos', ...categorias];

    let canalesVisibles = $derived(
        categoriaActiva === 'Todos'
            ? channels
            : channels.filter((c) => c.categoria === categoriaActiva)
    );

    // Agrupa los canales visibles por categoría para mostrar encabezados.
    // Si los datos no traen categorías, se muestra una sola grilla plana.
    let grupos = $derived(
        tieneCategorias
            ? categorias
                  .map((cat) => ({
                      categoria: cat,
                      canales: canalesVisibles.filter((c) => c.categoria === cat)
                  }))
                  .filter((g) => g.canales.length > 0)
            : [{ categoria: null, canales: channels }]
    );

    function onImgError(event) {
        const img = event.currentTarget;
        img.style.display = 'none';
        img.parentElement?.classList.add('sin-logo');
    }
</script>

<div class="channel-grid">
    {#if tieneCategorias}
        <div class="filtros" role="tablist" aria-label="Categorías de canales">
            {#each filtros as filtro}
                <button
                    class="filtro"
                    class:activo={categoriaActiva === filtro}
                    role="tab"
                    aria-selected={categoriaActiva === filtro}
                    onclick={() => (categoriaActiva = filtro)}
                >
                    {filtro}
                </button>
            {/each}
        </div>
    {/if}

    {#each grupos as grupo (grupo.categoria)}
        <section class="categoria">
            {#if grupo.categoria}
                <h3 class="categoria-titulo">{grupo.categoria}</h3>
            {/if}
            <div class="logos">
                {#each grupo.canales as canal (canal.nombre)}
                    <div class="canal" title={canal.nombre}>
                        <div class="canal-logo">
                            <img
                                src={canal.url_logo}
                                alt={canal.nombre}
                                loading="lazy"
                                decoding="async"
                                onerror={onImgError}
                            />
                        </div>
                        <span class="canal-nombre">{canal.nombre}</span>
                    </div>
                {/each}
            </div>
        </section>
    {/each}
</div>

<style>
    .channel-grid {
        --dgo-bg: #101010;
        --dgo-surface: #1c1c1f;
        --dgo-surface-hover: #26262b;
        --dgo-accent: #ff6b00;
        --dgo-text: #ffffff;
        --dgo-text-dim: #c1c1c1;
        --dgo-border: rgba(255, 255, 255, 0.08);

        font-family: 'Poppins', sans-serif;
        background: var(--dgo-bg);
        color: var(--dgo-text);
        border-radius: 1.25em;
        padding: 2em 1.5em 2.5em;
        max-width: 72em;
        margin: 3em auto 0;
        box-shadow: 0 1em 3em rgba(0, 0, 0, 0.35);
    }

    .filtros {
        display: flex;
        flex-wrap: wrap;
        gap: 0.6em;
        justify-content: center;
        margin-bottom: 2.5em;
    }
    .filtro {
        font-family: 'Poppins', sans-serif;
        font-weight: 500;
        font-size: 0.9rem;
        color: var(--dgo-text-dim);
        background: var(--dgo-surface);
        border: 1px solid var(--dgo-border);
        border-radius: 100px;
        padding: 0.55em 1.2em;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    .filtro:hover {
        color: var(--dgo-text);
        background: var(--dgo-surface-hover);
        opacity: 1;
    }
    .filtro.activo {
        background: var(--dgo-accent);
        border-color: var(--dgo-accent);
        color: #1a0c00;
        font-weight: 600;
    }

    .categoria {
        margin-bottom: 2.5em;
    }
    .categoria-titulo {
        font-family: 'Poppins', sans-serif;
        font-weight: 700;
        font-size: 1.15rem;
        text-transform: none;
        color: var(--dgo-text);
        margin: 0 0 1.2em;
        padding-left: 0.65em;
        border-left: 4px solid var(--dgo-accent);
    }

    .logos {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(98px, 1fr));
        gap: 0.8em;
    }

    .canal {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.6em;
        background: var(--dgo-surface);
        border: 1px solid var(--dgo-border);
        border-radius: 0.75em;
        padding: 0.9em 0.5em;
    }
    .canal-logo {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 3.2em;
    }
    .canal-logo img {
        max-width: 82%;
        max-height: 100%;
        width: auto;
        object-fit: contain;
    }
    .canal-logo.sin-logo::before {
        content: '📺';
        font-size: 1.8em;
        opacity: 0.5;
    }
    .canal-nombre {
        font-family: 'Poppins', sans-serif;
        font-size: 0.72rem;
        font-weight: 400;
        color: var(--dgo-text-dim);
        text-align: center;
        line-height: 1.25;
        overflow-wrap: anywhere;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    @media (max-width: 600px) {
        .channel-grid {
            padding: 1.5em 0.9em 2em;
            border-radius: 1em;
        }
        .logos {
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 0.5em;
        }
        .canal {
            padding: 0.7em 0.35em;
            gap: 0.4em;
            border-radius: 0.6em;
        }
        .canal-logo {
            height: 2.6em;
        }
        .canal-nombre {
            font-size: 0.62rem;
        }
    }
</style>
