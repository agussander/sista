<script>
    import { browser } from '$app/environment';

    let direccion = $state('');

    // onMount(() => {
    //     // Cargar el mapa mucho antes de que llegue al viewport
    //     // Se carga cuando el usuario está viendo la sección de planes
    //     const observer = new IntersectionObserver(
    //         (entries) => {
    //             if (entries[0].isIntersecting) {
    //                 mapVisible = true;
    //                 observer.disconnect();
    //             }
    //         },
    //         { rootMargin: '1500px' } // Carga cuando está a ~1500px antes (mientras ve los planes)
    //     );

    //     observer.observe(mapContainer);

    //     return () => observer.disconnect();
    // });

    const consultarCobertura = () => {
        if (!direccion.trim()) return;
        
        const mensaje = encodeURIComponent(`Hola, quiero saber si tengo cobertura en ${direccion.trim()}`);
        const whatsappUrl = `https://api.whatsapp.com/send?phone=5492213541906&text=${mensaje}`;
        
        if (browser && typeof window !== 'undefined') {
            window.open(whatsappUrl, '_blank');
        }
    };
</script>

<section>
    <h2 id="cobertura">Consultar cobertura</h2>
    <div class="cont">
        <!-- <p class="sub">En este mapa podrás ver los lugares donde contamos con Fibra Óptica.</p> -->
        <!-- <p class="explain-menu-m">Haciendo click en este ícono  verás el listado de barrios y zonas en el mapa</p> -->
        <!-- <div bind:this={mapContainer} on:mouseenter={() => showUnderstood = true} on:mouseleave={() => showUnderstood = false} class="frame">
            {#if !understood && showUnderstood && !$mobile}
                <div transition:fade="{{ duration: 100 }}" on:click={() => understood = true} class="explain-cont">
                    <p class="explain-menu">Haciendo click en este ícono verás el listado de barrios y zonas en el mapa</p>
                    <div class="previous"></div>
                </div>
            {/if}
            {#if mapVisible}
                <iframe 
                    title="mapa de cobertura" 
                    src="https://www.google.com/maps/d/embed?mid=13UVPvksYOs0_GgZWrJBM-2w5zVcmBiFQ"
                    loading="lazy"
                    referrerpolicy="no-referrer-when-downgrade"
                    allowfullscreen
                ></iframe>
            {/if}
        </div> -->
        <div class="consulta-cobertura">
            <label for="direccion">Escribe tu dirección y te responderemos si dispones de cobertura</label>
            <div class="input-group">
                <input 
                    type="text" 
                    id="direccion" 
                    bind:value={direccion}
                    placeholder="Calle x número 123"
                    onkeydown={(e) => {
                        if (e.key === 'Enter') {
                            consultarCobertura();
                        }
                    }}
                />
                <button type="button" onclick={consultarCobertura} class="btn-consultar">
                    <span class="wsp-icon"></span>
                    Consultar
                </button>
            </div>
        </div>
        <!-- <p class="aclaracion">Si el área en el que vivis no dispone de cobertura de Fibra Óptica, podés consultarnos por el servicio de internet por antena.</p> -->
    </div>
</section>

<style>
    section {
        margin: 8em 0;
    }
    /* Asegura que el título no quede demasiado grande en pantallas chicas */
    #cobertura {
        margin-left: auto;
        margin-right: auto;
        max-width: 100%;
        font-size: clamp(1.6rem, 6vw, 2.5rem);
    }
    /* iframe {
        display: block;
        width: 100%;
        border: none;
        height: 100%;
    } */
    /* .explain-cont {
        position: absolute;
        width: 100%;
        height: 100%;
    } */
    /* .explain-menu {
        position: absolute;
        color: white;
        text-align: left;
        z-index: 10;
        top: 10%;
        left: 10%;
        width: 40%;
    } */
    /* .previous {
        position: absolute;
        width: 100%;
        height: 100%;
        background: url("/images/clip-path.svg") no-repeat;
        background-size: cover;
        opacity: .8;
        cursor: pointer;
    } */
    .aclaracion {
        color: var(--text);
        font-weight: 300;
        font-size: .9em;
        width: 90%;
        margin-left: 1rem;
    }
    .sub {
        text-align: center;
    }
    /* .frame {
        height: 60vh;
        position: relative;
        background-color: #f0f0f0;
    } */
    .cont {
        max-width: 50em;
        margin: 0 auto;
    }
    .consulta-cobertura {
        margin: 2em 0;
        padding: 0 1rem;
    }
    .consulta-cobertura label {
        display: block;
        color: var(--text);
        font-size: 1em;
        font-weight: 500;
        margin-bottom: 1em;
        text-align: center;
        max-width: 35rem;
        margin-left: auto;
        margin-right: auto;
    }
    .input-group {
        display: flex;
        gap: 0.5em;
        align-items: stretch;
    }
    .input-group input {
        flex: 1;
        padding: 0.8em 1em;
        border: 1px solid #ccc;
        border-radius: 0.5em;
        font-size: 1em;
        font-family: inherit;
    }
    .input-group input:focus {
        outline: none;
        border-color: var(--violeta1);
    }
    .btn-consultar {
        display: flex;
        align-items: center;
        gap: 0.5em;
        padding: 0.8em 1.5em;
        background: var(--violeta1);
        color: white;
        border: none;
        border-radius: 0.5em;
        font-size: 1em;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s ease;
        white-space: nowrap;
    }
    .btn-consultar:hover {
        background: var(--violeta2);
    }
    .btn-consultar .wsp-icon {
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ffffff'%3E%3Cpath d='M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z'/%3E%3C/svg%3E");
        background-size: cover;
        width: 1.5em;
        height: 1.5em;
        display: inline-block;
    }

    /* Mobile: apilamos input + CTA para evitar desbordes */
    @media (max-width: 640px) {
        section {
            margin: 5em 0;
        }
        .consulta-cobertura {
            margin: 1.5em 0;
            padding: 0 0.75rem;
        }
        .consulta-cobertura label {
            font-size: 0.95em;
            margin-bottom: 0.75em;
            padding: 0 0.25rem;
        }
        .input-group {
            flex-direction: column;
            gap: 0.75em;
        }
        .input-group input {
            padding: 0.9em 1em;
            font-size: 1em;
        }
        .btn-consultar {
            width: 100%;
            justify-content: center;
            padding: 0.9em 1.1em;
        }
        .btn-consultar .wsp-icon {
            width: 1.25em;
            height: 1.25em;
            margin-right: 0.35em;
        }
    }
    @media (min-width: 800px) {
        /* .explain-menu-m {
            display: none;
        } */
        /* .frame {
            height: 50vh;
        } */
    }
</style>
