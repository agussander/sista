# Switch habilitar/deshabilitar "Quiero que me llamen" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar al panel de admin "Quiero que me llamen" un switch de 3 estados (Auto / Abierto / Cerrado) que se superpone al horario automático existente, mostrando además si el formulario está visible ahora y por qué.

**Architecture:** Lógica pura compartida (`src/lib/llamenme/visibility.js`) decide si el formulario debe verse combinando el override manual con el horario. Un módulo de acceso a datos (`src/lib/llamenme/config.js`) lee/escribe el override en el registro `key="llamenme"` de la colección genérica `config` de PocketBase (`values.state`). El store de admin (`llamenmeStore.svelte.js`) expone el override con asignación optimista; `Llamenme.svelte` agrega la UI del switch; `Hero.svelte` consume el override al montar para decidir si mostrar el form público.

**Tech Stack:** SvelteKit, Svelte 5 runes, PocketBase JS SDK, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-30-llamenme-override-switch-design.md`

**Requisito externo:** la colección `config` (campos `key`: texto, `values`: JSON) y el registro `{ key: "llamenme", values: { state: "auto" } }` ya fueron creados por el usuario en PocketHost, con reglas API list/view públicas y update solo autenticado.

---

### Task 1: Módulo de visibilidad compartido

**Files:**
- Create: `src/lib/llamenme/visibility.js`
- Test: `src/lib/llamenme/visibility.test.js`

- [ ] **Step 1: Escribir los tests**

```js
// src/lib/llamenme/visibility.test.js
import { describe, it, expect } from 'vitest';
import { isWithinCallHours, computeFormVisible, OVERRIDE_VALUES } from './visibility.js';

describe('isWithinCallHours', () => {
	it('es true un miércoles al mediodía', () => {
		expect(isWithinCallHours(new Date('2024-01-10T15:00:00Z'))).toBe(true);
	});

	it('es false un miércoles a las 20:00 ART', () => {
		expect(isWithinCallHours(new Date('2024-01-10T23:00:00Z'))).toBe(false);
	});

	it('es false un sábado al mediodía', () => {
		expect(isWithinCallHours(new Date('2024-01-13T15:00:00Z'))).toBe(false);
	});

	it('incluye el borde de apertura, 9:30 ART', () => {
		expect(isWithinCallHours(new Date('2024-01-10T12:30:00Z'))).toBe(true);
	});

	it('excluye un minuto antes de abrir, 9:29 ART', () => {
		expect(isWithinCallHours(new Date('2024-01-10T12:29:00Z'))).toBe(false);
	});

	it('incluye el borde de cierre, 16:30 ART', () => {
		expect(isWithinCallHours(new Date('2024-01-10T19:30:00Z'))).toBe(true);
	});

	it('excluye un minuto después de cerrar, 16:31 ART', () => {
		expect(isWithinCallHours(new Date('2024-01-10T19:31:00Z'))).toBe(false);
	});
});

describe('computeFormVisible', () => {
	const dentroDeHorario = new Date('2024-01-10T15:00:00Z'); // miércoles 12:00 ART
	const fueraDeHorario = new Date('2024-01-10T23:00:00Z'); // miércoles 20:00 ART

	it('"abierto" fuerza visible aunque esté fuera de horario', () => {
		expect(computeFormVisible('abierto', fueraDeHorario)).toBe(true);
	});

	it('"cerrado" fuerza oculto aunque esté dentro de horario', () => {
		expect(computeFormVisible('cerrado', dentroDeHorario)).toBe(false);
	});

	it('"auto" sigue el horario cuando está dentro', () => {
		expect(computeFormVisible('auto', dentroDeHorario)).toBe(true);
	});

	it('"auto" sigue el horario cuando está fuera', () => {
		expect(computeFormVisible('auto', fueraDeHorario)).toBe(false);
	});

	it('un valor desconocido se comporta como "auto"', () => {
		expect(computeFormVisible('lo-que-sea', dentroDeHorario)).toBe(true);
	});
});

