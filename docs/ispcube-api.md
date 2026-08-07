# API de IspCube — referencia

Relevado el 2026-08-03 desde <https://apidoc.ispcube.com/>.

La documentación pública es una **colección de Postman publicada**, no un OpenAPI.
La página es una SPA vacía para un `curl` común; el JSON con los 59 endpoints
está en:

```bash
curl -s "https://apidoc.ispcube.com/api/collections/6765089/2sBY4HUPnG?segregateAuth=true&versionTag=latest"
```

Los ejemplos de la colección usan el host ficticio `ispdomain.com`. El de Sista
es `ISPCUBE_API_URL` (`https://sista.ispcube.online`).

---

## Autenticación

Dos capas que van **siempre juntas**:

1. **Credenciales de aplicación**, en headers, en todas las llamadas:

   | Header | Valor |
   |---|---|
   | `api-key` | `ISPCUBE_API_KEY` |
   | `client-id` | `ISPCUBE_CLIENT_ID` |
   | `login-type` | literal `api` |
   | `username` | `ISPCUBE_USERNAME` |

2. **Bearer token** de `POST /api/sanctum/token`, con `{username, password}` en
   el body. **Dura 24 h.**

```
Authorization: Bearer 5|UdaQdRYxaOQfVSinqLbZIlUtuDinqt60WwWUGfGZ
```

### Dos trampas verificadas contra producción

**`login-type` y `username` no son opcionales.** Sin cualquiera de los dos, la
llamada responde `400 {"status": false, "message": "<header> requerido"}`
*aunque el bearer sea válido*. Es exactamente lo que le falta a
`static/assets/client-handler.php`, y la razón de que su búsqueda por DNI
devuelva "DNI not found" para todo cliente válido. Ver el comentario en
[`ispcube.js`](../src/lib/server/ispcube.js).

**La forma de la respuesta del token no está fija.** El doc la muestra como el
token pelado (`5|UdaQ…`); en producción llega como `{"token": "..."}`. El PHP
original leía `data.token` y por eso su fallback de auth nunca devolvía nada.
`getAuthToken` acepta `data.token` y `data.data.token`, y conviene que siga
siendo tolerante.

### Permisos

Casi todos los endpoints cierran su descripción con "Requiere permiso para
listar X". Los permisos son del **usuario** de IspCube, no de la API key: si un
endpoint devuelve 403, el arreglo es del lado de IspCube, no del código.

---

## Modelo de consumo (importante)

IspCube **mide y factura los requests** en instalaciones cloud (no aplica a
on-premise; Sista está en cloud, `sista.ispcube.online`).

- **Incluido por mes: `2,5 × conexiones activas`.**
  1.000 conexiones → 2.500 requests. 3.000 conexiones → 7.500 requests.
- Período mensual con **corte el día 28**.
- El excedente se factura por request.
- Hay un panel de consumo dentro del tablero de IspCube para ver el acumulado
  del período.

Ese presupuesto lo comparten *todas* las integraciones de Sista. Hoy consumen:
el alta de tickets de baja, la pantalla de puntos y (a futuro) la Cartera de
clientes. Cualquier diseño que consulte en vivo por cliente hay que medirlo
contra esta cuota antes de darlo por bueno.

---

## Endpoints

Rutas relativas al host. Los ejemplos de query string son los de la colección;
salvo aclaración, **los parámetros de filtro son opcionales y combinables**.

### Login

| Método | Ruta | Qué hace |
|---|---|---|
| `POST` | `/api/sanctum/token` | Devuelve el bearer token (24 h de validez). |
| `POST` | `/api/status` | Estado operativo de la API. |

### Clientes

| Método | Ruta | Qué hace |
|---|---|---|
| `GET` | `/api/customer?customer_id=&code=&doc_number=&phone_number=&deleted=&temporary=` | Toda la info de **un** cliente. |
| `GET` | `/api/customers/customers_list?doc_number=&limit=&offset=` | Listado de clientes. **Cacheado** — el doc recomienda éste por sobre consultas sueltas. |
| `GET` | `/api/customer_paymethod?customer_id=&code=&doc_number=` | Versión **reducida** de "ver cliente", para integraciones de medios de pago. Devuelve poco más que `debt`/`duedebt`. *No* devuelve el medio de pago. |
| `GET` | `/api/customer/summary` | Totales: `customers`, `customers_with_active_connection`, `connections`. |
| `PUT` | `/api/customers/:id` | Actualiza **medio de pago** (`entity_id`), documento, teléfonos, emails y CBUs. |
| `POST` | `/api/customers/paycomm` | Genera un compromiso de pago (`{customer_id, date, apply_surcharge}`). |
| `POST` | `/api/customers/geolocation` | Actualiza lat/lng del cliente. |

