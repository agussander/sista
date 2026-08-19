# Sección de novedades — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que las novedades se carguen desde el panel de admin y se lean en una sección pública con listado en tarjetas y página propia por novedad, con el carrusel del home leyendo de la misma fuente.

**Architecture:** La lógica pura (slug, parseo del cuerpo, orden, formato de fecha) vive en un módulo sin dependencias que usan tanto el público como el admin. Las dos rutas públicas traen los datos en el servidor por `fetch` pelado a PocketBase — eso es lo que permite meter los `MetaTags` reales de cada novedad en el HTML y que WhatsApp muestre preview. El home sigue prerenderizado y trae las novedades desde el navegador. El admin escribe directo a PocketBase con el SDK.

**Tech Stack:** SvelteKit 2 + Svelte 5 (runes), PocketBase (`https://sista.pockethost.io`), Vitest, `svelte-meta-tags`.

**Spec:** `docs/superpowers/specs/2026-08-19-novedades-design.md`

---

## Contexto que el implementador necesita saber

- **`src/routes/+layout.js` declara `prerender = true` global.** Toda ruta que necesite datos en vivo debe exportar `prerender = false` explícitamente. Ver `src/routes/puntos/[nro]/+page.server.js` como precedente.
- **Vitest corre con `TZ=America/Argentina/Buenos_Aires`** (ver `vite.config.js`). Los tests de fecha se apoyan en eso.
- **Los tests se corren con `npx vitest run <ruta>`.** `npm test` corre todo.
- **El módulo de servidor de PocketBase usa `fetch` pelado con `fetchImpl` inyectable**, no el SDK (ver `src/lib/server/pocketbase.js` y su test). Se sigue ese patrón para poder testear sin red.
- **Los stores del admin son estado a nivel de módulo con runes y un objeto exportado con getters** (ver `carteraStore.svelte.js`).
- El proyecto escribe comentarios en español y sin tildes en los mensajes de commit.

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/lib/novedades.js` (crear) | Lógica pura: slug, parseo del cuerpo, resumen, orden, fechas |
| `src/lib/novedades.test.js` (crear) | Tests de lo anterior |
| `src/lib/server/novedades.js` (crear) | Lectura de PocketBase desde el servidor + armado de URLs de archivo |
| `src/lib/server/novedades.test.js` (crear) | Tests de lo anterior con `fetchImpl` falso |
| `src/lib/components/novedades/NovedadCard.svelte` (crear) | Tarjeta, en vertical y horizontal |
| `src/lib/components/novedades/CuerpoNovedad.svelte` (crear) | Dibuja el cuerpo parseado |
| `src/routes/novedades/+page.server.js` + `+page.svelte` (crear) | Listado |
| `src/routes/novedades/[slug]/+page.server.js` + `+page.svelte` (crear) | Detalle |
| `.../Dashboard/novedades/novedadesAdmin.svelte.js` (crear) | Estado y CRUD del admin |
| `.../Dashboard/novedades/NovedadForm.svelte` (crear) | Formulario de alta y edición |
| `.../Dashboard/novedades/Novedades.svelte` (**existe, vacío**) | Lista del admin, orquesta |
| `src/lib/components/home/Novedades.svelte` (modificar) | Carrusel leyendo PocketBase |
| `src/lib/stores.js` (modificar) | Se le saca `noticias` |
| `.../nav/Navs/MenuLinks.svelte` (modificar) | Link a la sección |

Donde dice `.../Dashboard/` leer `src/routes/admin/_components/mantenimiento/Dashboard/`.

---

## Task 0: Configurar la colección en PocketBase (manual, bloqueante)

**Esta tarea la hace una persona con acceso de superusuario a PocketBase. No hay código.** El resto del plan asume estos nombres de campo exactos.

- [ ] **Step 1: Crear o ajustar los campos de la colección `novedades`**

En el admin de PocketBase (`https://sista.pockethost.io/_/`), colección `novedades`:

| Campo | Tipo | Opciones |
|---|---|---|
| `titulo` | Plain text | Required |
| `slug` | Plain text | Required, **Unique** |
| `fecha` | Date | Required |
| `bajada` | Plain text | — |
| `cuerpo` | Plain text (long) | — |
| `imagen` | File | Single, solo imágenes, **thumbs `600x400` y `1200x0`** |
| `publicada` | Bool | — |
| `destacada` | Bool | — |

Si ya hay campos con otros nombres, renombrarlos a estos.

- [ ] **Step 2: Configurar las reglas de la API**

- **List rule** y **View rule**: `publicada = true || @request.auth.id != ""`
- **Create rule**, **Update rule**, **Delete rule**: `@request.auth.id != ""`

- [ ] **Step 3: Verificar desde afuera que la regla quedó bien**

```bash
curl -s -o /dev/null -w "%{http_code}\n" "https://sista.pockethost.io/api/collections/novedades/records?perPage=1"
```

Esperado: `200`. Si devuelve `403`, la List rule quedó vacía y nada del resto del plan va a funcionar.

---

## Task 1: Lógica pura de novedades

**Files:**
- Create: `src/lib/novedades.js`
- Test: `src/lib/novedades.test.js`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `src/lib/novedades.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
	slugify,
	slugUnico,
	parseCuerpo,
	resumenDe,
	ordenarNovedades,
	formatFecha,
	fechaParaInput
} from './novedades.js';

describe('slugify', () => {
	it('pasa a minusculas y une con guiones', () => {
		expect(slugify('Nueva Tienda Sista')).toBe('nueva-tienda-sista');
	});

	it('saca tildes y signos', () => {
		expect(slugify('¡Promoción: 50% off!')).toBe('promocion-50-off');
	});

	it('no deja guiones en las puntas', () => {
		expect(slugify('  Hola  ')).toBe('hola');
	});

	it('devuelve vacio si no hay nada usable', () => {
		expect(slugify('¿¡!?')).toBe('');
		expect(slugify(null)).toBe('');
	});
});

describe('slugUnico', () => {
	it('devuelve el slug base si esta libre', () => {
		expect(slugUnico('Nueva Tienda', ['otra-cosa'])).toBe('nueva-tienda');
	});

	it('agrega -2 ante colision', () => {
		expect(slugUnico('Nueva Tienda', ['nueva-tienda'])).toBe('nueva-tienda-2');
	});

	it('sigue subiendo el numero si -2 tambien esta tomado', () => {
		expect(slugUnico('Nueva Tienda', ['nueva-tienda', 'nueva-tienda-2'])).toBe('nueva-tienda-3');
	});
});

describe('parseCuerpo', () => {
	it('convierte cada linea en un parrafo y descarta las vacias', () => {
		const out = parseCuerpo('Primero\n\nSegundo');
		expect(out).toHaveLength(2);
		expect(out[0]).toEqual([{ tipo: 'texto', valor: 'Primero' }]);
		expect(out[1]).toEqual([{ tipo: 'texto', valor: 'Segundo' }]);
	});

	it('detecta una URL sola como link', () => {
		expect(parseCuerpo('https://tiendasista.com')).toEqual([
			[{ tipo: 'link', valor: 'https://tiendasista.com' }]
		]);
	});

	it('parte el texto alrededor del link', () => {
		expect(parseCuerpo('Entra a https://a.com ya')).toEqual([
			[
				{ tipo: 'texto', valor: 'Entra a ' },
				{ tipo: 'link', valor: 'https://a.com' },
				{ tipo: 'texto', valor: ' ya' }
			]
		]);
	});

	it('deja afuera del link el punto que cierra la oracion', () => {
		expect(parseCuerpo('Entra a https://a.com.')).toEqual([
			[
				{ tipo: 'texto', valor: 'Entra a ' },
				{ tipo: 'link', valor: 'https://a.com' },
				{ tipo: 'texto', valor: '.' }
			]
		]);
	});

	it('devuelve lista vacia si no hay texto', () => {
		expect(parseCuerpo('')).toEqual([]);
		expect(parseCuerpo(null)).toEqual([]);
	});
});

describe('resumenDe', () => {
	it('usa la bajada si existe', () => {
		expect(resumenDe({ bajada: 'Corta', cuerpo: 'Larguisimo' })).toBe('Corta');
	});

	it('cae al cuerpo si no hay bajada', () => {
		expect(resumenDe({ bajada: '   ', cuerpo: 'Del cuerpo' })).toBe('Del cuerpo');
	});

	it('corta en el ultimo espacio y agrega puntos suspensivos', () => {
		expect(resumenDe({ cuerpo: 'uno dos tres cuatro' }, 12)).toBe('uno dos…');
	});

	it('no corta si entra entero', () => {
		expect(resumenDe({ cuerpo: 'corto' }, 40)).toBe('corto');
	});

	it('tolera una novedad sin campos', () => {
		expect(resumenDe(null)).toBe('');
	});
});

describe('ordenarNovedades', () => {
	it('pone las destacadas primero', () => {
		const out = ordenarNovedades([
			{ id: 'a', fecha: '2026-08-10', destacada: false },
			{ id: 'b', fecha: '2026-01-01', destacada: true }
		]);
		expect(out.map((n) => n.id)).toEqual(['b', 'a']);
	});

	it('dentro del mismo grupo ordena por fecha descendente', () => {
		const out = ordenarNovedades([
			{ id: 'vieja', fecha: '2026-01-01', destacada: false },
			{ id: 'nueva', fecha: '2026-08-10', destacada: false }
		]);
		expect(out.map((n) => n.id)).toEqual(['nueva', 'vieja']);
	});

	it('no muta la lista original', () => {
		const base = [{ id: 'a', fecha: '2026-01-01' }, { id: 'b', fecha: '2026-08-10' }];
		ordenarNovedades(base);
		expect(base.map((n) => n.id)).toEqual(['a', 'b']);
	});
});

describe('formatFecha', () => {
	// Vitest corre en America/Argentina/Buenos_Aires (UTC-3). Sin fijar la zona
	// al formatear, una fecha guardada a las 00:00Z se mostraria un dia antes.
	it('no se corre un dia por la zona horaria', () => {
		expect(formatFecha('2026-08-19 00:00:00.000Z')).toBe('19 de agosto de 2026');
	});

	it('devuelve vacio si la fecha no sirve', () => {
		expect(formatFecha('')).toBe('');
		expect(formatFecha('cualquier cosa')).toBe('');
	});
});

describe('fechaParaInput', () => {
	it('devuelve el formato que espera un input date', () => {
		expect(fechaParaInput('2026-08-19 00:00:00.000Z')).toBe('2026-08-19');
	});

	it('devuelve vacio si no hay fecha', () => {
		expect(fechaParaInput(null)).toBe('');
	});
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npx vitest run src/lib/novedades.test.js`
Expected: FAIL — no existe el archivo `src/lib/novedades.js`.

