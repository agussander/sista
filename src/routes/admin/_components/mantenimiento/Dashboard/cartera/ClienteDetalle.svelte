<!-- src/routes/admin/_components/mantenimiento/Dashboard/cartera/ClienteDetalle.svelte -->
<script>
// Detalle de un cliente. Al abrirse marca sus tickets como vistos (apaga la
// alerta de tickets nuevos) y refresca su snapshot contra IspCube.
import { onMount } from 'svelte';
import TicketsCliente from './TicketsCliente.svelte';
import AnotacionesCliente from './AnotacionesCliente.svelte';
import RecordatoriosCliente from './RecordatoriosCliente.svelte';
import { carteraStore } from './carteraStore.svelte.js';
import { puntosPorMes } from '$lib/cartera/pagos.js';
import { diaCorteDe } from '$lib/cartera/alertas.js';
import { partesFecha } from '$lib/cartera/fechas.js';

let { cliente, onCerrar } = $props();

// El registro puede actualizarse por la sincronizacion mientras el detalle esta
// abierto; se lee siempre del store para no mostrar datos congelados.
const actual = $derived(carteraStore.clientes.find((c) => c.id === cliente.id) ?? cliente);
const config = $derived(carteraStore.config);

const puntos = $derived.by(() => {
    const instalacion = partesFecha(actual.fecha_instalacion);
    if (!instalacion) return [];
    const d = new Date();
    return puntosPorMes(actual.pagos ?? [], {
        perfil: actual.perfil_pago,
        diaCorte: diaCorteDe(actual.perfil_pago, config),
        instalacion,
        hoy: { anio: d.getFullYear(), mes: d.getMonth() + 1, dia: d.getDate() },
        meses: 6
    });
});

const alertas = $derived(carteraStore.alertasDeCliente(actual));

// IspCube informa `debt` en su propio signo: positivo = debe, negativo =
// saldo a favor. Se respeta tal cual, sin invertir.
const cuenta = $derived(actual.debt ?? 0);

const ETIQUETA_ALERTA = {
    seguimiento: 'Contactar: pasaron 2 meses de la instalación',
    mora_1: 'No registró pago este mes',
    mora_2: 'Mora: pasó el segundo vencimiento',
    tickets: 'Tiene tickets de soporte nuevos'
};

let marcando = $state(false);
let errorAlerta = $state('');

// Apagar la alerta de seguimiento es una accion propia, no un efecto de guardar
// una nota. Si falla, la alerta queda encendida: es el lado seguro del error.
async function marcarContactado() {
    marcando = true;
    errorAlerta = '';
    const ok = await carteraStore.marcarContactado(actual);
    if (!ok) errorAlerta = 'No se pudo marcar el contacto. Probá de nuevo.';
    marcando = false;
}

const fmt = (iso) => (iso ? new Date(iso).toLocaleDateString('es-AR') : '—');
const plata = (n) => (Number(n) || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });

// Cuanto hace que se sincronizo este registro con IspCube: es lo que hace
// honesto el diseño de snapshot ("esto no es en vivo, es de hace X").
// Devuelve la frase completa, no un fragmento: pegarle un "Datos del" delante
// a un `recién` o a un `nunca` daba textos rotos ("Datos del recién").
function datosDe(iso) {
    if (!iso) return 'Datos sin sincronizar';
    const horas = Math.floor((Date.now() - Date.parse(iso)) / 3600_000);
    if (!Number.isFinite(horas)) return 'Datos sin sincronizar';
    if (horas < 1) return 'Datos actualizados recién';
    if (horas < 24) return `Datos de hace ${horas} h`;
    return `Datos de hace ${Math.floor(horas / 24)} d`;
}

onMount(() => {
    // Abrir el detalle cuenta como "vi los tickets".
    if (actual.tickets?.ultimo) carteraStore.marcarTicketsVistos(actual);
    carteraStore.sincronizar([actual.code]);
});
</script>

<!--
    Escape va en `svelte:window`, no en un onkeydown del `.fondo`: el foco
    siempre termina dentro de `.panel` (el textarea, un input, un boton), y un
    keydown ahi nunca llega a burbujear hasta `.fondo` porque el panel tenia su
    propio onkeydown con stopPropagation. Con `svelte:window` el Escape se
    escucha una sola vez para toda la ventana, sin depender de donde este el
    foco ni de la burbuja del evento.
-->
<svelte:window onkeydown={(e) => e.key === 'Escape' && onCerrar()} />

