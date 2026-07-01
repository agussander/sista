<script>
import Spinner from '$lib/components/ui/Spinner.svelte';
import { llamenmeStore } from './llamenmeStore.svelte.js';
import { paginate, totalPages as totalPagesOf, clampPage } from './llamenmeLogic.js';
import { computeFormVisible, isWithinCallHours } from '$lib/llamenme/visibility.js';

// Agentes disponibles para asignar. El "value" debe coincidir con el valor
// guardado en el campo select "agente" de PocketBase (en minúscula).
const agentes = [
    { value: 'agustin', label: 'Agustín' },
    { value: 'felipe', label: 'Felipe' },
    { value: 'gustavo', label: 'Gustavo' }
];

// El store (arrancado por el Dashboard) es la fuente de verdad.
const leads = $derived(llamenmeStore.leads);
const loading = $derived(llamenmeStore.loading);
const error = $derived(llamenmeStore.error);
const newIds = $derived(llamenmeStore.newIds);
const override = $derived(llamenmeStore.override);
const setOverride = (value) => llamenmeStore.setOverride(value);

const overrideOptions = [
    { value: 'auto', label: 'Auto' },
    { value: 'abierto', label: 'Abierto' },
    { value: 'cerrado', label: 'Cerrado' }
];

// Estado "ahora" del formulario público. Es informativo: se calcula al
// renderizar el panel, no se actualiza en vivo mientras queda abierto.
const now = new Date();
const visibleNow = $derived(computeFormVisible(override, now));
const reasonNow = $derived(
    override === 'abierto'
        ? 'forzado abierto'
        : override === 'cerrado'
            ? 'forzado cerrado'
            : isWithinCallHours(now)
                ? 'por horario de atención'
                : 'fuera de horario'
);

let page = $state(1);
const totalPages = $derived(totalPagesOf(leads.length));
const visible = $derived(paginate(leads, page));

// Acotar la página si la lista se achica (p. ej. tras borrados).
$effect(() => {
    const clamped = clampPage(page, leads.length);
    if (clamped !== page) page = clamped;
});

// Cuando llega un lead nuevo (hay ids resaltados), saltar a la página 1 para
// que sea visible. Sólo reacciona a arribos, no pisa la navegación manual.
$effect(() => {
    if (newIds.size > 0) page = 1;
});

const load = () => llamenmeStore.load();
const isAssigned = (l) => !!l.agente;
const assign = (lead, value) => llamenmeStore.assign(lead, value);

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

    <div class="override-panel">
        <div class="override-switch" role="group" aria-label="Habilitar formulario">
            {#each overrideOptions as opt}
                <button
                    type="button"
                    class="override-btn"
                    class:active={override === opt.value}
                    onclick={() => setOverride(opt.value)}
                >{opt.label}</button>
            {/each}
        </div>
        <p class="override-status">
            El formulario está <strong>{visibleNow ? 'visible' : 'oculto'}</strong> ahora
            ({reasonNow}).
        </p>
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
                    {#each visible as l (l.id)}
                        <tr class:assigned={isAssigned(l)} class:is-new={newIds.has(l.id)}>
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

        {#if totalPages > 1}
            <div class="pager">
                <button class="pager-btn" onclick={() => (page = page - 1)} disabled={page <= 1}>« Anterior</button>
                <span class="pager-info">Página {page} de {totalPages}</span>
                <button class="pager-btn" onclick={() => (page = page + 1)} disabled={page >= totalPages}>Siguiente »</button>
            </div>
        {/if}
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
/* Fila recién llegada por realtime: highlight temporal. */
tr.is-new td {
    animation: highlight-new 3s ease-out;
}
@keyframes highlight-new {
    0% { background: #fdf3c4; }
    100% { background: transparent; }
}
/* Filas ya asignadas: más apagadas / en gris. */
tr.assigned td {
    color: #9a9a9a;
}
.pager {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1em;
    margin-top: 1.2em;
}
.pager-info {
    color: #666;
    font-size: 0.9em;
}
.pager-btn {
    background: #fff;
    color: var(--violeta1);
    border: 1.5px solid #e0d6f0;
    border-radius: 0.4em;
    padding: 0.45em 0.9em;
    cursor: pointer;
    font-size: 0.9em;
    font-family: inherit;
    transition: background 0.15s, border-color 0.15s;
}
.pager-btn:hover:not(:disabled) {
    background: #f3eefb;
    border-color: var(--violeta1);
}
.pager-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}
tr.assigned .assign-select {
    color: #9a9a9a;
    background: #f6f6f6;
    border-color: #e6e6e6;
}
.override-panel {
    display: flex;
    flex-direction: column;
    gap: 0.5em;
    margin-bottom: 1.5em;
    padding: 1em 1.2em;
    background: #fff;
    border-radius: 0.6em;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}
.override-switch {
    display: inline-flex;
    gap: 0.4em;
}
.override-btn {
    background: #fff;
    color: var(--violeta1);
    border: 1.5px solid #e0d6f0;
    border-radius: 0.4em;
    padding: 0.45em 0.9em;
    cursor: pointer;
    font-size: 0.9em;
    font-family: inherit;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.override-btn:hover {
    background: #f3eefb;
}
.override-btn.active {
    background: var(--violeta1);
    color: #fff;
    border-color: var(--violeta1);
}
.override-status {
    margin: 0;
    color: #666;
    font-size: 0.9em;
}
</style>
