# Encuesta de baja — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear la ruta `/encuestadebaja`, una encuesta de motivos de baja con preguntas condicionales que guarda las respuestas en PocketBase.

**Architecture:** Sigue el patrón ya existente en `src/routes/encuestadecalidad/`: una ruta delgada (`+page.svelte`) que monta un componente de encuesta autocontenido en `_components/`. La lógica de validación y armado del payload (qué campos son obligatorios según las ramas condicionales, cómo limpiar campos de ramas ocultas) se extrae a un módulo `.js` puro y testeable con Vitest, siguiendo el patrón usado en `src/routes/admin/_components/mantenimiento/Dashboard/llamenme/llamenmeLogic.js` (lógica separada del componente Svelte para poder testearla sin montar UI).

**Tech Stack:** SvelteKit (Svelte 5, sintaxis legada `export let` / `$:` — el mismo estilo que `encuestadecalidad`, no runas), PocketBase (`pb.collection(...).create(...)`), Vitest para tests unitarios.

---

## Nota sobre la colección de PocketBase

Antes de que el formulario funcione end-to-end contra el backend real, hay que crear manualmente en el admin de PocketBase (`https://sista.pockethost.io/_/`) una colección llamada **`encuesta_baja`** con estos campos (todos `text` excepto donde se indica), todos opcionales a nivel de esquema (la validación de obligatoriedad ocurre en el frontend, no en PocketBase):

`motivo`, `motivo_otro`, `pago_medio`, `pago_medio_otro`, `pago_inconvenientes` (bool), `pago_inconvenientes_comentario`, `contacto_previo` (bool), `contacto_no_motivo`, `contacto_no_otro`, `conformidad` (number), `que_diferente`, `volveria`, `volveria_condicion`, `comentarios`, `id_nombre`, `id_telefono`, `id_cliente`.

Esto es un paso manual fuera del código; no bloquea escribir y testear la lógica ni la UI (los tests unitarios de Task 1 no dependen de la colección real, y la verificación manual de Task 4 puede hacerse contra la colección real una vez creada).

---

### Task 1: Lógica pura de validación y armado del payload

**Files:**
- Create: `src/routes/encuestadebaja/_components/encuestaBajaLogic.js`
- Test: `src/routes/encuestadebaja/_components/encuestaBajaLogic.test.js`

- [ ] **Step 1: Escribir los tests (fallando)**

