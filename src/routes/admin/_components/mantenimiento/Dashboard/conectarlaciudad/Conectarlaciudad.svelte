<script>
import { onMount } from 'svelte';
import { goto } from '$app/navigation';
import { pb } from '$lib/pocketbase';
import Spinner from '$lib/components/ui/Spinner.svelte';

function irASorteo() {
    goto('/admin?view=sorteo-conectarlaciudad');
}

const COLUMNS = [
    { key: 'id', label: 'id' },
    { key: 'nombre', label: 'nombre' },
    { key: 'mail', label: 'mail' },
    { key: 'telefono', label: 'telefono' },
    { key: 'ruleta', label: 'ruleta' },
    { key: 'participo_ruleta', label: 'participo_ruleta' },
    { key: 'puntaje_total', label: 'puntaje_total' },
    { key: 'puntaje_bloques', label: 'puntaje_bloques' },
    { key: 'puntaje_palabras', label: 'puntaje_palabras' },
    { key: 'puntaje_ruleta', label: 'puntaje_ruleta' },
    { key: 'plays_palabras', label: 'plays_palabras' },
    { key: 'plays_bloques', label: 'plays_bloques' },
    { key: 'cliente', label: 'cliente' },
    { key: 'created', label: 'created' },
    { key: 'updated', label: 'updated' }
];

let items = $state([]);
let loading = $state(true);
let error = $state(null);
let sinDuplicados = $state(false);
let mostrarTelefonos = $state(false);
let mostrarMails = $state(false);
let sortKey = $state(null);
let sortDir = $state('asc'); // 'asc' | 'desc'

let filteredItems = $derived.by(() => {
    if (!sinDuplicados) return items;
    const seenMail = new Set();
    const seenTelefono = new Set();
    return items.filter((row) => {
        const m = row.mail != null ? String(row.mail).trim() : '';
        const t = row.telefono != null ? String(row.telefono).trim() : '';
        if (seenMail.has(m) || seenTelefono.has(t)) return false;
        if (m) seenMail.add(m);
        if (t) seenTelefono.add(t);
        return true;
    });
});

const NUMERIC_KEYS = new Set([
    'telefono', 'ruleta', 'puntaje_total', 'puntaje_bloques', 'puntaje_palabras',
    'puntaje_ruleta', 'plays_palabras', 'plays_bloques'
]);

let sortedItems = $derived.by(() => {
    if (!sortKey) return filteredItems;
    const key = sortKey;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filteredItems].sort((a, b) => {
        let va = a[key];
        let vb = b[key];
        const isBool = typeof va === 'boolean' || typeof vb === 'boolean';
        const isDate = key === 'created' || key === 'updated';
        const isNumeric = NUMERIC_KEYS.has(key);
        if (isDate) {
            va = va ? new Date(va).getTime() : 0;
            vb = vb ? new Date(vb).getTime() : 0;
        } else if (isBool) {
            va = va ? 1 : 0;
            vb = vb ? 1 : 0;
        } else if (isNumeric) {
            va = va != null && va !== '' ? Number(va) : NaN;
            vb = vb != null && vb !== '' ? Number(vb) : NaN;
            if (Number.isNaN(va) && Number.isNaN(vb)) return 0;
            if (Number.isNaN(va)) return dir;
            if (Number.isNaN(vb)) return -dir;
        } else {
            va = va != null ? String(va) : '';
            vb = vb != null ? String(vb) : '';
        }
        if (va < vb) return -dir;
        if (va > vb) return dir;
        return 0;
    });
});

let participantesCount = $derived(filteredItems.length);

function toggleSort(key) {
    if (sortKey === key) {
        sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
        sortKey = key;
        sortDir = 'asc';
    }
}

function sortIcon(key) {
    if (sortKey !== key) return '↕';
    return sortDir === 'asc' ? '↑' : '↓';
}

async function loadConectarlaciudad() {
    try {
        loading = true;
        error = null;
        const list = await pb.collection('conectarlaciudad').getList(1, 500, {
            sort: '-created'
        });
        items = list.items || [];
    } catch (err) {
        error = err.message;
        console.error('Error al cargar conectarlaciudad:', err);
    } finally {
        loading = false;
    }
}

function formatDate(value) {
    if (value == null || value === '') return '—';
    try {
        return new Date(value).toLocaleString('es-AR');
    } catch {
        return String(value);
    }
}

function formatBool(value) {
    if (value === true) return 'Sí';
    if (value === false) return 'No';
    return value != null ? String(value) : '—';
}

function cellValue(item, key) {
    const v = item[key];
    if (key === 'created' || key === 'updated') return formatDate(v);
    if (key === 'participo_ruleta' || key === 'cliente') return formatBool(v);
    return v ?? '—';
}

function telefonoConUltimosDos(tel) {
    if (tel == null || tel === '') return '—';
    const s = String(tel).trim();
    if (s.length <= 2) return s;
    return '•'.repeat(Math.min(s.length - 2, 8)) + s.slice(-2);
}

function mailOculto(mail) {
    if (mail == null || mail === '') return '—';
    const s = String(mail).trim();
    const at = s.indexOf('@');
    if (at <= 0) return '••••••••';
    const local = s.slice(0, at);
    const domain = s.slice(at);
    const primera = local[0] ?? '';
    const resto = local.length > 1 ? '•'.repeat(Math.min(local.length - 1, 6)) : '';
    return primera + resto + domain;
}

onMount(() => {
    loadConectarlaciudad();
});
</script>

