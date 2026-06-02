<script>
import { MetaTags } from "svelte-meta-tags";
import { browser } from '$app/environment';
import { onMount } from 'svelte';

const baseLevels = [
    {
        name: 'Nivel 1',
        size: 7,
        start: { x: 0, y: 0 },
        goal: { x: 6, y: 6 },
        path: [
            { x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 },
            { x: 1, y: 3 }, { x: 2, y: 3 }, { x: 3, y: 3 }, { x: 3, y: 4 },
            { x: 3, y: 5 }, { x: 4, y: 5 }, { x: 5, y: 5 }, { x: 6, y: 5 },
            { x: 6, y: 6 }
        ],
        extraOpen: [
            { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 },
            { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 4, y: 3 },
            { x: 4, y: 4 }, { x: 5, y: 4 }, { x: 2, y: 4 }
        ],
        intro: 'Calienta motores: conecta el punto de inicio con el destino esquivando los muros.'
    },
    {
        name: 'Nivel 2',
        size: 8,
        start: { x: 0, y: 7 },
        goal: { x: 7, y: 0 },
        path: [
            { x: 0, y: 7 }, { x: 1, y: 7 }, { x: 2, y: 7 }, { x: 3, y: 7 },
            { x: 4, y: 7 }, { x: 4, y: 6 }, { x: 4, y: 5 }, { x: 3, y: 5 },
            { x: 2, y: 5 }, { x: 2, y: 4 }, { x: 2, y: 3 }, { x: 3, y: 3 },
            { x: 4, y: 3 }, { x: 5, y: 3 }, { x: 6, y: 3 }, { x: 6, y: 2 },
            { x: 6, y: 1 }, { x: 6, y: 0 }, { x: 7, y: 0 }
        ],
        extraOpen: [
            { x: 1, y: 6 }, { x: 1, y: 5 }, { x: 5, y: 6 }, { x: 5, y: 5 },
            { x: 1, y: 4 }, { x: 3, y: 2 }, { x: 5, y: 2 }, { x: 5, y: 1 },
            { x: 4, y: 1 }, { x: 3, y: 1 }
        ],
        intro: 'Planifica bien: los pasillos son más estrechos y hay atajos que parecen trampas.'
    },
    {
        name: 'Nivel 3',
        size: 9,
        start: { x: 0, y: 8 },
        goal: { x: 8, y: 0 },
        path: [
            { x: 0, y: 8 }, { x: 1, y: 8 }, { x: 2, y: 8 }, { x: 2, y: 7 },
            { x: 2, y: 6 }, { x: 3, y: 6 }, { x: 4, y: 6 }, { x: 5, y: 6 },
            { x: 5, y: 5 }, { x: 5, y: 4 }, { x: 4, y: 4 }, { x: 3, y: 4 },
            { x: 3, y: 3 }, { x: 4, y: 3 }, { x: 5, y: 3 }, { x: 6, y: 3 },
            { x: 6, y: 2 }, { x: 6, y: 1 }, { x: 7, y: 1 }, { x: 8, y: 1 },
            { x: 8, y: 0 }
        ],
        extraOpen: [
            { x: 1, y: 7 }, { x: 3, y: 7 }, { x: 4, y: 7 }, { x: 6, y: 7 },
            { x: 7, y: 7 }, { x: 1, y: 6 }, { x: 7, y: 6 }, { x: 2, y: 5 },
            { x: 4, y: 5 }, { x: 7, y: 5 }, { x: 1, y: 4 }, { x: 2, y: 3 },
            { x: 7, y: 3 }, { x: 2, y: 2 }, { x: 4, y: 2 }, { x: 5, y: 2 },
            { x: 7, y: 2 }, { x: 3, y: 1 }, { x: 5, y: 1 }, { x: 7, y: 1 }
        ],
        intro: 'Último desafío: más espacios abiertos, pero los muros pueden engañar.'
    }
];

function buildWalls(level) {
    const open = new Set();
    const addOpen = (cell) => open.add(`${cell.x},${cell.y}`);
    level.path.forEach(addOpen);
    level.extraOpen?.forEach(addOpen);
    addOpen(level.start);
    addOpen(level.goal);

    const walls = [];
    for (let y = 0; y < level.size; y++) {
        for (let x = 0; x < level.size; x++) {
            if (!open.has(`${x},${y}`)) {
                walls.push({ x, y });
            }
        }
    }
    return walls;
}

