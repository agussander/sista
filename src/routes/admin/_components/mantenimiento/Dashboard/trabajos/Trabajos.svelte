<script>
import { onMount } from 'svelte';
import { pb } from '$lib/pocketbase';
import Spinner from '$lib/components/ui/Spinner.svelte';

let records = $state([]);
let filteredRecords = $state([]);
let searchTerm = $state('');
let loading = $state(true);
let error = $state(null);
let selectedRecord = $state(null);
let showDetails = $state(false);

// Filtros por categoría
let filterPuesto = $state('todos');
let filterFecha = $state('todos');
let filterEstado = $state('todos');
let filterNivelEstudios = $state('todos');

// Opciones para los filtros
let puestosUnicos = $state([]);
let fechasUnicas = $state([]);
let estadosUnicos = $state([]);
let nivelesUnicos = $state([]);

// Función para cargar todos los trabajos
async function loadTrabajos() {
    try {
        loading = true;
        error = null;
        console.log('Iniciando carga de trabajos...');
        
        // Probar diferentes nombres de colección
        const possibleNames = ['trabajos', 'trabajo', 'solicitudes_trabajo', 'formularios_trabajo'];
        let data = [];
        let collectionName = '';
        
        for (const name of possibleNames) {
            try {
                console.log(`Probando colección: ${name}`);
                data = await pb.collection(name).getFullList();
                if (data.length > 0) {
                    collectionName = name;
                    console.log(`¡Encontrada! Colección: ${name} con ${data.length} registros`);
                    break;
                }
            } catch (err) {
                console.log(`Colección ${name} no existe o error:`, err.message);
            }
        }
        
        if (data.length === 0) {
            // Si no encontramos nada, probar con la colección original
            console.log('Probando colección original: trabajos');
            data = await pb.collection('trabajos').getFullList();
            collectionName = 'trabajos';
        }
        
        console.log('Respuesta de PocketBase:', data);
        console.log('Cantidad de registros:', data.length);
        console.log('Primer registro (si existe):', data[0]);
        console.log('Colección usada:', collectionName);
        
        records = data.sort((a, b) => new Date(b.created) - new Date(a.created));
        filteredRecords = records;
        
        // Extraer opciones únicas para los filtros
        extractFilterOptions(data);
        
        if (data.length === 0) {
            console.log('No hay registros en ninguna colección de trabajos');
        }
    } catch (err) {
        error = err.message;
        console.error('Error al cargar trabajos:', err);
        console.error('Error completo:', err);
    } finally {
        loading = false;
    }
}

// Función para extraer opciones únicas para los filtros
function extractFilterOptions(data) {
    const puestos = new Set();
    const fechas = new Set();
    const estados = new Set();
    const niveles = new Set();
    
    data.forEach(record => {
        // Extraer puesto
        if (record.puesto && record.puesto !== 'seleccionar') {
            puestos.add(record.puesto);
        }
        
        // Extraer fecha (formatear para mostrar solo año-mes)
        if (record.created) {
            const fecha = new Date(record.created);
            const fechaFormateada = fecha.toISOString().substring(0, 7); // YYYY-MM
            fechas.add(fechaFormateada);
        }
        
        // Extraer estado (podríamos definir estados basados en campos)
        if (record.estado) {
            estados.add(record.estado);
        } else {
            estados.add('Pendiente'); // Estado por defecto
        }
        
        // Extraer nivel de estudios
        if (record.nivelEstudios) {
            niveles.add(record.nivelEstudios);
        }
    });
    
    puestosUnicos = Array.from(puestos).sort();
    fechasUnicas = Array.from(fechas).sort().reverse(); // Más recientes primero
    estadosUnicos = Array.from(estados).sort();
    nivelesUnicos = Array.from(niveles).sort();
}

