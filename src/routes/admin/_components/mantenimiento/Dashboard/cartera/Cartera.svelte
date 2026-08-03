<!-- src/routes/admin/_components/mantenimiento/Dashboard/cartera/Cartera.svelte -->
<script>
import { onMount } from 'svelte';
import Spinner from '$lib/components/ui/Spinner.svelte';
import { carteraStore } from './carteraStore.svelte.js';
import AgregarCliente from './AgregarCliente.svelte';
import ClienteDetalle from './ClienteDetalle.svelte';
import CarteraConfig from './CarteraConfig.svelte';
import { puntosPorMes } from '$lib/cartera/pagos.js';
import { diaCorteDe } from '$lib/cartera/alertas.js';
import { partesFecha } from '$lib/cartera/fechas.js';

const clientes = $derived(carteraStore.clientes);
const loading = $derived(carteraStore.loading);
const config = $derived(carteraStore.config);

let busqueda = $state('');
let filtro = $state('todos');
let abierto = $state(null);
let agregando = $state(false);
let configurando = $state(false);

// El banner de error del store es un string compartido: lo escriben cargar(),
// sincronizar() y archivar(), y una sincronizacion de fondo puede pisar un
// mensaje mas especifico (p. ej. el 403 de "no tenes permiso") con uno
// generico. Por eso el banner es descartable y se "reabre" solo cuando el
// texto cambia, no cuando el store simplemente lo repite.
let errorDescartado = $state(false);
let ultimoError = $state('');
$effect(() => {
    if (carteraStore.error && carteraStore.error !== ultimoError) {
        ultimoError = carteraStore.error;
        errorDescartado = false;
    }
});

// Las alertas salen del registro del cliente y nada mas: la de seguimiento usa
// `ultimo_contacto`, que el store mantiene al guardar una nota de contacto. Sin
// eso, saber si alguien ya llamo costaria una consulta por fila.
const conAlertas = $derived(
    clientes.map((c) => ({ cliente: c, alertas: carteraStore.alertasDeCliente(c) }))
);

const FILTROS = [
    { value: 'todos', label: 'Todos' },
    { value: 'alerta', label: 'Con alerta' },
    { value: 'seguimiento', label: 'Seguimiento 2 meses' },
    { value: 'mora', label: 'En mora' },
    { value: 'tickets', label: 'Tickets nuevos' }
];

const visibles = $derived(
    conAlertas.filter(({ cliente, alertas }) => {
        const q = busqueda.trim().toLowerCase();
        if (q && !cliente.nombre.toLowerCase().includes(q) && !cliente.code.includes(q)) return false;

        if (filtro === 'todos') return true;
        if (filtro === 'alerta') return alertas.length > 0;
        if (filtro === 'mora') return alertas.some((a) => a.tipo.startsWith('mora'));
        return alertas.some((a) => a.tipo === filtro);
    })
);

const ETIQUETAS = {
    seguimiento: 'Contactar (2 meses)',
    mora_1: 'No pagó',
    mora_2: 'Mora vencida',
    tickets: 'Tickets nuevos'
};

// Peso de cada alerta para que la fila comunique urgencia de un vistazo: un
// cliente con mora vencida se nota mas que uno que solo tiene el recordatorio
// de seguimiento, aun antes de leer los chips.
const PESO = { mora_2: 3, mora_1: 2, tickets: 2, seguimiento: 1 };

function urgenciaDe(alertas) {
    if (alertas.length === 0) return null;
    const total = alertas.reduce((acc, a) => acc + (PESO[a.tipo] ?? 1), 0);
    if (total >= 3) return 'alta';
    if (total >= 2) return 'media';
    return 'baja';
}

const ETIQUETA_ESTADO_PUNTO = {
    verde: 'Pagó en término',
    amarillo: 'Pagó fuera de término',
    rojo: 'Sin pago, vencido',
    pendiente: 'Todavía no vence este mes',
    gris: 'Antes de la instalación'
};

function puntosDe(cliente) {
    const instalacion = partesFecha(cliente.fecha_instalacion);
    if (!instalacion) return [];
    const d = new Date();
    return puntosPorMes(cliente.pagos ?? [], {
        perfil: cliente.perfil_pago,
        diaCorte: diaCorteDe(cliente.perfil_pago, config),
        instalacion,
        hoy: { anio: d.getFullYear(), mes: d.getMonth() + 1, dia: d.getDate() },
        meses: 6
    });
}

