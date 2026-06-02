<script>
import { pb } from '$lib/pocketbase';
import { onMount } from 'svelte';
import Spinner from '$lib/components/ui/Spinner.svelte';

const labels = {
    home: 'Plan Home',
    fast: 'Plan Fast',
    power: 'Plan Power',
    gamer: 'Plan Gamer',
    worker: 'Plan Worker',
    max: 'Plan Max',
    telefono: 'Telefonía',
    instalacion: 'Instalación',
    dgo_basico: 'DGO Básico',
    dgo_full: 'DGO Full',
    antina: 'Antina'
};

// Inicializar precios con un objeto vacío que tenga todos los campos
let precios = $state({
    home: '',
    fast: '',
    power: '',
    gamer: '',
    worker: '',
    max: '',
    telefono: '',
    instalacion: '',
    dgo_basico: '',
    dgo_full: '',
    antina: ''
});

let loading = $state(false);
let initialLoading = $state(true);
let message = $state('');
let recordId = $state(null);
let preciosCompletosFile = $state(null);
let currentImageUrl = $state(null);
let uploadingImage = $state(false);

// Función para formatear números con puntos
const formatNumber = (value) => {
    if (!value) return '';
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

// Función para quitar los puntos y convertir a número
const parseNumber = (value) => {
    if (!value) return '';
    return value.toString().replace(/\./g, '');
};

const loadPrecios = async () => {
    try {
        const record = await pb.collection('precios').getFirstListItem('');
        if (record) {
            recordId = record.id;
            // Solo actualizar los campos que existen en nuestro objeto precios
            Object.keys(precios).forEach(key => {
                if (record[key] !== undefined) {
                    precios[key] = record[key];
                }
            });
            // Cargar la imagen actual si existe
            if (record.precios_completos) {
                currentImageUrl = pb.files.getURL(record, record.precios_completos);
            }
        }
    } catch (error) {
        console.error('Error loading prices:', error);
    } finally {
        initialLoading = false;
    }
};

const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
        preciosCompletosFile = file;
        // Subir automáticamente
        await uploadImage();
    }
};

const uploadImage = async () => {
    if (!preciosCompletosFile || !recordId) return;
    
    uploadingImage = true;
    message = '';
    
    try {
        const formData = new FormData();
        formData.append('precios_completos', preciosCompletosFile);
        
        const record = await pb.collection('precios').update(recordId, formData);
        
        // Actualizar la URL de la imagen actual
        if (record.precios_completos) {
            currentImageUrl = pb.files.getURL(record, record.precios_completos);
        }
        
        preciosCompletosFile = null;
        message = 'Imagen actualizada correctamente';
    } catch (error) {
        console.error('Error uploading image:', error);
        message = 'Error al subir la imagen. Intente nuevamente.';
    } finally {
        uploadingImage = false;
        setTimeout(() => {
            message = '';
        }, 3000);
    }
};

const savePrecios = async (e) => {
    e.preventDefault();
    loading = true;
    message = '';
    
    try {
        // Crear un objeto con solo los campos que queremos guardar
        const preciosToSave = {};
        Object.keys(precios).forEach(key => {
            preciosToSave[key] = parseNumber(precios[key]);
        });

        if (recordId) {
            // Actualizar el registro existente
            await pb.collection('precios').update(recordId, preciosToSave);
        } else {
            // Crear un nuevo registro
            const record = await pb.collection('precios').create(preciosToSave);
            recordId = record.id;
        }
        
        message = 'Precios actualizados';
    } catch (error) {
        console.error('Error saving prices:', error);
        message = 'Error al guardar los precios. Intente nuevamente.';
    } finally {
        loading = false;
        setTimeout(() => {
            message = '';
        }, 3000);
    }
};

onMount(async() => {
    loadPrecios();
});
</script>