// Función para filtrar registros
function filterRecords() {
    let filtered = records;
    
    // Filtro por búsqueda de texto
    if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(record => {
            return Object.values(record).some(value => {
                if (typeof value === 'string') {
                    return value.toLowerCase().includes(term);
                } else if (typeof value === 'object' && value !== null) {
                    return JSON.stringify(value).toLowerCase().includes(term);
                }
                return false;
            });
        });
    }
    
    // Filtro por puesto
    if (filterPuesto !== 'todos') {
        filtered = filtered.filter(record => record.puesto === filterPuesto);
    }
    
    // Filtro por fecha
    if (filterFecha !== 'todos') {
        filtered = filtered.filter(record => {
            if (record.created) {
                const fecha = new Date(record.created);
                const fechaFormateada = fecha.toISOString().substring(0, 7);
                return fechaFormateada === filterFecha;
            }
            return false;
        });
    }
    
    // Filtro por estado
    if (filterEstado !== 'todos') {
        filtered = filtered.filter(record => {
            const estado = record.estado || 'Pendiente';
            return estado === filterEstado;
        });
    }
    
    // Filtro por nivel de estudios
    if (filterNivelEstudios !== 'todos') {
        filtered = filtered.filter(record => record.nivelEstudios === filterNivelEstudios);
    }
    
    filteredRecords = filtered;
}

// Función para limpiar todos los filtros
function clearFilters() {
    searchTerm = '';
    filterPuesto = 'todos';
    filterFecha = 'todos';
    filterEstado = 'todos';
    filterNivelEstudios = 'todos';
    filterRecords();
}

// Función para formatear fecha para mostrar
function formatFilterDate(dateString) {
    if (!dateString) return '';
    const [year, month] = dateString.split('-');
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                       'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
}

// Función para formatear fechas
function formatDate(dateString) {
    if (!dateString) return 'No especificado';
    try {
        return new Date(dateString).toLocaleDateString('es-ES');
    } catch {
        return dateString;
    }
}

// Función para formatear datos personales
function formatDatosPersonales(record) {
    if (!record) return 'No especificado';
    const { nombre, apellido, dni, nacimiento } = record;
    return `${nombre || ''} ${apellido || ''} (DNI: ${dni || 'N/A'})`;
}

// Función para parsear formación académica
function parseFormacion(formacion) {
    if (!formacion) return [];
    
    // Si es string, intentar parsear como JSON
    if (typeof formacion === 'string') {
        try {
            const parsed = JSON.parse(formacion);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return []; // Si no es JSON válido, devolver array vacío
        }
    }
    
    // Si es array directamente
    return Array.isArray(formacion) ? formacion : [];
}

// Función para parsear experiencia laboral
function parseExperiencia(experiencia) {
    if (!experiencia) return [];
    
    // Si es string, intentar parsear como JSON
    if (typeof experiencia === 'string') {
        try {
            const parsed = JSON.parse(experiencia);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return []; // Si no es JSON válido, devolver array vacío
        }
    }
    
    // Si es array directamente
    return Array.isArray(experiencia) ? experiencia : [];
}

// Función para formatear datos de contacto
function formatContacto(record) {
    if (!record) return 'No especificado';
    const { telefono, email } = record;
    return `Tel: ${telefono || 'N/A'} | Email: ${email || 'N/A'}`;
}

// Función para formatear curriculum
function formatCurriculum(record) {
    if (!record) return 'No especificado';
    
    // Si hay archivo subido
    if (record.curriculum && Array.isArray(record.curriculum) && record.curriculum.length > 0) {
        return `Archivo: ${record.curriculum[0]}`;
    }
    
    // Si hay enlace
    if (record.cv_enlace) {
        return `Enlace: ${record.cv_enlace}`;
    }
    
    return 'No especificado';
}

// Función para formatear fecha
function formatFecha(fecha) {
    if (!fecha) return 'N/A';
    try {
        return new Date(fecha).toLocaleDateString('es-AR');
    } catch (e) {
        return 'Fecha inválida';
    }
}

// Función para seleccionar un registro y mostrar detalles
function selectRecord(record) {
    selectedRecord = record;
    showDetails = true;
}

// Función para cerrar detalles
function closeDetails() {
    showDetails = false;
    selectedRecord = null;
}

