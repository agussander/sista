<!-- src/routes/admin/_components/mantenimiento/Dashboard/cartera/CarteraConfig.svelte -->
<script>
// Mapeo de entidades de IspCube a perfiles de pago, y dias de corte.
//
// En IspCube el medio de pago ES la entidad de cobranza (`entity_id`): no hay
// un campo `payment_method`. Por eso "este cliente paga con tarjeta" se define
// marcando entidades aca, y no cliente por cliente.
//
// `estados_cerrados` (que estados de ticket cuentan como cerrado) tambien vive
// en `cartera_config`, pero esta pantalla no lo edita: el endpoint de
// catalogos solo devuelve entidades y areas, no la lista de estados de
// ticket. Se carga a mano en PocketBase. `guardar()` lo relee del store y lo
// reenvia tal cual para no pisarlo con un array vacio.
import { onMount } from 'svelte';
import Spinner from '$lib/components/ui/Spinner.svelte';
import { pb } from '$lib/pocketbase';
import { carteraStore } from './carteraStore.svelte.js';
import { diaCorteValido, diaCorteONormal, CONFIG_DEFAULT } from '$lib/cartera/config.js';

let { onCerrar } = $props();

let entidades = $state([]);
let areas = $state([]);
let cargando = $state(true);
let guardando = $state(false);
let error = $state('');

let tarjeta = $state(new Set());
let soporte = $state(new Set());
let corte1 = $state(10);
let corte2 = $state(20);
let corteTarjeta = $state(21);

const toggle = (set, id) => {
    const next = new Set(set);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
};

async function cargar() {
    cargando = true;
    error = '';
    try {
        const res = await fetch('/api/cartera/catalogos', {
            headers: { Authorization: `Bearer ${pb.authStore.token}` }
        });
        if (!res.ok) throw new Error(`catalogos respondio ${res.status}`);
        const datos = await res.json();
        entidades = datos.entidades;
        areas = datos.areas;

        const c = carteraStore.config;
        tarjeta = new Set((c.entidades_tarjeta ?? []).map(String));
        soporte = new Set((c.areas_soporte ?? []).map(String));
        // El store ya normaliza `carteraStore.config` al cargarlo (ver
        // `cargarConfig` en carteraStore.svelte.js), pero se vuelve a pasar por
        // `diaCorteONormal` aca: es la misma razon por la que un `?? 10` no
        // alcanza (`0` no es un valor "vacio"), y esta pantalla no deberia
        // confiar en que quien la abre siempre paso por esa normalizacion.
        corte1 = diaCorteONormal(c.dia_corte_1, CONFIG_DEFAULT.dia_corte_1);
        corte2 = diaCorteONormal(c.dia_corte_2, CONFIG_DEFAULT.dia_corte_2);
        corteTarjeta = diaCorteONormal(c.dia_corte_tarjeta, CONFIG_DEFAULT.dia_corte_tarjeta);
    } catch (e) {
        console.error(e);
        error = 'No se pudieron leer los catálogos de IspCube.';
    } finally {
        cargando = false;
    }
}

async function guardar() {
    error = '';

    const cortes = {
        dia_corte_1: Number(corte1),
        dia_corte_2: Number(corte2),
        dia_corte_tarjeta: Number(corteTarjeta)
    };
    // Sin esta validacion, vaciar un input numerico deja `corteN` en
    // `undefined` -> `Number(undefined)` es `NaN` -> PocketBase lo guarda
    // como `0`. Con un corte en 0, `alertas.js` dispara mora TODOS los dias
    // del mes para TODOS los clientes de la cartera (ver config.js). Se
    // rechaza el guardado ANTES de tocar PocketBase, con un mensaje que dice
    // que campo esta mal.
    const invalido = Object.entries(cortes).find(([, v]) => !diaCorteValido(v));
    if (invalido) {
        error = 'Los días de corte tienen que ser un número entero entre 1 y 31.';
        return;
    }

    guardando = true;
    try {
        const lista = await pb.collection('cartera_config').getList(1, 1);
        const datos = {
            entidades_tarjeta: [...tarjeta],
            areas_soporte: [...soporte],
            // No se edita en esta pantalla (ver comentario arriba): se reenvia
            // tal cual esta en el store para no pisarlo con [].
            estados_cerrados: carteraStore.config.estados_cerrados ?? [],
            ...cortes
        };

        if (lista.items.length > 0) await pb.collection('cartera_config').update(lista.items[0].id, datos);
        else await pb.collection('cartera_config').create(datos);

        await carteraStore.cargar();
        onCerrar();
    } catch (e) {
        console.error(e);
        error = 'No se pudo guardar la configuración.';
    } finally {
        guardando = false;
    }
}

