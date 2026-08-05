# Cartera: semáforo de recordatorio y tiempo relativo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la fila de la Cartera muestre, sin abrir el detalle, el próximo recordatorio con su fecha y un semáforo verde/amarillo/rojo, un chip de ticket nuevo, y una marca de sincronización que envejece sola.

**Architecture:** Dos funciones puras nuevas (`proximoRecordatorio` en `alertas.js`, `desdeCuando` en un `relativo.js` nuevo), expuestas a la vista por el store, más un `$derived` en `Cartera.svelte` que arma una única lista ordenada de chips por cliente. Nada de esto toca `alertasDe`: el chip verde de un recordatorio futuro es informativo y no prende el borde de urgencia ni el filtro «Con alerta».

**Tech Stack:** SvelteKit 2 + Svelte 5 (runes: `$state`, `$derived`, `$derived.by`, `$effect`), Vitest, PocketBase.

**Spec:** `docs/superpowers/specs/2026-08-05-cartera-fila-semaforo-y-tiempo-relativo-design.md`

---

## Estructura de archivos

| Archivo | Responsabilidad |
| --- | --- |
| `src/lib/cartera/alertas.js` (modificar) | Suma `proximoRecordatorio()`. `alertasDe` NO cambia. |
| `src/lib/cartera/alertas.test.js` (modificar) | Suma un `describe('proximoRecordatorio')`. |
| `src/lib/cartera/relativo.js` (crear) | Solo `desdeCuando()`: cuánto hace que pasó un instante. |
| `src/lib/cartera/relativo.test.js` (crear) | Tramos y bordes de `desdeCuando`. |
| `carteraStore.svelte.js` (modificar) | Expone `proximoRecordatorioDe(cliente)`. |
| `Cartera.svelte` (modificar) | Lista de chips ordenada, chip semáforo, reloj reactivo, pulido de layout. |

Los tests van al lado del módulo (`*.test.js`), que es la convención del repo.

---

### Task 1: `proximoRecordatorio` en `alertas.js`

**Files:**
- Modify: `src/lib/cartera/alertas.js`
- Test: `src/lib/cartera/alertas.test.js`

- [ ] **Step 1: Escribir los tests que fallan**

Agregar al final de `src/lib/cartera/alertas.test.js`. Y en la primera línea del archivo, cambiar el import para que incluya la función nueva:

```js
import { alertasDe, diaCorteDe, promosActivas, proximoRecordatorio } from './alertas.js';
```

