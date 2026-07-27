# Diseño — Buscador de canales en "Ayudame a elegir" (TV)

**Fecha:** 2026-07-27
**Objetivo:** Agregar al recomendador de TV (`AyudameElegirTv.svelte`) una cuarta pregunta
opcional — *"¿Te interesa algún canal en especial?"* — con un input de búsqueda por
coincidencia parcial sobre las grillas de los 3 servicios. Muestra la disponibilidad del
canal en cada servicio y **filtra la recomendación**: un servicio que no tiene el canal
pedido queda descartado.

## Concepto

- La pregunta es **opcional**. Vacía, el recomendador se comporta exactamente como hoy.
- Las 3 preguntas actuales (TV, 13 y TN, Full HD) siguen siendo las que habilitan la
  recomendación; el canal es un filtro extra.
- Coincidencia **parcial y sin acentos**: escribir `espn` matchea ESPN, ESPN 2, 3 y 4.
  Un servicio califica si **alguno** de sus canales matchea.
- Es coincidencia por substring, con lo que eso implica: `tn` matchea "TNT". Se asume
  aceptable porque los canales que matchearon se listan siempre debajo del input, así que
  el usuario ve exactamente qué se contó como coincidencia.
- `AyudameElegirTv` se usa en `/tv/elegirtv` (vía `TvServicesSection`) y en el paso 4 del
  wizard (`Step4TV`). La funcionalidad aparece en los dos lugares sin trabajo extra.

## Decisiones de diseño

| Decisión | Elegido | Descartado |
|---|---|---|
| Rol del canal | Filtra la recomendación | Solo informativo |
| Resolución de la búsqueda | Texto libre, califica con cualquier coincidencia | Elegir de una lista de sugerencias |
| Canales de adicionales pagos | Disponible, avisando "con adicional Cine" | Ocultarlos / no distinguirlos |
| Sin servicio que cumpla todo | Avisar y mostrar las alternativas parciales | Fallback silencioso a DGO |

## Datos

Las 3 grillas comparten shape `{ categoria, nombre, url_logo }`:

| Servicio | JSON | Canales |
|---|---|---|
| Gigared Play | `gigaredplay-channels.json` | 77 |
| Antina Play | `antina-channels.json` | 92 (79 base + 13 en "Adicional CINE") |
| DGO | `dgo-channels.json` | 123 |

`dgo-lite-channels.json` **no** entra: es de `/dgo-total`, otro producto.

### Detección de canales de adicionales pagos

No se agrega dato nuevo. `tvData.js` ya lo expresa:

```js
grilla: { categoryPrices: { 'Adicional CINE': 'antina_cine' } }
addons: [{ key: 'cine', field: 'antina_cine', label: 'Cine' }]
```

La cadena es **categoría → campo de precio → addon**: si la categoría de un canal es
clave de `grilla.categoryPrices`, ese canal es de un adicional pago, y el label a mostrar
sale del addon cuyo `field` coincide. Si mañana agregan otra categoría paga, funciona sin
tocar código.

### Cambio de apoyo en `tvData.js`

Declarar explícitamente la grilla de DGO:

```js
grilla: { type: 'channelgrid', channels: dgoChannels }
```

Hoy está implícita en el default de `ChannelGrid.svelte` (`import defaultChannels from
'$lib/data/dgo-channels.json'`). Sin esto el buscador no ve la grilla de DGO. No cambia
nada de lo que se renderiza: `GrillaViewer` pasa a mandar el mismo array que antes venía
por default.

## Estructura de archivos

```
src/lib/components/tv/
├── tvRecomendador.js         # NUEVO — lógica pura: búsqueda + elección de servicio
├── tvRecomendador.test.js    # NUEVO — tests del módulo
├── ChannelSearch.svelte      # NUEVO — input + resultados por servicio
├── AyudameElegirTv.svelte    # MOD — 4ta pregunta, filtro y estado "sin match"
└── tvData.js                 # MOD — grilla de DGO explícita
```

Sigue el patrón del repo: lógica pura en `.js` con `.test.js` al lado
(`data.js`/`data.test.js`, `visibility.js`/`visibility.test.js`, `encuestaBajaLogic.js`).

**Un solo módulo, no dos.** La búsqueda de canales existe únicamente para alimentar la
decisión del recomendador, y el caso "ningún servicio cumple con todo" cruza canal con
cantidad de TV: separarlos dejaría ese caso —el más delicado— sin poder testearse en
aislamiento. `AyudameElegirTv` queda como componente de presentación: recolecta las
respuestas y renderiza lo que el módulo decide.

## Módulo `tvRecomendador.js`

Sin dependencias de Svelte ni de UI. Reexporta `normalizar` (minúsculas + `NFD` sin
diacríticos), la misma normalización que ya usa `ChannelGrid.svelte`.

```js
buscarCanales(termino) → [
  {
    key: 'antina',
    label: 'Antina Play',
    matches: [{ nombre: 'HBO', categoria: 'Adicional CINE', addonLabel: 'Cine' }, …],
    disponible: true,      // matches.length > 0
    soloAdicional: true    // todas las coincidencias son de un adicional pago
  },
  …
]
```

- Término de menos de **2 caracteres** (ya trimmeado) → devuelve los 3 servicios con
  `matches: []` y `disponible: false`, y el llamador lo interpreta como "sin filtro".
- `addonLabel` es `null` para canales incluidos en el precio base.
- El orden de los servicios es el de `TV_SERVICES` (del más barato al premium).

Helper adicional `hayAlgunaCoincidencia(resultados)` → `boolean`, para distinguir "el
término no existe en ninguna grilla" de "existe pero choca con las otras respuestas".

