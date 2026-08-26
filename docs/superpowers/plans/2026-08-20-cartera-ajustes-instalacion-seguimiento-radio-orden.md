# Cartera: chip de instalación, seguimiento a 1 mes, ticket de radio y orden por plan — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar los 4 ajustes del spec [2026-08-20-cartera-ajustes-instalacion-seguimiento-radio-orden-design.md](../specs/2026-08-20-cartera-ajustes-instalacion-seguimiento-radio-orden-design.md): seguimiento a 1 mes, chip de instalación pendiente sin pastilla ámbar, ticket de instalación correcto para conexiones Sprint Banda, y desempate por plan en el orden por conexiones.

**Architecture:** Cuatro cambios independientes y acotados sobre módulos ya existentes de `src/lib/cartera/` (funciones puras, con tests) y dos archivos de UI (`Cartera.svelte`, sin infraestructura de test — se verifica con `svelte-check`). No se crean archivos nuevos ni se tocan otras features.

**Tech Stack:** SvelteKit 5 (runes), Vitest, JSDoc (sin TypeScript compilado, `svelte-check` valida los tipos vía `jsconfig.json`).

---

## Antes de empezar

Confirmar que el árbol de trabajo está limpio en lo que toca a `src/lib/cartera/` y a los dos componentes de Cartera antes de tocar nada:

```bash
git status --short src/lib/cartera/ "src/routes/admin/_components/mantenimiento/Dashboard/cartera/" "src/routes/api/cartera/"
```

Expected: sin salida (nada modificado todavía en esas rutas). Si hay algo, es trabajo ajeno — no pisarlo, preguntar antes de seguir.

---

### Task 1: Seguimiento post-instalación: 2 meses → 1 mes

**Files:**
- Modify: `src/lib/cartera/alertas.js:27`
- Modify: `src/lib/cartera/alertas.test.js:34-103`
- Modify: `src/routes/admin/_components/mantenimiento/Dashboard/cartera/Cartera.svelte:139,229`
- Modify: `src/routes/admin/_components/mantenimiento/Dashboard/cartera/ClienteDetalle.svelte:60`

- [ ] **Step 1: Reescribir los tests del describe de seguimiento para 1 mes**

En `src/lib/cartera/alertas.test.js`, reemplazar el bloque completo (líneas 34-103):

```js
describe('alerta de seguimiento a los 2 meses', () => {
	it('no salta antes de los dos meses', () => {
		const r = alertasDe(
			{ ...base, fecha_instalacion: '2026-06-10' },
			{ anio: 2026, mes: 7, dia: 15 },
			CONFIG
		);

		expect(tipos(r)).not.toContain('seguimiento');
	});

	it('salta cumplidos los dos meses sin contacto', () => {
		const r = alertasDe(
			{ ...base, fecha_instalacion: '2026-05-10' },
			{ anio: 2026, mes: 7, dia: 15 },
			CONFIG
		);

		expect(tipos(r)).toContain('seguimiento');
	});

	it('salta el dia exacto en que se cumplen los dos meses', () => {
		const r = alertasDe(
			{ ...base, fecha_instalacion: '2026-05-15' },
			{ anio: 2026, mes: 7, dia: 15 },
			CONFIG
		);

		expect(tipos(r)).toContain('seguimiento');
	});

	it('un contacto posterior a la instalacion la apaga', () => {
		const r = alertasDe(
			{ ...base, fecha_instalacion: '2026-05-10', ultimo_contacto: '2026-07-01' },
			{ anio: 2026, mes: 7, dia: 15 },
			CONFIG
		);

		expect(tipos(r)).not.toContain('seguimiento');
	});

	it('un contacto anterior a la instalacion no cuenta', () => {
		const r = alertasDe(
			{ ...base, fecha_instalacion: '2026-05-10', ultimo_contacto: '2026-04-01' },
			{ anio: 2026, mes: 7, dia: 15 },
			CONFIG
		);

		expect(tipos(r)).toContain('seguimiento');
	});

	it('un ultimo_contacto vacio no la apaga', () => {
		// Vacio es como nace el campo: solo lo escribe `marcarContactado`, o sea
		// el asesor apretando el boton. Mientras nadie lo apriete, la alerta
		// sigue encendida por mas anotaciones que haya en la bitacora.
		const r = alertasDe(
			{ ...base, fecha_instalacion: '2026-05-10', ultimo_contacto: '' },
			{ anio: 2026, mes: 7, dia: 15 },
			CONFIG
		);

		expect(tipos(r)).toContain('seguimiento');
	});

	it('sin fecha de instalacion no se calcula', () => {
		const r = alertasDe({ ...base, fecha_instalacion: '' }, { anio: 2026, mes: 7, dia: 15 }, CONFIG);

		expect(tipos(r)).not.toContain('seguimiento');
	});
});
```

