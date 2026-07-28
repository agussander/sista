<script>
    import { onMount } from 'svelte';
    import { pb } from '$lib/pocketbase';
    import defaultChannels from '$lib/data/dgo-channels.json';

    // `categoryPrices`: mapa categoría → campo de la colección `precios` en
    // PocketBase, p.ej. { 'Adicional CINE': 'antina_cine' }. Si está vacío, la
    // grilla no toca PocketBase y se ve exactamente igual que siempre.
    let { channels = defaultChannels, accent = '#ff6b00', categoryPrices = {} } = $props();

    // Precios resueltos por categoría: categoría → "3.500" (formateado).
    let precios = $state({});

    // Miles con puntos (mismo criterio que home/Price.svelte).
    const formatNumber = (value) =>
        value ? value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '';

    onMount(async () => {
        if (Object.keys(categoryPrices).length === 0) return;
        try {
            // `requestKey: null` evita la auto-cancelación de PocketBase: esta
            // página dispara otra petición idéntica a `precios` en paralelo
            // (TvPriceSummary) y, sin esto, una cancela a la otra.
            const record = await pb
                .collection('precios')
                .getFirstListItem('', { requestKey: null });
            const next = {};
            for (const [categoria, campo] of Object.entries(categoryPrices)) {
                if (record?.[campo]) next[categoria] = formatNumber(record[campo]);
            }
            precios = next;
        } catch (error) {
            console.error('Error cargando precios desde PocketBase:', error);
        }
    });

    // Orden de categorías (no vacías) tal como aparecen por primera vez.
    const categorias = [
        ...new Set(channels.map((c) => c.categoria?.trim()).filter(Boolean))
    ];
    const tieneCategorias = categorias.length > 0;

    let categoriaActiva = $state('Todos');
    let busqueda = $state('');
    let buscadorAbierto = $state(false);

    const filtros = ['Todos', ...categorias];

    // Enfoca el input apenas se abre el buscador.
    function autofocus(node) {
        node.focus();
    }

    // Al perder foco, si no se escribió nada, vuelve a ser un chip.
    function cerrarBuscadorSiVacio() {
        if (!busqueda.trim()) buscadorAbierto = false;
    }

    // Normaliza para buscar sin acentos ni mayúsculas.
    const normalizar = (texto) =>
        (texto ?? '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');

    let canalesVisibles = $derived.by(() => {
        const termino = normalizar(busqueda.trim());
        return channels.filter((c) => {
            const coincideCategoria =
                categoriaActiva === 'Todos' || c.categoria === categoriaActiva;
            const coincideNombre =
                !termino || normalizar(c.nombre).includes(termino);
            return coincideCategoria && coincideNombre;
        });
    });

    // Agrupa los canales visibles por categoría para mostrar encabezados.
    // Si los datos no traen categorías, se muestra una sola grilla plana.
    let grupos = $derived(
        (tieneCategorias
            ? categorias.map((cat) => ({
                  categoria: cat,
                  canales: canalesVisibles.filter((c) => c.categoria === cat)
              }))
            : [{ categoria: null, canales: canalesVisibles }]
        ).filter((g) => g.canales.length > 0)
    );

    function onImgError(event) {
        const img = event.currentTarget;
        img.style.display = 'none';
        img.parentElement?.classList.add('sin-logo');
    }
</script>

