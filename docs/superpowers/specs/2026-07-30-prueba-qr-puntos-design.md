# Prueba de QR para la plataforma de puntos: Design

**Fecha:** 2026-07-30
**Estado:** aprobado, pendiente de plan de implementación

## Problema

Sista quiere una plataforma de puntos para clientes: los comercios adheridos escanean el QR de un cliente y registran que hizo una compra. Antes de diseñar el modelo de puntos, comercios y compras, hace falta comprobar que el eslabón más incierto funciona — que un QR escaneado con la cámara del celular pueda resolverse contra la API de IspCube y mostrar quién es el cliente.

Esta prueba valida ese circuito y nada más:

**cámara → URL → API de IspCube → nombre en pantalla**

## Alcance

**Entra:**

- Un QR que codifica `https://ghostwhite-okapi-714606.hostingersite.com/puntos/003566`, escaneable con la cámara nativa de Android e iOS.
- Una página que consulta IspCube en el servidor y muestra el nombre del cliente.
- El texto "Sumar puntos a {nombre}" y un botón.
- El botón responde con una confirmación en pantalla.

**No entra:**

- Modelo de puntos, saldo, canje.
- Comercios: alta, identidad, autenticación del que escanea.
- Persistencia de la operación (ni PocketBase ni IspCube).
- Emisión masiva de QRs.

El botón no escribe en ningún lado **a propósito**: definir el esquema de datos ahora obligaría a decidir el modelo de puntos antes de saber si el circuito técnico cierra.

## Hallazgos verificados de la API

Sondeo directo contra `https://sista.ispcube.online` el 2026-07-30. No son supuestos: cada uno tiene su respuesta HTTP.

### Autenticación

`POST /api/sanctum/token` con `{username, password}` y los headers `api-key`, `client-id`, `login-type: api` devuelve `200` y el token en `data.token` (47 chars). Igual que hoy.

### Búsqueda por número de cliente

**`GET /api/customer?code=003566`** → `200`:

```json
{ "id": 7277, "code": "003566", "name": "TALONE SANDRA ELIZABETH", "status": "enabled", ... }
```

Son ~80 campos; los que importan acá son `code`, `name` y `status`.

Ninguna otra variante sirve: `customer_code` da `422`, y `client_code`, `nro_cliente`, `number`, `id`, `client_id` dan `500 "Indicar al menos un dato de busqueda"`.

### Tres restricciones que condicionan la implementación

1. **Hace falta un header `username`** con el valor de `ISPCUBE_USERNAME`, además de `api-key`, `client-id`, `login-type` y `Authorization: Bearer`. Sin él: `400 {"status":false,"message":"username header requerido"}`.

2. **El zero-padding es significativo.** `?code=3566` devuelve `404 {"result":true,"message":"Cliente no encontrado"}`. El código va tal cual: `003566`.

3. **No hay campos separados de nombre y apellido.** `name` viene como un solo string en mayúsculas con el apellido primero.

### Consecuencia fuera de alcance

`static/assets/client-handler.php` **no manda el header `username`**, así que su búsqueda por DNI recibe `400` y el PHP lo traduce a `'DNI not found in the database.'`. El formulario de solicitud de baja le está diciendo a todo cliente válido que su DNI no existe. Es un bug vivo de producción, ajeno a esta prueba, y se arregla por separado.

## Arquitectura

Rama nueva **desde `main`**, no desde `fase1-endpoints-node`. `main` ya tiene `build:node` y `server.js` funcionando (fase 0 cerrada) y esta prueba no necesita nada de los endpoints de formularios de la fase 1, así que las dos líneas de trabajo no se pisan.

| Archivo | Responsabilidad |
|---|---|
| `src/lib/server/ispcube.js` (crear) | `getAuthToken()` y `getCustomerByCode()`. **No importa `$env`**: recibe credenciales y `fetch` por parámetro. |
| `src/lib/server/ispcube.test.js` (crear) | Tests con `fetch` inyectado. |
| `src/lib/formatName.js` (crear) | `toTitleCase()`. Puro, sin dependencias. |
| `src/lib/formatName.test.js` (crear) | Tests del formateo. |
| `src/routes/puntos/[nro]/+page.server.js` (crear) | Capa fina: lee `$env/dynamic/private`, llama al módulo, devuelve `{nombre}`. `prerender = false`. |
| `src/routes/puntos/[nro]/+page.svelte` (crear) | La pantalla y sus estados. |
| `scripts/generar-qr.js` (crear) | Script one-off que emite el PNG del QR. |
| `svelte.config.js` (modificar) | `strict: false` en adapter-static. |
| `package.json` (modificar) | `qrcode` como devDependency. |

`ispcube.js` no importa `$env` por la misma razón que fijó el plan de la fase 1: los módulos que reciben sus secrets por parámetro se testean con Vitest sin los módulos virtuales de SvelteKit, y el punto donde se leen los secrets queda concentrado en la capa de rutas. Cuando la fase 1 porte `send-ticket-ispcube.php`, va a poder reusar el mismo módulo.

### El cambio en `svelte.config.js` no es opcional