```js
describe('proximoRecordatorio', () => {
	const hoy = { anio: 2026, mes: 8, dia: 5 };

	it('sin recordatorios devuelve null', () => {
		expect(proximoRecordatorio([], hoy)).toBe(null);
	});

	it('uno futuro sale como proximo, con los dias que faltan', () => {
		const r = proximoRecordatorio([{ fecha: '2026-08-12', texto: 'Llamar' }], hoy);

		expect(r.estado).toBe('proximo');
		expect(r.dias).toBe(7);
		expect(r.recordatorio.texto).toBe('Llamar');
	});

	it('uno para hoy sale como hoy, con dias en 0', () => {
		const r = proximoRecordatorio([{ fecha: '2026-08-05', texto: 'Hoy' }], hoy);

		expect(r.estado).toBe('hoy');
		expect(r.dias).toBe(0);
	});

	it('uno pasado sale como vencido, con los dias en negativo', () => {
		const r = proximoRecordatorio([{ fecha: '2026-08-01', texto: 'Se paso' }], hoy);

		expect(r.estado).toBe('vencido');
		expect(r.dias).toBe(-4);
	});

	it('con varios vencidos gana el mas viejo', () => {
		// Mismo criterio que `alertasDe`: un pendiente viejo es mas urgente, no
		// menos.
		const r = proximoRecordatorio(
			[
				{ fecha: '2026-08-03', texto: 'El nuevo' },
				{ fecha: '2026-07-20', texto: 'El viejo' }
			],
			hoy
		);

		expect(r.recordatorio.texto).toBe('El viejo');
	});

	it('un vencido le gana a un futuro mas cercano en el calendario', () => {
		const r = proximoRecordatorio(
			[
				{ fecha: '2026-08-06', texto: 'Manana' },
				{ fecha: '2026-08-04', texto: 'Ayer' }
			],
			hoy
		);

		expect(r.recordatorio.texto).toBe('Ayer');
		expect(r.estado).toBe('vencido');
	});

	it('sin vencidos gana el futuro mas cercano', () => {
		const r = proximoRecordatorio(
			[
				{ fecha: '2026-09-01', texto: 'Lejos' },
				{ fecha: '2026-08-08', texto: 'Cerca' }
			],
			hoy
		);

		expect(r.recordatorio.texto).toBe('Cerca');
		expect(r.estado).toBe('proximo');
	});

	it('las entradas sin fecha usable se ignoran', () => {
		expect(proximoRecordatorio([{ fecha: '', texto: 'a' }, null, { texto: 'b' }], hoy)).toBe(null);
	});

	it('una entrada rota no tapa a una sana', () => {
		const r = proximoRecordatorio(
			[{ fecha: 'pronto', texto: 'Rota' }, { fecha: '2026-08-09', texto: 'Sana' }],
			hoy
		);

		expect(r.recordatorio.texto).toBe('Sana');
	});

	it('algo que no es un array no rompe', () => {
		// El store arma el array desde un Map; si alguna vez entrega otra cosa,
		// la lista entera no puede caerse por eso.
		expect(proximoRecordatorio(null, hoy)).toBe(null);
		expect(proximoRecordatorio('pronto', hoy)).toBe(null);
	});

	it('no muta el array que recibe', () => {
		// La lista la llama una vez por cliente en cada recalculo, sobre el array
		// que cachea el store: ordenarlo in situ le cambiaria el orden a la vista
		// del detalle.
		const original = [
			{ fecha: '2026-08-03', texto: 'El nuevo' },
			{ fecha: '2026-07-20', texto: 'El viejo' }
		];
		const copia = [...original];

		proximoRecordatorio(original, hoy);

		expect(original).toEqual(copia);
	});
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `npx vitest run src/lib/cartera/alertas.test.js`
Expected: FAIL. Los tests de `proximoRecordatorio` fallan con `TypeError: proximoRecordatorio is not a function` (o un error de import). Los de `alertasDe`, `diaCorteDe` y `promosActivas` siguen pasando.

- [ ] **Step 3: Implementar**

En `src/lib/cartera/alertas.js`, agregar la función después de `promosActivas` y antes de `alertasDe`:

```js
/**
 * El recordatorio pendiente que toca mirar primero, este vencido o no.
 *
 * A diferencia de la alerta `recordatorio` de `alertasDe` -que nace SOLO
 * cuando la fecha ya paso-, esta tambien devuelve los futuros: la fila de la
 * lista dibuja el chip con su fecha y un semaforo, para que el asesor vea
 * "llamar el 12" el dia 10 y no recien el 12.
 *
 * Que sea una funcion aparte y no un cambio en `alertasDe` es deliberado: un
 * recordatorio futuro NO es una alerta. Si entrara por `alertasDe` prenderia
 * el borde de urgencia y el filtro "Con alerta" para un cliente al que no hay
 * que hacerle nada hoy.
 *
 * Orden ascendente por fecha, mismo criterio que `alertasDe`: si hay vencidos
 * gana el mas viejo (un pendiente viejo es mas urgente, no menos); si no los
 * hay, gana el futuro mas cercano. Uno solo y no todos: la fila no gana nada
 * con N chips iguales, y el detalle ya los muestra completos.
 *
 * @param {any[]} recordatorios Recordatorios PENDIENTES (`hecho = false`)
 * @param {import('./fechas.js').Partes} hoy
 * @returns {{recordatorio: any, dias: number, estado: 'vencido' | 'hoy' | 'proximo'} | null}
 */
