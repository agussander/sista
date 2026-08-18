# Importar el Tarifario desde Excel

**Fecha:** 2026-08-18
**Estado:** aprobado

## Problema

Cada versión del tarifario (una por mes, más o menos) se publica hoy a mano y
por triplicado, siguiendo instrucciones escritas dentro del propio Excel:

> Copiar rango B5:C34, pegarlo en Word, guardarlo como "página web filtrada" al
> resultante en htm renombrarlo como "index.php" (así en minúsculas)

Eso produce las tres páginas de `sista.com.ar`: `/tarifas`, `/lineavip` e
`/internacional`. Son volcados literales del Excel pasados por Word, en
UTF-16 LE.

De ahí cuelga todo lo demás:

- **`sista.ar` no tiene la página de tarifas.** El propio Excel manda a
  `www.sista.ar/internacional`, que no existe.
- **`/telefonia` y `/telefonia/internacional` scrapean el sitio viejo.**
  `parseLineaVip.js` y `parseInternacional.js` desarman con regex el HTML que
  escupe Word, y `vite.config.js` proxea `/lineavip` e `/internacional` a
  `sista.com.ar` para que ande en desarrollo. `/telefonia/internacional` se baja
  **14,5 MB de HTML** para mostrar 346 filas.
- **Los precios de la colección `precios` se tipean a mano**, uno por uno, en el
  panel. Ya hay dos que quedaron desincronizados del Excel:

  | campo | PocketBase | Excel | |
  |---|---|---|---|
  | `dgo_futbol` | 29.500 | 25.610 | quedó pegado al valor de `antina_futbol` |
  | `antina_cine` | 25.550 | 26.060 | el Excel publica el total, no el adicional |

Un solo archivo tiene los datos de las tres cosas. La fuente ya está
estructurada; lo único que falta es leerla.

## Alcance

Adentro:

- Importador de `.xlsx` en **admin › Precios**, con vista previa y diff.
- Página nueva **`/tarifas`** en `sista.ar`, réplica fiel de la tabla del Word.
- **`/telefonia`** y **`/telefonia/internacional`** pasan a leer del tarifario
  importado en vez de scrapear `sista.com.ar`.
- Actualización de los campos de la colección `precios` desde la pestaña
  *Precios Mostrador*.

Afuera:

- `/lineavip` e `/internacional` **no** se reconstruyen en `.ar`. Se parsean sus
  pestañas, pero solo para alimentar `/telefonia`.
- `/precios` (la imagen que se sube a mano), el nav y el dropzone del panel
  quedan **como están**. `/tarifas` es una página independiente.
- Sin historial de versiones: un registro, el vigente, con el `.xlsx` adjunto.
  Si más adelante hace falta historial, la colección pasa a multi-registro.

## El libro

Cinco pestañas. Los nombres y las columnas se mantienen entre versiones; lo que
cambia son los precios y, ocasionalmente, altas o bajas de filas.

| Pestaña | Datos | Uso |
|---|---|---|
| `Tarifas Web` | filas 6–33 (28) | `/tarifas` |
| `Linea VIP - Tarifas Web` | filas 5–8 (4) + notas 10–18 | `/telefonia` |
| `Internacional` | filas 5–3277 (3273) | `/telefonia/internacional` |
| `Precios Mostrador` | filas 5–39 (35) | colección `precios` |
| `Tarifario completo` | maestro interno | **no se lee** |

`Tarifario completo` tiene cantidad de abonados, porcentajes de aumento y
facturación proyectada. No se toca: nada de eso es público.

Los cuatro bloques de datos son contiguos, así que **ninguna fila se lee por
número fijo**: se escanea desde el encabezado hasta la primera fila sin
etiqueta. Eso sobrevive a que agreguen o saquen un plan. Las celdas de
instrucciones (`Tarifas Web!B36`, `B38`, `Linea VIP!A20`) caen después del
primer hueco, así que nunca se alcanzan.

### Anclas

| Dato | Celda |
|---|---|
| Vigencia general | `Tarifas Web!B5` → `2026-08-01` |
| Versión | `Precios Mostrador!B2` → `26.081` |
| Alícuota de impuestos | `Tarifas Web!D42` → `0.21` |
| Vigencia de Internacional | `Internacional!E3` → **`2026-06-01`** |
| Vigencia de Línea VIP | `Linea VIP!J2` |

La vigencia de Internacional es distinta de la general. Se guarda aparte.

Las vigencias son seriales de fecha; se guardan como `YYYY-MM-DD`.

La versión es un **número** en la planilla (`26.081`), no un texto. Se
serializa con `String(n)`, que da la representación más corta que round-trippea:
`26.081` → `"26.081"`, y una futura `5.2` → `"5.2"`. Con `toFixed(3)` esa misma
`5.2` saldría `"5.200"`, que no es lo que dice el Excel.