{#if initialLoading}
    <div class="loading-container">
        <Spinner size={50} label="Cargando precios..." />
    </div>
{:else}
    <div class="edit-prices">
        <form onsubmit={savePrecios}>
            <div class="inputs-grid">
                {#each Object.entries(precios) as [key, value]}
                    {#if labels[key]}
                        <label for={key}>
                            {labels[key]}
                            <input 
                                type="text" 
                                id={key} 
                                value={formatNumber(value)}
                                oninput={(e) => precios[key] = parseNumber(e.target.value)}
                            >
                        </label>
                    {/if}
                {/each}
            </div>
                
                <div 
                    class="image-dropzone" 
                    class:has-image={currentImageUrl}
                    role="button"
                    tabindex="0"
                    onclick={() => document.getElementById('file-input').click()}
                    onkeydown={(e) => e.key === 'Enter' && document.getElementById('file-input').click()}
                >
                    {#if uploadingImage}
                        <div class="upload-progress">
                            <Spinner size={40} borderWidth={3} label="Subiendo imagen..." />
                        </div>
                    {:else if currentImageUrl}
                        <img src={currentImageUrl} alt="Precios completos" />
                        <div class="image-overlay">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="17 8 12 3 7 8"></polyline>
                                <line x1="12" y1="3" x2="12" y2="15"></line>
                            </svg>
                            <p>Click para cambiar imagen</p>
                        </div>
                    {:else}
                        <div class="empty-state">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                <polyline points="21 15 16 10 5 21"></polyline>
                            </svg>
                            <p>Click para subir imagen</p>
                            <span>PNG, JPG hasta 10MB</span>
                        </div>
                    {/if}
                </div>
                
                <input 
                    type="file" 
                    id="file-input"
                    accept="image/*"
                    onchange={handleFileChange}
                    style="display: none;"
                >


            <div class="actions">
                {#if message}
                    <p class="message" class:error={message.includes('Error')}>
                        {message}
                    </p>
                {/if}
                <button type="submit" class="btn-save" disabled={loading}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    {loading ? 'Guardando...' : 'Guardar Cambios'}
                </button>
            </div>
        </form>
    </div>
{/if}

<style>
.loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 300px;
    gap: 1em;
    color: #666;
    font-size: 1.1em;
}

.edit-prices {
    background: white;
    padding: 2em;
    border-radius: 1em;
    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.inputs-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 1.5em;
    margin-bottom: 2em;
}

label {
    display: flex;
    flex-direction: column;
    gap: 0.5em;
    font-weight: 500;
    color: #666;
}

input {
    padding: 0.8em;
    border: 1.5px solid #e0e0e0;
    border-radius: 0.5em;
    font-size: 1em;
    transition: border-color 0.2s;
}

input:focus {
    outline: none;
    border-color: var(--violeta2);
}

.actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 1em;
    margin-top: 2em;
    padding-top: 1.5em;
    border-top: 1px solid #e0e0e0;
}

.message {
    padding: 0.8em 1.2em;
    border-radius: 0.5em;
    background: #e8f5e9;
    color: #2e7d32;
}

.message.error {
    background: #ffebee;
    color: #c62828;
}

.btn-save {
    display: inline-flex;
    align-items: center;
    gap: 0.5em;
    background: linear-gradient(135deg, var(--violeta1) 0%, var(--violeta2) 100%);
    color: white;
    border: none;
    padding: 0.8em 1.5em;
    border-radius: 0.5em;
    font-size: 1em;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    min-width: 160px;
}

.btn-save:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.btn-save:active:not(:disabled) {
    transform: translateY(0);
}

.btn-save:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.btn-save svg {
    flex-shrink: 0;
}

.image-upload-container {
    margin: 2em 0;
    padding: 1.5em;
    background: #fafafa;
    border-radius: 0.8em;
    border: 1px solid #e0e0e0;
}

.image-label {
    font-weight: 600;
    color: #333;
    font-size: 1em;
    display: block;
    margin-bottom: 0.3em;
}

.image-hint {
    font-size: 0.85em;
    color: #666;
    margin-bottom: 1em;
}

.image-hint a {
    color: var(--violeta2);
    text-decoration: none;
}

.image-hint a:hover {
    text-decoration: underline;
}

.image-dropzone {
    position: relative;
    width: 100%;
    aspect-ratio: 16/9;
    border: 2px dashed #d0d0d0;
    border-radius: 0.5em;
    cursor: pointer;
    overflow: hidden;
    transition: all 0.3s ease;
    background: white;
}

.image-dropzone:hover {
    border-color: var(--violeta2);
    background: #f9f9ff;
}

.image-dropzone.has-image {
    border-style: solid;
    border-color: #e0e0e0;
}

.image-dropzone.has-image:hover {
    border-color: var(--violeta2);
}

.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3em 1em;
    color: #999;
}

.empty-state svg {
    margin-bottom: 1em;
    opacity: 0.5;
}

.empty-state p {
    font-weight: 600;
    color: #666;
    margin-bottom: 0.5em;
}

.empty-state span {
    font-size: 0.85em;
    color: #999;
}

.image-dropzone img {
    max-width: 100%;
    max-height: 100%;
    width: auto;
    height: auto;
    display: block;
    object-fit: contain;
    border-radius: 0.5em;
    margin: 0 auto;
}

.image-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.3s ease;
    color: white;
}

.image-dropzone:hover .image-overlay {
    opacity: 1;
}

.image-overlay svg {
    margin-bottom: 0.5em;
}

.image-overlay p {
    font-weight: 600;
    font-size: 0.95em;
}

.upload-progress {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3em 1em;
    color: #666;
    font-weight: 500;
}
</style>