export function proximoRecordatorio(recordatorios, hoy) {
	const pendientes = (Array.isArray(recordatorios) ? recordatorios : [])
		.map((r) => ({ r, partes: partesFecha(r?.fecha) }))
		.filter(({ partes }) => partes !== null)
		// El .sort() cae sobre el array intermedio del .map, nunca sobre el que
		// entro por parametro.
		.sort((a, b) => compararFechas(a.partes, b.partes));

	if (pendientes.length === 0) return null;

	const { r, partes } = pendientes[0];
	const dias = diferenciaDias(hoy, partes);

	return {
		recordatorio: r,
		dias,
		estado: dias < 0 ? 'vencido' : dias === 0 ? 'hoy' : 'proximo'
	};
}
```

No hace falta tocar los imports del archivo: `partesFecha`, `compararFechas` y `diferenciaDias` ya vienen de `./fechas.js` en la cabecera.

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `npx vitest run src/lib/cartera/alertas.test.js`
Expected: PASS, todos los `describe` del archivo.

- [ ] **Step 5: Commit**

```bash
git add src/lib/cartera/alertas.js src/lib/cartera/alertas.test.js
git commit -m "feat(cartera): proximoRecordatorio devuelve el pendiente mas proximo, vencido o no"
```

---

### Task 2: `desdeCuando` en un módulo propio

**Files:**
- Create: `src/lib/cartera/relativo.js`
- Test: `src/lib/cartera/relativo.test.js`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/cartera/relativo.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { desdeCuando } from './relativo.js';

// Un instante fijo como "ahora" para todos los casos: la funcion lo recibe por
// parametro justamente para no tener que congelar el reloj del proceso.
const AHORA = Date.parse('2026-08-05T15:00:00.000Z');
const hace = (ms) => new Date(AHORA - ms).toISOString();

const SEGUNDO = 1000;
const MINUTO = 60 * SEGUNDO;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;

describe('desdeCuando', () => {
	it('sin fecha dice nunca', () => {
		expect(desdeCuando('', AHORA)).toBe('nunca');
		expect(desdeCuando(null, AHORA)).toBe('nunca');
		expect(desdeCuando(undefined, AHORA)).toBe('nunca');
	});

	it('una fecha que no se puede parsear dice nunca', () => {
		expect(desdeCuando('pronto', AHORA)).toBe('nunca');
	});

	it('hace menos de un minuto es recien', () => {
		expect(desdeCuando(hace(0), AHORA)).toBe('recién');
		expect(desdeCuando(hace(59 * SEGUNDO), AHORA)).toBe('recién');
	});

	it('al minuto pasa a minutos', () => {
		expect(desdeCuando(hace(MINUTO), AHORA)).toBe('hace 1 min');
	});

	it('cuenta minutos hasta los 59', () => {
		expect(desdeCuando(hace(5 * MINUTO), AHORA)).toBe('hace 5 min');
		expect(desdeCuando(hace(59 * MINUTO), AHORA)).toBe('hace 59 min');
	});

	it('a la hora pasa a horas', () => {
		expect(desdeCuando(hace(HORA), AHORA)).toBe('hace 1 h');
		expect(desdeCuando(hace(23 * HORA), AHORA)).toBe('hace 23 h');
	});

	it('al dia pasa a dias', () => {
		expect(desdeCuando(hace(DIA), AHORA)).toBe('hace 1 d');
		expect(desdeCuando(hace(9 * DIA), AHORA)).toBe('hace 9 d');
	});

	it('una fecha en el futuro es recien, no un numero negativo', () => {
		// Pasa cuando el reloj del servidor va adelantado respecto del navegador.
		expect(desdeCuando(hace(-5 * MINUTO), AHORA)).toBe('recién');
	});
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx vitest run src/lib/cartera/relativo.test.js`
Expected: FAIL con `Failed to resolve import "./relativo.js"`.

- [ ] **Step 3: Implementar**

Crear `src/lib/cartera/relativo.js`:

```js
/**
 * Cuanto hace que paso un instante, en la unidad mas grande que todavia se
 * lee bien.
 *
 * Vive aparte de `fechas.js` a proposito. Ese modulo tiene PROHIBIDO construir
 * un `Date` a partir de un string, porque las fechas de IspCube no documentan
 * su zona horaria y `new Date(str)` corre el dia. Aca la entrada es
 * `sincronizado`, que lo escribe el propio navegador con `toISOString()` (UTC,
 * con sufijo `Z`), asi que `Date.parse` es exacto. Son dos contratos distintos
 * y no conviene que compartan archivo.
 */

/**
 * @param {unknown} iso Instante ISO 8601 escrito por nosotros, o vacio
 * @param {number} ahora Milisegundos desde epoch (`Date.now()`)
 * @returns {string}
 */
export function desdeCuando(iso, ahora) {
	if (typeof iso !== 'string' || iso === '') return 'nunca';

	const ms = ahora - Date.parse(iso);
	// `Date.parse` de algo que no es una fecha da NaN, y NaN se propaga a `ms`.
	if (!Number.isFinite(ms)) return 'nunca';

	// Un `ms` negativo es el reloj del servidor adelantado respecto del
	// navegador, no un error: cae solo en "recien", que es lo que corresponde,
	// en vez de mostrar "hace -3 min".
	const minutos = Math.floor(ms / 60_000);
	if (minutos < 1) return 'recién';
	if (minutos < 60) return `hace ${minutos} min`;

	const horas = Math.floor(minutos / 60);
	if (horas < 24) return `hace ${horas} h`;

	return `hace ${Math.floor(horas / 24)} d`;
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npx vitest run src/lib/cartera/relativo.test.js`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/cartera/relativo.js src/lib/cartera/relativo.test.js
git commit -m "feat(cartera): desdeCuando con granularidad de minutos, en su propio modulo"
```

---

### Task 3: El store expone `proximoRecordatorioDe`

**Files:**
- Modify: `src/routes/admin/_components/mantenimiento/Dashboard/cartera/carteraStore.svelte.js`

Sin test: el store toca PocketBase y no está cubierto por tests en este repo. La lógica que sí se puede testear ya quedó cubierta en la Task 1.

- [ ] **Step 1: Cambiar el import de `alertas.js`**

Reemplazar la línea 11:

```js
import { alertasDe } from '$lib/cartera/alertas.js';
```

por:

```js
import { alertasDe, proximoRecordatorio } from '$lib/cartera/alertas.js';
```

- [ ] **Step 2: Agregar la función**

Justo debajo de `alertasDeCliente` (que termina en la línea 180), agregar:

```js
/**
 * El proximo recordatorio pendiente del cliente, vencido o no.
 *
 * Igual que `alertasDeCliente`, no se exporta suelta: se consume siempre como
 * `carteraStore.proximoRecordatorioDe(...)`.
 */
