<!-- src/routes/admin/_components/mantenimiento/Dashboard/cartera/Cartera.svelte -->
<script>
import { onMount } from 'svelte';
import Spinner from '$lib/components/ui/Spinner.svelte';
import { carteraStore } from './carteraStore.svelte.js';
import AgregarCliente from './AgregarCliente.svelte';
import ClienteDetalle from './ClienteDetalle.svelte';
import CarteraConfig from './CarteraConfig.svelte';
import { puntosPorMes } from '$lib/cartera/pagos.js';
import { diaCorteDe, promosActivas } from '$lib/cartera/alertas.js';
import { partesFecha } from '$lib/cartera/fechas.js';
import { fechaLegible } from '$lib/cartera/tickets.js';
import { desdeCuando } from '$lib/cartera/relativo.js';
import { estadoInstalacionDe } from '$lib/cartera/instalacion.js';

const clientes = $derived(carteraStore.clientes);
const loading = $derived(carteraStore.loading);
const config = $derived(carteraStore.config);

let busqueda = $state('');
let filtro = $state('todos');
let abierto = $state(null);
let agregando = $state(false);
let configurando = $state(false);

// El tiempo relativo de cada fila tiene que envejecer solo. Sin este reloj,
// `desdeCuando` se evalua una sola vez al pintar y una pestania abierta desde
// la maniana sigue diciendo lo mismo a la tarde.
//
// 30 s y no 60 s para que el salto de "recién" a "hace 1 min" no se atrase
// hasta un minuto entero.
let ahora = $state(Date.now());

/** Partes de la fecha de hoy, en hora local. */
function hoyPartes() {
    const d = new Date();
    return { anio: d.getFullYear(), mes: d.getMonth() + 1, dia: d.getDate() };
}

// El banner de error del store es un string compartido: lo escriben cargar(),
// sincronizar() y archivar(), y una sincronizacion de fondo puede pisar un
// mensaje mas especifico (p. ej. el 403 de "no tenes permiso") con uno
// generico. Por eso el banner es descartable y se "reabre" solo cuando el
// texto cambia, no cuando el store simplemente lo repite.
//
// `ultimoError` se limpia apenas `carteraStore.error` vuelve a '': sin esto,
// un archivar() que falla dos veces seguidas (la primera se descarta, el
// error se borra solo a los 3s, la segunda repite el mismo string) nunca
// reabre el banner, porque `error !== ultimoError` da false las dos veces.
// Al resetear `ultimoError` cuando el error se apaga, la proxima vez que
// aparezca -sea el mismo texto o no- vuelve a contar como "nuevo".
let errorDescartado = $state(false);
let ultimoError = $state('');
$effect(() => {
    if (carteraStore.error) {
        if (carteraStore.error !== ultimoError) {
            ultimoError = carteraStore.error;
            errorDescartado = false;
        }
    } else {
        ultimoError = '';
    }
});

// Peso de cada alerta para que la fila comunique urgencia de un vistazo: un
// cliente con mora vencida se nota mas que uno que solo tiene el recordatorio
// de seguimiento, aun antes de leer los chips. Un recordatorio propio pesa como
// un ticket: lo puso el asesor a proposito, no lo dedujo el sistema.
const PESO = {
    mora_2: 3,
    mora_1: 2,
    tickets: 2,
    recordatorio: 2,
    promo_venciendo: 2,
    nap_faltante: 2,
    nap_anulado: 2,
    seguimiento: 1
};

function urgenciaDe(alertas) {
    if (alertas.length === 0) return null;
    const total = alertas.reduce((acc, a) => acc + (PESO[a.tipo] ?? 1), 0);
    if (total >= 3) return 'alta';
    if (total >= 2) return 'media';
    return 'baja';
}