Crear `src/routes/encuestadebaja/_components/encuestaBajaLogic.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
	MOTIVO_PAGO,
	MOTIVO_OTRO,
	createEmptyData,
	isMotivoPago,
	isMotivoOtro,
	isPagoMedioOtro,
	isContactoNo,
	isContactoNoMotivoOtro,
	isVolveriaCondicionVisible,
	canSubmit,
	buildPayload
} from './encuestaBajaLogic.js';

describe('createEmptyData', () => {
	it('devuelve todos los campos vacíos', () => {
		const data = createEmptyData();
		expect(data.motivo).toBe('');
		expect(data.motivoOtro).toBe('');
		expect(data.pagoMedio).toBe('');
		expect(data.pagoMedioOtro).toBe('');
		expect(data.pagoInconvenientes).toBe('');
		expect(data.pagoInconvenientesComentario).toBe('');
		expect(data.contactoPrevio).toBe('');
		expect(data.contactoNoMotivo).toBe('');
		expect(data.contactoNoOtro).toBe('');
		expect(data.conformidad).toBe('');
		expect(data.queDiferente).toBe('');
		expect(data.volveria).toBe('');
		expect(data.volveriaCondicion).toBe('');
		expect(data.comentarios).toBe('');
		expect(data.idNombre).toBe('');
		expect(data.idTelefono).toBe('');
		expect(data.idCliente).toBe('');
	});
});

describe('detectores de rama', () => {
	it('isMotivoPago es true solo para el motivo de dificultades económicas', () => {
		expect(isMotivoPago(MOTIVO_PAGO)).toBe(true);
		expect(isMotivoPago('Contraté otro proveedor')).toBe(false);
		expect(isMotivoPago('')).toBe(false);
	});

	it('isMotivoOtro detecta el motivo "Otro"', () => {
		expect(isMotivoOtro(MOTIVO_OTRO)).toBe(true);
		expect(isMotivoOtro(MOTIVO_PAGO)).toBe(false);
	});

	it('isPagoMedioOtro detecta el medio "otro"', () => {
		expect(isPagoMedioOtro('otro')).toBe(true);
		expect(isPagoMedioOtro('efectivo')).toBe(false);
	});

	it('isContactoNo es true solo cuando la respuesta es "no"', () => {
		expect(isContactoNo('no')).toBe(true);
		expect(isContactoNo('sí')).toBe(false);
	});

	it('isContactoNoMotivoOtro detecta el motivo "otro"', () => {
		expect(isContactoNoMotivoOtro('otro')).toBe(true);
		expect(isContactoNoMotivoOtro('no sabía que se podía')).toBe(false);
	});

	it('isVolveriaCondicionVisible es true para "sí" y "tal vez", false para "no"', () => {
		expect(isVolveriaCondicionVisible('sí')).toBe(true);
		expect(isVolveriaCondicionVisible('tal vez')).toBe(true);
		expect(isVolveriaCondicionVisible('no')).toBe(false);
	});
});

describe('canSubmit', () => {
	const baseValid = () => ({
		...createEmptyData(),
		motivo: 'Contraté otro proveedor',
		contactoPrevio: 'sí',
		conformidad: '7',
		volveria: 'no'
	});

	it('false cuando falta el motivo', () => {
		expect(canSubmit({ ...baseValid(), motivo: '' })).toBe(false);
	});

	it('false cuando el motivo es "Otro" sin especificar', () => {
		expect(canSubmit({ ...baseValid(), motivo: MOTIVO_OTRO, motivoOtro: '' })).toBe(false);
	});

	it('true cuando el motivo es "Otro" con texto', () => {
		expect(canSubmit({ ...baseValid(), motivo: MOTIVO_OTRO, motivoOtro: 'razón X' })).toBe(true);
	});

	it('false cuando el motivo es de pago y falta el medio de pago', () => {
		expect(canSubmit({ ...baseValid(), motivo: MOTIVO_PAGO, pagoMedio: '', pagoInconvenientes: 'sí' })).toBe(false);
	});

	it('false cuando el medio de pago es "otro" sin especificar', () => {
		expect(
			canSubmit({
				...baseValid(),
				motivo: MOTIVO_PAGO,
				pagoMedio: 'otro',
				pagoMedioOtro: '',
				pagoInconvenientes: 'sí'
			})
		).toBe(false);
	});

	it('false cuando el motivo es de pago y falta sí/no de inconvenientes', () => {
		expect(
			canSubmit({ ...baseValid(), motivo: MOTIVO_PAGO, pagoMedio: 'efectivo', pagoInconvenientes: '' })
		).toBe(false);
	});

	it('true cuando la rama de pago está completa', () => {
		expect(
			canSubmit({ ...baseValid(), motivo: MOTIVO_PAGO, pagoMedio: 'efectivo', pagoInconvenientes: 'no' })
		).toBe(true);
	});

	it('false cuando falta contactoPrevio', () => {
		expect(canSubmit({ ...baseValid(), contactoPrevio: '' })).toBe(false);
	});

	it('false cuando contactoPrevio es "no" y falta el motivo de no-contacto', () => {
		expect(canSubmit({ ...baseValid(), contactoPrevio: 'no', contactoNoMotivo: '' })).toBe(false);
	});

	it('false cuando el motivo de no-contacto es "otro" sin especificar', () => {
		expect(
			canSubmit({
				...baseValid(),
				contactoPrevio: 'no',
				contactoNoMotivo: 'otro',
				contactoNoOtro: ''
			})
		).toBe(false);
	});

	it('true cuando la rama de no-contacto está completa', () => {
		expect(
			canSubmit({
				...baseValid(),
				contactoPrevio: 'no',
				contactoNoMotivo: 'no tenía tiempo'
			})
		).toBe(true);
	});

	it('false cuando falta conformidad', () => {
		expect(canSubmit({ ...baseValid(), conformidad: '' })).toBe(false);
	});

	it('false cuando falta volveria', () => {
		expect(canSubmit({ ...baseValid(), volveria: '' })).toBe(false);
	});

	it('true con solo los campos obligatorios de la rama simple', () => {
		expect(canSubmit(baseValid())).toBe(true);
	});
});

describe('buildPayload', () => {
	it('arma el payload base sin ramas condicionales activas', () => {
		const data = {
			...createEmptyData(),
			motivo: 'Contraté otro proveedor',
			contactoPrevio: 'sí',
			conformidad: '8',
			queDiferente: '  algo  ',
			volveria: 'no',
			comentarios: ' ',
			idNombre: 'Juan'
		};
		const payload = buildPayload(data);
		expect(payload.motivo).toBe('Contraté otro proveedor');
		expect(payload.motivo_otro).toBe('');
		expect(payload.pago_medio).toBe('');
		expect(payload.pago_medio_otro).toBe('');
		expect(payload.pago_inconvenientes).toBe(null);
		expect(payload.pago_inconvenientes_comentario).toBe('');
		expect(payload.contacto_previo).toBe(true);
		expect(payload.contacto_no_motivo).toBe('');
		expect(payload.contacto_no_otro).toBe('');
		expect(payload.conformidad).toBe(8);
		expect(payload.que_diferente).toBe('algo');
		expect(payload.volveria).toBe('no');
		expect(payload.volveria_condicion).toBe('');
		expect(payload.comentarios).toBe('');
		expect(payload.id_nombre).toBe('Juan');
	});

	it('incluye los campos de la rama de pago solo si el motivo es de pago', () => {
		const dataSinRama = {
			...createEmptyData(),
			motivo: 'Contraté otro proveedor',
			pagoMedio: 'efectivo',
			contactoPrevio: 'sí',
			conformidad: '5',
			volveria: 'no'
		};
		expect(buildPayload(dataSinRama).pago_medio).toBe('');

		const dataConRama = {
			...createEmptyData(),
			motivo: MOTIVO_PAGO,
			pagoMedio: 'otro',
			pagoMedioOtro: 'billetera virtual',
			pagoInconvenientes: 'sí',
			pagoInconvenientesComentario: 'no me llegaba el aviso',
			contactoPrevio: 'sí',
			conformidad: '5',
			volveria: 'no'
		};
		const payload = buildPayload(dataConRama);
		expect(payload.pago_medio).toBe('otro');
		expect(payload.pago_medio_otro).toBe('billetera virtual');
		expect(payload.pago_inconvenientes).toBe(true);
		expect(payload.pago_inconvenientes_comentario).toBe('no me llegaba el aviso');
	});

	it('incluye contacto_no_motivo solo si contactoPrevio es "no"', () => {
		const data = {
			...createEmptyData(),
			motivo: 'Contraté otro proveedor',
			contactoPrevio: 'no',
			contactoNoMotivo: 'no sabía que se podía',
			conformidad: '5',
			volveria: 'no'
		};
		expect(buildPayload(data).contacto_no_motivo).toBe('no sabía que se podía');
	});

	it('incluye volveria_condicion solo si volveria no es "no"', () => {
		const dataNo = {
			...createEmptyData(),
			motivo: 'Contraté otro proveedor',
			contactoPrevio: 'sí',
			conformidad: '5',
			volveria: 'no',
			volveriaCondicion: 'esto no debería viajar'
		};
		expect(buildPayload(dataNo).volveria_condicion).toBe('');

		const dataSi = {
			...createEmptyData(),
			motivo: 'Contraté otro proveedor',
			contactoPrevio: 'sí',
			conformidad: '5',
			volveria: 'sí',
			volveriaCondicion: 'mejor precio'
		};
		expect(buildPayload(dataSi).volveria_condicion).toBe('mejor precio');
	});
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npx vitest run src/routes/encuestadebaja/_components/encuestaBajaLogic.test.js`
Expected: FAIL — no puede resolver el módulo `./encuestaBajaLogic.js` (no existe todavía).

