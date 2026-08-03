# Cartera de clientes en admin: Design

**Fecha:** 2026-08-03
**Estado:** aprobado, pendiente de plan de implementación

## Problema

Los asesores comerciales de Sista no tienen dónde seguir a sus clientes después de la venta. La información existe en IspCube — alta, tickets, pagos, deuda — pero está dispersa en un sistema pensado para administración, no para seguimiento comercial, y no hay ningún lugar donde anotar los contactos que el asesor hace.

El caso concreto que dispara esto: **a los dos meses de la instalación, el asesor tiene que llamar al cliente.** Hoy no hay nada que se lo recuerde ni dónde registrar que lo hizo.

La Cartera es un panel dentro de `/admin` donde cada asesor agrega sus clientes por número, ve los datos que le importan y gestiona el seguimiento.

## Alcance

**Entra:**

- Un módulo nuevo en el dashboard de `/admin`, al lado de Precios, Novedades, Llamenme.
- Alta de clientes por número, validada contra IspCube.
- Por cliente: fecha de instalación, fecha de alta, estado, deuda, medio de pago, historial de pagos por mes, tickets, bitácora de contactos.
- Cuatro alertas: seguimiento a los 2 meses, mora en el primer corte, mora en el segundo corte, tickets de soporte nuevos.
- Cada asesor ve solo su cartera.

**No entra:**

- Roles y vista global de todas las carteras. El modelo de datos lo deja preparado, pero no se implementa ahora.
- Avisos por mail o notificaciones fuera del panel.
- Escribir en IspCube. La Cartera es **solo lectura** contra la API; lo único que se escribe es en PocketBase.
- Métricas, reportes o ranking de asesores.
- Refresco automático en segundo plano (cron). Se puede sumar después sin rehacer nada.

## Contexto de la API

La referencia completa está en [`docs/ispcube-api.md`](../../ispcube-api.md). Lo que condiciona este diseño:

### La API se factura por consumo

IspCube incluye **`2,5 × conexiones activas`** requests por mes, con corte el día 28 y cobro por request excedente. Ese presupuesto lo comparten todas las integraciones de Sista (tickets de baja, pantalla de puntos, y ahora la Cartera).

Consecuencia directa: **una cartera de 100 clientes consultada en vivo en cada apertura son ~300 requests.** Dos o tres aperturas diarias agotan la cuota. El diseño tiene que ser tacaño, no solo rápido.

**Acción pendiente:** mirar el panel de consumo dentro del tablero de IspCube para conocer el número real de Sista. No bloquea la implementación, pero define cuánto margen hay para la sincronización en bloque.

### `entity_id` es el medio de pago

No existe un campo `payment_method` en la API. Lo confirma la descripción del `PUT /api/customers/:id` ("aquí puedes actualizar el medio de pago…"), cuyo único campo de pago es `entity_id`. El catálogo de entidades sale de `GET /api/cash/entities_list`.

Por eso saber si un cliente paga con tarjeta **se configura mapeando entidades**, no cliente por cliente ni infiriéndolo de otros campos.

### El token dura 24 h y hoy se pide de más

`getCustomerByCode` pide un token nuevo en cada llamada. Cachearlo en memoria del servidor **corta a la mitad el consumo de todo lo que ya existe**, no solo de la Cartera. Entra en este trabajo porque la Cartera multiplica el volumen de llamadas.

### La fecha de alta de IspCube no sirve para el seguimiento

En IspCube las altas se cargan desde el principio del mes siguiente, así que `start_date` es casi siempre el día 1. Usarla para la alerta de los 2 meses haría que todos los clientes de un mismo mes salten el mismo día, sin relación con la instalación real.

Por eso **la fecha de instalación la carga el asesor** al agregar el cliente. `start_date` se guarda igual, como dato administrativo, y se muestra aparte.

## Modelo de datos

Tres colecciones nuevas en PocketBase.

### `cartera_clientes`

Un registro por cliente en la cartera de un asesor. Es el snapshot local de IspCube más los datos propios de la Cartera.

