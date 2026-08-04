<!-- src/routes/admin/_components/mantenimiento/Dashboard/cartera/TicketsCliente.svelte -->
<script>
// Carrusel de tickets del cliente, con el detalle expandible debajo.
//
// Los tickets se piden EN VIVO a /api/cartera/tickets/[code] y no se guardan:
// el hilo de mensajes no tiene cota de tamano y no tiene sentido en el
// snapshot. Lo que sigue viniendo del snapshot es el resumen de arriba
// (`resumen`), que por eso se muestra aunque el fetch falle.
import { onMount } from 'svelte';
import Spinner from '$lib/components/ui/Spinner.svelte';
import { pb } from '$lib/pocketbase';
import { carteraStore } from './carteraStore.svelte.js';
import { fechaLegible } from '$lib/cartera/tickets.js';

let { code, resumen } = $props();

let tickets = $state([]);
let cargando = $state(true);
let error = $state('');
let sinCatalogos = $state(false);
// Indice del ticket expandido, no su id: el id puede venir nulo de la API y
// la lista no cambia despues de cargar, asi que el indice es estable.
let abierto = $state(-1);

const detalle = $derived(abierto >= 0 ? (tickets[abierto] ?? null) : null);

/** El nombre del catalogo, o el id crudo si los catalogos no llegaron. */
const nombreO = (campo, prefijo) =>
	campo?.nombre || (campo?.id != null ? `${prefijo} #${campo.id}` : '—');

async function cargar() {
	cargando = true;
	error = '';
	abierto = -1;
	try {
		// `estados_cerrados` vive en cartera_config (PocketBase), no en IspCube:
		// el servidor no puede saberlo solo.
		const cerrados = (carteraStore.config.estados_cerrados ?? []).join(',');
		const res = await fetch(
			`/api/cartera/tickets/${encodeURIComponent(code)}?cerrados=${encodeURIComponent(cerrados)}`,
			{ headers: { Authorization: `Bearer ${pb.authStore.token}` } }
		);
		if (!res.ok) throw new Error(`tickets respondio ${res.status}`);
		const datos = await res.json();
		tickets = datos.tickets ?? [];
		sinCatalogos = datos.catalogos === false;
	} catch (e) {
		console.error('[cartera] no se pudo traer el detalle de tickets:', e);
		error = 'No pudimos traer el detalle de los tickets.';
	} finally {
		cargando = false;
	}
}

onMount(cargar);
</script>