<!--
    El cierre por teclado ya existe (Escape arriba, mas el boton "x" abajo);
    este backdrop solo suma el cierre por click como comodidad para mouse, asi
    que no necesita su propio par de teclado.
-->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
    class="fondo"
    role="presentation"
    onclick={onCerrar}
>
    <div
        class="panel"
        role="dialog"
        aria-label="Detalle del cliente"
        tabindex="-1"
        onclick={(e) => e.stopPropagation()}
    >
        <header>
            <div>
                <h3>{actual.nombre}</h3>
                <span class="code">{actual.code} · {actual.estado || 'sin estado'}</span>
                <span class="instalacion">instalado {fmt(actual.fecha_instalacion)}</span>
                <p class="datos-de">
                    {datosDe(actual.sincronizado)}
                    {#if carteraStore.sincronizando}· actualizando…{/if}
                </p>
                {#if !carteraStore.sincronizando && carteraStore.refrescoFallido(actual.code)}
                    <p class="aviso-refresco">
                        No pudimos actualizar contra IspCube ahora. Mostrando el último snapshot.
                    </p>
                {/if}
            </div>
            <button class="cerrar" onclick={onCerrar} aria-label="Cerrar">×</button>
        </header>

        {#if alertas.length > 0}
            <div class="alertas">
                {#each alertas as a}
                    {#if a.tipo === 'seguimiento'}
                        <span class="chip seguimiento">
                            {ETIQUETA_ALERTA.seguimiento}
                            <button class="marcar" onclick={marcarContactado} disabled={marcando}>
                                {marcando ? 'Guardando…' : 'Marcar contactado'}
                            </button>
                        </span>
                    {:else if a.tipo === 'recordatorio'}
                        <span class="chip recordatorio">Recordatorio: {a.texto}</span>
                    {:else}
                        <span class="chip {a.tipo}">{ETIQUETA_ALERTA[a.tipo] ?? a.tipo}</span>
                    {/if}
                {/each}
            </div>
            {#if errorAlerta}<p class="error-alerta">{errorAlerta}</p>{/if}
        {/if}

        <dl class="datos">
            <div><dt>Medio de pago</dt><dd>{actual.entity_nombre || 'Caja'}{#if actual.entity_nombre} <span class="perfil">({actual.perfil_pago})</span>{/if}</dd></div>
            <div><dt>Cuenta</dt><dd class:negativa={cuenta > 0}>{plata(cuenta)}</dd></div>
        </dl>

        <!-- Los tickets salieron del `<dl>` de arriba: ahi eran una celda mas,
             compitiendo por ancho con la deuda, y solo entraba un resumen de una
             linea con los ids crudos de categoria y estado. `TicketsCliente` los
             pide en vivo y los muestra uno por uno. -->
        <TicketsCliente code={actual.code} resumen={actual.tickets} />

        <section class="bloque">
            <h4>Pagos <span class="rango">(últimos 6 meses)</span></h4>
            <div class="pagos">
                {#each puntos.filter((p) => p.estado !== 'gris') as p}
                    <div class="mes">
                        <span class="punto {p.estado}"></span>
                        <span class="etiqueta">{p.mes.slice(5)}</span>
                        <span class="dia">{p.dia ? `día ${p.dia}` : '—'}</span>
                    </div>
                {/each}
            </div>
            <p class="leyenda">
                <span class="item"><span class="punto verde"></span> pagó en término</span>
                <span class="item"><span class="punto amarillo"></span> pagó tarde</span>
                <span class="item"><span class="punto rojo"></span> sin pago</span>
                <span class="item"><span class="punto pendiente"></span> mes en curso</span>
            </p>
        </section>

        <RecordatoriosCliente {cliente} />
        <AnotacionesCliente {cliente} />

        <footer>
            <button class="archivar" onclick={() => { carteraStore.archivar(actual); onCerrar(); }}>
                Archivar cliente
            </button>
        </footer>
    </div>
</div>

<style>
.fondo {
    position: fixed; inset: 0; background: rgba(0, 0, 0, 0.45);
    display: flex; align-items: flex-start; justify-content: center;
    padding: 2em 1.5em; overflow-y: auto; z-index: 1100;
}
.panel {
    background: #fff; border-radius: 1.2em; padding: 2em; width: 100%; max-width: 42em;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}
header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1em; }
h3 { margin: 0; color: var(--violeta2); }
.code { color: #9ca3af; font-size: 0.88em; }
.instalacion { color: #c1c7d0; font-size: 0.78em; margin-left: 0.6em; }
.datos-de { color: #b9a7d9; font-size: 0.78em; margin: 0.3em 0 0; }
/* Mismo tono que las alertas de mora (amber), no rojo: el snapshot desactualizado
   es el modo degradado esperado del diseño, no un error. */
.aviso-refresco { color: #92400e; font-size: 0.78em; margin: 0.2em 0 0; }
.cerrar { background: none; border: none; font-size: 1.8em; line-height: 1; cursor: pointer; color: #9ca3af; }
.alertas { display: flex; flex-wrap: wrap; gap: 0.5em; margin: 1.2em 0; }
.chip { font-size: 0.85em; padding: 0.4em 0.9em; border-radius: 1em; font-weight: 600; }
/* El unico chip que ademas alinea un boton adentro. */
.chip.seguimiento {
    background: #ede7f6; color: #5a1e7a;
    display: inline-flex; align-items: center; gap: 0.6em;
}
.chip.mora_1 { background: #fef3c7; color: #92400e; }
.chip.mora_2 { background: #fee2e2; color: #991b1b; }
.chip.tickets { background: #dbeafe; color: #1e40af; }
.chip.recordatorio { background: #d1fae5; color: #065f46; }
.marcar {
    background: var(--violeta2); color: #fff; border: none; border-radius: 1em;
    padding: 0.25em 0.8em; font-size: 0.88em; font-weight: 600; cursor: pointer;
}
.marcar:disabled { opacity: 0.6; cursor: not-allowed; }
.error-alerta { color: #dc2626; font-size: 0.85em; margin: -0.8em 0 1.2em; }
.datos { display: grid; grid-template-columns: repeat(auto-fit, minmax(11em, 1fr)); gap: 1em; margin: 1.5em 0; }
.datos div { display: flex; flex-direction: column; gap: 0.2em; }
dt { color: #6b7280; font-size: 0.8em; text-transform: uppercase; letter-spacing: 0.03em; }
dd { margin: 0; font-weight: 600; color: #374151; }
dd.negativa { color: #dc2626; }
.perfil { font-weight: 400; color: #9ca3af; font-size: 0.9em; }
.bloque { border-top: 1px solid #ececec; padding-top: 1.5em; margin-top: 1.5em; }
h4 { margin: 0 0 1em; color: var(--violeta2); font-size: 1.05em; }
.rango { font-weight: 400; font-size: 0.75em; color: #9ca3af; }
.pagos { display: flex; gap: 1.2em; flex-wrap: wrap; }
.mes { display: flex; flex-direction: column; align-items: center; gap: 0.3em; }
/* Mismas cinco combinaciones de forma + borde que en la lista: el color nunca
   es el unico canal que distingue un estado de otro. */
.punto { width: 1.1em; height: 1.1em; display: inline-block; box-sizing: border-box; vertical-align: middle; }
.punto.verde { border-radius: 50%; background: #22c55e; border: 1.5px solid #16a34a; }
.punto.amarillo {
    border-radius: 50%; border: 1.5px solid #a16207;
    background: radial-gradient(circle at center, #fff 0 28%, #eab308 30% 100%);
}
.punto.rojo { border-radius: 0.22em; transform: rotate(45deg); background: #ef4444; border: 1.5px solid #b91c1c; }
.punto.pendiente { border-radius: 50%; background: transparent; border: 1.5px dashed #9ca3af; }
.punto.gris { border-radius: 50%; background: #f3f4f6; border: 1px solid #e5e7eb; }
.etiqueta { font-size: 0.8em; color: #6b7280; }
.dia { font-size: 0.72em; color: #9ca3af; }
.leyenda {
    color: #9ca3af; font-size: 0.82em; margin: 1em 0 0; display: flex; flex-wrap: wrap;
    align-items: center; gap: 0.4em 1em;
}
.leyenda .item { display: inline-flex; align-items: center; gap: 0.4em; white-space: nowrap; }
.leyenda .punto { width: 0.8em; height: 0.8em; }
footer { border-top: 1px solid #ececec; margin-top: 1.5em; padding-top: 1.2em; }
.archivar {
    background: #fff; border: 1.5px solid #e0e0e0; color: #6b7280;
    border-radius: 2em; padding: 0.6em 1.2em; cursor: pointer;
}
</style>