function tituloPunto(p) {
    const base = `${p.mes} · ${ETIQUETA_ESTADO_PUNTO[p.estado] ?? p.estado}`;
    return p.dia ? `${base} (día ${p.dia})` : base;
}

function desdeCuando(iso) {
    if (!iso) return 'nunca';
    const horas = Math.floor((Date.now() - Date.parse(iso)) / 3600_000);
    if (!Number.isFinite(horas)) return 'nunca';
    if (horas < 1) return 'recién';
    if (horas < 24) return `hace ${horas} h`;
    return `hace ${Math.floor(horas / 24)} d`;
}

onMount(() => carteraStore.cargar());
</script>

<section>
    <header>
        <h2>Cartera de clientes</h2>
        <div class="acciones-header">
            <button class="config" onclick={() => (configurando = true)} title="Configuración">⚙</button>
            <button class="agregar" onclick={() => (agregando = true)}>+ Agregar cliente</button>
        </div>
    </header>

    <div class="controles">
        <input type="search" placeholder="Buscar por nombre o número" bind:value={busqueda} />
        <div class="filtros">
            {#each FILTROS as f}
                <button class:activo={filtro === f.value} onclick={() => (filtro = f.value)}>
                    {f.label}
                </button>
            {/each}
        </div>
    </div>

    {#if carteraStore.error && !errorDescartado}
        <p class="error">
            <span>{carteraStore.error}</span>
            <button class="cerrar-error" onclick={() => (errorDescartado = true)} aria-label="Descartar aviso">×</button>
        </p>
    {/if}

    {#if loading}
        <Spinner />
    {:else if visibles.length === 0}
        <div class="vacio">
            {#if clientes.length === 0 && carteraStore.error}
                <p>No pudimos cargar tu cartera. Revisá tu conexión e intentá de nuevo.</p>
                <button class="reintentar" onclick={() => carteraStore.cargar()}>Reintentar</button>
            {:else if clientes.length === 0}
                <p>Todavía no agregaste clientes a tu cartera.</p>
            {:else}
                <p>Ningún cliente coincide con el filtro.</p>
            {/if}
        </div>
    {:else}
        <ul class="lista">
            {#each visibles as { cliente, alertas } (cliente.id)}
                <li class:con-alerta={alertas.length > 0} class={urgenciaDe(alertas) ? `urgencia-${urgenciaDe(alertas)}` : ''}>
                    <button class="fila" onclick={() => (abierto = cliente)}>
                        <div class="quien">
                            <strong>{cliente.nombre}</strong>
                            <span class="code">#{cliente.code}</span>
                        </div>

                        <div class="pagos" title="Últimos 6 meses">
                            {#each puntosDe(cliente) as p}
                                <span class="punto {p.estado}" title={tituloPunto(p)}>
                                    <span class="sr-only">{ETIQUETA_ESTADO_PUNTO[p.estado] ?? p.estado}</span>
                                </span>
                            {/each}
                        </div>

                        <div class="alertas">
                            {#each alertas as a}
                                <span class="chip {a.tipo}">{ETIQUETAS[a.tipo]}</span>
                            {/each}
                        </div>

                        <span class="sync">{desdeCuando(cliente.sincronizado)}</span>
                    </button>
                </li>
            {/each}
        </ul>
    {/if}

    {#if agregando}
        <AgregarCliente onCerrar={() => (agregando = false)} />
    {/if}

    {#if abierto}
        <ClienteDetalle cliente={abierto} onCerrar={() => (abierto = null)} />
    {/if}

    {#if configurando}
        <CarteraConfig onCerrar={() => (configurando = false)} />
    {/if}
</section>

<style>
section { padding: 1.5em 2em; }
header { display: flex; align-items: center; justify-content: space-between; gap: 1em; }
h2 { color: var(--violeta2); margin: 0; }
.acciones-header { display: flex; gap: 0.6em; align-items: center; }
.agregar {
    background: var(--violeta2); color: #fff; border: none; border-radius: 2em;
    padding: 0.7em 1.4em; font-size: 1em; font-weight: 600; cursor: pointer;
}
.config {
    background: #fff; border: 1.5px solid #e0e0e0; color: var(--violeta2);
    border-radius: 50%; width: 2.4em; height: 2.4em; font-size: 1em; cursor: pointer;
}
.controles { display: flex; flex-wrap: wrap; gap: 1em; margin: 1.5em 0; align-items: center; }
input[type='search'] {
    flex: 1 1 18em; padding: 0.7em 1em; border: 2px solid #e5e7eb;
    border-radius: 0.8em; font-size: 1em; font-family: inherit;
}
input[type='search']:focus { outline: none; border-color: var(--violeta2); }
.filtros { display: flex; flex-wrap: wrap; gap: 0.4em; }
.filtros button {
    border: 1.5px solid #e0e0e0; background: #fff; color: var(--violeta2);
    border-radius: 2em; padding: 0.45em 1em; cursor: pointer; font-size: 0.92em;
}
.filtros button.activo { background: var(--violeta2); color: #fff; border-color: var(--violeta2); }
.lista { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.5em; }
li { border: 1.5px solid #ececec; border-radius: 1em; background: #fff; border-left-width: 1.5px; transition: border-color 0.15s; }
li.con-alerta { border-color: #f0c674; }
/* La urgencia se ve antes de leer los chips: el borde izquierdo se engrosa y
   se tiñe segun el peso de las alertas activas. */
li.urgencia-baja { border-left: 4px solid #b9a7d9; }
li.urgencia-media { border-left: 4px solid #f0c674; }
li.urgencia-alta { border-left: 4px solid #ef4444; box-shadow: 0 1px 8px rgba(239, 68, 68, 0.12); }
.fila {
    width: 100%; display: grid; grid-template-columns: 1fr auto auto auto;
    align-items: center; gap: 1.2em; padding: 0.9em 1.2em;
    background: none; border: none; cursor: pointer; text-align: left; font-size: 1em;
}
.fila:hover { background: #faf8fd; }
.quien { display: flex; flex-direction: column; gap: 0.15em; }
.code { color: #9ca3af; font-size: 0.85em; }
.pagos { display: flex; gap: 0.3em; }
.sr-only {
    position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
    overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
}
/* Cinco estados, cinco combinaciones de forma + borde + relleno: el color
   nunca es el unico canal, asi que siguen siendo distinguibles sin ver rojo
   ni verde. */
.punto { width: 0.85em; height: 0.85em; display: inline-block; box-sizing: border-box; flex-shrink: 0; }
.punto.verde { border-radius: 50%; background: #22c55e; border: 1.5px solid #16a34a; }
.punto.amarillo {
    border-radius: 50%; border: 1.5px solid #a16207;
    background: radial-gradient(circle at center, #fff 0 28%, #eab308 30% 100%);
}
.punto.rojo { border-radius: 0.2em; transform: rotate(45deg); background: #ef4444; border: 1.5px solid #b91c1c; }
.punto.pendiente { border-radius: 50%; background: transparent; border: 1.5px dashed #9ca3af; }
.punto.gris { border-radius: 50%; background: #f3f4f6; border: 1px solid #e5e7eb; }
.alertas { display: flex; gap: 0.4em; flex-wrap: wrap; }
.chip { font-size: 0.78em; padding: 0.25em 0.7em; border-radius: 1em; white-space: nowrap; font-weight: 600; }
.chip.seguimiento { background: #ede7f6; color: #5a1e7a; }
.chip.mora_1 { background: #fef3c7; color: #92400e; }
.chip.mora_2 { background: #fee2e2; color: #991b1b; }
.chip.tickets { background: #dbeafe; color: #1e40af; }
.sync { color: #9ca3af; font-size: 0.8em; white-space: nowrap; }
.vacio { color: #6b7280; padding: 2em 0; display: flex; flex-direction: column; align-items: flex-start; gap: 0.8em; }
.error {
    color: #991b1b; background: #fef2f2; border: 1px solid #fecaca; border-radius: 0.8em;
    padding: 0.7em 1em; margin: 1em 0 0; display: flex; align-items: center; justify-content: space-between; gap: 1em;
}
.cerrar-error { background: none; border: none; color: #991b1b; font-size: 1.3em; line-height: 1; cursor: pointer; padding: 0; }
.reintentar {
    background: #fff; border: 1.5px solid #e0e0e0; color: var(--violeta2);
    border-radius: 2em; padding: 0.5em 1.2em; cursor: pointer; font-size: 0.92em;
}
@media (max-width: 700px) {
    section { padding: 1em; }
    .fila { grid-template-columns: 1fr; gap: 0.5em; }
}
</style>