Las notas de Línea VIP se juntan recorriendo la columna `B` desde la fila
siguiente a la última de datos, y se corta en la primera fila con contenido en
la columna `A` — que es la celda de instrucciones (`A20`, combinada `A20:K20`).

### Columnas

- **Tarifas Web** — `B` etiqueta, `C` sin impuestos nacionales, `D` abono mensual.
- **Precios Mostrador** — `B` etiqueta, `G` cargo inicial (precio final),
  `I` abono mensual (precio final).
- **Linea VIP** — `B` nombre, `C` clientes, `D` número local, `E` cargo inicial,
  `F` abono mensual, `G` minutos incluidos, `H` llamadas a celulares,
  `I` excedente local, `J` excedente nacional.
- **Internacional** — `B` prefijo, `C` destino, `D` Fijo/Móvil, `E` precio U$S.

`H5:H8` y `J5:J8` de Línea VIP están **combinadas**: el valor vive en la fila 5
y aplica a los cuatro planes. Se lee una vez y se replica — es lo mismo que hoy
emula a mano la lógica de `shared` en `parseLineaVip.js`.

## Diseño

### Módulos

| Módulo | Responsabilidad | Depende de |
|---|---|---|
| `src/lib/tarifario/xlsx.js` | Lector genérico `.xlsx` → celdas por hoja | nada |
| `src/lib/tarifario/parseTarifario.js` | Conoce *este* libro: versión, vigencias y las 4 estructuras | `xlsx.js` |
| `src/lib/tarifario/mapeoPrecios.js` | Etiqueta del Excel → campo de `precios` | nada |
| `src/lib/tarifario/fetchTarifario.js` | Lee el registro de PocketBase | `pocketbase.js` |

Los tres primeros son funciones puras sobre datos: se testean sin navegador, sin
red y sin PocketBase. `fetchTarifario.js` es el único que sabe de la base, y
reemplaza a `fetchLineaVip.js` / `fetchInternacional.js`.

### El lector de `.xlsx`, sin dependencias

Un `.xlsx` es un ZIP de XML. Se lee con `DecompressionStream('deflate-raw')`,
que es API de plataforma: nada de SheetJS (la versión de npm está congelada en
0.18.5, con CVE) ni de ExcelJS. Soporte en navegadores: Chrome 103+, Safari
16.4+, Firefox 113+ — de sobra para un panel de administración.

Los tests corren en Node, que también necesita `deflate-raw`. Verificado en el
Node de esta máquina (v22.17). Si aparece un entorno con un Node más viejo donde
falle, el arreglo es subir esa versión, no cambiar de enfoque.

`leerLibro(arrayBuffer)` devuelve, por hoja, un `Map` de `'B6'` → valor. Maneja:

- directorio central del ZIP (tamaños confiables, a diferencia del header local);
- `sharedStrings.xml`, y los tipos `s`, `str`, `inlineStr`, `b`, `e`;
- seriales de fecha, detectados por `numFmtId` vía `styles.xml`;
- **celdas auto-cerradas** (`<c r="F6" s="214"/>`);
- **`<v xml:space="preserve">`**.

Los dos últimos no son teóricos: los dos rompieron el prototipo. La celda
auto-cerrada hacía que `F6` se comiera el contenido de `B7` y que `FAST F121`
desapareciera; el `xml:space` se tragaba las siete filas de packs. Van con test
de regresión propio.

**Verificación hecha:** el prototipo se comparó celda por celda contra openpyxl
sobre el archivo real — **13.101 celdas en las 5 pestañas, cero diferencias**,
salvo `\r\n` vs `\n` en las dos celdas de instrucciones, que no se leen.

Todas las celdas del libro son fórmulas con valor cacheado. Excel siempre
escribe ese caché, pero si alguna vez llega un archivo generado por otra
herramienta sin cachear, las celdas salen vacías: por eso el importador valida y
avisa en vez de publicar un tarifario mudo.

### Almacenamiento

Colección `tarifario`, un registro:

| Campo | Tipo | Contenido |
|---|---|---|
| `version` | text | `"26.081"` |
| `vigencia` | text | `"2026-08-01"` |
| `tarifas_web` | json | `{ filas: [{label, nivel, sinImpuestos, precioFinal}], alicuota }` |
| `linea_vip` | json | `{ vigencia, planes: [...], aparato, notas: [...] }` |
| `internacional` | json | `{ vigencia, unidad: "U$S", destinos: [{destino, fijo, movil}] }` |
| `archivo` | file | el `.xlsx` original |
| `importado_por` | text | id del usuario que publicó |

