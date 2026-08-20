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
import { partesFecha, diferenciaDias } from '$lib/cartera/fechas.js';
import { fechaLegible } from '$lib/cartera/tickets.js';
import { desdeCuando } from '$lib/cartera/relativo.js';
import { estadoInstalacionDe } from '$lib/cartera/instalacion.js';
import { describirConexion } from '$lib/cartera/planes.js';
import { estimarEdad } from '$lib/cartera/edad.js';
import { ordenar, direccionInicial } from '$lib/cartera/orden.js';
import { paginasVisibles, POR_PAGINA } from '$lib/cartera/paginacion.js';
import { toTitleCase } from '$lib/formatName.js';

const clientes = $derived(carteraStore.clientes);
const loading = $derived(carteraStore.loading);
const config = $derived(carteraStore.config);

let busqueda = $state('');
let filtro = $state('todos');
let abierto = $state(null);
let agregando = $state(false);
let configurando = $state(false);

// Columna activa y direccion. `alertas` es el orden compuesto por defecto: no
// tiene direccion que invertir, porque no ordena por un campo sino por "que
// atiendo hoy".
let orden = $state({ columna: 'alertas', direccion: 'desc' });
let pagina = $state(1);

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
//
// Los puntos de pago y la edad tambien se calculan aca y no en el template: son
// las dos operaciones caras por fila, y `ordenar` las necesita igual.
const conAlertas = $derived.by(() => {
    const hoy = hoyPartes();
    return clientes.map((c) => {
        const alertas = carteraStore.alertasDeCliente(c);
        const activas = promosActivas(c.promos ?? [], hoy);
        const proximo = carteraStore.proximoRecordatorioDe(c);
        const estadoInstalacion = estadoInstalacionDe(c);
        return {
            cliente: c,
            alertas,
            urgencia: urgenciaDe(alertas),
            chips: chipsDe(c, alertas, activas, proximo, estadoInstalacion),
            edad: estimarEdad(c.doc_number, hoy.anio),
            ciudad: c.ciudad ? toTitleCase(c.ciudad) : '',
            puntos: puntosDe(c, hoy).filter((p) => p.estado !== 'gris'),
            ultimoContacto: c.ultimo_contacto ?? '',
            // `created` de respaldo: `start_date` es la fecha de alta de
            // IspCube y siempre viene, pero un registro a medio sincronizar
            // podria no tenerla todavia, y la columna no puede quedar vacia.
            alta: c.start_date || (c.created ?? '').slice(0, 10)
        };
    });
});

const FILTROS = [
    { value: 'todos', label: 'Todos' },
    { value: 'alerta', label: 'Con alerta' },
    { value: 'seguimiento', label: 'Seguimiento 1 mes' },
    { value: 'mora', label: 'En mora' },
    { value: 'tickets', label: 'Tickets nuevos' },
    { value: 'nap_faltante', label: 'Sin reserva de NAP' },
    { value: 'nap_anulado', label: 'NAP anulado' },
    { value: 'recordatorio', label: 'Recordatorios' },
    { value: 'promo_venciendo', label: 'Promos por vencer' }
];

// Los encabezados, en el mismo orden que las columnas de la grilla. Las
// etiquetas son cortas a proposito: cada una tiene que entrar en el ancho de su
// columna sin envolver.
const COLUMNAS = [
    { key: 'codigo', label: 'Código' },
    { key: 'nombre', label: 'Nombre' },
    { key: 'ciudad', label: 'Ciudad' },
    { key: 'conexiones', label: 'Conexiones' },
    { key: 'contacto', label: 'Contacto' },
    { key: 'pagos', label: 'Pagos' },
    { key: 'alertas', label: 'Alertas' },
    { key: 'alta', label: 'Alta' }
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

const ordenadas = $derived(ordenar(visibles, orden.columna, orden.direccion));

const totalPaginas = $derived(Math.max(1, Math.ceil(ordenadas.length / POR_PAGINA)));
// La pagina se clampea al derivar y no al setear: si el filtro achica la lista
// mientras estas en la 7, `pagina` sigue valiendo 7 hasta el proximo cambio, y
// sin esto la tabla quedaria vacia por un frame.
const paginaActual = $derived(Math.min(pagina, totalPaginas));
const enPagina = $derived(
    ordenadas.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA)
);
const numerosPagina = $derived(paginasVisibles(paginaActual, totalPaginas));
const desdeFila = $derived(ordenadas.length === 0 ? 0 : (paginaActual - 1) * POR_PAGINA + 1);
const hastaFila = $derived(Math.min(paginaActual * POR_PAGINA, ordenadas.length));

