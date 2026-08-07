# Cartera: lista en columnas, orden por alertas y paginación

**Fecha:** 2026-08-07
**Estado:** aprobado

## Problema

La lista de la Cartera es una pila de tarjetas altas. Cada fila es un `<button>`
con cuatro celdas (`quien`, `pagos`, `alertas`, `sync`), y las dos flexibles
crecen hasta ocupar todo el ancho disponible. El resultado es una columna larga
donde nada queda alineado entre filas: para comparar dos clientes hay que leer
cada tarjeta entera en vez de barrer una columna con la vista.

Además:

- **No hay orden.** La lista sale como viene de PocketBase (`sort: '-created'`,
  o sea por cuándo se sumó a la cartera), que no es ninguno de los dos órdenes
  que el asesor necesita: "qué tengo que atender hoy" y "quiénes son mis
  clientes nuevos".
- **No hay paginación.** Con hasta 500 clientes el scroll es interminable.
- **Faltan datos de contexto** que el asesor hoy tiene que ir a buscar al
  detalle: en qué ciudad vive, qué edad tiene, cuándo fue la última vez que
  alguien lo contactó.

## Diseño

### 1. Formato de tabla, nueve columnas

La `<ul>` de tarjetas pasa a ser una grilla con encabezado. Un solo contenedor
redondeado, filas separadas por una hairline, sin borde por tarjeta.

| Columna | Ancho | Contenido | Origen |
|---|---|---|---|
| Código | `4.4em` | `cliente.code`, tabular-nums | snapshot |
| Nombre | `minmax(0,1.5fr)` | Nombre + badges (`Nuevo`, `Instalado ✓`) + estado de instalación | snapshot |
| Edad aprox | `3.4em` | `~57`, estimado del DNI | **nuevo** (`doc_number`) |
| Ciudad | `6.4em` | `PUNTA LARA` → title case | **nuevo** (`ciudad`) |
| Conexiones | `7.6em` | Chips de `describirConexion` | snapshot |
| Contacto | `6em` | `hace 3 d` desde `ultimo_contacto` | snapshot |
| Pagos | `5em` | Los puntos de `puntosPorMes`, sin cambios | snapshot |
| Alertas | `minmax(0,1.7fr)` | Todos los chips actuales, en la misma celda | derivado |
| Alta | `5.4em` | `06/08/26` desde `start_date` (si falta, `created`) | snapshot |

El encabezado y las filas comparten la definición de columnas a través de una
custom property (`--cols`), para que no puedan desalinearse: hoy son dos reglas
distintas y basta con tocar una para que la tabla se corra.

**La fila sigue siendo un `<button>`** que abre `ClienteDetalle`, igual que hoy.
No se migra a `role="table"`: mezclar los roles de tabla con un botón que ocupa
toda la fila da un árbol de accesibilidad peor que la lista de botones actual,
que ya funciona con teclado y lector de pantalla. El encabezado es una fila
aparte de botones de orden.

**La urgencia deja de mover el layout.** Hoy es `border-left: 4px`, que cambia
el ancho del borde y por lo tanto el ancho de la fila. Pasa a
`box-shadow: inset 3px 0 0 <color>`, que pinta lo mismo sin ocupar espacio —
necesario para que todas las filas de la tabla arranquen en la misma columna,
tengan alerta o no.

### 2. Selección de texto en Nombre y Código

El asesor copia números de cliente todo el día. Dentro de un `<button>` eso hoy
no se puede: el navegador no deja seleccionar y el click abre el modal.

- Las celdas de código y nombre llevan `cursor: text; user-select: text`.
- El handler de la fila aborta si `window.getSelection().toString()` no está
  vacío. Sin esto, soltar el mouse al terminar de arrastrar cuenta como click y
  abre el detalle encima de lo que acabás de seleccionar.

### 3. Orden

#### Orden por defecto: `alertas`

Cuatro niveles de desempate, en este orden:

1. **Con alerta antes que sin alerta.** El criterio es `alertas.length > 0`, el
   mismo que ya usa el filtro "Con alerta". Un recordatorio verde (futuro) no
   entra acá: `proximoRecordatorio` es una función aparte de `alertasDe`
   justamente porque un recordatorio para dentro de 10 días no es una alerta.
   Un ticket nuevo sí, y la mora también.
2. **Urgencia: roja → amarilla → violeta.** Es `urgenciaDe()`, que ya existe y
   ya pinta el borde izquierdo con esos tres colores. No se inventa una segunda
   escala de severidad que pueda contradecir a la que se ve.
3. **`desde` más viejo primero.** Cada alerta ya trae `desde`
   ([`alertas.js`](../../../src/lib/cartera/alertas.js)): la mora trae el mes
   (`"2026-08"`), el ticket la fecha-hora del último, el recordatorio vencido su
   fecha, la promo su vencimiento. Se toma el mínimo entre las alertas del
   cliente. Un pendiente viejo urge más, no menos — el mismo criterio que ya usa
   `proximoRecordatorio` para elegir cuál mostrar.
