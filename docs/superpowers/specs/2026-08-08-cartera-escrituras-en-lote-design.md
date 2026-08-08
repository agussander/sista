# Cartera: escrituras en lote contra PocketBase

**Fecha:** 2026-08-08
**Estado:** aprobado

## Problema

El 2026-08-06 la Cartera agotó el límite de requests por IP de PocketHost. El
culpable de aquel día —un `getFirstListItem` por candidato en el descubrimiento
por vendedor— ya se arregló con `buscarExistentes` (una sola consulta con un OR
de todos los codes). Queda el otro.

Hoy, cada apertura de la Cartera cuesta **23 requests a PocketBase desde el
navegador del asesor**, y 20 de esos son el mismo `update()` repetido: el loop
de `guardarSnapshot` en `carteraStore.svelte.js`, uno por cliente refrescado
(`MAX_POR_APERTURA` es 20).

Dos datos que encuadran el problema y descartan las soluciones equivocadas:

- **Las llamadas salen del navegador, no del servidor.** `carteraStore` corre en
  el cliente. La IP que se quedó sin cupo era la del asesor, no la de Hostinger.
  Mover las escrituras a los endpoints Node **empeoraría** el problema: hoy cada
  asesor gasta su propio cupo, y ahí todos compartirían la IP de la app.
- **`/api/cartera/sync` y `/api/cartera/candidatos` no cuentan.** Son `fetch` al
  servidor Node propio, no a PocketHost.

El techo por IP tampoco se administra: no es una cuota que se pueda repartir
mejor, es un corte. Con la cartera creciendo, vuelve.

## Diseño

Objetivo: bajar la apertura de **23 requests a 3**, sin cambiar ningún
comportamiento visible y sin volver obligatoria ninguna configuración del
servidor.

| | hoy | con este cambio |
|---|---|---|
| `cartera_config` | 1 | 0 (cacheado) |
| lista de clientes | 1 | 1 |
| recordatorios | 1 | 1 |
| snapshots (`update` × 20) | 20 | 1 |
| **total en régimen** | **23** | **3** |

En la primera apertura de un asesor nuevo se suman dos más: el
`buscarExistentes` de los candidatos y un lote de `create` (hoy son N `create`
sueltos, uno por candidato descubierto).

### 1. `src/lib/pbLote.js` — escritura en lote con degradación

Módulo nuevo, no específico de la Cartera, que expone `escribirLote(operaciones)`
y encapsula la única parte delicada del cambio.

**La Batch API de PocketBase es transaccional y todo-o-nada.** Si uno de los 20
`update` falla, se revierten los 20 y la llamada vuelve con error. Eso choca de
frente con dos propiedades que el código de hoy tiene a propósito:

- `guardarSnapshot` tiene try/catch por cliente: un snapshot que falla no tumba
  a los demás.
- El loop de `create` de candidatos tiene try/catch por candidato, y el
  comentario en `carteraStore.svelte.js` dice por qué: dos pestañas corriendo el
  descubrimiento a la vez rebotan contra el índice único `(asesor, code)`.

Un batch a secas rompe las dos. Por eso `escribirLote` degrada:

1. Intenta el lote. Si sale bien, devuelve los registros resultantes.
2. Si el lote falla **por cualquier motivo**, reejecuta las operaciones una por
   una, con try/catch individual, exactamente como hoy.

El caso bueno cuesta 1 request. El caso malo cuesta N+1 en vez de N, y el
comportamiento observable queda idéntico al actual.

La misma rama de degradación cubre el caso de que la Batch API esté **apagada**
en el servidor: PocketBase responde `403 {"message":"Batch requests are not
allowed."}`, que es lo que responde hoy `sista.pockethost.io`. El módulo se
acuerda de ese 403 en una variable de módulo por el resto de la sesión, para no
pagar un intento fallido en cada apertura.

**Consecuencia de diseño, y es la importante:** si nadie enciende la Batch API,
la Cartera sigue funcionando exactamente como hoy. El lote es una optimización,
nunca un requisito. Ninguna parte del código puede asumir que está disponible.

Chunking en grupos de 20: PocketBase topea el batch en 50 requests por defecto,
y el descubrimiento de candidatos puede traer decenas de altas de una.

El SDK ya instalado (`pocketbase@0.22.1`) trae `pb.createBatch()`. No hace falta
actualizar dependencias.

### 2. `construirParche` — separar el cálculo de la escritura

Para poder juntar los parches antes de mandarlos, `guardarSnapshot` se parte en
dos. El cálculo (perfil de pago, `alta_nap`, la transición de `instalado_aviso`,
`fusionarPagos`, `fecha_instalacion`) sale a una función pura en
`src/lib/cartera/`:

```
construirParche(actual, datos, config, hoy) -> parche
```

