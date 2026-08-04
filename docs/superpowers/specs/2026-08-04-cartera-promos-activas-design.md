# Cartera — promos activas y alerta de vencimiento — diseño

## Contexto

IspCube asocia las promociones a la **conexión** de un cliente, no al cliente en sí: cada
elemento de `connections[]` (en la respuesta de `GET /api/customer`, que el sync ya pide hoy)
trae `promotion_id`, `promotion_start_date`, `promotion_end_date` y un objeto `promotion`
anidado con `name` y `bill_detail`. Un cliente puede tener más de una conexión (por ejemplo
internet + TV) con promos distintas.

Sondeo real contra el cliente `012377` (dos conexiones, dos promos activas) confirmó la forma
exacta de estos campos — ver sección 1. No hay ningún endpoint de catálogo de promociones
documentado en `docs/ispcube-api.md`; todo lo necesario viaja embebido en la conexión.

Hoy la Cartera no tiene ningún concepto de "promo". Este diseño agrega dos cosas:

1. Mostrar las promos activas de cada cliente.
2. Una alerta cuando una promo activa está por vencer.

Sigue el mismo patrón que las alertas existentes (`seguimiento`, `mora_1`, `mora_2`,
`tickets`, `recordatorio`): cómputo puro en `alertas.js`, snapshot en PocketBase, chip en la
lista, sección en el detalle.

## Alcance

Dentro:

- Extracción de promos por conexión en `normalizarCliente`.
- Campo nuevo `promos` en `cartera_clientes`.
- Alerta `promo_venciendo` cuando falten ≤15 días para el vencimiento de una promo activa.
- Chip informativo "Promo" (sin relación con la urgencia) para cualquier cliente con al menos
  una promo activa.
- Sección de solo lectura "Promos activas" en el detalle del cliente.

Fuera:

- CRUD de promos: son 100% derivadas de IspCube, ningún asesor las carga ni las edita.
- Ventana de aviso configurable. Queda fija en 15 días.
- Cambios al contrato de `/api/cartera/sync` o a la cuota de IspCube: la data ya viaja en la
  respuesta que se usa hoy.
- Interpretar `value`/`months`/`unlimited`/`type` de la promoción para armar un texto de
  beneficio calculado. Esos campos no están documentados y su semántica no está confirmada;
  se usa `bill_detail`, que ya viene en texto legible.

---

## 1. Forma de los datos (IspCube)

Fragmento real de una conexión con promo activa (cliente `012377`, `GET /api/customer`):

```json
{
  "id": 35914,
  "plan_id": 27,
  "delete_date": null,
  "deleted_in_provider": 0,
  "promotion_id": 63,
  "promotion_start_date": "2026-09-01 00:00:00",
  "promotion_end_date": "2026-10-31 23:59:59",
  "plan": { "id": 27, "name": "Servicio de Internet basico POWER F131" },
  "promotion": {
    "id": 63,
    "name": "PROMOCION CHEQUE CARGO CONEXION",
    "bill_detail": "Bonificacion Cargo Conexión",
    "value": "10000.00",
    "months": 2
  }
}
```

Sin `promotion_id` (conexión sin promo), `promotion_id`/`promotion_start_date`/
`promotion_end_date` vienen `null` y no hay clave `promotion`.

`GET /api/connection?code=` devuelve el mismo array de conexiones con la misma forma (el doc
existente decía "una conexión" en singular; el sondeo mostró que es una lista). No hace falta
tocarlo: el sync ya usa `getCustomerByCode`, que trae `connections[]` embebido en el cliente.

## 2. `normalizarCliente`: extracción

`src/lib/cartera/normalizar.js` gana la extracción de `promos` a partir de
`crudo.connections`:

```js
/**
 * @param {any} crudo
 * @returns {{conexion_id: number, plan_nombre: string, promo_nombre: string,
 *   beneficio: string, inicio: string, fin: string}[]}
 */
function promosDe(crudo) {
  const conexiones = Array.isArray(crudo?.connections) ? crudo.connections : [];
  return conexiones
    .filter((c) => c?.promotion_id && !c?.delete_date && !c?.deleted_in_provider)
    .map((c) => ({
      conexion_id: c.id,
      plan_nombre: typeof c.plan?.name === 'string' ? c.plan.name : '',
      promo_nombre: typeof c.promotion?.name === 'string' ? c.promotion.name : '',
      beneficio: typeof c.promotion?.bill_detail === 'string' ? c.promotion.bill_detail : '',
      inicio: typeof c.promotion_start_date === 'string' ? c.promotion_start_date.slice(0, 10) : '',
      fin: typeof c.promotion_end_date === 'string' ? c.promotion_end_date.slice(0, 10) : ''
    }))
    .filter((p) => p.promo_nombre && p.fin);
}
```