onMount(cargar);
</script>

<!--
    Escape en `svelte:window`: ver el comentario en ClienteDetalle.svelte. El
    onkeydown que vivia en `.fondo` nunca disparaba porque el foco esta siempre
    dentro de `.panel`, que cortaba la burbuja con su propio stopPropagation.
-->
<svelte:window onkeydown={(e) => e.key === 'Escape' && onCerrar()} />

<!--
    El cierre por teclado ya existe (Escape arriba, mas el boton "Cancelar");
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
        aria-label="Configuración de la Cartera"
        tabindex="-1"
        onclick={(e) => e.stopPropagation()}
    >
        <h3>Configuración de la Cartera</h3>

        {#if cargando}
            <Spinner />
        {:else}
            <section>
                <h4>Medios de pago con tarjeta</h4>
                <p class="ayuda">
                    Marcá las entidades de cobranza que corresponden a tarjeta. A esos clientes se les
                    controla el pago alrededor del día {corteTarjeta} en vez del {corte1}.
                </p>
                <div class="opciones">
                    {#each entidades as e}
                        <label>
                            <input
                                type="checkbox"
                                checked={tarjeta.has(String(e.id))}
                                onchange={() => (tarjeta = toggle(tarjeta, String(e.id)))}
                            />
                            {e.nombre}
                        </label>
                    {/each}
                </div>
            </section>

            <section>
                <h4>Áreas que cuentan como soporte</h4>
                <p class="ayuda">Sin ninguna marcada, cuentan los tickets de todas las áreas.</p>
                <div class="opciones">
                    {#each areas as a}
                        <label>
                            <input
                                type="checkbox"
                                checked={soporte.has(String(a.id))}
                                onchange={() => (soporte = toggle(soporte, String(a.id)))}
                            />
                            {a.nombre}
                        </label>
                    {/each}
                </div>
            </section>

            <section>
                <h4>Días de corte</h4>
                <div class="dias">
                    <label>Primer corte <input type="number" min="1" max="31" bind:value={corte1} /></label>
                    <label>Segundo corte <input type="number" min="1" max="31" bind:value={corte2} /></label>
                    <label>Tarjeta <input type="number" min="1" max="31" bind:value={corteTarjeta} /></label>
                </div>
            </section>

            {#if error}<p class="error">{error}</p>{/if}

            <div class="acciones">
                <button class="cancelar" onclick={onCerrar} disabled={guardando}>Cancelar</button>
                <button class="confirmar" onclick={guardar} disabled={guardando}>
                    {guardando ? 'Guardando…' : 'Guardar'}
                </button>
            </div>
        {/if}
    </div>
</div>

<style>
.fondo {
    position: fixed; inset: 0; background: rgba(0, 0, 0, 0.45);
    display: flex; align-items: flex-start; justify-content: center;
    padding: 2em 1.5em; overflow-y: auto; z-index: 1100;
}
.panel {
    background: #fff; border-radius: 1.2em; padding: 2em; width: 100%; max-width: 34em;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}
h3 { margin: 0 0 1.5em; color: var(--violeta2); }
h4 { margin: 0 0 0.5em; color: #374151; font-size: 1em; }
section { border-top: 1px solid #ececec; padding-top: 1.3em; margin-top: 1.3em; }
section:first-of-type { border-top: none; margin-top: 0; padding-top: 0; }
.ayuda { color: #9ca3af; font-size: 0.85em; margin: 0 0 0.9em; }
.opciones { display: flex; flex-direction: column; gap: 0.5em; }
.opciones label { display: flex; align-items: center; gap: 0.6em; color: #374151; cursor: pointer; }
.dias { display: flex; gap: 1em; flex-wrap: wrap; }
.dias label { display: flex; flex-direction: column; gap: 0.3em; color: #6b7280; font-size: 0.88em; }
.dias input { width: 5em; padding: 0.5em; border: 2px solid #e5e7eb; border-radius: 0.6em; font-size: 1em; }
.error { color: #dc2626; font-size: 0.92em; }
.acciones { display: flex; gap: 0.8em; justify-content: flex-end; margin-top: 1.8em; }
.acciones button { border-radius: 2em; padding: 0.7em 1.4em; font-size: 1em; cursor: pointer; border: none; }
.cancelar { background: #fff; border: 1.5px solid #e0e0e0; color: var(--violeta2); }
.confirmar { background: var(--violeta2); color: #fff; font-weight: 600; }
.confirmar:disabled, .cancelar:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
