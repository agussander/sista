# Cartera — anotaciones desacopladas y recordatorios por cliente — diseño

## Contexto

Hoy, en el detalle de un cliente de la Cartera, el formulario de anotaciones tiene el tipo
`llamada` preseleccionado, y ese tipo decide algo que no tiene nada que ver con categorizar
la nota: si el tipo está en `TIPOS_CONTACTO` (`llamada`, `whatsapp`, `visita`), guardar la
nota escribe `ultimo_contacto` en el registro del cliente, y eso apaga la alerta de
seguimiento a los 2 meses.

Son dos problemas distintos con la misma causa:

1. Con `llamada` preseleccionado, guardar una nota interna sin fijarse en el selector apaga
   una alerta sin que nadie lo haya decidido.
2. Aunque no hubiera default, apagar la alerta sigue siendo un efecto lateral de elegir una
   etiqueta. El asesor no puede registrar una llamada *sin* apagar la alerta, ni apagarla sin
   escribir una nota.

Además, las cuatro alertas son fijas (`seguimiento`, `mora_1`, `mora_2`, `tickets`). No hay
forma de que un asesor se anote "llamar a este cliente el 15/09".

Este diseño cubre las tres cosas: sacar el default, desacoplar el apagado, y agregar
recordatorios puntuales por cliente.

## Alcance

Dentro:

- El tipo de anotación pasa a ser opcional y puramente descriptivo.
- Un botón explícito "Marcar contactado" junto a la alerta de seguimiento.
- Recordatorios por cliente con fecha y texto, que se encienden como una alerta más.
- Partir `ClienteDetalle.svelte` en tres componentes.

Fuera:

- Reglas de alerta configurables a nivel cartera (por ejemplo "alertar a los N meses de la
  instalación" en vez de los 2 meses fijos). Se evaluó y se descartó para este ciclo.
- Notificaciones fuera de la app (mail, push) cuando vence un recordatorio.
- Recordatorios recurrentes.

---

## 1. Anotaciones: el tipo es solo una etiqueta

### Comportamiento

- `tipo` arranca **vacío**. Ningún botón activo al abrir el detalle.
- Los botones de tipo se comportan como toggle: click en el que ya está activo lo
  deselecciona y vuelve a "sin tipo".
- Guardar funciona con o sin tipo. Lo único obligatorio sigue siendo el texto.
- Una nota guardada sin tipo aparece en la bitácora sin chip de categoría, solo con la fecha
  y el texto.
- Elegir `llamada`, `whatsapp` o `visita` **no** apaga ninguna alerta.

### Cambios

`src/lib/cartera/alertas.js`

- Se elimina la constante exportada `TIPOS_CONTACTO`. Ya no hay ningún tipo de nota con
  significado especial.
- `alertasDe` sigue leyendo `cliente.ultimo_contacto` igual que hoy para la alerta de
  seguimiento. Lo que cambia es *quién* escribe ese campo (ver sección 2), no cómo se lee.

`carteraStore.svelte.js`

- `agregarNota(clienteId, tipo, texto)` deja de escribir `ultimo_contacto`. Queda como una
  única llamada: crear el registro en `cartera_notas`.
- Se borra el import de `TIPOS_CONTACTO`.
- `tipo` se manda como `''` cuando no se eligió ninguno.

`AnotacionesCliente.svelte` (componente nuevo, ver sección 5)

- `let tipo = $state('')`.
- `onclick={() => (tipo = tipo === t.value ? '' : t.value)}`.
- Desaparece el párrafo de ayuda `.ayuda` ("Cuenta como contacto: apaga la alerta de los 2
  meses." / "Nota interna: no apaga la alerta de los 2 meses."). Ya no describe nada real.
- En la bitácora, el chip de tipo se renderiza solo si `n.tipo` tiene valor.

### PocketBase

`cartera_notas.tipo` está declarado `required: true`. La colección **ya existe en
producción**, y `scripts/crear-colecciones-cartera.js` es idempotente por colección: saltea
las que ya están, así que volver a correrlo no cambia el campo. Hace falta un PATCH
explícito a la colección para pasar `tipo` a `required: false` (ver sección 6).

Hasta que ese PATCH corra, guardar una nota sin tipo falla con 400 desde PocketBase. El
cambio de schema es un prerrequisito del cambio de UI, no un paso opcional.

---

## 2. Marcar contactado

### Comportamiento

Cuando el cliente tiene la alerta `seguimiento` activa, junto a su chip en el detalle
aparece un botón **"Marcar contactado"**.

Al apretarlo se escribe `ultimo_contacto` con la fecha de hoy. La alerta se apaga sola por
reactividad: el chip sale de `carteraStore.alertasDeCliente(actual)`, que deriva de
`carteraStore.clientes`, y el store reemplaza el registro después del update.

El botón solo existe mientras la alerta está encendida. Una vez apagada, desaparece junto
con el chip.

No hay "deshacer". Si se marcó por error, el camino es crear un recordatorio (sección 3),
que es lo que el asesor realmente quiere en ese caso: volver a tener el cliente en el radar
en una fecha concreta.

### Cambios

`carteraStore.svelte.js`

```js
/**
 * Marca al cliente como contactado hoy: apaga la alerta de seguimiento.
 *
 * Es el reemplazo explícito del efecto lateral que tenía `agregarNota` cuando
 * el tipo de nota caía en TIPOS_CONTACTO.
 */
async function marcarContactado(cliente) { … }
```

Escribe `{ ultimo_contacto: hoyISO() }` y reemplaza el registro en `clientes`, mismo patrón
que `marcarTicketsVistos`. Devuelve `true`/`false` según haya podido guardar.

`ClienteDetalle.svelte`

- Estado propio `errorAlerta = $state('')`, separado del `error` del bloque de anotaciones
  (que se muda a otro componente).
- Si el update falla, se muestra ese mensaje al lado del chip y la alerta **queda
  encendida**: es el lado seguro del error, igual que el `catch` que hoy tiene
  `agregarNota` para `ultimo_contacto`.

---

## 3. Recordatorios: modelo de datos

### Colección `cartera_recordatorios`

| Campo | Tipo | Notas |
|---|---|---|
| `cliente` | relation → `cartera_clientes` | required, `maxSelect: 1`, `cascadeDelete: true` |
| `autor` | relation → `users` | required, `maxSelect: 1`, `cascadeDelete: false` |
| `fecha` | text | required, `YYYY-MM-DD` |
| `texto` | text | required |
| `hecho` | bool | |
| `created` / `updated` | autodate | |

Reglas de API idénticas a `cartera_notas`:
`@request.auth.id != "" && cliente.asesor = @request.auth.id` en las cinco.

`fecha` es text con formato `YYYY-MM-DD`, no un campo `date` de PocketBase, por consistencia
con `fecha_instalacion` y `ultimo_contacto`: todo el módulo `src/lib/cartera/fechas.js`
compara fechas como partes año/mes/día en hora local, y meter un `date` (que PocketBase
serializa en UTC) reintroduciría el problema de zona horaria que ese módulo existe para
evitar.

### Por qué una colección y no dos campos en el cliente

Se evaluó denormalizar el próximo recordatorio en el registro del cliente, como ya se hace
con `ultimo_contacto`. Se descartó:

- `ultimo_contacto` está denormalizado porque calcularlo desde `cartera_notas` costaría **una
  consulta por fila** y la lista muestra hasta 500 clientes. Los recordatorios pendientes se
  traen en **una sola consulta** para toda la cartera, así que ese costo no aplica.
- Una copia hay que mantenerla sincronizada al crear, completar y borrar. Una copia
  desactualizada muestra una alerta fantasma sobre un recordatorio que ya se completó.
- Un recordatorio completado queda como historial (`hecho = true`) en vez de borrarse.

En la práctica se espera **un recordatorio activo por cliente**. La colección no está para
soportar muchos; está para no tener que sincronizar una copia. Que soporte varios es una
consecuencia, y el diseño la maneja sin UI especial.

### Estado en el store

```js
// clienteId -> array de recordatorios pendientes, ordenados por fecha ascendente.
let recordatorios = $state(new Map());
```

Se puebla en `cargar()`, después de los clientes, con una sola consulta:

```js
pb.collection(RECORDATORIOS).getList(1, 500, { filter: 'hecho = false', sort: 'fecha' })
```

No hace falta filtrar por asesor en el `filter`: la `listRule` de la colección ya limita el
resultado a los clientes del asesor autenticado. Es la misma propiedad de la que depende
`notasDe`.

Si la consulta falla, el `catch` deja el Map vacío y loguea. La cartera funciona sin
recordatorios; no es motivo para romper la carga entera.

Funciones nuevas: `crearRecordatorio(clienteId, fecha, texto)`,
`completarRecordatorio(recordatorio)`, y un getter `recordatoriosDe(clienteId)`. Todas
actualizan el Map reasignándolo (`recordatorios = new Map(recordatorios)`) para que la
reactividad llegue a la lista.

### Cálculo de la alerta

`alertasDe` gana un cuarto parámetro y sigue siendo pura:

```js
export function alertasDe(cliente, hoy, config, recordatorios = []) { … }
```

Emite **una sola** alerta `recordatorio`, no una por recordatorio vencido:

```js
const vencidos = recordatorios
  .map((r) => ({ r, partes: partesFecha(r.fecha) }))
  .filter(({ partes }) => partes && compararFechas(hoy, partes) >= 0);

if (vencidos.length > 0) {
  const primero = vencidos.sort((a, b) => compararFechas(a.partes, b.partes))[0].r;
  alertas.push({ tipo: 'recordatorio', desde: primero.fecha, texto: primero.texto });
}
```

Un recordatorio con `fecha` sin parsear (`partesFecha` devuelve `null`) se ignora, igual que
hace el resto del módulo con las fechas inválidas.

Un recordatorio vencido sigue encendido hasta que alguien lo marque hecho. No se apaga solo
con el paso del tiempo: un pendiente viejo es *más* urgente, no menos.

El default `= []` mantiene compatible cualquier llamada existente y hace que los tests que
no miran recordatorios no necesiten cambios.

`carteraStore.alertasDeCliente(cliente)` pasa `recordatorios.get(cliente.id) ?? []`.

---

## 4. Recordatorios: interfaz

### En el detalle del cliente

Un bloque propio **entre Pagos y Anotaciones**. El orden cuenta: recordatorios miran al
futuro, anotaciones al pasado.

Contiene:

- Un formulario: input `type="date"` + input de texto → "Agregar recordatorio". Ambos
  obligatorios; el botón queda deshabilitado hasta que estén los dos.
- La lista de pendientes, ordenada por fecha. Los vencidos se destacan (mismo amber que las
  alertas de mora). Cada uno con un botón "Hecho" que lo completa y lo saca de la lista.
- Si no hay ninguno, una línea gris "Sin recordatorios pendientes."

La fecha se puede poner en el pasado sin que el formulario se queje: el asesor puede estar
cargando algo que quedó pendiente de antes, y en ese caso la alerta se enciende de
inmediato, que es lo correcto.

### Chip de alerta

En el detalle y en la lista aparece un chip `recordatorio`. En el detalle muestra el texto
completo; en la lista, el texto recortado por CSS con el completo en el `title` — es más útil
que una etiqueta genérica cuando casi siempre hay uno solo.

Color propio, distinto de los cuatro existentes (verde/teal): el recordatorio lo puso el
asesor, no lo dedujo el sistema, y eso vale la pena distinguirlo de un vistazo.

### En la lista

- `PESO.recordatorio = 2`, igual que `tickets`. El asesor lo puso a propósito, pesa más que
  el seguimiento automático.
- Filtro nuevo `{ value: 'recordatorio', label: 'Recordatorios' }`. Cae en la rama genérica
  que ya existe (`alertas.some((a) => a.tipo === filtro)`), no necesita caso especial.
- `ETIQUETAS.recordatorio` para el chip de la fila.

---

## 5. Estructura de componentes

`ClienteDetalle.svelte` tiene hoy 359 líneas y este diseño le suma un bloque entero. Se parte
en tres:

| Archivo | Responsabilidad |
|---|---|
| `ClienteDetalle.svelte` | Armazón del modal: header, chips de alerta + botón de contactado, `dl` de datos, bloque de Pagos, footer. Monta los dos componentes de abajo. |
| `RecordatoriosCliente.svelte` | Bloque de recordatorios: formulario, lista de pendientes, completar. |
| `AnotacionesCliente.svelte` | Bloque de anotaciones: selector de tipo, textarea, guardar, bitácora. |

Los dos hijos reciben `{ cliente }` por props y hablan con `carteraStore` directamente, igual
que hace hoy `ClienteDetalle`. Cada uno maneja su propio estado de carga y error; hoy
`cargandoNotas`, `guardando` y `error` viven en el mismo componente que los datos de IspCube,
y no tienen nada que ver entre sí.

Es un refactor acotado a lo que este trabajo toca. No se reorganiza `Cartera.svelte` ni nada
más del módulo.

---

## 6. Script de colecciones

`scripts/crear-colecciones-cartera.js` suma:

1. La creación de `cartera_recordatorios`, con el mismo helper `crear()` (idempotente: si ya
   existe, la saltea).
2. Un paso nuevo de **migración de campo**: leer `cartera_notas`, y si su campo `tipo` sigue
   con `required: true`, mandarle un PATCH con `required: false`. Idempotente: si ya está en
   `false`, no hace nada y lo dice. Es el primer paso del script que modifica una colección
   existente, así que va explicado y respeta `--dry-run`.
3. `cartera_recordatorios` en el bucle de verificación final, el que confirma que ninguna
   colección se puede listar sin autenticar (debe responder 403 o 404).

El encabezado del script dice "las tres colecciones"; pasa a cuatro.

---

## 7. Tests

`src/lib/cartera/alertas.test.js`:

- Se borra el `describe('TIPOS_CONTACTO')` completo (el único test que lo usa, al final del
  archivo) y `TIPOS_CONTACTO` del import de la línea 2.
- Bloque nuevo para `recordatorio`:
  - Un recordatorio con fecha anterior a hoy enciende la alerta.
  - Un recordatorio con fecha de hoy la enciende (el borde es `>=`).
  - Un recordatorio con fecha futura no la enciende.
  - Dos vencidos producen **una** alerta, con el `texto` y el `desde` del más viejo.
  - Un recordatorio con `fecha` inválida o vacía se ignora sin romper.
  - Llamar a `alertasDe` sin el cuarto argumento sigue funcionando y no emite `recordatorio`.

Las alertas existentes ya tienen cobertura y no cambian de comportamiento; sus tests no se
tocan.

No hay tests de componentes en el proyecto, así que las secciones 1, 2, 4 y 5 se verifican a
mano en el navegador.

---

## Orden de implementación

El PATCH de schema es prerrequisito de la sección 1, y la colección nueva lo es de la 3.

1. Script: PATCH de `cartera_notas.tipo` + colección `cartera_recordatorios`. Correr contra
   PocketBase.
2. `alertas.js`: sacar `TIPOS_CONTACTO`, agregar el parámetro `recordatorios` y la alerta.
   Tests.
3. Store: `marcarContactado`, sacar el efecto lateral de `agregarNota`, cargar y manejar
   recordatorios.
4. Partir `ClienteDetalle.svelte` en tres, sin cambiar comportamiento.
5. UI: tipo opcional en anotaciones, botón de contactado, bloque de recordatorios.
6. `Cartera.svelte`: chip, peso y filtro.

Los pasos 1–3 son el corazón y se pueden verificar con tests. Del 4 en adelante es interfaz.