Sin fecha de fin o sin nombre de promo no hay nada mostrable, así que se descarta ahí mismo
—no tiene sentido que llegue a `alertas.js` un registro que no se puede renderizar.

`normalizarCliente` suma `promos: promosDe(c)` a lo que ya devuelve. **Sin filtrar por
fecha**: guarda todas las promos con `promotion_id`, vigentes o no. La misma separación que ya
existe en el módulo — `normalizarCliente` extrae del JSON crudo, `alertas.js` decide qué está
vigente — se mantiene acá. Filtrar en el normalizador metería lógica de fechas en la capa que
hoy no la tiene, y la duplicaría con `alertas.js`.

## 3. PocketBase: campo nuevo

`scripts/crear-colecciones-cartera.js`, sección `cartera_clientes`, campos: se agrega
`json('promos')` junto a `json('pagos')` y `json('tickets')` (mismo tipo, mismo lugar). El
script es idempotente por colección — como con `cartera_notas.tipo` en el diseño anterior,
agregar un campo a una colección que ya existe en producción necesita el mismo tipo de PATCH
explícito, no alcanza con volver a correr `crear()`.

## 4. Cómputo: qué es "activa" y qué es "por vencer"

Nuevo helper en `src/lib/cartera/fechas.js`, mismo estilo que `sumarMeses` (sin `new Date()`):

```js
/**
 * Días de diferencia entre dos fechas (b - a), usando conteo de días
 * proléptico gregoriano. Puede dar negativo si b es anterior a a.
 *
 * @param {Partes} a
 * @param {Partes} b
 * @returns {number}
 */
export function diferenciaDias(a, b) { … }
```

Nuevo helper en `src/lib/cartera/alertas.js`, exportado junto a `alertasDe`:

```js
/** Días de aviso antes del vencimiento de una promo. */
const DIAS_AVISO_PROMO = 15;

/**
 * Promos activas: `fin` todavía no pasó. El arranque futuro cuenta como
 * activa igual — así lo decidió Sista, algunas promos se cargan con
 * `promotion_start_date` del mes que viene desde el día de la instalación.
 *
 * Toma el array de promos directo (`cliente.promos`), no el cliente entero:
 * mismo criterio que `alertasDe` recibe `recordatorios` como array, no
 * `cliente.recordatorios`.
 *
 * @param {any[]} promos
 * @param {import('./fechas.js').Partes} hoy
 * @returns {any[]} Ordenadas por `fin` ascendente
 */
export function promosActivas(promos, hoy) {
  return (Array.isArray(promos) ? promos : [])
    .map((p) => ({ p, fin: partesFecha(p?.fin) }))
    .filter(({ fin }) => fin && compararFechas(hoy, fin) <= 0)
    .sort((a, b) => compararFechas(a.fin, b.fin))
    .map(({ p }) => p);
}
```

`alertasDe` gana un quinto parámetro y una sección nueva:

```js
export function alertasDe(cliente, hoy, config, recordatorios = [], promos = []) {
  …
  // --- Promo por vencer ---------------------------------------------------
  // Una sola alerta con la de vencimiento mas proximo, igual que recordatorio.
  const activas = promosActivas(promos, hoy);
  if (activas.length > 0) {
    const proxima = activas[0];
    const fin = partesFecha(proxima.fin);
    if (fin && diferenciaDias(hoy, fin) <= DIAS_AVISO_PROMO) {
      alertas.push({ tipo: 'promo_venciendo', desde: proxima.fin, texto: proxima.promo_nombre });
    }
  }

  return alertas;
}
```