4. **Alta más nueva arriba** (`start_date`).

Los clientes sin alerta van todos abajo, ordenados solo por alta descendente.

**Normalización de `desde`.** Los valores vienen en tres formas: `"2026-08"`
(mes, de la mora y el seguimiento), `"2026-08-04"` (fecha) y
`"2026-08-04 14:30:00"` (fecha-hora, de los tickets). Se comparan como
`"YYYY-MM-DD"`: el mes se completa con `-01` y la fecha-hora se recorta a 10
caracteres. `desde: null` (las dos alertas de NAP) ordena último dentro de su
grupo de urgencia — no tiene fecha con la cual competir.

#### Orden por columna

Cada encabezado es un botón. El click fija esa columna como criterio; el
segundo click invierte la dirección.

| Columna | 1er click | Nulos |
|---|---|---|
| Código | ascendente | — (es la clave, no puede faltar) |
| Nombre | A→Z (`localeCompare` es-AR) | al final |
| Edad aprox | mayor primero | al final |
| Ciudad | A→Z | al final |
| Conexiones | más conexiones primero | — |
| Contacto | más viejo primero (el que más urge) | "nunca" cuenta como el más viejo |
| Pagos | peor comportamiento primero | sin puntos ordena último |
| **Alertas** | vuelve al orden compuesto por defecto | — |
| Alta | más nuevos primero | al final |

**"Al final" significa en las dos direcciones.** Invertir el orden no puede
subir arriba de todo a las filas sin dato: quien hace click en Edad para ver a
los más jóvenes no quiere treinta clientes sin DNI cargado encabezando la
lista. Ojo con que `normalizarCliente` deja `''` —no `null`— cuando IspCube no
manda un campo: nombre y alta parecen no poder faltar y sin embargo necesitan
el mismo tratamiento que edad y ciudad.

**Un orden por columna es *solo* por esa columna: las alertas no flotan
arriba.** Es deliberado y es el caso de uso que motivó el botón — "a veces es
útil ver los clientes más viejos". Si las alertas se colaran arriba igual, la
primera pantalla del orden por alta seguiría siendo la misma que la del orden
por alertas y el botón no serviría para nada. Para volver a "qué atiendo hoy"
está el encabezado de Alertas.

**"Peor comportamiento" en Pagos** es una suma sobre los puntos visibles (los
mismos que ya dibuja la fila, sin los grises): `rojo` vale 3, `amarillo` 1,
`verde` y `pendiente` 0. Mayor puntaje arriba. Es el único criterio de la tabla
que no sale de un campo directo, y por eso vive en `orden.js` con su propio
test.

**Desempate universal.** Cuando dos filas empatan en la columna elegida,
desempata **alta más nueva primero, y el código como último recurso**. Nada
más: ni urgencia ni alertas.

Es deliberado y costó encontrarlo. La versión anterior de este spec desempataba
con el orden compuesto por defecto, cuyo *primer* criterio es "con alerta antes
que sin alerta" — y eso reintroducía la prioridad por alerta por la ventana. En
una columna de baja cardinalidad el grupo empatado es casi la lista entera:
prácticamente todos los clientes tienen una sola conexión y hay tres ciudades,
así que "ordenar por Conexiones" terminaba siendo el orden por defecto con otro
nombre. El desempate tiene que dar un orden total y estable, y nada más que
eso.

### 4. Paginación

20 por página, debajo de la tabla: `1–20 de 137` a la izquierda, los números a
la derecha con elipsis cuando hay muchas páginas.

La página vuelve a 1 cuando cambia la búsqueda, el filtro o el orden. Sin eso,
buscar algo estando en la página 5 muestra una lista vacía y parece que no hay
resultados.

`refrescarVisibles()` sigue operando sobre **la lista filtrada completa**, no
sobre la página actual: su tope de 20 códigos es el límite del endpoint de sync,
no un tamaño de página, y ya prioriza los snapshots más desactualizados. Que los
dos números sean 20 es coincidencia.

### 5. Edad estimada por DNI — `src/lib/cartera/edad.js`

Módulo nuevo, sin dependencias, con tests.

En Argentina el DNI se asigna de forma aproximadamente secuencial al momento de
inscribir el nacimiento, así que el número acota el año de nacimiento. Es una
**estimación**, no un dato: el módulo interpola linealmente sobre una tabla de
anclas (DNI → año de nacimiento) que va de `1.000.000 ≈ 1920` a
`60.000.000 ≈ 2020`.

`estimarEdad(docNumber, hoy)` devuelve `number | null`. Devuelve `null` —y la
columna muestra `—`— en todos estos casos:

| Caso | Motivo |
|---|---|
| Vacío o no numérico | No hay qué estimar |
| Serie 90.000.000+ | DNI de extranjeros: no es secuencial por nacimiento |
| CUIT de empresa (prefijo `30`/`33`/`34`) | No es una persona |
| Menos de 1.000.000 | Anterior a la tabla; la secuencia ahí ya no es confiable |
| Mayor al último ancla | Extrapolar hacia el futuro no significa nada |

