# Cartera: semáforo de recordatorio en la fila y tiempo relativo real

Fecha: 2026-08-05

## Problema

La lista de la Cartera obliga a abrir el detalle de un cliente para saber tres
cosas que deberían leerse de un vistazo:

1. **El recordatorio pendiente no se ve hasta que ya venció.** `alertasDe` solo
   emite la alerta `recordatorio` cuando `hoy >= fecha`. Un asesor que anotó
   «llamar el 12» no tiene forma de verlo el 10 ni el 11 sin abrir el cliente,
   que es justo cuando todavía puede prepararse.
2. **El chip de ticket nuevo dice «Tickets nuevos», en plural y sin contexto.**
   La alerta se deriva de `tickets.ultimo` contra `tickets_vistos_hasta`: es
   «hay algo posterior a tu última mirada», no un contador de tickets abiertos.
   El plural sugiere lo segundo.
3. **La columna de sincronización dice «recién» durante una hora entera.**
   `desdeCuando` tiene granularidad de horas (`horas < 1 → 'recién'`) y, peor,
   no es reactiva: se evalúa una sola vez al pintar la fila y nunca se vuelve a
   calcular, así que una pestaña abierta desde la mañana sigue diciendo lo
   mismo a la tarde.

Además la fila tiene desprolijidades de layout que se notan más al agregar un
chip: la columna del nombre no puede encogerse y un nombre largo empuja a las
demás.

## Alcance

Dentro:

- Una función nueva en `alertas.js` para el próximo recordatorio pendiente.
- Un módulo nuevo `relativo.js` para el tiempo relativo, con tests.
- Cambios de render y estilo en `Cartera.svelte`.

Fuera:

- `alertasDe` no cambia: sigue emitiendo `recordatorio` solo cuando venció.
- Los pesos de urgencia (`PESO`) no cambian.
- `ClienteDetalle.svelte` y `RecordatorioChip.svelte` no se tocan.

## Diseño

### 1. `proximoRecordatorio(recordatorios, hoy)` en `src/lib/cartera/alertas.js`

Función pura, sin red, del mismo tenor que `promosActivas`: recibe el array de
recordatorios pendientes (no el cliente) y las partes de hoy.

```
proximoRecordatorio(recordatorios, hoy)
  → null  si no hay ninguno con fecha parseable
  → { recordatorio, dias, estado }
```

- Ordena ascendente por fecha, igual que el bloque de recordatorios de
  `alertasDe`. Así el primero es el **vencido más viejo** si hay vencidos, y el
  **futuro más cercano** si no los hay. Un pendiente viejo es más urgente, no
  menos: mismo criterio que ya documenta `alertasDe`.
- `dias = diferenciaDias(hoy, fecha)`, negativo si ya pasó.
- `estado`: `'vencido'` si `dias < 0`, `'hoy'` si `dias === 0`, `'proximo'` si
  `dias > 0`.

Un solo recordatorio, no todos: la fila no gana nada con N chips iguales y el
detalle ya los muestra completos. Es la misma decisión que tomó `alertasDe`.

El store expone `proximoRecordatorioDe(cliente)`, que envuelve la llamada con
`recordatoriosDe(cliente.id)` y `hoyPartes()`, igual que hace hoy
`alertasDeCliente`.

### 2. Chip semáforo en `Cartera.svelte`

La lista **deja de renderizar** el chip que viene de `alertas` con
`tipo === 'recordatorio'` y en su lugar renderiza el chip semáforo, que sale de
`proximoRecordatorioDe`. Esto evita el chip duplicado cuando el recordatorio
está vencido (aparecería por las dos vías).

Contenido: `{texto} · {fecha corta}`, con la fecha en formato `15/9` (sin ceros
ni año, como `fmtCorta` de `RecordatorioChip`). Recortado a 14em con ellipsis,
igual que los chips de recordatorio y promo que ya existen.

Colores, todos reutilizados del panel — **cero paletas nuevas**:

| estado    | color                  | de dónde sale                          |
| --------- | ---------------------- | -------------------------------------- |
| `proximo` | `#d1fae5` / `#065f46`  | el verde de `.chip.recordatorio` actual |
| `hoy`     | `#fef3c7` / `#92400e`  | el ámbar de `mora_1`                    |
| `vencido` | `#fee2e2` / `#991b1b`  | el rojo de `mora_2`                     |

El color nunca es el único canal (regla que ya sigue el resto del componente):

- `title`: fecha completa `12/09/2026` más «vence hoy» / «hace N días» / «en N
  días».
- `sr-only`: «Recordatorio vencido:» / «Recordatorio para hoy:» /
  «Recordatorio próximo:» antes del texto.