`texto` es el nombre crudo de la promo, no una fecha ya formateada: `alertas.js` es una capa
de negocio pura, sin formato de fecha para mostrar (ninguna alerta existente lo hace hoy —
`recordatorio` guarda en `texto` lo que escribió el asesor tal cual, sin tocarlo). `desde` es
la fecha de fin sin formatear (`"2026-10-31"`). Formatear a `DD/MM/AAAA` para mostrar es tarea
de la UI, con `partesFecha` + armado manual (nunca `new Date(iso)`, por el mismo problema de
huso horario que ya documenta `fechas.js`) — mismo patrón que ya usa `fmtFecha` en
`RecordatorioChip.svelte`.

**Dos señales separadas, a propósito:**

- `promosActivas(promos, hoy)` es informativa. La usa la UI directo (chip "Promo" en la
  lista, sección del detalle) y **no** pasa por `alertasDe` salvo para derivar
  `promo_venciendo`. No suma a `urgenciaDe` ni aparece en el array de `alertas`.
- `promo_venciendo` sí es una alerta como cualquier otra: entra al array que devuelve
  `alertasDe`, participa en el peso de urgencia y en los filtros de la lista.

Esto evita que un cliente con una promo activa que vence en 8 meses aparezca con urgencia solo
por tener una promo — la urgencia es sobre "hay que hacer algo pronto", no sobre "tiene un
beneficio vigente".

`carteraStore.alertasDeCliente(cliente)` pasa el quinto argumento:
`alertasDe(cliente, hoyPartes(), config, recordatoriosDe(cliente.id), cliente.promos ?? [])`.
No hace falta estado nuevo en el store: a diferencia de `recordatorios` (colección separada,
CRUD del asesor), `promos` ya vive en el registro del cliente que el store ya tiene cargado.

## 5. Lista (`Cartera.svelte`)

Dos chips nuevos, mismo contenedor `.alertas` que ya mezcla los demás tipos:

- **`.chip.promo`**: aparece si `promosActivas(cliente.promos ?? [], hoy).length > 0`. A
  diferencia de las alertas, no necesita pasar por el store: `promosActivas` es pura y
  `cliente.promos` ya está en el registro que `Cartera.svelte` tiene cargado, así que se
  importa directo de `$lib/cartera/alertas.js` y se calcula en el mismo `$derived` que arma
  `conAlertas`, junto a `alertasDeCliente` y `urgenciaDe`. Texto truncado con el nombre
  completo en `title` (patrón de `recordatorio`). Color nuevo, no usado por ningún otro chip —
  cyan/teal (`#cffafe` / `#155e75`), para no repetir el verde de `recordatorio` (que significa
  "lo cargó el asesor", no aplica acá).
- **`.chip.promo_venciendo`**: sale del array `alertas`, mismo amber que `mora_1`
  (`#fef3c7` / `#92400e` — "atender pronto", no una falla ya consumada como `mora_2`). Muestra
  la etiqueta estática `ETIQUETAS.promo_venciendo`, igual que `mora_1`/`mora_2`/`tickets` (no
  `a.texto`: en la lista los system-deduced no llevan texto dinámico, a diferencia de
  `recordatorio`, que sí porque lo escribió el asesor). `title={a.texto}` para el nombre de la
  promo al pasar el mouse, mismo recurso barato que ya usa el chip de `recordatorio`. No hace
  falta formatear la fecha acá — `a.texto` es solo el nombre de la promo, sin fecha.

`Cartera.svelte` no tiene hoy un `hoyPartes()` local (no lo necesitaba). Para `promosActivas`
necesita uno — mismas tres líneas que ya están duplicadas en `RecordatorioChip.svelte` y
`carteraStore.svelte.js`. Una tercera copia sigue el patrón existente; no es objeto de este
diseño extraerlas a un solo lugar.

Cambios puntuales:

- `PESO.promo_venciendo = 2` (mismo peso que `tickets`/`recordatorio`: deducido por el sistema,
  pero no tan grave como una mora vencida).
- `ETIQUETAS.promo_venciendo = 'Promo por vencer'`.
- `FILTROS` suma `{ value: 'promo_venciendo', label: 'Promos por vencer' }`. Cae en la rama
  genérica (`alertas.some((a) => a.tipo === filtro)`), sin caso especial.

El chip `.promo` no tiene filtro propio: no es una alerta, filtrar por "tiene promo activa" no
está pedido y se puede agregar después si hace falta.

## 6. Detalle (`ClienteDetalle.svelte`)

