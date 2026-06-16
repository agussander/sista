<script>
import { pb } from '$lib/pocketbase';
import { onMount } from 'svelte';
import Spinner from '$lib/components/ui/Spinner.svelte';

// Agentes disponibles para asignar. El "value" debe coincidir con el valor
// guardado en el campo select "agente" de PocketBase (en minúscula).
const agentes = [
    { value: 'agustin', label: 'Agustín' },
    { value: 'felipe', label: 'Felipe' },
    { value: 'gustavo', label: 'Gustavo' }
];

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

const isAssigned = (l) => !!l.agente;

async function assign(lead, value) {
    const agente = value || null;
    const prev = lead.agente;
    lead.agente = agente;
    try {
        await pb.collection('quiero_que_me_llamen').update(lead.id, { agente });
    } catch (e) {
        console.error(e);
        lead.agente = prev;
        error = 'No se pudo asignar el agente.';
        setTimeout(() => (error = ''), 3000);
    }
}

// Devuelve un texto relativo del tipo "hace 3 minutos / 3 horas / 3 días / 1 mes".
function timeAgo(d) {
    if (!d) return '';
    const diffMs = Date.now() - new Date(d).getTime();
    if (diffMs < 0) return 'recién';

    const sec = Math.floor(diffMs / 1000);
    if (sec < 60) return 'hace unos segundos';

    const min = Math.floor(sec / 60);
    if (min < 60) return `hace ${min} ${min === 1 ? 'minuto' : 'minutos'}`;

    const hours = Math.floor(min / 60);
    if (hours < 24) return `hace ${hours} ${hours === 1 ? 'hora' : 'horas'}`;

    const days = Math.floor(hours / 24);
    if (days < 30) return `hace ${days} ${days === 1 ? 'día' : 'días'}`;

    const months = Math.floor(days / 30);
    if (months < 12) return `hace ${months} ${months === 1 ? 'mes' : 'meses'}`;

    const years = Math.floor(months / 12);
    return `hace ${years} ${years === 1 ? 'año' : 'años'}`;
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
                    <tr><th>Asignar</th><th>Número</th><th>Recibido</th></tr>
                </thead>
                <tbody>
                    {#each leads as l}
                        <tr class:assigned={isAssigned(l)}>
                            <td class="assign-cell">
                                <span class="tick" class:visible={isAssigned(l)} aria-hidden="true">✓</span>
                                <select
                                    class="assign-select"
                                    value={l.agente ?? ''}
                                    onchange={(e) => assign(l, e.target.value)}
                                >
                                    <option value="">Sin asignar</option>
                                    {#each agentes as a}
                                        <option value={a.value}>{a.label}</option>
                                    {/each}
                                </select>
                            </td>
                            <td>{l.numero}</td>
                            <td class="date">{timeAgo(l.created)}</td>
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
.assign-cell {
    display: flex;
    align-items: center;
    gap: 0.5em;
}
.tick {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.2em;
    color: #2e9e5b;
    font-weight: 700;
    visibility: hidden;
}
.tick.visible {
    visibility: visible;
}
.assign-select {
    border: 1.5px solid #ddd;
    border-radius: 0.4em;
    padding: 0.35em 0.5em;
    font-size: 0.9em;
    font-family: inherit;
    background: #fff;
    color: #333;
    cursor: pointer;
}
.assign-select:focus {
    outline: none;
    border-color: var(--violeta1);
}
/* Filas ya asignadas: más apagadas / en gris. */
tr.assigned td {
    color: #9a9a9a;
}
tr.assigned .assign-select {
    color: #9a9a9a;
    background: #f6f6f6;
    border-color: #e6e6e6;
}
</style>