- [ ] **Step 3: Escribir la implementación**

Crear `src/lib/novedades.js`:

```js
/**
 * Logica pura de las novedades. Sin runes ni imports: la usan el sitio
 * publico, el carrusel del home y el panel de admin, y se testea con Vitest
 * sin levantar nada.
 */

/** Titulo -> slug de URL: sin tildes, minusculas, palabras unidas por guion. */
export function slugify(titulo) {
	return String(titulo ?? '')
		.normalize('NFD')
		// Los diacriticos combinantes que deja NFD, escapados a proposito: el
		// rango escrito con los caracteres literales es invisible al leerlo.
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

/**
 * Slug libre para un titulo nuevo. El campo `slug` tiene indice unico en
 * PocketBase: sin esto, cargar dos novedades con el mismo titulo falla con un
 * error del SDK que no le dice nada a quien esta cargando.
 *
 * @param {string} titulo
 * @param {string[]} slugsExistentes Los slugs ya cargados.
 */
export function slugUnico(titulo, slugsExistentes = []) {
	const base = slugify(titulo);
	if (!base) return '';

	const usados = new Set(slugsExistentes);
	if (!usados.has(base)) return base;

	let n = 2;
	while (usados.has(`${base}-${n}`)) n++;
	return `${base}-${n}`;
}

const URL_RE = /https?:\/\/[^\s]+/g;

/**
 * Separa la puntuacion que cierra la oracion del final de una URL, para que
 * "entra a https://a.com." no linkee el punto.
 */
function separarPuntuacion(url) {
	const cola = url.match(/[.,;:!?)\]]+$/);
	if (!cola) return [url, ''];
	return [url.slice(0, -cola[0].length), cola[0]];
}

/**
 * Parte el cuerpo en parrafos y cada parrafo en tramos de texto y de link.
 *
 * Devuelve DATOS, no HTML, a proposito: el cuerpo lo escribe una persona en el
 * panel y se dibuja con `{#each}`, asi Svelte lo escapa solo y no hay forma de
 * inyectar markup en la pagina. Es la diferencia con el carrusel viejo, que
 * usaba `{@html}`.
 *
 * Cada salto de linea abre un parrafo nuevo y las lineas vacias se descartan:
 * para quien escribe, "enter" es "parrafo nuevo".
 *
 * @param {string} texto
 * @returns {{tipo: 'texto'|'link', valor: string}[][]}
 */
export function parseCuerpo(texto) {
	const lineas = String(texto ?? '')
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter(Boolean);

	return lineas.map((linea) => {
		const tramos = [];
		let ultimo = 0;

		for (const match of linea.matchAll(URL_RE)) {
			const [url, cola] = separarPuntuacion(match[0]);
			if (!url) continue;

			if (match.index > ultimo) {
				tramos.push({ tipo: 'texto', valor: linea.slice(ultimo, match.index) });
			}
			tramos.push({ tipo: 'link', valor: url });
			if (cola) tramos.push({ tipo: 'texto', valor: cola });

			ultimo = match.index + match[0].length;
		}

		if (ultimo < linea.length) {
			tramos.push({ tipo: 'texto', valor: linea.slice(ultimo) });
		}
		return tramos;
	});
}

/**
 * Texto corto para la tarjeta: la bajada si la cargaron, si no un recorte del
 * cuerpo cortado en el ultimo espacio (cortar a la cantidad exacta parte
 * palabras al medio).
 */
export function resumenDe(novedad, max = 140) {
	const bajada = String(novedad?.bajada ?? '').trim();
	if (bajada) return bajada;

	const cuerpo = String(novedad?.cuerpo ?? '').replace(/\s+/g, ' ').trim();
	if (cuerpo.length <= max) return cuerpo;

	const corte = cuerpo.slice(0, max);
	const espacio = corte.lastIndexOf(' ');
	const recorte = espacio > 0 ? corte.slice(0, espacio) : corte;
	return `${recorte.replace(/[.,;:]$/, '')}…`;
}

/** Destacadas primero, despues por fecha descendente. No muta la lista. */
export function ordenarNovedades(lista) {
	return [...(lista ?? [])].sort((a, b) => {
		const da = a.destacada ? 1 : 0;
		const db = b.destacada ? 1 : 0;
		if (da !== db) return db - da;
		return new Date(String(b.fecha ?? '').replace(' ', 'T')) -
			new Date(String(a.fecha ?? '').replace(' ', 'T'));
	});
}

/** PocketBase devuelve "2026-08-19 00:00:00.000Z"; Date quiere la T. */
function aDate(fecha) {
	if (!fecha) return null;
	const d = new Date(String(fecha).replace(' ', 'T'));
	return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Fecha para mostrar. `timeZone: 'UTC'` no es un detalle: PocketBase guarda las
 * fechas a las 00:00Z y el sitio se ve desde Argentina (UTC-3), asi que sin
 * fijarla toda novedad se mostraria con la fecha del dia anterior.
 */
export function formatFecha(fecha) {
	const d = aDate(fecha);
	if (!d) return '';
	return d.toLocaleDateString('es-AR', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		timeZone: 'UTC'
	});
}

/** Fecha en el formato `YYYY-MM-DD` que espera un `<input type="date">`. */
export function fechaParaInput(fecha) {
	const d = aDate(fecha);
	if (!d) return '';
	return d.toISOString().slice(0, 10);
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npx vitest run src/lib/novedades.test.js`
Expected: PASS, 24 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/novedades.js src/lib/novedades.test.js
git commit -m "feat(novedades): agregar logica pura de slugs, cuerpo y fechas"
```

---

## Task 2: Lectura de novedades desde el servidor

**Files:**
- Create: `src/lib/server/novedades.js`
- Test: `src/lib/server/novedades.test.js`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `src/lib/server/novedades.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { listarPublicadas, traerPorSlug, urlArchivo, aNovedadPublica } from './novedades.js';

const BASE = 'https://sista.pockethost.io';

/** fetch falso: registra las llamadas y devuelve la respuesta que le pasen. */
function fakeFetch(response, calls) {
	return async (url, init) => {
		calls?.push({ url, init });
		return response;
	};
}

const respuesta = (items) => ({ ok: true, status: 200, json: async () => ({ items }) });

const registro = (extra = {}) => ({
	id: 'rec1',
	collectionId: 'col1',
	slug: 'nueva-tienda',
	titulo: 'Nueva tienda',
	fecha: '2026-08-19 00:00:00.000Z',
	imagen: 'foto.png',
	...extra
});

describe('listarPublicadas', () => {
	it('filtra por publicada en la propia consulta', async () => {
		const calls = [];
		await listarPublicadas(BASE, { fetchImpl: fakeFetch(respuesta([]), calls) });

		expect(calls[0].url).toContain('/api/collections/novedades/records');
		expect(decodeURIComponent(calls[0].url)).toContain('(publicada=true)');
	});

	it('saca la barra final de la base url', async () => {
		const calls = [];
		await listarPublicadas(`${BASE}/`, { fetchImpl: fakeFetch(respuesta([]), calls) });
		expect(calls[0].url.startsWith(`${BASE}/api/`)).toBe(true);
	});

	it('devuelve las novedades ordenadas', async () => {
		const items = [
			registro({ id: 'vieja', fecha: '2026-01-01', destacada: false }),
			registro({ id: 'destacada', fecha: '2025-01-01', destacada: true })
		];
		const out = await listarPublicadas(BASE, { fetchImpl: fakeFetch(respuesta(items)) });
		expect(out.map((n) => n.id)).toEqual(['destacada', 'vieja']);
	});

	it('devuelve lista vacia si PocketBase responde con error', async () => {
		const error = { ok: false, status: 500, json: async () => ({}) };
		expect(await listarPublicadas(BASE, { fetchImpl: fakeFetch(error) })).toEqual([]);
	});

	it('devuelve lista vacia si se cae la red', async () => {
		const rompe = async () => {
			throw new Error('sin red');
		};
		expect(await listarPublicadas(BASE, { fetchImpl: rompe })).toEqual([]);
	});
});

describe('traerPorSlug', () => {
	it('pide por slug y solo publicadas', async () => {
		const calls = [];
		await traerPorSlug(BASE, 'nueva-tienda', {
			fetchImpl: fakeFetch(respuesta([registro()]), calls)
		});

		const url = decodeURIComponent(calls[0].url);
		expect(url).toContain("slug='nueva-tienda'");
		expect(url).toContain('publicada=true');
	});

	it('devuelve el registro encontrado', async () => {
		const out = await traerPorSlug(BASE, 'nueva-tienda', {
			fetchImpl: fakeFetch(respuesta([registro()]))
		});
		expect(out.id).toBe('rec1');
	});

	it('devuelve null si no hay resultados', async () => {
		const out = await traerPorSlug(BASE, 'no-existe', { fetchImpl: fakeFetch(respuesta([])) });
		expect(out).toBe(null);
	});

	// El slug sale de la URL y se interpola en el filtro de PocketBase: si no se
	// valida, cualquiera puede escribir filtros arbitrarios desde la barra de
	// direcciones.
	it('rechaza un slug con caracteres raros sin consultar', async () => {
		const calls = [];
		const out = await traerPorSlug(BASE, "x' || publicada=false || '", {
			fetchImpl: fakeFetch(respuesta([registro()]), calls)
		});
		expect(out).toBe(null);
		expect(calls).toHaveLength(0);
	});

	it('devuelve null sin slug', async () => {
		expect(await traerPorSlug(BASE, '', { fetchImpl: fakeFetch(respuesta([])) })).toBe(null);
	});
});

describe('urlArchivo', () => {
	it('arma la url del archivo', () => {
		expect(urlArchivo(BASE, registro(), 'foto.png')).toBe(
			`${BASE}/api/files/col1/rec1/foto.png`
		);
	});

	it('agrega el thumb cuando se lo pide', () => {
		expect(urlArchivo(BASE, registro(), 'foto.png', '600x400')).toBe(
			`${BASE}/api/files/col1/rec1/foto.png?thumb=600x400`
		);
	});

	it('devuelve null si no hay archivo', () => {
		expect(urlArchivo(BASE, registro(), '')).toBe(null);
		expect(urlArchivo(BASE, null, 'foto.png')).toBe(null);
	});
});

describe('aNovedadPublica', () => {
	it('deja las urls de imagen ya armadas', () => {
		const out = aNovedadPublica(BASE, registro());
		expect(out.imagen).toBe(`${BASE}/api/files/col1/rec1/foto.png?thumb=600x400`);
		expect(out.imagenGrande).toBe(`${BASE}/api/files/col1/rec1/foto.png?thumb=1200x0`);
	});

	it('deja las imagenes en null si la novedad no tiene', () => {
		const out = aNovedadPublica(BASE, registro({ imagen: '' }));
		expect(out.imagen).toBe(null);
		expect(out.imagenGrande).toBe(null);
	});

	it('normaliza los campos que pueden faltar', () => {
		const out = aNovedadPublica(BASE, registro({ bajada: undefined, cuerpo: undefined }));
		expect(out.bajada).toBe('');
		expect(out.cuerpo).toBe('');
		expect(out.destacada).toBe(false);
	});
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npx vitest run src/lib/server/novedades.test.js`
Expected: FAIL — no existe `src/lib/server/novedades.js`.

- [ ] **Step 3: Escribir la implementación**

Crear `src/lib/server/novedades.js`:

```js
/**
 * Lectura de novedades desde el servidor, para el `load` de las rutas publicas.
 *
 * Va por `fetch` pelado y no por el SDK, igual que `pocketbase.js`: para dos
 * GET alcanza, y con `fetchImpl` inyectable el modulo se testea sin red ni
 * mocks del SDK.
 *
 * Todas las consultas van anonimas. La proteccion de los borradores es la List
 * rule de la coleccion (`publicada = true || @request.auth.id != ""`); el
 * filtro por `publicada` que se manda aca es deliberadamente redundante, para
 * que aflojar la regla en PocketBase no publique borradores de golpe.
 */
import { ordenarNovedades } from '../novedades.js';

const COLECCION = 'novedades';

/** Los slugs que genera `slugify`: minusculas, numeros y guiones. */
const SLUG_VALIDO = /^[a-z0-9-]{1,120}$/;

const sinBarra = (baseUrl) => String(baseUrl ?? '').replace(/\/+$/, '');

/**
 * Las novedades publicadas, ya ordenadas para mostrar.
 * Ante cualquier falla devuelve `[]`: la seccion se muestra vacia, no rota.
 *
 * @returns {Promise<object[]>}
 */
export async function listarPublicadas(baseUrl, { fetchImpl = fetch } = {}) {
	const filtro = encodeURIComponent('(publicada=true)');
	const url = `${sinBarra(baseUrl)}/api/collections/${COLECCION}/records?perPage=200&filter=${filtro}`;

	try {
		const res = await fetchImpl(url, { signal: AbortSignal.timeout(10_000) });
		if (!res.ok) {
			console.error(`[novedades] PocketBase respondio ${res.status} al listar`);
			return [];
		}
		const body = await res.json();
		return ordenarNovedades(body.items ?? []);
	} catch (error) {
		console.error('[novedades] error de red al listar:', error);
		return [];
	}
}

/**
 * Una novedad publicada por su slug, o `null` si no existe, esta en borrador o
 * falla la consulta.
 *
 * El slug se valida contra `SLUG_VALIDO` antes de interpolarlo en el filtro:
 * viene de la URL, y sin validar cualquiera podria escribir filtros arbitrarios
 * de PocketBase desde la barra de direcciones (por ejemplo, pedir los
 * borradores).
 *
 * @returns {Promise<object|null>}
 */
export async function traerPorSlug(baseUrl, slug, { fetchImpl = fetch } = {}) {
	if (!SLUG_VALIDO.test(String(slug ?? ''))) return null;

	const filtro = encodeURIComponent(`(publicada=true && slug='${slug}')`);
	const url = `${sinBarra(baseUrl)}/api/collections/${COLECCION}/records?perPage=1&filter=${filtro}`;

	try {
		const res = await fetchImpl(url, { signal: AbortSignal.timeout(10_000) });
		if (!res.ok) {
			console.error(`[novedades] PocketBase respondio ${res.status} para "${slug}"`);
			return null;
		}
		const body = await res.json();
		return body.items?.[0] ?? null;
	} catch (error) {
		console.error('[novedades] error de red al traer por slug:', error);
		return null;
	}
}

/**
 * URL de un archivo de PocketBase. Aca no hay SDK, que es quien normalmente
 * arma esta URL (`pb.files.getURL`), asi que se arma a mano.
 *
 * @param {string} baseUrl
 * @param {object} record Registro con `collectionId` e `id`
 * @param {string} nombreArchivo
 * @param {string} [thumb] Por ejemplo '600x400'
 * @returns {string|null}
 */
export function urlArchivo(baseUrl, record, nombreArchivo, thumb) {
	if (!record || !nombreArchivo) return null;

	const url = `${sinBarra(baseUrl)}/api/files/${record.collectionId}/${record.id}/${encodeURIComponent(nombreArchivo)}`;
	return thumb ? `${url}?thumb=${encodeURIComponent(thumb)}` : url;
}

/**
 * Pasa un registro crudo de PocketBase a la forma que consumen las paginas,
 * con las URLs de imagen ya resueltas. Asi los componentes no necesitan saber
 * ni la baseUrl ni como se arman los archivos.
 */
export function aNovedadPublica(baseUrl, record) {
	return {
		id: record.id,
		slug: record.slug,
		titulo: record.titulo ?? '',
		fecha: record.fecha ?? '',
		bajada: record.bajada ?? '',
		cuerpo: record.cuerpo ?? '',
		destacada: !!record.destacada,
		imagen: urlArchivo(baseUrl, record, record.imagen, '600x400'),
		imagenGrande: urlArchivo(baseUrl, record, record.imagen, '1200x0')
	};
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npx vitest run src/lib/server/novedades.test.js`
Expected: PASS, 16 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/novedades.js src/lib/server/novedades.test.js
git commit -m "feat(novedades): agregar lectura de novedades desde el servidor"
```

---

## Task 3: Componentes compartidos de presentación

**Files:**
- Create: `src/lib/components/novedades/CuerpoNovedad.svelte`
- Create: `src/lib/components/novedades/NovedadCard.svelte`

No hay tests automáticos acá: son componentes de presentación sin lógica propia
(la lógica está en `novedades.js`, ya testeada). Se verifican en el navegador en
la Task 11.

- [ ] **Step 1: Crear `CuerpoNovedad.svelte`**

```svelte
<script>
// Dibuja el cuerpo de una novedad. `parseCuerpo` devuelve datos, no HTML, asi
// que Svelte escapa el texto solo: nada de lo que se cargue en el panel puede
// inyectar markup en la pagina.
import { parseCuerpo } from '$lib/novedades.js';

let { texto = '' } = $props();

const parrafos = $derived(parseCuerpo(texto));
</script>

{#each parrafos as tramos}
    <p>
        {#each tramos as tramo}
            {#if tramo.tipo === 'link'}
                <a href={tramo.valor} target="_blank" rel="noopener noreferrer">{tramo.valor}</a>
            {:else}{tramo.valor}{/if}
        {/each}
    </p>
{/each}

<style>
p {
    margin: 0 0 1em;
    line-height: 1.7;
}

a {
    color: var(--violeta2);
    overflow-wrap: anywhere;
}
</style>
```

- [ ] **Step 2: Crear `NovedadCard.svelte`**

```svelte
<script>
// Tarjeta de novedad. La comparten el listado (`vertical`) y el carrusel del
// home (`horizontal` en pantallas anchas), para que las dos superficies no se
// despeguen visualmente cuando se toque una.
import { formatFecha, resumenDe } from '$lib/novedades.js';

let { novedad, orientacion = 'vertical' } = $props();

const resumen = $derived(resumenDe(novedad));
</script>

<a class="card {orientacion}" href="/novedades/{novedad.slug}/">
    {#if novedad.imagen}
        <!-- Sin imagen no se renderiza el bloque: un hueco gris se ve peor
             que una tarjeta solo de texto. -->
        <div class="img" style="background-image: url({novedad.imagen});"></div>
    {/if}
    <div class="texto">
        <time datetime={novedad.fecha}>{formatFecha(novedad.fecha)}</time>
        <h3>{novedad.titulo}</h3>
        {#if resumen}<p>{resumen}</p>{/if}
    </div>
</a>

<style>
.card {
    display: flex;
    flex-flow: column;
    background: white;
    border-radius: 0.6em;
    overflow: hidden;
    box-shadow: 0 0 0.5em rgba(133, 133, 133, 0.4);
    text-decoration: none;
    color: inherit;
    height: 100%;
    transition: transform ease 300ms, box-shadow ease 300ms;
}

.card:hover {
    transform: translateY(-0.25em);
    box-shadow: 0 0.3em 1em rgba(133, 133, 133, 0.55);
}

.img {
    background-position: center;
    background-size: cover;
    background-repeat: no-repeat;
    height: 11em;
    width: 100%;
    flex-shrink: 0;
}

.texto {
    padding: 1.2em 1.1em;
    display: flex;
    flex-flow: column;
    gap: 0.4em;
}

time {
    font-size: 0.8em;
    color: #6b7280;
}

h3 {
    margin: 0;
    font-size: 1.15em;
    font-weight: 600;
    color: var(--magenta);
    line-height: 1.3;
}

p {
    margin: 0;
    font-size: 0.9em;
    line-height: 1.5;
    color: #444;
}

@media (min-width: 700px) {
    .card.horizontal {
        flex-flow: row nowrap;
    }

    .card.horizontal .img {
        width: 55%;
        height: auto;
        min-height: 9em;
    }

    .card.horizontal .texto {
        justify-content: center;
    }
}
</style>
```

- [ ] **Step 3: Verificar que el proyecto sigue compilando**

Run: `npx svelte-check --tsconfig ./jsconfig.json --threshold error`
Expected: sin errores nuevos en los dos archivos creados. (El proyecto puede
tener warnings previos; solo importa que no haya errores en `novedades/`.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/novedades/
git commit -m "feat(novedades): agregar tarjeta y cuerpo compartidos"
```

---

## Task 4: Ruta pública del listado

**Files:**
- Create: `src/routes/novedades/+page.server.js`
- Create: `src/routes/novedades/+page.svelte`

- [ ] **Step 1: Crear el `load` del servidor**

Crear `src/routes/novedades/+page.server.js`:

```js
/**
 * Listado publico de novedades.
 *
 * Los datos se traen en el servidor y no en el navegador para que el HTML ya
 * salga con las novedades adentro (buscadores y previews). Eso hace la ruta no
 * prerenderizable, de ahi el `prerender = false` que pisa el `true` global de
 * `src/routes/+layout.js`.
 *
 * Consecuencia: esta ruta NO se emite en el build estatico (`build-static/`,
 * el sitio legacy sista.com.ar). Con `strict: false` en `svelte.config.js` eso
 * pasa en silencio, sin romper el build.
 */
import { env } from '$env/dynamic/private';
import { listarPublicadas, aNovedadPublica } from '$lib/server/novedades.js';

export const prerender = false;

/** @type {import('./$types').PageServerLoad} */
export async function load() {
	const baseUrl = env.VITE_POCKETBASE_URL || 'https://sista.pockethost.io';
	const registros = await listarPublicadas(baseUrl);

	return { novedades: registros.map((r) => aNovedadPublica(baseUrl, r)) };
}
```

- [ ] **Step 2: Crear la página**

Crear `src/routes/novedades/+page.svelte`:

```svelte
<script>
import { MetaTags } from 'svelte-meta-tags';
import NovedadCard from '$lib/components/novedades/NovedadCard.svelte';

let { data } = $props();
</script>

<MetaTags
    title="Novedades | Sista"
    description="Novedades, promociones y anuncios de Sista."
    robots="index, follow"
></MetaTags>

<div class="cont">
    <h1>Novedades</h1>

    {#if data.novedades.length === 0}
        <p class="vacio">Todavía no hay novedades publicadas.</p>
    {:else}
        <div class="grilla">
            {#each data.novedades as novedad (novedad.id)}
                <NovedadCard {novedad}></NovedadCard>
            {/each}
        </div>
    {/if}
</div>

<style>
.cont {
    max-width: 68em;
    width: 90%;
    margin: 3em auto 6em;
}

h1 {
    color: var(--violeta1);
    margin-bottom: 1.2em;
}

.grilla {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5em;
}

.vacio {
    color: #6b7280;
}

@media (min-width: 40em) {
    .grilla {
        grid-template-columns: repeat(2, 1fr);
    }
}

@media (min-width: 62em) {
    .grilla {
        grid-template-columns: repeat(3, 1fr);
    }
}
</style>
```

- [ ] **Step 3: Verificar en el navegador**

Levantar el dev server y abrir `/novedades/`. Con la colección vacía tiene que
verse el título y "Todavía no hay novedades publicadas", sin errores en la
consola.

- [ ] **Step 4: Commit**

```bash
git add src/routes/novedades/
git commit -m "feat(novedades): agregar listado publico"
```

---

## Task 5: Ruta pública del detalle

**Files:**
- Create: `src/routes/novedades/[slug]/+page.server.js`
- Create: `src/routes/novedades/[slug]/+page.svelte`

- [ ] **Step 1: Crear el `load` del servidor**

Crear `src/routes/novedades/[slug]/+page.server.js`:

```js
/**
 * Una novedad completa.
 *
 * Se renderiza en el servidor para que los MetaTags de ESTA novedad (titulo,
 * bajada, imagen) esten en el HTML: es lo unico que hace que al pegar el link
 * en WhatsApp o Facebook aparezca la foto de la novedad y no el preview
 * generico del sitio.
 *
 * `prerender = false` pisa el `true` global de `src/routes/+layout.js`.
 */
import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { traerPorSlug, aNovedadPublica } from '$lib/server/novedades.js';

export const prerender = false;

/** @type {import('./$types').PageServerLoad} */
export async function load({ params }) {
	const baseUrl = env.VITE_POCKETBASE_URL || 'https://sista.pockethost.io';
	const registro = await traerPorSlug(baseUrl, params.slug);

	// Un borrador cae aca igual que un slug inexistente: `traerPorSlug` filtra
	// por `publicada`, asi que desde afuera no hay forma de distinguir "todavia
	// no la publicamos" de "no existe".
	if (!registro) error(404, 'No encontramos esta novedad');

	return { novedad: aNovedadPublica(baseUrl, registro) };
}
```

- [ ] **Step 2: Crear la página**

Crear `src/routes/novedades/[slug]/+page.svelte`:

```svelte
<script>
import { MetaTags } from 'svelte-meta-tags';
import CuerpoNovedad from '$lib/components/novedades/CuerpoNovedad.svelte';
import ContactButtons from '$lib/components/ui/ContactButtons.svelte';
import { formatFecha, resumenDe } from '$lib/novedades.js';

let { data } = $props();

const novedad = $derived(data.novedad);
const descripcion = $derived(resumenDe(novedad, 200));
</script>

<MetaTags
    title="{novedad.titulo} | Sista"
    description={descripcion}
    robots="index, follow"
    openGraph={{
        type: 'article',
        title: novedad.titulo,
        description: descripcion,
        siteName: 'Sista',
        images: novedad.imagenGrande ? [{ url: novedad.imagenGrande, alt: novedad.titulo }] : []
    }}
></MetaTags>

<article class="cont">
    <a class="volver" href="/novedades/">← Volver a novedades</a>

    <time datetime={novedad.fecha}>{formatFecha(novedad.fecha)}</time>
    <h1>{novedad.titulo}</h1>
    {#if novedad.bajada}<p class="bajada">{novedad.bajada}</p>{/if}

    {#if novedad.imagenGrande}
        <img src={novedad.imagenGrande} alt={novedad.titulo} fetchpriority="high" decoding="async">
    {/if}

    <div class="cuerpo">
        <CuerpoNovedad texto={novedad.cuerpo}></CuerpoNovedad>
    </div>

    <ContactButtons></ContactButtons>
</article>

<style>
.cont {
    max-width: 44em;
    width: 90%;
    margin: 3em auto 6em;
}

.volver {
    display: inline-block;
    margin-bottom: 2em;
    color: var(--violeta2);
    text-decoration: none;
    font-size: 0.9em;
}

.volver:hover {
    text-decoration: underline;
}

time {
    display: block;
    font-size: 0.85em;
    color: #6b7280;
    margin-bottom: 0.4em;
}

h1 {
    color: var(--violeta1);
    margin: 0 0 0.4em;
    line-height: 1.2;
}

.bajada {
    font-size: 1.15em;
    color: #444;
    line-height: 1.6;
    margin: 0 0 1.5em;
}

img {
    width: 100%;
    height: auto;
    border-radius: 0.6em;
    margin-bottom: 2em;
}

.cuerpo {
    margin-bottom: 3em;
}
</style>
```

- [ ] **Step 3: Verificar que una novedad inexistente da 404**

Con el dev server levantado, abrir `/novedades/no-existe/`.
Expected: la página de error del sitio (`src/routes/+error.svelte`) con 404, no
una pantalla en blanco ni un error de servidor.

- [ ] **Step 4: Commit**

```bash
git add src/routes/novedades/
git commit -m "feat(novedades): agregar pagina de novedad completa"
```

---

## Task 6: Store del admin

**Files:**
- Create: `src/routes/admin/_components/mantenimiento/Dashboard/novedades/novedadesAdmin.svelte.js`

- [ ] **Step 1: Crear el store**

```js
/**
 * Estado y escrituras de la seccion Novedades del panel.
 *
 * Separado de la vista, como `carteraStore.svelte.js` y
 * `llamenmeStore.svelte.js`: el componente dibuja, este modulo habla con
 * PocketBase.
 *
 * Lista TODAS las novedades, incluidos los borradores: la List rule de la
 * coleccion (`publicada = true || @request.auth.id != ""`) le muestra todo a
 * un usuario logueado.
 */
import { pb } from '$lib/pocketbase';
import { ordenarNovedades, slugUnico } from '$lib/novedades.js';

const COLECCION = 'novedades';

let novedades = $state([]);
let cargando = $state(true);
let error = $state('');
let guardando = $state(false);

function mensajeDeError(err) {
	if (err?.status === 401 || err?.status === 403) {
		return 'Tu sesión expiró o no tenés permiso. Volvé a iniciar sesión.';
	}
	return err?.message || 'No pudimos completar la operación.';
}

async function cargar() {
	cargando = true;
	error = '';
	try {
		const items = await pb.collection(COLECCION).getFullList();
		novedades = ordenarNovedades(items);
	} catch (err) {
		console.error('[novedades] error al cargar:', err);
		error = mensajeDeError(err);
	} finally {
		cargando = false;
	}
}

/**
 * Arma el FormData del registro. Va como FormData y no como objeto porque la
 * imagen es un archivo.
 *
 * Si no eligieron imagen nueva, el campo no se manda: mandarlo vacio en una
 * edicion le borraria la foto a la novedad.
 */
function aFormData(datos, slug) {
	const fd = new FormData();
	fd.append('titulo', datos.titulo.trim());
	fd.append('fecha', datos.fecha);
	fd.append('bajada', datos.bajada.trim());
	fd.append('cuerpo', datos.cuerpo);
	fd.append('publicada', datos.publicada ? 'true' : 'false');
	fd.append('destacada', datos.destacada ? 'true' : 'false');
	if (slug) fd.append('slug', slug);
	if (datos.imagen instanceof File) fd.append('imagen', datos.imagen);
	return fd;
}

/**
 * Crea una novedad. El slug se calcula contra los slugs ya cargados: el campo
 * tiene indice unico en PocketBase y dos titulos iguales chocarian.
 * @returns {Promise<boolean>} si se guardo
 */
async function crear(datos) {
	guardando = true;
	error = '';
	try {
		const slug = slugUnico(datos.titulo, novedades.map((n) => n.slug));
		const record = await pb.collection(COLECCION).create(aFormData(datos, slug));
		novedades = ordenarNovedades([record, ...novedades]);
		return true;
	} catch (err) {
		console.error('[novedades] error al crear:', err);
		error = mensajeDeError(err);
		return false;
	} finally {
		guardando = false;
	}
}

/**
 * Edita una novedad. El slug NO se toca aunque cambie el titulo: cambiarlo
 * rompe los links de esa novedad que ya se compartieron.
 * @returns {Promise<boolean>} si se guardo
 */
async function actualizar(id, datos) {
	guardando = true;
	error = '';
	try {
		const record = await pb.collection(COLECCION).update(id, aFormData(datos, null));
		novedades = ordenarNovedades(novedades.map((n) => (n.id === id ? record : n)));
		return true;
	} catch (err) {
		console.error('[novedades] error al actualizar:', err);
		error = mensajeDeError(err);
		return false;
	} finally {
		guardando = false;
	}
}

/** @returns {Promise<boolean>} si se borro */
async function eliminar(id) {
	error = '';
	try {
		await pb.collection(COLECCION).delete(id);
		novedades = novedades.filter((n) => n.id !== id);
		return true;
	} catch (err) {
		console.error('[novedades] error al eliminar:', err);
		error = mensajeDeError(err);
		return false;
	}
}

/** URL de la imagen de un registro, para la miniatura de la lista. */
function urlImagen(record, thumb = '300x200') {
	if (!record?.imagen) return null;
	return pb.files.getURL(record, record.imagen, { thumb });
}

export const novedadesAdmin = {
	get novedades() {
		return novedades;
	},
	get cargando() {
		return cargando;
	},
	get error() {
		return error;
	},
	get guardando() {
		return guardando;
	},
	cargar,
	crear,
	actualizar,
	eliminar,
	urlImagen
};
```

- [ ] **Step 2: Verificar que compila**

Run: `npx svelte-check --tsconfig ./jsconfig.json --threshold error`
Expected: sin errores en el archivo nuevo.

- [ ] **Step 3: Commit**

```bash
git add src/routes/admin/_components/mantenimiento/Dashboard/novedades/novedadesAdmin.svelte.js
git commit -m "feat(admin): agregar store de novedades"
```

---

## Task 7: Formulario del admin

**Files:**
- Create: `src/routes/admin/_components/mantenimiento/Dashboard/novedades/NovedadForm.svelte`

- [ ] **Step 1: Crear el formulario**

```svelte
<script>
// Alta y edicion de una novedad. No habla con PocketBase: junta los datos, los
// valida y se los pasa al que lo invoca (`Novedades.svelte`), que es quien
// llama al store.
import { fechaParaInput } from '$lib/novedades.js';
import { novedadesAdmin } from './novedadesAdmin.svelte.js';

let { novedad = null, onGuardar, onCancelar } = $props();

const esEdicion = !!novedad;

let titulo = $state(novedad?.titulo ?? '');
let fecha = $state(fechaParaInput(novedad?.fecha) || new Date().toISOString().slice(0, 10));
let bajada = $state(novedad?.bajada ?? '');
let cuerpo = $state(novedad?.cuerpo ?? '');
let publicada = $state(novedad?.publicada ?? false);
let destacada = $state(novedad?.destacada ?? false);
let imagen = $state(null);
let errorLocal = $state('');

// Vista previa: la imagen recien elegida si hay una, si no la que ya tenia.
let previewNueva = $state(null);
const previewActual = esEdicion ? novedadesAdmin.urlImagen(novedad, '600x400') : null;
const preview = $derived(previewNueva ?? previewActual);

function elegirImagen(event) {
    const file = event.currentTarget.files?.[0] ?? null;
    imagen = file;
    previewNueva = file ? URL.createObjectURL(file) : null;
}

function enviar(event) {
    event.preventDefault();
    if (!titulo.trim()) {
        errorLocal = 'La novedad necesita un título.';
        return;
    }
    if (!fecha) {
        errorLocal = 'La novedad necesita una fecha.';
        return;
    }
    errorLocal = '';
    onGuardar({ titulo, fecha, bajada, cuerpo, publicada, destacada, imagen });
}
</script>

<form onsubmit={enviar}>
    <h2>{esEdicion ? 'Editar novedad' : 'Nueva novedad'}</h2>

    <label>
        Título
        <input type="text" bind:value={titulo} maxlength="120" placeholder="Nueva tienda Sista">
    </label>

    <label>
        Fecha
        <input type="date" bind:value={fecha}>
    </label>

    <label>
        Bajada <span class="ayuda">Una o dos líneas, es lo que se lee en la tarjeta</span>
        <input type="text" bind:value={bajada} maxlength="200">
    </label>

    <label>
        Cuerpo <span class="ayuda">Cada enter es un párrafo nuevo. Si pegás una dirección web queda como link.</span>
        <textarea bind:value={cuerpo} rows="10"></textarea>
    </label>

    <label>
        Imagen
        <input type="file" accept="image/*" onchange={elegirImagen}>
    </label>

    {#if preview}
        <img class="preview" src={preview} alt="Vista previa">
    {/if}

    <div class="checks">
        <label class="check">
            <input type="checkbox" bind:checked={publicada}>
            Publicada <span class="ayuda">Si está destildada, no la ve nadie desde afuera</span>
        </label>
        <label class="check">
            <input type="checkbox" bind:checked={destacada}>
            Destacada <span class="ayuda">Aparece primera en el listado</span>
        </label>
    </div>

    {#if errorLocal}<p class="error">{errorLocal}</p>{/if}
    {#if novedadesAdmin.error}<p class="error">{novedadesAdmin.error}</p>{/if}

    <div class="acciones">
        <button type="button" class="btn-cancelar" onclick={onCancelar} disabled={novedadesAdmin.guardando}>
            Cancelar
        </button>
        <button type="submit" class="btn-guardar" disabled={novedadesAdmin.guardando}>
            {novedadesAdmin.guardando ? 'Guardando…' : 'Guardar'}
        </button>
    </div>
</form>

<style>
form {
    display: flex;
    flex-flow: column;
    gap: 1.2em;
    max-width: 45em;
}

h2 {
    color: var(--violeta1);
    margin: 0;
}

label {
    display: flex;
    flex-flow: column;
    gap: 0.4em;
    font-weight: 600;
    color: #495057;
    font-size: 0.9em;
}

.ayuda {
    font-weight: 400;
    color: #6b7280;
    font-size: 0.85em;
}

input[type='text'],
input[type='date'],
textarea {
    padding: 0.7em 0.9em;
    border: 1px solid #ced4da;
    border-radius: 0.4em;
    font-size: 1em;
    font-family: inherit;
    font-weight: 400;
}

input[type='text']:focus,
input[type='date']:focus,
textarea:focus {
    outline: none;
    border-color: var(--violeta2);
}

textarea {
    resize: vertical;
    line-height: 1.6;
}

.preview {
    max-width: 22em;
    width: 100%;
    border-radius: 0.5em;
}

.checks {
    display: flex;
    flex-flow: column;
    gap: 0.8em;
}

.check {
    flex-flow: row;
    align-items: center;
    gap: 0.5em;
}

.error {
    color: #b91c1c;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 0.4em;
    padding: 0.7em 1em;
    margin: 0;
}

.acciones {
    display: flex;
    gap: 0.8em;
}

.acciones button {
    padding: 0.7em 1.5em;
    border: none;
    border-radius: 0.4em;
    font-size: 0.95em;
    font-weight: 600;
    cursor: pointer;
}

.btn-guardar {
    background: var(--violeta1);
    color: white;
}

.btn-guardar:hover:not(:disabled) {
    background: var(--violeta2);
}

.btn-cancelar {
    background: #e5e7eb;
    color: #374151;
}

.acciones button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}
</style>
```

- [ ] **Step 2: Verificar que compila**

Run: `npx svelte-check --tsconfig ./jsconfig.json --threshold error`
Expected: sin errores en el archivo nuevo.

- [ ] **Step 3: Commit**

```bash
git add src/routes/admin/_components/mantenimiento/Dashboard/novedades/NovedadForm.svelte
git commit -m "feat(admin): agregar formulario de novedades"
```

---

## Task 8: Lista del admin

**Files:**
- Modify: `src/routes/admin/_components/mantenimiento/Dashboard/novedades/Novedades.svelte` (existe, está vacío)

- [ ] **Step 1: Escribir el componente**

```svelte
<script>
// Seccion Novedades del panel. Ya estaba declarada en `panelSecciones.js` y en
// `adminPermisos.js`, y `Content.svelte` ya la renderiza: este archivo existia
// vacio.
import { onMount } from 'svelte';
import Spinner from '$lib/components/ui/Spinner.svelte';
import { formatFecha } from '$lib/novedades.js';
import { novedadesAdmin } from './novedadesAdmin.svelte.js';
import NovedadForm from './NovedadForm.svelte';

// null = viendo la lista | 'nueva' = alta | un record = edicion
let editando = $state(null);
let confirmandoBorrado = $state(null);

onMount(() => {
    novedadesAdmin.cargar();
});

async function guardar(datos) {
    const ok = editando === 'nueva'
        ? await novedadesAdmin.crear(datos)
        : await novedadesAdmin.actualizar(editando.id, datos);

    // Si fallo, el formulario sigue abierto con lo que la persona escribio:
    // cerrarlo le perderia el texto.
    if (ok) editando = null;
}

async function eliminar(novedad) {
    const ok = await novedadesAdmin.eliminar(novedad.id);
    if (ok) confirmandoBorrado = null;
}
</script>

<div class="cont">
    {#if editando}
        <NovedadForm
            novedad={editando === 'nueva' ? null : editando}
            onGuardar={guardar}
            onCancelar={() => (editando = null)}
        ></NovedadForm>
    {:else}
        <div class="header">
            <div>
                <h1>Novedades</h1>
                <p>Las novedades que se ven en el sitio y en el inicio</p>
            </div>
            <button class="btn-nueva" onclick={() => (editando = 'nueva')}>Nueva novedad</button>
        </div>

        {#if novedadesAdmin.error}
            <p class="error">{novedadesAdmin.error}</p>
        {/if}

        {#if novedadesAdmin.cargando}
            <div class="centro"><Spinner label="Cargando novedades..."></Spinner></div>
        {:else if novedadesAdmin.novedades.length === 0}
            <p class="vacio">Todavía no cargaste ninguna novedad.</p>
        {:else}
            <ul class="lista">
                {#each novedadesAdmin.novedades as novedad (novedad.id)}
                    <li class="fila">
                        {#if novedadesAdmin.urlImagen(novedad)}
                            <img src={novedadesAdmin.urlImagen(novedad)} alt="">
                        {:else}
                            <div class="sin-img">Sin foto</div>
                        {/if}

                        <div class="datos">
                            <strong>{novedad.titulo}</strong>
                            <span class="fecha">{formatFecha(novedad.fecha)}</span>
                            <div class="chips">
                                {#if novedad.publicada}
                                    <span class="chip publicada">Publicada</span>
                                {:else}
                                    <span class="chip borrador">Borrador</span>
                                {/if}
                                {#if novedad.destacada}<span class="chip destacada">Destacada</span>{/if}
                            </div>
                        </div>

                        <div class="acciones">
                            {#if confirmandoBorrado === novedad.id}
                                <span class="confirmar">¿Seguro?</span>
                                <button class="btn-borrar" onclick={() => eliminar(novedad)}>Sí, borrar</button>
                                <button class="btn-sec" onclick={() => (confirmandoBorrado = null)}>No</button>
                            {:else}
                                <button class="btn-sec" onclick={() => (editando = novedad)}>Editar</button>
                                <button class="btn-borrar" onclick={() => (confirmandoBorrado = novedad.id)}>
                                    Eliminar
                                </button>
                            {/if}
                        </div>
                    </li>
                {/each}
            </ul>
        {/if}
    {/if}
</div>

<style>
.cont {
    padding: 2em;
}

.header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1em;
    flex-wrap: wrap;
    margin-bottom: 2em;
}

h1 {
    color: #333;
    margin: 0 0 0.3em;
    font-size: 2em;
}

.header p {
    color: #666;
    margin: 0;
}

.btn-nueva {
    background: var(--violeta1);
    color: white;
    border: none;
    padding: 0.8em 1.5em;
    border-radius: 0.4em;
    font-size: 0.95em;
    font-weight: 600;
    cursor: pointer;
}

.btn-nueva:hover {
    background: var(--violeta2);
}

.centro {
    padding: 3em;
    display: grid;
    place-items: center;
}

.vacio {
    color: #6b7280;
}

.error {
    color: #b91c1c;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 0.4em;
    padding: 0.8em 1em;
}

.lista {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-flow: column;
    gap: 0.8em;
}

.fila {
    display: flex;
    align-items: center;
    gap: 1.2em;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.6em;
    padding: 1em;
    flex-wrap: wrap;
}

.fila img,
.sin-img {
    width: 7em;
    height: 4.6em;
    border-radius: 0.4em;
    object-fit: cover;
    flex-shrink: 0;
}

.sin-img {
    background: #f3f4f6;
    color: #9ca3af;
    font-size: 0.75em;
    display: grid;
    place-items: center;
}

.datos {
    display: flex;
    flex-flow: column;
    gap: 0.35em;
    flex: 1;
    min-width: 12em;
}

.datos strong {
    color: var(--violeta1);
}

.fecha {
    font-size: 0.85em;
    color: #6b7280;
}

.chips {
    display: flex;
    gap: 0.4em;
    flex-wrap: wrap;
}

.chip {
    font-size: 0.75em;
    font-weight: 600;
    padding: 0.2em 0.6em;
    border-radius: 1em;
}

.publicada {
    background: #dcfce7;
    color: #166534;
}

.borrador {
    background: #f3f4f6;
    color: #4b5563;
}

.destacada {
    background: #fef3c7;
    color: #92400e;
}

.acciones {
    display: flex;
    gap: 0.5em;
    align-items: center;
}

.confirmar {
    font-size: 0.85em;
    color: #b91c1c;
    font-weight: 600;
}

.acciones button {
    padding: 0.5em 1em;
    border: none;
    border-radius: 0.4em;
    font-size: 0.85em;
    font-weight: 600;
    cursor: pointer;
}

.btn-sec {
    background: #e5e7eb;
    color: #374151;
}

.btn-borrar {
    background: #dc2626;
    color: white;
}
</style>
```

- [ ] **Step 2: Verificar que compila**

Run: `npx svelte-check --tsconfig ./jsconfig.json --threshold error`
Expected: sin errores en el archivo.

- [ ] **Step 3: Probar el circuito completo en el navegador**

Levantar el dev server, entrar a `/admin`, loguearse y abrir Novedades.
Verificar: crear una novedad publicada con imagen, verla en la lista con el
chip "Publicada", editarla, y que aparezca en `/novedades/`.

- [ ] **Step 4: Commit**

```bash
git add src/routes/admin/_components/mantenimiento/Dashboard/novedades/Novedades.svelte
git commit -m "feat(admin): completar la seccion de novedades"
```

---

## Task 9: Migrar el carrusel del home

**Files:**
- Modify: `src/lib/components/home/Novedades.svelte` (se reescribe entero)
- Modify: `src/lib/stores.js:30-38` (se borra `noticias`)

- [ ] **Step 1: Reescribir el carrusel**

Reemplazar todo el contenido de `src/lib/components/home/Novedades.svelte`:

```svelte
<script>
// Carrusel de novedades del inicio.
//
// Los datos se traen desde el NAVEGADOR y no con un `load` de servidor a
// proposito: el home esta prerenderizado (`prerender = true` en
// `src/routes/+layout.js`) y tiene que seguir estandolo. Es el mismo patron
// que `src/routes/precios/+page.svelte`.
import { onDestroy, onMount } from 'svelte';
import { pb } from '$lib/pocketbase';
import { ordenarNovedades } from '$lib/novedades.js';
import NovedadCard from '$lib/components/novedades/NovedadCard.svelte';

const MAX = 5;
const INTERVALO_MS = 8000;

let novedades = $state([]);
let count = $state(0);
let tam = $state(0);
let interval = null;

onMount(async () => {
    try {
        const items = await pb.collection('novedades').getFullList({ filter: '(publicada=true)' });
        novedades = ordenarNovedades(items)
            .slice(0, MAX)
            .map((n) => ({
                id: n.id,
                slug: n.slug,
                titulo: n.titulo,
                fecha: n.fecha,
                bajada: n.bajada ?? '',
                cuerpo: n.cuerpo ?? '',
                imagen: n.imagen ? pb.files.getURL(n, n.imagen, { thumb: '600x400' }) : null
            }));
    } catch (error) {
        // Si PocketBase no responde, la seccion no se muestra y el resto del
        // home queda intacto.
        console.error('[novedades] no se pudieron cargar en el home:', error);
        novedades = [];
    }

    // Con una sola novedad no hay nada que rotar.
    if (novedades.length > 1) {
        interval = setInterval(
            () => (count = count < novedades.length - 1 ? count + 1 : 0),
            INTERVALO_MS
        );
    }
});

onDestroy(() => clearInterval(interval));
</script>

{#if novedades.length > 0}
    <section>
        <div class="background2"></div>
        <div class="cont">
            <h4>Novedades</h4>
            <div class="inner">
                <div class="carousel" style="transform: translateX(-{tam * count}px)">
                    {#each novedades as novedad (novedad.id)}
                        <div bind:clientWidth={tam} class="slide">
                            <NovedadCard {novedad} orientacion="horizontal"></NovedadCard>
                        </div>
                    {/each}
                </div>
            </div>
        </div>
        <a class="ver-todas" href="/novedades/">Ver todas las novedades</a>
    </section>
{/if}

<style>
h4 {
    position: absolute;
    top: 0;
    left: 50%;
    background: var(--magenta);
    z-index: 10;
    color: white;
    border-radius: 0.3em;
    font-size: 0.8em;
    transform: translate(-50%, -50%);
    margin: 0;
    font-weight: 600;
    padding: 0.2em 1em;
}

.cont {
    max-width: 30em;
    width: 80%;
    margin: 0 auto;
    position: relative;
}

.slide {
    min-width: 100%;
}

.carousel {
    display: flex;
    flex-flow: row nowrap;
    width: 100%;
    transition: all ease-in-out 600ms;
}

.inner {
    max-width: 100%;
    overflow-x: hidden;
    padding: 0.6em 0;
}

section {
    position: relative;
    padding: 2em 0 3em;
}

.background2 {
    height: 50%;
    width: 100%;
    position: absolute;
    bottom: 0;
    background: var(--violeta1);
    border-radius: 1em 1em 0 0;
}

.ver-todas {
    position: relative;
    z-index: 10;
    display: block;
    text-align: center;
    margin-top: 1.5em;
    color: white;
    font-size: 0.9em;
    font-weight: 600;
    text-decoration: none;
}

.ver-todas:hover {
    text-decoration: underline;
}
</style>
```

- [ ] **Step 2: Borrar `noticias` de `src/lib/stores.js`**

Eliminar el bloque completo (líneas 30-38 del archivo actual):

```js
export const noticias = writable([
    {
        id:1,
        title: "Nueva Tienda Sista",
        body: "Comprá productos de tecnología en nuestra nueva tienda online<br><i><strong>Ir a la tienda</strong></i>",
        img:'tienda-sista.png',
        link:'https://tiendasista.mitiendanube.com/'
    }
]);
```

- [ ] **Step 3: Verificar que no quedó ninguna referencia**

Run: `grep -rn "noticias" src/`
Expected: sin resultados. Si aparece alguno, corregirlo antes de seguir.

- [ ] **Step 4: Correr la suite completa**

Run: `npm test`
Expected: todo verde. `src/lib/stores.test.js` no toca `noticias`, así que no
debería romperse nada.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/home/Novedades.svelte src/lib/stores.js
git commit -m "feat(home): el carrusel de novedades lee de pocketbase"
```

---

## Task 10: Link en el menú

**Files:**
- Modify: `src/lib/components/layout/nav/Navs/MenuLinks.svelte:17-19`

- [ ] **Step 1: Agregar el link**

Los dos ítems actuales hacen scroll a anclas del home con `clickHandler`. Este
es una navegación a otra ruta, así que va como `<a>` común.

Reemplazar:

```svelte
<span on:click={()=>clickHandler('planes')}>Planes</span>
<!-- <span on:click={()=>clickHandler('cobertura')}>Cobertura</span> -->
<span on:click={()=>clickHandler('contacto')}>Contacto</span>
```

por:

```svelte
<span on:click={()=>clickHandler('planes')}>Planes</span>
<!-- <span on:click={()=>clickHandler('cobertura')}>Cobertura</span> -->
<!-- Novedades es una ruta propia, no un ancla del home: no pasa por
     `clickHandler`. -->
<a href="/novedades/">Novedades</a>
<span on:click={()=>clickHandler('contacto')}>Contacto</span>
```

Y agregar `a` a los selectores del `<style>`, para que herede la misma
tipografía y color que los `span`. Reemplazar `span {` por `span, a {` y, dentro
del `@media (max-width: 48em)`, `span{` por `span, a {`. Sumar dentro del
primer bloque:

```css
    text-decoration: none;
```

- [ ] **Step 2: Verificar en el navegador**

Abrir el home en ancho de escritorio y en móvil: "Novedades" tiene que verse
igual que "Planes" y "Contacto" (mismo color, tamaño y peso), y llevar a
`/novedades/`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/layout/nav/Navs/MenuLinks.svelte
git commit -m "feat(nav): agregar novedades al menu"
```

---

## Task 11: Verificación end-to-end

Sin código. Confirma que las piezas funcionan juntas.

- [ ] **Step 1: Correr la suite completa**

Run: `npm test`
Expected: todo verde.

- [ ] **Step 2: Verificar que el build de Node incluye las rutas**

Run: `npm run build`
Expected: termina sin errores.

- [ ] **Step 3: Recorrido manual con el dev server**

Con una novedad **publicada** y otra en **borrador** cargadas desde `/admin`:

| Qué probar | Esperado |
|---|---|
| `/novedades/` | Se ve la publicada, **no** la de borrador |
| Click en la tarjeta | Abre `/novedades/<slug>/` con el cuerpo completo |
| Una URL pegada en el cuerpo | Se ve como link y abre en pestaña nueva |
| `/novedades/<slug-del-borrador>/` | 404 |
| Home | El carrusel muestra la publicada y "Ver todas" lleva al listado |
| Menú | "Novedades" lleva al listado |
| Novedad marcada como destacada | Aparece primera en `/novedades/` |
| Novedad sin imagen | La tarjeta se ve sin hueco gris |

- [ ] **Step 4: Verificar el preview al compartir**

Con el sitio deployado (o con `npm run build && node build/server.js`):

```bash
curl -s http://localhost:3000/novedades/<slug>/ | grep -o '<meta property="og:[^>]*>'
```

Expected: `og:title` con el título de la novedad y `og:image` con la URL de su
imagen. Es el criterio de éxito de que el link se pueda compartir en WhatsApp.

- [ ] **Step 5: Commit final si quedó algo suelto**

```bash
git status
```

---

## Notas de deploy

- El sitio vivo es el build de Node (`npm run build` → `build/`), que se
  deploya solo al pushear. Las rutas nuevas salen ahí sin nada extra.
- **El build estático (`build-static/`) no va a tener la sección de novedades**:
  las dos rutas son no prerenderizables y con `strict: false` se omiten en
  silencio. Es esperado; el sitio legacy `sista.com.ar` se mantiene a mano.
- No hay variables de entorno nuevas: se reusa `VITE_POCKETBASE_URL`, que ya
  existe y tiene fallback a `https://sista.pockethost.io`.