Se guardan **números**, no strings pre-formateados. Se termina el `"$ 9 588"`
heredado del export de Word y las regex que lo desarmaban
(`.replace(/(?<=\d) (?=\d)/g, '.')`). El formateo pasa a ser decisión de cada
página.

`nivel` sale de los espacios iniciales de la etiqueta (`"   Pack Fútbol (DGo)"`):
`0` si no tiene, `1` si tiene. Marca los packs como sub-ítems de su servicio y
se usa para indentar en `/tarifas`; la etiqueta se guarda ya recortada.

`internacional` se guarda **agrupado por destino**, no por prefijo: 346 entradas
(~15 KB) en vez de 3.273. Es exactamente lo que consume la página. Se verificó
que ningún destino tiene dos precios distintos para el mismo tipo, así que el
agrupamiento no pierde información de precio. Hoy esa página se baja 14,5 MB.

`linea_vip.planes` guarda los **cuatro** planes, Radio incluidos, con su campo
`clientes`; `/telefonia` sigue eligiendo el suyo con el `find` que ya tiene.
`aparato` (la nota de "Aparato telefonico (Opcional)") va separada de `notas`,
igual que hoy, para que la lista de notas al pie salga idéntica.

`linkInternacional`, que el parser viejo extraía y la página nunca usaba, se
descarta.