- Rama nueva en el `{#each alertas as a}` para `promo_venciendo` (a diferencia de
  `mora_1`/`mora_2`/`tickets`, que usan la etiqueta estática de `ETIQUETA_ALERTA`, acá hace
  falta texto dinámico —qué promo, qué fecha— igual que pasa con `seguimiento`, que también
  tiene rama propia). El texto se arma en el componente: `a.texto` es el nombre de la promo,
  `a.desde` la fecha de fin sin formatear; se parsea con `partesFecha(a.desde)` y se arma
  `DD/MM/AAAA` a mano (mismo criterio que `fmtFecha` en `RecordatorioChip.svelte`, nunca
  `new Date(a.desde)` sobre una fecha de la API):

  ```svelte
  {:else if a.tipo === 'promo_venciendo'}
    <span class="chip promo_venciendo">{a.texto} vence el {fmtFecha(a.desde)}</span>
  ```

  `fmtFecha` es un helper local nuevo en `ClienteDetalle.svelte` (no existe ahí hoy — el `fmt`
  que sí existe usa `new Date(iso).toLocaleDateString(...)`, el mismo patrón riesgoso que
  `fechas.js` documenta y evita; no se reusa para esto). Mismo `DD/MM/AAAA` armado a mano que
  ya tiene `RecordatorioChip.svelte`, y se reusa también en la sección "Promos activas" de
  abajo, así que hay un solo `fmtFecha` para las dos.
- Sección de solo lectura nueva, entre "Pagos" y `AnotacionesCliente`: **sin componente
  propio** (no hay CRUD, es una lista de a lo sumo un par de items derivados de IspCube — un
  `PromosCliente.svelte` sería una capa sin trabajo real que justificarla). Mismo patrón visual
  que el bloque de Pagos (`<section class="bloque">`):

  ```svelte
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
  ```

  `activas` se deriva con `promosActivas(actual.promos ?? [], hoy)`, reusando el mismo `hoy`
  (`{anio, mes, dia}` armado desde `new Date()`) que el bloque `puntos` ya calcula un poco más
  arriba en este archivo — no hace falta una segunda fuente de "hoy" en el mismo componente. Si
  no hay ninguna promo activa, la sección no se renderiza (mismo criterio que el bloque de
  alertas).

## 7. Tests

`src/lib/cartera/fechas.test.js`:

- `diferenciaDias`: mismo día → 0; un día después → 1; un día antes → -1; cruce de mes/año.

`src/lib/cartera/alertas.test.js`:

- `promosActivas`: promo con `fin` futuro → activa; `fin` hoy → activa (borde `<=`); `fin`
  pasado → no activa; sin `promos` → `[]`; varias activas → ordenadas por `fin` ascendente.
- `alertasDe` con el parámetro `promos`: promo a 15 días exactos → enciende la alerta (borde
  inclusive); a 16 días → no la enciende; ya vencida → no la enciende (no es "activa"); dos
  promos activas → la alerta usa la de vencimiento más próximo; llamar sin el quinto argumento
  sigue funcionando y no emite `promo_venciendo` (compatibilidad con los tests existentes que
  no lo pasan).

`src/lib/cartera/normalizar.test.js`:

- `normalizarCliente` extrae `promos` de `connections[]`: conexión sin `promotion_id` →
  excluida; conexión con `delete_date` o `deleted_in_provider` → excluida; `connections`
  ausente o no-array → `promos: []`; conexión con promo completa → los seis campos mapeados
  correctamente (usando el fragmento real de la sección 1 como fixture).

No hay tests de componentes en el proyecto (igual que en el diseño de recordatorios): las
secciones 5 y 6 se verifican a mano en el navegador.

---

## Orden de implementación

1. `fechas.js`: `diferenciaDias` + test.
2. `normalizar.js`: `promosDe` / extracción en `normalizarCliente` + test.
3. Script: campo `promos` en `cartera_clientes`. Correr contra PocketBase (dry-run primero).
4. `alertas.js`: `promosActivas`, quinto parámetro de `alertasDe`, alerta `promo_venciendo` +
   tests.
5. `carteraStore.svelte.js`: pasar `cliente.promos` en `alertasDeCliente`.
6. `Cartera.svelte`: los dos chips, peso, etiqueta, filtro.
7. `ClienteDetalle.svelte`: rama de alerta + sección "Promos activas".

Los pasos 1–5 son el corazón y se verifican con tests. El 6 y 7 son interfaz, verificación
manual.