describe('OVERRIDE_VALUES', () => {
	it('contiene los 3 estados válidos', () => {
		expect(OVERRIDE_VALUES).toEqual(['auto', 'abierto', 'cerrado']);
	});
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npm test -- src/lib/llamenme/visibility.test.js`
Expected: FAIL — `Cannot find module './visibility.js'` (el archivo todavía no existe).

- [ ] **Step 3: Implementar el módulo**

```js
// src/lib/llamenme/visibility.js
// Horario de atención en el que se muestra "Quiero que me llamen":
// lunes a viernes de 9:30 a 16:30, hora de Buenos Aires (GMT-3).
// Se calcula la hora en esa zona horaria sin depender del reloj/zona del
// dispositivo del visitante.
export function isWithinCallHours(now = new Date()) {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: 'America/Argentina/Buenos_Aires',
		weekday: 'short',
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23'
	}).formatToParts(now);

	const get = (type) => parts.find((p) => p.type === type)?.value;

	const isWeekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(get('weekday'));
	const minutes = parseInt(get('hour'), 10) * 60 + parseInt(get('minute'), 10);

	const start = 9 * 60 + 30; // 9:30
	const end = 16 * 60 + 30; // 16:30

	return isWeekday && minutes >= start && minutes <= end;
}

export const OVERRIDE_VALUES = ['auto', 'abierto', 'cerrado'];