| Campo | Tipo | Origen | Notas |
|---|---|---|---|
| `asesor` | relation → `users` | Cartera | Dueño del registro |
| `code` | text | Cartera | Número de cliente **con ceros** (`"003566"`) |
| `fecha_instalacion` | date | **Asesor** | Manda para la alerta de los 2 meses |
| `nombre` | text | IspCube | Normalizado con `toTitleCase` |
| `estado` | text | IspCube | `enabled`, `no_service`, … |
| `start_date` | date | IspCube | Alta administrativa, informativa |
| `entity_id` | number | IspCube | El medio de pago |
| `entity_nombre` | text | IspCube | Para mostrar sin resolver el catálogo |
| `perfil_pago` | select | Derivado | `ventanilla` \| `tarjeta`, con override manual |
| `debt`, `duedebt` | number | IspCube | Deuda total y vencida |
| `pagos` | json | IspCube | `[{mes: "2026-07", dia: 8, monto: 12000}]`, histórico acumulado (ver abajo) |
| `tickets` | json | IspCube | `{abiertos, cerrados, ultimo: {fecha, categoria, estado}}` |
| `tickets_vistos_hasta` | date | Cartera | Marca de "leído" para la alerta de tickets |
| `sincronizado` | date | Cartera | Última sincronización con IspCube |
| `archivado` | bool | Cartera | Saca al cliente de la vista sin borrar el historial |

**Índice único: `(asesor, code)`.**

**Reglas de acceso** (list, view, create, update, delete):

```
@request.auth.id != "" && asesor = @request.auth.id
```

Cuando se sumen roles, la regla pasa a `… || @request.auth.rol = "admin"` sin migrar datos.

`perfil_pago` se deriva de `entity_id` contra `cartera_config` en cada sincronización, salvo que el asesor lo haya fijado a mano. Se guarda desnormalizado en el registro para que la lista y las alertas no dependan de resolver el catálogo en cada render.

### `cartera_notas`

La bitácora de contactos.

| Campo | Tipo | Notas |
|---|---|---|
| `cliente` | relation → `cartera_clientes` | |
| `autor` | relation → `users` | |
| `tipo` | select | `llamada` \| `whatsapp` \| `visita` \| `nota` |
| `texto` | text | |
| `created` | auto | De PocketBase |

`llamada`, `whatsapp` y `visita` **cuentan como contacto** y apagan la alerta de los 2 meses. `nota` no: sirve para dejar contexto sin cerrar el pendiente.

Las reglas de acceso se apoyan en la relación: solo el dueño del cliente ve y escribe sus notas.

### `cartera_config`

Un único registro con la configuración que hoy solo vive en la cabeza de alguien.

| Campo | Tipo | Default |
|---|---|---|
| `entidades_tarjeta` | json | `[]` — ids de `entities_list` que cuentan como tarjeta |
| `areas_soporte` | json | `[]` — ids de `areas_list` que cuentan como soporte |
| `dia_corte_1` | number | `10` |
| `dia_corte_2` | number | `20` |
| `dia_corte_tarjeta` | number | `21` |

Se llena una vez desde el panel, leyendo los catálogos reales de IspCube. Con `entidades_tarjeta` vacío todos los clientes son `ventanilla`; con `areas_soporte` vacío cuentan los tickets de todas las áreas. Ambos defaults son deliberados: el panel funciona antes de configurarse, solo que menos afinado.

## Reglas de negocio

Todo lo de esta sección vive en módulos puros bajo `src/lib/cartera/`, sin red ni acceso a PocketBase. Es la parte que más va a cambiar con el uso.

### Perfil de pago y días de corte

| Perfil | Cortes | Cómo se decide |
|---|---|---|
| `ventanilla` | día `dia_corte_1` (10) y día `dia_corte_2` (20) | La entidad del cliente **no** está en `entidades_tarjeta` |
| `tarjeta` | día `dia_corte_tarjeta` (21) | La entidad del cliente está en `entidades_tarjeta` |

### Cuándo se considera que pagó

**Existe una cobranza cuyo `real_date` cae dentro del mes.**

`real_date`, no `date`: en IspCube esos dos campos pueden diferir por meses, y el que dice cuándo pagó de verdad es `real_date`.

### Cuánto historial de pagos hay realmente

`cash_last_six_monts` devuelve **las últimas 6 cobranzas**, no seis meses. Un cliente que paga dos veces por mes deja apenas tres meses de historia; uno que paga una vez, seis.

