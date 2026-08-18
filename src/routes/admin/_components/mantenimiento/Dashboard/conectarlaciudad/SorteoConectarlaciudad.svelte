<script>
import { onMount } from 'svelte';
import { pb } from '$lib/pocketbase';
import Spinner from '$lib/components/ui/Spinner.svelte';

/** Fisher-Yates: reordena el array al azar (usa Math.random(), sin orden preestablecido). */
function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/** Elige n elementos al azar sin repetición (azar puro cada vez). */
function pickRandom(arr, n) {
    const a = [...arr];
    const out = [];
    for (let i = 0; i < n && a.length > 0; i++) {
        const idx = Math.floor(Math.random() * a.length);
        out.push(a[idx]);
        a.splice(idx, 1);
    }
    return out;
}

let loading = $state(true);
let error = $state(null);
let phase = $state('animation'); // 'animation' | 'results'
let ganadores = $state([]);
let mostrarTelefonos = $state(false);
let animationDone = $state(false);

async function runSorteo() {
    try {
        loading = true;
        error = null;
        ganadores = [];
        phase = 'animation';
        animationDone = false;
        const list = await pb.collection('conectarlaciudad').getList(1, 500);
        const items = list.items || [];

        const withScore = items.filter((row) => {
            const pt = Number(row.puntaje_total);
            return !Number.isNaN(pt) && pt > 0;
        });

        const seenMail = new Set();
        const seenTelefono = new Set();
        const deduped = withScore.filter((row) => {
            const m = row.mail != null ? String(row.mail).trim() : '';
            const t = row.telefono != null ? String(row.telefono).trim() : '';
            if (seenMail.has(m) || seenTelefono.has(t)) return false;
            if (m) seenMail.add(m);
            if (t) seenTelefono.add(t);
            return true;
        });

        const byScore = [...deduped].sort((a, b) => Number(b.puntaje_total) - Number(a.puntaje_total));
        const top10 = byScore.slice(0, 10);
        const rest = byScore.slice(10);

        const primeros10 = shuffle(top10).map((r, i) => ({ puesto: i + 1, ...r }));
        const otros40 = shuffle(pickRandom(rest, Math.min(40, rest.length))).map((r, i) => ({ puesto: i + 11, ...r }));

        ganadores = [...primeros10, ...otros40].filter((g) => g.puesto);
    } catch (err) {
        error = err.message;
    } finally {
        loading = false;
    }
}

onMount(() => {
    runSorteo();
});

$effect(() => {
    if (loading || error || ganadores.length === 0) return;
    if (phase !== 'animation') return;
    const t = setTimeout(() => {
        animationDone = true;
        phase = 'results';
    }, 3200);
    return () => clearTimeout(t);
});

/** Muestra solo los últimos 2 dígitos del teléfono; el resto oculto. */
function telefonoConUltimosDos(tel) {
    if (tel == null || tel === '') return '—';
    const s = String(tel).trim();
    if (s.length <= 2) return s;
    return '•'.repeat(Math.min(s.length - 2, 8)) + s.slice(-2);
}