**Paso manual:** crear la colección en la consola de PocketBase. Reglas de
List/View vacías (público, igual que `precios`, que hoy se lee sin auth) y
Create/Update con `@request.auth.id != ""`, que es lo que necesita el panel para
escribir desde el navegador. Delete bloqueado. El campo `archivo` acepta un solo
archivo, hasta 10 MB, MIME
`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.

### Mapeo de precios

El match es por **etiqueta normalizada**: `trim`, colapsar espacios internos
(`"MAX F161   (NUEVO)"`) y comparar sin distinguir mayúsculas. Exacto después de
normalizar, no por prefijo ni por "contiene": predecible y sin falsos positivos
entre `Pack Fútbol (DGo)` y `DGo Fútbol total`.

Contra la columna `I` (*Abono Mensual · Precio final*):

| Etiqueta | Campo |
|---|---|
| HOME F111 | `home` |
| FAST F121 | `fast` |
| POWER F131 | `power` |
| GAMER F141 | `gamer` |
| WORKER F151 | `worker` |
| MAX F161 (NUEVO) | `max` |
| ANTINA PLAY + | `antina` |
| Pack Fútbol (Antina) | `antina_futbol` |
| DGO Full | `dgo_full` |
| Pack Fútbol (DGo) | `dgo_futbol` |
| PARAMOUNT + (Dgo) | `dgo_paramount` |
| UNIVERSAL (DGo) | `dgo_universal` |
| GIGARED Básico | `gigared` |
| Pack Fútbol (Gigared) | `gigared_futbol` |
| LINEA VIP 56-221 | `telefono` |

Y dos derivados:

- `antina_cine` = `Básico + Cine` − `ANTINA PLAY +` = 45.950 − 19.890 =
  **26.060**. El sitio lo usa como **adicional** (`ADDON_CINE` en `tvData.js`,
  y `categoryPrices` en la grilla de canales de `/antinaplay`), pero el Excel
  solo publica el total. Si falta cualquiera de las dos filas, no se deriva nada.
- `instalacion` = columna `G` (*Cargo Inicial · Precio final*) de la fila
  `HOME F111` = **20.000**.

Todos los valores se redondean a entero, que es lo que guarda `precios` hoy.

**Invariante:** el import solo puede escribir un número positivo y finito que
efectivamente encontró. Etiqueta ausente, valor no numérico o valor ≤ 0 → el
campo **no se toca** y sale un aviso en la vista previa. Nunca escribe `0` ni
`null` en silencio. Es la garantía de que un Excel con la estructura cambiada
degrada a "no actualicé estos campos" y no a "borré los precios del sitio".

Las filas del Excel sin campo asociado (SistaFLEX, PABXIP, bandas SPRINT, VIP
55-011, MUNDIAL F99, IP fija, cableados, traslados) no son un error: aparecen en
`/tarifas` y se listan como informativas en la vista previa.

### Panel — `ImportarTarifario.svelte`

Se monta **arriba** de `EditPrices.svelte` dentro de `Precios.svelte`.
`EditPrices.svelte` no se toca: queda como edición manual y como respaldo si el
import falla.

Flujo: dropzone → parseo en el navegador → vista previa → **Publicar**.

La vista previa muestra tres cosas:

1. **Resumen** — versión, vigencia, y cuántas filas trajo cada pestaña.
2. **Diff de precios** — campo por campo, valor actual → valor nuevo, resaltando
   lo que cambia. `antina_cine` muestra la resta a la vista.
3. **Avisos** — campos sin fila en el Excel, filas sin campo, valores
   descartados.

Un solo botón publica: escribe el registro de `tarifario` (con el `.xlsx`
adjunto) y actualiza `precios`. Es una operación mensual que toca los precios de
todo el sitio; verla antes de confirmar es barato.

### `/tarifas`

Réplica fiel de la tabla del Word: mismo orden, las dos mismas columnas
(*Sin impuestos nacionales* y *Abono Mensual*), sub-ítems indentados según
`nivel`, versión al pie. Formato `$ 20 787` — redondeado a entero, separador de
miles con espacio, igual que la legacy.

Va **dentro del layout del sitio** (nav y footer): la legacy no tiene ninguno,
pero una página sin nav en `sista.ar` es un callejón sin salida.

Carga con `onMount` + `Spinner`, que es el patrón de todas las páginas de este
repo que leen de PocketBase (`/precios`, `/telefonia`, `/dgo`, `/antinaplay`).

### `/telefonia` y `/telefonia/internacional`

Cambian de fuente y de formateo; el resto del render queda igual.

- El `import` pasa de `fetchLineaVip` / `fetchInternacional` a `fetchTarifario`.
- `formatPrecio` deja de desarmar `"$ 9 588"` y pasa a formatear un número al
  estilo local: miles con punto, decimales con coma (`9971.6` → `"9.971,60"`).
  Los abonos se muestran redondeados; los precios por minuto, con dos decimales.
- `formatUSD` idem sobre número, con coma decimal (`0.5` → `"0,5"`).
- **Los símbolos ahora los pone la página.** Hoy vienen pegados al dato: el
  scrapeo devuelve `"$ 9 972"` y `"U$S 0.5"`, y el render los escupe tal cual.
  Con números, `formatPrecio` antepone `$` y `formatUSD` antepone `U$S`, para
  que las dos páginas se vean igual que antes.
- `displayFootnotes` **no cambia**: las notas llegan con el mismo texto, así que
  sus filtros y reescrituras siguen aplicando igual.

## Tests

Con vitest, siguiendo lo que ya hacen `parseLineaVip.test.js` y
`parseInternacional.test.js`.

- **`xlsx.test.js`** — sobre XML escrito a mano, para los casos que rompen:
  celda auto-cerrada seguida de otra con valor, `<v xml:space="preserve">`,
  serial de fecha, `t="str"` vs `t="s"`, celda de solo estilo. Más una lectura
  del archivo real de punta a punta.
- **`parseTarifario.test.js`** — golden contra el archivo real: 28 filas de
  Tarifas Web, 4 planes VIP, 346 destinos, versión `26.081`, vigencia general
  `2026-08-01`, vigencia de Internacional `2026-06-01`, y que `H`/`J`
  combinadas se replican a los cuatro planes.
- **`mapeoPrecios.test.js`** — los 15 mapeos directos, la resta de
  `antina_cine`, `instalacion` desde la columna de cargo inicial, y el
  invariante: etiqueta faltante o valor inválido → campo intacto + aviso.

El `.xlsx` real se copia como fixture a
`src/lib/tarifario/__fixtures__/tarifario-26.081.xlsx`, con nombre limpio (el de
`docs/` tiene espacios dobles y paréntesis).

## Orden de entrega

1. Crear la colección `tarifario` en PocketBase.
2. `xlsx.js` + `parseTarifario.js` + `mapeoPrecios.js` + tests.
3. `ImportarTarifario.svelte` + `/tarifas`. Importar una versión y verificar.
4. `fetchTarifario.js`; `/telefonia` y `/telefonia/internacional` cambian de fuente.
5. Borrar `fetchLineaVip.js`, `fetchInternacional.js`, `parseLineaVip.js`,
   `parseInternacional.js`, sus tests, y el proxy de `vite.config.js`.

Los pasos 3 y 4 son independientes: si algo sale mal en el 4, lo del 3 ya quedó
andando y `/telefonia` sigue leyendo del sitio viejo.

## Riesgos

- **Cambia la estructura del Excel.** El escaneo por hueco aguanta altas y bajas
  de filas; un renombre de pestaña o un corrimiento de columnas, no. En ese caso
  el parseo falla ruidosamente en la vista previa y no se publica nada. La
  edición manual de `EditPrices.svelte` sigue disponible.
- **Renombran una etiqueta.** Ese campo deja de actualizarse y sale el aviso.
  No se escribe basura.
- **PocketBase caído o sin registro.** `/tarifas` y `/telefonia` muestran el
  estado de error que esas páginas ya tienen. Después del paso 5 no queda
  fallback al sitio viejo — es justamente la fuente que se está retirando.
