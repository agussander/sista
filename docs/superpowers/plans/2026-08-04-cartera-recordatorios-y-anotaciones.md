# Cartera — recordatorios y anotaciones desacopladas — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el tipo de anotación sea una etiqueta opcional sin efectos laterales, que apagar la alerta de seguimiento sea un botón explícito, y que un asesor pueda dejarse un recordatorio con fecha sobre un cliente.

**Architecture:** `src/lib/cartera/alertas.js` sigue siendo una función pura que recibe el registro del cliente y devuelve alertas; gana un cuarto parámetro con los recordatorios pendientes de ese cliente. `carteraStore.svelte.js` los trae en una sola consulta para toda la cartera y se los pasa. `ClienteDetalle.svelte` se parte en tres componentes: el armazón del modal, el bloque de recordatorios y el bloque de anotaciones.

**Tech Stack:** SvelteKit 2 + Svelte 5 (runes), PocketBase, Vitest.

**Spec:** [`docs/superpowers/specs/2026-08-04-cartera-recordatorios-y-anotaciones-design.md`](../specs/2026-08-04-cartera-recordatorios-y-anotaciones-design.md)

---

## Estructura de archivos

| Archivo | Qué pasa | Responsabilidad |
|---|---|---|
| `scripts/crear-colecciones-cartera.js` | Modificar | Crea `cartera_recordatorios` y pone `cartera_notas.tipo` en opcional |
| `src/lib/cartera/alertas.js` | Modificar | Cálculo puro de alertas; pierde `TIPOS_CONTACTO`, gana `recordatorio` |
| `src/lib/cartera/alertas.test.js` | Modificar | Tests del cálculo |
| `.../cartera/carteraStore.svelte.js` | Modificar | Estado y persistencia: recordatorios, `marcarContactado` |
| `.../cartera/ClienteDetalle.svelte` | Modificar | Armazón del modal: header, chips + botón de contactado, datos, pagos, footer |
| `.../cartera/RecordatoriosCliente.svelte` | **Crear** | Formulario y lista de recordatorios pendientes |
| `.../cartera/AnotacionesCliente.svelte` | **Crear** | Formulario de anotación y bitácora |
| `.../cartera/Cartera.svelte` | Modificar | Chip, peso de urgencia y filtro de recordatorios |

Ruta larga completa de los componentes: `src/routes/admin/_components/mantenimiento/Dashboard/cartera/`.

**Orden:** la Task 1 es prerrequisito de la 2 y de la 4 — sin el cambio de schema, guardar una nota sin tipo devuelve 400 y la colección de recordatorios no existe.

---

### Task 1: Schema en PocketBase

**Files:**
- Modify: `scripts/crear-colecciones-cartera.js`

El script es idempotente **por colección**: `crear()` saltea las que ya existen. Eso no alcanza para modificar una colección que ya está en producción, así que hace falta un PATCH explícito.

- [ ] **Step 1: Renombrar `reglaNotas` a `reglaPorCliente`**

Ahora la comparten dos colecciones. En `scripts/crear-colecciones-cartera.js`, línea ~232, cambiar la declaración:

```js
	// --- cartera_notas --------------------------------------------------------
	const reglaPorCliente = '@request.auth.id != "" && cliente.asesor = @request.auth.id';
```

y sus cinco usos dentro del `crear({ name: 'cartera_notas', ... })`:

```js
		listRule: reglaPorCliente,
		viewRule: reglaPorCliente,
		createRule: reglaPorCliente,
		updateRule: reglaPorCliente,
		deleteRule: reglaPorCliente
```

- [ ] **Step 2: Agregar el helper `ponerCampoOpcional`**

Insertarlo justo después de la función `crear()` (después de la línea 166, antes de `async function main()`):

```js
/**
 * Cambia `required` a false en un campo de una coleccion que YA existe.
 *
 * `crear()` es idempotente salteando la coleccion entera, asi que no sirve para
 * modificar algo que ya esta en produccion: hace falta un PATCH. Es el unico
 * paso del script que toca una coleccion existente, por eso avisa siempre que
 * hizo (o que no hizo, si ya estaba como corresponde).
 */
async function ponerCampoOpcional(nombreColeccion, nombreCampo) {
	const res = await api(`/api/collections/${nombreColeccion}`);
	if (!res.ok) {
		console.error(`- ${nombreColeccion}: no se pudo leer (${res.status})`, res.data);
		process.exit(1);
	}

	const campo = res.data.fields.find((f) => f.name === nombreCampo);
	if (!campo) {
		console.error(`- ${nombreColeccion}.${nombreCampo}: el campo no existe. Abortado.`);
		process.exit(1);
	}
	if (!campo.required) {
		console.log(`- ${nombreColeccion}.${nombreCampo}: ya es opcional, se saltea.`);
		return;
	}
	if (DRY_RUN) {
		console.log(`- ${nombreColeccion}.${nombreCampo}: SE PONDRIA opcional.`);
		return;
	}

	// El PATCH reemplaza `fields` entero: hay que mandar todos los campos, no
	// solo el que cambia, o los demas se borran.
	const fields = res.data.fields.map((f) =>
		f.name === nombreCampo ? { ...f, required: false } : f
	);
	const patch = await api(`/api/collections/${nombreColeccion}`, {
		method: 'PATCH',
		body: { fields }
	});
	if (!patch.ok) {
		console.error(
			`- ${nombreColeccion}.${nombreCampo}: FALLO`,
			patch.status,
			JSON.stringify(patch.data, null, 2)
		);
		process.exit(1);
	}
	console.log(`- ${nombreColeccion}.${nombreCampo}: ahora es opcional.`);
}
```

- [ ] **Step 3: Agregar la colección `cartera_recordatorios`**

En `main()`, después del `crear({ name: 'cartera_notas', ... })` y antes del comentario `// --- cartera_config`:

```js
	// --- cartera_recordatorios ------------------------------------------------
	// Mismas reglas que las notas: el dueño es el cliente, y el cliente es del
	// asesor. `fecha` es texto YYYY-MM-DD y no un campo `date` por lo mismo que
	// `fecha_instalacion`: todo src/lib/cartera/fechas.js compara fechas por sus
	// partes en hora local, y un `date` de PocketBase se serializa en UTC, que
	// es justo el bug que ese modulo existe para evitar.
	await crear({
		name: 'cartera_recordatorios',
		type: 'base',
		fields: [
			{
				name: 'cliente',
				type: 'relation',
				required: true,
				collectionId: clientesId,
				maxSelect: 1,
				cascadeDelete: true
			},
			{
				name: 'autor',
				type: 'relation',
				required: true,
				collectionId: usersId,
				maxSelect: 1,
				cascadeDelete: false
			},
			texto('fecha', { required: true }),
			texto('texto', { required: true }),
			booleano('hecho'),
			...fechasAutomaticas()
		],
		listRule: reglaPorCliente,
		viewRule: reglaPorCliente,
		createRule: reglaPorCliente,
		updateRule: reglaPorCliente,
		deleteRule: reglaPorCliente
	});
```

- [ ] **Step 4: Llamar a la migración de campo**

En `main()`, después del bloque de `cartera_config` y antes del comentario `// --- el registro unico de configuracion`:

```js
	// --- migraciones de campos ------------------------------------------------
	// `tipo` nacio obligatorio, cuando elegirlo tambien decidia si se apagaba la
	// alerta de seguimiento. Ahora es solo una etiqueta descriptiva y se puede
	// dejar vacia.
	console.log('\nMigraciones de campos:');
	await ponerCampoOpcional('cartera_notas', 'tipo');
```

- [ ] **Step 5: Sumar la colección nueva a la verificación**

Línea ~320, en el bucle de verificación:

```js
	for (const c of ['cartera_clientes', 'cartera_notas', 'cartera_config', 'cartera_recordatorios']) {
```

Y en el comentario de arriba, `las tres colecciones` → `las cuatro colecciones`.

- [ ] **Step 6: Actualizar el encabezado del archivo**

Línea 2: `Crea en PocketBase las tres colecciones de la Cartera de clientes.` → `Crea en PocketBase las cuatro colecciones de la Cartera de clientes.`

Y agregar al bloque de doc, después de la línea `* Es idempotente: una coleccion que ya existe se saltea, no se pisa. Correrlo dos veces no rompe nada.`:

```
 * La excepcion es `ponerCampoOpcional`, que SI modifica una coleccion existente
 * (con un PATCH), pero solo si el campo todavia no esta como corresponde.
```

- [ ] **Step 7: Correr en dry-run**

```bash
PB_SUPERUSER_EMAIL=... PB_SUPERUSER_PASSWORD=... node scripts/crear-colecciones-cartera.js --dry-run
```

Esperado: `cartera_recordatorios: SE CREARIA (6 campos)`, `cartera_notas.tipo: SE PONDRIA opcional`, y las tres colecciones existentes salteadas. Nada escrito.

- [ ] **Step 8: Correr de verdad**

```bash
PB_SUPERUSER_EMAIL=... PB_SUPERUSER_PASSWORD=... node scripts/crear-colecciones-cartera.js
```

Esperado: `cartera_recordatorios: creada.`, `cartera_notas.tipo: ahora es opcional.`, y la verificación final con las cuatro colecciones en 403/404.

- [ ] **Step 9: Correr una segunda vez para confirmar idempotencia**

```bash
PB_SUPERUSER_EMAIL=... PB_SUPERUSER_PASSWORD=... node scripts/crear-colecciones-cartera.js
```

Esperado: `cartera_recordatorios: ya existe, se saltea.` y `cartera_notas.tipo: ya es opcional, se saltea.` Sin errores.

- [ ] **Step 10: Commit**

El script todavía está sin trackear en git, así que este commit lo agrega entero.

```bash
git add scripts/crear-colecciones-cartera.js
git commit -m "feat(cartera): coleccion de recordatorios y tipo de nota opcional

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Desacoplar el tipo de nota de la alerta de seguimiento

**Files:**
- Modify: `src/lib/cartera/alertas.js`
- Modify: `src/lib/cartera/alertas.test.js`
- Modify: `src/routes/admin/_components/mantenimiento/Dashboard/cartera/carteraStore.svelte.js`
- Modify: `src/routes/admin/_components/mantenimiento/Dashboard/cartera/ClienteDetalle.svelte`

Los cuatro archivos van juntos: `TIPOS_CONTACTO` desaparece y el botón que lo reemplaza aparece en el mismo commit, para que nunca exista un estado donde la alerta de seguimiento no se pueda apagar.

- [ ] **Step 1: Borrar el test de `TIPOS_CONTACTO`**

En `src/lib/cartera/alertas.test.js`, borrar el bloque del final del archivo:

```js
describe('TIPOS_CONTACTO', () => {
	it('nota no es un tipo de contacto', () => {
		expect(TIPOS_CONTACTO).toEqual(['llamada', 'whatsapp', 'visita']);
	});
});
```

Y sacarlo del import de la línea 2:

```js
import { alertasDe, diaCorteDe } from './alertas.js';
```

- [ ] **Step 2: Correr los tests para ver el fallo**

```bash
npm test -- src/lib/cartera/alertas.test.js
```

Esperado: PASS. (`TIPOS_CONTACTO` sigue exportado, solo dejó de usarse — este paso confirma que no rompimos nada más antes de tocar el módulo.)

- [ ] **Step 3: Borrar `TIPOS_CONTACTO` de `alertas.js`**

En `src/lib/cartera/alertas.js`, borrar el bloque de las líneas 22-26:

```js
/**
 * Tipos de nota que cuentan como contacto con el cliente. `nota` queda afuera
 * a proposito: sirve para dejar contexto sin cerrar el pendiente.
 */
export const TIPOS_CONTACTO = ['llamada', 'whatsapp', 'visita'];
```

Y en el doc comment de `alertasDe`, corregir la frase que ya no es cierta:

```js
 * lista muestra hasta 500 clientes y pedir las notas de cada uno para saber si
 * alguien ya llamo seria una consulta por fila. En su lugar, `cartera_notas`
 * sigue siendo la bitacora completa y `cliente.ultimo_contacto` es la marca
 * desnormalizada que escribe el store cuando el asesor aprieta «Marcar
 * contactado».