function descargarSorteoJson() {
    const payload = {
        sorteo: 'conectarlaciudad',
        fecha: new Date().toISOString(),
        ganadores: ganadores.map((g) => ({
            puesto: g.puesto,
            nombre: g.nombre ?? null,
            telefono: g.telefono ?? null,
            puntaje_total: g.puntaje_total ?? null
        }))
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sorteo-conectarlaciudad-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}
</script>

<div class="sorteo-wrap">
    {#if loading}
        <div class="loading">
            <Spinner size={48} label="Cargando participantes..." />
        </div>
    {:else if error}
        <div class="error">
            <p>Error: {error}</p>
        </div>
    {:else if phase === 'animation'}
        <div class="animation-screen" class:done={animationDone}>
            <div class="animation-bg"></div>
            <div class="animation-content">
                <div class="dice">🎲</div>
                <h1 class="titulo-sorteo">¡Sorteo en curso!</h1>
                <p class="subtitulo">Determinando ganadores...</p>
                <div class="rolling-names">
                    {#each Array(5) as _, i}
                        <span class="name-dot" style="animation-delay: {i * 0.15}s">●</span>
                    {/each}
                </div>
            </div>
        </div>
    {:else}
        <div class="results-screen">
            <header class="results-header">
                <h1>50 ganadores</h1>
                <p>Conectar la ciudad</p>
                <div class="header-buttons">
                    <button
                        type="button"
                        class="btn-header"
                        onclick={() => (mostrarTelefonos = !mostrarTelefonos)}
                    >
                        {mostrarTelefonos ? 'Ocultar teléfonos' : 'Mostrar teléfonos'}
                    </button>
                    <button type="button" class="btn-header" onclick={descargarSorteoJson}>
                        Descargar sorteo
                    </button>
                    <a href="/admin/conectarlaciudad" class="btn-header btn-link">Volver a Conectar la ciudad</a>
                </div>
            </header>
            <div class="ganadores-list">
                <table class="ganadores-table">
                    <thead>
                        <tr>
                            <th>Puesto</th>
                            <th>Nombre</th>
                            <th>Puntaje total</th>
                            <th>Teléfono</th>
                        </tr>
                    </thead>
                    <tbody>
                        {#each ganadores as g}
                            <tr class:row-premium={g.puesto === 1} class:row-top10={g.puesto >= 2 && g.puesto <= 10}>
                                <td class="puesto">{g.puesto}</td>
                                <td class="nombre">{g.nombre ?? '—'}</td>
                                <td class="puntaje">{g.puntaje_total ?? '—'}</td>
                                <td class="telefono">
                                    {#if mostrarTelefonos}
                                        {g.telefono ?? '—'}
                                    {:else}
                                        <span class="oculto">{telefonoConUltimosDos(g.telefono)}</span>
                                    {/if}
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        </div>
    {/if}
</div>

<style>
.sorteo-wrap {
    min-height: 60vh;
    padding: 2em;
}

.loading, .error {
    text-align: center;
    padding: 4em 2em;
    color: #555;
}

.animation-screen {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 50vh;
    overflow: hidden;
}

.animation-bg {
    position: absolute;
    inset: -20%;
    background: linear-gradient(135deg, rgba(112, 40, 162, 0.08) 0%, rgba(233, 30, 99, 0.08) 100%);
    animation: pulse-bg 1.2s ease-in-out infinite;
}

@keyframes pulse-bg {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.7; transform: scale(1.02); }
}

.animation-content {
    position: relative;
    text-align: center;
    z-index: 1;
}

.dice {
    font-size: 4rem;
    margin-bottom: 0.5rem;
    animation: bounce 0.6s ease-in-out infinite;
}

@keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-12px); }
}

.titulo-sorteo {
    font-size: 2.2rem;
    color: var(--violeta2);
    margin: 0 0 0.5rem;
    font-weight: 700;
    animation: fade-in 0.5s ease-out;
}

.subtitulo {
    color: #666;
    margin: 0 0 1.5rem;
    font-size: 1.1rem;
}

.rolling-names {
    display: flex;
    gap: 0.5rem;
    justify-content: center;
}

.name-dot {
    color: var(--violeta2);
    font-size: 1.5rem;
    animation: blink 0.5s ease-in-out infinite;
}

@keyframes blink {
    0%, 100% { opacity: 0.4; transform: scale(0.9); }
    50% { opacity: 1; transform: scale(1.2); }
}

@keyframes fade-in {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
}

.animation-screen.done .dice,
.animation-screen.done .titulo-sorteo,
.animation-screen.done .rolling-names {
    animation: none;
}

.results-screen {
    max-width: 42rem;
    margin: 0 auto;
}

.results-header {
    margin-bottom: 2rem;
}

.results-header h1 {
    font-size: 1.75rem;
    color: #333;
    margin: 0 0 0.25rem;
}

.results-header p {
    color: #666;
    margin: 0 0 1rem;
}

.header-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: center;
}

.btn-header {
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

.btn-header:hover {
    opacity: 0.92;
}

.btn-header.btn-link {
    text-decoration: none;
    background: var(--violeta2);
    color: white;
}

.btn-header.btn-link:hover {
    opacity: 0.92;
}

.ganadores-table {
    width: 100%;
    border-collapse: collapse;
    background: white;
    border-radius: 0.75rem;
    box-shadow: 0 2px 12px rgba(0,0,0,0.06);
    overflow: hidden;
}

.ganadores-table th {
    background: linear-gradient(135deg, var(--violeta1) 0%, var(--violeta2) 100%);
    color: white;
    padding: 0.9rem 1rem;
    text-align: left;
    font-weight: 600;
}

.ganadores-table td {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #eee;
}

.ganadores-table tbody tr:last-child td {
    border-bottom: none;
}

/* Primer lugar: estilo premium, más grande y destacado */
.ganadores-table tbody tr.row-premium td {
    padding: 1.25rem 1.25rem;
    font-size: 1.25rem;
    background: linear-gradient(135deg, #fff9e6 0%, #fff3cc 50%, #ffe699 100%);
    border-bottom: 2px solid #e6c200;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.8);
}

.ganadores-table tbody tr.row-premium .puesto {
    font-size: 1.5rem;
    color: #b38600;
    font-weight: 800;
}

.ganadores-table tbody tr.row-premium .nombre {
    font-size: 1.35rem;
    font-weight: 700;
    color: #1a1a1a;
}

.ganadores-table tbody tr.row-premium .puntaje {
    font-size: 1.2rem;
    font-weight: 700;
    color: #996600;
}

/* Puestos 2-10: estilo destacado pero más sobrio */
.ganadores-table tbody tr.row-top10 td {
    padding: 0.95rem 1.1rem;
    font-size: 1.05rem;
    background: linear-gradient(135deg, #f8f5ff 0%, #ede7f6 100%);
    border-bottom: 1px solid #d1c4e9;
}

.ganadores-table tbody tr.row-top10 .puesto {
    font-weight: 700;
    color: var(--violeta2);
}

.ganadores-table tbody tr.row-top10 .nombre {
    font-weight: 600;
    color: #333;
}

.ganadores-table .puesto {
    font-weight: 700;
    color: var(--violeta2);
    width: 5rem;
}

.ganadores-table .nombre {
    font-weight: 500;
}

.ganadores-table .puntaje {
    font-variant-numeric: tabular-nums;
}

.telefono .oculto {
    color: #999;
    letter-spacing: 0.2em;
}
</style>