Por eso el campo `pagos` **acumula**: cada sincronización mezcla las cobranzas nuevas con las ya guardadas en vez de reemplazarlas, y se podan las anteriores a 12 meses. Un cliente recién agregado arranca con lo que dé la API, y su historia se completa sola con el uso.

La UI muestra **6 meses** de puntos, que es lo que se puede garantizar desde el primer día.

### Los puntitos de pago

Un punto por mes, últimos 6:

| Color | Condición |
|---|---|
| Verde | Pagó dentro de su ventana (≤ día 10 en ventanilla, ≤ día 21 en tarjeta) |
| Amarillo | Pagó después de su ventana pero dentro del mes |
| Rojo | No hubo cobranza en el mes |
| Gris | El mes es anterior a la fecha de instalación |

El gris importa: sin él, un cliente de dos meses aparece con diez meses en rojo.

### Las cuatro alertas

| Alerta | Condición | Cómo se apaga |
|---|---|---|
| **Seguimiento 2 meses** | Pasaron 2 meses desde `fecha_instalacion` y no hay ninguna nota de tipo contacto posterior a esa fecha | Cargando una nota de tipo `llamada`, `whatsapp` o `visita` |
| **Mora primer corte** | Hoy pasó el día de corte 1 (o el de tarjeta) y no hay cobranza en el mes corriente | Sola, cuando aparece la cobranza |
| **Mora segundo corte** | Hoy pasó el día de corte 2 y sigue sin cobranza en el mes. **Solo para `ventanilla`** — en tarjeta el día 21 es el único hito | Sola |
| **Tickets nuevos** | Hay tickets de un área de soporte creados después de `tickets_vistos_hasta` | Abriendo el detalle del cliente |

Las alertas se calculan sobre el snapshot local, así que la lista es instantánea y sigue funcionando con IspCube caído.

**Precisión de la mora:** una alerta de mora es tan fresca como el snapshot. Si el snapshot es del día 5 y hoy es 12, la Cartera no sabe si pagó el 8 y mostraría una mora falsa.

Por eso al abrir la lista se refrescan snapshots vencidos, con un presupuesto explícito:

- Solo los que tengan `sincronizado` de hace **más de 12 horas**.
- **Máximo 20 clientes por apertura**, para que el costo de abrir el panel esté acotado pase lo que pase.
- Se priorizan los clientes cuyo día de corte pasó dentro de los últimos 3 días — son los que pueden estar mostrando una mora falsa.

Con la estrategia en bloque el presupuesto deja de importar, porque el costo no depende de cuántos clientes se refresquen. La UI siempre muestra de cuándo son los datos.

## Arquitectura

### Autorización de los endpoints

Hoy ningún endpoint del servidor autentica administradores: Llamenme lee PocketBase directo desde el navegador y la seguridad la ponen las reglas de la colección.

Acá el servidor hace de proxy a IspCube, y **un endpoint sin guardia dejaría enumerar toda la base de clientes** a cualquiera que descubra la URL.

Pieza nueva, `src/lib/server/adminAuth.js`: toma el token de PocketBase del header `Authorization`, lo valida contra PocketBase y devuelve el id del asesor. Sin token válido, 401. No necesita secretos compartidos ni cuenta de servicio.

### Quién escribe el snapshot

El servidor **no** escribe en PocketBase: devuelve los datos frescos y el navegador los guarda con el token del propio asesor.

Así se reutilizan las reglas de la colección y no hace falta una cuenta de servicio con permisos amplios. La contracara es que un asesor autenticado podría escribir un snapshot falso en su propia cartera; es un empleado con acceso legítimo a esos datos y el riesgo se consideró aceptable.

### Estrategia de sincronización

Dos implementaciones detrás de una sola función:

| Estrategia | Cartera de 100 | Cartera de 500 | Estado |
|---|---|---|---|
| **Por cliente** — `/api/customer?code=` + `/api/tickets?code=` + `/api/cash/cash_last_six_monts?code=` | ~300 requests | ~1500 | Verificada |
| **En bloque** — `customers_list` paginado + `cash_list` + `tickets_list` | ~7 requests | ~7 | **Sin verificar** |

