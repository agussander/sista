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
