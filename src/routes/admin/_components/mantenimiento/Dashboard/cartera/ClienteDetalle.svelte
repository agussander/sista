<!-- src/routes/admin/_components/mantenimiento/Dashboard/cartera/ClienteDetalle.svelte -->
<script>
// Detalle de un cliente. Al abrirse marca sus tickets como vistos (apaga la
// alerta de tickets nuevos) y refresca su snapshot contra IspCube.
import { onMount } from 'svelte';
import TicketsCliente from './TicketsCliente.svelte';
import AnotacionesCliente from './AnotacionesCliente.svelte';
import RecordatorioChip from './RecordatorioChip.svelte';
import { carteraStore } from './carteraStore.svelte.js';
import { puntosPorMes } from '$lib/cartera/pagos.js';
import { diaCorteDe, promosActivas } from '$lib/cartera/alertas.js';
import { partesFecha } from '$lib/cartera/fechas.js';
import { describirConexion } from '$lib/cartera/planes.js';

let { cliente, onCerrar } = $props();

// El registro puede actualizarse por la sincronizacion mientras el detalle esta
// abierto; se lee siempre del store para no mostrar datos congelados.
const actual = $derived(carteraStore.clientes.find((c) => c.id === cliente.id) ?? cliente);
const config = $derived(carteraStore.config);

// Partes de "hoy" en hora local, compartido entre `puntos` y `activas` (las
// promos activas de mas abajo): no hace falta una segunda fuente de "hoy" en
// el mismo componente. Se calcula una sola vez al abrir el detalle (no
// depende de nada reactivo, asi que no se recalcula despues) — aceptable
// porque el modal es de corta duracion; no importa si sigue abierto al cruzar
// la medianoche.
const hoy = $derived.by(() => {
    const d = new Date();
    return { anio: d.getFullYear(), mes: d.getMonth() + 1, dia: d.getDate() };
});

const puntos = $derived.by(() => {
    const instalacion = partesFecha(actual.fecha_instalacion);
    if (!instalacion) return [];
    return puntosPorMes(actual.pagos ?? [], {
        perfil: actual.perfil_pago,
        diaCorte: diaCorteDe(actual.perfil_pago, config),
        instalacion,
        hoy,
        meses: 6
    });
});

const activas = $derived(promosActivas(actual.promos ?? [], hoy));

// El recordatorio ya tiene su propio chip fijo en el header (RecordatorioChip),
// asi que se lo excluye de esta fila para no mostrarlo dos veces cuando esta
// vencido.
const alertas = $derived(carteraStore.alertasDeCliente(actual).filter((a) => a.tipo !== 'recordatorio'));

// IspCube informa `debt` en su propio signo: positivo = debe, negativo =
// saldo a favor. Se respeta tal cual, sin invertir.
const cuenta = $derived(actual.debt ?? 0);