con:

```js
describe('alerta de seguimiento al mes', () => {
	it('no salta antes de un mes', () => {
		const r = alertasDe(
			{ ...base, fecha_instalacion: '2026-07-01' },
			{ anio: 2026, mes: 7, dia: 15 },
			CONFIG
		);

		expect(tipos(r)).not.toContain('seguimiento');
	});

	it('salta cumplido el mes sin contacto', () => {
		const r = alertasDe(
			{ ...base, fecha_instalacion: '2026-06-10' },
			{ anio: 2026, mes: 7, dia: 15 },
			CONFIG
		);

		expect(tipos(r)).toContain('seguimiento');
	});

	it('salta el dia exacto en que se cumple el mes', () => {
		const r = alertasDe(
			{ ...base, fecha_instalacion: '2026-06-15' },
			{ anio: 2026, mes: 7, dia: 15 },
			CONFIG
		);

		expect(tipos(r)).toContain('seguimiento');
	});

	it('un contacto posterior a la instalacion la apaga', () => {
		const r = alertasDe(
			{ ...base, fecha_instalacion: '2026-06-10', ultimo_contacto: '2026-07-01' },
			{ anio: 2026, mes: 7, dia: 15 },
			CONFIG
		);

		expect(tipos(r)).not.toContain('seguimiento');
	});

	it('un contacto anterior a la instalacion no cuenta', () => {
		const r = alertasDe(
			{ ...base, fecha_instalacion: '2026-06-10', ultimo_contacto: '2026-04-01' },
			{ anio: 2026, mes: 7, dia: 15 },
			CONFIG
		);

		expect(tipos(r)).toContain('seguimiento');
	});

	it('un ultimo_contacto vacio no la apaga', () => {
		// Vacio es como nace el campo: solo lo escribe `marcarContactado`, o sea
		// el asesor apretando el boton. Mientras nadie lo apriete, la alerta
		// sigue encendida por mas anotaciones que haya en la bitacora.
		const r = alertasDe(
			{ ...base, fecha_instalacion: '2026-06-10', ultimo_contacto: '' },
			{ anio: 2026, mes: 7, dia: 15 },
			CONFIG
		);

		expect(tipos(r)).toContain('seguimiento');
	});

	it('sin fecha de instalacion no se calcula', () => {
		const r = alertasDe({ ...base, fecha_instalacion: '' }, { anio: 2026, mes: 7, dia: 15 }, CONFIG);

		expect(tipos(r)).not.toContain('seguimiento');
	});
});
```

- [ ] **Step 2: Correr los tests y confirmar que fallan**

Run: `npx vitest run src/lib/cartera/alertas.test.js`
Expected: FAIL — al menos los casos "salta cumplido el mes sin contacto", "salta el dia exacto en que se cumple el mes", "un contacto anterior a la instalacion no cuenta" y "un ultimo_contacto vacio no la apaga" fallan, porque con `MESES_SEGUIMIENTO = 2` la alerta todavía no debería estar activa a los 30-35 días.

- [ ] **Step 3: Cambiar la constante**

En `src/lib/cartera/alertas.js:27`, reemplazar:

```js
/** Meses desde la instalacion hasta el llamado de seguimiento. */
const MESES_SEGUIMIENTO = 2;
```

con:

```js
/** Meses desde la instalacion hasta el llamado de seguimiento. */
const MESES_SEGUIMIENTO = 1;
```

- [ ] **Step 4: Correr los tests y confirmar que pasan**

Run: `npx vitest run src/lib/cartera/alertas.test.js`
Expected: PASS (todos los tests del archivo, no solo el describe tocado).

- [ ] **Step 5: Actualizar los 3 textos de UI que mencionan "2 meses"**

En `Cartera.svelte:139`, reemplazar:

```js
    { value: 'seguimiento', label: 'Seguimiento 2 meses' },
```

con:

```js
    { value: 'seguimiento', label: 'Seguimiento 1 mes' },
```

En `Cartera.svelte:229`, reemplazar:

```js
    seguimiento: 'Contactar (2 meses)',
```

con:

```js
    seguimiento: 'Contactar (1 mes)',
```

En `ClienteDetalle.svelte:60`, reemplazar:

```js
	seguimiento: 'Contactar: pasaron 2 meses de la instalación',
```

con:

```js
	seguimiento: 'Contactar: pasó 1 mes de la instalación',
```

- [ ] **Step 6: Verificar tipos/sintaxis de los dos componentes**

Run: `npm run check`
Expected: sin errores nuevos (los que ya existían en el repo antes de este cambio, si los hay, no cuentan).

- [ ] **Step 7: Commit**

```bash
git add src/lib/cartera/alertas.js src/lib/cartera/alertas.test.js "src/routes/admin/_components/mantenimiento/Dashboard/cartera/Cartera.svelte" "src/routes/admin/_components/mantenimiento/Dashboard/cartera/ClienteDetalle.svelte"
git commit -m "fix(cartera): bajar el seguimiento post-instalacion de 2 meses a 1"
```

---

### Task 2: Chip "Instalación pendiente" → texto gris (sin pastilla)

**Files:**
- Modify: `src/routes/admin/_components/mantenimiento/Dashboard/cartera/Cartera.svelte:345-360` (función `chipsDe`)
- Modify: `src/routes/admin/_components/mantenimiento/Dashboard/cartera/Cartera.svelte:851` (CSS)

No hay tests automatizados para este archivo (es un componente Svelte monolítico sin funciones exportadas ni suite de test propia — no se agrega infraestructura nueva para esto, se sigue el patrón existente del repo). La verificación es `svelte-check` más una revisión visual.

- [ ] **Step 1: Diferenciar "instalacion_pendiente" de "pendiente_pago" en el chip**

En `Cartera.svelte:352-360`, reemplazar:

```js
    if (estadoInstalacion !== 'instalado') {
        chips.push({
            tipo: 'estado_instalacion',
            mod: '',
            texto: ETIQUETA_ESTADO_INSTALACION[estadoInstalacion],
            titulo: null,
            sr: ''
        });
    }
```

con:

```js
    if (estadoInstalacion !== 'instalado') {
        chips.push({
            tipo: 'estado_instalacion',
            // `instalacion_pendiente` ya no es una alerta ambar: pesa menos que
            // una mora o un ticket sin cerrar. `pendiente_pago` se queda igual.
            mod: estadoInstalacion === 'instalacion_pendiente' ? 'instalacion_pendiente' : '',
            texto: ETIQUETA_ESTADO_INSTALACION[estadoInstalacion],
            titulo: null,
            sr: ''
        });
    }
```

- [ ] **Step 2: Agregar la regla CSS del texto gris**

En `Cartera.svelte:851`, reemplazar:

```css
/* Mismo amber: instalacion_pendiente/pendiente_pago tampoco es un vencimiento,
   pero el asesor tiene que verlo igual de rapido que el resto de la columna. */
.chip.estado_instalacion { background: #fef3c7; color: #92400e; }
```

con:

```css
/* Mismo amber: pendiente_pago tampoco es un vencimiento, pero el asesor
   tiene que verlo igual de rapido que el resto de la columna. */
.chip.estado_instalacion { background: #fef3c7; color: #92400e; }
/* instalacion_pendiente (la otra variante de este mismo tipo) ya no compite
   como alerta: texto gris, sin pastilla ni fondo. */
.chip.estado_instalacion.instalacion_pendiente {
    background: none; padding: 0; border-radius: 0;
    font-weight: 400; color: #6b7280;
}
```

- [ ] **Step 3: Verificar tipos/sintaxis**

Run: `npm run check`
Expected: sin errores nuevos.

- [ ] **Step 4: Verificación visual (si hay forma de loguearse al panel de admin)**

Levantar el dev server, entrar a Admin → Cartera de clientes, y confirmar en la tabla:
- Un cliente con estado "Instalación pendiente" se ve como texto gris simple, sin fondo ni pastilla.
- Un cliente con estado "Inst. pendiente de pago" (si hay alguno a mano) se sigue viendo con el chip ámbar de siempre.

Si no hay forma práctica de loguearse al panel en este entorno, este paso queda como verificación pendiente para quien revise el PR — no bloquea el commit, ya que `svelte-check` (Step 3) ya cubre que el cambio no rompe nada.