const levels = baseLevels.map((level) => ({
    ...level,
    walls: buildWalls(level)
}));

let currentLevel = $state(0);
let player = $state({ ...levels[0].start });
let moves = $state(0);
let status = $state('playing'); // playing | won
let hasFocus = $state(false);
let container;

const level = $derived(levels[currentLevel]);
const isWall = (x, y) => level.walls.some((cell) => cell.x === x && cell.y === y);

function resetLevel(nextIndex = currentLevel) {
    currentLevel = nextIndex;
    player = { ...levels[nextIndex].start };
    moves = 0;
    status = 'playing';
}

function move(dx, dy) {
    if (status !== 'playing') return;
    const nx = player.x + dx;
    const ny = player.y + dy;
    if (nx < 0 || ny < 0 || nx >= level.size || ny >= level.size) return;
    if (isWall(nx, ny)) return;

    player = { x: nx, y: ny };
    moves += 1;

    if (nx === level.goal.x && ny === level.goal.y) {
        status = 'won';
    }
}

function handleKey(event) {
    const key = event.key.toLowerCase();
    if (key === 'arrowup' || key === 'w') move(0, -1);
    if (key === 'arrowdown' || key === 's') move(0, 1);
    if (key === 'arrowleft' || key === 'a') move(-1, 0);
    if (key === 'arrowright' || key === 'd') move(1, 0);
}

function nextLevel() {
    if (currentLevel < levels.length - 1) {
        resetLevel(currentLevel + 1);
        tickFocus();
    }
}

function tickFocus() {
    if (browser && container) {
        queueMicrotask(() => {
            container.focus();
            hasFocus = true;
        });
    }
}

onMount(() => {
    tickFocus();
});
</script>

<MetaTags
    title='Conectar la Ciudad - Juego de 3 niveles'
    description='Conecta inicio y destino evitando muros en 3 niveles.'
></MetaTags>