// Combina el override manual del admin con el horario automático.
// override: 'auto' | 'abierto' | 'cerrado' (cualquier otro valor => 'auto').
export function computeFormVisible(override, now = new Date()) {
	if (override === 'abierto') return true;
	if (override === 'cerrado') return false;
	return isWithinCallHours(now);
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm test -- src/lib/llamenme/visibility.test.js`
Expected: PASS (13 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/llamenme/visibility.js src/lib/llamenme/visibility.test.js
git commit -m "feat: extraer horario de atención y agregar override de 3 estados"
```

---

### Task 2: Acceso a la config de PocketBase

**Files:**
- Create: `src/lib/llamenme/config.js`
- Test: `src/lib/llamenme/config.test.js`

- [ ] **Step 1: Escribir los tests con `pb` mockeado**

```js
// src/lib/llamenme/config.test.js
import { describe, it, expect, vi } from 'vitest';
import { fetchOverride, saveOverride } from './config.js';

describe('fetchOverride', () => {
	it('devuelve el estado guardado', async () => {
		const pb = {
			collection: () => ({
				getFirstListItem: vi.fn().mockResolvedValue({ id: '1', values: { state: 'abierto' } })
			})
		};
		expect(await fetchOverride(pb)).toBe('abierto');
	});

	it('normaliza un estado inválido a "auto"', async () => {
		const pb = {
			collection: () => ({
				getFirstListItem: vi.fn().mockResolvedValue({ id: '1', values: { state: 'lo-que-sea' } })
			})
		};
		expect(await fetchOverride(pb)).toBe('auto');
	});

	it('hace fail-open a "auto" si la colección falla', async () => {
		const pb = {
			collection: () => ({
				getFirstListItem: vi.fn().mockRejectedValue(new Error('no existe'))
			})
		};
		expect(await fetchOverride(pb)).toBe('auto');
	});
});

describe('saveOverride', () => {
	it('guarda el nuevo estado preservando otras claves de values', async () => {
		const update = vi.fn().mockImplementation((id, data) => Promise.resolve({ id, ...data }));
		const pb = {
			collection: () => ({
				getFirstListItem: vi.fn().mockResolvedValue({ id: '1', values: { state: 'auto', otraClave: 42 } }),
				update
			})
		};
		const result = await saveOverride(pb, 'cerrado');
		expect(result).toBe('cerrado');
		expect(update).toHaveBeenCalledWith('1', { values: { state: 'cerrado', otraClave: 42 } });
	});

	it('propaga el error si falla la actualización', async () => {
		const pb = {
			collection: () => ({
				getFirstListItem: vi.fn().mockResolvedValue({ id: '1', values: { state: 'auto' } }),
				update: vi.fn().mockRejectedValue(new Error('network'))
			})
		};
		await expect(saveOverride(pb, 'abierto')).rejects.toThrow('network');
	});
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npm test -- src/lib/llamenme/config.test.js`
Expected: FAIL — `Cannot find module './config.js'`.

- [ ] **Step 3: Implementar el módulo**

```js
// src/lib/llamenme/config.js
// Acceso a la colección genérica "config" de PocketBase.
// Cada registro es { key, values } — este módulo maneja el registro
// key="llamenme", cuyo values.state guarda el override del formulario
// "Quiero que me llamen": 'auto' | 'abierto' | 'cerrado'.
import { OVERRIDE_VALUES } from './visibility.js';

const COLLECTION = 'config';
const KEY = 'llamenme';
const DEFAULT_STATE = 'auto';

function normalize(state) {
	return OVERRIDE_VALUES.includes(state) ? state : DEFAULT_STATE;
}

// Devuelve el override guardado. Fail-open: ante cualquier error (colección
// sin crear, red caída, registro inexistente) devuelve 'auto' para que la web
// caiga al horario automático en vez de romperse.
export async function fetchOverride(pb) {
	try {
		const record = await pb.collection(COLLECTION).getFirstListItem(`key="${KEY}"`);
		return normalize(record.values?.state);
	} catch (e) {
		console.error('No se pudo leer la config de llamenme:', e);
		return DEFAULT_STATE;
	}
}

// Actualiza values.state del registro "llamenme", preservando el resto de
// las claves de values. A diferencia de fetchOverride, no atrapa errores: el
// llamador (admin) los necesita para poder hacer rollback.
export async function saveOverride(pb, state) {
	const record = await pb.collection(COLLECTION).getFirstListItem(`key="${KEY}"`);
	const updated = await pb.collection(COLLECTION).update(record.id, {
		values: { ...record.values, state }
	});
	return updated.values.state;
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm test -- src/lib/llamenme/config.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/llamenme/config.js src/lib/llamenme/config.test.js
git commit -m "feat: leer y guardar el override de llamenme en la coleccion config"
```

---

### Task 3: Override en el store del admin

**Files:**
- Modify: `src/routes/admin/_components/mantenimiento/Dashboard/llamenme/llamenmeStore.svelte.js`

- [ ] **Step 1: Importar el módulo de config**

En la sección de imports, agregar debajo de `applyCreate, applyUpdate, applyDelete`:

```js
import { fetchOverride, saveOverride } from '$lib/llamenme/config.js';
```

- [ ] **Step 2: Agregar el estado reactivo del override**

Junto al resto del estado del módulo (después de `let error = $state('');`):

```js
let override = $state('auto');
```

- [ ] **Step 3: Agregar `loadOverride` y `setOverride`**

Agregar estas funciones cerca de `assign` (antes del `export const llamenmeStore`):

```js
async function loadOverride() {
	override = await fetchOverride(pb);
}

// Asignación optimista del override, con rollback ante error (mismo patrón que assign).
async function setOverride(value) {
	const prev = override;
	override = value;
	try {
		await saveOverride(pb, value);
	} catch (e) {
		console.error(e);
		override = prev;
		error = 'No se pudo guardar el estado del formulario.';
		setTimeout(() => (error = ''), 3000);
	}
}
```

- [ ] **Step 4: Exponer el override y las nuevas funciones**

En el objeto exportado `llamenmeStore`, agregar el getter junto a los demás y las funciones junto a `assign`:

```js
export const llamenmeStore = {
	get leads() {
		return leads;
	},
	get unread() {
		return unread;
	},
	get newIds() {
		return newIds;
	},
	get loading() {
		return loading;
	},
	get error() {
		return error;
	},
	get override() {
		return override;
	},
	start,
	stop,
	load,
	markRead,
	assign,
	loadOverride,
	setOverride
};
```

- [ ] **Step 5: Verificar sintaxis**

Run: `npm run check`
Expected: sin errores nuevos relacionados a `llamenmeStore.svelte.js`.

- [ ] **Step 6: Commit**

```bash
git add src/routes/admin/_components/mantenimiento/Dashboard/llamenme/llamenmeStore.svelte.js
git commit -m "feat: exponer override de llamenme desde el store del admin"
```

---

### Task 4: Cargar el override al abrir el admin

**Files:**
- Modify: `src/routes/admin/_components/mantenimiento/Dashboard.svelte:19-26`

- [ ] **Step 1: Llamar a `loadOverride()` junto al arranque del store**

Reemplazar el bloque actual:

```js
onMount(() => {
    llamenmeStore.start();
    // El autoplay de audio requiere un gesto previo del usuario: lo habilitamos
    // con el primer click en cualquier parte del admin.
    const onFirstClick = () => primeAudio();
    window.addEventListener('click', onFirstClick, { once: true });
    return () => window.removeEventListener('click', onFirstClick);
});
```

por:

```js
onMount(() => {
    llamenmeStore.start();
    llamenmeStore.loadOverride();
    // El autoplay de audio requiere un gesto previo del usuario: lo habilitamos
    // con el primer click en cualquier parte del admin.
    const onFirstClick = () => primeAudio();
    window.addEventListener('click', onFirstClick, { once: true });
    return () => window.removeEventListener('click', onFirstClick);
});
```

- [ ] **Step 2: Verificar sintaxis**

Run: `npm run check`
Expected: sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add src/routes/admin/_components/mantenimiento/Dashboard.svelte
git commit -m "feat: cargar el override de llamenme al abrir el admin"
```

---

### Task 5: UI del switch en el panel de admin

**Files:**
- Modify: `src/routes/admin/_components/mantenimiento/Dashboard/llamenme/Llamenme.svelte`

- [ ] **Step 1: Importar el módulo de visibilidad y leer el override del store**

En el `<script>`, debajo del import existente de `llamenmeLogic.js`, agregar:

```js
import { computeFormVisible, isWithinCallHours } from '$lib/llamenme/visibility.js';
```

Debajo de `const newIds = $derived(llamenmeStore.newIds);`, agregar:

```js
const override = $derived(llamenmeStore.override);
const setOverride = (value) => llamenmeStore.setOverride(value);

const overrideOptions = [
    { value: 'auto', label: 'Auto' },
    { value: 'abierto', label: 'Abierto' },
    { value: 'cerrado', label: 'Cerrado' }
];

// Estado "ahora" del formulario público. Es informativo: se calcula al
// renderizar el panel, no se actualiza en vivo mientras queda abierto.
const now = new Date();
const visibleNow = $derived(computeFormVisible(override, now));
const reasonNow = $derived(
    override === 'abierto'
        ? 'forzado abierto'
        : override === 'cerrado'
            ? 'forzado cerrado'
            : isWithinCallHours(now)
                ? 'por horario de atención'
                : 'fuera de horario'
);
```

- [ ] **Step 2: Agregar el panel de switch al markup**

Insertar entre el `<div class="header">...</div>` y el bloque `{#if loading}`:

```svelte
    <div class="override-panel">
        <div class="override-switch" role="group" aria-label="Habilitar formulario">
            {#each overrideOptions as opt}
                <button
                    type="button"
                    class="override-btn"
                    class:active={override === opt.value}
                    onclick={() => setOverride(opt.value)}
                >{opt.label}</button>
            {/each}
        </div>
        <p class="override-status">
            El formulario está <strong>{visibleNow ? 'visible' : 'oculto'}</strong> ahora
            ({reasonNow}).
        </p>
    </div>
```

- [ ] **Step 3: Agregar los estilos**

Al final del bloque `<style>`, agregar:

```css
.override-panel {
    display: flex;
    flex-direction: column;
    gap: 0.5em;
    margin-bottom: 1.5em;
    padding: 1em 1.2em;
    background: #fff;
    border-radius: 0.6em;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}
.override-switch {
    display: inline-flex;
    gap: 0.4em;
}
.override-btn {
    background: #fff;
    color: var(--violeta1);
    border: 1.5px solid #e0d6f0;
    border-radius: 0.4em;
    padding: 0.45em 0.9em;
    cursor: pointer;
    font-size: 0.9em;
    font-family: inherit;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.override-btn:hover {
    background: #f3eefb;
}
.override-btn.active {
    background: var(--violeta1);
    color: #fff;
    border-color: var(--violeta1);
}
.override-status {
    margin: 0;
    color: #666;
    font-size: 0.9em;
}
```

- [ ] **Step 4: Verificar sintaxis**

Run: `npm run check`
Expected: sin errores nuevos en `Llamenme.svelte`.

- [ ] **Step 5: Commit**

```bash
git add src/routes/admin/_components/mantenimiento/Dashboard/llamenme/Llamenme.svelte
git commit -m "feat: agregar switch de 3 estados al panel de llamenme"
```

---

### Task 6: Consumir el override en el formulario público

**Files:**
- Modify: `src/lib/components/home/Hero.svelte:1-47`

- [ ] **Step 1: Importar `pb` y el módulo de visibilidad compartido**

Agregar a los imports existentes (junto a los demás `import`):

```js
    import { pb } from '$lib/pocketbase';
    import { computeFormVisible } from '$lib/llamenme/visibility.js';
    import { fetchOverride } from '$lib/llamenme/config.js';
```

- [ ] **Step 2: Eliminar la función `isWithinCallHours` inline y usar el override en `onMount`**

Reemplazar este bloque completo:

```js
    // El form "quiero que me llamen" solo se muestra en horario de atención:
    // lunes a viernes de 9:30 a 16:30 (hora de Buenos Aires, GMT-3).
    // Se calcula la hora en la zona horaria de Argentina sin depender del reloj
    // ni la zona horaria del dispositivo del visitante.
    function isWithinCallHours(now = new Date()) {
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/Argentina/Buenos_Aires',
            weekday: 'short',
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23'
        }).formatToParts(now);

        const get = (type) => parts.find((p) => p.type === type)?.value;

        const isWeekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(get('weekday'));
        const minutes = parseInt(get('hour'), 10) * 60 + parseInt(get('minute'), 10);

        const start = 9 * 60 + 30;  // 9:30
        const end = 16 * 60 + 30;   // 16:30

        return isWeekday && minutes >= start && minutes <= end;
    }

    onMount(() => {
        mounted = true;
        showLlamenme = isWithinCallHours();
    });
```

por:

```js
    // El form "quiero que me llamen" se muestra según el horario de atención
    // (lunes a viernes de 9:30 a 16:30 ART), salvo que un admin lo haya forzado
    // abierto o cerrado desde el panel (ver src/lib/llamenme/visibility.js).
    onMount(async () => {
        mounted = true;
        const override = await fetchOverride(pb);
        showLlamenme = computeFormVisible(override);
    });
```

- [ ] **Step 3: Verificar sintaxis**

Run: `npm run check`
Expected: sin errores nuevos en `Hero.svelte`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/home/Hero.svelte
git commit -m "feat: aplicar el override de llamenme en el formulario publico"
```

---

### Task 7: Verificación final

**Files:** ninguno (solo comandos)

- [ ] **Step 1: Correr toda la suite de tests**

Run: `npm test`
Expected: PASS, incluyendo los nuevos `visibility.test.js` y `config.test.js`, sin regresiones en `llamenmeLogic.test.js` ni el resto de la suite.

- [ ] **Step 2: Correr el chequeo de tipos/sintaxis de todo el proyecto**

Run: `npm run check`
Expected: sin errores nuevos respecto al estado previo al branch (puede haber warnings preexistentes no relacionados).

- [ ] **Step 3: Build de producción**

Run: `npm run build`
Expected: build exitoso, sin errores de compilación en `Hero.svelte`, `Llamenme.svelte`, `Dashboard.svelte` ni `llamenmeStore.svelte.js`.

- [ ] **Step 4: Verificación manual en navegador**

El servidor de preview MCP no funciona en este entorno (EPERM de `uv_cwd` sobre `~/Documents`), así que esta verificación es manual:

1. Correr `npm run dev` y abrir el admin (`/admin`, login, panel "Quiero que me llamen").
2. Confirmar que aparece el switch Auto/Abierto/Cerrado con "Auto" activo por default y el texto de estado (visible/oculto + motivo) coherente con la hora actual.
3. Click en "Abierto": el texto debe pasar a "visible ahora (forzado abierto)".
4. Click en "Cerrado": el texto debe pasar a "oculto ahora (forzado cerrado)".
5. Abrir la home (`/`) en otra pestaña/ventana (o recargarla) con el override en "Cerrado": el formulario "Quiero que me llamen" del Hero no debe aparecer, sin importar la hora.
6. Volver a "Abierto" y recargar la home: el formulario debe aparecer, sin importar la hora.
7. Volver a "Auto" y confirmar que la home vuelve a regirse por el horario de atención.
8. Recargar el panel de admin: el switch debe recordar el último valor guardado (persistencia confirmada).

Reportar a el usuario cualquier desvío antes de dar la tarea por terminada.

---

## Spec Coverage

- Modelo de 3 estados (`auto`/`abierto`/`cerrado`) → Tasks 1, 5.
- Propagación en próxima carga (sin realtime) → Task 6 (`onMount`, sin suscripción).
- Persistencia en colección `config` con `key`/`values.state` → Task 2.
- Store con asignación optimista y rollback → Task 3.
- UI del switch + línea de estado "visible/oculto ahora + motivo" → Task 5.
- Fail-open a `auto` ante error de red/colección → Task 2 (`fetchOverride`).
- Tests de horario, override y config → Tasks 1, 2.