- [ ] **Step 3: Implementar la lógica**

Crear `src/routes/encuestadebaja/_components/encuestaBajaLogic.js`:

```js
// Lógica pura (sin dependencias de Svelte/PocketBase) de la encuesta de baja.
// Se mantiene aparte del componente para poder testearla con Vitest.

export const MOTIVO_PAGO = 'No pude pagar por dificultades económicas';
export const MOTIVO_OTRO = 'Otro';
const MEDIO_OTRO = 'otro';
const CONTACTO_NO_OTRO = 'otro';

export const MOTIVO_OPTIONS = [
	MOTIVO_PAGO,
	'Me pareció que el precio no era acorde al servicio',
	'Tuve problemas técnicos/de conexión sin resolver',
	'Contraté otro proveedor',
	'Ya no necesito el servicio (mudanza, etc.)',
	MOTIVO_OTRO
];

export const PAGO_MEDIO_OPTIONS = ['efectivo', 'transferencia', 'débito automático', MEDIO_OTRO];

export const SI_NO_OPTIONS = ['sí', 'no'];

export const CONTACTO_NO_MOTIVO_OPTIONS = [
	'no sabía que se podía',
	'no tenía tiempo',
	'no creí que hubiera solución',
	CONTACTO_NO_OTRO
];

export const CONFORMIDAD_OPTIONS = Array.from({ length: 10 }, (_, i) => String(i + 1));

export const VOLVERIA_OPTIONS = ['sí', 'tal vez', 'no'];

export function createEmptyData() {
	return {
		motivo: '',
		motivoOtro: '',
		pagoMedio: '',
		pagoMedioOtro: '',
		pagoInconvenientes: '',
		pagoInconvenientesComentario: '',
		contactoPrevio: '',
		contactoNoMotivo: '',
		contactoNoOtro: '',
		conformidad: '',
		queDiferente: '',
		volveria: '',
		volveriaCondicion: '',
		comentarios: '',
		idNombre: '',
		idTelefono: '',
		idCliente: ''
	};
}

export function isMotivoPago(motivo) {
	return motivo === MOTIVO_PAGO;
}

export function isMotivoOtro(motivo) {
	return motivo === MOTIVO_OTRO;
}

export function isPagoMedioOtro(pagoMedio) {
	return pagoMedio === MEDIO_OTRO;
}

export function isContactoNo(contactoPrevio) {
	return contactoPrevio === 'no';
}

export function isContactoNoMotivoOtro(contactoNoMotivo) {
	return contactoNoMotivo === CONTACTO_NO_OTRO;
}

export function isVolveriaCondicionVisible(volveria) {
	return volveria === 'sí' || volveria === 'tal vez';
}

export function canSubmit(data) {
	if (!data.motivo) return false;
	if (isMotivoOtro(data.motivo) && !data.motivoOtro.trim()) return false;

	if (isMotivoPago(data.motivo)) {
		if (!data.pagoMedio) return false;
		if (isPagoMedioOtro(data.pagoMedio) && !data.pagoMedioOtro.trim()) return false;
		if (!data.pagoInconvenientes) return false;
	}

	if (!data.contactoPrevio) return false;
	if (isContactoNo(data.contactoPrevio)) {
		if (!data.contactoNoMotivo) return false;
		if (isContactoNoMotivoOtro(data.contactoNoMotivo) && !data.contactoNoOtro.trim()) return false;
	}

	if (!data.conformidad) return false;
	if (!data.volveria) return false;

	return true;
}

export function buildPayload(data) {
	const payload = {
		motivo: data.motivo,
		motivo_otro: isMotivoOtro(data.motivo) ? data.motivoOtro.trim() : '',
		pago_medio: '',
		pago_medio_otro: '',
		pago_inconvenientes: null,
		pago_inconvenientes_comentario: '',
		contacto_previo: data.contactoPrevio === 'sí',
		contacto_no_motivo: '',
		contacto_no_otro: '',
		conformidad: Number(data.conformidad),
		que_diferente: data.queDiferente.trim(),
		volveria: data.volveria,
		volveria_condicion: '',
		comentarios: data.comentarios.trim(),
		id_nombre: data.idNombre.trim(),
		id_telefono: data.idTelefono.trim(),
		id_cliente: data.idCliente.trim()
	};

	if (isMotivoPago(data.motivo)) {
		payload.pago_medio = data.pagoMedio;
		payload.pago_medio_otro = isPagoMedioOtro(data.pagoMedio) ? data.pagoMedioOtro.trim() : '';
		payload.pago_inconvenientes = data.pagoInconvenientes === 'sí';
		payload.pago_inconvenientes_comentario = data.pagoInconvenientesComentario.trim();
	}

	if (isContactoNo(data.contactoPrevio)) {
		payload.contacto_no_motivo = data.contactoNoMotivo;
		payload.contacto_no_otro = isContactoNoMotivoOtro(data.contactoNoMotivo)
			? data.contactoNoOtro.trim()
			: '';
	}

	if (isVolveriaCondicionVisible(data.volveria)) {
		payload.volveria_condicion = data.volveriaCondicion.trim();
	}

	return payload;
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npx vitest run src/routes/encuestadebaja/_components/encuestaBajaLogic.test.js`
Expected: PASS — todos los tests en verde.