```

- [ ] **Step 4: Correr los tests**

```bash
npm test -- src/lib/cartera/alertas.test.js
```

Esperado: PASS, todos los tests del archivo.

- [ ] **Step 5: Sacar el efecto lateral de `agregarNota` y agregar `marcarContactado`**

En `carteraStore.svelte.js`, línea 11, sacar el import:

```js
import { alertasDe } from '$lib/cartera/alertas.js';
```

Reemplazar la función `agregarNota` entera (líneas 337-366) por:

```js
/**
 * Guarda una anotacion en la bitacora del cliente.
 *
 * `tipo` es solo una etiqueta descriptiva y puede venir vacio: apagar la alerta
 * de seguimiento es `marcarContactado`, una decision explicita del asesor, no
 * una consecuencia de elegir una etiqueta en el formulario.
 */
async function agregarNota(clienteId, tipo, texto) {
	return await pb.collection(NOTAS).create({
		cliente: clienteId,
		autor: pb.authStore.record.id,
		tipo,
		texto
	});
}

/**
 * Marca al cliente como contactado hoy: apaga la alerta de seguimiento.
 *
 * `ultimo_contacto` existe desnormalizado en el registro del cliente porque la
 * lista muestra hasta 500 clientes y deducirlo de la bitacora costaria una
 * consulta por fila.
 *
 * @returns {Promise<boolean>} si se pudo guardar
 */
async function marcarContactado(cliente) {
	try {
		const guardado = await pb
			.collection(CLIENTES)
			.update(cliente.id, { ultimo_contacto: hoyISO() });
		clientes = clientes.map((c) => (c.id === guardado.id ? guardado : c));
		return true;
	} catch (e) {
		console.error('[cartera] no se pudo marcar el contacto:', e);
		return false;
	}
}
```

Y exportarla en el objeto `carteraStore` del final, después de `agregarNota,`:

```js
	agregarNota,
	marcarContactado,
```

- [ ] **Step 6: Sacar el import y el texto de ayuda de `ClienteDetalle.svelte`**

Línea 10:

```js
import { diaCorteDe } from '$lib/cartera/alertas.js';
```

Borrar el párrafo de ayuda (líneas 215-219), que describe un comportamiento que ya no existe:

```svelte
                <p class="ayuda">
                    {TIPOS_CONTACTO.includes(tipo)
                        ? 'Cuenta como contacto: apaga la alerta de los 2 meses.'
                        : 'Nota interna: no apaga la alerta de los 2 meses.'}
                </p>
