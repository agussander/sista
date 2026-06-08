<script>
import { pb } from '$lib/pocketbase';
import { onMount } from 'svelte';
import Spinner from '$lib/components/ui/Spinner.svelte';

let leads = $state([]);
let loading = $state(true);
let error = $state('');

onMount(load);

async function load() {
    loading = true;
    error = '';
    try {
        const res = await pb.collection('quiero_que_me_llamen').getList(1, 200, { sort: '-created' });
        leads = res.items;
    } catch (e) {
        console.error(e);
        error = 'No se pudieron cargar los datos.';
    } finally {
        loading = false;
    }
}

function formatDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('es-AR', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
    });
}
</script>

<div class="llamenme-admin">
    <div class="header">
        <h2>Quiero que me llamen</h2>
        <div class="actions">
            <span class="count">{leads.length} solicitud{leads.length === 1 ? '' : 'es'}</span>
            <button class="refresh" onclick={load} disabled={loading}>Refrescar</button>
        </div>
    </div>

    {#if loading}
        <div class="state"><Spinner size={40} color="var(--violeta1)" borderWidth={3} label="Cargando…" /></div>
    {:else if error}
        <div class="state error">{error}</div>
    {:else if leads.length === 0}
        <div class="state">Todavía no hay solicitudes.</div>
    {:else}
        <div class="table-wrap">
            <table>
                <thead>
                    <tr><th>Nombre</th><th>Número</th><th>Fecha</th></tr>
                </thead>
                <tbody>
                    {#each leads as l}
                        <tr>
                            <td>{l.nombre}</td>
                            <td>{l.numero}</td>
                            <td class="date">{formatDate(l.created)}</td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    {/if}
</div>

<style>
.llamenme-admin {
    max-width: 60em;
    margin: 0 auto;
}
.header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1em;
    margin-bottom: 1.5em;
}
.header h2 {
    margin: 0;
    color: var(--violeta1);
    font-size: 1.6em;
}
.actions {
    display: flex;
    align-items: center;
    gap: 1em;
}
.count {
    color: #666;
    font-size: 0.95em;
}
.refresh {
    background: var(--violeta1);
    color: #fff;
    border: none;
    border-radius: 0.4em;
    padding: 0.5em 1em;
    cursor: pointer;
    font-size: 0.9em;
}
.refresh:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
.state {
    padding: 3em 1em;
    text-align: center;
    color: #888;
}
.state.error {
    color: var(--magenta);
}
.table-wrap {
    overflow-x: auto;
    background: #fff;
    border-radius: 0.6em;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}
table {
    width: 100%;
    border-collapse: collapse;
}
th, td {
    text-align: left;
    padding: 0.8em 1em;
    border-bottom: 1px solid #eee;
}
th {
    background: #f7f6fb;
    color: var(--violeta1);
    font-weight: 600;
    font-size: 0.9em;
}
td.date {
    color: #666;
    white-space: nowrap;
}
</style>