- [ ] **Step 5: Commit**

```bash
git add src/routes/encuestadebaja/_components/encuestaBajaLogic.js src/routes/encuestadebaja/_components/encuestaBajaLogic.test.js
git commit -m "feat: lógica de validación y payload de la encuesta de baja"
```

---

### Task 2: Componente `Options.svelte` (radio-buttons)

**Files:**
- Create: `src/routes/encuestadebaja/_components/Options.svelte`

No lleva test (es un componente de presentación puro, copia exacta del ya usado en `src/routes/encuestadecalidad/_components/Options.svelte`, sin lógica nueva).

- [ ] **Step 1: Copiar el componente**

Crear `src/routes/encuestadebaja/_components/Options.svelte`:

```svelte
<script>
export let data, title, res;
</script>


<h2>{title}</h2>
<div>
{#each data as option}
<!-- svelte-ignore a11y-click-events-have-key-events -->
<label on:click={()=>res=option} class:selected={res==option}>
        <input type="radio"
        value={option}
        bind:group={res}>
        {option}
</label>
{/each}
</div>

<style>
h2{
    font-size: 1em;
    text-transform: none;
    text-align: left;
    font-weight: 500;
}
div{
    display: flex;
    flex-flow: column-reverse;
}
label{
    display: block;
    text-transform:capitalize;
    margin-bottom: .5em;
}
.selected{
    font-weight: 500;
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/encuestadebaja/_components/Options.svelte
git commit -m "feat: copiar componente Options para la encuesta de baja"
```