Un CUIT/CUIL de persona física (prefijo `20`/`23`/`24`/`27`, 11 dígitos) se
reduce a su DNI tomando los 8 dígitos del medio, y sigue el camino normal.

En la UI se muestra como `~57` con `title="Estimado a partir del DNI (±3 años)"`.
La tilde y el tooltip son el contrato con el asesor: esto no es la edad, es una
aproximación.

### 6. Datos nuevos en el snapshot

`GET /api/customer` de IspCube ya devuelve los dos campos (sondeado el
2026-08-07 contra producción):

```
doc_number: "20909528"
city: { id: 2, name: "PUNTA LARA", province: "Buenos Aires", ... }
```

`normalizarCliente` los suma al snapshot como `doc_number` (string crudo) y
`ciudad` (`city.name`). Se guardan en los tres caminos que escriben un cliente:
`guardarSnapshot`, `agregar` y `descubrirCandidatosDeVendedor`.

**Requiere dos campos nuevos en `cartera_clientes`, creados a mano en el admin
de PocketBase** (ambos `text`, opcionales):

| Campo | Contenido |
|---|---|
| `doc_number` | DNI crudo de IspCube |
| `ciudad` | `city.name` |

Se llenan solos en la siguiente sincronización de cada cliente. Hasta entonces
las dos columnas muestran `—`. Si los campos todavía no existen, PocketBase
ignora las claves extra del `create`/`update` y **nada se rompe**: es un
despliegue seguro en cualquier orden.

`ciudad` se muestra con `toTitleCase` (el mismo helper que ya normaliza el
nombre), pero se **guarda crudo**: normalizar al guardar haría que el snapshot y
la API dejaran de coincidir sin que quede registrado dónde se transformó.

### 7. Lo que se saca de la fila

Hoy la fila muestra el tiempo relativo desde la última sincronización
(`hace 2 h`). En nueve columnas no entra, y es un dato que casi nunca es
accionable.

- El **fallo** de refresco sí lo es: pasa a ser un ícono ⟳ ámbar al lado del
  código, visible solo cuando `refrescoFallido(code)` da true.
- El timestamp completo pasa al `title` de la fila.
- El dato exacto sigue en `ClienteDetalle`, sin cambios.

El reloj de 30 s que hace envejecer los tiempos relativos **se conserva**: ahora
lo consume la columna Contacto.

### 8. Mobile

Debajo de 900px la grilla de nueve columnas colapsa a la disposición apilada,
con `grid-template-areas` como hoy: nombre a ancho completo, pagos y alta
compartiendo línea, alertas abajo. Se ocultan edad, ciudad y conexiones — son
contexto, no lo que se busca en un teléfono. El encabezado de orden se oculta
entero —no hay columnas contra las cuales alinearlo—, pero el orden activo se
conserva: quien reduzca la ventana después de ordenar por alta sigue viendo esa
lista, no otra.

## Alcance

`Cartera.svelte` ya tiene 610 líneas y este cambio le suma la lógica de orden y
paginación. La lógica de orden sale a un módulo propio con tests
(`src/lib/cartera/orden.js`), igual que `alertas.js` y `pagos.js`: es la parte
con reglas de negocio reales y la que hay que poder verificar sin montar un
componente. El componente se queda con el estado de UI (columna activa,
dirección, página) y el render.

### Archivos

| Archivo | Cambio |
|---|---|
| `src/lib/cartera/edad.js` | **nuevo** — estimación de edad por DNI |
| `src/lib/cartera/edad.test.js` | **nuevo** |
| `src/lib/cartera/orden.js` | **nuevo** — clave de orden compuesta y comparadores por columna |
| `src/lib/cartera/orden.test.js` | **nuevo** |
| `src/lib/cartera/normalizar.js` | suma `doc_number` y `ciudad` a `normalizarCliente` |
| `src/lib/cartera/normalizar.test.js` | casos de los dos campos nuevos |
| `.../cartera/carteraStore.svelte.js` | guarda los dos campos en `guardarSnapshot`, `agregar` y el descubrimiento |
| `.../cartera/Cartera.svelte` | tabla, encabezados de orden, paginación |
| `docs/ispcube-api.md` | documenta `doc_number` y `city` en la tabla de campos |

## Fuera de alcance

- Ordenar del lado de PocketBase. Los 500 clientes ya están en memoria; ordenar
  y paginar en el cliente es instantáneo y no gasta requests.
- Guardar la preferencia de orden entre sesiones.
- Tamaño de página configurable.
- Selección múltiple de filas.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| La edad estimada se lee como dato firme | Prefijo `~`, tooltip explícito, `—` cuando no se puede estimar |
| Los campos nuevos de PocketBase no existen todavía | Las columnas muestran `—`; PocketBase ignora las claves extra |
| Los chips de alerta hacen crecer la fila al envolver | El chip de recordatorio se recorta a `8em` con el texto completo en el `title` |
| Un orden por columna esconde alertas urgentes | El encabezado de Alertas queda marcado como el orden por defecto y vuelve a él con un click |