<section class="game">
    <div class="header">
        <div>
            <p class="eyebrow">Conectar la Ciudad</p>
            <h1>Juego de 3 niveles</h1>
            <p>{level.intro}</p>
            <p class="hint">Usá flechas o WASD. Evitá los muros morados.</p>
        </div>
        <div class="status">
            <div><span class="label">Nivel</span><strong>{level.name}</strong></div>
            <div><span class="label">Movimientos</span><strong>{moves}</strong></div>
            <div><span class="label">Estado</span><strong>{status === 'won' ? 'Completado' : 'En juego'}</strong></div>
        </div>
    </div>

    <div class="board-wrapper">
        <div
            class="board"
            bind:this={container}
            tabindex="0"
            role="grid"
            aria-label="Tablero del nivel {level.name}"
            onkeydown={handleKey}
            onfocus={() => hasFocus = true}
            onblur={() => hasFocus = false}
            style={`grid-template-columns: repeat(${level.size}, 1fr);`}
        >
            {#each Array(level.size * level.size) as _, index}
                {@const x = index % level.size}
                {@const y = Math.floor(index / level.size)}
                {@const wall = isWall(x, y)}
                {@const isStart = x === level.start.x && y === level.start.y}
                {@const isGoal = x === level.goal.x && y === level.goal.y}
                {@const isPlayer = x === player.x && y === player.y}
                <div
                    class={`cell ${wall ? 'wall' : 'path'} ${isStart ? 'start' : ''} ${isGoal ? 'goal' : ''} ${isPlayer ? 'player' : ''}`}
                    aria-hidden="true"
                ></div>
            {/each}
        </div>
        <div class="controls">
            <button onclick={() => move(0, -1)} aria-label="Mover arriba">▲</button>
            <div class="middle-row">
                <button onclick={() => move(-1, 0)} aria-label="Mover izquierda">◀</button>
                <button onclick={() => move(1, 0)} aria-label="Mover derecha">▶</button>
            </div>
            <button onclick={() => move(0, 1)} aria-label="Mover abajo">▼</button>
        </div>
    </div>

    <div class="actions">
        <button class="secondary" onclick={() => resetLevel()}>Reiniciar nivel</button>
        {#if currentLevel < levels.length - 1}
            <button class="primary" onclick={nextLevel} disabled={status !== 'won'}>Siguiente nivel</button>
        {:else}
            <button class="primary" disabled={status !== 'won'}>¡Juego completado!</button>
        {/if}
    </div>

    <p class="focus-hint" aria-live="polite">{hasFocus ? 'Teclas activas para mover' : 'Haz clic en el tablero para usar el teclado'}</p>
</section>

<style>
.game {
    max-width: 960px;
    margin: 0 auto;
    padding: 3em 1em 4em;
}

.header {
    display: flex;
    flex-wrap: wrap;
    gap: 1.5em;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.5em;
}

.eyebrow {
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 600;
    color: var(--violeta1);
    margin: 0 0 .25em;
}

h1 {
    margin: 0 0 .5em;
    text-transform: none;
}

.status {
    display: grid;
    grid-template-columns: repeat(3, auto);
    gap: 0.8em 1.4em;
    background: #f5f5ff;
    border: 1px solid #dedcff;
    padding: 1em 1.4em;
    border-radius: 0.8em;
}

.status .label {
    display: block;
    font-size: 0.85em;
    color: #666;
}

.status strong {
    font-size: 1.1em;
    color: var(--violeta1);
}

.board-wrapper {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 1em;
    align-items: center;
}

.board {
    border: 3px solid var(--violeta1);
    border-radius: 0.8em;
    overflow: hidden;
    display: grid;
    background: #f6f6f9;
    box-shadow: 0 12px 30px rgba(27, 16, 45, 0.08);
    outline: none;
    min-height: 360px;
}

.board:focus {
    box-shadow: 0 0 0 3px rgba(133, 94, 255, 0.25);
}

.cell {
    aspect-ratio: 1 / 1;
    border: 1px solid #eae9f7;
    position: relative;
}

.cell.wall {
    background: linear-gradient(145deg, #5b3bb4, #472b93);
    border-color: #3b2577;
}

.cell.path {
    background: #fff;
}

.cell.start::after,
.cell.goal::after,
.cell.player::after {
    content: '';
    position: absolute;
    inset: 10%;
    border-radius: 10px;
    transition: transform 120ms ease;
}

.cell.start::after {
    background: #49c78c;
}

.cell.goal::after {
    background: #ffb347;
}

.cell.player::after {
    background: #ff4f6b;
    transform: scale(1.1);
}

.controls {
    display: grid;
    grid-template-columns: 1fr;
    grid-template-rows: repeat(3, 44px);
    gap: 6px;
    justify-items: center;
}

.controls button {
    width: 80px;
    height: 44px;
    border-radius: 8px;
    border: 1px solid #dcdcdc;
    background: white;
    font-size: 1.1em;
    cursor: pointer;
    transition: transform 80ms ease, box-shadow 80ms ease;
}

.controls button:hover {
    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}

.controls button:active {
    transform: translateY(1px);
}

.controls .middle-row {
    display: grid;
    grid-template-columns: repeat(2, 80px);
    gap: 6px;
}

.actions {
    display: flex;
    gap: 0.8em;
    margin-top: 1.4em;
    flex-wrap: wrap;
}

button.primary,
button.secondary {
    padding: 0.75em 1.4em;
    border-radius: 10px;
    border: 1px solid transparent;
    cursor: pointer;
    font-weight: 600;
}

button.primary {
    background: var(--violeta1);
    color: white;
}

button.primary:disabled {
    background: #b8b1d9;
    cursor: not-allowed;
}

button.secondary {
    background: white;
    border-color: #dcdcdc;
    color: #333;
}

.focus-hint {
    margin-top: 0.6em;
    color: #666;
    font-size: 0.95em;
}

@media (max-width: 768px) {
    .header {
        flex-direction: column;
        align-items: flex-start;
    }

    .status {
        grid-template-columns: 1fr;
    }

    .board-wrapper {
        grid-template-columns: 1fr;
    }

    .controls {
        grid-template-columns: repeat(3, 1fr);
        grid-template-rows: repeat(2, 44px);
        gap: 8px;
    }

    .controls button {
        width: 100%;
    }

    .controls .middle-row {
        grid-template-columns: repeat(2, 1fr);
        width: 100%;
    }
}
</style>