---

### Task 3: Componente `EncuestaBaja.svelte`

**Files:**
- Create: `src/routes/encuestadebaja/_components/EncuestaBaja.svelte`

- [ ] **Step 1: Escribir el componente**

Crear `src/routes/encuestadebaja/_components/EncuestaBaja.svelte`:

```svelte
<script>
import Options from './Options.svelte';
import { pb } from '$lib/pocketbase';
import {
	MOTIVO_OPTIONS,
	PAGO_MEDIO_OPTIONS,
	SI_NO_OPTIONS,
	CONTACTO_NO_MOTIVO_OPTIONS,
	CONFORMIDAD_OPTIONS,
	VOLVERIA_OPTIONS,
	createEmptyData,
	isMotivoPago,
	isMotivoOtro,
	isPagoMedioOtro,
	isContactoNo,
	isContactoNoMotivoOtro,
	isVolveriaCondicionVisible,
	canSubmit,
	buildPayload
} from './encuestaBajaLogic.js';

let data = createEmptyData();

let canSend;
$: canSend = canSubmit(data);

let enviado;
let cargando;

const submit = async () => {
	cargando = true;
	canSend = false;
	try {
		await pb.collection('encuesta_baja').create(buildPayload(data));
		enviado = true;
	} catch (error) {
		console.error(error.data);
		alert(
			'Tu respuesta no pudo ser enviada. Revisa que todas las casillas obligatorias estén completas. Si el problema persiste, puedes comunicarte con nosotros'
		);
		canSend = true;
		cargando = false;
	}
};
</script>

<svelte:head>
	<meta name="robots" content="noindex" />
</svelte:head>

<main>
{#if enviado}
<section>
	<p><strong>Gracias por compartirnos tu opinión</strong></p>
	<p>Ya puedes cerrar esta página</p>
</section>
{:else}
<section>
	<form>
		<div>
			<Options title="¿Cuál fue el motivo principal de la baja?" data={MOTIVO_OPTIONS} bind:res={data.motivo} />
			{#if isMotivoOtro(data.motivo)}
				<textarea placeholder="Contanos el motivo" bind:value={data.motivoOtro}></textarea>
			{/if}
		</div>

		{#if isMotivoPago(data.motivo)}
			<div>
				<Options title="¿Qué medio de pago usabas habitualmente?" data={PAGO_MEDIO_OPTIONS} bind:res={data.pagoMedio} />
				{#if isPagoMedioOtro(data.pagoMedio)}
					<textarea placeholder="¿Qué medio de pago?" bind:value={data.pagoMedioOtro}></textarea>
				{/if}
			</div>
			<div>
				<Options
					title="¿Tuviste inconvenientes con la forma de pago o el proceso en sí?"
					data={SI_NO_OPTIONS}
					bind:res={data.pagoInconvenientes}
				/>
				<textarea placeholder="Comentario (opcional)" bind:value={data.pagoInconvenientesComentario}></textarea>
			</div>
		{/if}

		<div>
			<Options
				title="Antes de la baja, ¿te comunicaste con nosotros para buscar una solución?"
				data={SI_NO_OPTIONS}
				bind:res={data.contactoPrevio}
			/>
		</div>

		{#if isContactoNo(data.contactoPrevio)}
			<div>
				<Options title="¿Por qué no te comunicaste?" data={CONTACTO_NO_MOTIVO_OPTIONS} bind:res={data.contactoNoMotivo} />
				{#if isContactoNoMotivoOtro(data.contactoNoMotivo)}
					<textarea placeholder="Contanos por qué" bind:value={data.contactoNoOtro}></textarea>
				{/if}
			</div>
		{/if}

		<div>
			<Options
				title="Del 1 al 10, ¿qué tan conforme estabas con el servicio antes de la baja?"
				data={CONFORMIDAD_OPTIONS}
				bind:res={data.conformidad}
			/>
		</div>

		<div>
			<h2>¿Qué podríamos haber hecho diferente para que sigas siendo cliente? <small>(opcional)</small></h2>
			<textarea bind:value={data.queDiferente}></textarea>
		</div>

		<div>
			<Options title="¿Considerarías volver a contratar el servicio en el futuro?" data={VOLVERIA_OPTIONS} bind:res={data.volveria} />
			{#if isVolveriaCondicionVisible(data.volveria)}
				<textarea placeholder="¿Bajo qué condición? (opcional)" bind:value={data.volveriaCondicion}></textarea>
			{/if}
		</div>

		<div>
			<h2>Comentarios adicionales <small>(opcional)</small></h2>
			<textarea bind:value={data.comentarios}></textarea>
		</div>

		<div>
			<h2>Datos de contacto <small>(opcional)</small></h2>
			<input type="text" placeholder="Nombre" bind:value={data.idNombre} />
			<input type="text" placeholder="Teléfono" bind:value={data.idTelefono} />
			<input type="text" placeholder="Número de cliente" bind:value={data.idCliente} />
		</div>

		<button class="btn-1" class:disabled={!canSend} on:click|preventDefault={submit}>
			{cargando ? 'Cargando...' : 'Enviar'}
		</button>
		{#if !canSend && !cargando}
			<p style="font-size: .9rem;">complete todos los datos obligatorios para enviar</p>
		{/if}
	</form>
</section>
{/if}
</main>

<style>
main {
	display: grid;
	place-items: center;
	width: 100vw;
	font-size: 1.1em;
}
section {
	max-width: 30em;
	padding: 4em 1em;
}
form > div {
	margin-bottom: 3em;
}
h2 {
	font-size: 1.1rem;
	text-transform: none;
	text-align: left;
	font-weight: 500;
}
textarea {
	font-family: sans-serif;
	width: 100%;
	height: 5em;
	margin-top: 1em;
}
input[type='text'] {
	display: block;
	width: 100%;
	margin-top: 1em;
	padding: 0.5em;
	font-family: sans-serif;
}
.disabled {
	background: gray;
	pointer-events: none;
}
</style>
```