**El chip verde no es una alerta.** No prende el borde de urgencia ni entra en
el filtro «Con alerta», porque nada de esto toca `alertasDe`: la alerta interna
sigue naciendo solo con vencidos. Un recordatorio para dentro de diez días es
información, no algo a atender hoy.

### 3. Chip de ticket

Pasa de `Tickets nuevos` a **`Ticket nuevo`** y suma un `title` con la fecha del
último ticket (`fechaLegible(cliente.tickets.ultimo.fecha, { conHora: true })`).
Se mantiene el azul `#dbeafe` / `#1e40af` y la clave `tickets` de `ETIQUETAS`.

### 4. Los chips coexisten

Un cliente puede mostrar simultáneamente mora vencida, ticket nuevo,
recordatorio y promo por vencer. **Ningún chip esconde a otro y no hay tope de
chips por fila.** El orden es solo de lectura, de más a menos urgente:

```
mora_2 · mora_1 · tickets · recordatorio · promo_venciendo · seguimiento · promo activa
```

Hoy el chip informativo de promo activa se renderiza **primero**, antes de las
alertas. Se invierte: lo urgente va a la izquierda.

Para que ese orden se cumpla hace falta resolverlo en los datos y no en el
template, porque el chip de recordatorio ya no sale del `{#each alertas}` sino
de `proximoRecordatorioDe`, y tiene que quedar **en el medio** de los otros.
El `$derived` `conAlertas` arma entonces una sola lista `chips` por cliente,
ordenada por un mapa `ORDEN` con las claves de arriba, donde el recordatorio y
la promo activa entran como items sintéticos junto a las alertas reales. El
template recorre esa lista y nada más. Así el orden vive en un solo lugar y no
repartido entre tres bloques del markup.

Consecuencia de layout: la zona de chips tiene que **envolver a una segunda
línea** (`flex-wrap: wrap`, que ya está) sin empujar ni recortar las otras
columnas. Con cuatro chips en una pantalla angosta va a pasar y tiene que verse
bien.

### 5. `src/lib/cartera/relativo.js` (nuevo)

```
desdeCuando(iso, ahora) → string
```

- `iso` vacío o no parseable → `'nunca'`.
- `< 1 min` → `'recién'`
- `< 60 min` → `hace N min`
- `< 24 h` → `hace N h`
- resto → `hace N d`

`ahora` entra por parámetro (milisegundos) para que sea testeable sin congelar
el reloj. Diferencias negativas (reloj del servidor adelantado) caen en
`'recién'`, que es lo correcto: nunca «hace -3 min».

Módulo propio y no dentro de `fechas.js` porque `fechas.js` tiene prohibido
construir `Date` a partir de strings de IspCube, y acá se hace `Date.parse`
sobre `sincronizado`, que lo escribe el propio navegador con `toISOString()`.
Son dos contratos distintos y conviene que no se mezclen.

Tests: los cuatro tramos, los bordes (59 s, 60 s, 59 min, 60 min, 23 h, 24 h),
entrada vacía, entrada basura y diferencia negativa.

### 6. Reloj reactivo

`Cartera.svelte` tiene `let ahora = $state(Date.now())` y un `setInterval` de
30 s montado en `onMount`, con su `clearInterval` en el cleanup. La fila usa
`desdeCuando(cliente.sincronizado, ahora)`.

Sin esto el punto 5 no sirve de nada: calcularía minutos correctos una sola vez
y la fila seguiría mostrando ese valor congelado. 30 s y no 60 s para que el
salto de «recién» a «hace 1 min» no se atrase hasta un minuto.

### 7. Pulido de la fila

- Columna del nombre a `minmax(0, 1fr)` con ellipsis: hoy un nombre largo no
  puede encogerse y empuja al resto de la grilla.
- Columna `sync` con `min-width` y alineada a la derecha, para que la columna
  quede pareja entre filas.
- `:focus-visible` en `.fila`: hoy solo hay `:hover` y con teclado no se ve
  dónde estás parado.
- Mobile (`max-width: 700px`): en vez de apilar las cuatro celdas sueltas,
  agrupar nombre+código / puntos+sync / chips.

## Manejo de errores

No hay caminos nuevos de error. `proximoRecordatorio` devuelve `null` ante
cualquier entrada rara (array vacío, no-array, fechas sin forma de fecha) y la
fila simplemente no dibuja el chip. `desdeCuando` devuelve `'nunca'` ante
entrada no parseable, que es lo que ya hace hoy.

## Testing

- `alertas.test.js`: casos de `proximoRecordatorio` — sin recordatorios, uno
  futuro, uno hoy, uno vencido, varios vencidos (gana el más viejo), mezcla de
  vencido y futuro (gana el vencido), fecha basura.
- `relativo.test.js`: los tramos y bordes del punto 5.
- Verificación manual en el navegador: fila con los cuatro chips a la vez, y el
  wrap en viewport angosto.