<div class="channel-grid" style="--dgo-accent: {accent}">
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

        {#if buscadorAbierto}
            <div class="filtro filtro-buscar abierto">
                <svg class="lupa" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                        d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                    />
                </svg>
                <input
                    type="search"
                    class="filtro-buscar-input"
                    placeholder="Buscar…"
                    aria-label="Buscar canal por nombre"
                    bind:value={busqueda}
                    use:autofocus
                    onblur={cerrarBuscadorSiVacio}
                />
                {#if busqueda}
                    <button
                        type="button"
                        class="filtro-buscar-limpiar"
                        aria-label="Limpiar búsqueda"
                        onclick={() => (busqueda = '')}
                    >
                        ×
                    </button>
                {/if}
            </div>
        {:else}
            <button
                class="filtro filtro-buscar"
                aria-label="Buscar canal por nombre"
                onclick={() => (buscadorAbierto = true)}
            >
                <svg class="lupa" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                        d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                    />
                </svg>
                Buscar
            </button>
        {/if}
    </div>

    {#if grupos.length === 0}
        <p class="sin-resultados">
            No se encontraron canales para “{busqueda}”.
        </p>
    {/if}

    {#each grupos as grupo (grupo.categoria)}
        <section class="categoria">
            {#if grupo.categoria}
                <h3 class="categoria-titulo">
                    {grupo.categoria}
                    {#if precios[grupo.categoria]}
                        <span class="categoria-precio">(+${precios[grupo.categoria]}/mes)</span>
                    {/if}
                </h3>
            {/if}
            <div class="logos">
                {#each grupo.canales as canal (canal.nombre)}
                    <div class="canal" title={canal.nombre}>
                        <div class="canal-logo" class:fondo-blanco={canal.fondoBlanco}>
                            <img
                                src={canal.url_logo}
                                alt={canal.nombre}
                                class:logo-invertido={canal.logoBlanco}
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
        --dgo-bg: #ffffff;
        --dgo-surface: #f5f5f7;
        --dgo-surface-hover: #ebebef;
        --dgo-accent: #ff6b00;
        /* Versión oscurecida del acento, legible como texto/borde sobre fondo
           claro (clave para acentos claros como el verde de Antina). */
        --dgo-accent-ink: color-mix(in srgb, var(--dgo-accent) 72%, #1a1a1a);
        --dgo-text: #1f1f23;
        --dgo-text-dim: #6b6b73;
        --dgo-border: rgba(0, 0, 0, 0.08);

        font-family: 'nexa', sans-serif;
        background: var(--dgo-bg);
        color: var(--dgo-text);
        border-radius: 1.25em;
        padding: 2em 1.5em 2.5em;
        max-width: 72em;
        margin: 3em auto 0;
        border: 1px solid var(--dgo-border);
        box-shadow: 0 0.75em 2.5em rgba(0, 0, 0, 0.08);
    }

    .sin-resultados {
        text-align: center;
        color: var(--dgo-text-dim);
        font-size: 0.95rem;
        margin: 1.5em 0 0.5em;
    }

    .filtros {
        display: flex;
        flex-wrap: wrap;
        gap: 0.6em;
        justify-content: center;
        margin-bottom: 2.5em;
    }
    .filtro {
        font-family: 'nexa', sans-serif;
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

    /* Chip de búsqueda: sin fondo gris para distinguirlo de las categorías. */
    .filtro-buscar {
        display: inline-flex;
        align-items: center;
        gap: 0.45em;
        background: transparent;
        border-color: color-mix(in srgb, var(--dgo-accent) 55%, transparent);
        color: var(--dgo-text-dim);
    }
    .filtro-buscar:hover {
        background: color-mix(in srgb, var(--dgo-accent) 10%, transparent);
        color: var(--dgo-text);
    }
    .filtro-buscar .lupa {
        width: 1em;
        height: 1em;
    }
    .filtro-buscar.abierto {
        padding: 0.45em 0.5em 0.45em 0.9em;
        cursor: text;
    }
    .filtro-buscar-input {
        font-family: 'nexa', sans-serif;
        font-size: 0.9rem;
        width: 8.5em;
        color: var(--dgo-text);
        background: transparent;
        border: none;
        outline: none;
        box-shadow: none;
        appearance: none;
        -webkit-appearance: none;
        padding: 0;
    }
    /* Anula el outline global de input:focus (definido con !important). */
    .filtro-buscar-input:focus {
        outline: none !important;
    }
    .filtro-buscar-input::placeholder {
        color: var(--dgo-text-dim);
    }
    .filtro-buscar-input::-webkit-search-cancel-button {
        appearance: none;
    }
    .filtro-buscar-limpiar {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 1.4em;
        height: 1.4em;
        font-size: 1.1rem;
        line-height: 1;
        color: var(--dgo-text-dim);
        background: none;
        border: none;
        border-radius: 50%;
        cursor: pointer;
    }
    .filtro-buscar-limpiar:hover {
        color: var(--dgo-text);
        background: var(--dgo-surface-hover);
    }

    .categoria {
        margin-bottom: 2.5em;
    }
    .categoria-titulo {
        font-family: 'nexa', sans-serif;
        font-weight: 700;
        font-size: 1.15rem;
        text-transform: none;
        color: var(--dgo-text);
        margin: 0 0 1.2em;
        padding-left: 0.65em;
        border-left: 4px solid var(--dgo-accent-ink);
    }
    .categoria-precio {
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--dgo-accent-ink);
        margin-left: 0.5em;
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
    /* Logos blancos detectados automáticamente: se invierten a negro para que
       se lean sobre el fondo claro. */
    .canal-logo img.logo-invertido {
        filter: invert(1);
    }
    .canal-logo.sin-logo::before {
        content: '📺';
        font-size: 1.8em;
        opacity: 0.5;
    }
    /* Logos oscuros (HBO, etc.) sobre fondo blanco para que se lean. */
    .canal-logo.fondo-blanco {
        background: #fff;
        border-radius: 0.5em;
        padding: 0.4em 0.55em;
        box-sizing: border-box;
    }
    .canal-nombre {
        font-family: 'nexa', sans-serif;
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
        .filtros {
            gap: 0.4em;
            margin-bottom: 2em;
        }
        .filtro {
            font-size: 0.78rem;
            padding: 0.4em 0.85em;
        }
        .filtro-buscar.abierto {
            padding: 0.35em 0.4em 0.35em 0.7em;
        }
        .filtro-buscar-input {
            font-size: 0.78rem;
            width: 7em;
        }
    }
</style>