La de bloque aprovecha que `cash_list` devuelve todas las cobranzas de los últimos 30 días de la empresa en un request, y que `customers_list` y `tickets_list` están cacheados del lado de IspCube y traen el cliente embebido.

Es dramáticamente más barata, pero depende de dos cosas que **hay que medir antes**: qué `limit` máximo acepta `customers_list`, y cuántos clientes tiene la base de Sista.

**Decisión:** implementar primero la de por-cliente, que se sabe que funciona, detrás de una interfaz `sincronizar(codes)`. Sondear la de bloque como primer paso de la implementación; si el sondeo cierra, cambiar la implementación es un cambio local.

### Reparto de costos por acción

| Acción | Requests a IspCube |
|---|---|
| Abrir la lista de la cartera | **0**, más el refresco acotado (≤ 20 clientes) |
| Abrir el detalle de un cliente | 3, y refresca su snapshot |
| Agregar un cliente | 3 — la llamada que valida el número es la misma que arma el snapshot |
| Botón "Actualizar cartera" | Según la estrategia vigente |

### Módulos

**Servidor** — `src/lib/server/ispcube.js` suma `getTickets`, `getCobranzas`, `getEntidades` y `getCatalogos`, más el caché de token. Mantiene la propiedad que ya tiene: no lee `$env`, la config entra por parámetro desde `ispcubeDeps.js`.

**Endpoints** — bajo `src/routes/api/cartera/`:

| Ruta | Qué hace |
|---|---|
| `GET /api/cartera/cliente/[code]` | Detalle en vivo: cliente + tickets + cobranzas, normalizado |
| `POST /api/cartera/sync` | Recibe `{codes: [...]}`, devuelve snapshots frescos |
| `GET /api/cartera/catalogos` | Entidades y catálogos de tickets, cacheados en memoria del servidor |

Los tres pasan por `adminAuth`. Los catálogos son estables: se cachean en memoria del proceso para no gastar cuota en cada apertura de la configuración.

**Lógica pura** — `src/lib/cartera/`:

| Módulo | Responsabilidad |
|---|---|
| `pagos.js` | Cobranzas + perfil + fecha de instalación → los puntos por mes |
| `alertas.js` | Cliente + notas + hoy → alertas activas |
| `normalizar.js` | Respuestas de IspCube → la forma del snapshot |

Cada uno se entiende y se testea sin levantar nada. Siguen el patrón de `llamenmeLogic.js`.

**UI** — `src/routes/admin/_components/mantenimiento/Dashboard/cartera/`:

| Componente | Responsabilidad |
|---|---|
| `Cartera.svelte` | Lista, buscador, filtro por tipo de alerta |
| `AgregarCliente.svelte` | Nro → valida contra IspCube → confirmás el nombre → cargás la fecha de instalación |
| `ClienteDetalle.svelte` | Datos, puntos de pago, tickets, bitácora |
| `carteraStore.svelte.js` | Estado y sincronización, siguiendo `llamenmeStore.svelte.js` |

Más una entrada en `Sidebar.svelte` con punto de notificación cuando hay alertas, y una rama en `Content.svelte`.

## Manejo de errores

`ispcube.js` ya distingue `config`, `auth`, `api`, `network`, `not_found`, `invalid`. La Cartera se apoya en eso:

| Situación | Comportamiento |
|---|---|
| IspCube caído al abrir la lista | La lista funciona con el último snapshot y un cartel "datos del \<fecha\>" |
| IspCube caído al abrir el detalle | Se muestran los datos del snapshot y un aviso de que no se pudo refrescar |
| Número de cliente inexistente al agregar | "No encontramos ese número de cliente" |
| Token de PocketBase vencido | 401 del endpoint → el panel manda al login, igual que hoy |
| Cliente ya en la cartera | El alta lo detecta y ofrece abrir el existente |

Ninguna falla de red deja la pantalla en blanco: siempre hay snapshot que mostrar, salvo en el alta.

## Tests

Con vitest, siguiendo lo que ya hay.

**Módulos puros** — el grueso de la cobertura. Casos de borde que importan:

- Pago exactamente el día del corte (día 10 y día 21).
- Cliente de tarjeta: que el corte del día 20 **no** se le aplique.
- Meses anteriores a la instalación → gris, no rojo.
- Cliente de menos de dos meses → sin alerta de seguimiento.
- Nota de tipo `nota` → **no** apaga la alerta de los 2 meses; `llamada` sí.
- Nota de contacto anterior a la fecha de instalación → no cuenta.
- `real_date` y `date` distintos → manda `real_date`.
- Mes sin cobranzas y mes sin factura.

**Funciones de red** — inyectando `fetchImpl`, como `ispcube.test.js`.

**Restricción:** ningún test toca `createTicket`, que crea tickets reales en el IspCube de producción.

## Supuestos explícitos

1. **Un cliente puede estar en la cartera de dos asesores.** El índice único es `(asesor, code)`, no `code`. Es lo razonable mientras no haya roles; si se quiere dueño único, cambia el índice y el alta avisa que el cliente ya está asignado.
2. **Los catálogos de IspCube son estables.** Se cachean en memoria del proceso y se refrescan al reiniciar o desde el panel de configuración.
3. **La cartera crece ~30 clientes por mes en total**, uno o dos por día por asesor. En un año cada asesor ronda los 100+. El diseño asume ese orden de magnitud, no miles.
4. **El asesor conoce la fecha de instalación** al momento de agregar el cliente. Si no, puede cargarla después; sin ella no se calcula la alerta de los 2 meses.

## Pendientes antes de implementar

1. Sondear el `limit` máximo de `customers_list` y el tamaño de la base, para decidir la estrategia de sincronización.
2. Leer el consumo real de API en el tablero de IspCube.
3. Leer `entities_list` de Sista para saber qué entidades corresponden a tarjeta y poder cargar `cartera_config`.

Ninguno bloquea el arranque: los tres son pasos tempranos del plan de implementación.

## Resultados del sondeo (2026-08-03)

Sondeo de solo lectura contra la API de producción de IspCube (`GET /api/customer/summary`, `GET /api/customers/customers_list`, `GET /api/cash/entities_list`, `GET /api/tickets/areas_list`, `GET /api/tickets/status_list`, `GET /api/cash/cash_list`, más el `POST` de autenticación). Script temporal, borrado después de este sondeo.

### Tamaño de la base y cuota

`GET /api/customer/summary`:

```json
{ "customers": 8325, "customers_with_active_connection": 8437, "connections": 10554 }
```

- **Cuota mensual = 2,5 × conexiones = 2,5 × 10554 ≈ 26.385 requests/mes**, compartida por todas las integraciones de Sista (no solo la Cartera).
- Dato curioso sin impacto en el diseño: `customers_with_active_connection` (8437) es mayor que `customers` (8325). Probablemente `summary` cuenta conexiones activas de clientes dados de baja, o clientes con más de una conexión se computan distinto en cada campo. No se investigó más porque no condiciona ninguna decisión de este documento.

### `limit` máximo de `customers_list`

Se probaron los límites 25, 100, 500 y 1000: los cuatro devolvieron exactamente esa cantidad de registros, sin error ni truncamiento.

```
customers_list limit=25:   status=200 devolvió=25
customers_list limit=100:  status=200 devolvió=100
customers_list limit=500:  status=200 devolvió=500
customers_list limit=1000: status=200 devolvió=1000
```

**No se probaron límites mayores a 1000** para no gastar cuota de más en un sondeo — la consigna era medir si la estrategia en bloque es viable, y con 1000 ya alcanza para la decisión. El límite real podría ser mayor; **1000 es una cota inferior confirmada**, no el máximo exacto.

### Decisión: estrategia de sincronización

Con `limit=1000` confirmado, traer **toda la base** de clientes por `customers_list` toma `ceil(8325 / 1000) = 9` requests. Sumando `cash_list` (1 request) y `tickets_list` (no se probó en este sondeo, se asume del mismo orden que `cash_list` por estar igual de cacheado del lado de IspCube) más algún request de catálogos, la estrategia en bloque queda en **~10-12 requests, prácticamente constante sin importar cuántos clientes tenga la cartera** (porque no se puede filtrar por cartera: siempre se trae la base entera y se filtra localmente).