#### Campos de `GET /api/customer`

Los que importan para la Cartera:

| Campo | Significado |
|---|---|
| `code` | Número de cliente **con ceros** (`"003365"`). El zero-padding es significativo: `3566` ≠ `003566`. |
| `name` | En MAYÚSCULAS tal como viene. `toTitleCase` en [`formatName.js`](../src/lib/formatName.js) lo normaliza. |
| `start_date` | **Fecha de alta** (`"2014-04-01 00:00:00"`). |
| `enable_date` | Fecha de habilitación. En los ejemplos suele venir `null`. |
| `status` | `enabled`, `no_service`, … |
| `debt` / `duedebt` | Deuda total / **deuda vencida**, como string decimal. |
| `block` / `block_date` | Bloqueo por mora. |
| `entity_id` + `entity {id, name}` | **El medio de pago.** Ver abajo. |
| `comercial_activity` | Texto libre dentro de "datos personales" (sí, con ese typo). Normalmente es la actividad comercial real, pero cuando dice exactamente `"FACTURA EN DEBITO AUTOMATICO"` es la marca de débito automático con tarjeta (sondeado en el cliente 003566). Vacío no cuenta como tarjeta. |
| `first_expiration_date`, `second_expiration_date` | Días de vencimiento 1.º y 2.º. Pueden venir `0` o `null`. |
| `expiration_type_id` | Esquema de vencimiento. |
| `seller_id` | Vendedor asignado *en IspCube*. |
| `collector_id` | Cobrador asignado. |
| `doc_number` | **Documento del titular.** DNI pelado (`"20909528"`) o el CUIT/CUIL entero. La Cartera lo guarda crudo y lo interpreta [`edad.js`](../src/lib/cartera/edad.js) para estimar la edad. |
| `city {id, name, province, postal_code}` | **Ciudad del cliente.** La Cartera guarda `city.name` (`"PUNTA LARA"`, en mayúsculas) en `ciudad`. |
| `phones[]`, `contact_emails[]`, `connections[]`, `customer_cbu[]` | Anidados. |

