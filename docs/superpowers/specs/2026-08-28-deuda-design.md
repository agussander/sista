# Pestaña "Deuda" en el panel de administración

**Fecha:** 2026-08-28
**Estado:** aprobado

## Problema

El cálculo de la deuda de un cliente moroso se hace hoy a mano en un Excel
(`docs/INTERESES ACTUALIZADO.xlsx`, copia local de una planilla de Drive). El
asesor abre IspCube, copia el monto de la caja, mira la fecha del 2.º
vencimiento de la última factura, cuenta los días hasta hoy con una herramienta
del propio Excel, y recién ahí la planilla calcula recargo, intereses y total.

Cuatro cosas que hoy salen mal por ser manual:

- El monto y la fecha se copian a ojo entre dos pantallas.
- La tasa aplicada quedó congelada y nadie lo nota (ver "El estado de la tasa").
- Los comentarios del Excel no describen sus propias fórmulas (ver "Lo que el
  Excel realmente calcula"), así que nadie puede auditar el resultado leyéndolo.
- La mayoría de estos clientes están **eliminados** en IspCube, y no era obvio
  si sus datos seguían siendo accesibles por API.

Se pide una pestaña "Deuda" en `/admin` que, escribiendo el número de cliente,
traiga la caja y calcule monto, intereses y total.

## Lo que el Excel realmente calcula

Fórmulas verificadas contra el caso revisado por el usuario (cliente `014231`,
monto 52.705,48, 130 días, tasa 0,696 → total 74.401,82):

| Celda | Fórmula | Significado |
|---|---|---|
| `E4` | `0.696` (constante literal) | Tasa aplicada. **No** es una fórmula sobre `E2`. |
| `E6` | vacía | "Adicional a aplicar", opcional |
| `F9` | `C9*E4/24.3 + E6` | Recargo del 2.º vencimiento → 1.509,59 |
| `G9` | `C9+F9` | Monto con recargo → 54.215,07 |
| `F10` | `G9*C10*E4/243` | Intereses posteriores al 2.º vto → 20.186,75 |
| `G10` | `G9+F10` | Total → 74.401,82 |
| `E12` | `E4*100/24.333` | Número a tipear en el sistema para el form de 2.º vto → 2,86 |
| `F14` | `E4*150` | Número a tipear en el sistema para "FUERA TERMINO" → 104,40 |
| `D21` | `TODAY()-D19` | Días desde el 2.º vencimiento |

Dos discrepancias entre las fórmulas y los comentarios al costado, que se
reproducen **tal cual están** porque son las que el usuario validó contra el
sistema real:

- El comentario de `F9` dice "aplicable a 10 días", pero `24.3 ≈ 365/15`, o sea
  15 días. El divisor que manda es el 24,3.
- `243 = 24.3 × 10`, así que la tasa diaria posterior al 2.º vto es
  `tasa/243`, equivalente a aplicar `tasa × 1,5` sobre 365 días. Es el mismo
  104,40 % del cartel "FUERA TERMINO", pero eso no está dicho en ningún lado
  del Excel.

`F11` (4500) y `G11` (13000) son dos conceptos fijos que se suman al total:
**reconexión** y **visita**. En el Excel aparecen como dos resultados separados
(`F12 = G10+F11`, `G12 = G10+G11`), no sumados entre sí.

## El estado de la tasa

`E2` ("Tasa BNA", 33,90 %, fecha 26/3/26) es la **Tasa Activa Cartera General
Diversas** del Banco Nación — la nota de `F2` copia textualmente la redacción de
[la página del BNA](https://www.bna.com.ar/home/informacionalusuariofinanciero).
Al 28/8/2026 esa tasa está en 28,35 % (T.E.M. 2,330 %, T.E.A. 32,34 %).

La regla declarada es "Tasa BNA + 50 %", o sea ×1,5. Pero `69,60 ÷ 1,5 = 46,40`,
que no es el 33,90 % de marzo. Tampoco sale de la T.E.A.: con T.N.A. 33,90 la
T.E.A. es 39,71 %, y 39,71 × 1,5 = 59,6.

**Conclusión: el desactualizado es `E4`, no `E2`.** El 69,60 quedó fijo de
cuando la T.N.A. era 46,40 %; alguien actualizó el 33,90 en marzo y no recalculó
el aplicado. Nadie lo notó porque `E2` no alimenta ninguna fórmula.

Impacto sobre el caso revisado, si se aplicara la regla con la tasa de hoy:

| Tasa | Recargo 2.º vto | Intereses 130 d | Total |
|---|---|---|---|
| 69,60 % (Excel hoy) | 1.509,59 | 20.186,75 | 74.401,82 |
| 42,53 % (28,35 × 1,5) | 922,35 | 12.200,33 | 65.828,16 |

**Decisión del usuario:** la tasa aplicada es un **campo manual**, no se deriva
sola. La del BNA se muestra al lado como referencia, con su ×1,5 calculado y un
botón para copiarla al campo. Automatizar la tasa habría cambiado lo que cobran,
y esa es una decisión de negocio, no del código.

## Hallazgos de la API (sondeados el 2026-08-28)

Sobre el cliente real del ejemplo, `014231`:

- **Los clientes eliminados se leen igual.** Tiene `deleted_at:
  "2026-05-25T18:41:40Z"` y `GET /api/customer?code=014231` devuelve el payload
  completo, sin necesidad del parámetro `deleted=`. El fallback manual pasa a
  ser un camino de excepción, no el principal.
- `debt: "52705.48"` es exactamente el `C9` del Excel. **`debt` es "la caja".**
  (`duedebt` y `real_duedebt` valen lo mismo en este cliente; se usa `debt` por
  decisión del usuario.)
- `GET /api/bills/bills_last_six_months?code=014231` devuelve `due_date2:
  "2026-04-20"`, exactamente el `D19` que cargaban a mano. Del 20/4 al 28/8 hay
  130 días, que es el `C10` del Excel.
- `GET /api/bills/last_bill_api` **no** sirve: devuelve la URL del PDF, no JSON.
- En un cliente eliminado `connections` viene vacío y `plan_price` vacío, así
  que el precio del plan no se puede sacar de ahí. Para el caso de más de 180
  días se usa `precios.home` de PocketBase.
- El HTML del BNA es server-rendered y trae el dato en texto plano
  (`Tasa Nominal Anual Vencida con capitalización cada 30 días = T.N.A. (30
  días) = 28,35%`) junto a `vigente desde el 28/8/2026`. Es parseable con
  regex de forma estable.

## Alcance

Adentro:

- Módulo puro `src/lib/deuda/calculo.js` con la aritmética del Excel y el caso
  de más de 180 días.
- Módulo puro `src/lib/deuda/tasaBna.js` que parsea el HTML del BNA.
- `getUltimaFactura()` nuevo en `src/lib/server/ispcube.js`.
- Endpoint `GET /api/deuda/[code]` (cliente + última factura), con permiso.
- Endpoint `GET /api/deuda/tasa` (lectura del BNA, cacheada).
- Pantalla `Deuda.svelte` en el panel.
- Permiso `deuda` en `adminPermisos.js`, entrada de sidebar, caso en
  `Content.svelte`.
- Colección `deuda_config` en PocketBase (un solo record, como `precios`).

Afuera:

- **No se automatiza la tasa.** El campo es manual; el BNA es referencia.
- No se escribe nada en IspCube. Todo el flujo es de solo lectura.
- No se registra ni audita la liquidación: la pantalla calcula y muestra, no
  guarda un historial de consultas.
- No se toca la Cartera ni su snapshot. Son universos distintos: la Cartera
  trabaja sobre clientes activos, estos están eliminados.
- No se corrige el Excel ni se lo deja de usar por decreto; la pantalla lo
  reemplaza, la planilla queda donde está.

## Arquitectura

Tres capas, siguiendo lo que ya hace `src/lib/cartera/`:

```
src/lib/deuda/calculo.js      puro, sin red ni framework
src/lib/deuda/tasaBna.js      puro, recibe HTML y devuelve datos
        ↑
src/routes/api/deuda/…        traen datos, no calculan
        ↑
Deuda.svelte                  edita, recalcula en vivo, muestra
```

La aritmética queda del lado del navegador para que editar días, monto,
adicional o tasa recalcule al instante sin volver al servidor. El servidor solo
trae lo que requiere credenciales.

### `src/lib/deuda/calculo.js`

```js
export const DIVISOR_SEGUNDO_VTO = 24.3;   // ≈ 365/15
export const DIVISOR_DIARIO = 243;          // 24.3 × 10
export const DIVISOR_FORMULARIO = 24.333;   // el del Excel, distinto a propósito
export const UMBRAL_DIAS = 180;

calcularDeuda({ monto, dias, tasa, adicional = 0 })
  → { recargoSegundoVto, montoConSegundoVto, intereses, total,
      tasaFormulario, tasaFueraTermino }

calcularDeudaLarga({ monto, precioHome })
  → { monto, precioHome, total }

diasDesde(fecha, hoy)   // diferencia en días calendario
```

`tasa` entra como fracción (0,696), no como porcentaje. La conversión desde el
campo de la pantalla (69,60) vive en el componente.

`DIVISOR_FORMULARIO` es 24,333 mientras `DIVISOR_SEGUNDO_VTO` es 24,3: son dos
celdas distintas del Excel con divisores distintos, y da 2,8603 contra 2,8642.
La diferencia es real y se preserva; unificarlos cambiaría un número que hoy
tipean en el sistema.

### `src/lib/deuda/tasaBna.js`

```js
parsearTasaBna(html) → { tna: 28.35, vigencia: '28/8/2026' } | null
```

Devuelve `null` si el HTML no matchea, en vez de inventar un número. Se testea
contra un fixture del HTML real guardado en `src/lib/deuda/__fixtures__/`.

### `src/lib/server/ispcube.js`

`getUltimaFactura(code, config, options)` sobre
`/api/bills/bills_last_six_months`, siguiendo el patrón de las lecturas que ya
están: valida el formato del code, `not_found` → sin factura, un 200 que no es
array → `invalid` (no se lava en vacío, por el mismo motivo que `getCobranzas`).
Devuelve la factura de `date` más reciente.

### `GET /api/deuda/[code]`

Guardado con `verificarPermiso(request, pocketbaseUrl(), 'deuda')`, mismo patrón
de códigos que la Cartera (403 si es `sin_permiso`, 401 si no sabemos quién es).
Cuesta **2 requests** de la cuota de IspCube.

```json
{
  "cliente": { "code", "name", "status", "eliminado", "debt" },
  "factura": { "date", "due_date2", "total" }
}
```

`eliminado` es `deleted_at != null`, resuelto en el servidor para que la
pantalla no tenga que interpretar el payload crudo.

### `GET /api/deuda/tasa`

Lee el BNA, lo parsea con `parsearTasaBna` y cachea en memoria del proceso
6 h (el dato cambia de a días, no de a minutos). Devuelve
`{ tna, vigencia, aplicada }` donde `aplicada = tna * 1.5`, o
`{ error }` si no se pudo. No requiere permiso de IspCube pero sí el de `deuda`:
es una pantalla interna.

Un fallo acá es **cosmético**, porque la tasa aplicada es manual. Por eso no se
persiste el último valor bueno: si el BNA no contesta, la pantalla dice
"referencia no disponible" y sigue funcionando.

### Colección `deuda_config` (PocketBase)

Un solo record, mismo patrón que `precios` (`getFirstListItem('')`). Campos:

| Campo | Tipo | Default | Qué es |
|---|---|---|---|
| `tasa_aplicada` | number | 69.6 | En **porcentaje**, no fracción |
| `tasa_desde` | date | — | Cuándo se cargó ese valor |
| `tasa_nota` | text | — | Opcional, por qué se cambió |
| `reconexion` | number | 4500 | Concepto fijo |
| `visita` | number | 13000 | Concepto fijo |

Se guarda en porcentaje y no en fracción para que abrir PocketBase y leer
`69.6` signifique algo. La conversión a fracción la hace el componente.

Escribe el navegador con el token del asesor, igual que el resto del panel.

## La pantalla

Un campo de número de cliente. Al confirmar:

**Encabezado del cliente:** nombre, número, estado, y un cartel "eliminado en
IspCube" cuando corresponde. Este cartel importa: es la señal de que el dato
viene de un registro dado de baja.

**Datos base, todos editables:**

- Caja (viene de `debt`)
- Fecha de 2.º vencimiento (viene de la última factura)
- Días transcurridos (calculado, editable — pisar los días o pisar la fecha son
  dos formas de lo mismo; editar la fecha recalcula los días)
- Tasa aplicada (viene de `deuda_config`), con la referencia del BNA al lado:
  "BNA hoy 28,35 % (vigente 28/8/2026) → ×1,5 = 42,53 %" y un botón para
  copiarla
- Adicional (`E6` del Excel, opcional, no se persiste)

**Resultado, si los días son ≤ 180** — la tabla del Excel:

| | |
|---|---|
| Monto | 52.705,48 |
| Recargo 2.º vencimiento | 1.509,59 |
| Subtotal | 54.215,07 |
| Intereses (130 días) | 20.186,75 |
| **Total** | **74.401,82** |

Más los dos números que se tipean en el sistema: 2,86 (form 2.º vto) y 104,40
(fuera de término).

Más dos casillas opcionales, **Reconexión** y **Visita**, que suman su monto al
total cuando se tildan.

**Resultado, si los días son > 180:** caja + precio del plan Home (de
`precios.home`), sin intereses. La pantalla dice explícitamente por qué cambió
el cálculo, para que no parezca un error.

**Qué aplica en cada rama:** Reconexión y Visita son conceptos ajenos al
interés, así que suman en las dos ramas. El Adicional, en cambio, es la celda
`E6` del Excel y vive dentro de la fórmula del recargo de 2.º vencimiento: solo
existe en la rama de ≤ 180 días, y el campo se oculta en la otra.

**Modo manual:** si el cliente no aparece, o IspCube no responde, se carga el
monto y la fecha a mano y el resto funciona igual.

## Errores

| Situación | Qué hace |
|---|---|
| Cliente no encontrado (404) | Mensaje + ofrece modo manual |
| IspCube caído / sin credenciales (502) | Mismo camino |
| Cliente sin facturas | Pide la fecha de 2.º vto a mano |
| `debt` ≤ 0 | "Sin deuda", no calcula |
| BNA no responde o cambió de formato | "Referencia no disponible"; el cálculo sigue |
| `deuda_config` no existe todavía | Lee los defaults de la tabla de arriba y la pantalla funciona; al intentar guardar avisa que falta crear la colección |
| Sin permiso `deuda` | 403 del endpoint, sección oculta del sidebar |

## Tests

Siguiendo lo que ya hay en el repo (vitest, tests al lado del módulo):

- `calculo.test.js`: **el caso real revisado** (52.705,48 / 130 días / 0,696 →
  1.509,59 / 54.215,07 / 20.186,75 / 74.401,82), los dos números "para el
  sistema" (2,86 y 104,40), el adicional, el umbral de 180 en sus dos lados, y
  el caso de más de 180 días.
- `tasaBna.test.js`: fixture del HTML real → 28,35 / "28/8/2026"; HTML que no
  matchea → `null`.
- `ispcube.test.js`: `getUltimaFactura` con `fetchImpl` inyectado — elige la
  factura más reciente, 404 → sin factura, 200 que no es array → `invalid`.
- `server.test.js` del endpoint: sin token → 401, sin permiso → 403, cliente
  inexistente → 404, IspCube caído → 502.

Ningún test toca la API real: `ispcube.js` ya inyecta `fetchImpl` en todas sus
funciones y eso se respeta.

## Orden de implementación

1. `calculo.js` + sus tests (es el corazón y no depende de nada).
2. `tasaBna.js` + fixture + tests.
3. `getUltimaFactura` en `ispcube.js` + tests.
4. Los dos endpoints + tests.
5. Permiso `deuda`, sidebar, `Content.svelte`.
6. `Deuda.svelte`.
7. Crear `deuda_config` en PocketBase (paso manual del usuario, con los campos
   de la tabla de arriba).

## Riesgos

- **El formato del HTML del BNA puede cambiar.** Mitigado: `parsearTasaBna`
  devuelve `null` y la pantalla degrada a "referencia no disponible". Nunca
  bloquea el cálculo, porque la tasa aplicada es manual.
- **Cuota de la API de IspCube.** Cada consulta cuesta 2 requests. Es una
  pantalla de uso puntual, no un listado, así que el volumen es bajo.
- **La tasa aplicada puede volver a congelarse.** Es exactamente lo que pasó con
  el 69,60. Mitigado a medias: mostrar la del BNA al lado hace visible la
  brecha, pero nada la fuerza a actualizarse. Es una decisión consciente del
  usuario.