Comparado con la de por-cliente (~3 requests × tamaño de la cartera), el punto de equilibrio es una cartera de apenas **~3-4 clientes**. Dado que el supuesto del spec es que cada asesor ronda **~100+ clientes** en un año (ver "Supuestos explícitos", punto 3), **la estrategia en bloque es la que conviene, y por un margen amplio** — no es un empate técnico. Esto confirma la estimación original del spec (~7 requests) dentro del mismo orden de magnitud.

**Recomendación:** implementar directamente la estrategia en bloque en vez de arrancar por la de por-cliente. La sección "Estrategia de sincronización" de este documento debería actualizarse en la task de implementación correspondiente para reflejar esto (no se edita acá para no mezclar el sondeo con una decisión de arquitectura que toca otra sección).

### Entidades de cobranza (`entities_list`) — cuáles son tarjeta

La respuesta trae 280 entidades; la mayoría son series históricas deshabilitadas (`enabled=0`, ej. `galicia1..5`, `frances1..5`, `icbc1..5`, etc.). Estas no importan para configurar `cartera_config` porque ningún cliente activo puede estar cobrándose por una entidad deshabilitada hoy. La tabla siguiente cubre **todas las entidades con `enabled=1`** (38 de 280):

**Claramente tarjeta:**

| id | name |
|---|---|
| 152 | `tarjeta de credito` |
| 64 | `visaprismacredito1` |

**Dudosas — necesito que confirmes:**

| id | name | Por qué es dudosa |
|---|---|---|
| 153 | `Tarjeta de debito` | Es tarjeta, pero **débito**, no crédito. El spec dice que a "tarjeta" se le controla el pago cerca del día 21 (por la demora de acreditación); no sé si esa regla es solo para crédito o para cualquier tarjeta. |
| 59 | `visaprismadebito1` | Mismo caso: débito vía Prisma. |
| 54 | `mastercardprisma1` | No dice si es crédito o débito (a diferencia de la serie Visa, que sí distingue `visaprismacredito` de `visaprismadebito`). Hay una serie separada `mastercarddebito1..5` (ids 262-266) pero está deshabilitada, lo que sugiere que `mastercardprisma1` podría ser la única activa y cubrir ambos casos, o ser específicamente crédito. No lo puedo inferir del nombre. |
| 99 / 199 | `mercadopago1` / `MERCADO PAGO (PP)` | Billetera virtual: puede acreditar pagos hechos con tarjeta dentro de Mercado Pago, pero como entidad de cobranza es un canal aparte, no una tarjeta. |
| 89 | `siro1` | SIRO es una red de débito automático bancario en Argentina, no tarjeta — pero lo marco dudosa porque no estoy seguro de cómo lo usa Sista puntualmente. |
| 69 | `pagomiscuentasbanelco1` | Pago de cuentas vía Banelco (red de cajeros/homebanking) — probablemente no es tarjeta, pero no es un "no" tan claro como caja o transferencia. |
| 109 | `linkpagos1` | Agregador de pagos (Red Link) — mismo caso que Banelco/SIRO. |
| 114 / 124 / 129 | `rapipagoconbaseengire1` / `pagofacilsantanderrio1` / `pagofacil1` | Puntos de cobro en efectivo (Rapipago, Pago Fácil) — probablemente `ventanilla`, no tarjeta, pero los marco por las dudas dado que no son un "no" evidente como `EFECTIVO` o `CAJA NICOLAS`. |

**Claramente NO tarjeta** (cajas, transferencias, depósitos bancarios, retenciones, ajustes contables internos):

`Cobranzas`(1), `Caja`(2), `Proveedores`(3), `CAJA NICOLAS`(136), `CAJA MAXIMILIANO`(147), `CAJA MARCELA`(148), `OTRAS CAJAS A RENDIR`(149), `DEBITOS BANCARIOS`(150), `TRANSFERENCIA BANCARIA`(151), `INGRESOS VARIOS`(154), `TESTA NICOLAS`(155), `BANCO`(156), `PAGOS VARIOS`(157), `RETENCION MUNCIPAL`(169), `BANCO CREDICOOP`(175), `BANCO NACIÓN`(176), `BANCO PROVINCIA`(177), `BANCO GALICIA`(178), `BANCO CIUDAD`(179), `CHEQUE`(181), `EFECTIVO`(187), `AJUSTE DE CENTAVOS`(198), `RETENCIÓN IIBB 2`(200), `CAJA KAREN`(201), `CAJA FELIPE M.`(202), `Celina Lasserre`(214, parece caja de una persona), `CAJA F. TAGLIA`(215), `FONDO DE REPARO MUNICIPALIDAD DE ENSENADA`(236).