```

Y su regla de CSS (línea 309):

```css
.ayuda { color: #9ca3af; font-size: 0.82em; margin: 1em 0 0; }
```

- [ ] **Step 7: Agregar el botón «Marcar contactado»**

En el `<script>` de `ClienteDetalle.svelte`, después de `const ETIQUETA_ALERTA = { … };`:

```js
let marcando = $state(false);
let errorAlerta = $state('');

// Apagar la alerta de seguimiento es una accion propia, no un efecto de guardar
// una nota. Si falla, la alerta queda encendida: es el lado seguro del error.
async function marcarContactado() {
    marcando = true;
    errorAlerta = '';
    const ok = await carteraStore.marcarContactado(actual);
    if (!ok) errorAlerta = 'No se pudo marcar el contacto. Probá de nuevo.';
    marcando = false;
}
```

Reemplazar el bloque de alertas (líneas 158-164) por:

```svelte
        {#if alertas.length > 0}
            <div class="alertas">
                {#each alertas as a}
                    {#if a.tipo === 'seguimiento'}
                        <span class="chip seguimiento">
                            {ETIQUETA_ALERTA.seguimiento}
                            <button class="marcar" onclick={marcarContactado} disabled={marcando}>
                                {marcando ? 'Guardando…' : 'Marcar contactado'}
                            </button>
                        </span>
                    {:else}
                        <span class="chip {a.tipo}">{ETIQUETA_ALERTA[a.tipo] ?? a.tipo}</span>
                    {/if}
                {/each}
            </div>
            {#if errorAlerta}<p class="error-alerta">{errorAlerta}</p>{/if}
        {/if}
```

Y agregar al `<style>`, después de la regla `.chip.tickets`:

```css
.chip.seguimiento { display: inline-flex; align-items: center; gap: 0.6em; }
.marcar {
    background: var(--violeta2); color: #fff; border: none; border-radius: 1em;
    padding: 0.25em 0.8em; font-size: 0.88em; font-weight: 600; cursor: pointer;
}
.marcar:disabled { opacity: 0.6; cursor: not-allowed; }
.error-alerta { color: #dc2626; font-size: 0.85em; margin: -0.8em 0 1.2em; }
```

- [ ] **Step 8: Verificar que no queda ninguna referencia**

```bash
grep -rn "TIPOS_CONTACTO" src/
```

Esperado: sin resultados.

- [ ] **Step 9: Correr tests y check**

```bash
npm test && npm run check
```

Esperado: todos los tests PASS y `svelte-check` sin errores nuevos.

- [ ] **Step 10: Commit**

```bash
git add src/lib/cartera/alertas.js src/lib/cartera/alertas.test.js src/routes/admin/_components/mantenimiento/Dashboard/cartera/carteraStore.svelte.js src/routes/admin/_components/mantenimiento/Dashboard/cartera/ClienteDetalle.svelte
git commit -m "feat(cartera): apagar la alerta de seguimiento es un boton, no el tipo de nota

Elegir 'llamada' escribia ultimo_contacto y apagaba la alerta de los 2
meses. Con 'llamada' preseleccionado, guardar una nota interna sin mirar
el selector apagaba una alerta que nadie decidio apagar.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: La alerta de recordatorio en `alertas.js`

**Files:**
- Modify: `src/lib/cartera/alertas.js`
- Test: `src/lib/cartera/alertas.test.js`

- [ ] **Step 1: Escribir los tests que fallan**

Agregar al final de `src/lib/cartera/alertas.test.js`:

```js
describe('alerta de recordatorio', () => {
	const hoy = { anio: 2026, mes: 8, dia: 4 };

	it('un recordatorio con fecha pasada la enciende', () => {
		const r = alertasDe(base, hoy, CONFIG, [
			{ fecha: '2026-08-01', texto: 'Llamar por el router' }
		]);

		expect(tipos(r)).toContain('recordatorio');
	});

	it('un recordatorio con fecha de hoy la enciende', () => {
		// El borde es >=: si me anote algo para hoy, hoy tengo que verlo.
		const r = alertasDe(base, hoy, CONFIG, [{ fecha: '2026-08-04', texto: 'Es hoy' }]);

		expect(tipos(r)).toContain('recordatorio');
	});

	it('un recordatorio futuro no la enciende', () => {
		const r = alertasDe(base, hoy, CONFIG, [{ fecha: '2026-08-05', texto: 'Es mañana' }]);

		expect(tipos(r)).not.toContain('recordatorio');
	});

	it('varios vencidos dan una sola alerta, la del mas viejo', () => {
		// En la practica hay uno por cliente; si hay varios, N chips iguales en
		// la fila de la lista solo hacen ruido. El detalle los lista a todos.
		const r = alertasDe(base, hoy, CONFIG, [
			{ fecha: '2026-08-03', texto: 'El nuevo' },
			{ fecha: '2026-07-20', texto: 'El viejo' }
		]);

		const recordatorios = r.filter((a) => a.tipo === 'recordatorio');
		expect(recordatorios).toHaveLength(1);
		expect(recordatorios[0].texto).toBe('El viejo');
		expect(recordatorios[0].desde).toBe('2026-07-20');
	});

	it('una fecha invalida o vacia se ignora', () => {
		const r = alertasDe(base, hoy, CONFIG, [
			{ fecha: '', texto: 'sin fecha' },
			{ fecha: 'pronto', texto: 'fecha en prosa' }
		]);

		expect(tipos(r)).not.toContain('recordatorio');
	});

	it('sin el cuarto argumento no emite recordatorio', () => {
		expect(tipos(alertasDe(base, hoy, CONFIG))).not.toContain('recordatorio');
	});
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

```bash
npm test -- src/lib/cartera/alertas.test.js
```

Esperado: FAIL en los tres primeros y en el de «varios vencidos» — `expected [ 'seguimiento' ] to include 'recordatorio'`. Los dos últimos (fecha inválida y sin argumento) pasan de entrada; son de regresión.

- [ ] **Step 3: Implementar la alerta**

En `src/lib/cartera/alertas.js`, agregar el cuarto parámetro a la firma y al doc comment:

```js
 * @param {any} cliente Registro de `cartera_clientes`
 * @param {import('./fechas.js').Partes} hoy
 * @param {ConfigCartera} config
 * @param {any[]} [recordatorios] Recordatorios PENDIENTES del cliente (`hecho = false`)
 * @returns {{tipo: string, desde: string | null, texto?: string}[]}
 */
export function alertasDe(cliente, hoy, config, recordatorios = []) {
```

Y agregar el bloque justo antes del `return alertas;` del final:

```js
	// --- Recordatorios --------------------------------------------------------
	// Una sola alerta aunque haya varios vencidos: la lista de la Cartera no gana
	// nada con N chips iguales en la misma fila, y el detalle los muestra todos.
	// Un recordatorio vencido NO se apaga con el paso del tiempo: sigue encendido
	// hasta que alguien lo marque hecho, porque un pendiente viejo es mas
	// urgente, no menos.
	const vencidos = (Array.isArray(recordatorios) ? recordatorios : [])
		.map((r) => ({ r, partes: partesFecha(r?.fecha) }))
		.filter(({ partes }) => partes && compararFechas(hoy, partes) >= 0)
		.sort((a, b) => compararFechas(a.partes, b.partes));

	if (vencidos.length > 0) {
		const primero = vencidos[0].r;
		alertas.push({ tipo: 'recordatorio', desde: primero.fecha, texto: primero.texto });
	}
```

`partesFecha` y `compararFechas` ya están importados arriba del archivo; no hace falta tocar el import.

- [ ] **Step 4: Correr los tests**

```bash
npm test -- src/lib/cartera/alertas.test.js
```

Esperado: PASS, los seis tests nuevos y todos los viejos.

- [ ] **Step 5: Commit**

```bash
git add src/lib/cartera/alertas.js src/lib/cartera/alertas.test.js
git commit -m "feat(cartera): alerta de recordatorio vencido

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Recordatorios en el store

**Files:**
- Modify: `src/routes/admin/_components/mantenimiento/Dashboard/cartera/carteraStore.svelte.js`

- [ ] **Step 1: Declarar la colección y el estado**

Después de `const CONFIG = 'cartera_config';` (línea 18):

```js
const RECORDATORIOS = 'cartera_recordatorios';
```

Después de `let fallosRefresco = $state(new Set());` (línea 40):

```js
// clienteId -> recordatorios pendientes (`hecho = false`), ordenados por fecha.
//
// Se traen de una sola vez para toda la cartera, no por cliente: la lista
// muestra hasta 500 filas y una consulta por fila seria inviable. Es el mismo
// motivo por el que `ultimo_contacto` esta desnormalizado, con la diferencia de
// que aca una sola consulta alcanza y no hace falta mantener una copia.
let recordatorios = $state(new Map());
```

- [ ] **Step 2: Escribir la carga**

Después de la función `cargar()` (después de la línea 103):

```js
async function cargarRecordatorios() {
	try {
		const res = await pb.collection(RECORDATORIOS).getList(1, 500, {
			// Sin filtrar por asesor a proposito: la listRule de la coleccion ya
			// limita el resultado a los clientes del asesor autenticado. Es la
			// misma propiedad de la que depende `notasDe`.
			filter: 'hecho = false',
			sort: 'fecha'
		});

		const porCliente = new Map();
		for (const r of res.items) {
			const lista = porCliente.get(r.cliente) ?? [];
			lista.push(r);
			porCliente.set(r.cliente, lista);
		}
		recordatorios = porCliente;
	} catch (e) {
		// La Cartera funciona sin recordatorios: no es motivo para romper la
		// carga entera y dejar al asesor sin lista.
		console.error('[cartera] no se pudieron cargar los recordatorios:', e);
		recordatorios = new Map();
	}
}

/** Recordatorios pendientes de un cliente. Siempre un array. */
function recordatoriosDe(clienteId) {
	return recordatorios.get(clienteId) ?? [];
}

async function crearRecordatorio(clienteId, fecha, texto) {
	const creado = await pb.collection(RECORDATORIOS).create({
		cliente: clienteId,
		autor: pb.authStore.record.id,
		fecha,
		texto,
		hecho: false
	});

	// El Map se reasigna en vez de mutarse: es lo que hace que la lista de la
	// Cartera recalcule las alertas de esta fila.
	const copia = new Map(recordatorios);
	copia.set(
		clienteId,
		[...recordatoriosDe(clienteId), creado].sort((a, b) => a.fecha.localeCompare(b.fecha))
	);
	recordatorios = copia;
	return creado;
}

async function completarRecordatorio(recordatorio) {
	await pb.collection(RECORDATORIOS).update(recordatorio.id, { hecho: true });

	const lista = recordatoriosDe(recordatorio.cliente).filter((r) => r.id !== recordatorio.id);
	const copia = new Map(recordatorios);
	if (lista.length > 0) copia.set(recordatorio.cliente, lista);
	else copia.delete(recordatorio.cliente);
	recordatorios = copia;
}
```

`localeCompare` alcanza para ordenar: las fechas son `YYYY-MM-DD`, donde el orden alfabético y el cronológico coinciden.

- [ ] **Step 3: Llamar a la carga**

Dentro de `cargar()`, después de `clientes = res.items;` (línea 90):

```js
			clientes = res.items;
			await cargarRecordatorios();
```

- [ ] **Step 4: Pasar los recordatorios al cálculo**

Reemplazar `alertasDeCliente` (líneas 109-111):

```js
function alertasDeCliente(cliente) {
	return alertasDe(cliente, hoyPartes(), config, recordatoriosDe(cliente.id));
}
```

- [ ] **Step 5: Exportar las funciones nuevas**

En el objeto `carteraStore` del final, después de `marcarContactado,`:

```js
	marcarContactado,
	recordatoriosDe,
	crearRecordatorio,
	completarRecordatorio,
```

- [ ] **Step 6: Verificar**

```bash
npm test && npm run check
```

Esperado: todos los tests PASS y `svelte-check` sin errores nuevos.

- [ ] **Step 7: Commit**

```bash
git add src/routes/admin/_components/mantenimiento/Dashboard/cartera/carteraStore.svelte.js
git commit -m "feat(cartera): cargar, crear y completar recordatorios en el store

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Extraer `AnotacionesCliente.svelte`

**Files:**
- Create: `src/routes/admin/_components/mantenimiento/Dashboard/cartera/AnotacionesCliente.svelte`
- Modify: `src/routes/admin/_components/mantenimiento/Dashboard/cartera/ClienteDetalle.svelte`

Mudanza pura: el comportamiento no cambia. `ClienteDetalle.svelte` tiene 359 líneas y la Task 7 le suma un bloque entero.

- [ ] **Step 1: Crear el componente**

Contenido completo de `AnotacionesCliente.svelte`:

```svelte
<!-- src/routes/admin/_components/mantenimiento/Dashboard/cartera/AnotacionesCliente.svelte -->
<script>
// Bitacora del cliente: el formulario para dejar una anotacion y la lista de
// las que ya hay. Vive aparte de ClienteDetalle porque su estado (carga de
// notas, guardado, error) no tiene nada que ver con el snapshot de IspCube que
// muestra el resto del panel.
import { onMount } from 'svelte';
import Spinner from '$lib/components/ui/Spinner.svelte';
import { carteraStore } from './carteraStore.svelte.js';

let { cliente } = $props();

let notas = $state([]);
let cargando = $state(true);
let tipo = $state('llamada');
let texto = $state('');
let guardando = $state(false);
let error = $state('');

const TIPOS = [
    { value: 'llamada', label: 'Llamada' },
    { value: 'whatsapp', label: 'WhatsApp' },
    { value: 'visita', label: 'Visita' },
    { value: 'nota', label: 'Nota interna' }
];

async function cargar() {
    cargando = true;
    try {
        notas = await carteraStore.notasDe(cliente.id);
    } catch (e) {
        console.error(e);
        error = 'No se pudieron cargar las anotaciones.';
    } finally {
        cargando = false;
    }
}

async function guardar() {
    if (!texto.trim()) return;
    guardando = true;
    error = '';
    try {
        await carteraStore.agregarNota(cliente.id, tipo, texto.trim());
        texto = '';
        await cargar();
    } catch (e) {
        console.error(e);
        error = 'No se pudo guardar la anotación.';
    } finally {
        guardando = false;
    }
}

const fmt = (iso) => (iso ? new Date(iso).toLocaleDateString('es-AR') : '—');

onMount(cargar);
</script>

<section class="bloque">
    <h4>Anotaciones</h4>

    <form onsubmit={(e) => { e.preventDefault(); guardar(); }}>
        <div class="tipos">
            {#each TIPOS as t}
                <button
                    type="button"
                    class:activo={tipo === t.value}
                    onclick={() => (tipo = t.value)}
                >{t.label}</button>
            {/each}
        </div>
        <textarea
            bind:value={texto}
            placeholder="Qué hablaron, qué quedó pendiente…"
            rows="3"
            disabled={guardando}
        ></textarea>
        <button type="submit" class="guardar" disabled={guardando || !texto.trim()}>
            {guardando ? 'Guardando…' : 'Guardar anotación'}
        </button>
    </form>

    {#if error}<p class="error">{error}</p>{/if}

    {#if cargando}
        <Spinner />
    {:else if notas.length === 0}
        <p class="vacio">Todavía no hay anotaciones.</p>
    {:else}
        <ul class="bitacora">
            {#each notas as n (n.id)}
                <li>
                    <div class="meta">
                        <span class="tipo {n.tipo}">{TIPOS.find((t) => t.value === n.tipo)?.label ?? n.tipo}</span>
                        <span class="cuando">{fmt(n.created)}</span>
                    </div>
                    <p>{n.texto}</p>
                </li>
            {/each}
        </ul>
    {/if}
</section>

<style>
.bloque { border-top: 1px solid #ececec; padding-top: 1.5em; margin-top: 1.5em; }
h4 { margin: 0 0 1em; color: var(--violeta2); font-size: 1.05em; }
.tipos { display: flex; gap: 0.4em; flex-wrap: wrap; margin-bottom: 0.8em; }
.tipos button {
    border: 1.5px solid #e0e0e0; background: #fff; color: var(--violeta2);
    border-radius: 2em; padding: 0.4em 1em; cursor: pointer; font-size: 0.9em;
}
.tipos button.activo { background: var(--violeta2); color: #fff; border-color: var(--violeta2); }
textarea {
    width: 100%; padding: 0.8em 1em; border: 2px solid #e5e7eb; border-radius: 0.8em;
    font-family: inherit; font-size: 1em; box-sizing: border-box; resize: vertical;
}
textarea:focus { outline: none; border-color: var(--violeta2); }
.guardar {
    background: var(--violeta2); color: #fff; border: none; border-radius: 2em;
    padding: 0.7em 1.4em; font-weight: 600; cursor: pointer; margin-top: 0.8em;
}
.guardar:disabled { opacity: 0.6; cursor: not-allowed; }
.bitacora { list-style: none; padding: 0; margin: 1.5em 0 0; display: flex; flex-direction: column; gap: 0.8em; }
.bitacora li { background: #faf8fd; border-radius: 0.8em; padding: 0.9em 1.1em; }
.meta { display: flex; gap: 0.8em; align-items: center; margin-bottom: 0.4em; }
.tipo { font-size: 0.75em; padding: 0.2em 0.7em; border-radius: 1em; background: #ede7f6; color: #5a1e7a; }
.tipo.nota { background: #f3f4f6; color: #6b7280; }
.cuando { color: #9ca3af; font-size: 0.8em; }
.bitacora p { margin: 0; color: #374151; }
.vacio { color: #9ca3af; }
.error { color: #dc2626; font-size: 0.92em; }
</style>
```

- [ ] **Step 2: Sacar el bloque de `ClienteDetalle.svelte`**

Borrar del `<script>`: `import { onMount } from 'svelte';` queda (lo usa el `onMount` del final), pero se van `import Spinner from '$lib/components/ui/Spinner.svelte';`, las variables `notas`, `cargandoNotas`, `tipo`, `texto`, `guardando`, `error`, la constante `TIPOS`, las funciones `cargarNotas` y `guardarNota`, y del `onMount` la línea `await cargarNotas();`.

`onMount` queda así:

```js
onMount(() => {
    // Abrir el detalle cuenta como "vi los tickets".
    if (actual.tickets?.ultimo) carteraStore.marcarTicketsVistos(actual);
    carteraStore.sincronizar([actual.code]);
});
```

Agregar el import del componente nuevo, después del de `carteraStore`:

```js
import AnotacionesCliente from './AnotacionesCliente.svelte';
```

Reemplazar todo el `<section class="bloque">` de Anotaciones (el que empieza con `<h4>Anotaciones</h4>`) por:

```svelte
        <AnotacionesCliente {cliente} />
```

- [ ] **Step 3: Sacar el CSS que se fue**

De `<style>` de `ClienteDetalle.svelte`, borrar las reglas que ya no tienen elementos: `.tipos`, `.tipos button`, `.tipos button.activo`, `textarea`, `textarea:focus`, `.guardar`, `.guardar:disabled`, `.bitacora`, `.bitacora li`, `.meta`, `.tipo`, `.tipo.nota`, `.cuando`, `.bitacora p`, `.vacio`, `.error`.

`.bloque` y `h4` **se quedan**: los sigue usando el bloque de Pagos.

- [ ] **Step 4: Verificar**

```bash
npm run check
```

Esperado: sin errores. Svelte avisa de CSS sin usar como warning, así que si quedó alguna regla huérfana aparece acá.

- [ ] **Step 5: Probar a mano en el navegador**

Abrir el admin → Cartera → un cliente. El bloque de Anotaciones tiene que verse y comportarse exactamente igual que antes: carga la bitácora, guarda una nota y la lista se actualiza.

- [ ] **Step 6: Commit**

```bash
git add src/routes/admin/_components/mantenimiento/Dashboard/cartera/AnotacionesCliente.svelte src/routes/admin/_components/mantenimiento/Dashboard/cartera/ClienteDetalle.svelte
git commit -m "refactor(cartera): extraer AnotacionesCliente de ClienteDetalle

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Tipo de anotación opcional

**Files:**
- Modify: `src/routes/admin/_components/mantenimiento/Dashboard/cartera/AnotacionesCliente.svelte`

- [ ] **Step 1: Arrancar sin tipo y hacer los botones toggle**

En `AnotacionesCliente.svelte`, cambiar la declaración:

```js
// Sin tipo por defecto: es una etiqueta opcional, y preseleccionar uno hacia
// que el asesor guardara notas categorizadas sin haberlo decidido.
let tipo = $state('');
```

Y el `onclick` de los botones de tipo, para que el que ya está activo se deseleccione:

```svelte
                <button
                    type="button"
                    class:activo={tipo === t.value}
                    onclick={() => (tipo = tipo === t.value ? '' : t.value)}
                >{t.label}</button>
```

- [ ] **Step 2: No mostrar chip cuando la nota no tiene tipo**

En la bitácora, envolver el chip en un `{#if}`:

```svelte
                    <div class="meta">
                        {#if n.tipo}
                            <span class="tipo {n.tipo}">{TIPOS.find((t) => t.value === n.tipo)?.label ?? n.tipo}</span>
                        {/if}
                        <span class="cuando">{fmt(n.created)}</span>
                    </div>
```

- [ ] **Step 3: Verificar**

```bash
npm run check
```

Esperado: sin errores.

- [ ] **Step 4: Probar a mano en el navegador**

Abrir un cliente. Comprobar:
1. Al abrir, **ningún** botón de tipo está activo.
2. Guardar una nota sin elegir tipo funciona (si devuelve un error 400, la Task 1 no corrió contra PocketBase).
3. Esa nota aparece en la bitácora sin chip de categoría.
4. Click en un tipo lo activa; segundo click en el mismo lo desactiva.

- [ ] **Step 5: Commit**

```bash
git add src/routes/admin/_components/mantenimiento/Dashboard/cartera/AnotacionesCliente.svelte
git commit -m "feat(cartera): el tipo de anotacion es opcional y sin default

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: `RecordatoriosCliente.svelte`

**Files:**
- Create: `src/routes/admin/_components/mantenimiento/Dashboard/cartera/RecordatoriosCliente.svelte`
- Modify: `src/routes/admin/_components/mantenimiento/Dashboard/cartera/ClienteDetalle.svelte`

- [ ] **Step 1: Crear el componente**

Contenido completo de `RecordatoriosCliente.svelte`:

```svelte
<!-- src/routes/admin/_components/mantenimiento/Dashboard/cartera/RecordatoriosCliente.svelte -->
<script>
// Recordatorios del cliente: lo que el asesor se anota para hacer en una fecha.
// Va antes de las anotaciones a proposito: los recordatorios miran al futuro,
// la bitacora al pasado.
import { carteraStore } from './carteraStore.svelte.js';
import { partesFecha, compararFechas } from '$lib/cartera/fechas.js';

let { cliente } = $props();

let fecha = $state('');
let texto = $state('');
let guardando = $state(false);
let error = $state('');
// Id del recordatorio que se esta completando ahora mismo, para deshabilitar
// solo su boton y no los de los demas.
let completando = $state('');

const pendientes = $derived(carteraStore.recordatoriosDe(cliente.id));

function hoyPartes() {
    const d = new Date();
    return { anio: d.getFullYear(), mes: d.getMonth() + 1, dia: d.getDate() };
}

function vencido(r) {
    const p = partesFecha(r.fecha);
    return !!p && compararFechas(hoyPartes(), p) >= 0;
}

// Formateo por partes, sin `new Date(iso)`: un "2026-08-04" pasado por Date se
// interpreta en UTC y en Argentina (UTC-3) se muestra como el 3.
function fmtFecha(iso) {
    const p = partesFecha(iso);
    if (!p) return iso;
    return `${String(p.dia).padStart(2, '0')}/${String(p.mes).padStart(2, '0')}/${p.anio}`;
}

async function agregar() {
    if (!fecha || !texto.trim()) return;
    guardando = true;
    error = '';
    try {
        await carteraStore.crearRecordatorio(cliente.id, fecha, texto.trim());
        fecha = '';
        texto = '';
    } catch (e) {
        console.error(e);
        error = 'No se pudo guardar el recordatorio.';
    } finally {
        guardando = false;
    }
}

async function completar(r) {
    completando = r.id;
    error = '';
    try {
        await carteraStore.completarRecordatorio(r);
    } catch (e) {
        console.error(e);
        error = 'No se pudo marcar el recordatorio como hecho.';
    } finally {
        completando = '';
    }
}
</script>

<section class="bloque">
    <h4>Recordatorios</h4>

    <form onsubmit={(e) => { e.preventDefault(); agregar(); }}>
        <div class="campos">
            <!-- Se admite una fecha pasada a proposito: el asesor puede estar
                 cargando algo que quedo pendiente de antes, y en ese caso la
                 alerta se enciende de inmediato, que es lo correcto. -->
            <input
                type="date"
                bind:value={fecha}
                disabled={guardando}
                aria-label="Fecha del recordatorio"
            />
            <input
                type="text"
                bind:value={texto}
                placeholder="Qué hay que hacer…"
                disabled={guardando}
                aria-label="Texto del recordatorio"
            />
        </div>
        <button type="submit" class="guardar" disabled={guardando || !fecha || !texto.trim()}>
            {guardando ? 'Guardando…' : 'Agregar recordatorio'}
        </button>
    </form>

    {#if error}<p class="error">{error}</p>{/if}

    {#if pendientes.length === 0}
        <p class="vacio">Sin recordatorios pendientes.</p>
    {:else}
        <ul class="lista">
            {#each pendientes as r (r.id)}
                <li class:vencido={vencido(r)}>
                    <div class="que">
                        <span class="cuando">{fmtFecha(r.fecha)}</span>
                        <span class="texto">{r.texto}</span>
                    </div>
                    <button class="hecho" onclick={() => completar(r)} disabled={completando === r.id}>
                        {completando === r.id ? '…' : 'Hecho'}
                    </button>
                </li>
            {/each}
        </ul>
    {/if}
</section>

<style>
.bloque { border-top: 1px solid #ececec; padding-top: 1.5em; margin-top: 1.5em; }
h4 { margin: 0 0 1em; color: var(--violeta2); font-size: 1.05em; }
.campos { display: flex; flex-wrap: wrap; gap: 0.6em; }
input {
    padding: 0.7em 1em; border: 2px solid #e5e7eb; border-radius: 0.8em;
    font-family: inherit; font-size: 1em; box-sizing: border-box;
}
input[type='date'] { flex: 0 0 auto; }
input[type='text'] { flex: 1 1 14em; min-width: 0; }
input:focus { outline: none; border-color: var(--violeta2); }
.guardar {
    background: var(--violeta2); color: #fff; border: none; border-radius: 2em;
    padding: 0.7em 1.4em; font-weight: 600; cursor: pointer; margin-top: 0.8em;
}
.guardar:disabled { opacity: 0.6; cursor: not-allowed; }
.lista { list-style: none; padding: 0; margin: 1.2em 0 0; display: flex; flex-direction: column; gap: 0.6em; }
.lista li {
    display: flex; align-items: center; justify-content: space-between; gap: 1em;
    background: #faf8fd; border-radius: 0.8em; padding: 0.8em 1.1em;
    border-left: 4px solid transparent;
}
/* Mismo amber que las alertas de mora: un pendiente vencido es urgente, no un
   error del sistema. */
.lista li.vencido { border-left-color: #f0c674; background: #fffbeb; }
.que { display: flex; flex-direction: column; gap: 0.15em; min-width: 0; }
.cuando { color: #9ca3af; font-size: 0.8em; }
.texto { color: #374151; }
.hecho {
    background: #fff; border: 1.5px solid #e0e0e0; color: var(--violeta2);
    border-radius: 2em; padding: 0.4em 1em; cursor: pointer; font-size: 0.88em;
    flex-shrink: 0;
}
.hecho:disabled { opacity: 0.6; cursor: not-allowed; }
.vacio { color: #9ca3af; }
.error { color: #dc2626; font-size: 0.92em; }
</style>
```

- [ ] **Step 2: Montarlo en `ClienteDetalle.svelte`**

Agregar el import, junto al de `AnotacionesCliente`:

```js
import RecordatoriosCliente from './RecordatoriosCliente.svelte';
```

Y montarlo entre el bloque de Pagos y `<AnotacionesCliente {cliente} />`:

```svelte
        <RecordatoriosCliente {cliente} />
        <AnotacionesCliente {cliente} />
```

- [ ] **Step 3: Mostrar el chip de recordatorio en el detalle**

En `ClienteDetalle.svelte`, dentro del `{#each alertas as a}` que ya tiene la rama de `seguimiento`, agregar la rama del recordatorio. El bloque queda:

```svelte
                {#each alertas as a}
                    {#if a.tipo === 'seguimiento'}
                        <span class="chip seguimiento">
                            {ETIQUETA_ALERTA.seguimiento}
                            <button class="marcar" onclick={marcarContactado} disabled={marcando}>
                                {marcando ? 'Guardando…' : 'Marcar contactado'}
                            </button>
                        </span>
                    {:else if a.tipo === 'recordatorio'}
                        <span class="chip recordatorio">Recordatorio: {a.texto}</span>
                    {:else}
                        <span class="chip {a.tipo}">{ETIQUETA_ALERTA[a.tipo] ?? a.tipo}</span>
                    {/if}
                {/each}
```

Y su color en `<style>`, después de `.chip.tickets`. Verde, distinto de los cuatro existentes: el recordatorio lo puso el asesor, no lo dedujo el sistema.

```css
.chip.recordatorio { background: #d1fae5; color: #065f46; }
```

- [ ] **Step 4: Verificar**

```bash
npm run check
```

Esperado: sin errores.

- [ ] **Step 5: Probar a mano en el navegador**

Abrir un cliente. Comprobar:
1. El bloque «Recordatorios» aparece entre Pagos y Anotaciones, con «Sin recordatorios pendientes.»
2. El botón «Agregar recordatorio» está deshabilitado hasta que estén la fecha y el texto.
3. Cargar uno con fecha de hoy: aparece en la lista destacado en amber, y el chip «Recordatorio: …» aparece arriba, entre las alertas.
4. Cargar otro con fecha futura: aparece en la lista sin destacar y **no** agrega otro chip.
5. «Hecho» en el vencido lo saca de la lista y apaga el chip.

- [ ] **Step 6: Commit**

```bash
git add src/routes/admin/_components/mantenimiento/Dashboard/cartera/RecordatoriosCliente.svelte src/routes/admin/_components/mantenimiento/Dashboard/cartera/ClienteDetalle.svelte
git commit -m "feat(cartera): recordatorios por cliente en el detalle

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Recordatorios en la lista

**Files:**
- Modify: `src/routes/admin/_components/mantenimiento/Dashboard/cartera/Cartera.svelte`

- [ ] **Step 1: Sumar el peso de urgencia**

Línea 51:

```js
// Peso de cada alerta para que la fila comunique urgencia de un vistazo: un
// cliente con mora vencida se nota mas que uno que solo tiene el recordatorio
// de seguimiento, aun antes de leer los chips. Un recordatorio propio pesa como
// un ticket: lo puso el asesor a proposito, no lo dedujo el sistema.
const PESO = { mora_2: 3, mora_1: 2, tickets: 2, recordatorio: 2, seguimiento: 1 };
```

- [ ] **Step 2: Sumar el filtro**

En `FILTROS` (línea 73), después de la entrada de `tickets`:

```js
const FILTROS = [
    { value: 'todos', label: 'Todos' },
    { value: 'alerta', label: 'Con alerta' },
    { value: 'seguimiento', label: 'Seguimiento 2 meses' },
    { value: 'mora', label: 'En mora' },
    { value: 'tickets', label: 'Tickets nuevos' },
    { value: 'recordatorio', label: 'Recordatorios' }
];
```

No hace falta tocar `visibles`: cae en la rama genérica `alertas.some((a) => a.tipo === filtro)` que ya existe.

- [ ] **Step 3: Mostrar el chip**

En `ETIQUETAS` (línea 93), agregar la entrada de respaldo:

```js
const ETIQUETAS = {
    seguimiento: 'Contactar (2 meses)',
    mora_1: 'No pagó',
    mora_2: 'Mora vencida',
    tickets: 'Tickets nuevos',
    recordatorio: 'Recordatorio'
};
```

Y en el template (líneas 226-230), mostrar el texto del recordatorio en vez de la etiqueta genérica:

```svelte
                        <div class="alertas">
                            {#each alertas as a}
                                <span
                                    class="chip {a.tipo}"
                                    title={a.tipo === 'recordatorio' ? a.texto : null}
                                >
                                    {a.tipo === 'recordatorio'
                                        ? a.texto || ETIQUETAS.recordatorio
                                        : ETIQUETAS[a.tipo]}
                                </span>
                            {/each}
                        </div>
```

- [ ] **Step 4: Estilar el chip**

En `<style>`, después de `.chip.tickets`:

```css
/* Verde: distinto de las cuatro alertas que deduce el sistema, porque este lo
   escribio el asesor. El texto se recorta -el completo va en el `title`- para
   que un recordatorio largo no descuadre la fila. */
.chip.recordatorio {
    background: #d1fae5; color: #065f46;
    display: inline-block; max-width: 14em;
    overflow: hidden; text-overflow: ellipsis;
}
```

`.chip` ya trae `white-space: nowrap`, que es lo que hace falta para que el `text-overflow` funcione.

- [ ] **Step 5: Verificar**

```bash
npm test && npm run check
```

Esperado: todos los tests PASS y `svelte-check` sin errores.

- [ ] **Step 6: Probar a mano en el navegador**

En la lista de la Cartera, con un cliente que tenga un recordatorio vencido:
1. Su fila muestra el chip verde con el texto del recordatorio, recortado si es largo, y el completo al pasar el mouse.
2. El filtro «Recordatorios» deja solo a los clientes con uno vencido.
3. El borde izquierdo de la fila refleja la urgencia (media con solo el recordatorio; alta si además tiene mora).
4. Marcar el recordatorio como hecho en el detalle y cerrar: el chip desaparece de la fila sin recargar.

- [ ] **Step 7: Commit**

```bash
git add src/routes/admin/_components/mantenimiento/Dashboard/cartera/Cartera.svelte
git commit -m "feat(cartera): chip, filtro y urgencia de recordatorios en la lista

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Verificación final

- [ ] `npm test` — toda la suite en verde.
- [ ] `npm run check` — sin errores de `svelte-check`.
- [ ] `grep -rn "TIPOS_CONTACTO" src/` — sin resultados.
- [ ] Recorrido a mano completo: abrir un cliente con la alerta de seguimiento encendida, apretar «Marcar contactado», ver que el chip y el botón desaparecen; guardar una anotación sin tipo; cargar un recordatorio para hoy y verlo aparecer como chip en la lista; marcarlo hecho y ver que se apaga.