const ETIQUETA_ALERTA = {
    seguimiento: 'Contactar: pasaron 2 meses de la instalación',
    mora_1: 'No registró pago este mes',
    mora_2: 'Mora: pasó el segundo vencimiento',
    tickets: 'Tiene tickets de soporte nuevos',
    nap_faltante: 'Sin reserva de NAP',
    nap_anulado: 'NAP anulado'
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

// Formateo por partes, sin `new Date(iso)`: un "2026-08-04" pasado por Date se
// interpreta en UTC y en Argentina (UTC-3) se muestra como el 3. Mismo motivo
// que el resto de fechas.js, y el mismo patron que ya usa RecordatorioChip.
// Un solo fmtFecha para la rama de alerta promo_venciendo y la seccion de
// promos activas de mas abajo.
function fmtFecha(iso) {
    const p = partesFecha(iso);
    if (!p) return iso;
    return `${String(p.dia).padStart(2, '0')}/${String(p.mes).padStart(2, '0')}/${p.anio}`;
}

// Cuanto hace que se sincronizo este registro con IspCube: es lo que hace
// honesto el diseño de snapshot ("esto no es en vivo, es de hace X").
// Devuelve la frase completa, no un fragmento: pegarle un "Datos del" delante
// a un `recién` o a un `nunca` daba textos rotos ("Datos del recién").
function datosDe(iso) {
    if (!iso) return 'Datos sin sincronizar';
    const horas = Math.floor((Date.now() - Date.parse(iso)) / 3600_000);
    if (!Number.isFinite(horas)) return 'Datos sin sincronizar';
    if (horas < 1) return 'actualizado recientemente';
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
            <div class="ident">
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
            <!-- El recordatorio es la unica accion que el asesor toma "sobre el
                 cliente" desde el header, asi que va como CTA arriba a la
                 derecha, debajo del cierre. -->
            <div class="acciones">
                <button class="cerrar" onclick={onCerrar} aria-label="Cerrar">×</button>
                <RecordatorioChip {cliente} />
            </div>
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
                    {:else if a.tipo === 'promo_venciendo'}
                        <span class="chip promo_venciendo">{a.texto} vence el {fmtFecha(a.desde)}</span>
                    {:else}
                        <span class="chip {a.tipo}">{ETIQUETA_ALERTA[a.tipo] ?? a.tipo}</span>
                    {/if}
                {/each}
            </div>
            {#if errorAlerta}<p class="error-alerta">{errorAlerta}</p>{/if}
        {/if}

        {#if (actual.connections?.length ?? 0) > 0}
            <div class="conexiones">
                {#each actual.connections as cx}
                    {@const { etiqueta, categoria } = describirConexion(cx.plan_nombre)}
                    <span class="chip conexion {categoria}" title={cx.plan_nombre}>
                        {#if categoria === 'internet'}
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                                stroke-linecap="round" stroke-linejoin="round">
                                <path d="M5 12.55a11 11 0 0 1 14.08 0" />
                                <path d="M1.42 9a16 16 0 0 1 21.16 0" />
                                <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                                <line x1="12" y1="20" x2="12.01" y2="20" />
                            </svg>
                        {:else if categoria === 'tv'}
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                                stroke-linecap="round" stroke-linejoin="round">
                                <path d="M10 20H14M5 18H19C20.1046 18 21 17.1046 21 16V7C21 5.89543 20.1046 5 19 5H5C3.89543 5 3 5.89543 3 7V16C3 17.1046 3.89543 18 5 18Z" />
                            </svg>
                        {:else if categoria === 'telefonia'}
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                                stroke-linecap="round" stroke-linejoin="round">
                                <path
                                    d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                            </svg>
                        {/if}
                        <span class="texto">{etiqueta}</span>
                    </span>
                {/each}
            </div>
        {:else}
            <div class="conexiones">
                <span class="chip conexion vacia">Sin conexiones</span>
            </div>
        {/if}

        <dl class="datos">
            <div><dt>Medio de pago</dt><dd>
                {#if actual.entity_nombre}
                    {actual.entity_nombre} <span class="perfil">({actual.perfil_pago})</span>
                {:else}
                    <!-- Sin `entity_nombre` (la API no siempre anida la entidad) no
                         hay de donde sacar un nombre propio: se muestra la palabra
                         que ya dice `perfil_pago`, sin repetirla entre parentesis
                         -"Caja (tarjeta)" es contradictorio. -->
                    {actual.perfil_pago === 'tarjeta' ? 'Tarjeta' : 'Caja'}
                {/if}
            </dd></div>
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

        {#if activas.length > 0}
            <section class="bloque">
                <h4>Promos activas</h4>
                <ul class="promos">
                    {#each activas as p}
                        <li>
                            <strong>{p.promo_nombre}</strong>
                            {#if p.plan_nombre}<span class="plan">{p.plan_nombre}</span>{/if}
                            {#if p.beneficio}<p class="beneficio">{p.beneficio}</p>{/if}
                            <span class="vence">vence el {fmtFecha(p.fin)}</span>
                        </li>
                    {/each}
                </ul>
            </section>
        {/if}

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
header { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-start; gap: 0.6em 1em; }
/* `flex-basis: 0` y no `auto`: con `auto` el bloque pide su ancho de contenido
   (el parrafo largo del aviso de refresco) y, al haber `flex-wrap`, el header
   mandaba la columna de acciones a un renglon propio en cuanto el chip del
   recordatorio se hacia ancho. Con basis 0 el nombre ocupa lo que sobra y el
   wrap queda solo para el breakpoint de abajo. */
.ident { flex: 1 1 0; min-width: 0; }
/* El "x" arriba de todo y el CTA de recordatorio debajo, ambos pegados al
   borde derecho. */
.acciones { display: flex; flex-direction: column; align-items: flex-end; gap: 0.5em; flex-shrink: 0; }
/* En pantallas angostas la columna de acciones le comia el ancho al nombre (se
   partia en tres lineas): pasa a ser una fila propia arriba del nombre. El
   `row-reverse` deja el CTA a la izquierda del "x" pero igual pegado al borde
   derecho, que es de donde el popover del recordatorio se abre hacia adentro. */
@media (max-width: 560px) {
    .acciones {
        order: -1; width: 100%; flex-direction: row-reverse;
        align-items: center; justify-content: flex-start;
    }
}
h3 { margin: 0; color: var(--violeta2); }
.code { color: #9ca3af; font-size: 0.88em; }
.instalacion { color: #c1c7d0; font-size: 0.78em; margin-left: 0.6em; }
.datos-de { color: #c1c7d0; font-size: 0.78em; margin: 0.3em 0 0; }
/* Mismo tono que las alertas de mora (amber), no rojo: el snapshot desactualizado
   es el modo degradado esperado del diseño, no un error. */
.aviso-refresco { color: #92400e; font-size: 0.78em; margin: 0.2em 0 0; }
/* Cuadrado chico en vez de un "x" suelto de 1.8em: da area de click sin ocupar
   mas lugar, y el hover se ve. */
.cerrar {
    background: none; border: none; cursor: pointer; color: #9ca3af;
    font-size: 1.25em; line-height: 1; width: 1.6em; height: 1.6em;
    display: flex; align-items: center; justify-content: center;
    border-radius: 0.5em; padding: 0;
}
.cerrar:hover { background: #f3f4f6; color: #4b5563; }
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
/* Mismo amber que mora_1: "atender pronto", no una falla ya consumada. */
.chip.promo_venciendo { background: #fef3c7; color: #92400e; }
/* Va adentro de un chip ya coloreado, asi que no compite con un segundo relleno:
   fondo blanco, borde del mismo violeta del texto. */
.marcar {
    background: #fff; color: var(--violeta2); border: 1px solid #d7c6e6;
    border-radius: 0.5em; padding: 0.25em 0.7em; font-size: 0.85em;
    font-weight: 600; cursor: pointer; font-family: inherit;
}
.marcar:hover:not(:disabled) { background: var(--violeta2); color: #fff; border-color: var(--violeta2); }
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
    background: #fff; border: 1.5px solid #e5e7eb; color: #6b7280;
    border-radius: 0.6em; padding: 0.55em 1.1em; cursor: pointer;
    font-family: inherit; font-size: 0.9em; font-weight: 600;
}
.archivar:hover { border-color: #fecaca; background: #fef2f2; color: #b91c1c; }
.conexiones { display: flex; flex-wrap: wrap; gap: 0.5em; margin: 0.8em 0 0; }
/* Sin color: ni fondo ni texto. Son un dato de referencia, no una alerta, asi
   que el color queda reservado para los chips de arriba, que si piden atencion.
   Que conexion es cada una se lee del icono (antena / tv / telefono) y del
   nombre escrito al lado, no de un tono. */
.chip.conexion {
    display: inline-flex; align-items: center; gap: 0.45em; max-width: 12em;
    background: #fff; border: 1.5px solid #e5e7eb; color: #4b5563; font-weight: 500;
}
.chip.conexion svg { width: 1em; height: 1em; flex-shrink: 0; color: #9ca3af; }
.chip.conexion .texto { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.chip.conexion.vacia { color: #9ca3af; }
.promos { list-style: none; padding: 0; margin: 1em 0 0; display: flex; flex-direction: column; gap: 0.8em; }
.promos li { background: #ecfeff; border-radius: 0.8em; padding: 0.8em 1.1em; }
.promos strong { color: #155e75; }
.promos .plan { color: #6b7280; font-size: 0.85em; margin-left: 0.5em; }
.promos .beneficio { margin: 0.3em 0 0; color: #374151; font-size: 0.9em; }
.promos .vence { display: block; color: #9ca3af; font-size: 0.8em; margin-top: 0.3em; }
</style>