- [ ] **Step 5: Commit**

```bash
git add "src/routes/admin/_components/mantenimiento/Dashboard/cartera/Cartera.svelte"
git commit -m "fix(cartera): chip de instalacion pendiente pasa a texto gris"
```

---

### Task 3: Orden por "Conexiones": desempate por plan más alto

**Files:**
- Modify: `src/lib/cartera/planes.js` (nueva constante + función exportada, al final del archivo)
- Modify: `src/lib/cartera/planes.test.js` (nuevo describe)
- Modify: `src/lib/cartera/orden.js:1-138` (import, helper, columna `conexiones`)
- Modify: `src/lib/cartera/orden.test.js` (nuevos casos)

- [ ] **Step 1: Escribir los tests de `rangoInternetDe` (van a fallar: la función no existe todavía)**

En `src/lib/cartera/planes.test.js`, cambiar el import de la línea 2:

```js
import { describirConexion } from './planes.js';
```

por:

```js
import { describirConexion, rangoInternetDe } from './planes.js';
```

Y agregar al final del archivo (después del último `});` que cierra `describe('describirConexion — otros', ...)`):

```js

describe('rangoInternetDe', () => {
	it.each([
		['HOME', 0],
		['FAST', 1],
		['POWER', 2],
		['GAMER', 3],
		['WORKER', 4],
		['MAX', 5]
	])('%s tiene rango %i', (plan, rango) => {
		expect(rangoInternetDe(`Servicio de internet basico ${plan} f20`)).toBe(rango);
	});

	it('un plan que no es de internet da -1', () => {
		expect(rangoInternetDe('Servicio de telefonia basica')).toBe(-1);
	});

	it('un plan de internet no reconocido (Sprint Banda) da -1', () => {
		expect(rangoInternetDe('SPRINT BANDA 94')).toBe(-1);
	});

	it('nombreCompleto vacio o null da -1', () => {
		expect(rangoInternetDe('')).toBe(-1);
		expect(rangoInternetDe(null)).toBe(-1);
	});
});
```

- [ ] **Step 2: Correr los tests y confirmar que fallan**

Run: `npx vitest run src/lib/cartera/planes.test.js`
Expected: FAIL con un error de import — `rangoInternetDe` no está exportado por `planes.js` todavía.

- [ ] **Step 3: Implementar `rangoInternetDe` en `planes.js`**

En `src/lib/cartera/planes.js:10`, reemplazar:

```js
const PLANES_INTERNET = ['HOME', 'FAST', 'POWER', 'GAMER', 'WORKER', 'MAX'];
```

con:

```js
const PLANES_INTERNET = ['HOME', 'FAST', 'POWER', 'GAMER', 'WORKER', 'MAX'];

/** Posicion de cada plan en la jerarquia, para desempatar el orden por conexiones. */
const RANGO_INTERNET = Object.fromEntries(PLANES_INTERNET.map((p, i) => [p, i]));
```

Y al final del archivo (después del cierre de `describirConexion`), agregar:

```js

/**
 * Posicion de un plan de internet residencial en la jerarquia HOME..MAX. La
 * usa `orden.js` para desempatar el orden por cantidad de conexiones.
 *
 * @param {string|null|undefined} nombreCompleto nombre crudo que devuelve IspCube
 * @returns {number} -1 si no es un plan de internet residencial (TV, telefonia, Sprint Banda, etc.)
 */
export function rangoInternetDe(nombreCompleto) {
	const { etiqueta, categoria } = describirConexion(nombreCompleto);
	if (categoria !== 'internet') return -1;
	return RANGO_INTERNET[etiqueta.toUpperCase()] ?? -1;
}
```

- [ ] **Step 4: Correr los tests y confirmar que pasan**

Run: `npx vitest run src/lib/cartera/planes.test.js`
Expected: PASS (todos los tests del archivo).

- [ ] **Step 5: Escribir los tests del desempate en `orden.test.js` (van a fallar: la columna todavía no mira el plan)**

En `src/lib/cartera/orden.test.js`, agregar estos tres casos justo después del test `'por conexiones cuenta cuantas tiene'` (línea 214, antes de `it('por contacto, ...')`):