> **`entity_id` es el medio de pago.** No hay un campo `payment_method`. Lo
> confirma la descripción del `PUT /api/customers/:id` ("aquí puedes actualizar
> el medio de pago…"), cuyo único campo de pago es `entity_id`. El catálogo de
> entidades sale de `GET /api/cash/entities_list`. Para saber si un cliente paga
> con tarjeta hay que mirar a qué entidad apunta **o** si `comercial_activity`
> trae la marca de débito automático — `perfilDe()` en
> [`normalizar.js`](../src/lib/cartera/normalizar.js) usa cualquiera de las dos
> señales, sin inferir nada más.

#### `GET /api/nodes/:node_id/customers_list` devuelve más

Es el payload de cliente **más rico** de toda la API. Además de lo anterior trae:

`real_duedebt`, `archived_debt`, **`duedebt_date`** (fecha en que la deuda quedó
vencida), `prepaid_duedate`, `plan_code_list`, `plan_name`, `plan_price`,
`node_code`, `node_name`, `ap_code`, `ap_name`, `access_router_name`, `ips`,
**`tickets_open`**, **`tickets_closed`**, `collector_name`, `seller_name`,
`business_name`, `last_login`, `last_login_app`, `portal_password`.

`tickets_open`/`tickets_closed` vienen ya agregados, y `duedebt_date` evita
tener que deducir desde cuándo un cliente está en mora. La contra es que el
corte es **por nodo**, no por cliente.

### Tickets

| Método | Ruta | Qué hace |
|---|---|---|
| `GET` | `/api/tickets?ticket_id=&customer_id=&code=&doc_number=&category=&status=&priority=&area=` | Tickets de un cliente (array), con `items[]` (el hilo de mensajes). |
| `GET` | `/api/tickets/tickets_list?closed=&category=&status=&priority=&limit=&offset=` | Listado general. **Cacheado**, recomendado por el doc. Trae el `customer` embebido. |
| `GET` | `/api/tickets/category_list` | Catálogo de categorías (`id`, `name`, `color`, `ticketarea_id`). |
| `GET` | `/api/tickets/status_list` | Catálogo de estados (`1 Abierto`, `2 Pendiente`, …). |
| `GET` | `/api/tickets/areas_list` | Catálogo de áreas (ej. `6 Soporte Tecnico`). |
| `GET` | `/api/tickets/priority_list` | Catálogo de prioridades. |
| `POST` | `/api/ticket/new_ticket` | Crea un ticket. |
| `PUT` | `/api/ticket/:id` | Modifica un ticket / agrega un item al hilo. |

Un ticket trae `ticket_area_id`, `ticket_category_id`, `ticket_priority_id`,
`ticket_status_id`, `assigned_user_id`, `created_at`, `visit_date`, `price` y
`items[]` con `{content, internal, user{name}, created_at}`. Los ids se traducen
con los cuatro `*_list`, que son **estables**: conviene cachearlos y no pedirlos
por cliente.

Body de alta (`new_ticket`):

```json
{
  "ticket_status_id": 1, "ticket_category_id": 1, "assigned_user_id": 1,
  "connection_id": 1, "customer_id": 123,
  "item_content": "visible por el cliente",
  "internal_item_content": "no visible por el cliente",
  "files": [{ "base64": "…" }]
}
```

> **Ojo con el alta de tickets de baja.** `createTicket` en
> [`ispcube.js`](../src/lib/server/ispcube.js) postea a `/tickets` con un payload
> distinto (`subject`/`description`/`customer_id`/`customer_dni`), heredado del
> PHP. No es la ruta documentada acá. Funciona en producción, así que no se tocó,
> pero si alguna vez falla, `POST /api/ticket/new_ticket` es la forma
> documentada. **Crea tickets reales: nunca dispararlo desde un test.**

### Caja (cobranzas)

| Método | Ruta | Qué hace |
|---|---|---|
| `GET` | `/api/cash/cash_last_six_monts?customer_id=&code=&doc_number=` | **Últimas 6 cobranzas de un cliente.** (Sí, `monts` con esa falta de ortografía.) |
| `GET` | `/api/cash?cash_id=&customer_id=&code=&doc_number=` | Un comprobante de pago. |
| `GET` | `/api/cash/cash_list` | Movimientos de caja de los últimos 30 días. |
| `GET` | `/api/cash/entities_list` | **Catálogo de entidades de cobranza** (= medios de pago). |
| `GET` | `/api/cash/cash_list_paymethod?destiny_id=&date=` | Recaudos de una fecha por entidad. |
| `POST` | `/api/cash/payment_save` | Registra una cobranza (`{customer_id, amount, destiny_id}`). |
| `POST` | `/api/cash/payment_save_paymethod` | Idem, para medios de pago externos. |
| `POST` | `/api/cash/payment_delete_paymethod` | Reversa una cobranza. |
| `GET` | `/api/unprocessedpayments/unprocessedpayments_list` | Pagos sin procesar. |
| `GET` | `/api/mercadopago/button?idcustomer=&price=` | Botón de pago de MercadoPago. |

Una cobranza trae `total`, `date`, `real_date` (fecha/hora real del pago),
`comment`, `type` (`CO`), `source_id`/`destiny_id` (entidades) y `url` al
comprobante imprimible.

> `date` y `real_date` **pueden no coincidir** — en el ejemplo del doc, `date`
> es `2023-03-15` y `real_date` `2022-07-15`. Para saber *cuándo pagó de verdad*
> el campo es `real_date`.

Una entidad de `entities_list` trae `{id, name, paymethod, bank, enabled,
send, receive, selected_default}`.

### Facturas

| Método | Ruta | Qué hace |
|---|---|---|
| `GET` | `/api/bills/last_bill_api?customer_id=&code=&receiver_doc=&type=&tal=&monthly_bill=&canceled=` | Última factura de un cliente. |
| `GET` | `/api/bills/bills_last_six_months?…` | Últimas 6 facturas de un cliente. |
| `GET` | `/api/bills/bills_list?type=&tal=&monthly_bill=&canceled=` | Facturas de los últimos 30 días. |

Una factura trae `date`, **`due_date1` / `due_date2`** (1.º y 2.º vencimiento),
`total`, `customer_debt`, `canceled`, `status`, `month`/`nyear`, `items[]` con
la descripción del plan, y `url` al PDF.

### Conexiones

| Método | Ruta | Qué hace |
|---|---|---|
| `GET` | `/api/connection?connection_id=&customer_id=&code=&mac_address=&ip_address=&doc_number=` | Una conexión: `plan_id`, `node_id`, `olt_id`, `ftthbox_id`, `conntype`, `ip`. |
| `GET` | `/api/connections/connections_list` | Listado de conexiones. |
| `GET` | `/api/connections/count` | Cantidad de conexiones (útil para calcular la cuota de API). |
| `GET` | `/api/connections/connections_provisioning_logs?created_at=` | Movimientos del día para aprovisionamiento: `create_connection`, `delete_connection`, `equipment_change`, `plan_change`, `block_customer`, `enable_customer`, `edit_customer`. |
| `POST` | `/api/connections/geolocation` | Actualiza lat/lng. |
| `POST` | `/api/connections/change_wifi/:conn_id` | Cambia SSID y clave WiFi vía SmartOLT. |

### Planes, Nodos, FTTH, Inventario, Usuarios

| Método | Ruta | Qué hace |
|---|---|---|
| `GET` | `/api/plans/plans_list` | Catálogo de planes. |
| `GET` | `/api/nodes/nodes_list` | Catálogo de nodos. |
| `GET` | `/api/nodes/:node_id/customers_list` | Clientes de un nodo (payload enriquecido, ver arriba). |
| `POST` | `/api/nodes/geolocation` | Actualiza lat/lng del nodo. |
| `GET` | `/api/ftthboxes/ftthboxes_list` | Cajas FTTH. |
| `GET` | `/api/ftthbox/:id` | Una caja FTTH. |
| `POST` | `/api/ftthbox/geolocation` | Actualiza lat/lng de la caja. |
| `GET` | `/api/stockmovements?from_date=&to_date=` | Movimientos de stock. |
| `GET` | `/api/users/users_list?deleted=` | Usuarios de IspCube con rol y permisos. |

### Radius

| Método | Ruta | Qué hace |
|---|---|---|
| `GET` | `/api/radius/online_users?nasipaddress=` | Usuarios online. |
| `GET` | `/api/radius/online_user/:attribute/:value` | Busca por `username`, `framedipaddress`, `callingstationid` o `nasipaddress`. |
| `GET` | `/api/radius/attributes/:username` | Atributos Radius de un usuario PPPoE. |
| `GET` | `/api/radius/lost_carrier_users/:days` | Usuarios con cortes (Lost-Carrier) en N días. |
| `GET` | `/api/radius/duplicated_users` | Usuarios con más de una sesión activa. |
| `GET` | `/api/radius/traffic_statistics` | Ranking de tráfico. |

### Directv DGO

| Método | Ruta | Qué hace |
|---|---|---|
| `POST` | `/api/dgo/customers` | Crea el suscriptor. |
| `DELETE` | `/api/dgo/customers` | Elimina la suscripción (inmediato si el alta fue hace menos de 48 h; si no, a fin de mes). |
| `GET` | `/api/dgo/customer_find?user=` | URNs de un suscriptor, o `false`. |
| `POST` | `/api/dgo/block_enable` | Bloquea/habilita el servicio. |
| `POST` | `/api/dgo/add_urn_extra` | Agrega un pack extra. |
| `DELETE` | `/api/dgo/remove_urn_extra` | Quita un pack extra (misma regla de 48 h). |

### Extras

| Método | Ruta | Qué hace |
|---|---|---|
| `POST` | `/api/extras` | Crea un extra. |
| `DELETE` | `/api/extras/:id` | Borra un extra. |

---

## Cómo se usa en este repo

Todo pasa por [`src/lib/server/ispcube.js`](../src/lib/server/ispcube.js), que
no lee `$env`: la config entra por parámetro desde
[`ispcubeDeps.js`](../src/lib/server/ispcubeDeps.js). Las credenciales son las
`ISPCUBE_*` del `.env`.

Consumidores actuales:

- `POST /api/ticket-ispcube` → `createTicket` (alta de tickets de baja).
- `/puntos/[nro]` → `getCustomerByCode` (solo lectura).