`/puntos/[nro]` es la primera ruta **no prerenderizable** del repo. Sin `strict: false` en adapter-static, **`npm run build` falla** y con él se cae el deploy estático de `sista.com.ar`. Con el flag, la ruta simplemente no se emite en el build estático y producción queda exactamente como está hoy.

Es el mismo cambio que la fase 1 ya identificó como necesario. Quien llegue segundo se lo encuentra hecho; no hay conflicto, es la misma línea.

## Flujo de datos

1. La cámara abre `https://ghostwhite-okapi-714606.hostingersite.com/puntos/003566`.
2. `+page.server.js` toma `params.nro`.
3. Pide token a `/api/sanctum/token`.
4. Consulta `GET /api/customer?code=<nro>` con los cinco headers.
5. Devuelve `{ nombre: toTitleCase(data.name) }`.
6. La página muestra "Sumar puntos a Talone Sandra Elizabeth" y el botón.
7. El botón cambia el estado local a confirmado. No hay request.

El token se pide **en cada request**. Para una prueba alcanza y evita una capa de caché que todavía no sabemos cómo invalidar. Anotado abajo como deuda.

## Formato del nombre

`toTitleCase("TALONE SANDRA ELIZABETH")` → `"Talone Sandra Elizabeth"`: mayúscula inicial por palabra, resto en minúscula.

No se intenta separar nombre de apellido. La heurística "la primera palabra es el apellido" falla con apellidos compuestos (`"DE LA TORRE JUAN"` → `"La Torre Juan"`) y con razones sociales de clientes empresa. Mostrar el nombre completo tal como lo tiene el ISP también sirve mejor al propósito real de la pantalla: que el comercio confirme que escaneó al cliente correcto.

## Estados de la pantalla

| Estado | Cuándo | Qué se ve |
|---|---|---|
| Encontrado | `200` de la API | "Sumar puntos a {nombre}" + botón |
| Confirmado | Se tocó el botón | "¡Listo! Puntos sumados a {nombre}" |
| No encontrado | `404`, o `nro` con formato inválido | "No encontramos el cliente {nro}" |
| Error | Falla el auth, la red, o cualquier otro HTTP | "No pudimos consultar el sistema. Probá de nuevo." |

**Formato válido:** solo dígitos, entre 1 y 12 caracteres (`/^\d{1,12}$/`). El valor se pasa a la API **tal cual**, sin normalizar ni rellenar con ceros — el zero-padding es significativo y adivinarlo produciría un `404` confuso.

Un número mal formado se resuelve **sin llamar a la API** y cae en "no encontrado": el mismo mensaje que un cliente inexistente, para no confirmarle a quien sondea si un código existe.

El detalle técnico del error nunca llega al navegador; va al log del servidor.

### `status` del cliente

La API devuelve `status: "enabled"`. Esta prueba **lo ignora**: muestra la pantalla igual para un cliente dado de baja o suspendido. Decidir si un cliente inactivo puede sumar puntos es una regla de negocio de la plataforma real, no de este circuito.

## Generación del QR

`scripts/generar-qr.js` toma un número de cliente y la URL base, y emite un PNG. Se corre a mano; no es parte del build.

El QR se genera **después** de que la página esté andando en el subdominio, para codificar una URL ya verificada. Un QR impreso apuntando a una URL rota es el peor resultado posible de esta prueba.

## Testing

- `ispcube.test.js`, con `fetch` inyectado: auth OK, auth falla, cliente encontrado, `404`, error de red, y que los cinco headers salgan en la request.
- `formatName.test.js`: mayúsculas, minúsculas, mixto, espacios múltiples, string vacío, una sola palabra.
- Sin test del `+page.server.js`: es un adaptador fino sobre módulos ya cubiertos.
- Los dos builds tienen que seguir andando: `npm run build` emite el estático **sin** `/puntos/`, y `npm run build:node` **con** la ruta.
- Verificación final: escanear el QR con el celular y ver el nombre.

## Deuda asumida a conciencia

1. **La ruta es enumerable.** Con el número en claro, `/puntos/003567` muestra el nombre de otro cliente. Mitigación mínima acá: `noindex` en la página, reusando `src/lib/server/robotsHeader.js`, para que no la indexe Google. **Es lo primero a resolver antes de que esto sea real** — las opciones ya evaluadas son un token opaco por cliente o el número firmado con HMAC.
2. **Sin caché del token.** Un login por visita. Con volumen real conviene cachearlo en memoria del proceso.
3. **`status` ignorado.** Ver arriba.
4. **Sin identidad del comercio.** Cualquiera con el link ve la pantalla. La plataforma real necesita que el que escanea esté autenticado.

## Pasos manuales

1. Las variables `ISPCUBE_API_URL`, `ISPCUBE_USERNAME`, `ISPCUBE_PASSWORD`, `ISPCUBE_API_KEY` e `ISPCUBE_CLIENT_ID` tienen que estar cargadas en el entorno de la app Node en hPanel (`ghostwhite-okapi-714606.hostingersite.com`, usuario `u784612252`). Sin ellas la página devuelve el estado de error para cualquier número.
2. El deploy al subdominio va por git contra el endpoint REST de Hostinger, no por el MCP: el wrapper hardcodea `source_type: archive` y no corre el build.

Ninguno de los dos toca `sista.com.ar`.