```js

	it('por conexiones, a igual cantidad desempata por el plan mas alto', () => {
		const conPlan = (code, planNombre) =>
			fila({
				cliente: {
					code,
					nombre: code,
					connections: [{ plan_nombre: `Servicio de internet basico ${planNombre} f20` }]
				}
			});
		const filas = [conPlan('home', 'HOME'), conPlan('max', 'MAX'), conPlan('gamer', 'GAMER')];
		expect(codes(ordenar(filas, 'conexiones', 'desc'))).toEqual(['max', 'gamer', 'home']);
		expect(codes(ordenar(filas, 'conexiones', 'asc'))).toEqual(['home', 'gamer', 'max']);
	});

	it('por conexiones, la cantidad manda antes que el plan', () => {
		const conCantidadYPlan = (code, n, planNombre) =>
			fila({
				cliente: {
					code,
					nombre: code,
					connections: Array.from({ length: n }, () => ({
						plan_nombre: `Servicio de internet basico ${planNombre} f20`
					}))
				}
			});
		const filas = [conCantidadYPlan('unaMax', 1, 'MAX'), conCantidadYPlan('dosHome', 2, 'HOME')];
		expect(codes(ordenar(filas, 'conexiones', 'desc'))).toEqual(['dosHome', 'unaMax']);
	});

	it('por conexiones, sin plan de internet residencial queda al fondo del desempate', () => {
		const conConexion = (code, connections) => fila({ cliente: { code, nombre: code, connections } });
		const filas = [
			conConexion('sprint', [{ plan_nombre: 'SPRINT BANDA 94' }]),
			conConexion('home', [{ plan_nombre: 'Servicio de internet basico HOME f20' }])
		];
		expect(codes(ordenar(filas, 'conexiones', 'desc'))).toEqual(['home', 'sprint']);
	});
```

- [ ] **Step 6: Correr los tests y confirmar que fallan**

Run: `npx vitest run src/lib/cartera/orden.test.js`
Expected: FAIL en los 3 casos nuevos — la columna `conexiones` hoy solo compara cantidad, así que `max`/`gamer`/`home` con una conexión cada uno empatan y el desempate real (`compararEstable`, por `alta`/`code`) no da el orden esperado por plan.

- [ ] **Step 7: Implementar el desempate en `orden.js`**

En `src/lib/cartera/orden.js`, reemplazar el borde entre el comentario de cabecera del archivo y el typedef `Fila` (líneas 20-24):

```js
 * precalcularlos y arrastrar dos campos mas en la fila.
 */

/**
 * @typedef {object} Fila
```

con:

```js
 * precalcularlos y arrastrar dos campos mas en la fila.
 */

import { rangoInternetDe } from './planes.js';

/**
 * @typedef {object} Fila
```

En `orden.js:100-101` (justo después de `const cmpNumero = (a, b) => a - b;`), agregar el helper:

```js
/** @param {number} a @param {number} b */
const cmpNumero = (a, b) => a - b;

/** @param {{plan_nombre?: string}[]} connections */
function rangoMaximoInternet(connections) {
	let max = -1;
	for (const c of connections ?? []) {
		const r = rangoInternetDe(c?.plan_nombre);
		if (r > max) max = r;
	}
	return max;
}
```

En `orden.js:126-130`, reemplazar la columna `conexiones`:

```js
    conexiones: {
        dir: 'desc',
        valor: (f) => (Array.isArray(f.cliente.connections) ? f.cliente.connections.length : 0),
        comparar: cmpNumero
    },
```

con:

```js
    conexiones: {
        dir: 'desc',
        valor: (f) => {
            const connections = Array.isArray(f.cliente.connections) ? f.cliente.connections : [];
            return { cantidad: connections.length, rango: rangoMaximoInternet(connections) };
        },
        comparar: (a, b) => a.cantidad - b.cantidad || a.rango - b.rango
    },
```

- [ ] **Step 8: Correr los tests y confirmar que pasan**

Run: `npx vitest run src/lib/cartera/orden.test.js`
Expected: PASS (todos los tests del archivo, incluidos los 2 que ya existían sobre `conexiones` en las líneas 209 y 311 — ver la nota del spec: esos dos usan conexiones sin `plan_nombre`, así que el rango es `-1` para todas las filas por igual y el resultado no cambia).

- [ ] **Step 9: Commit**

```bash
git add src/lib/cartera/planes.js src/lib/cartera/planes.test.js src/lib/cartera/orden.js src/lib/cartera/orden.test.js
git commit -m "feat(cartera): desempatar el orden por conexiones por el plan mas alto"
```

---