// Las alertas salen del registro del cliente y nada mas: la de seguimiento usa
// `ultimo_contacto`, que el store mantiene al guardar una nota de contacto. Sin
// eso, saber si alguien ya llamo costaria una consulta por fila. La urgencia se
// calcula aca, una vez por cliente, para no recalcularla dos veces por fila en
// el template.
// `promosActivas` y `proximoRecordatorio` son informativos, no alertas: no
// pasan por `alertasDeCliente` ni suman a la urgencia. Un cliente con una promo
// que vence en 8 meses, o con un recordatorio para dentro de 10 dias, no tiene
// nada urgente por eso. Se calculan en el mismo derived que ya arma la lista
// para no recorrer los clientes tres veces.
const conAlertas = $derived.by(() => {
    const hoy = hoyPartes();
    return clientes.map((c) => {
        const alertas = carteraStore.alertasDeCliente(c);
        const activas = promosActivas(c.promos ?? [], hoy);
        const proximo = carteraStore.proximoRecordatorioDe(c);
        return {
            cliente: c,
            alertas,
            urgencia: urgenciaDe(alertas),
            chips: chipsDe(c, alertas, activas, proximo),
            estadoInstalacion: estadoInstalacionDe(c)
        };
    });
});

const FILTROS = [
    { value: 'todos', label: 'Todos' },
    { value: 'alerta', label: 'Con alerta' },
    { value: 'seguimiento', label: 'Seguimiento 2 meses' },
    { value: 'mora', label: 'En mora' },
    { value: 'tickets', label: 'Tickets nuevos' },
    { value: 'recordatorio', label: 'Recordatorios' },
    { value: 'promo_venciendo', label: 'Promos por vencer' }
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
    // Singular: la alerta nace de comparar `tickets.ultimo` contra
    // `tickets_vistos_hasta`, o sea "hay algo posterior a tu ultima mirada".
    // El plural sugeria un contador de tickets abiertos, que es otra cosa.
    tickets: 'Ticket nuevo',
    recordatorio: 'Recordatorio',
    promo_venciendo: 'Promo por vencer',
    nap_faltante: 'Sin reserva de NAP',
    nap_anulado: 'NAP anulado'
};

const ETIQUETA_ESTADO_PUNTO = {
    verde: 'Pagó en término',
    amarillo: 'Pagó fuera de término',
    rojo: 'Sin pago, vencido',
    pendiente: 'Todavía no vence este mes',
    gris: 'Todavía no se le facturaba'
};

const ETIQUETA_ESTADO_INSTALACION = {
    pendiente_pago: 'Pendiente de pago',
    instalacion_pendiente: 'Instalación pendiente'
};

// Orden de lectura de los chips de una fila, de mas a menos urgente. Los chips
// COEXISTEN: un cliente con mora vencida, ticket nuevo, recordatorio y promo
// por vencer muestra los cuatro. Esto solo decide de izquierda a derecha,
// nunca esconde ninguno.
const ORDEN_CHIP = {
    mora_2: 0,
    mora_1: 1,
    tickets: 2,
    nap_faltante: 3,
    nap_anulado: 3,
    recordatorio: 4,
    promo_venciendo: 5,
    seguimiento: 6,
    promo: 7
};

// El color del semaforo no puede ser el unico canal (misma regla que siguen los
// puntos de pago y el resto de los chips): esto es lo que lee un lector de
// pantalla antes del texto del recordatorio.
const SR_RECORDATORIO = {
    vencido: 'Recordatorio vencido:',
    hoy: 'Recordatorio para hoy:',
    proximo: 'Recordatorio próximo:'
};

// Version corta para el chip ("15/9"), sin ceros ni anio: tiene que entrar
// junto al texto sin descuadrar la fila. La completa va en el `title`.
// Mismo criterio que `RecordatorioChip`, y mismo motivo para no usar
// `new Date(iso)`: un "2026-08-04" se interpreta en UTC y en Argentina (UTC-3)
// se muestra corrido un dia.
function fmtCorta(iso) {
    const p = partesFecha(iso);
    return p ? `${p.dia}/${p.mes}` : iso;
}