El store se queda solo con juntar los parches de todos los codes que volvieron
ok de `/api/cartera/sync` y mandarlos por `escribirLote`.

No es cosmético. Esa es la lógica con más sutileza del archivo —el truco de
escribir la fórmula de `instalado_aviso` en cada sync, sin condición, para que la
sync siguiente a una transición la apague sola— y hoy no se puede testear sin
PocketBase de por medio. Pura, se testea con vitest como el resto de
`src/lib/cartera/`.

Efecto secundario: hoy el loop reasigna `clientes` 20 veces, una por update. Con
el lote se reasigna una sola vez.

### 3. Caché de `cartera_config` en `sessionStorage`

`cargarConfig()` lee `cartera_config` en cada apertura. Pasa a leerse una vez por
sesión del navegador, cacheado en `sessionStorage`, **sin TTL**.

Sin TTL porque el contenido es efectivamente estático: los días de corte son los
que son y no cambian en años.

La invalidación es explícita: `CarteraConfig.svelte`, después de guardar y antes
de su `carteraStore.cargar()`, borra la entrada del caché.

**Hueco conocido y aceptado:** si un asesor guarda un cambio de config, otro
asesor que ya tenga la Cartera abierta sigue viendo la config vieja hasta que
recargue la página o cierre la pestaña. Dado que la config no cambia, el hueco no
se paga casi nunca; si algún día empieza a cambiar seguido, la respuesta es
ponerle un TTL corto, no invalidación cruzada.

### 4. Paso manual fuera del código

Encender la **Batch API** en Settings del admin de PocketBase, con `maxRequests`
en 50 o más (el default). Requiere superuser.

Verificación de que quedó encendida:

```
curl -s -X POST https://sista.pockethost.io/api/batch \
  -H "Content-Type: application/json" -d '{"requests":[]}'
```

Apagada responde `403 "Batch requests are not allowed."`. Encendida responde otra
cosa (un 400 por el body vacío).

## Fuera de alcance

- `MAX_POR_APERTURA` sigue en 20, y el criterio de `aRefrescar` no se toca.
- La sincronización del detalle de cliente (`sincronizar([code])` al montar) se
  queda como está: es un solo update, no hay lote que armar.
- Los endpoints Node no cambian.
- Cachear `/api/cartera/catalogos`: ya está cacheado en memoria del proceso con
  TTL de 1 hora, pega contra IspCube y no contra PocketBase, y lo llama solo la
  pantalla de configuración. No ahorra ni un request contra PocketHost.
- Migrar de PocketHost a otro hosting o a otra base (Supabase, Mongo). Se evaluó
  y se descartó por ahora: ver la sección siguiente.

## Contexto: por qué no se migró

Se evaluaron tres caminos para el rate limit por IP:

1. **VPS de Hostinger con PocketBase propio** (KVM 1, ARS 35.399/mes). Saca el
   techo de raíz y da control total, a cambio de hacerse cargo del sysadmin.
2. **PocketBase sobre el hosting Business compartido que ya se paga.** Descartado:
   PocketBase es un binario Go que necesita proceso vivo y SQLite en disco; el
   compartido solo corre web apps Node/Python gestionadas, el deploy reescribe el
   directorio de salida, y SQLite sobre almacenamiento compartido es riesgo de
   corrupción. Cambia un techo por otro, con menos garantías.
3. **Bajar el consumo** (este spec). Es lo elegido.

Sobre cambiar de base: no es mover datos, es reescribir la capa de datos.
PocketBase aporta colecciones, reglas de acceso por registro (`listRule` con
`@request.auth.id`), auth de usuarios y storage de archivos, y su SDK aparece en
~30 archivos. Supabase es el análogo más cercano (Postgres + RLS + Auth +
Storage) y el free tier sobra de tamaño, pero es una migración de semanas.
MongoDB es el peor encaje: no trae auth ni reglas por registro ni storage, habría
que construirlos a mano, y los datos son claramente relacionales
(`cartera_notas` y `cartera_recordatorios` apuntan a `cartera_clientes` y a
`users`).

Este cambio da ~8x de aire por unas horas de trabajo. La migración sigue estando
disponible el día que ese aire no alcance.

## Testing

- `construirParche`: unit tests puros en vitest, sin PocketBase. Cubren la
  transición de `instalado_aviso` en los dos sentidos, la conservación de
  `alta_nap` cuando `/sync` no trajo tickets, `perfil_manual`, y el sellado de
  `fecha_instalacion`.
- `pbLote`: tests con un `pb` falso. Cubren el camino feliz, la degradación por
  403 (y que no reintente el lote en la misma sesión), la degradación por fallo
  del lote, y el chunking en grupos de 20.
- El caché de config: test de que la segunda apertura no consulta PocketBase, y
  de que guardar la config lo invalida.