### Task 4: Conexión "Sprint Banda..." usa el ticket de "Instalación de radio", no el de NAP

**Files:**
- Modify: `src/lib/cartera/normalizar.js:196-258`
- Modify: `src/lib/cartera/normalizar.test.js`
- Modify: `src/routes/api/cartera/sync/+server.js:19,114-138`

- [ ] **Step 1: Escribir los tests de `categoriaInstalacionDe` (van a fallar: la función no existe todavía)**

En `src/lib/cartera/normalizar.test.js`, cambiar el import de la línea 2:

```js
import { normalizarCliente, perfilDe, resumenTickets, resumenAltaNap } from './normalizar.js';
```

por:

```js
import {
	normalizarCliente,
	perfilDe,
	resumenTickets,
	resumenAltaNap,
	categoriaInstalacionDe
} from './normalizar.js';
```

Y agregar, justo antes de `describe('resumenAltaNap', ...)` (línea 407):

```js
describe('categoriaInstalacionDe', () => {
	it('sin conexiones Sprint Banda, usa la categoria de NAP (69)', () => {
		expect(
			categoriaInstalacionDe([{ plan_nombre: 'Servicio de internet basico HOME f20' }])
		).toBe(69);
	});

	it('sin conexiones, usa la categoria de NAP (69)', () => {
		expect(categoriaInstalacionDe([])).toBe(69);
	});

	it('con una conexion Sprint Banda, usa la categoria de radio (50)', () => {
		expect(categoriaInstalacionDe([{ plan_nombre: 'SPRINT BANDA 94' }])).toBe(50);
	});

	it('reconoce Sprint Banda sin importar mayusculas ni el espaciado', () => {
		expect(
			categoriaInstalacionDe([{ plan_nombre: 'Servicio de internet Sprint  Banda 76-10M' }])
		).toBe(50);
	});

	it('las dos variantes de fibra se quedan en la categoria de NAP', () => {
		expect(categoriaInstalacionDe([{ plan_nombre: 'SPRINT BANDA F101-(EMPRESA)' }])).toBe(69);
		expect(categoriaInstalacionDe([{ plan_nombre: 'SPRINT BANDA F104' }])).toBe(69);
	});

	it('con varias conexiones, alcanza con que una sea Sprint Banda', () => {
		const connections = [
			{ plan_nombre: 'Servicio de internet basico HOME f20' },
			{ plan_nombre: 'SPRINT BANDA 74' }
		];
		expect(categoriaInstalacionDe(connections)).toBe(50);
	});
});

```

Y, dentro del describe existente `describe('resumenAltaNap', ...)`, agregar estos dos casos justo antes del `});` que lo cierra (línea 484):

```js

	it('con categoria explicita (radio), un ticket de esa categoria cuenta', () => {
		const r = resumenAltaNap([ticket({ ticket_category_id: 50, ticket_status_id: 3 })], {
			estadosCerrados: [3],
			categoria: 50
		});
		expect(r).toEqual({ existe: true, cerrado: true, anulado: false, closed_date: '2026-08-05' });
	});

	it('con categoria explicita (radio), un ticket de NAP (69) no cuenta', () => {
		const r = resumenAltaNap([ticket({ ticket_category_id: 69, ticket_status_id: 3 })], {
			estadosCerrados: [3],
			categoria: 50
		});
		expect(r.existe).toBe(false);
	});
```

- [ ] **Step 2: Correr los tests y confirmar que fallan**

Run: `npx vitest run src/lib/cartera/normalizar.test.js`
Expected: FAIL con un error de import — `categoriaInstalacionDe` no está exportado por `normalizar.js` todavía.

- [ ] **Step 3: Implementar `categoriaInstalacionDe` y generalizar `resumenAltaNap`**

En `src/lib/cartera/normalizar.js`, reemplazar (líneas 189-204):

```js
/**
 * Categoria del ticket de reserva de NAP en IspCube: "ALTA RESERVA DE NAP".
 * Sondeado en vivo el 2026-08-06 contra `GET /api/tickets/category_list`.
 * Hardcodeado a proposito -no configurable como `areas_soporte`-: el nombre
 * del proceso no va a cambiar en mucho tiempo, y si algun dia cambia, se
 * actualiza aca.
 */
const CATEGORIA_ALTA_NAP = 69;

/**
 * Estado "ANULADO" de un ticket en IspCube. Sondeado el 2026-08-06 contra
 * `GET /api/tickets/status_list`. Distinto de `estados_cerrados`
 * (`cartera_config`): un ticket anulado no es lo mismo que uno cerrado, y la
 * Cartera necesita distinguirlos para la alerta `nap_anulado`.
 */
const ESTADO_ANULADO = 8;
```