- [ ] **Step 2: Verificar que compila sin errores de tipo/sintaxis**

Run: `npm run check`
Expected: sin nuevos errores relacionados a `src/routes/encuestadebaja/`.

- [ ] **Step 3: Commit**

```bash
git add src/routes/encuestadebaja/_components/EncuestaBaja.svelte
git commit -m "feat: componente EncuestaBaja con preguntas condicionales"
```

---

### Task 4: Ruta `+page.svelte`

**Files:**
- Create: `src/routes/encuestadebaja/+page.svelte`

- [ ] **Step 1: Escribir la página**

Crear `src/routes/encuestadebaja/+page.svelte`:

```svelte
<script>
import { MetaTags } from 'svelte-meta-tags';
import EncuestaBaja from './_components/EncuestaBaja.svelte';
</script>

<MetaTags
	title="Sista - Encuesta de baja"
	description="Contanos por qué diste de baja el servicio para que podamos mejorar."
></MetaTags>

<EncuestaBaja></EncuestaBaja>
```

- [ ] **Step 2: Verificar que el proyecto compila y los tests pasan**

Run: `npm run check && npm test`
Expected: `check` sin errores nuevos, `test` con todos los tests en verde (incluidos los de `encuestaBajaLogic.test.js`).

- [ ] **Step 3: Verificación manual en navegador**