// Cualquier cosa que cambie QUE se ve vuelve a la primera pagina. Sin esto,
// buscar algo estando en la pagina 5 muestra una lista vacia y parece que no
// hubo resultados.
$effect(() => {
    busqueda;
    filtro;
    orden.columna;
    orden.direccion;
    pagina = 1;
});

function ordenarPor(key) {
    // `alertas` es un orden compuesto de cuatro criterios, no un campo: darlo
    // vuelta pondria arriba a los clientes sin nada que hacer, que es
    // exactamente lo contrario de para lo que existe.
    if (key === 'alertas') {
        orden = { columna: 'alertas', direccion: 'desc' };
        return;
    }
    if (orden.columna === key) {
        orden = { columna: key, direccion: orden.direccion === 'asc' ? 'desc' : 'asc' };
        return;
    }
    orden = { columna: key, direccion: direccionInicial(key) };
}

function irA(n) {
    if (n < 1 || n > totalPaginas) return;
    pagina = n;
}

// Las celdas de codigo y nombre son seleccionables (ver los estilos), pero la
// fila entera sigue siendo un boton: soltar el mouse al terminar de arrastrar
// cuenta como click y abriria el detalle encima de lo que acabas de
// seleccionar. Con esto, si hay algo seleccionado el click no hace nada.
function abrir(cliente) {
    if (window.getSelection?.()?.toString()) return;
    abierto = cliente;
}