con:

```js
/**
 * Categoria del ticket de reserva de NAP en IspCube: "ALTA RESERVA DE NAP".
 * Sondeado en vivo el 2026-08-06 contra `GET /api/tickets/category_list`.
 * Hardcodeado a proposito -no configurable como `areas_soporte`-: el nombre
 * del proceso no va a cambiar en mucho tiempo, y si algun dia cambia, se
 * actualiza aca.
 */
const CATEGORIA_ALTA_NAP = 69;

/**
 * Categoria del ticket de instalacion por radio en IspCube: "INSTALACION DE
 * RADIO". Sondeado en vivo el 2026-08-20 contra
 * `GET /api/tickets/category_list`.
 */
const CATEGORIA_INSTALACION_RADIO = 50;

const RE_SPRINT_BANDA = /sprint\s*banda/i;

/**
 * Variantes de "Sprint Banda" que el catalogo de IspCube marca como FIBRA, no
 * radio -sondeado el 2026-08-20 contra `GET /api/plans/plans_list`-. Siguen
 * chequeando la categoria de NAP, no la de radio.
 */
const SPRINT_BANDA_FIBRA = ['SPRINT BANDA F101-(EMPRESA)', 'SPRINT BANDA F104'];

/**
 * Que categoria de ticket de instalacion hay que chequear para este cliente:
 * RADIO si alguna conexion viva es un plan "Sprint Banda" (salvo las
 * variantes de fibra de `SPRINT_BANDA_FIBRA`), NAP en cualquier otro caso.
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

/**
 * Estado "ANULADO" de un ticket en IspCube. Sondeado el 2026-08-06 contra
 * `GET /api/tickets/status_list`. Distinto de `estados_cerrados`
 * (`cartera_config`): un ticket anulado no es lo mismo que uno cerrado, y la
 * Cartera necesita distinguirlos para la alerta `nap_anulado`.
 */
const ESTADO_ANULADO = 8;
```

Y reemplazar la firma y el filtro de `resumenAltaNap` (líneas 213-228 del archivo original):

```js
 * @param {unknown} tickets Respuesta cruda de `getTickets`
 * @param {{estadosCerrados: unknown[]}} opciones Misma lista que usa `resumenTickets`
 * @returns {{existe: boolean, cerrado: boolean, anulado: boolean, closed_date: string}}
 */
export function resumenAltaNap(tickets, { estadosCerrados }) {
	if (!Array.isArray(tickets)) {
		return { existe: false, cerrado: false, anulado: false, closed_date: '' };
	}

	const cerrados = (Array.isArray(estadosCerrados) ? estadosCerrados : []).map(String);

	/** @type {any} */
	let masReciente = null;
	for (const t of tickets) {
		if (!t || t.deleted_at) continue;
		if (t.ticket_category_id !== CATEGORIA_ALTA_NAP) continue;
```

con:

```js
 * @param {unknown} tickets Respuesta cruda de `getTickets`
 * @param {{estadosCerrados: unknown[], categoria?: number}} opciones Misma
 *   lista que usa `resumenTickets`, mas la categoria de ticket a chequear
 *   (NAP por defecto; RADIO para conexiones Sprint Banda, ver
 *   `categoriaInstalacionDe`)
 * @returns {{existe: boolean, cerrado: boolean, anulado: boolean, closed_date: string}}
 */
export function resumenAltaNap(tickets, { estadosCerrados, categoria = CATEGORIA_ALTA_NAP }) {
	if (!Array.isArray(tickets)) {
		return { existe: false, cerrado: false, anulado: false, closed_date: '' };
	}

	const cerrados = (Array.isArray(estadosCerrados) ? estadosCerrados : []).map(String);

	/** @type {any} */
	let masReciente = null;
	for (const t of tickets) {
		if (!t || t.deleted_at) continue;
		if (t.ticket_category_id !== categoria) continue;
```

- [ ] **Step 4: Correr los tests y confirmar que pasan**

Run: `npx vitest run src/lib/cartera/normalizar.test.js`
Expected: PASS (todos los tests del archivo, incluidos los de `resumenAltaNap` que no pasan `categoria` — siguen valiendo por el default `= CATEGORIA_ALTA_NAP`).