function fmtFecha(iso) {
    const p = partesFecha(iso);
    if (!p) return iso;
    return `${String(p.dia).padStart(2, '0')}/${String(p.mes).padStart(2, '0')}/${p.anio}`;
}

function cuandoVence(dias) {
    if (dias === 0) return 'vence hoy';
    if (dias < 0) return `hace ${-dias} ${dias === -1 ? 'día' : 'días'}`;
    return `en ${dias} ${dias === 1 ? 'día' : 'días'}`;
}

function tituloTicket(cliente) {
    const f = fechaLegible(cliente.tickets?.ultimo?.fecha, { conHora: true });
    return f ? `Último ticket: ${f}` : null;
}

/**
 * Los chips de una fila, ya ordenados.
 *
 * Cada chip es `{tipo, mod, texto, titulo, sr}`: `tipo` da la clase base y la
 * posicion en `ORDEN_CHIP`, `mod` es una clase extra (solo la usa el semaforo
 * del recordatorio) y `sr` es el texto que solo oye un lector de pantalla.
 */
function chipsDe(cliente, alertas, activas, proximo) {
    const chips = [];

    for (const a of alertas) {
        // El recordatorio se dibuja aparte, desde `proximoRecordatorioDe`: la
        // alerta solo existe cuando ya vencio y el chip tiene que verse antes
        // tambien. Si se dibujaran los dos, un recordatorio vencido saldria
        // duplicado.
        if (a.tipo === 'recordatorio') continue;

        chips.push({
            tipo: a.tipo,
            mod: '',
            texto: ETIQUETAS[a.tipo],
            titulo: a.tipo === 'tickets' ? tituloTicket(cliente) : (a.texto ?? null),
            sr: ''
        });
    }

    if (proximo) {
        const r = proximo.recordatorio;
        chips.push({
            tipo: 'recordatorio',
            mod: `rec-${proximo.estado}`,
            texto: `${r.texto} · ${fmtCorta(r.fecha)}`,
            titulo: `${fmtFecha(r.fecha)} · ${cuandoVence(proximo.dias)}`,
            sr: SR_RECORDATORIO[proximo.estado]
        });
    }

    if (activas.length > 0) {
        chips.push({
            tipo: 'promo',
            mod: '',
            texto: activas[0].promo_nombre,
            titulo: activas[0].promo_nombre,
            sr: 'Promo activa:'
        });
    }

    return chips.sort((a, b) => ORDEN_CHIP[a.tipo] - ORDEN_CHIP[b.tipo]);
}

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

// Refresco manual. El automatico solo corre al montar y solo toca snapshots de
// mas de 12 h, asi que un asesor que acaba de cobrarle a alguien tendria que
// esperar hasta medio dia para verlo reflejado. Este boton le da la salida.
//
// Refresca lo que el asesor esta mirando -la lista ya filtrada- y no la cartera
// entera, por dos razones: es lo que espera que pase, y el endpoint de sync
// rechaza mas de 20 codigos por llamada. El tope se aplica sobre los mas
// desactualizados, que son los que mas ganan con el refresco.
const MAX_REFRESCO_MANUAL = 20;

const puedeRefrescar = $derived(visibles.length > 0 && !carteraStore.sincronizando);

function refrescarVisibles() {
    const codes = visibles
        .map(({ cliente }) => cliente)
        .sort((a, b) => (Date.parse(a.sincronizado) || 0) - (Date.parse(b.sincronizado) || 0))
        .slice(0, MAX_REFRESCO_MANUAL)
        .map((c) => c.code);

    carteraStore.sincronizar(codes);
}

onMount(() => {
    // El cuerpo con llaves no es cosmetico: `onMount(() => carteraStore.cargar())`
    // devolvia la Promise de `cargar`, y Svelte trata el valor de retorno de
    // `onMount` como la funcion de limpieza.
    carteraStore.cargar();

    const id = setInterval(() => (ahora = Date.now()), 30_000);
    return () => clearInterval(id);
});
</script>