**Pendiente de tu confirmación:** con la lista de dudosas de arriba, decime cuáles entran en `entidades_tarjeta`. Mientras tanto `cartera_config.entidades_tarjeta` puede arrancar solo con `[152, 64]` (las dos inequívocas) y ajustarse después sin migrar datos.

### Áreas de tickets (`areas_list`) — cuál es soporte

```
id=1  Soporte
id=2  Ventas
id=3  Administracion
id=12 OBRAS
```

Sin ambigüedad: **`areas_soporte = [1]`**.

### Estados de ticket (`status_list`) — cuáles significan cerrado

Acá encontré un problema que no puedo resolver solo. `status_list` devuelve 26 estados que mezclan claramente **varios flujos distintos** (tickets de soporte, altas/obras, gestión de bajas), no solo el de soporte:

```
id=1  Abierto
id=2  Pendiente
id=3  Cerrado
id=4  RECOORDINAR
id=6  FINALIZADO
id=7  EN EJECUCION
id=8  ANULADO
id=9  PENDIENTE DE FACTURACION
id=10 PENDIENTE DE FIRMA
id=11 JN-VISTO PARA DESPUES DEL 20
id=12 CORTE POR BAJA ULTIMO DIA DEL MES
id=13 RESERVA PARA INSTALADOR
id=14 EN OBRAS-PENDIENTE
id=15 ANULADO POR AGENDA BOOT
id=16 NAP PENDIENTE DE ACTIVAR
id=17 CHECK BAJA TV -ULTIMO DIA DEL MES
id=20 IMPOSIBILIDAD DE CONTACTO
id=21 EQUIPO RETIRADO/ENTREGADO EN OFICINA
id=22 EN GESTION DE COBRANZA
id=23 RETENCION
id=24 BOCA A LIBERAR
id=26 SUSPENDIDO EN ANTINA
id=28 DEVUELTO
id=31 pendiente  de facturar
id=32 pendiente de aceptacion del cliente
id=33 pendiente de presentar presupuesto
```

- **Claramente cerrado:** `Cerrado` (3) — es el único cuyo nombre es inequívoco.
- **Dudosos, probablemente también "cerrado" en el sentido de "ticket ya no está activo":** `FINALIZADO` (6) y `ANULADO` (8). Si un ticket anulado o finalizado no cuenta como cerrado para la alerta de tickets, un ticket viejo en ese estado seguiría contando como "nuevo" indefinidamente.
- **El resto** (`RESERVA PARA INSTALADOR`, `EN OBRAS-PENDIENTE`, `NAP PENDIENTE DE ACTIVAR`, `CORTE POR BAJA...`, `CHECK BAJA TV...`, etc.) tiene toda la pinta de pertenecer a otros flujos (instalación/obras, gestión de bajas), no a tickets de soporte. Este sondeo no filtra `status_list` por área, así que **no puedo confirmar si esos estados siquiera aparecen alguna vez en tickets del área Soporte (id=1)**.

**Pendiente de tu confirmación:** qué ids además de `3` (Cerrado) cuentan como cerrado para tickets de **Soporte** específicamente. Si hace falta, un sondeo de seguimiento acotado (`GET /api/tickets/tickets_list?area=1&limit=...` o similar, filtrando por área) podría mostrar qué subconjunto de estados aparece realmente ahí — no se hizo en este sondeo porque no estaba en el guion original y para no gastar cuota de más sin que me confirmes que hace falta.

Mientras tanto, `cartera_config.estados_cerrados` puede arrancar con `[3]` y sumar `6` y `8` si confirmás que corresponden.

### `cash_list`

```
cash_list: status=200, 7780 movimientos
```

Confirma que `cash_list` devuelve un volumen grande en un solo request (consistente con "últimos 30 días de toda la empresa" que asume el spec) — barato en términos de requests, aunque la respuesta en sí es pesada. No se investigó la ventana de tiempo exacta que cubre porque no estaba en el guion del sondeo y no condiciona la decisión de estrategia (que ya está tomada arriba).