- [ ] **Step 5: Conectar la categoría en el sync**

En `src/routes/api/cartera/sync/+server.js:19`, reemplazar:

```js
import { normalizarCliente, resumenTickets, resumenAltaNap } from '$lib/cartera/normalizar.js';
```

con:

```js
import {
	normalizarCliente,
	resumenTickets,
	resumenAltaNap,
	categoriaInstalacionDe
} from '$lib/cartera/normalizar.js';
```

En `src/routes/api/cartera/sync/+server.js:114-138` (función `snapshotDe`), reemplazar:

```js
async function snapshotDe(code, cfg, { areasSoporte, estadosCerrados, nombrePorId }) {
	try {
		const cliente = await getCustomerByCode(code, cfg);
		if (!cliente.ok) return { code, ok: false, reason: cliente.reason };

		const [tickets, cobranzas] = await Promise.all([getTickets(code, cfg), getCobranzas(code, cfg)]);

		return {
			code,
			ok: true,
			datos: {
				...normalizarCliente(cliente.customer.crudo ?? cliente.customer, nombrePorId),
				tickets: tickets.ok
					? resumenTickets(tickets.tickets, { areasSoporte, estadosCerrados })
					: null,
				// Mismos tickets crudos que ya trajo `getTickets` arriba: no es un
				// request extra a IspCube.
				alta_nap: tickets.ok ? resumenAltaNap(tickets.tickets, { estadosCerrados }) : null,
				pagos: cobranzas.ok ? pagosDeCobranzas(cobranzas.cobranzas) : null
			}
		};
	} catch (error) {
		console.error(`[cartera/sync] fallo el snapshot de ${code}:`, error);
		return { code, ok: false, reason: 'error' };
	}
}
```

con:

```js
async function snapshotDe(code, cfg, { areasSoporte, estadosCerrados, nombrePorId }) {
	try {
		const cliente = await getCustomerByCode(code, cfg);
		if (!cliente.ok) return { code, ok: false, reason: cliente.reason };

		const [tickets, cobranzas] = await Promise.all([getTickets(code, cfg), getCobranzas(code, cfg)]);
		const datosCliente = normalizarCliente(cliente.customer.crudo ?? cliente.customer, nombrePorId);

		return {
			code,
			ok: true,
			datos: {
				...datosCliente,
				tickets: tickets.ok
					? resumenTickets(tickets.tickets, { areasSoporte, estadosCerrados })
					: null,
				// Mismos tickets crudos que ya trajo `getTickets` arriba: no es un
				// request extra a IspCube. La categoria depende del tipo de
				// conexion -radio (Sprint Banda) sigue un proceso de instalacion
				// distinto al de fibra-, ver `categoriaInstalacionDe`.
				alta_nap: tickets.ok
					? resumenAltaNap(tickets.tickets, {
							estadosCerrados,
							categoria: categoriaInstalacionDe(datosCliente.connections)
						})
					: null,
				pagos: cobranzas.ok ? pagosDeCobranzas(cobranzas.cobranzas) : null
			}
		};
	} catch (error) {
		console.error(`[cartera/sync] fallo el snapshot de ${code}:`, error);
		return { code, ok: false, reason: 'error' };
	}
}
```

- [ ] **Step 6: Verificar tipos/sintaxis del endpoint**

Run: `npm run check`
Expected: sin errores nuevos.

- [ ] **Step 7: Commit**

```bash
git add src/lib/cartera/normalizar.js src/lib/cartera/normalizar.test.js src/routes/api/cartera/sync/+server.js
git commit -m "feat(cartera): sprint banda usa el ticket de instalacion de radio, no NAP"
```

---

## Verificación final

- [ ] **Correr toda la suite de una vez**

Run: `npm run test`
Expected: PASS, sin regresiones en ningún archivo de `src/lib/cartera/` ni del resto del repo.

- [ ] **Correr el chequeo de tipos de todo el proyecto**

Run: `npm run check`
Expected: sin errores nuevos respecto al estado del repo antes de este plan.

- [ ] **Revisar el diff completo antes de dar por terminado**

Run: `git log --oneline -4` y `git diff main --stat` (si se trabajó en una rama) o `git show --stat HEAD~4..HEAD` (si se commiteó directo en `main`), para confirmar que los 4 commits tocan exactamente los archivos listados en cada task y nada más.