// Función para descargar curriculum
function downloadCV(record) {
    if (record.curriculum && Array.isArray(record.curriculum) && record.curriculum.length > 0) {
        const fileUrl = pb.files.getURL(record, record.curriculum[0]);
        window.open(fileUrl, '_blank');
    } else if (record.cv_enlace) {
        window.open(record.cv_enlace, '_blank');
    }
}

// Cargar datos al montar
onMount(() => {
    loadTrabajos();
});

// Efectos reactivos para aplicar filtros automáticamente
$effect(() => {
    filterRecords();
});

// Filtrar cuando cambie el término de búsqueda
$effect(() => {
    filterRecords();
});
</script>

<div class="trabajos-container">
    <div class="header">
        <h1>Gestión de Trabajos</h1>
        <p>Visualiza y gestiona todas las solicitudes de trabajo</p>
    </div>

    <!-- Barra de búsqueda -->
    <div class="search-container">
        <div class="search-box">
            <svg class="search-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.35-4.35"/>
            </svg>
            <input 
                type="text" 
                placeholder="Buscar en todos los campos..." 
                bind:value={searchTerm}
                class="search-input"
            />
        </div>
        <div class="stats">
            <span class="stat-item">
                Total: <strong>{records.length}</strong>
            </span>
            <span class="stat-item">
                Mostrando: <strong>{filteredRecords.length}</strong>
            </span>
        </div>
    </div>
    
    <!-- Filtros por categoría -->
    <div class="filters-container">
        <div class="filter-group">
            <label for="filter-puesto">Puesto:</label>
            <select id="filter-puesto" bind:value={filterPuesto} class="filter-select">
                <option value="todos">Todos</option>
                {#each puestosUnicos as puesto}
                    <option value={puesto}>{puesto}</option>
                {/each}
            </select>
        </div>
        
        <div class="filter-group">
            <label for="filter-fecha">Fecha:</label>
            <select id="filter-fecha" bind:value={filterFecha} class="filter-select">
                <option value="todos">Todas</option>
                {#each fechasUnicas as fecha}
                    <option value={fecha}>{formatFilterDate(fecha)}</option>
                {/each}
            </select>
        </div>
        
        <div class="filter-group">
            <label for="filter-estado">Estado:</label>
            <select id="filter-estado" bind:value={filterEstado} class="filter-select">
                <option value="todos">Todos</option>
                {#each estadosUnicos as estado}
                    <option value={estado}>{estado}</option>
                {/each}
            </select>
        </div>
        
        <div class="filter-group">
            <label for="filter-nivel">Nivel de Estudios:</label>
            <select id="filter-nivel" bind:value={filterNivelEstudios} class="filter-select">
                <option value="todos">Todos</option>
                {#each nivelesUnicos as nivel}
                    <option value={nivel}>{nivel}</option>
                {/each}
            </select>
        </div>
        
        <button onclick={clearFilters} class="clear-filters-btn">
            Limpiar Filtros
        </button>
    </div>

    <!-- Contenido principal -->
    {#if loading}
        <div class="loading">
            <Spinner label="Cargando trabajos..." />
        </div>
    {:else if error}
        <div class="error">
            <p>Error al cargar los datos: {error}</p>
            <button onclick={loadTrabajos} class="retry-btn">Reintentar</button>
        </div>
    {:else if filteredRecords.length === 0}
        <div class="empty">
            <p>No se encontraron postulaciones</p>
            <p>Total de registros en la base: {records.length}</p>
            <button onclick={loadTrabajos} class="retry-btn">Recargar</button>
        </div>
    {:else}
        <div class="table-container">
            <table class="trabajos-table">
                <thead>
                    <tr>
                        <th>Nombre</th>
                        <th>Puesto</th>
                        <th>Teléfono</th>
                        <th>Email</th>
                        <th>Estudios</th>
                        <th>Fecha</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {#each filteredRecords as record}
                        <tr class="table-row" onclick={() => selectRecord(record)}>
                            <td class="nombre-cell">
                                <div class="candidate-info">
                                    <strong>{record.nombre || ''} {record.apellido || ''}</strong>
                                    <small>DNI: {record.dni || 'N/A'}</small>
                                </div>
                            </td>
                            <td class="puesto-cell">{record.puesto || 'No especificado'}</td>
                            <td class="telefono-cell">{record.telefono || 'N/A'}</td>
                            <td class="email-cell">{record.email || 'N/A'}</td>
                            <td class="estudios-cell">{record.secundario || 'No especificado'}</td>
                            <td class="fecha-cell">{formatFecha(record.created)}</td>
                            <td class="actions-cell">
                                <button class="btn-view" onclick={(e) => {e.stopPropagation(); selectRecord(record);}}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                        <circle cx="12" cy="12" r="3"></circle>
                                    </svg>
                                    Ver
                                </button>
                                <button class="btn-cv" onclick={(e) => {e.stopPropagation(); downloadCV(record);}} disabled={!record.curriculum?.length && !record.cv_enlace}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                        <polyline points="14 2 14 8 20 8"></polyline>
                                        <line x1="16" y1="13" x2="8" y2="13"></line>
                                        <line x1="16" y1="17" x2="8" y2="17"></line>
                                        <polyline points="10 9 9 9 8 9"></polyline>
                                    </svg>
                                    CV
                                </button>
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    {/if}

    <!-- Modal de detalles -->
    {#if showDetails && selectedRecord}
        <div class="modal-overlay" onclick={closeDetails} onkeydown={(e) => e.key === 'Escape' && closeDetails()} role="dialog" tabindex="-1">
            <div class="modal-content" onclick={(e) => e.stopPropagation()} role="document">
                <div class="modal-header">
                    <button class="btn-close" onclick={closeDetails} aria-label="Cerrar modal">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                    <div class="header-left">
                        <h2>{selectedRecord.nombre || 'Sin nombre'} {selectedRecord.apellido || 'Sin apellido'}</h2>
                        <div class="puesto-destacado">{selectedRecord.puesto || 'Sin puesto especificado'}</div>
                    </div>
                    <div class="header-right">
                        <div class="contacto-item">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                            </svg>
                            <span>{selectedRecord.telefono || 'Sin teléfono'}</span>
                        </div>
                        <div class="contacto-item">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                                <polyline points="22,6 12,13 2,6"></polyline>
                            </svg>
                            <span>{selectedRecord.email || 'Sin email'}</span>
                        </div>
                    </div>
                </div>
                
                <div class="modal-body">
                    <div class="detail-section">
                        <h3>Información Personal</h3>
                        <div class="detail-grid">
                            <div class="detail-item">
                                <span class="detail-label">DNI:</span>
                                <span>{selectedRecord.dni || 'N/A'}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Fecha de Nacimiento:</span>
                                <span>{formatFecha(selectedRecord.nacimiento)}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Estudios Secundarios:</span>
                                <span>{selectedRecord.secundario || 'N/A'}</span>
                            </div>
                        </div>
                    </div>


                    {#if parseFormacion(selectedRecord.formacion).length > 0}
                        <div class="detail-section">
                            <h3>Formación Académica</h3>
                            <div class="items-list">
                                {#each parseFormacion(selectedRecord.formacion) as item}
                                    <div class="item-card">
                                        <div class="item-header">
                                            <strong>{item.titulo || 'Sin título'}</strong>
                                            <span class="item-periodo">
                                                {item.enCurso ? 'En curso' : `${item.incio || ''} - ${item.fin || ''}`}
                                            </span>
                                        </div>
                                        <div class="item-detail">{item.institucion || 'Sin institución'}</div>
                                    </div>
                                {/each}
                            </div>
                        </div>
                    {/if}

                    {#if parseExperiencia(selectedRecord.experiencia).length > 0}
                        <div class="detail-section">
                            <h3>Experiencia Laboral</h3>
                            <div class="items-list">
                                {#each parseExperiencia(selectedRecord.experiencia) as item}
                                    <div class="item-card">
                                        <div class="item-header">
                                            <strong>{item.puesto || 'Sin puesto'}</strong>
                                            <span class="item-periodo">
                                                {item.enCurso ? 'En curso' : `${item.inicio || ''} - ${item.fin || ''}`}
                                            </span>
                                        </div>
                                        <div class="item-detail">{item.organizacion || 'Sin organización'}</div>
                                    </div>
                                {/each}
                            </div>
                        </div>
                    {/if}

                    <div class="detail-section">
                        <h3>Curriculum</h3>
                        <div class="cv-section">
                            {#if selectedRecord.curriculum && Array.isArray(selectedRecord.curriculum) && selectedRecord.curriculum.length > 0}
                                <button class="btn-download" onclick={() => downloadCV(selectedRecord)}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5"></path>
                                        <polyline points="7 10 12 15 17 10"></polyline>
                                        <line x1="12" y1="15" x2="12" y2="3"></line>
                                    </svg>
                                    Descargar CV
                                </button>
                            {:else if selectedRecord.cv_enlace}
                                <a href={selectedRecord.cv_enlace} target="_blank" class="btn-link">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                        <polyline points="15 3 21 3 21 9"></polyline>
                                        <line x1="10" y1="14" x2="21" y2="3"></line>
                                    </svg>
                                    Ver CV Online
                                </a>
                            {:else}
                                <p class="no-cv">No hay curriculum disponible</p>
                            {/if}
                        </div>
                    </div>

                    <div class="detail-section">
                        <div class="detail-grid">
                            <div class="detail-item">
                                <span class="detail-label">Fecha de Postulación:</span>
                                <span>{formatFecha(selectedRecord.created)}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">ID del Registro:</span>
                                <span>{selectedRecord.id}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    {/if}
</div>

<style>
.trabajos-container {
    padding: 2em;
    max-width: 100%;
    overflow-x: auto;
}

.header {
    margin-bottom: 2em;
}

.header h1 {
    color: #333;
    margin-bottom: 0.5em;
    font-size: 2em;
}

.header p {
    color: #666;
    margin: 0;
}

.search-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2em;
    gap: 1em;
    flex-wrap: wrap;
}

.search-box {
    position: relative;
    flex: 1;
    min-width: 300px;
}

.search-icon {
    position: absolute;
    left: 1em;
    top: 50%;
    transform: translateY(-50%);
    color: #999;
}

.search-input {
    width: 100%;
    padding: 0.8em 1em 0.8em 3em;
    border: 2px solid #e0e0e0;
    border-radius: 0.5em;
    font-size: 1em;
    transition: border-color 0.2s ease;
}

.search-input:focus {
    outline: none;
    border-color: var(--violeta2);
}

.stats {
    display: flex;
    gap: 1em;
    font-size: 0.9em;
    color: #666;
}

.stat-item strong {
    color: var(--violeta2);
}

/* Estilos para filtros */
.filters-container {
    display: flex;
    gap: 1.5em;
    align-items: center;
    margin-bottom: 2em;
    padding: 1.5em;
    background: #f8f9fa;
    border-radius: 0.5em;
    border: 1px solid #e9ecef;
    flex-wrap: wrap;
}

.filter-group {
    display: flex;
    flex-direction: column;
    gap: 0.5em;
    min-width: 150px;
}

.filter-group label {
    font-size: 0.85em;
    font-weight: 600;
    color: #495057;
    margin: 0;
}

.filter-select {
    padding: 0.5em 0.75em;
    border: 1px solid #ced4da;
    border-radius: 0.375em;
    background: white;
    font-size: 0.9em;
    color: #495057;
    cursor: pointer;
    transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
}

.filter-select:focus {
    outline: none;
    border-color: var(--violeta2);
    box-shadow: 0 0 0 0.2em rgba(112, 40, 162, 0.25);
}

.clear-filters-btn {
    padding: 0.5em 1em;
    background: #6c757d;
    color: white;
    border: none;
    border-radius: 0.375em;
    font-size: 0.9em;
    cursor: pointer;
    transition: background-color 0.15s ease-in-out;
    align-self: flex-end;
    margin-top: 1.5em;
}

.clear-filters-btn:hover {
    background: #5a6268;
}

.loading, .error, .empty {
    text-align: center;
    padding: 3em;
    color: #666;
}

.retry-btn {
    background: var(--violeta2);
    color: white;
    border: none;
    padding: 0.8em 1.5em;
    border-radius: 0.5em;
    cursor: pointer;
    margin-top: 1em;
}

.retry-btn:hover {
    background: var(--violeta2-hover);
}

.table-container {
    background: white;
    border-radius: 0.8em;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    overflow: hidden;
    border: 1px solid #e0e0e0;
    max-width: 100%;
    overflow-x: auto;
}

.trabajos-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9em;
    min-width: 800px;
}

.trabajos-table th {
    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
    padding: 1.2em 1em;
    text-align: left;
    font-weight: 600;
    color: #333;
    border-bottom: 2px solid var(--violeta2);
    position: sticky;
    top: 0;
    z-index: 10;
    white-space: nowrap;
}

.trabajos-table td {
    padding: 1em;
    border-bottom: 1px solid #f0f0f0;
    vertical-align: middle;
    word-wrap: break-word;
}

.table-row {
    cursor: pointer;
    transition: all 0.2s ease;
}

.table-row:hover {
    background: linear-gradient(135deg, #f8f9ff 0%, #f0f2ff 100%);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.candidate-info {
    display: flex;
    flex-direction: column;
    gap: 0.2em;
}

.candidate-info strong {
    color: var(--violeta1);
    font-size: 1em;
}

.candidate-info small {
    color: #666;
    font-size: 0.8em;
}

.nombre-cell {
    min-width: 180px;
}

.puesto-cell {
    min-width: 120px;
    font-weight: 500;
}

.telefono-cell, .email-cell {
    min-width: 120px;
    font-size: 0.9em;
}

.estudios-cell {
    min-width: 120px;
}

.fecha-cell {
    min-width: 100px;
    font-size: 0.85em;
    color: #666;
}

.actions-cell {
    min-width: 140px;
    padding: 0.5em;
}

.btn-view, .btn-cv {
    display: inline-flex;
    align-items: center;
    gap: 0.3em;
    padding: 0.4em 0.8em;
    border: none;
    border-radius: 0.4em;
    font-size: 0.8em;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    margin: 0.1em;
}

.btn-view {
    background: var(--violeta1);
    color: white;
}

.btn-view:hover {
    background: var(--violeta2);
    transform: translateY(-1px);
}

.btn-cv {
    background: #28a745;
    color: white;
}

.btn-cv:hover:not(:disabled) {
    background: #218838;
    transform: translateY(-1px);
}

.btn-cv:disabled {
    background: #ccc;
    cursor: not-allowed;
    opacity: 0.6;
}

/* Responsive */
@media (max-width: 768px) {
    .search-container {
        flex-direction: column;
        align-items: stretch;
    }
    
    .search-box {
        min-width: auto;
    }
    
    .stats {
        justify-content: center;
    }
    
    .filters-container {
        flex-direction: column;
        align-items: stretch;
        gap: 1em;
    }
    
    .filter-group {
        min-width: auto;
    }
    
    .clear-filters-btn {
        align-self: stretch;
        margin-top: 0;
    }
    
    .trabajos-table {
        font-size: 0.8em;
    }
    
    .trabajos-table th,
    .trabajos-table td {
        padding: 0.5em;
    }
}

/* Modal Styles */
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 2em;
}

.modal-content {
    background: white;
    border-radius: 1em;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
    max-width: 800px;
    max-height: 90vh;
    width: 100%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.modal-header {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: start;
    padding: 1.5em 2em;
    border-bottom: 1px solid #e0e0e0;
    background: linear-gradient(135deg, var(--violeta1) 0%, var(--violeta2) 100%);
    color: white;
    gap: 2em;
    position: relative;
}

.header-left {
    display: flex;
    flex-direction: column;
    gap: 0.5em;
    text-align: left;
}

.header-right {
    display: flex;
    flex-direction: column;
    gap: 0.8em;
    align-items: flex-end;
    min-width: 250px;
}

.btn-close {
    position: absolute;
    top: 1em;
    right: 1em;
    background: none;
    border: none;
    color: white;
    cursor: pointer;
    padding: 0.5em;
    border-radius: 0.3em;
    transition: all 0.2s ease;
}

.btn-close:hover {
    background: rgba(255, 255, 255, 0.1);
}

.modal-header h2 {
    margin: 0;
    font-size: 1.5em;
    color: white;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.puesto-destacado {
    background: rgba(255, 255, 255, 0.9);
    color: var(--violeta1);
    padding: 0.3em 0.8em;
    border-radius: 1em;
    font-size: 0.9em;
    font-weight: 600;
    border: 1px solid rgba(255, 255, 255, 0.5);
    text-shadow: none;
    width: fit-content;
}

.contacto-item {
    display: flex;
    align-items: center;
    gap: 0.5em;
    color: rgba(255, 255, 255, 0.9);
    font-size: 0.9em;
    background: rgba(255, 255, 255, 0.1);
    padding: 0.4em 0.8em;
    border-radius: 0.5em;
    border: 1px solid rgba(255, 255, 255, 0.2);
    width: fit-content;
}

.contacto-item svg {
    flex-shrink: 0;
    opacity: 0.8;
}


.modal-body {
    padding: 2em;
    overflow-y: auto;
    flex: 1;
}

.detail-section {
    margin-bottom: 2em;
    padding-bottom: 1.5em;
    border-bottom: 1px solid #f0f0f0;
}

.detail-section:last-child {
    border-bottom: none;
    margin-bottom: 0;
}

.detail-section h3 {
    color: var(--violeta1);
    margin-bottom: 1em;
    font-size: 1.2em;
    font-weight: 600;
}

.detail-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1em;
}

.detail-item {
    display: flex;
    flex-direction: column;
    gap: 0.3em;
}

.detail-label {
    font-weight: 600;
    color: #555;
    font-size: 0.9em;
}

.detail-item span {
    color: #333;
    font-size: 1em;
}

.items-list {
    display: flex;
    flex-direction: column;
    gap: 1em;
}

.item-card {
    background: #f8f9fa;
    padding: 1.2em;
    border-radius: 0.6em;
    border-left: 4px solid var(--violeta2);
    transition: all 0.2s ease;
}

.item-card:hover {
    background: #f0f2ff;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.item-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1em;
    margin-bottom: 0.5em;
}

.item-header strong {
    color: var(--violeta1);
    font-size: 1em;
    font-weight: 600;
    flex: 1;
}

.item-periodo {
    background: #e9ecef;
    color: #333;
    padding: 0.2em 0.6em;
    border-radius: 0.3em;
    font-size: 0.8em;
    font-weight: 500;
    white-space: nowrap;
    border: 1px solid #dee2e6;
}

.item-detail {
    color: #555;
    font-size: 0.9em;
    font-weight: 500;
}

.cv-section {
    display: flex;
    gap: 1em;
    align-items: center;
}

.btn-download, .btn-link {
    display: inline-flex;
    align-items: center;
    gap: 0.5em;
    padding: 0.8em 1.5em;
    border-radius: 0.5em;
    text-decoration: none;
    font-weight: 600;
    transition: all 0.3s ease;
    border: none;
    cursor: pointer;
}

.btn-download {
    background: var(--violeta1);
    color: white;
}

.btn-download:hover {
    background: var(--violeta2);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.btn-link {
    background: #007bff;
    color: white;
}

.btn-link:hover {
    background: #0056b3;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.no-cv {
    color: #666;
    font-style: italic;
    padding: 1em;
    background: #f8f9fa;
    border-radius: 0.5em;
    border: 1px dashed #ccc;
}

@media (max-width: 768px) {
    .modal-overlay {
        padding: 1em;
    }
    
    .modal-content {
        max-height: 95vh;
    }
    
    .modal-header {
        padding: 1em;
    }
    
    .modal-body {
        padding: 1em;
    }
    
    .detail-grid {
        grid-template-columns: 1fr;
    }
    
    .cv-section {
        flex-direction: column;
        align-items: stretch;
    }
}
</style>