Nota: en este entorno el servidor de preview integrado falla (`EPERM uv_cwd`, problema de permisos TCC sobre `~/Documents`); no lo uses. Verificar manualmente así:

```bash
npm run dev
```

Abrir `http://localhost:5173/encuestadebaja` en el navegador y comprobar:
- Se ve la primera pregunta (motivo de la baja) con las 6 opciones.
- Elegir "No pude pagar por dificultades económicas" muestra las 2 preguntas de la rama de pago; elegir cualquier otro motivo las oculta.
- Elegir "Otro" en el motivo muestra el textarea de especificación.
- Responder "No" en "¿te comunicaste con nosotros?" muestra la pregunta de por qué no; responder "Sí" la oculta.
- Elegir "Sí" o "Tal vez" en "¿considerarías volver a contratar?" muestra el campo de condición; "No" lo oculta.
- El botón "Enviar" está deshabilitado (gris) hasta completar motivo, conformidad, contacto previo y volvería (y las ramas obligatorias activas).
- Al completar los campos obligatorios y enviar, si existe la colección `encuesta_baja` en PocketBase, se guarda el registro y aparece el mensaje de agradecimiento. Si la colección todavía no fue creada en el admin de PocketBase, se espera el `alert` de error (comportamiento esperado hasta que se cree la colección — ver nota al inicio del plan).

Detener el servidor (`Ctrl+C`) al terminar.

- [ ] **Step 4: Commit**

```bash
git add src/routes/encuestadebaja/+page.svelte
git commit -m "feat: agregar ruta /encuestadebaja"
```

---

## Self-Review Notes

- **Cobertura del spec:** las 7 preguntas y sus condicionales (rama de pago, rama de no-contacto, rama de volvería) están cubiertas en Task 1 (lógica) y Task 3 (UI). Los datos de contacto opcionales están en Task 3. La colección PocketBase y sus campos están documentados al inicio del plan. El estilo sin reCAPTCHA y `noindex` está en Task 3.
- **Limpieza de ramas ocultas:** en vez de mutar `data` cuando una rama se oculta, `buildPayload` (Task 1) ignora los campos de ramas no activas al armar el payload — el resultado es el mismo (no se persisten datos huérfanos) con menos estado mutable que rastrear.
- **Consistencia de nombres:** los campos camelCase de `data` (`pagoMedio`, `contactoPrevio`, etc.) y sus equivalentes snake_case en el payload (`pago_medio`, `contacto_previo`) se usan de forma consistente entre `encuestaBajaLogic.js`, sus tests y `EncuestaBaja.svelte`.