function proximoRecordatorioDe(cliente) {
	return proximoRecordatorio(recordatoriosDe(cliente.id), hoyPartes());
}
```

- [ ] **Step 3: Exportarla**

En el objeto `carteraStore` del final del archivo, agregar `proximoRecordatorioDe` justo después de `alertasDeCliente`:

```js
	refrescoFallido,
	alertasDeCliente,
	proximoRecordatorioDe
};
```

- [ ] **Step 4: Verificar que no rompió nada**

Run: `npx vitest run && npm run check`
Expected: los tests pasan. `npm run check` no debe reportar errores nuevos en `carteraStore.svelte.js` (puede haber avisos preexistentes en otros archivos del proyecto; comparar contra la salida de antes del cambio si hay dudas).

- [ ] **Step 5: Commit**

```bash
git add src/routes/admin/_components/mantenimiento/Dashboard/cartera/carteraStore.svelte.js
git commit -m "feat(cartera): el store expone proximoRecordatorioDe"
```

---

### Task 4: Lista de chips ordenada y chip semáforo en la fila

**Files:**
- Modify: `src/routes/admin/_components/mantenimiento/Dashboard/cartera/Cartera.svelte`

Esta es la tarea central. El chip de recordatorio deja de salir del `{#each alertas}` y pasa a salir de `proximoRecordatorioDe`, pero tiene que quedar **en el medio** de los otros chips en el orden de lectura. Por eso el orden se resuelve armando una única lista en el `$derived`, no repartido en tres bloques del markup.

- [ ] **Step 1: Agregar el import de `fechaLegible`**

Debajo de la línea 11 (`import { partesFecha } from '$lib/cartera/fechas.js';`), agregar:

```js
import { fechaLegible } from '$lib/cartera/tickets.js';
```

- [ ] **Step 2: Cambiar la etiqueta del chip de tickets**

En el objeto `ETIQUETAS`, cambiar:

```js
    tickets: 'Tickets nuevos',
```

por:

```js
    // Singular: la alerta nace de comparar `tickets.ultimo` contra
    // `tickets_vistos_hasta`, o sea "hay algo posterior a tu ultima mirada".
    // El plural sugeria un contador de tickets abiertos, que es otra cosa.
    tickets: 'Ticket nuevo',
```

- [ ] **Step 3: Agregar los helpers de formato y de orden**

Insertar despues del bloque `ETIQUETA_ESTADO_PUNTO` y antes de `function puntosDe(cliente)`:

```js
// Orden de lectura de los chips de una fila, de mas a menos urgente. Los chips
// COEXISTEN: un cliente con mora vencida, ticket nuevo, recordatorio y promo
// por vencer muestra los cuatro. Esto solo decide de izquierda a derecha,
// nunca esconde ninguno.
const ORDEN_CHIP = {
    mora_2: 0,
    mora_1: 1,
    tickets: 2,
    recordatorio: 3,
    promo_venciendo: 4,
    seguimiento: 5,
    promo: 6
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
```

- [ ] **Step 4: Cambiar el `$derived` `conAlertas`**

Reemplazar el bloque completo de `const conAlertas = $derived.by(...)` por:

```js
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
            chips: chipsDe(c, alertas, activas, proximo)
        };
    });
});
```

El comentario de arriba del `$derived` sigue valiendo, pero sus últimas líneas hablan de `promoTexto`, que ya no existe. Reemplazar esa parte (desde «`promoTexto` es informativo…» hasta el final del comentario) por:

```js
// `promosActivas` y `proximoRecordatorio` son informativos, no alertas: no
// pasan por `alertasDeCliente` ni suman a la urgencia. Un cliente con una promo
// que vence en 8 meses, o con un recordatorio para dentro de 10 dias, no tiene
// nada urgente por eso. Se calculan en el mismo derived que ya arma la lista
// para no recorrer los clientes tres veces.
```

`urgencia` sigue saliendo solo de `alertas`, así que el chip verde no prende el borde. `alertas` se conserva en el objeto porque lo usa el filtro `visibles` (líneas 101-111), que no se toca.

- [ ] **Step 5: Cambiar el template de la fila**

Ojo: el Step 3 insertó ~90 líneas, así que los números de línea del archivo original ya no sirven — buscar por contenido.

Reemplazar `{#each visibles as { cliente, alertas, urgencia, promoTexto } (cliente.id)}` por:

```svelte
            {#each visibles as { cliente, alertas, urgencia, chips } (cliente.id)}
```

Y reemplazar el bloque completo `<div class="alertas">…</div>` (el que hoy tiene el `{#if promoTexto}` y el `{#each alertas as a}`) por:

```svelte
                        <div class="alertas">
                            {#each chips as chip}
                                <span class="chip {chip.tipo} {chip.mod}" title={chip.titulo}>
                                    {#if chip.sr}<span class="sr-only">{chip.sr}</span>{/if}
                                    {chip.texto}
                                </span>
                            {/each}
                        </div>
```

- [ ] **Step 6: Cambiar los estilos de los chips**

Reemplazar el bloque de `.chip.recordatorio` (con su comentario de arriba, el que empieza «Verde: distinto de las cuatro alertas…») por:

```css
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
```

- [ ] **Step 7: Verificar**

Run: `npx vitest run && npm run check`
Expected: los tests pasan y `npm run check` no reporta errores nuevos.

Verificación visual (ver Task 6 para el arranque del server): abrir la Cartera y confirmar que un cliente con recordatorio futuro muestra el chip verde con la fecha, y que ese cliente **no** aparece bajo el filtro «Con alerta» ni tiene el borde izquierdo de urgencia.

- [ ] **Step 8: Commit**

```bash
git add src/routes/admin/_components/mantenimiento/Dashboard/cartera/Cartera.svelte
git commit -m "feat(cartera): chip semaforo del proximo recordatorio y orden por urgencia en la fila"
```

---

### Task 5: Reloj reactivo y `desdeCuando` importado

**Files:**
- Modify: `src/routes/admin/_components/mantenimiento/Dashboard/cartera/Cartera.svelte`

- [ ] **Step 1: Importar `desdeCuando` y borrar la copia local**

Agregar el import junto a los demás de `$lib/cartera/`:

```js
import { desdeCuando } from '$lib/cartera/relativo.js';
```

Y borrar la función local completa (la que está justo antes del `onMount`):

```js
function desdeCuando(iso) { … }
```

- [ ] **Step 2: Agregar el reloj y cambiar el `onMount`**

Reemplazar `onMount(() => carteraStore.cargar());` por:

```js
// El tiempo relativo de cada fila tiene que envejecer solo. Sin este reloj,
// `desdeCuando` se evalua una sola vez al pintar y una pestania abierta desde
// la maniana sigue diciendo lo mismo a la tarde.
//
// 30 s y no 60 s para que el salto de "recién" a "hace 1 min" no se atrase
// hasta un minuto entero.
let ahora = $state(Date.now());

onMount(() => {
    // El cuerpo con llaves no es cosmetico: `onMount(() => carteraStore.cargar())`
    // devolvia la Promise de `cargar`, y Svelte trata el valor de retorno de
    // `onMount` como la funcion de limpieza.
    carteraStore.cargar();

    const id = setInterval(() => (ahora = Date.now()), 30_000);
    return () => clearInterval(id);
});
```

`let ahora` va arriba, con el resto de los `$state` del componente (junto a `busqueda`, `filtro`, etc.); el `onMount` se queda donde está, al final del `<script>`.

- [ ] **Step 3: Pasar `ahora` en el template**

Reemplazar `{desdeCuando(cliente.sincronizado)}` (dentro del `<span class="sync">`) por:

```svelte
                            {desdeCuando(cliente.sincronizado, ahora)}
```

- [ ] **Step 4: Verificar**

Run: `npx vitest run && npm run check`
Expected: los tests pasan, sin errores nuevos en `check`.

Verificación en el navegador: apretar «↻ Actualizar», confirmar que la columna dice «recién», y **esperar poco más de un minuto sin recargar la página**: tiene que cambiar sola a «hace 1 min». Este es el punto de todo el task; si no cambia sola, el reloj no está funcionando.

- [ ] **Step 5: Commit**

```bash
git add src/routes/admin/_components/mantenimiento/Dashboard/cartera/Cartera.svelte
git commit -m "fix(cartera): la marca de sincronizacion envejece sola en vez de quedarse en 'recien'"
```

---

### Task 6: Pulido del layout de la fila

**Files:**
- Modify: `src/routes/admin/_components/mantenimiento/Dashboard/cartera/Cartera.svelte`

- [ ] **Step 1: Arreglar la grilla y el desbordamiento**

Reemplazar la regla `.fila` por:

```css
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
```

- [ ] **Step 2: Ellipsis en el nombre y columnas parejas**

Reemplazar `.quien`, `.alertas` y `.sync` por:

```css
.quien { display: flex; flex-direction: column; gap: 0.15em; min-width: 0; }
.quien strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* Los chips coexisten: mora + ticket + recordatorio + promo pueden estar los
   cuatro. Envuelven a una segunda linea antes que empujar o recortar las otras
   columnas. */
.alertas { display: flex; gap: 0.4em; flex-wrap: wrap; justify-content: flex-end; min-width: 0; }
.sync { color: #9ca3af; font-size: 0.8em; white-space: nowrap; min-width: 6.5em; text-align: right; }
```

- [ ] **Step 3: Reagrupar en mobile**

Reemplazar el bloque `@media (max-width: 700px)` completo por:

```css
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
```

- [ ] **Step 4: Verificar en el navegador**

Arrancar el server con la herramienta de preview (nunca con Bash). Si no existe `.claude/launch.json`, crearlo con:

```json
{
  "version": "0.0.1",
  "configurations": [
    { "name": "sista", "runtimeExecutable": "npm", "runtimeArgs": ["run", "dev"], "port": 5173 }
  ]
}
```

Nota del proyecto: el puerto que reporta la herramienta puede no ser el real — confirmarlo en `preview_logs`.

Chequear en la lista de la Cartera:
1. Un cliente con nombre largo recorta con «…» y no empuja las otras columnas.
2. Un cliente con cuatro chips a la vez los muestra los cuatro, envolviendo a segunda línea si hace falta.
3. En viewport de 375 px, la fila queda en tres bloques y nada se sale a la derecha.
4. Tabulando con el teclado se ve el contorno de foco en cada fila.

- [ ] **Step 5: Commit**

```bash
git add src/routes/admin/_components/mantenimiento/Dashboard/cartera/Cartera.svelte
git commit -m "style(cartera): fila que no se descuadra con nombres largos ni con cuatro chips"
```

---

## Verificación final

- [ ] `npx vitest run` — toda la suite en verde.
- [ ] `npm run check` — sin errores nuevos.
- [ ] En el navegador, un cliente con recordatorio **futuro**: chip verde con fecha, sin borde de urgencia, no aparece en el filtro «Con alerta».
- [ ] Un cliente con recordatorio **para hoy**: chip amarillo.
- [ ] Un cliente con recordatorio **vencido**: chip rojo, y ahí sí prende el borde de urgencia.
- [ ] Un cliente con mora + ticket + recordatorio + promo: los cuatro chips visibles, en ese orden.
- [ ] La marca de sincronización pasa sola de «recién» a «hace 1 min» sin recargar.
