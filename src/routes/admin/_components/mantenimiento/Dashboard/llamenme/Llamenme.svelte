<script>
import Spinner from '$lib/components/ui/Spinner.svelte';
import { llamenmeStore } from './llamenmeStore.svelte.js';
import { paginate, totalPages as totalPagesOf, clampPage, formatExtra, timeAgo } from './llamenmeLogic.js';
import { computeInCallWindow, isWithinCallHours, isFormVisible } from '$lib/llamenme/visibility.js';

// El store (arrancado por el Dashboard) es la fuente de verdad.
const leads = $derived(llamenmeStore.leads);
const loading = $derived(llamenmeStore.loading);
const error = $derived(llamenmeStore.error);
const newIds = $derived(llamenmeStore.newIds);
const override = $derived(llamenmeStore.override);
const setOverride = (value) => llamenmeStore.setOverride(value);

// Modelo de presencia: como el panel lo administra una sola persona, los tres
// primeros botones hablan de "estoy / no estoy" en vez de mostrar/ocultar el
// form. El valor interno guardado en PocketBase es el override de
// $lib/llamenme/config.js; acá sólo cambia la etiqueta visible.
//   Automático → sigue el horario real (respeta que vie tarde/sáb esté cerrado)
//   En línea   → estás atendiendo: al enviar se llama en el momento
//   No estoy   → fuerza el estado fuera de horario (modal de preferencia)
//   Oculto     → único estado que saca el bloque entero de la home
const overrideOptions = [
    { value: 'auto', label: 'Automático' },
    { value: 'abierto', label: 'En línea' },
    { value: 'cerrado', label: 'No estoy' },
    { value: 'oculto', label: 'Oculto' }
];

// Reloj del panel. Sin esto, el "hace X minutos" de cada fila (y el estado de
// horario de acá abajo) se calculan una sola vez al renderizar y quedan
// congelados mientras el panel sigue abierto. Tickea cada 30s: alcanza para la
// granularidad de minutos y es más barato que un timer por fila.
const TICK_MS = 30_000;
let nowTick = $state(Date.now());
$effect(() => {
    const id = setInterval(() => (nowTick = Date.now()), TICK_MS);
    return () => clearInterval(id);
});

// Estado "ahora" del formulario público: si se muestra, y en ese caso si al
// enviar se llama en el momento (en horario) o se le pide al visitante una
// preferencia de horario en un modal (fuera de horario).
const now = $derived(new Date(nowTick));
const formVisible = $derived(isFormVisible(override));
const enHorarioNow = $derived(computeInCallWindow(override, now));
const reasonNow = $derived(
    override === 'abierto'
        ? 'marcaste que estás en línea'
        : override === 'cerrado'
            ? 'marcaste que no estás'
            : isWithinCallHours(now)
                ? 'automático · en horario de atención'
                : 'automático · fuera de horario'
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
const toggleAtendido = (lead, value) => llamenmeStore.setAtendido(lead, value);
const saveNotas = (lead, value) => llamenmeStore.setNotas(lead, value);
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
        <div class="override-switch" role="group" aria-label="Horario de atención">
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
            {#if !formVisible}
                El formulario <strong>no se muestra</strong> en la web (tampoco los botones
                Clientes y Ver planes del hero).
            {:else}
                Al enviar, ahora se <strong>{enHorarioNow ? 'llama en el momento' : 'pide preferencia de horario'}</strong>
                ({reasonNow}).
            {/if}
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
                    <tr><th class="check-col">✓</th><th>Número</th><th>Prefiere</th><th>Recibido</th><th>Anotaciones</th></tr>
                </thead>
                <tbody>
                    {#each visible as l (l.id)}
                        <tr class:done={!!l.atendido} class:is-new={newIds.has(l.id)}>
                            <td class="check-cell">
                                <input
                                    type="checkbox"
                                    class="check"
                                    checked={!!l.atendido}
                                    onchange={(e) => toggleAtendido(l, e.target.checked)}
                                    aria-label="Marcar como atendido"
                                />
                            </td>
                            <td>{l.numero}</td>
                            <td class="extra">
                                <span class="pref" class:pref-wa={l.extra === 'whatsapp'} class:pref-none={!l.extra}>
                                    {formatExtra(l.extra)}
                                </span>
                            </td>
                            <td class="date">{timeAgo(l.created, nowTick)}</td>
                            <td class="notas-cell">
                                <input
                                    type="text"
                                    class="notas-input"
                                    value={l.notas ?? ''}
                                    placeholder="Anotaciones…"
                                    onchange={(e) => saveNotas(l, e.target.value)}
                                />
                            </td>
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
td.extra {
    white-space: nowrap;
}
.pref {
    display: inline-block;
    padding: 0.2em 0.6em;
    border-radius: 1000px;
    background: #f3eefb;
    color: var(--violeta1);
    font-size: 0.85em;
    font-weight: 600;
}
.pref-wa {
    background: #eafaf5;
    color: #128c7e;
}
.pref-none {
    background: transparent;
    color: #bbb;
    font-weight: 400;
    padding-left: 0;
}
/* En filas ya atendidas el chip también se apaga. */
tr.done .pref {
    background: #f3f3f3;
    color: #9a9a9a;
}
.check-col,
.check-cell {
    text-align: center;
    width: 2.5em;
}
.check {
    width: 1.15em;
    height: 1.15em;
    accent-color: #2e9e5b;
    cursor: pointer;
}
.notas-cell {
    min-width: 12em;
}
.notas-input {
    width: 100%;
    box-sizing: border-box;
    border: 1.5px solid #ddd;
    border-radius: 0.4em;
    padding: 0.35em 0.5em;
    font-size: 0.9em;
    font-family: inherit;
    background: #fff;
    color: #333;
}
.notas-input:focus {
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
/* Filas ya atendidas: más apagadas / en gris. */
tr.done td {
    color: #9a9a9a;
}
tr.done .notas-input {
    color: #9a9a9a;
    background: #f6f6f6;
    border-color: #e6e6e6;
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