const ETIQUETAS = {
    seguimiento: 'Contactar (1 mes)',
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
    pendiente_pago: 'Inst. pendiente de pago',
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
    estado_instalacion: 3.5,
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

/** dd/mm/aa: la columna de alta tiene 5.4em y el anio de cuatro digitos no entra. */
function fmtAlta(iso) {
    const p = partesFecha(iso);
    if (!p) return '—';
    return `${String(p.dia).padStart(2, '0')}/${String(p.mes).padStart(2, '0')}/${String(p.anio).slice(-2)}`;
}

/**
 * Hace cuanto fue el ultimo contacto, en la unidad mas grande que se lea bien.
 *
 * Toma `ahora` en vez de leer el reloj adentro para que Svelte sepa que
 * depende de el: es lo que hace que la columna envejezca sola sin recargar.
 * No usa `desdeCuando` porque `ultimo_contacto` es una FECHA sin hora
 * (`"2026-08-04"`) y `Date.parse` la leeria en UTC, corriendo el dia en
 * Argentina.
 */
function haceCuanto(iso, ahora) {
    const p = partesFecha(iso);
    if (!p) return null;

    const d = new Date(ahora);
    const dias = diferenciaDias(p, { anio: d.getFullYear(), mes: d.getMonth() + 1, dia: d.getDate() });

    if (dias <= 0) return 'hoy';
    if (dias === 1) return 'ayer';
    if (dias < 30) return `hace ${dias} d`;
    if (dias < 365) return `hace ${Math.floor(dias / 30)} m`;
    return `hace ${Math.floor(dias / 365)} a`;
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
function chipsDe(cliente, alertas, activas, proximo, estadoInstalacion) {
    const chips = [];

    // No es una alerta deducida de `alertasDe`: es el estado de instalacion
    // (`estadoInstalacionDe`), pero se muestra como un chip mas para que se
    // note al mismo golpe de vista que el resto, no como una linea de texto
    // aparte debajo del nombre.
    if (estadoInstalacion !== 'instalado') {
        chips.push({
            tipo: 'estado_instalacion',
            mod: '',
            texto: ETIQUETA_ESTADO_INSTALACION[estadoInstalacion],
            titulo: null,
            sr: ''
        });
    }

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

function puntosDe(cliente, hoy) {
    const instalacion = partesFecha(cliente.fecha_instalacion);
    if (!instalacion) return [];
    return puntosPorMes(cliente.pagos ?? [], {
        perfil: cliente.perfil_pago,
        diaCorte: diaCorteDe(cliente.perfil_pago, config),
        instalacion,
        hoy,
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
//
// Es la lista filtrada COMPLETA y no la pagina actual: que los dos numeros sean
// 20 es coincidencia -uno es el limite del endpoint, el otro el tamanio de
// pagina- y priorizar por antiguedad del snapshot es mejor criterio que
// "lo que quedo arriba".
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
                class:girando={carteraStore.sincronizando}
                onclick={refrescarVisibles}
                disabled={!puedeRefrescar}
                aria-label={carteraStore.sincronizando ? 'Actualizando' : 'Actualizar'}
                title="Volver a consultar IspCube para los clientes que estás viendo"
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                    stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="23 4 23 10 17 10" />
                    <polyline points="1 20 1 14 7 14" />
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
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
    {:else if ordenadas.length === 0}
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
        <div class="tabla">
            <div class="cabecera">
                {#each COLUMNAS as col}
                    {@const activa = orden.columna === col.key}
                    <button
                        class="th"
                        class:activa
                        onclick={() => ordenarPor(col.key)}
                        aria-label={col.key === 'alertas'
                            ? 'Ordenar por urgencia (orden por defecto)'
                            : `Ordenar por ${col.label}`}
                    >
                        <span class="th-texto">{col.label}</span>
                        <span class="flecha" aria-hidden="true">
                            {#if !activa}⇅{:else if orden.direccion === 'asc'}↑{:else}↓{/if}
                        </span>
                    </button>
                {/each}
            </div>

            <ul class="lista">
                {#each enPagina as fila (fila.cliente.id)}
                    {@const { cliente, urgencia, chips, ciudad, puntos, ultimoContacto, alta } = fila}
                    <!-- Al nivel del {#each} y no dentro de la celda: Svelte
                         solo acepta {@const} como hijo directo de un bloque. -->
                    {@const desdeContacto = haceCuanto(ultimoContacto, ahora)}
                    <li>
                        <!-- Tres `class:` sueltos y no un `class={...}` calculado:
                             un `class` dinamico en el mismo elemento que el
                             estatico es un atributo duplicado y Svelte no
                             compila. -->
                        <button
                            class="fila"
                            class:urgencia-baja={urgencia === 'baja'}
                            class:urgencia-media={urgencia === 'media'}
                            class:urgencia-alta={urgencia === 'alta'}
                            onclick={() => abrir(cliente)}
                            title="Actualizado {desdeCuando(cliente.sincronizado, ahora)}"
                        >
                            <span class="celda codigo seleccionable">
                                {cliente.code}
                                {#if carteraStore.refrescoFallido(cliente.code)}
                                    <span
                                        class="sync-fallo"
                                        title="No pudimos actualizar contra IspCube. Mostrando el último snapshot."
                                    >
                                        <span class="sr-only">Sin actualizar</span>
                                        ⟳
                                    </span>
                                {/if}
                            </span>

                            <span class="celda quien seleccionable">
                                <span class="nombre-linea">
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
                                </span>
                            </span>

                            <span class="celda ciudad">
                                {#if ciudad}
                                    <span class="texto" title={ciudad}>{ciudad}</span>
                                {:else}
                                    <span class="vacia">—</span>
                                {/if}
                            </span>

                            <span class="celda conexiones">
                                {#each cliente.connections ?? [] as cx}
                                    {@const { etiqueta, categoria } = describirConexion(cx.plan_nombre)}
                                    {#if categoria === 'tv'}
                                        <!-- En la columna la TV va solo como icono: el nombre del pack
                                             (Gigared, Antina, DGO...) no cambia como se atiende la fila y
                                             comia el ancho de la celda. El nombre completo sigue en el
                                             `title` y en el modal. -->
                                        <span class="chip conexion tv" title={cx.plan_nombre}>
                                            <span class="sr-only">{etiqueta}</span>
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                                                stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                                <path d="M10 20H14M5 18H19C20.1046 18 21 17.1046 21 16V7C21 5.89543 20.1046 5 19 5H5C3.89543 5 3 5.89543 3 7V16C3 17.1046 3.89543 18 5 18Z" />
                                            </svg>
                                        </span>
                                    {:else}
                                        <span class="chip conexion {categoria}" title={cx.plan_nombre}>{etiqueta}</span>
                                    {/if}
                                {:else}
                                    <span class="vacia">—</span>
                                {/each}
                            </span>

                            <span class="celda contacto">
                                {#if desdeContacto}
                                    <span title="Último contacto: {fmtFecha(ultimoContacto)}">
                                        {desdeContacto}
                                    </span>
                                {:else}
                                    <span class="vacia" title="Todavía no lo contactaron">nunca</span>
                                {/if}
                            </span>

                            <span class="celda pagos" title="Últimos 6 meses">
                                {#each puntos as p}
                                    <span class="punto {p.estado}" title={tituloPunto(p)}>
                                        <span class="sr-only">{ETIQUETA_ESTADO_PUNTO[p.estado] ?? p.estado}</span>
                                    </span>
                                {:else}
                                    <span class="vacia">—</span>
                                {/each}
                            </span>

                            <span class="celda alertas">
                                {#each chips as chip}
                                    <span class="chip {chip.tipo} {chip.mod}" title={chip.titulo}>
                                        {#if chip.sr}<span class="sr-only">{chip.sr}</span>{/if}
                                        {chip.texto}
                                    </span>
                                {:else}
                                    <span class="vacia">—</span>
                                {/each}
                            </span>

                            <span class="celda alta">{fmtAlta(alta)}</span>
                        </button>
                    </li>
                {/each}
            </ul>
        </div>

        <nav class="paginacion" aria-label="Paginación de la cartera">
            <span class="rango">{desdeFila}–{hastaFila} de {ordenadas.length}</span>
            {#if totalPaginas > 1}
                <div class="paginas">
                    <button onclick={() => irA(paginaActual - 1)} disabled={paginaActual === 1} aria-label="Página anterior">‹</button>
                    {#each numerosPagina as n}
                        {#if n === '…'}
                            <span class="salto" aria-hidden="true">…</span>
                        {:else}
                            <button
                                class:actual={n === paginaActual}
                                onclick={() => irA(n)}
                                aria-label="Página {n}"
                                aria-current={n === paginaActual ? 'page' : undefined}
                            >
                                {n}
                            </button>
                        {/if}
                    {/each}
                    <button onclick={() => irA(paginaActual + 1)} disabled={paginaActual === totalPaginas} aria-label="Página siguiente">›</button>
                </div>
            {/if}
        </nav>
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
    background: none; border: none; color: #9ca3af; cursor: pointer;
    width: 2.2em; height: 2.2em; padding: 0; border-radius: 0.5em;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.18s, color 0.18s;
}
.refrescar svg { width: 1.2em; height: 1.2em; }
.refrescar:hover:not(:disabled) { background: #f5f2fa; color: var(--violeta2); }
.refrescar:disabled { opacity: 0.55; cursor: not-allowed; }
/* Gira mientras `sincronizando` esta activo, no un spinner aparte: el mismo
   icono da el feedback de "en curso" sin sumar otro elemento al lado. */
.refrescar.girando svg { animation: girar 0.9s linear infinite; }
@keyframes girar {
    to { transform: rotate(360deg); }
}
.agregar {
    background: #fff; color: #6b7280; border: 1.5px solid #e0e0e0;
    border-radius: 0.6em; padding: 0.5em 0.9em; font-size: 0.88em;
    font-weight: 400; cursor: pointer; transition: background 0.18s, border-color 0.18s, color 0.18s;
}
.agregar:hover { background: #f5f2fa; border-color: #d1c4e9; color: var(--violeta2); }
.controles { display: flex; flex-wrap: wrap; gap: 1em; margin: 1.5em 0; align-items: center; }
input[type='search'] {
    flex: 1 1 18em; padding: 0.7em 1em; border: 2px solid #e5e7eb;
    border-radius: 0.8em; font-size: 1em; font-family: inherit;
}
input[type='search']:focus { outline: none; border-color: var(--violeta2); }
.filtros { display: flex; flex-wrap: wrap; gap: 0.4em; }
.filtros button {
    border: 1.5px solid #e0e0e0; background: #fff; color: #6b7280;
    border-radius: 2em; padding: 0.45em 1em; cursor: pointer; font-size: 0.92em;
    font-weight: 400; transition: background 0.18s, border-color 0.18s, color 0.18s;
}
.filtros button:hover:not(.activo) { background: #f5f2fa; border-color: #d1c4e9; color: var(--violeta2); }
.filtros button.activo { background: var(--violeta2); color: #fff; border-color: var(--violeta2); }

/* Una sola definicion de columnas para el encabezado y las filas: si vivieran
   en dos reglas distintas, tocar una sola descuadra la tabla entera.
   minmax(0, …) y no 1fr pelado: con `1fr` la columna no puede achicarse por
   debajo de su contenido, asi que un nombre largo empujaba a las demas fuera de
   la fila. */
.tabla {
    --cols: 4.6em minmax(0, 1.5fr) 6.4em 7.6em 6em 5em minmax(0, 1.7fr) 5.4em;
    border: 1.5px solid #ececec; border-radius: 1em; background: #fff; overflow: hidden;
}
.cabecera, .fila {
    display: grid; grid-template-columns: var(--cols);
    gap: 0.7em; align-items: center;
}
.cabecera { background: #faf8fd; border-bottom: 1px solid #ececec; padding: 0 0.4em 0 0.9em; }
.th {
    display: flex; align-items: center; gap: 0.3em; min-width: 0;
    background: none; border: none; padding: 0.7em 0.2em; margin: 0;
    font: inherit; font-size: 0.72em; letter-spacing: 0.04em; color: #6b7280;
    text-align: left; cursor: pointer; border-radius: 0.4em;
    transition: color 0.15s;
}
.th-texto { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.th:hover { color: var(--violeta2); }
.th.activa { color: var(--violeta2); font-weight: 700; }
/* La flecha del criterio inactivo se ve igual, apagada: sin ella el encabezado
   no parece clickeable hasta que lo tocas. */
.flecha { opacity: 0.35; flex-shrink: 0; }
.th.activa .flecha { opacity: 1; }

.lista { list-style: none; padding: 0; margin: 0; }
li + li .fila { border-top: 1px solid #f3f4f6; }
.fila {
    width: 100%; padding: 0.6em 0.6em 0.6em 0.9em;
    background: none; border: none; cursor: pointer; text-align: left;
    font-size: 1em; font-family: inherit; color: inherit;
}
.fila:hover { background: #faf8fd; }
/* Con teclado no habia ninguna senial de donde estabas parado. */
.fila:focus-visible { outline: 2px solid var(--violeta2); outline-offset: -2px; background: #faf8fd; }
/* La urgencia se ve antes de leer los chips. `inset box-shadow` y no
   `border-left`: el borde cambiaria el ancho de la fila y las filas con alerta
   arrancarian corridas respecto de las que no tienen. */
.fila.urgencia-baja { box-shadow: inset 3px 0 0 #b9a7d9; }
.fila.urgencia-media { box-shadow: inset 3px 0 0 #f0c674; }
.fila.urgencia-alta { box-shadow: inset 3px 0 0 #ef4444; }

.celda { min-width: 0; display: flex; align-items: center; gap: 0.3em; font-size: 0.85em; }
.codigo { color: #9ca3af; font-variant-numeric: tabular-nums; }
/* Codigo y nombre se copian todo el dia. Dentro de un <button> el navegador no
   deja seleccionar; esto lo habilita, y `abrir()` ignora el click cuando hay
   algo seleccionado. Sin `cursor: text`: la celda es un flex de todo el ancho
   de columna, asi que el cursor de texto se veia cambiar ya desde el borde de
   la celda, lejos de donde estaba la letra. Se deja el cursor heredado de
   `.fila` (pointer). */
.seleccionable { user-select: text; }
.quien { flex-direction: column; align-items: flex-start; gap: 0.05em; }
.nombre-linea { display: flex; align-items: center; gap: 0.4em; min-width: 0; max-width: 100%; }
.nombre-linea strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; font-weight: 600; }
.contacto, .alta { color: #6b7280; white-space: nowrap; }
.alta { font-variant-numeric: tabular-nums; }
.ciudad { color: #6b7280; }
/* El recorte va en el hijo y no en la celda: `.celda` es flex, y un nodo de
   texto suelto adentro de un flex container no se puede elipsizar. */
.ciudad .texto { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vacia { color: #d1d5db; }
/* Mismo tono amber que las alertas de mora, no rojo: un refresco fallido deja
   al cliente en el modo degradado esperado (snapshot viejo), no en un error. */
.sync-fallo { color: #92400e; }
/* "Nuevo": mismo cyan que .chip.promo (informativo, deducido de IspCube).
   "Instalado": mismo verde que .chip.rec-proximo. Cero paletas nuevas. */
.badge {
    font-size: 0.72em; font-weight: 700; padding: 0.15em 0.5em; border-radius: 1em;
    white-space: nowrap; text-transform: uppercase; letter-spacing: 0.02em; flex-shrink: 0;
}
.badge.nuevo { background: #cffafe; color: #155e75; }
.badge.instalado { background: #d1fae5; color: #065f46; }
.pagos { gap: 0.25em; }
.sr-only {
    position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
    overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
}
/* Cinco estados, cinco combinaciones de forma + borde + relleno: el color
   nunca es el unico canal, asi que siguen siendo distinguibles sin ver rojo
   ni verde. */
.punto { width: 0.75em; height: 0.75em; display: inline-block; box-sizing: border-box; flex-shrink: 0; }
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
.alertas, .conexiones { flex-wrap: wrap; gap: 0.3em; }
.chip {
    font-size: 0.88em; padding: 0.15em 0.6em; border-radius: 1em;
    white-space: nowrap; font-weight: 600;
}
.chip.seguimiento { background: #ede7f6; color: #5a1e7a; }
.chip.mora_1 { background: #fef3c7; color: #92400e; }
.chip.mora_2 { background: #fee2e2; color: #991b1b; }
.chip.tickets { background: #dbeafe; color: #1e40af; }
/* Cyan/teal: nuevo, no lo usa ningun otro chip. Distinto del verde de
   recordatorio -que significa "lo cargo el asesor"-, esto es informativo,
   deducido de IspCube. */
.chip.promo {
    background: #cffafe; color: #155e75;
    display: inline-block; max-width: 10em;
    overflow: hidden; text-overflow: ellipsis;
}
/* Mismo amber que mora_1: "atender pronto", no una falla ya consumada como mora_2. */
.chip.promo_venciendo { background: #fef3c7; color: #92400e; }
/* Mismo amber que mora_1/tickets: anomalia de proceso, no un vencimiento,
   pero tampoco algo para ignorar. */
.chip.nap_faltante, .chip.nap_anulado { background: #fef3c7; color: #92400e; }
/* Mismo amber: instalacion_pendiente/pendiente_pago tampoco es un vencimiento,
   pero el asesor tiene que verlo igual de rapido que el resto de la columna. */
.chip.estado_instalacion { background: #fef3c7; color: #92400e; }
/* Mas corto que en la version de tarjetas (era 14em): en una tabla de nueve
   columnas un recordatorio largo envolvia a tres lineas y estiraba la fila.
   El texto completo sigue en el `title`. */
.chip.recordatorio {
    display: inline-block; max-width: 8em;
    overflow: hidden; text-overflow: ellipsis;
}
/* Semaforo del recordatorio. Los tres colores ya existen en el panel: el verde
   es el de "lo cargo el asesor" del detalle, el ambar es el de mora_1
   ("atender pronto") y el rojo el de mora_2 ("ya se paso"). Cero paletas
   nuevas. */
.chip.rec-proximo { background: #d1fae5; color: #065f46; }
.chip.rec-hoy { background: #fef3c7; color: #92400e; }
.chip.rec-vencido { background: #fee2e2; color: #991b1b; }
/* Los chips de conexion reusan la escala de `describirConexion`: internet y TV
   en violeta (el color del panel), telefonia en gris. Internet y TV comparten
   color porque el icono ya los distingue y son los dos servicios "principales";
   el cyan quedaba para .chip.promo. */
.chip.conexion { max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
.chip.conexion.internet, .chip.conexion.tv { background: #ede7f6; color: #5a1e7a; }
/* Solo icono: sin texto que centrar, el padding lateral se achica para que no
   quede una pastilla vacia al lado del chip de internet. */
.chip.conexion.tv {
    display: inline-flex; align-items: center; padding: 0.15em 0.5em;
}
.chip.conexion.tv svg { width: 1.15em; height: 1.15em; display: block; }
.chip.conexion.telefonia { background: #f3f4f6; color: #4b5563; }
.chip.conexion.otro { background: #f3f4f6; color: #6b7280; }

.paginacion {
    display: flex; align-items: center; justify-content: space-between;
    gap: 1em; margin-top: 1em; font-size: 0.85em; color: #6b7280; flex-wrap: wrap;
}
.paginas { display: flex; gap: 0.3em; align-items: center; }
.paginas button {
    border: 1.5px solid #e5e7eb; background: #fff; color: var(--violeta2);
    border-radius: 0.5em; padding: 0.3em 0.65em; cursor: pointer;
    font-size: 1em; font-family: inherit; min-width: 2.1em;
}
.paginas button:hover:not(:disabled) { background: #f5f2fa; border-color: #d1c4e9; }
.paginas button.actual { background: var(--violeta2); color: #fff; border-color: var(--violeta2); }
.paginas button:disabled { opacity: 0.4; cursor: not-allowed; }
.salto { color: #d1d5db; padding: 0 0.15em; }

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

/* Ocho columnas no entran en un telefono. Se vuelve a la disposicion apilada,
   con areas: el nombre toma el ancho completo y los datos cortos comparten
   linea. Solo se ocultan ciudad y conexiones -son contexto, no lo que se
   busca en un telefono-. El encabezado de orden tambien, porque no hay
   columnas contra las cuales alinearlo; el orden activo se conserva. */
@media (max-width: 900px) {
    section { padding: 1em; }
    .cabecera { display: none; }
    .fila {
        grid-template-columns: 1fr auto;
        grid-template-areas:
            'codigo alta'
            'quien quien'
            'pagos contacto'
            'alertas alertas';
        gap: 0.3em 0.8em; padding: 0.8em 0.9em;
    }
    /* El codigo se queda como celda propia en vez de colarse en la linea del
       nombre con un `::before`: adentro vive el aviso de "sin actualizar", y
       esconderlo dejaba al telefono sin la unica senial de que el snapshot
       esta viejo. */
    .codigo { grid-area: codigo; }
    .quien { grid-area: quien; }
    .pagos { grid-area: pagos; }
    .contacto { grid-area: contacto; justify-content: flex-end; }
    .alta { grid-area: alta; justify-content: flex-end; }
    .alertas { grid-area: alertas; }
    /* Contexto, no lo que se busca en un telefono. */
    .ciudad, .conexiones { display: none; }
}
</style>