### `elegirServicio({ tv, tn13, fullhd, canal })`

Segunda función exportada. Concentra lo que hoy está disperso en el componente (`CAPS`,
`ORDER`, `recoKey`, `recoReason`) más los dos casos nuevos. Devuelve:

```js
{
  recoKey: 'antina' | null,     // null = ningún servicio cumple con todo
  motivo: 'Es el más económico que tiene ESPN.',
  canalIgnorado: false,         // true = el término no existe en ninguna grilla (caso 1)
  alternativas: [               // solo cuando recoKey es null (caso 2)
    { key: 'antina', tiene: 'tiene HBO', pero: 'llega a 2 TV' },
    …
  ]
}
```

El tope de TV sale de `TV_SERVICES[].devices.maxTv` (fuente única con las features); las
capacidades `tn13` / `fullHd` son la traducción de las features a booleanos y viven en el
módulo, como hoy viven en el componente.

## Componente `ChannelSearch.svelte`

Props: `value` (bindable), `resultados`.

- `<input type="search">` con placeholder `Ej: ESPN, Disney, HBO…`.
- Debajo, mientras el término tenga ≥ 2 caracteres, una fila por servicio:
  logo + nombre + ✓/✗ + hasta **3** canales que matchearon, y `y N más` si hay resto.
- Coincidencias de adicional pago → chip `con adicional Cine`.
- Sin debounce: son 292 canales en total, el filtro es sincrónico e instantáneo.

## Filtro en la recomendación

`ok(key)` suma una condición: si hay filtro de canal activo, el servicio debe estar
`disponible`. El resto de la lógica (`maxTv`, `tn13`, `fullHd`) queda igual.

### Caso 1 — el término no matchea en ninguna grilla

Ej: `netflix`. **No filtra**: la recomendación sale de las otras 3 respuestas, como si el
campo estuviera vacío. Se muestra un aviso inline:

> No encontramos "netflix" en ninguna de las 3 grillas. Puede ser que esté con otro
> nombre — mirá cada grilla completa: [Gigared Play] [Antina Play] [DGO]

Cada nombre abre el `GrillaViewer` de ese servicio. Bloquear el recomendador por un error
de tipeo sería peor que ignorar el filtro.

Requiere una prop nueva `onGrilla(key)` en `AyudameElegirTv`. Los dos consumidores ya
tienen el estado y el viewer montados, así que es una línea en cada uno:

- `TvServicesSection.svelte`: `onGrilla={(key) => (grillaKey = key)}`
- `Step4TV.svelte`: `onGrilla={(key) => (grillaKey = key)}`

### Caso 2 — el canal existe pero choca con las otras respuestas

Ej: 4 TV + HBO (DGO llega a 4 dispositivos pero no tiene HBO; Antina tiene HBO pero llega
a 2 TV). En lugar de la tarjeta de recomendación:

> **Ningún servicio cumple con todo**
> - **Antina Play** — tiene HBO, pero llega a 2 TV · [Ver Antina Play]
> - **DGO** — llega a 4 dispositivos, pero no tiene HBO · [Ver DGO]

Se listan **hasta 2** servicios, los que fallan **una sola** condición, en el orden de
`TV_SERVICES`. Si ninguno falla una sola condición, se muestran los que tienen el canal.
Cada uno con su botón `Ver <servicio>`, que usa el mismo `onPick` que la tarjeta de
recomendación: el usuario decide qué resigna.

Esto además corrige un bug actual: hoy `ORDER.find(ok) ?? 'dgo'` recomienda DGO aunque no
cumpla lo pedido.

## Motivo de la recomendación

Cuando el canal es el que define la elección, entra en `motivo`. Con el canal pedido
presente y algún servicio más barato descartado por no tenerlo:

> Es el más económico que tiene ESPN.

Si la coincidencia es solo de un adicional pago, se aclara en la misma línea:

> Tiene HBO con el adicional Cine.

En ambos textos se usa **el término tal cual lo escribió el usuario** (trimmeado), no el
nombre del canal que matcheó: un término puede matchear varios canales a la vez y elegir
uno para mostrar sería arbitrario.

## Testing — `tvRecomendador.test.js`

Sobre el módulo puro, con vitest (el proyecto ya corre 101 tests así).

**Búsqueda (`buscarCanales`):**

1. `espn` → los 3 servicios disponibles, con más de un match cada uno.
2. `hbo` → solo Antina, con `soloAdicional: true` y `addonLabel: 'Cine'`.
3. `publica` → matchea "TV Pública" (normalización sin acentos).
4. `HBO` en mayúsculas → mismo resultado que `hbo`.
5. Término vacío y de 1 carácter → sin filtro (los 3 con `matches: []`).
6. `netflix` → ningún servicio, y `hayAlgunaCoincidencia` en `false`.

**Elección (`elegirServicio`):**

7. Sin canal, 2 TV / sin 13 y TN / sin Full HD → `gigared` (no cambia el comportamiento actual).
8. Canal `espn` + 1 TV → `gigared`: el más barato que lo tiene.
9. Canal `trece` + 1 TV → `antina`: Gigared queda descartado por no tener el canal.
10. Canal `netflix` → `canalIgnorado: true` y recomienda por las otras 3 respuestas (caso 1).
11. 4 TV + canal `hbo` → `recoKey: null` y `alternativas` con Antina y DGO (caso 2).
12. `alternativas` nunca devuelve más de 2 entradas.

## Fuera de alcance

- Unificar nombres de un mismo canal entre grillas ("El Trece" / "eltrece").
- Chips de canales populares.
- Buscador de canales en las tarjetas o en el modal de servicio.
- La imagen `caraccteristicas y diferencias.png`, desactualizada por otro motivo.