<section>
    <header>
        <h2>Cartera de clientes</h2>
        <div class="acciones-header">
            <button
                class="refrescar"
                onclick={refrescarVisibles}
                disabled={!puedeRefrescar}
                title="Volver a consultar IspCube para los clientes que estás viendo"
            >
                {carteraStore.sincronizando ? 'Actualizando…' : '↻ Actualizar'}
            </button>
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
            {#each visibles as { cliente, alertas, urgencia, chips, estadoInstalacion } (cliente.id)}
                <li class:con-alerta={alertas.length > 0} class={urgencia ? `urgencia-${urgencia}` : ''}>
                    <button class="fila" onclick={() => (abierto = cliente)}>
                        <div class="quien">
                            <div class="nombre-linea">
                                <strong>{cliente.nombre}</strong>
                                {#if cliente.nuevo}
                                    <span
                                        class="badge nuevo"
                                        title="Sumado automáticamente por tu vendedor en IspCube"
                                    >
                                        Nuevo
                                    </span>
                                {/if}
                                {#if cliente.instalado_aviso}
                                    <span class="badge instalado" title="El ticket de reserva de NAP se cerró">
                                        Instalado ✓
                                    </span>
                                {/if}
                            </div>
                            <span class="code">{cliente.code}</span>
                            {#if estadoInstalacion !== 'instalado'}
                                <span class="estado-instalacion">
                                    {ETIQUETA_ESTADO_INSTALACION[estadoInstalacion]}
                                </span>
                            {/if}
                        </div>

                        <div class="pagos" title="Últimos 6 meses">
                            {#each puntosDe(cliente).filter((p) => p.estado !== 'gris') as p}
                                <span class="punto {p.estado}" title={tituloPunto(p)}>
                                    <span class="sr-only">{ETIQUETA_ESTADO_PUNTO[p.estado] ?? p.estado}</span>
                                </span>
                            {/each}
                        </div>

                        <div class="alertas">
                            {#each chips as chip}
                                <span class="chip {chip.tipo} {chip.mod}" title={chip.titulo}>
                                    {#if chip.sr}<span class="sr-only">{chip.sr}</span>{/if}
                                    {chip.texto}
                                </span>
                            {/each}
                        </div>

                        <span class="sync">
                            {desdeCuando(cliente.sincronizado, ahora)}
                            {#if carteraStore.refrescoFallido(cliente.code)}
                                <span class="sync-fallo" title="No pudimos actualizar contra IspCube. Mostrando el último snapshot.">
                                    · sin actualizar
                                </span>
                            {/if}
                        </span>
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
.refrescar {
    background: #fff; border: 1.5px solid #e0e0e0; color: var(--violeta2);
    border-radius: 2em; padding: 0.6em 1.1em; font-size: 0.95em; cursor: pointer;
    transition: background 0.18s, border-color 0.18s;
}
.refrescar:hover:not(:disabled) { background: #f5f2fa; border-color: #d1c4e9; }
.refrescar:disabled { opacity: 0.55; cursor: not-allowed; }
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
    width: 100%; display: grid;
    /* minmax(0, 1fr) y no 1fr: con `1fr` la columna no puede achicarse por
       debajo de su contenido, asi que un nombre largo empujaba a las demas
       fuera de la fila. */
    grid-template-columns: minmax(0, 1fr) auto minmax(0, auto) auto;
    align-items: center; gap: 1.2em; padding: 0.9em 1.2em;
    background: none; border: none; cursor: pointer; text-align: left; font-size: 1em;
}
.fila:hover { background: #faf8fd; }
/* Con teclado no habia ninguna senial de donde estabas parado. */
.fila:focus-visible { outline: 2px solid var(--violeta2); outline-offset: -2px; background: #faf8fd; }
.quien { display: flex; flex-direction: column; gap: 0.15em; min-width: 0; }
.nombre-linea { display: flex; align-items: center; gap: 0.4em; min-width: 0; }
.nombre-linea strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.code { color: #9ca3af; font-size: 0.85em; }
/* "Nuevo": mismo cyan que .chip.promo (informativo, deducido de IspCube).
   "Instalado": mismo verde que .chip.rec-proximo. Cero paletas nuevas. */
.badge {
    font-size: 0.68em; font-weight: 700; padding: 0.15em 0.55em; border-radius: 1em;
    white-space: nowrap; text-transform: uppercase; letter-spacing: 0.02em; flex-shrink: 0;
}
.badge.nuevo { background: #cffafe; color: #155e75; }
.badge.instalado { background: #d1fae5; color: #065f46; }
/* Discreto a proposito: instalacion_pendiente/pendiente_pago se muestran,
   pero sin la fuerza visual de una alerta -no lo son-. */
.estado-instalacion { color: #92400e; font-size: 0.78em; font-weight: 600; }
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
/* Los chips coexisten: mora + ticket + recordatorio + promo pueden estar los
   cuatro. Envuelven a una segunda linea antes que empujar o recortar las otras
   columnas. */
.alertas { display: flex; gap: 0.4em; flex-wrap: wrap; justify-content: flex-end; min-width: 0; }
.chip { font-size: 0.78em; padding: 0.25em 0.7em; border-radius: 1em; white-space: nowrap; font-weight: 600; }
.chip.seguimiento { background: #ede7f6; color: #5a1e7a; }
.chip.mora_1 { background: #fef3c7; color: #92400e; }
.chip.mora_2 { background: #fee2e2; color: #991b1b; }
.chip.tickets { background: #dbeafe; color: #1e40af; }
/* Cyan/teal: nuevo, no lo usa ningun otro chip. Distinto del verde de
   recordatorio -que significa "lo cargo el asesor"-, esto es informativo,
   deducido de IspCube. */
.chip.promo {
    background: #cffafe; color: #155e75;
    display: inline-block; max-width: 14em;
    overflow: hidden; text-overflow: ellipsis;
}
/* Mismo amber que mora_1: "atender pronto", no una falla ya consumada como mora_2. */
.chip.promo_venciendo { background: #fef3c7; color: #92400e; }
/* Mismo amber que mora_1/tickets: anomalia de proceso, no un vencimiento,
   pero tampoco algo para ignorar. */
.chip.nap_faltante, .chip.nap_anulado { background: #fef3c7; color: #92400e; }
/* El recordatorio se recorta -el texto completo va en el `title`- para que uno
   largo no descuadre la fila. El color lo pone el modificador de estado. */
.chip.recordatorio {
    display: inline-block; max-width: 14em;
    overflow: hidden; text-overflow: ellipsis;
}
/* Semaforo del recordatorio. Los tres colores ya existen en el panel: el verde
   es el de "lo cargo el asesor" del detalle, el ambar es el de mora_1
   ("atender pronto") y el rojo el de mora_2 ("ya se paso"). Cero paletas
   nuevas. */
.chip.rec-proximo { background: #d1fae5; color: #065f46; }
.chip.rec-hoy { background: #fef3c7; color: #92400e; }
.chip.rec-vencido { background: #fee2e2; color: #991b1b; }
.sync { color: #9ca3af; font-size: 0.8em; white-space: nowrap; min-width: 6.5em; text-align: right; }
/* Mismo tono amber que las alertas de mora, no rojo: un refresco fallido deja
   al cliente en el modo degradado esperado (snapshot viejo), no en un error. */
.sync-fallo { color: #92400e; }
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
    /* Apilar las cuatro celdas sueltas dejaba una columna larguisima. Con
       areas, el nombre toma el ancho completo y los puntos comparten linea con
       la marca de sincronizacion. */
    .fila {
        grid-template-columns: 1fr auto;
        grid-template-areas:
            'quien quien'
            'pagos sync'
            'alertas alertas';
        gap: 0.5em 0.8em;
    }
    .quien { grid-area: quien; }
    .pagos { grid-area: pagos; }
    .sync { grid-area: sync; }
    .alertas { grid-area: alertas; justify-content: flex-start; }
}
</style>
