# Cartera: chip de instalación, seguimiento a 1 mes, ticket de radio y orden por plan

Fecha: 2026-08-20

## Problema

Cuatro ajustes puntuales pedidos sobre la Cartera de clientes, independientes
entre sí pero agrupados en un solo spec porque cada uno es chico y localizado:

1. El chip "Instalación pendiente" pesa visualmente como una alerta (ámbar),
   pero no debería competir por atención con mora o tickets sin cerrar.
2. La alerta de seguimiento post-instalación dispara a los 2 meses; se quiere
   bajar a 1 mes.
3. Las conexiones "Sprint Banda..." son instalaciones por radio, no por
   fibra, y usan un proceso interno distinto en IspCube — pero la Cartera
   hoy asume que todo cliente se instala vía "ALTA RESERVA DE NAP".
4. Ordenar por "Conexiones" solo cuenta cantidad; no distingue el plan
   contratado como criterio de desempate.

Nota aparte: el pedido original incluía un quinto punto ("no veo las promos
activas en prod"). Se investigó y **no era un problema de diseño ni de
código**: el campo `promos` nunca se había agregado al schema de la colección
`cartera_clientes` en el PocketBase de producción (paso manual documentado en
el spec de 2026-08-04, nunca ejecutado). El usuario ya lo corrigió corriendo
`scripts/crear-colecciones-cartera.js` contra producción. La sección de
promos activas en `ClienteDetalle.svelte` (agregada en el commit `3af0986`)
no necesita ningún cambio de código. No forma parte de este plan.

## 1. Chip "Instalación pendiente" → texto gris

### Contexto

`estado_instalacion` es hoy una sola clase CSS (`Cartera.svelte:851`)
compartida por dos estados que no deberían verse igual:

- `instalacion_pendiente` → "Instalación pendiente"
- `pendiente_pago` → "Inst. pendiente de pago"

Ambos se arman en `chipsDe()` (`Cartera.svelte:345-360`) con `mod: ''`, así
que no hay forma de distinguirlos por CSS tal como está.

### Decisión

Solo `instalacion_pendiente` pasa a texto gris plano (sin fondo, sin
pastilla). `pendiente_pago` **se queda como chip ámbar**, sin cambios.

### Cambios

- `Cartera.svelte:352-360` (`chipsDe`): agregar
  `mod: estadoInstalacion === 'instalacion_pendiente' ? 'instalacion_pendiente' : ''`
  en vez de `mod: ''` fijo. El `tipo` sigue siendo `'estado_instalacion'` para
  las dos variantes (no cambia el orden en `ORDEN_CHIP` ni ningún otro uso de
  `tipo`).
- CSS, junto a la regla existente de `Cartera.svelte:851`:

  ```css
  .chip.estado_instalacion { background: #fef3c7; color: #92400e; }
  /* instalacion_pendiente ya no compite como alerta ambar: texto gris,
     sin pastilla. pendiente_pago (la otra variante de este mismo tipo)
     sigue arriba, sin tocar. */
  .chip.estado_instalacion.instalacion_pendiente {
      background: none; padding: 0; border-radius: 0;
      font-weight: 400; color: #6b7280;
  }
  ```

No toca `ClienteDetalle.svelte`: ese archivo no usa la clase
`chip.estado_instalacion` (confirmado por grep).

## 2. Seguimiento: 2 meses → 1 mes

### Cambios

- [alertas.js:27](../../../src/lib/cartera/alertas.js) —
  `MESES_SEGUIMIENTO`: `2` → `1`.
- `Cartera.svelte:139` — `label: 'Seguimiento 2 meses'` → `'Seguimiento 1 mes'`.
- `Cartera.svelte:229` — `seguimiento: 'Contactar (2 meses)'` →
  `'Contactar (1 mes)'`.
- `ClienteDetalle.svelte:60` —
  `seguimiento: 'Contactar: pasaron 2 meses de la instalación'` →
  `'Contactar: pasó 1 mes de la instalación'`.
- `alertas.test.js:34-99` — el `describe('alerta de seguimiento a los 2
  meses', ...)` y sus 7 casos con fechas fijas (instalación vs "hoy" a
  exactamente 2 meses) se reescriben para 1 mes. Mismo criterio de los
  casos (justo antes / justo en la fecha / justo después / con
  `ultimo_contacto` posterior a la instalación que apaga la alerta), moviendo
  las fechas de ejemplo para que la brecha sea de 1 mes en vez de 2.

Ningún otro archivo tiene el número hardcodeado (confirmado por grep sobre
`src/lib` y los componentes de `cartera/`).

## 3. Conexión "Sprint Banda..." → ticket "Instalación de radio"

### Contexto verificado contra la API real (sondeado en vivo, 2026-08-20)

- `GET /api/tickets/category_list`: categoría **50 = "INSTALACION DE
  RADIO"**, área 1. La que ya se usa, **69 = "ALTA RESERVA DE NAP"**,
  también área 1.
- `GET /api/plans/plans_list`: "Sprint Banda" es un nombre real de plan de
  internet en el catálogo (`SPRINT BANDA 94`, `SPRINT BANDA F103`, `SPRINT
  BANDA F103 TECHINT`, `SPRINT Banda 77`, `SPRINT BANDA 74`, `SPRINT BANDA
  F104`, `SPRINT BANDA F101-(EMPRESA)`, `SPRINT BANDA F105 (EMPRESA)`,
  `SERVICIO DE INTERNET SPRINT BANDA 76-10M`). El catálogo taggea la mayoría
  como `WIRELESS`, pero **dos variantes** — `SPRINT BANDA F101-(EMPRESA)` y
  `SPRINT BANDA F104` — están taggeadas `FIBRA`.
- La Cartera no guarda ese tag (`connections` solo trae `plan_id` y
  `plan_nombre`, ver `normalizar.js:41-44`), así que la distinción "es
  radio o no" se resuelve por **nombre**, no por tag.

### Decisión

Se detecta por nombre (`/sprint\s*banda/i` sobre `plan_nombre`), **excepto**
las dos variantes confirmadas como FIBRA, que se excluyen a mano y siguen
chequeando la categoría de NAP (69). Es el mismo criterio que ya usa el
código para `CATEGORIA_ALTA_NAP`: hardcodeado a propósito, no configurable
desde `cartera_config` — si el catálogo de IspCube cambia, se actualiza acá.

El campo del snapshot se sigue llamando `alta_nap` (no se renombra: es el
nombre de una columna real en PocketBase, y tocarlo es una migración de datos
que este cambio no necesita). Pasa a significar "resultado del ticket de
instalación, sea NAP o radio según el tipo de conexión del cliente" — se dejará
explícito en el comentario del código.

### Cambios

En `normalizar.js`, junto a `CATEGORIA_ALTA_NAP` (línea 196):

```js
/**
 * Categoria del ticket de instalacion por radio: "INSTALACION DE RADIO".
 * Sondeado en vivo el 2026-08-20 contra GET /api/tickets/category_list.
 */
const CATEGORIA_INSTALACION_RADIO = 50;

const RE_SPRINT_BANDA = /sprint\s*banda/i;

/**
 * Variantes de "Sprint Banda" que el catalogo de IspCube marca como FIBRA
 * (no radio) -sondeado el 2026-08-20 contra GET /api/plans/plans_list-.
 * Siguen chequeando la categoria de NAP, no la de radio.
 */
const SPRINT_BANDA_FIBRA = ['SPRINT BANDA F101-(EMPRESA)', 'SPRINT BANDA F104'];

/**
 * Que categoria de ticket de instalacion hay que chequear para este
 * cliente: RADIO si alguna conexion viva es un plan "Sprint Banda" (salvo
 * las variantes de fibra de SPRINT_BANDA_FIBRA), NAP en cualquier otro caso.
 *
 * @param {{plan_nombre?: string}[]} connections
 * @returns {number}
 */
export function categoriaInstalacionDe(connections) {
	const esRadio = (Array.isArray(connections) ? connections : []).some((c) => {
		const nombre = typeof c?.plan_nombre === 'string' ? c.plan_nombre : '';
		if (!RE_SPRINT_BANDA.test(nombre)) return false;
		return !SPRINT_BANDA_FIBRA.some((f) => f.toUpperCase() === nombre.toUpperCase());
	});
	return esRadio ? CATEGORIA_INSTALACION_RADIO : CATEGORIA_ALTA_NAP;
}
```

`resumenAltaNap` recibe la categoría por parámetro en vez de usar
`CATEGORIA_ALTA_NAP` fijo, con ese mismo valor como default (para no romper
los tests existentes que ya la llaman sin ese campo):

```js
export function resumenAltaNap(tickets, { estadosCerrados, categoria = CATEGORIA_ALTA_NAP }) {
	// ...
	if (t.ticket_category_id !== categoria) continue;
	// ... (sin más cambios)
}
```

En `sync/+server.js:114-134` (`snapshotDe`), donde ya se arma
`normalizarCliente(...)` antes de llamar a `resumenAltaNap`:

```js
const datosCliente = normalizarCliente(cliente.customer.crudo ?? cliente.customer, nombrePorId);

return {
	code,
	ok: true,
	datos: {
		...datosCliente,
		tickets: tickets.ok
			? resumenTickets(tickets.tickets, { areasSoporte, estadosCerrados })
			: null,
		alta_nap: tickets.ok
			? resumenAltaNap(tickets.tickets, {
					estadosCerrados,
					categoria: categoriaInstalacionDe(datosCliente.connections)
				})
			: null,
		pagos: cobranzas.ok ? pagosDeCobranzas(cobranzas.cobranzas) : null
	}
};
```

### Tests

- `normalizar.test.js`: casos nuevos para `categoriaInstalacionDe` (conexión
  Sprint Banda normal → 50, conexión Sprint Banda de las dos excepciones →
  69, sin conexiones Sprint Banda → 69, mezcla de conexiones → 50 si alguna
  matchea) y para `resumenAltaNap` con `categoria: 50` explícito (ticket de
  categoría 50 cuenta, uno de categoría 69 no, y viceversa con el default).
- Los tests existentes de `resumenAltaNap` (que no pasan `categoria`) siguen
  pasando sin cambios por el default.

## 4. Orden por "Conexiones": desempate por plan

### Contexto

`orden.js:126-130` define la columna `conexiones` como un número simple
(`connections.length`, `cmpNumero`). El desempate genérico
(`compararEstable`, alta + code) no distingue plan.

`planes.js:10` ya tiene el orden de jerarquía como array:
`['HOME', 'FAST', 'POWER', 'GAMER', 'WORKER', 'MAX']`.

### Decisión

A igual cantidad de conexiones, gana quien tenga el plan de **internet**
más alto entre sus conexiones (`MAX` arriba, `HOME` abajo). TV y telefonía
no participan del desempate — no tienen jerarquía comparable. Clientes sin
ninguna conexión de internet residencial (por ejemplo, solo Sprint Banda, o
solo TV) quedan con el rango mínimo, pero siguen ordenados por cantidad como
corresponde.

### Cambios

En `planes.js`, junto a `PLANES_INTERNET`:

```js
const RANGO_INTERNET = Object.fromEntries(PLANES_INTERNET.map((p, i) => [p, i]));

/**
 * Posicion de un plan de internet residencial en la jerarquia HOME..MAX.
 * @param {string|null|undefined} nombreCompleto nombre crudo que devuelve IspCube
 * @returns {number} -1 si no es un plan de internet residencial (TV, telefonia, Sprint Banda, etc.)
 */
export function rangoInternetDe(nombreCompleto) {
	const { etiqueta, categoria } = describirConexion(nombreCompleto);
	if (categoria !== 'internet') return -1;
	return RANGO_INTERNET[etiqueta.toUpperCase()] ?? -1;
}
```

En `orden.js`, columna `conexiones`:

```js
import { rangoInternetDe } from './planes.js';

/** @param {{plan_nombre?: string}[]} connections */
function rangoMaximoInternet(connections) {
	let max = -1;
	for (const c of connections ?? []) {
		const r = rangoInternetDe(c?.plan_nombre);
		if (r > max) max = r;
	}
	return max;
}

// ...dentro de COLUMNAS:
conexiones: {
	dir: 'desc',
	valor: (f) => {
		const connections = Array.isArray(f.cliente.connections) ? f.cliente.connections : [];
		return { cantidad: connections.length, rango: rangoMaximoInternet(connections) };
	},
	comparar: (a, b) => a.cantidad - b.cantidad || a.rango - b.rango
},
```

`col.valor(f) === null` (el chequeo de `ordenar()` para mandar filas al
grupo "sin dato") sigue sin dispararse nunca para esta columna: el objeto
`{cantidad, rango}` no es `null` aunque `cantidad` sea 0 — mismo
comportamiento que hoy.

En dirección `'asc'` (segundo click en la columna) el desempate también se
invierte: menos conexiones primero, y a igual cantidad, plan más bajo
primero. Es el mismo criterio que ya aplica `signo` al resto de columnas, no
un caso especial.

### Tests

`orden.test.js` ya existe y cubre `conexiones` (línea 209: cuenta cantidad;
línea 323: desempate por `alta`, no por alertas). Sumar casos con clientes de
igual cantidad de conexiones y distinto plan (`MAX` vs `HOME` vs sin conexión
de internet), en las dos direcciones — sin tocar los casos existentes, que
siguen valiendo: en los dos (líneas 209-213 y 311-334) las conexiones son
objetos sin `plan_nombre` (`{}`), así que `rangoInternetDe(undefined)` da
`-1` para todas las filas por igual y el nuevo desempate no cambia nada
(sigue mandando `cantidad`, después `compararEstable`, exactamente como
antes).

## Alcance fuera de este spec

- No se toca `estadoInstalacionDe` (`instalacion.js`): sigue leyendo
  `alta_nap.cerrado` sin importar qué categoría lo generó.
- No se renombra el campo `alta_nap` en PocketBase ni en el código que lo
  lee (`parche.js`, `alertas.js`, tests) — solo cambia qué categoría de
  ticket lo alimenta.
- No se agrega una categoría "radio" a `describirConexion`/`planes.js`: el
  chip de conexión de un cliente con Sprint Banda sigue mostrando el nombre
  crudo del plan (categoría `'otro'`), sin cambios visuales fuera de lo
  descripto en la sección 1.
