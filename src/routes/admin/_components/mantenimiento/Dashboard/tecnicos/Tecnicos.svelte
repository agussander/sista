<script>
import { pb } from '$lib/pocketbase';
import { onMount } from 'svelte';
import Spinner from '$lib/components/ui/Spinner.svelte';

let polizaFile = $state(null);
let currentFileUrl = $state(null);
let uploadingFile = $state(false);
let isDragOver = $state(false);
let lastUpdated = $state(null);

onMount(async () => {
    await loadPoliza();
});

function formatDate(date) {
    if (!date) return '';
    return date.toLocaleDateString('es-AR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

async function loadPoliza() {
    try {
        const record = await pb.collection('otros').getOne('o7950s83wc0ny2u');
        if (record.poliza && record.poliza.length > 0) {
            currentFileUrl = pb.files.getURL(record, record.poliza[0]);
            lastUpdated = new Date(record.updated);
        }
    } catch (error) {
        console.log('No hay archivo de póliza cargado aún');
    }
}

function handleDragOver(event) {
    event.preventDefault();
    isDragOver = true;
}

function handleDragLeave(event) {
    event.preventDefault();
    isDragOver = false;
}

function handleDrop(event) {
    event.preventDefault();
    isDragOver = false;
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
        const file = files[0];
        if (file.type === 'application/pdf') {
            polizaFile = file;
            uploadFile();
        } else {
            alert('Por favor, selecciona un archivo PDF válido');
        }
    }
}

async function handleFileChange(event) {
    const file = event.target.files[0];
    if (file) {
        if (file.type === 'application/pdf') {
            polizaFile = file;
            await uploadFile();
        } else {
            alert('Por favor, selecciona un archivo PDF válido');
        }
    }
}

async function uploadFile() {
    if (!polizaFile) return;
    
    uploadingFile = true;
    try {
        const formData = new FormData();
        formData.append('poliza', polizaFile);
        
        // Actualizar siempre el mismo record
        const updatedRecord = await pb.collection('otros').update('o7950s83wc0ny2u', formData);
        currentFileUrl = pb.files.getURL(updatedRecord, updatedRecord.poliza[0]);
        lastUpdated = new Date(updatedRecord.updated);
        
        polizaFile = null;
        console.log('Archivo subido exitosamente');
    } catch (error) {
        console.error('Error al subir el archivo:', error);
        alert('Error al subir el archivo: ' + error.message);
    } finally {
        uploadingFile = false;
    }
}
</script>



    <div class="content">
        <div class="file-upload-section">
            <h2>Certificado ART</h2>
            <p>Sube el archivo PDF del certificado ART que se mostrará en la página de técnicos</p>
            
            <div class="file-upload-container">
                <div class="file-dropzone" 
                    class:drag-over={isDragOver}
                    onclick={() => document.getElementById('poliza-file').click()} 
                    role="button" 
                    tabindex="0" 
                    onkeydown={(e) => e.key === 'Enter' && document.getElementById('poliza-file').click()}
                    ondragover={handleDragOver}
                    ondragleave={handleDragLeave}
                    ondrop={handleDrop}>
                    {#if uploadingFile}
                        <div class="upload-progress">
                            <Spinner size={40} color="var(--violeta1)" borderWidth={3} label="Subiendo archivo..." />
                        </div>
                    {:else if currentFileUrl}
                        <div class="file-preview">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14,2 14,8 20,8"></polyline>
                                <line x1="16" y1="13" x2="8" y2="13"></line>
                                <line x1="16" y1="17" x2="8" y2="17"></line>
                                <polyline points="10,9 9,9 8,9"></polyline>
                            </svg>
                            <div class="file-info">
                                <p class="file-name">Certificado ART</p>
                                <p class="file-status">Actualizado: {formatDate(lastUpdated)}</p>
                            </div>
                            <a href={currentFileUrl} target="_blank" class="btn-view">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                    <circle cx="12" cy="12" r="3"></circle>
                                </svg>
                                Ver archivo
                            </a>
                        </div>
                    {:else}
                        <div class="empty-state">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7,10 12,15 17,10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                            <div class="empty-info">
                                <p class="empty-title">No hay certificado ART cargado</p>
                                <p class="empty-subtitle">Arrastra un PDF aquí o haz clic para seleccionar</p>
                            </div>
                        </div>
                    {/if}
                </div>
                
                <input 
                    type="file" 
                    id="poliza-file" 
                    accept=".pdf" 
                    style="display: none;" 
                    onchange={handleFileChange}
                />
                
                <div class="file-hint">
                    <p>Formatos aceptados: PDF</p>
                    <p>Tamaño máximo: 10MB</p>
                </div>
            </div>
        </div>
    </div>

<style>
.tecnicos-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 2em;
    background: white;
    border-radius: 0.8em;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.header {
    margin-bottom: 2em;
    text-align: center;
}

.header h1 {
    margin: 0 0 0.5em 0;
    color: var(--violeta1);
    font-size: 2em;
    font-weight: 600;
}

.header p {
    margin: 0;
    color: #666;
    font-size: 1.1em;
}

.content {
    display: flex;
    flex-direction: column;
    gap: 2em;
    max-width: 50em;
    margin: 0 auto;
}

.file-upload-section {
    background: #f8f9fa;
    padding: 2em;
    border-radius: 0.6em;
    border: 2px dashed #e9ecef;
    transition: all 0.3s ease;
}

.file-upload-section:hover {
    border-color: var(--violeta2);
    background: #f0f2ff;
}

.file-upload-section h2 {
    margin: 0 0 0.5em 0;
    color: var(--violeta1);
    font-size: 1.4em;
    font-weight: 600;
}

.file-upload-section p {
    margin: 0 0 1.5em 0;
    color: #666;
}

.file-upload-container {
    display: flex;
    flex-direction: column;
    gap: 1em;
}

.file-dropzone {
    min-height: 200px;
    border: 2px dashed #ddd;
    border-radius: 0.6em;
    padding: 2em;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.3s ease;
    background: white;
}

.file-dropzone:hover {
    border-color: var(--violeta2);
    background: #f8f9ff;
}

.file-dropzone.drag-over {
    border-color: var(--violeta1);
    background: #f0f2ff;
    transform: scale(1.02);
    border-style: solid;
}

.upload-progress {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1em;
    color: var(--violeta1);
}

.file-preview {
    display: flex;
    align-items: center;
    gap: 1em;
    width: 100%;
    max-width: 500px;
}

.file-info {
    flex: 1;
}

.file-name {
    margin: 0 0 0.3em 0;
    font-weight: 600;
    color: var(--violeta1);
    font-size: 1.1em;
}

.file-status {
    margin: 0;
    color: #28a745;
    font-size: 0.9em;
}

.btn-view {
    display: flex;
    align-items: center;
    gap: 0.5em;
    padding: 0.5em 1em;
    background: var(--violeta1);
    color: white;
    text-decoration: none;
    border-radius: 0.4em;
    font-size: 0.9em;
    font-weight: 500;
    transition: all 0.2s ease;
}

.btn-view:hover {
    background: var(--violeta2);
    transform: translateY(-1px);
}

.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1em;
    color: #999;
    text-align: center;
}

.empty-info {
    display: flex;
    flex-direction: column;
    gap: 0.3em;
}

.empty-title {
    margin: 0;
    font-weight: 600;
    font-size: 1.1em;
    color: #666;
}

.empty-subtitle {
    margin: 0;
    font-size: 0.9em;
    color: #999;
}

.file-hint {
    display: flex;
    gap: 2em;
    justify-content: center;
    margin-top: 1em;
}

.file-hint p {
    margin: 0;
    font-size: 0.85em;
    color: #666;
    background: #f8f9fa;
    padding: 0.3em 0.8em;
    border-radius: 0.3em;
}

@media (max-width: 768px) {
    .tecnicos-container {
        margin: 1em;
        padding: 1.5em;
    }
    
    .file-dropzone {
        min-height: 150px;
        padding: 1.5em;
    }
    
    .file-preview {
        flex-direction: column;
        text-align: center;
        gap: 1em;
    }
    
    .file-hint {
        flex-direction: column;
        gap: 0.5em;
        align-items: center;
    }
}
</style>