<section class="bloque">
    <h4>
        Tickets
        {#if resumen}
            <span class="resumen">
                {resumen.abiertos ?? 0} abiertos · {resumen.cerrados ?? 0} cerrados
                <span class="acotacion">(en las áreas de soporte)</span>
            </span>
        {:else}
            <!-- `tickets` null en el snapshot: la llamada a IspCube fallo en la
                 ultima sincronizacion. No hay conteo que mostrar, asi que se
                 dice eso en vez de "0 abiertos", que se leeria como "no tiene
                 ninguno". -->
            <span class="resumen">conteo no disponible</span>
        {/if}
    </h4>

    {#if cargando}
        <Spinner />
    {:else if error}
        <p class="aviso">
            {error}
            <button type="button" class="reintentar" onclick={cargar}>Reintentar</button>
        </p>
    {:else if tickets.length === 0}
        <p class="vacio">Sin tickets registrados.</p>
    {:else}
        {#if sinCatalogos}
            <p class="aviso">
                No pudimos leer los catálogos de IspCube: las categorías y estados se
                muestran por número.
            </p>
        {/if}

        <ul class="carrusel">
            {#each tickets as t, i (t.id ?? i)}
                <li>
                    <button
                        type="button"
                        class="tarjeta"
                        class:activa={abierto === i}
                        aria-expanded={abierto === i}
                        aria-controls="ticket-detalle-{code}"
                        onclick={() => (abierto = abierto === i ? -1 : i)}
                    >
                      <!-- El contenido va en un span propio y no directo en el
                           `<button>`: un boton usado como contenedor flex no
                           limita el ancho de sus hijos (el navegador lo mide por
                           su contenido), asi que una categoria larga estiraba la
                           fila fuera del borde de la tarjeta en vez de
                           recortarse. Con el span de por medio, el flex vuelve a
                           comportarse como en cualquier div. -->
                      <span class="cuerpo">
                        <span class="fila-alta">
                            <span class="numero">#{t.numero}</span>
                            <span class="estado" class:cerrado={t.cerrado}>
                                {nombreO(t.estado, 'estado')}
                            </span>
                        </span>
                        <span class="categoria">
                            <!-- El color viene del catalogo y solo acompana: el nombre
                                 de la categoria siempre esta escrito al lado, asi que
                                 el color nunca es el unico canal de informacion. -->
                            <span
                                class="punto-cat"
                                style:background={t.categoria.color || '#d1d5db'}
                            ></span>
                            <span class="cat-nombre">{nombreO(t.categoria, 'categoría')}</span>
                        </span>
                        <span class="fecha">{fechaLegible(t.fecha) || 'sin fecha'}</span>
                      </span>
                    </button>
                </li>
            {/each}
        </ul>

        <div id="ticket-detalle-{code}">
            {#if detalle}
                <div class="detalle">
                    <div class="cabecera">
                        <strong>#{detalle.numero}</strong>
                        <span class="estado" class:cerrado={detalle.cerrado}>
                            {nombreO(detalle.estado, 'estado')}
                        </span>
                        <button
                            type="button"
                            class="cerrar-detalle"
                            onclick={() => (abierto = -1)}
                            aria-label="Cerrar el detalle del ticket"
                        >×</button>
                    </div>

                    <dl class="meta">
                        <div><dt>Área</dt><dd>{nombreO(detalle.area, 'área')}</dd></div>
                        <div><dt>Categoría</dt><dd>{nombreO(detalle.categoria, 'categoría')}</dd></div>
                        <div><dt>Prioridad</dt><dd>{nombreO(detalle.prioridad, 'prioridad')}</dd></div>
                        <div><dt>Creado</dt><dd>{fechaLegible(detalle.fecha, { conHora: true }) || '—'}</dd></div>
                        {#if detalle.asignado}
                            <div><dt>Asignado</dt><dd>{detalle.asignado}</dd></div>
                        {/if}
                        {#if detalle.visita}
                            <div><dt>Visita</dt><dd>{fechaLegible(detalle.visita, { conHora: true })}</dd></div>
                        {/if}
                    </dl>

                    {#if detalle.hilo.length === 0}
                        <p class="vacio">Este ticket no tiene mensajes.</p>
                    {:else}
                        <ul class="hilo">
                            {#each detalle.hilo as m, j (j)}
                                <li>
                                    <div class="meta-msg">
                                        <span class="autor">{m.autor || 'Sin autor'}</span>
                                        <span class="cuando">{fechaLegible(m.fecha, { conHora: true })}</span>
                                        <!-- Se marca lo VISIBLE, no lo interno: casi todos
                                             los mensajes son internos (es donde el equipo
                                             deja sus comentarios del ticket), asi que
                                             marcar esos seria una etiqueta en cada linea. -->
                                        {#if !m.interno}
                                            <span class="visible">visible para el cliente</span>
                                        {/if}
                                    </div>
                                    <p>{m.texto}</p>
                                </li>
                            {/each}
                        </ul>
                    {/if}
                </div>
            {/if}
        </div>
    {/if}
</section>

<style>
.bloque { border-top: 1px solid #ececec; padding-top: 1.5em; margin-top: 1.5em; }
h4 {
    margin: 0 0 1em; color: var(--violeta2); font-size: 1.05em;
    display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.6em;
}
.resumen { font-weight: 400; font-size: 0.8em; color: #6b7280; }
.acotacion { color: #b0b0b0; }
.vacio { color: #9ca3af; margin: 0; }
.aviso { color: #92400e; font-size: 0.85em; margin: 0 0 0.8em; }
.reintentar {
    background: none; border: none; color: var(--violeta2); text-decoration: underline;
    cursor: pointer; font-size: 1em; padding: 0 0 0 0.4em;
}

/* Carrusel: scroll horizontal con snap. El `padding-bottom` deja lugar para la
   barra de scroll sin que tape el borde de las tarjetas. */
.carrusel {
    list-style: none; margin: 0; padding: 0 0 0.6em;
    display: flex; gap: 0.7em;
    overflow-x: auto; scroll-snap-type: x proximity;
    /* Sin esto, el `box-shadow` del foco de la primera tarjeta queda cortado
       por el overflow del contenedor. */
    scroll-padding-left: 0.2em;
}
.carrusel li { flex: 0 0 auto; scroll-snap-align: start; }

.tarjeta {
    display: block; width: 14em; text-align: left; cursor: pointer;
    background: #faf8fd; border: 1.5px solid #ece7f3; border-radius: 0.8em;
    padding: 0.8em 0.9em; font-family: inherit;
}
.cuerpo { display: flex; flex-direction: column; gap: 0.45em; }
.tarjeta:hover { border-color: #d8cbe9; }
.tarjeta.activa { border-color: var(--violeta2); background: #fff; }
.tarjeta:focus-visible { outline: 2px solid var(--violeta2); outline-offset: 2px; }
/* `min-width: 0` en las tres filas de la tarjeta: por defecto un flex item vale
   `min-width: auto` y se niega a achicarse por debajo de su contenido, asi que
   una categoria larga ("Reclamo por facturacion mal emitida") estiraba la fila
   hasta desbordar el borde de la tarjeta en vez de recortarse. */
.fila-alta { display: flex; align-items: center; justify-content: space-between; gap: 0.5em; min-width: 0; }
.numero { font-weight: 700; color: var(--violeta2); font-size: 1.05em; }

/* Abierto y cerrado no se distinguen solo por color: el nombre del estado
   ("Abierto", "Resuelto") esta escrito adentro del chip. */
.estado {
    font-size: 0.72em; font-weight: 600; padding: 0.25em 0.7em; border-radius: 1em;
    background: #dbeafe; color: #1e40af; white-space: nowrap;
    overflow: hidden; text-overflow: ellipsis; max-width: 7.5em;
}
.estado.cerrado { background: #f3f4f6; color: #6b7280; }

.categoria {
    display: flex; align-items: center; gap: 0.4em; min-width: 0;
    color: #374151; font-size: 0.88em;
}
/* El ellipsis va en el span del texto y no en `.categoria`: `text-overflow` no
   corta el contenido de un contenedor flex. */
.cat-nombre { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.punto-cat {
    width: 0.6em; height: 0.6em; border-radius: 50%; flex: 0 0 auto;
    border: 1px solid rgba(0, 0, 0, 0.12);
}
.fecha { font-size: 0.78em; color: #9ca3af; }

.detalle {
    background: #faf8fd; border: 1.5px solid #ece7f3; border-radius: 0.9em;
    padding: 1em 1.1em; margin-top: 0.4em;
}
.cabecera { display: flex; align-items: center; gap: 0.7em; }
.cabecera strong { color: var(--violeta2); }
.cerrar-detalle {
    margin-left: auto; background: none; border: none; font-size: 1.4em; line-height: 1;
    cursor: pointer; color: #9ca3af;
}
.meta {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(8em, 1fr));
    gap: 0.8em; margin: 0.9em 0 0;
}
.meta div { display: flex; flex-direction: column; gap: 0.15em; }
dt { color: #6b7280; font-size: 0.72em; text-transform: uppercase; letter-spacing: 0.03em; }
dd { margin: 0; font-weight: 600; color: #374151; font-size: 0.9em; }

.hilo { list-style: none; padding: 0; margin: 1.1em 0 0; display: flex; flex-direction: column; gap: 0.7em; }
.hilo li { background: #fff; border-radius: 0.7em; padding: 0.7em 0.9em; }
.meta-msg { display: flex; flex-wrap: wrap; align-items: center; gap: 0.6em; margin-bottom: 0.35em; }
.autor { font-size: 0.8em; font-weight: 600; color: #5a1e7a; }
.cuando { font-size: 0.76em; color: #9ca3af; }
.visible { font-size: 0.7em; padding: 0.15em 0.6em; border-radius: 1em; background: #dcfce7; color: #166534; }
.hilo p { margin: 0; color: #374151; font-size: 0.92em; white-space: pre-wrap; }

@media (max-width: 480px) {
    .tarjeta { width: 12em; }
}
</style>
