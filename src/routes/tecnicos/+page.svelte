<script>
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { tecnicos } from '$lib/tecnicos.js';
    import Accordion from '$lib/components/ui/Accordion.svelte';
    import Spinner from '$lib/components/ui/Spinner.svelte';
    import { pb } from '$lib/pocketbase';

    let formId = $state('');
    let error = $state('');

    let pageId = $state(null);
    let tecnico = $state(null);
    let certificadoArtUrl = $state(null);
    let loadingCertificado = $state(true);

    onMount(async () => {
        const urlParams = new URLSearchParams(window.location.search);
        const id = urlParams.get('id');
        if (id) {
            pageId = id;
            tecnico = tecnicos.find(t => t.id === id) ?? null;
        }
        
        // Cargar certificado ART desde PocketBase
        await loadCertificadoArt();
    });

    async function loadCertificadoArt() {
        try {
            const record = await pb.collection('otros').getOne('o7950s83wc0ny2u');
            if (record.poliza && record.poliza.length > 0) {
                certificadoArtUrl = pb.files.getURL(record, record.poliza[0]);
            }
        } catch (error) {
            console.log('No hay certificado ART cargado');
        } finally {
            loadingCertificado = false;
        }
    }

    function search() {
        error = '';
        if (!formId) {
            error = 'Por favor, ingrese un ID.';
            return;
        }
        goto(`/tecnicos?id=${formId}`, { invalidateAll: true });
    }
</script>

<main>
    {#if pageId !== null}
        {#if tecnico}
            <div class="content-wrapper">
                <div class="tecnico-card">
                    <img src={tecnico.image} alt="Foto de {tecnico.name}" />
                    <div class="info">
                        <h1>{tecnico.name}</h1>
                        <p><strong>DNI:</strong> {tecnico.id}</p>
                    </div>
                </div>
                <div class="accordions-container">
                    <Accordion title="Póliza de seguro automotor">
                        <div class="download-section">
                            <a href="/assets/tecnicos/poliza-seguro.pdf" download class="download-btn">
                                Descargar Póliza PDF
                            </a>
                        </div>
                    </Accordion>
                    <Accordion title="Certificado ART">
                        <div class="download-section">
                            {#if loadingCertificado}
                                <div class="loading-container">
                                    <Spinner size={30} color="var(--violeta1)" borderWidth={3} label="Cargando certificado..." />
                                </div>
                            {:else if certificadoArtUrl}
                                <a href={certificadoArtUrl} download class="download-btn">
                                Descargar Certificado PDF
                            </a>
                            {:else}
                                <div class="no-certificado">
                                    <p>No hay certificado ART disponible</p>
                                </div>
                            {/if}
                        </div>
                    </Accordion>
                </div>
            </div>
        {:else}
            <div class="not-found">
                <h1>Técnico no encontrado</h1>
                <p>No se encontró un técnico con el DNI: <strong>{pageId}</strong></p>
                <a href="/tecnicos" class="back-link">Intentar de nuevo</a>
            </div>
        {/if}
    {:else}
        <div class="search-container">
            <div class="form-group">
                <label for="tecnico-id">Ingrese el ID del técnico</label>
                <input type="text" id="tecnico-id" bind:value={formId} placeholder="ID" onkeydown={(e) => e.key === 'Enter' && search()} />
            </div>
            <button class="btn-1" onclick={search}>Buscar</button>
            {#if error}
                <p class="error">{error}</p>
            {/if}
        </div>
    {/if}
</main>

<style>
    main {
        padding: 1em;
        padding-top: 3em;
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 80vh;
    }
    .search-container {
        max-width: 25em;
        width: 100%;
        padding: 2em;
        border: 1px solid #ccc;
        border-radius: 8px;
        background-color: #f9f9f9;
    }
    .form-group {
        margin-bottom: 1em;
    }
    label {
        display: block;
        margin-bottom: 0.5em;
    }
    input {
        width: 100%;
        padding: 0.5em;
        border: 1px solid #ccc;
        border-radius: 4px;
    }
    button.btn-1 {
        width: 100%;
        padding: 0.75em;
        border: none;
        border-radius: 4px;
        color: white;
        font-size: 1em;
        cursor: pointer;
    }
    .error {
        color: red;
        text-align: center;
        margin-top: 1em;
    }
    .content-wrapper {
        max-width: 25em;
        width: 100%;
        padding-top: 3em;
    }
    .tecnico-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        width: 100%;
        padding: 2em;
        border: 1px solid #ccc;
        border-radius: 8px;
        background-color: #f9f9f9;
    }
    .tecnico-card img {
        width: 10em;
        height: 10em;
        border-radius: 50%;
        object-fit: cover;
        margin-bottom: 1em;
    }
    .accordions-container {
        width: 100%;
        margin-top: 1em;
    }
    .info h1 {
        color: var(--violeta2);
        font-size: 1.5em;
    }
    .not-found {
        text-align: center;
    }
    .back-link {
        color: var(--violeta);
        text-decoration: none;
        display: inline-block;
        margin-top: 1em;
        font-weight: 600;
    }
    .back-link:hover {
        text-decoration: underline;
    }
    .download-section {
        padding: 1em;
        text-align: center;
    }
    .download-btn {
        display: inline-block;
        padding: 0.75em 1.5em;
        background-color: var(--violeta2);
        color: white;
        text-decoration: none;
        border-radius: var(--border-radius);
        font-weight: 600;
    }
    .download-btn:hover {
        background-color: var(--violeta2);
        text-decoration: none;
    }
    
    .loading-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1em;
        padding: 2em;
        color: var(--violeta1);
    }

    .no-certificado {
        text-align: center;
        padding: 2em;
        color: #666;
        font-style: italic;
    }
</style>