<div class="conectarlaciudad-container">
    <div class="header">
        <h1>Conectar la ciudad</h1>
        <p>Registros de la colección conectarlaciudad (PocketHost)</p>
    </div>

    <div class="toolbar">
        <div class="total-badge">
            Participantes: <strong>{participantesCount}</strong>
        </div>
        <label class="filter-duplicados">
            <input type="checkbox" bind:checked={sinDuplicados} />
            Sin duplicados (por mail o teléfono)
        </label>
        <button type="button" class="btn-toolbar" onclick={() => (mostrarTelefonos = !mostrarTelefonos)}>
            {mostrarTelefonos ? 'Ocultar teléfonos' : 'Mostrar teléfonos'}
        </button>
        <button type="button" class="btn-toolbar" onclick={() => (mostrarMails = !mostrarMails)}>
            {mostrarMails ? 'Ocultar mails' : 'Mostrar mails'}
        </button>
        <button type="button" class="btn-sorteo" onclick={irASorteo}>
            Comenzar sorteo
        </button>
    </div>

    {#if loading}
        <div class="loading">
            <Spinner label="Cargando..." />
        </div>
    {:else if error}
        <div class="error">
            <p>Error al cargar los datos: {error}</p>
            <button onclick={loadConectarlaciudad} class="retry-btn">Reintentar</button>
        </div>
    {:else if items.length === 0}
        <div class="empty">
            <p>No hay registros en la colección conectarlaciudad.</p>
        </div>
    {:else}
        <div class="table-wrap">
            <table class="data-table">
                <thead>
                    <tr>
                        {#each COLUMNS as col}
                            <th class="sortable" onclick={() => toggleSort(col.key)} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && toggleSort(col.key)}>
                                <span>{col.label}</span>
                                <span class="sort-icon" aria-hidden="true">{sortIcon(col.key)}</span>
                            </th>
                        {/each}
                    </tr>
                </thead>
                <tbody>
                    {#each sortedItems as item}
                        <tr>
                            {#each COLUMNS as col}
                                <td>
                                    {#if col.key === 'telefono'}
                                        {#if mostrarTelefonos}
                                            {item.telefono ?? '—'}
                                        {:else}
                                            <span class="oculto">{telefonoConUltimosDos(item.telefono)}</span>
                                        {/if}
                                    {:else if col.key === 'mail'}
                                        {#if mostrarMails}
                                            {item.mail ?? '—'}
                                        {:else}
                                            <span class="oculto">{mailOculto(item.mail)}</span>
                                        {/if}
                                    {:else}
                                        {cellValue(item, col.key)}
                                    {/if}
                                </td>
                            {/each}
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    {/if}
</div>

<style>
.conectarlaciudad-container {
    padding: 2em;
    max-width: 100%;
    overflow-x: auto;
}

.header {
    margin-bottom: 1.5em;
}

.header h1 {
    color: #333;
    margin-bottom: 0.25em;
    font-size: 1.75em;
}

.header p {
    color: #666;
    margin: 0;
    font-size: 0.95em;
}

.toolbar {
    display: flex;
    align-items: center;
    gap: 1.5em;
    margin-bottom: 1.5em;
    flex-wrap: wrap;
}

.total-badge {
    padding: 0.75em 1.25em;
    background: linear-gradient(135deg, var(--violeta1) 0%, var(--violeta2) 100%);
    color: white;
    border-radius: 0.5em;
    font-size: 1.05em;
    display: inline-block;
}

.total-badge strong {
    font-size: 1.15em;
}

.filter-duplicados {
    display: flex;
    align-items: center;
    gap: 0.5em;
    cursor: pointer;
    font-size: 0.95em;
    color: #333;
}

.filter-duplicados input {
    cursor: pointer;
}

.btn-toolbar {
    display: inline-flex;
    align-items: center;
    padding: 0.6em 1.2em;
    background: var(--violeta2);
    color: white;
    border: none;
    border-radius: 2em;
    font-weight: 600;
    font-size: 0.95rem;
    cursor: pointer;
}

.btn-toolbar:hover {
    opacity: 0.92;
}

.data-table .oculto {
    color: #666;
    letter-spacing: 0.05em;
}

.btn-sorteo {
    display: inline-flex;
    align-items: center;
    gap: 0.5em;
    padding: 0.85em 1.6em;
    background: linear-gradient(135deg, #e91e63 0%, #c2185b 100%);
    color: white;
    font-weight: 700;
    font-size: 1.1em;
    border: none;
    border-radius: 2em;
    text-decoration: none;
    box-shadow: 0 4px 14px rgba(233, 30, 99, 0.45);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    margin-left: auto;
    cursor: pointer;
}

.btn-sorteo:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(233, 30, 99, 0.5);
}

.data-table th.sortable {
    cursor: pointer;
    user-select: none;
}

.data-table th.sortable:hover {
    background: linear-gradient(135deg, #e9ecef 0%, #dee2e6 100%);
}

.data-table th.sortable span {
    display: inline-block;
}

.sort-icon {
    margin-left: 0.35em;
    opacity: 0.8;
    font-size: 0.9em;
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
    opacity: 0.9;
}

.table-wrap {
    background: white;
    border-radius: 0.8em;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    overflow: auto;
    border: 1px solid #e0e0e0;
}

.data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85em;
    min-width: 1200px;
}

.data-table th {
    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
    padding: 0.75em 0.6em;
    text-align: left;
    font-weight: 600;
    color: #333;
    border-bottom: 2px solid var(--violeta2);
    white-space: nowrap;
}

.data-table td {
    padding: 0.6em;
    border-bottom: 1px solid #f0f0f0;
    vertical-align: middle;
}

.data-table tbody tr:hover {
    background: #f8f9ff;
}

@media (max-width: 768px) {
    .conectarlaciudad-container {
        padding: 1em;
    }

    .data-table {
        font-size: 0.8em;
    }

    .data-table th,
    .data-table td {
        padding: 0.5em;
    }
}
</style>
