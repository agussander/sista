# Importar el Tarifario desde Excel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que subir el `.xlsx` del tarifario en admin › Precios publique la página `/tarifas`, alimente `/telefonia` y `/telefonia/internacional`, y actualice los precios del sitio — reemplazando el circuito manual de copiar rangos a Word.

**Architecture:** Cuatro módulos en `src/lib/tarifario/`: un lector genérico de `.xlsx` sin dependencias (`xlsx.js`), un parser que conoce este libro (`parseTarifario.js`), el mapeo a los campos de la colección `precios` (`mapeoPrecios.js`) y la lectura desde PocketBase (`fetchTarifario.js`). Los tres primeros son funciones puras y se testean sin red ni navegador. El panel parsea en el navegador y escribe directo a PocketBase, igual que el resto del admin.

**Tech Stack:** SvelteKit 2 + Svelte 5 (runes), PocketBase 0.22, vitest. Sin dependencias nuevas: el ZIP se descomprime con `DecompressionStream('deflate-raw')`.

**Spec:** `docs/superpowers/specs/2026-08-18-tarifario-excel-import-design.md`

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/lib/tarifario/xlsx.js` | **Crear.** ZIP + XML → celdas por hoja. No sabe nada de tarifas. |
| `src/lib/tarifario/xlsx.test.js` | **Crear.** Regresiones de parseo + lectura del archivo real. |
| `src/lib/tarifario/__fixtures__/tarifario-26.081.xlsx` | **Crear.** Copia del Excel real, nombre limpio. |
| `src/lib/tarifario/parseTarifario.js` | **Crear.** Conoce *este* libro: 4 estructuras + versión y vigencias. |
| `src/lib/tarifario/parseTarifario.test.js` | **Crear.** Golden contra el archivo real. |
| `src/lib/tarifario/mapeoPrecios.js` | **Crear.** Etiqueta → campo de `precios`. Sin imports. |
| `src/lib/tarifario/mapeoPrecios.test.js` | **Crear.** Mapeos, derivados e invariante. |
| `src/lib/tarifario/formato.js` | **Crear.** Fecha ISO → `DD/MM/AAAA`, compartido por las páginas. |
| `src/lib/tarifario/formato.test.js` | **Crear.** |
| `src/lib/tarifario/fetchTarifario.js` | **Crear.** Lee el registro de PocketBase. |
| `.../Dashboard/precios/ImportarTarifario.svelte` | **Crear.** Dropzone + vista previa + publicar. |
| `.../Dashboard/precios/Precios.svelte` | **Modificar.** Montar el importador arriba de `EditPrices`. |
| `src/routes/tarifas/+page.svelte` | **Crear.** Réplica fiel de la tabla del Word. |
| `src/routes/telefonia/+page.svelte` | **Modificar.** Fuente y formateo. |
| `src/routes/telefonia/internacional/+page.svelte` | **Modificar.** Fuente y formateo. |
| `src/lib/telefonia/*` | **Borrar** al final (Tarea 13). |
| `vite.config.js` | **Modificar.** Sacar el proxy a `sista.com.ar`. |

**Paso manual del usuario (fuera del plan):** crear la colección `tarifario` en
PocketBase según la sección *Almacenamiento* del spec. Las tareas 1 a 7 y 10 no
la necesitan; las tareas 8, 9, 11 y 12 sí.

---

### Task 1: Lector de `.xlsx` — parseo de celdas

Arranca por el parseo de celdas, que es donde están los dos bugs conocidos, y se
testea con XML escrito a mano sin necesidad de armar un ZIP.

**Files:**
- Create: `src/lib/tarifario/xlsx.js`
- Test: `src/lib/tarifario/xlsx.test.js`

- [ ] **Step 1: Write the failing test**

Crear `src/lib/tarifario/xlsx.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { leerCeldas, serialAFecha } from './xlsx.js';

describe('leerCeldas', () => {
	it('lee numeros, compartidas y strings de formula', () => {
		const xml = `<row r="6">
			<c r="B6" s="224" t="str"><f>+'Tarifario completo'!B6</f><v>HOME F111</v></c>
			<c r="C6" s="219"><f>+D6/(1+$D$42)</f><v>20787.035481878363</v></c>
			<c r="D6" s="220" t="s"><v>1</v></c>
		</row>`;
		const celdas = leerCeldas(xml, { shared: ['cero', 'Abono Mensual'] });

		expect(celdas.get('B6')).toBe('HOME F111');
		expect(celdas.get('C6')).toBeCloseTo(20787.035481878363, 9);
		expect(celdas.get('D6')).toBe('Abono Mensual');
	});

	// Una celda auto-cerrada se comia el contenido de la siguiente: `FAST F121`
	// desaparecia del tarifario.
	it('no deja que una celda auto-cerrada se coma la siguiente', () => {
		const xml = `<c r="F6" s="214"/><c r="B7" s="224" t="str"><f>x</f><v>FAST F121</v></c>`;
		const celdas = leerCeldas(xml);

		expect(celdas.has('F6')).toBe(false);
		expect(celdas.get('B7')).toBe('FAST F121');
	});

	// Los espacios iniciales marcan los packs como sub-items de su servicio.
	it('conserva los espacios de <v xml:space="preserve">', () => {
		const xml = `<c r="B14" s="224" t="str"><f>x</f><v xml:space="preserve">   Básico + Cine</v></c>`;
		expect(leerCeldas(xml).get('B14')).toBe('   Básico + Cine');
	});

	it('convierte los seriales de fecha segun el estilo', () => {
		const xml = `<c r="B5" s="223"><f>x</f><v>46235</v></c><c r="C5" s="7"><v>46235</v></c>`;
		const celdas = leerCeldas(xml, { esFecha: (s) => s === 223 });

		expect(celdas.get('B5')).toBe('2026-08-01');
		expect(celdas.get('C5')).toBe(46235);
	});

	it('lee inlineStr, booleanos y saltea celdas de solo estilo', () => {
		const xml = `<c r="A1" t="inlineStr"><is><t>Hola</t></is></c>
			<c r="A2" t="b"><v>1</v></c>
			<c r="A3" s="9"/>`;
		const celdas = leerCeldas(xml);

		expect(celdas.get('A1')).toBe('Hola');
		expect(celdas.get('A2')).toBe(true);
		expect(celdas.has('A3')).toBe(false);
	});

	it('desescapa entidades XML', () => {
		const xml = `<c r="A1" t="str"><v>Fibra &amp; Radio &lt;2&gt;</v></c>`;
		expect(leerCeldas(xml).get('A1')).toBe('Fibra & Radio <2>');
	});
});

describe('serialAFecha', () => {
	it('convierte el serial de Excel a ISO', () => {
		expect(serialAFecha(46235)).toBe('2026-08-01');
		expect(serialAFecha(46174)).toBe('2026-06-01');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/tarifario/xlsx.test.js`
Expected: FAIL — `Failed to load .../xlsx.js` (el archivo todavía no existe).

- [ ] **Step 3: Write minimal implementation**

Crear `src/lib/tarifario/xlsx.js`:

```js
/**
 * Lector minimo de archivos .xlsx, sin dependencias.
 *
 * Un .xlsx es un ZIP de XML. Se descomprime con `DecompressionStream`, que es
 * API de plataforma: no hace falta SheetJS (la version de npm quedo congelada
 * en 0.18.5, con CVE) ni ExcelJS, que pesan cientos de KB para leer una grilla.
 *
 * Lee valores, no formulas. Excel guarda junto a cada formula su ultimo valor
 * calculado, y eso es lo que se lee. Un archivo generado por una herramienta
 * que no cachee valores va a leerse vacio; de eso avisa quien lo consume.
 */

/** Formatos de fecha que Excel trae de fabrica y no declara en `styles.xml`. */
const FORMATOS_FECHA = new Set([14, 15, 16, 17, 22, 27, 30, 36, 45, 46, 47, 50, 57]);

/**
 * Serial de Excel -> `YYYY-MM-DD`.
 *
 * 25569 es el 1970-01-01 en la numeracion de Excel. La cuenta vale para todo
 * serial >= 61 (o sea, desde el 1900-03-01): antes de esa fecha habria que
 * compensar el 29 de febrero de 1900, que Excel cree que existio y no existio.
 *
 * @param {number} serial
 */
export function serialAFecha(serial) {
	return new Date(Math.round((serial - 25569) * 86400000)).toISOString().slice(0, 10);
}

/** @param {string} texto */
function desescapar(texto) {
	return texto
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
		.replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
		.replace(/&amp;/g, '&'); // ultimo: si no, "&amp;lt;" se convertiria en "<"
}

/**
 * Celdas de una hoja, indexadas por referencia (`'B6'`).
 *
 * @param {string} xml Contenido de `xl/worksheets/sheetN.xml`.
 * @param {{ shared?: string[], esFecha?: (estilo: number) => boolean }} [opciones]
 * @returns {Map<string, string | number | boolean>}
 */
export function leerCeldas(xml, { shared = [], esFecha = () => false } = {}) {
	/** @type {Map<string, string | number | boolean>} */
	const celdas = new Map();

	// Los atributos van NO codiciosos a proposito. Con `[^>]*` codicioso, una
	// celda auto-cerrada (`<c r="F6" s="214"/>`) se traga la barra, cae en la
	// rama `>` y su "contenido" pasa a ser todo hasta el `</c>` de la celda
	// SIGUIENTE, que asi desaparece.
	for (const m of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
		const atributos = m[1];
		const contenido = m[2];
		if (contenido === undefined) continue; // celda sin valor, solo estilo

		const ref = atributos.match(/r="([A-Z]+\d+)"/)?.[1];
		if (!ref) continue;

		const tipo = atributos.match(/t="([^"]+)"/)?.[1] ?? 'n';
		const estilo = Number(atributos.match(/s="(\d+)"/)?.[1] ?? -1);

		if (tipo === 'inlineStr') {
			const partes = [...contenido.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]);
			celdas.set(ref, desescapar(partes.join('')));
			continue;
		}

		// `<v xml:space="preserve">` lleva atributos: los espacios iniciales de
		// "   Pack Futbol (DGo)" marcan los packs como sub-items, y sin `\b[^>]*`
		// esas filas se pierden enteras.
		const crudo = contenido.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1];
		if (crudo === undefined) continue;

		if (tipo === 's') celdas.set(ref, shared[Number(crudo)] ?? '');
		else if (tipo === 'str') celdas.set(ref, desescapar(crudo));
		else if (tipo === 'b') celdas.set(ref, crudo === '1');
		else if (tipo === 'e') celdas.set(ref, desescapar(crudo));
		else celdas.set(ref, esFecha(estilo) ? serialAFecha(Number(crudo)) : Number(crudo));
	}

	return celdas;
}

export { FORMATOS_FECHA };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/tarifario/xlsx.test.js`
Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tarifario/xlsx.js src/lib/tarifario/xlsx.test.js
git commit -m "feat(tarifario): parseo de celdas de xlsx sin dependencias"
```

---

### Task 2: Lector de `.xlsx` — abrir el ZIP

**Files:**
- Modify: `src/lib/tarifario/xlsx.js`
- Modify: `src/lib/tarifario/xlsx.test.js`
- Create: `src/lib/tarifario/__fixtures__/tarifario-26.081.xlsx`

- [ ] **Step 1: Copiar el fixture**

El nombre en `docs/` tiene espacios dobles y paréntesis; en el fixture va limpio.

```bash
mkdir -p src/lib/tarifario/__fixtures__
cp "docs/Tarifario V26.081  (08-2026).xlsx" src/lib/tarifario/__fixtures__/tarifario-26.081.xlsx
```

- [ ] **Step 2: Write the failing test**

Agregar al final de `src/lib/tarifario/xlsx.test.js`:

```js
import { readFile } from 'node:fs/promises';
import { leerLibro } from './xlsx.js';

const FIXTURE = new URL('./__fixtures__/tarifario-26.081.xlsx', import.meta.url);

describe('leerLibro', () => {
	it('abre el libro real y devuelve las 5 hojas con sus celdas', async () => {
		const libro = await leerLibro(await readFile(FIXTURE));

		expect([...libro.keys()]).toEqual([
			'Tarifario completo',
			'Tarifas Web',
			'Precios Mostrador',
			'Linea VIP - Tarifas Web',
			'Internacional'
		]);

		const tarifas = libro.get('Tarifas Web');
		expect(tarifas.get('B5')).toBe('2026-08-01'); // serial de fecha
		expect(tarifas.get('B6')).toBe('HOME F111');
		expect(tarifas.get('D6')).toBeCloseTo(25152.31293307282, 6);
		expect(tarifas.get('B14')).toBe('   Básico + Cine'); // xml:space
		expect(tarifas.get('B7')).toBe('FAST F121'); // celda auto-cerrada previa
		expect(tarifas.get('D42')).toBeCloseTo(0.21, 9);

		expect(libro.get('Internacional').size).toBeGreaterThan(13000);
	});

	it('rechaza un archivo que no es un ZIP', async () => {
		await expect(leerLibro(new TextEncoder().encode('esto no es un xlsx'))).rejects.toThrow(
			/no es un \.xlsx/i
		);
	});
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/tarifario/xlsx.test.js`
Expected: FAIL — `leerLibro is not a function`.

- [ ] **Step 4: Write minimal implementation**

Agregar a `src/lib/tarifario/xlsx.js`, antes del `export { FORMATOS_FECHA }`:

```js
const FIRMA_FIN_DIRECTORIO = 0x06054b50;

/** 22 bytes de cabecera final + hasta 65535 de comentario. */
const COLA_MAXIMA = 22 + 0xffff;

/**
 * Indice de las entradas del ZIP, leido del directorio central.
 *
 * Se usa el directorio central y no las cabeceras locales porque estas ultimas
 * pueden traer los tamanos en cero cuando el archivo se escribio en streaming.
 *
 * @param {DataView} vista
 */
function leerDirectorio(vista) {
	let fin = -1;
	const tope = Math.max(0, vista.byteLength - COLA_MAXIMA);
	for (let i = vista.byteLength - 22; i >= tope; i--) {
		if (vista.getUint32(i, true) === FIRMA_FIN_DIRECTORIO) {
			fin = i;
			break;
		}
	}
	if (fin === -1) throw new Error('El archivo no es un .xlsx válido: no se encontró el fin del ZIP.');

	const cantidad = vista.getUint16(fin + 10, true);
	let p = vista.getUint32(fin + 16, true);

	/** @type {Map<string, {metodo: number, comprimido: number, offset: number}>} */
	const entradas = new Map();
	const decoder = new TextDecoder();

	for (let i = 0; i < cantidad; i++) {
		const largoNombre = vista.getUint16(p + 28, true);
		const largoExtra = vista.getUint16(p + 30, true);
		const largoComentario = vista.getUint16(p + 32, true);
		const nombre = decoder.decode(
			new Uint8Array(vista.buffer, vista.byteOffset + p + 46, largoNombre)
		);
		entradas.set(nombre, {
			metodo: vista.getUint16(p + 10, true),
			comprimido: vista.getUint32(p + 20, true),
			offset: vista.getUint32(p + 42, true)
		});
		p += 46 + largoNombre + largoExtra + largoComentario;
	}

	return entradas;
}

/**
 * Contenido de texto de una entrada del ZIP, o `null` si no está.
 *
 * @param {Uint8Array} bytes
 * @param {DataView} vista
 * @param {Map<string, {metodo: number, comprimido: number, offset: number}>} entradas
 * @param {string} nombre
 * @returns {Promise<string | null>}
 */
async function leerEntrada(bytes, vista, entradas, nombre) {
	const entrada = entradas.get(nombre);
	if (!entrada) return null;

	// La cabecera local repite nombre y extra, con largos propios que pueden
	// diferir de los del directorio central.
	const largoNombre = vista.getUint16(entrada.offset + 26, true);
	const largoExtra = vista.getUint16(entrada.offset + 28, true);
	const desde = entrada.offset + 30 + largoNombre + largoExtra;
	const crudo = bytes.subarray(desde, desde + entrada.comprimido);

	if (entrada.metodo === 0) return new TextDecoder().decode(crudo);
	if (entrada.metodo !== 8) throw new Error(`Método de compresión ZIP no soportado: ${entrada.metodo}`);

	const flujo = new Blob([crudo]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
	return await new Response(flujo).text();
}

/**
 * Lee un `.xlsx` completo.
 *
 * @param {ArrayBuffer | Uint8Array} archivo
 * @returns {Promise<Map<string, Map<string, string | number | boolean>>>}
 *   Nombre de hoja -> celdas. El orden es el del libro.
 */
export async function leerLibro(archivo) {
	const bytes = archivo instanceof Uint8Array ? archivo : new Uint8Array(archivo);
	if (bytes.byteLength < 22) throw new Error('El archivo no es un .xlsx válido: está vacío.');
	const vista = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

	const entradas = leerDirectorio(vista);
	const leer = (nombre) => leerEntrada(bytes, vista, entradas, nombre);

	const libroXml = await leer('xl/workbook.xml');
	const relsXml = await leer('xl/_rels/workbook.xml.rels');
	if (!libroXml || !relsXml) throw new Error('El archivo no es un .xlsx válido: falta el workbook.');

	const destinos = new Map(
		[...relsXml.matchAll(/<Relationship\b([^>]*)>/g)].map((m) => [
			m[1].match(/Id="([^"]+)"/)?.[1],
			m[1].match(/Target="([^"]+)"/)?.[1]
		])
	);

	// Cadena de textos compartidos: las celdas `t="s"` guardan un indice a esto.
	const compartidasXml = (await leer('xl/sharedStrings.xml')) ?? '';
	const shared = [...compartidasXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
		desescapar([...m[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join(''))
	);

	const esFecha = await construirDetectorDeFechas(leer);

	/** @type {Map<string, Map<string, string | number | boolean>>} */
	const hojas = new Map();
	for (const m of libroXml.matchAll(/<sheet\b([^>]*)>/g)) {
		const nombre = m[1].match(/name="([^"]+)"/)?.[1];
		const destino = destinos.get(m[1].match(/r:id="([^"]+)"/)?.[1]);
		if (!nombre || !destino) continue;
		const xml = await leer(`xl/${destino.replace(/^\/?xl\//, '')}`);
		hojas.set(desescapar(nombre), xml ? leerCeldas(xml, { shared, esFecha }) : new Map());
	}

	return hojas;
}

/**
 * Decide si un indice de estilo corresponde a un formato de fecha. Hace falta
 * porque en el XML una fecha es un numero pelado: lo unico que la distingue de
 * un precio es el formato con el que se muestra.
 *
 * @param {(nombre: string) => Promise<string | null>} leer
 */
async function construirDetectorDeFechas(leer) {
	const estilosXml = await leer('xl/styles.xml');
	if (!estilosXml) return () => false;

	const formatos = new Map(
		[...estilosXml.matchAll(/<numFmt\b([^>]*)\/>/g)].map((m) => [
			Number(m[1].match(/numFmtId="(\d+)"/)?.[1]),
			m[1].match(/formatCode="([^"]*)"/)?.[1] ?? ''
		])
	);

	const bloque = estilosXml.match(/<cellXfs\b[\s\S]*?<\/cellXfs>/)?.[0] ?? '';
	const porEstilo = [...bloque.matchAll(/<xf\b([^>]*)/g)].map((m) =>
		Number(m[1].match(/numFmtId="(\d+)"/)?.[1] ?? 0)
	);

	return (estilo) => {
		const id = porEstilo[estilo];
		if (id === undefined) return false;
		if (FORMATOS_FECHA.has(id)) return true;
		// Formato propio: es fecha si su patron tiene letras de fecha/hora, sin
		// contar lo que este entre corchetes o entre comillas (texto literal).
		const codigo = formatos.get(id);
		return !!codigo && /[dmyhs]/.test(codigo.replace(/\[[^\]]*\]/g, '').replace(/"[^"]*"/g, ''));
	};
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/tarifario/xlsx.test.js`
Expected: PASS — 9 tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/tarifario/
git commit -m "feat(tarifario): lector de xlsx completo (ZIP + hojas)"
```

---

### Task 3: Parser — Tarifas Web

**Files:**
- Create: `src/lib/tarifario/parseTarifario.js`
- Test: `src/lib/tarifario/parseTarifario.test.js`

Columnas: `B` etiqueta, `C` sin impuestos, `D` abono mensual. Datos desde la fila
6 hasta el primer hueco en `B` (fila 34 en esta versión). La alícuota está en `D42`.

- [ ] **Step 1: Write the failing test**

Crear `src/lib/tarifario/parseTarifario.test.js`:

```js
import { readFile } from 'node:fs/promises';
import { beforeAll, describe, expect, it } from 'vitest';
import { leerLibro } from './xlsx.js';
import { parseTarifasWeb } from './parseTarifario.js';

const FIXTURE = new URL('./__fixtures__/tarifario-26.081.xlsx', import.meta.url);

/** @type {Map<string, Map<string, any>>} */
let libro;
beforeAll(async () => {
	libro = await leerLibro(await readFile(FIXTURE));
});

describe('parseTarifasWeb', () => {
	it('lee las 28 filas publicables y la alicuota', () => {
		const { filas, alicuota } = parseTarifasWeb(libro);

		expect(filas).toHaveLength(28);
		expect(alicuota).toBeCloseTo(0.21, 9);

		// Los precios se comparan con tolerancia: son dobles que vienen de
		// dividir en Excel, y una igualdad exacta de float es un test frágil.
		expect(filas[0].label).toBe('HOME F111');
		expect(filas[0].nivel).toBe(0);
		expect(filas[0].sinImpuestos).toBeCloseTo(20787.0354818, 6);
		expect(filas[0].precioFinal).toBeCloseTo(25152.3129330, 6);
		expect(filas.at(-1).label).toBe('SPRINT Banda 94');
	});

	it('marca los packs como sub-items y les recorta la sangria', () => {
		const { filas } = parseTarifasWeb(libro);
		const cine = filas.find((f) => f.label === 'Básico + Cine');

		expect(cine).toBeDefined();
		expect(cine.nivel).toBe(1);
		expect(cine.precioFinal).toBe(45950);

		expect(filas.find((f) => f.label === 'ANTINA PLAY +').nivel).toBe(0);
	});

	// Las instrucciones para Word viven en B36 y B38, despues del hueco de B34.
	it('corta en el primer hueco y no llega a las celdas de instrucciones', () => {
		const { filas } = parseTarifasWeb(libro);
		expect(filas.some((f) => /^Copiar rango/i.test(f.label))).toBe(false);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/tarifario/parseTarifario.test.js`
Expected: FAIL — no existe `./parseTarifario.js`.

- [ ] **Step 3: Write minimal implementation**

Crear `src/lib/tarifario/parseTarifario.js`:

```js
/**
 * Parser del Tarifario de Sista.
 *
 * A diferencia de `xlsx.js`, que no sabe de tarifas, este modulo conoce *este*
 * libro: que hojas mirar, que columnas tienen que datos y donde arranca cada
 * bloque.
 *
 * Ninguna fila se lee por numero fijo: se escanea desde el encabezado hasta el
 * primer hueco en la columna de etiquetas. Asi, agregar o sacar un plan entre
 * versiones no rompe nada, y las celdas de instrucciones para Word (que estan
 * mas abajo, despues del hueco) nunca se alcanzan.
 */

export const HOJA_TARIFAS = 'Tarifas Web';
export const HOJA_MOSTRADOR = 'Precios Mostrador';
export const HOJA_VIP = 'Linea VIP - Tarifas Web';
export const HOJA_INTERNACIONAL = 'Internacional';

/**
 * @param {Map<string, Map<string, any>>} libro
 * @param {string} nombre
 */
export function hoja(libro, nombre) {
	const h = libro.get(nombre);
	if (!h) throw new Error(`El Excel no tiene la pestaña "${nombre}".`);
	return h;
}

/** Texto de una celda, o `null`. No recorta: la sangría es información. */
export function texto(h, ref) {
	const v = h.get(ref);
	if (v === undefined || v === null) return null;
	const s = String(v);
	return s.trim() === '' ? null : s;
}

/** Número finito de una celda, o `null`. */
export function numero(h, ref) {
	const v = h.get(ref);
	return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * Números de fila con etiqueta, desde `desde` hasta el primer hueco.
 *
 * @param {Map<string, any>} h
 * @param {string} columna
 * @param {number} desde
 * @param {number} [tope] Corte duro, por si una hoja viniera sin huecos.
 */
export function filasConEtiqueta(h, columna, desde, tope = 10000) {
	const filas = [];
	for (let f = desde; f < desde + tope; f++) {
		if (texto(h, `${columna}${f}`) === null) break;
		filas.push(f);
	}
	return filas;
}

/**
 * @typedef {{ label: string, nivel: 0 | 1, sinImpuestos: number | null, precioFinal: number | null }} FilaTarifa
 * @typedef {{ filas: FilaTarifa[], alicuota: number | null }} TarifasWeb
 */

/**
 * Pestaña "Tarifas Web": lo que se publica en /tarifas.
 *
 * @param {Map<string, Map<string, any>>} libro
 * @returns {TarifasWeb}
 */
export function parseTarifasWeb(libro) {
	const h = hoja(libro, HOJA_TARIFAS);

	const filas = filasConEtiqueta(h, 'B', 6).map((f) => {
		const crudo = texto(h, `B${f}`) ?? '';
		return {
			// La sangria del Excel es lo unico que distingue un pack de su
			// servicio padre; se guarda como `nivel` y la etiqueta va limpia.
			label: crudo.trim(),
			nivel: /^\s/.test(crudo) ? 1 : 0,
			sinImpuestos: numero(h, `C${f}`),
			precioFinal: numero(h, `D${f}`)
		};
	});

	return { filas, alicuota: numero(h, 'D42') };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/tarifario/parseTarifario.test.js`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tarifario/parseTarifario.js src/lib/tarifario/parseTarifario.test.js
git commit -m "feat(tarifario): parser de la pestana Tarifas Web"
```

---

### Task 4: Parser — Línea VIP

Columnas `B`–`J`, filas 5–8. `H5:H8` y `J5:J8` están **combinadas**: el valor
vive en la fila 5 y aplica a los cuatro planes. Las notas van en la columna `B`
después de los planes, y se corta al llegar a una fila con contenido en `A` (la
celda de instrucciones, `A20`).

**Files:**
- Modify: `src/lib/tarifario/parseTarifario.js`
- Modify: `src/lib/tarifario/parseTarifario.test.js`

- [ ] **Step 1: Write the failing test**

Agregar a `src/lib/tarifario/parseTarifario.test.js` (y sumar `parseLineaVip` al import de `./parseTarifario.js`):

```js
describe('parseLineaVip', () => {
	it('lee los 4 planes con la vigencia propia de la pestana', () => {
		const vip = parseLineaVip(libro);

		expect(vip.vigencia).toBe('2026-08-01');
		expect(vip.planes).toHaveLength(4);

		const r11 = vip.planes[0];
		expect(r11.nombre).toBe('Linea VIP R11');
		expect(r11.clientes).toBe('Radio');
		expect(r11.numeroLocal).toBe('AMBA 011');
		expect(r11.cargoInicial).toBe(800);
		expect(r11.minutosLocales).toBe(500);
		expect(r11.abonoMensual).toBeCloseTo(19501.2550005, 6);
		expect(r11.excedenteLocal).toBeCloseTo(25.0335499, 6);
	});

	// H5:H8 y J5:J8 estan combinadas: el valor esta solo en la fila 5.
	it('replica a los 4 planes las columnas combinadas', () => {
		const vip = parseLineaVip(libro);

		for (const plan of vip.planes) {
			expect(plan.llamadasCelulares).toBeCloseTo(140.96084920182668, 9);
			expect(plan.excedenteNacional).toBeCloseTo(29.2652282079917, 9);
		}

		const fibra221 = vip.planes.find((p) => p.nombre === 'Linea VIP 221');
		expect(fibra221.clientes).toBe('Fibra');
		expect(fibra221.cargoInicial).toBe('--');
		expect(fibra221.abonoMensual).toBeCloseTo(9971.603398646428, 9);
	});

	it('separa la nota del aparato del resto y corta en las instrucciones', () => {
		const vip = parseLineaVip(libro);

		expect(vip.aparato).toMatch(/^Aparato telefonico/i);
		expect(vip.notas).toContain('Valores en Pesos ($)');
		expect(vip.notas).toContain('Incluye IVA, del 21 %');
		expect(vip.notas.some((n) => /abonado de fibra/i.test(n))).toBe(true);
		expect(vip.notas.some((n) => /^Aparato telefonico/i.test(n))).toBe(false);
		expect(vip.notas.some((n) => /^Copiar rango/i.test(n))).toBe(false);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/tarifario/parseTarifario.test.js`
Expected: FAIL — `parseLineaVip is not a function`.

- [ ] **Step 3: Write minimal implementation**

Agregar a `src/lib/tarifario/parseTarifario.js`:

```js
/**
 * @typedef {{
 *   nombre: string, clientes: string | null, numeroLocal: string | null,
 *   cargoInicial: number | string | null, abonoMensual: number | null,
 *   minutosLocales: number | null, llamadasCelulares: number | null,
 *   excedenteLocal: number | null, excedenteNacional: number | null
 * }} PlanVip
 * @typedef {{ vigencia: string | null, planes: PlanVip[], aparato: string | null, notas: string[] }} LineaVip
 */

/** Valor de una celda tal cual: número si es número, texto recortado si no. */
function crudo(h, ref) {
	const v = h.get(ref);
	if (v === undefined || v === null) return null;
	if (typeof v === 'number') return v;
	const s = String(v).trim();
	return s === '' ? null : s;
}

/**
 * Pestaña "Linea VIP - Tarifas Web": alimenta /telefonia.
 *
 * @param {Map<string, Map<string, any>>} libro
 * @returns {LineaVip}
 */
export function parseLineaVip(libro) {
	const h = hoja(libro, HOJA_VIP);

	const filas = filasConEtiqueta(h, 'B', 5);

	// H5:H8 y J5:J8 estan combinadas en el Excel: el valor existe solo en la
	// primera fila y vale para los cuatro planes. Se lee una vez y se replica.
	const primera = filas[0];
	const llamadasCelulares = primera ? numero(h, `H${primera}`) : null;
	const excedenteNacional = primera ? numero(h, `J${primera}`) : null;

	const planes = filas.map((f) => ({
		nombre: (texto(h, `B${f}`) ?? '').trim(),
		clientes: /** @type {string | null} */ (crudo(h, `C${f}`)),
		numeroLocal: /** @type {string | null} */ (crudo(h, `D${f}`)),
		cargoInicial: crudo(h, `E${f}`), // 800 en Radio, "--" en Fibra
		abonoMensual: numero(h, `F${f}`),
		minutosLocales: numero(h, `G${f}`),
		llamadasCelulares,
		excedenteLocal: numero(h, `I${f}`),
		excedenteNacional
	}));

	// Las notas arrancan despues de los planes y se cortan al llegar a la celda
	// de instrucciones para Word, que es la unica con contenido en la columna A.
	/** @type {string[]} */
	const notas = [];
	let aparato = null;
	const desde = (filas.at(-1) ?? 4) + 1;
	for (let f = desde; f < desde + 30; f++) {
		if (texto(h, `A${f}`) !== null) break;
		const nota = texto(h, `B${f}`)?.trim();
		if (!nota) continue;
		if (/^Aparato telef/i.test(nota)) aparato = nota;
		else notas.push(nota);
	}

	return { vigencia: texto(h, 'J2'), planes, aparato, notas };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/tarifario/parseTarifario.test.js`
Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tarifario/
git commit -m "feat(tarifario): parser de la pestana Linea VIP"
```

---

### Task 5: Parser — Internacional

3.273 filas, una por prefijo. Se agrupa por destino: 346 entradas, que es lo que
consume la página. Columnas: `B` prefijo, `C` destino, `D` Fijo/Móvil, `E` precio.

**Files:**
- Modify: `src/lib/tarifario/parseTarifario.js`
- Modify: `src/lib/tarifario/parseTarifario.test.js`

- [ ] **Step 1: Write the failing test**

Agregar a `src/lib/tarifario/parseTarifario.test.js` (y sumar `parseInternacional` al import):

```js
describe('parseInternacional', () => {
	it('agrupa los 3273 prefijos en destinos, con su vigencia propia', () => {
		const intl = parseInternacional(libro);

		// La pestana Internacional tiene su propia vigencia, distinta de la general.
		expect(intl.vigencia).toBe('2026-06-01');
		expect(intl.unidad).toBe('U$S');
		expect(intl.destinos).toHaveLength(346);

		const afganistan = intl.destinos[0];
		expect(afganistan).toEqual({ destino: 'AFGANISTAN', fijo: 0.5, movil: 0.5 });
	});

	it('deja en null el tipo que un destino no tiene', () => {
		const { destinos } = parseInternacional(libro);
		const econet = destinos.find((d) => d.destino === 'ZIMBABWE ECONET');

		expect(econet.fijo).toBe(0.5);
		expect(econet.movil).toBe(null);
	});

	it('respeta el orden de aparicion y no repite destinos', () => {
		const { destinos } = parseInternacional(libro);
		const nombres = destinos.map((d) => d.destino);

		expect(new Set(nombres).size).toBe(nombres.length);
		expect(nombres[1]).toBe('ALASKA');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/tarifario/parseTarifario.test.js`
Expected: FAIL — `parseInternacional is not a function`.

- [ ] **Step 3: Write minimal implementation**

Agregar a `src/lib/tarifario/parseTarifario.js`:

```js
/**
 * @typedef {{ destino: string, fijo: number | null, movil: number | null }} DestinoInternacional
 * @typedef {{ vigencia: string | null, unidad: 'U$S', destinos: DestinoInternacional[] }} Internacional
 */

/**
 * Pestaña "Internacional": alimenta /telefonia/internacional.
 *
 * La fuente trae una fila por prefijo (3.273) y la pagina muestra una por pais
 * (346), asi que se agrupa aca y no en el navegador: baja el registro de ~142 KB
 * a ~15 KB. Se verifico que ningun destino tiene dos precios distintos para el
 * mismo tipo, asi que agrupar no pierde informacion de precio.
 *
 * @param {Map<string, Map<string, any>>} libro
 * @returns {Internacional}
 */
export function parseInternacional(libro) {
	const h = hoja(libro, HOJA_INTERNACIONAL);

	/** @type {Map<string, DestinoInternacional>} */
	const porDestino = new Map();
	/** @type {DestinoInternacional[]} */
	const destinos = [];

	for (const f of filasConEtiqueta(h, 'B', 5)) {
		const nombre = texto(h, `C${f}`)?.trim();
		if (!nombre) continue;

		let entrada = porDestino.get(nombre);
		if (!entrada) {
			entrada = { destino: nombre, fijo: null, movil: null };
			porDestino.set(nombre, entrada);
			destinos.push(entrada); // el orden de aparicion es el alfabetico del Excel
		}

		const tipo = texto(h, `D${f}`) ?? '';
		const precio = numero(h, `E${f}`);
		if (/fij/i.test(tipo)) entrada.fijo ??= precio;
		else if (/m[oó]vil/i.test(tipo)) entrada.movil ??= precio;
	}

	return { vigencia: texto(h, 'E3'), unidad: 'U$S', destinos };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/tarifario/parseTarifario.test.js`
Expected: PASS — 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tarifario/
git commit -m "feat(tarifario): parser de la pestana Internacional"
```

---

### Task 6: Parser — Precios Mostrador y `parseTarifario()`

La función de entrada: versión, vigencia y las cuatro estructuras.

**Files:**
- Modify: `src/lib/tarifario/parseTarifario.js`
- Modify: `src/lib/tarifario/parseTarifario.test.js`

- [ ] **Step 1: Write the failing test**

Agregar a `src/lib/tarifario/parseTarifario.test.js` (y sumar `parseMostrador`, `parseTarifario` al import):

```js
describe('parseMostrador', () => {
	it('lee las 35 filas con cargo inicial y abono, precio final', () => {
		const filas = parseMostrador(libro);

		expect(filas).toHaveLength(35);

		expect(filas[0].label).toBe('MUNDIAL F99 (EDICIÓN LIMITADA) SÓLO LO INFORMA VENTAS');
		expect(filas[0].cargoInicial).toBe(20000);
		expect(filas[0].abonoMensual).toBeCloseTo(25152.2330009, 6);

		const home = filas.find((f) => f.label === 'HOME F111');
		expect(home.cargoInicial).toBe(20000);
		expect(home.abonoMensual).toBeCloseTo(25152.31293307282, 9);
	});

	it('corta antes de las notas al pie', () => {
		const filas = parseMostrador(libro);
		expect(filas.some((f) => f.label.startsWith('(*)'))).toBe(false);
	});
});

describe('parseTarifario', () => {
	it('arma el tarifario completo con version y vigencia', () => {
		const t = parseTarifario(libro);

		// La version es un numero en la planilla (26.081). `String` da la
		// representacion mas corta: con toFixed(3) una futura 5.2 saldria "5.200".
		expect(t.version).toBe('26.081');
		expect(t.vigencia).toBe('2026-08-01');

		expect(t.tarifasWeb.filas).toHaveLength(28);
		expect(t.lineaVip.planes).toHaveLength(4);
		expect(t.internacional.destinos).toHaveLength(346);
		expect(t.mostrador).toHaveLength(35);
	});

	it('falla ruidosamente si falta una pestana', () => {
		const incompleto = new Map(libro);
		incompleto.delete('Internacional');

		expect(() => parseTarifario(incompleto)).toThrow(/Internacional/);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/tarifario/parseTarifario.test.js`
Expected: FAIL — `parseMostrador is not a function`.

- [ ] **Step 3: Write minimal implementation**

Agregar a `src/lib/tarifario/parseTarifario.js`:

```js
/**
 * @typedef {{ label: string, cargoInicial: number | null, abonoMensual: number | null }} FilaMostrador
 * @typedef {{
 *   version: string | null, vigencia: string | null,
 *   tarifasWeb: TarifasWeb, lineaVip: LineaVip,
 *   internacional: Internacional, mostrador: FilaMostrador[]
 * }} Tarifario
 */

/**
 * Pestaña "Precios Mostrador": de acá salen los precios de la colección `precios`.
 *
 * Se toman las columnas de precio final (con impuestos), que son las que se
 * publican: `G` para el cargo inicial y `I` para el abono mensual.
 *
 * @param {Map<string, Map<string, any>>} libro
 * @returns {FilaMostrador[]}
 */
export function parseMostrador(libro) {
	const h = hoja(libro, HOJA_MOSTRADOR);

	return filasConEtiqueta(h, 'B', 5).map((f) => ({
		label: (texto(h, `B${f}`) ?? '').trim(),
		cargoInicial: numero(h, `G${f}`),
		abonoMensual: numero(h, `I${f}`)
	}));
}

/**
 * Tarifario completo a partir del libro ya leído.
 *
 * @param {Map<string, Map<string, any>>} libro
 * @returns {Tarifario}
 */
export function parseTarifario(libro) {
	const tarifasWeb = parseTarifasWeb(libro);
	const lineaVip = parseLineaVip(libro);
	const internacional = parseInternacional(libro);
	const mostrador = parseMostrador(libro);

	const version = numero(hoja(libro, HOJA_MOSTRADOR), 'B2');

	return {
		// `String` y no `toFixed`: la version es un numero (26.081) y hay que
		// mostrarlo tal como esta escrito. `toFixed(3)` convertiria una futura
		// 5.2 en "5.200"; `String` da la representacion mas corta que round-trippea.
		version: version === null ? null : String(version),
		vigencia: texto(hoja(libro, HOJA_TARIFAS), 'B5'),
		tarifasWeb,
		lineaVip,
		internacional,
		mostrador
	};
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/tarifario/parseTarifario.test.js`
Expected: PASS — 13 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tarifario/
git commit -m "feat(tarifario): parseTarifario completo con version y vigencia"
```

---

### Task 7: Mapeo a los campos de `precios`

**Files:**
- Create: `src/lib/tarifario/mapeoPrecios.js`
- Test: `src/lib/tarifario/mapeoPrecios.test.js`

- [ ] **Step 1: Write the failing test**

Crear `src/lib/tarifario/mapeoPrecios.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { calcularPrecios } from './mapeoPrecios.js';

/** @param {Array<[string, number | null]>} filas */
const mostrador = (filas) =>
	filas.map(([label, abonoMensual]) => ({ label, cargoInicial: null, abonoMensual }));

const COMPLETO = [
	{ label: 'HOME F111', cargoInicial: 20000, abonoMensual: 25152.31 },
	{ label: 'FAST F121', cargoInicial: 20000, abonoMensual: 31058.05 },
	{ label: 'ANTINA PLAY +', cargoInicial: null, abonoMensual: 19890 },
	{ label: 'Básico + Cine', cargoInicial: null, abonoMensual: 45950 },
	{ label: 'Pack Fútbol (DGo)', cargoInicial: null, abonoMensual: 25610 },
	{ label: 'LINEA VIP 56-221', cargoInicial: null, abonoMensual: 9971.6 }
];

describe('calcularPrecios', () => {
	it('mapea las etiquetas a los campos y redondea', () => {
		const { valores } = calcularPrecios(COMPLETO);

		expect(valores.home).toBe(25152);
		expect(valores.fast).toBe(31058);
		expect(valores.antina).toBe(19890);
		expect(valores.dgo_futbol).toBe(25610);
		expect(valores.telefono).toBe(9972);
	});

	it('toma la instalacion del cargo inicial de HOME F111', () => {
		expect(calcularPrecios(COMPLETO).valores.instalacion).toBe(20000);
	});

	// El Excel publica el total "Basico + Cine"; el sitio usa el adicional.
	it('deriva antina_cine restando el basico del total', () => {
		const { valores, avisos } = calcularPrecios(COMPLETO);

		expect(valores.antina_cine).toBe(26060); // 45950 - 19890
		expect(avisos.some((a) => /antina_cine/.test(a))).toBe(false);
	});

	it('no deriva antina_cine si falta alguna de las dos filas', () => {
		const sinBasico = COMPLETO.filter((f) => f.label !== 'ANTINA PLAY +');
		const { valores, avisos } = calcularPrecios(sinBasico);

		expect('antina_cine' in valores).toBe(false);
		expect(avisos.some((a) => /antina_cine/.test(a))).toBe(true);
	});

	it('normaliza espacios de mas y mayusculas al buscar la etiqueta', () => {
		const { valores } = calcularPrecios(mostrador([['max   f161   (NUEVO)', 54688.87]]));
		expect(valores.max).toBe(54689);
	});

	// Invariante: solo se escribe un numero positivo que se encontro.
	it('deja el campo intacto y avisa si la etiqueta no esta', () => {
		const { valores, avisos } = calcularPrecios(mostrador([['HOME F111', 25152]]));

		expect(valores.home).toBe(25152);
		expect('gamer' in valores).toBe(false);
		expect(avisos.some((a) => /GAMER F141/.test(a))).toBe(true);
	});

	it('descarta valores no numericos o no positivos', () => {
		const { valores, avisos } = calcularPrecios(
			mostrador([
				['HOME F111', 0],
				['FAST F121', null],
				['POWER F131', -5]
			])
		);

		expect('home' in valores).toBe(false);
		expect('fast' in valores).toBe(false);
		expect('power' in valores).toBe(false);
		expect(avisos.length).toBeGreaterThanOrEqual(3);
	});

	it('lista como informativas las filas del Excel sin campo asociado', () => {
		const { sinCampo } = calcularPrecios([
			...COMPLETO,
			{ label: 'SPRINT Banda 94', cargoInicial: null, abonoMensual: 58992 }
		]);

		expect(sinCampo).toContain('SPRINT Banda 94');
		expect(sinCampo).not.toContain('HOME F111');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/tarifario/mapeoPrecios.test.js`
Expected: FAIL — no existe `./mapeoPrecios.js`.

- [ ] **Step 3: Write minimal implementation**

Crear `src/lib/tarifario/mapeoPrecios.js`:

```js
/**
 * Mapeo de la pestaña "Precios Mostrador" a los campos de la coleccion
 * `precios` de PocketBase, que es de donde leen las paginas comerciales
 * (planes, wizard de TV, grillas de canales).
 *
 * Sin imports a proposito: es una tabla de correspondencias y la aritmetica
 * minima que hace falta. Se testea sin tocar Excel ni PocketBase.
 *
 * El invariante que ordena todo el archivo: **solo se escribe un numero
 * positivo y finito que efectivamente se encontro**. Una etiqueta que no esta,
 * un valor vacio o un valor <= 0 dejan el campo como estaba y generan un aviso.
 * Un Excel con la estructura cambiada degrada a "no actualice estos campos", no
 * a "borre los precios del sitio".
 */

/** Etiqueta del Excel -> campo de `precios`. El valor sale del abono mensual. */
export const CAMPOS_POR_ETIQUETA = Object.freeze({
	'HOME F111': 'home',
	'FAST F121': 'fast',
	'POWER F131': 'power',
	'GAMER F141': 'gamer',
	'WORKER F151': 'worker',
	'MAX F161 (NUEVO)': 'max',
	'ANTINA PLAY +': 'antina',
	'Pack Fútbol (Antina)': 'antina_futbol',
	'DGO Full': 'dgo_full',
	'Pack Fútbol (DGo)': 'dgo_futbol',
	'PARAMOUNT + (Dgo)': 'dgo_paramount',
	'UNIVERSAL (DGo)': 'dgo_universal',
	'GIGARED Básico': 'gigared',
	'Pack Fútbol (Gigared)': 'gigared_futbol',
	'LINEA VIP 56-221': 'telefono'
});

/** Fila de la que sale el cargo de instalación. */
const ETIQUETA_INSTALACION = 'HOME F111';

/** Las dos filas de las que se deriva el adicional de Cine. */
const ETIQUETA_ANTINA_TOTAL_CINE = 'Básico + Cine';
const ETIQUETA_ANTINA_BASICO = 'ANTINA PLAY +';

/**
 * Etiqueta comparable: sin espacios de sobra ni distincion de mayusculas.
 * "MAX F161   (NUEVO)" viene con espacios triples desde el Excel.
 *
 * @param {string} etiqueta
 */
export function normalizar(etiqueta) {
	return String(etiqueta ?? '')
		.replace(/\s+/g, ' ')
		.trim()
		.toLowerCase();
}

/** @param {unknown} valor */
function positivo(valor) {
	return typeof valor === 'number' && Number.isFinite(valor) && valor > 0;
}

/**
 * @typedef {{ label: string, cargoInicial: number | null, abonoMensual: number | null }} FilaMostrador
 * @typedef {{
 *   valores: Record<string, number>,
 *   avisos: string[],
 *   sinCampo: string[]
 * }} ResultadoPrecios
 */

/**
 * Valores a escribir en `precios`, más los avisos para la vista previa.
 *
 * @param {FilaMostrador[]} mostrador
 * @returns {ResultadoPrecios}
 */
export function calcularPrecios(mostrador) {
	const filas = Array.isArray(mostrador) ? mostrador : [];

	/** @type {Map<string, FilaMostrador>} */
	const porEtiqueta = new Map();
	for (const fila of filas) {
		const clave = normalizar(fila?.label);
		if (clave && !porEtiqueta.has(clave)) porEtiqueta.set(clave, fila);
	}

	/** @type {Record<string, number>} */
	const valores = {};
	/** @type {string[]} */
	const avisos = [];

	for (const [etiqueta, campo] of Object.entries(CAMPOS_POR_ETIQUETA)) {
		const fila = porEtiqueta.get(normalizar(etiqueta));
		if (!fila) {
			avisos.push(`No encontré la fila "${etiqueta}": ${campo} queda como está.`);
			continue;
		}
		if (!positivo(fila.abonoMensual)) {
			avisos.push(`"${etiqueta}" no tiene un abono mensual válido: ${campo} queda como está.`);
			continue;
		}
		valores[campo] = Math.round(fila.abonoMensual);
	}

	// Instalacion: es un cargo por unica vez, no un abono, asi que sale de la
	// otra columna. Es el mismo para todos los planes de fibra.
	const filaInstalacion = porEtiqueta.get(normalizar(ETIQUETA_INSTALACION));
	if (filaInstalacion && positivo(filaInstalacion.cargoInicial)) {
		valores.instalacion = Math.round(filaInstalacion.cargoInicial);
	} else {
		avisos.push(
			`No pude leer el cargo inicial de "${ETIQUETA_INSTALACION}": instalacion queda como está.`
		);
	}

	// El sitio usa antina_cine como ADICIONAL (se suma a Antina Play+), pero el
	// Excel solo publica el total "Basico + Cine". Se deriva por resta, y si
	// falta cualquiera de las dos filas no se escribe nada.
	const total = porEtiqueta.get(normalizar(ETIQUETA_ANTINA_TOTAL_CINE));
	const basico = porEtiqueta.get(normalizar(ETIQUETA_ANTINA_BASICO));
	if (total && basico && positivo(total.abonoMensual) && positivo(basico.abonoMensual)) {
		const adicional = total.abonoMensual - basico.abonoMensual;
		if (adicional > 0) valores.antina_cine = Math.round(adicional);
		else avisos.push(`La resta de "${ETIQUETA_ANTINA_TOTAL_CINE}" dio ${adicional}: antina_cine queda como está.`);
	} else {
		avisos.push(
			`Faltan "${ETIQUETA_ANTINA_TOTAL_CINE}" o "${ETIQUETA_ANTINA_BASICO}": antina_cine queda como está.`
		);
	}

	// Informativo: filas que se publican en /tarifas pero no tienen campo propio
	// (SistaFLEX, PABXIP, bandas SPRINT, IP fija, cableados, traslados...).
	const mapeadas = new Set(Object.keys(CAMPOS_POR_ETIQUETA).map(normalizar));
	mapeadas.add(normalizar(ETIQUETA_ANTINA_TOTAL_CINE));
	const sinCampo = filas
		.map((f) => String(f?.label ?? '').trim())
		.filter((label) => label && !mapeadas.has(normalizar(label)));

	return { valores, avisos, sinCampo };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/tarifario/mapeoPrecios.test.js`
Expected: PASS — 8 tests.

- [ ] **Step 5: Verificar el mapeo contra el Excel real**

Agregar a `src/lib/tarifario/parseTarifario.test.js`:

```js
import { calcularPrecios } from './mapeoPrecios.js';

describe('mapeo contra el Excel real', () => {
	it('resuelve los 17 campos sin avisos', () => {
		const { valores, avisos } = calcularPrecios(parseTarifario(libro).mostrador);

		expect(avisos).toEqual([]);
		expect(Object.keys(valores)).toHaveLength(17);

		expect(valores).toMatchObject({
			home: 25152,
			fast: 31058,
			power: 32205,
			gamer: 41981,
			worker: 45799,
			max: 54689,
			antina: 19890,
			antina_futbol: 29500,
			dgo_full: 35050,
			dgo_futbol: 25610, // en PocketBase estaba 29500, pegado a antina_futbol
			dgo_paramount: 9135,
			dgo_universal: 15120,
			gigared: 13100,
			gigared_futbol: 25610,
			telefono: 9972,
			instalacion: 20000,
			antina_cine: 26060 // 45950 - 19890
		});
	});
});
```

Run: `npx vitest run src/lib/tarifario/`
Expected: PASS — 22 tests en 3 archivos.

- [ ] **Step 6: Commit**

```bash
git add src/lib/tarifario/
git commit -m "feat(tarifario): mapeo de Precios Mostrador a la coleccion precios"
```

---

### Task 8: Lectura desde PocketBase

**Requiere** que la colección `tarifario` exista.

**Files:**
- Create: `src/lib/tarifario/fetchTarifario.js`

- [ ] **Step 1: Implementar**

Crear `src/lib/tarifario/fetchTarifario.js`:

```js
/**
 * Lectura del tarifario vigente desde PocketBase.
 *
 * Reemplaza a `$lib/telefonia/fetchLineaVip.js` y `fetchInternacional.js`, que
 * se bajaban las paginas de Word de sista.com.ar y las desarmaban con regex.
 *
 * Unico modulo de `tarifario/` que sabe de la base: el parseo y el mapeo son
 * funciones puras y se testean sin red.
 */
import { pb } from '$lib/pocketbase';

/** @typedef {import('./parseTarifario.js').TarifasWeb} TarifasWeb */
/** @typedef {import('./parseTarifario.js').LineaVip} LineaVip */
/** @typedef {import('./parseTarifario.js').Internacional} Internacional */

/**
 * @typedef {{
 *   id: string, version: string, vigencia: string,
 *   tarifasWeb: TarifasWeb, lineaVip: LineaVip, internacional: Internacional
 * }} TarifarioPublicado
 */

/**
 * Los campos json de PocketBase vuelven como objeto, pero si la coleccion los
 * declara como texto vuelven como string. Se acepta cualquiera de las dos.
 *
 * @param {unknown} valor
 * @param {unknown} porDefecto
 */
function json(valor, porDefecto) {
	if (valor === null || valor === undefined || valor === '') return porDefecto;
	if (typeof valor !== 'string') return valor;
	try {
		return JSON.parse(valor);
	} catch {
		return porDefecto;
	}
}

/**
 * Tarifario vigente.
 *
 * @param {{ requestKey?: string | null }} [opciones] `requestKey: null` evita la
 *   auto-cancelacion cuando dos componentes de la misma pagina lo piden a la vez.
 * @returns {Promise<TarifarioPublicado>}
 */
export async function fetchTarifario({ requestKey } = {}) {
	const record = await pb
		.collection('tarifario')
		.getFirstListItem('', requestKey === undefined ? {} : { requestKey });

	return {
		id: record.id,
		version: record.version ?? '',
		vigencia: record.vigencia ?? '',
		tarifasWeb: json(record.tarifas_web, { filas: [], alicuota: null }),
		lineaVip: json(record.linea_vip, { vigencia: null, planes: [], aparato: null, notas: [] }),
		internacional: json(record.internacional, { vigencia: null, unidad: 'U$S', destinos: [] })
	};
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx vitest run src/lib/tarifario/`
Expected: PASS — 22 tests (el módulo nuevo no tiene test propio; se ejerce en las tareas 10–12).

- [ ] **Step 3: Commit**

```bash
git add src/lib/tarifario/fetchTarifario.js
git commit -m "feat(tarifario): lectura del tarifario vigente desde PocketBase"
```

---

### Task 9: Importador en el panel

**Requiere** que la colección `tarifario` exista.

**Files:**
- Create: `.../Dashboard/precios/ImportarTarifario.svelte`
- Modify: `.../Dashboard/precios/Precios.svelte`

- [ ] **Step 1: Crear el componente**

Crear `src/routes/admin/_components/mantenimiento/Dashboard/precios/ImportarTarifario.svelte`:

```svelte
<script>
/**
 * Importador del Excel del tarifario.
 *
 * Reemplaza el circuito manual que estaba escrito dentro del propio Excel
 * ("copiar rango B5:C34, pegarlo en Word, guardarlo como pagina web
 * filtrada..."). El archivo se parsea en el navegador y se escribe directo a
 * PocketBase, igual que el resto del panel.
 *
 * Publica en un solo paso, pero nunca a ciegas: primero muestra el diff contra
 * los precios que estan hoy en el sitio. Es una operacion mensual que toca los
 * precios de todas las paginas comerciales.
 */
import { onMount } from 'svelte';
import { pb } from '$lib/pocketbase';
import Spinner from '$lib/components/ui/Spinner.svelte';
import { leerLibro } from '$lib/tarifario/xlsx.js';
import { parseTarifario } from '$lib/tarifario/parseTarifario.js';
import { calcularPrecios } from '$lib/tarifario/mapeoPrecios.js';

/** @type {import('$lib/tarifario/parseTarifario.js').Tarifario | null} */
let tarifario = $state(null);
let archivo = $state(null);
let resultado = $state(null);
let preciosActuales = $state({});
let preciosId = $state(null);
let tarifarioId = $state(null);
let vigenteVersion = $state(null);

let leyendo = $state(false);
let publicando = $state(false);
let error = $state('');
let mensaje = $state('');

onMount(async () => {
	try {
		const record = await pb.collection('precios').getFirstListItem('', { requestKey: null });
		preciosId = record.id;
		preciosActuales = { ...record };
	} catch (e) {
		console.error('No se pudieron leer los precios actuales:', e);
	}
	try {
		const record = await pb.collection('tarifario').getFirstListItem('', { requestKey: null });
		tarifarioId = record.id;
		vigenteVersion = record.version ?? null;
	} catch {
		// Todavia no hay tarifario publicado: es el primer import.
	}
});

const diff = $derived.by(() => {
	if (!resultado) return [];
	return Object.entries(resultado.valores).map(([campo, nuevo]) => {
		const actual = Number(preciosActuales?.[campo] ?? NaN);
		return {
			campo,
			actual: Number.isFinite(actual) ? actual : null,
			nuevo,
			cambia: !Number.isFinite(actual) || actual !== nuevo
		};
	});
});

const cambios = $derived(diff.filter((d) => d.cambia).length);

const miles = (n) => (n === null ? '—' : n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'));

async function tomarArchivo(file) {
	if (!file) return;
	leyendo = true;
	error = '';
	mensaje = '';
	tarifario = null;
	resultado = null;

	try {
		const libro = await leerLibro(await file.arrayBuffer());
		const parsed = parseTarifario(libro);
		if (!parsed.tarifasWeb.filas.length) {
			throw new Error('La pestaña "Tarifas Web" no trajo ninguna fila.');
		}
		tarifario = parsed;
		resultado = calcularPrecios(parsed.mostrador);
		archivo = file;
	} catch (e) {
		error = e instanceof Error ? e.message : 'No se pudo leer el archivo.';
		console.error('Importar tarifario:', e);
	} finally {
		leyendo = false;
	}
}

async function publicar() {
	if (!tarifario || !archivo) return;
	publicando = true;
	error = '';
	mensaje = '';

	try {
		const datos = new FormData();
		datos.append('version', tarifario.version ?? '');
		datos.append('vigencia', tarifario.vigencia ?? '');
		datos.append('tarifas_web', JSON.stringify(tarifario.tarifasWeb));
		datos.append('linea_vip', JSON.stringify(tarifario.lineaVip));
		datos.append('internacional', JSON.stringify(tarifario.internacional));
		datos.append('importado_por', pb.authStore.record?.id ?? '');
		datos.append('archivo', archivo);

		const record = tarifarioId
			? await pb.collection('tarifario').update(tarifarioId, datos)
			: await pb.collection('tarifario').create(datos);
		tarifarioId = record.id;
		vigenteVersion = record.version ?? null;

		if (preciosId && Object.keys(resultado.valores).length) {
			await pb.collection('precios').update(preciosId, resultado.valores);
			preciosActuales = { ...preciosActuales, ...resultado.valores };
		}

		mensaje = `Tarifario ${tarifario.version} publicado. ${cambios} precio(s) actualizados.`;
		tarifario = null;
		resultado = null;
		archivo = null;
	} catch (e) {
		error = e instanceof Error ? e.message : 'No se pudo publicar.';
		console.error('Publicar tarifario:', e);
	} finally {
		publicando = false;
	}
}
</script>

<section class="importar">
	<header>
		<h3>Importar tarifario</h3>
		{#if vigenteVersion}
			<span class="vigente">Vigente: versión {vigenteVersion}</span>
		{/if}
	</header>

	<label class="dropzone">
		<input
			type="file"
			accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
			onchange={(e) => tomarArchivo(e.currentTarget.files?.[0])}
			disabled={leyendo || publicando}
		/>
		{#if leyendo}
			<Spinner size={32} borderWidth={3} label="Leyendo el Excel…" />
		{:else}
			<span class="titulo">Subí el Excel del tarifario</span>
			<span class="ayuda">Archivo .xlsx, con las pestañas de siempre</span>
		{/if}
	</label>

	{#if error}
		<p class="alerta error">{error}</p>
	{/if}
	{#if mensaje}
		<p class="alerta ok">{mensaje}</p>
	{/if}

	{#if tarifario && resultado}
		<div class="resumen">
			<div><strong>Versión</strong><span>{tarifario.version ?? '—'}</span></div>
			<div><strong>Vigencia</strong><span>{tarifario.vigencia ?? '—'}</span></div>
			<div><strong>Tarifas Web</strong><span>{tarifario.tarifasWeb.filas.length} filas</span></div>
			<div><strong>Línea VIP</strong><span>{tarifario.lineaVip.planes.length} planes</span></div>
			<div>
				<strong>Internacional</strong><span>{tarifario.internacional.destinos.length} destinos</span>
			</div>
			<div><strong>Mostrador</strong><span>{tarifario.mostrador.length} filas</span></div>
		</div>

		<table class="diff">
			<thead>
				<tr><th>Campo</th><th>Actual</th><th>Nuevo</th></tr>
			</thead>
			<tbody>
				{#each diff as fila (fila.campo)}
					<tr class:cambia={fila.cambia}>
						<th scope="row">{fila.campo}</th>
						<td>{miles(fila.actual)}</td>
						<td>{miles(fila.nuevo)}</td>
					</tr>
				{/each}
			</tbody>
		</table>

		{#if resultado.valores.antina_cine}
			<p class="nota">
				<code>antina_cine</code> es un adicional y el Excel publica el total: se deriva restando
				“ANTINA PLAY +” de “Básico + Cine”.
			</p>
		{/if}

		{#if resultado.avisos.length}
			<ul class="avisos">
				{#each resultado.avisos as aviso}
					<li>{aviso}</li>
				{/each}
			</ul>
		{/if}

		{#if resultado.sinCampo.length}
			<details class="sin-campo">
				<summary>{resultado.sinCampo.length} filas del Excel sin precio propio en el sitio</summary>
				<p>{resultado.sinCampo.join(' · ')}</p>
			</details>
		{/if}

		<div class="acciones">
			<button type="button" onclick={publicar} disabled={publicando}>
				{publicando ? 'Publicando…' : `Publicar (${cambios} cambio${cambios === 1 ? '' : 's'})`}
			</button>
		</div>
	{/if}
</section>

<style>
.importar {
	background: white;
	padding: 2em;
	border-radius: 1em;
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
	margin-bottom: 2em;
}

header {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: 1em;
	margin-bottom: 1.2em;
}

h3 {
	margin: 0;
	font-size: 1.1em;
	color: var(--violeta2);
}

.vigente {
	font-size: 0.85em;
	color: #888;
}

.dropzone {
	display: grid;
	place-items: center;
	gap: 0.35em;
	padding: 2em 1em;
	border: 2px dashed #d0d0d0;
	border-radius: 0.5em;
	cursor: pointer;
	transition: all 0.2s ease;
	text-align: center;
}

.dropzone:hover {
	border-color: var(--violeta2);
	background: #f9f9ff;
}

.dropzone input {
	display: none;
}

.titulo {
	font-weight: 600;
	color: #666;
}

.ayuda {
	font-size: 0.85em;
	color: #999;
}

.alerta {
	margin: 1em 0 0;
	padding: 0.8em 1.2em;
	border-radius: 0.5em;
}

.alerta.error {
	background: #ffebee;
	color: #c62828;
}

.alerta.ok {
	background: #e8f5e9;
	color: #2e7d32;
}

.resumen {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
	gap: 0.8em;
	margin: 1.5em 0;
}

.resumen div {
	display: flex;
	flex-direction: column;
	gap: 0.2em;
	padding: 0.7em 0.9em;
	background: #f7f7fb;
	border-radius: 0.5em;
}

.resumen strong {
	font-size: 0.7em;
	text-transform: uppercase;
	letter-spacing: 0.05em;
	color: var(--violeta2);
}

.diff {
	width: 100%;
	border-collapse: collapse;
	font-size: 0.92em;
}

.diff th,
.diff td {
	padding: 0.5em 0.7em;
	border-bottom: 1px solid #eee;
	text-align: left;
}

.diff thead th {
	font-size: 0.72em;
	text-transform: uppercase;
	letter-spacing: 0.05em;
	color: #888;
}

.diff td {
	text-align: right;
	font-variant-numeric: tabular-nums;
}

.diff tr.cambia {
	background: #fff8e1;
}

.diff tr.cambia td:last-child {
	font-weight: 700;
	color: var(--magenta);
}

.nota,
.avisos {
	margin: 1em 0 0;
	font-size: 0.88em;
	color: #666;
}

.avisos {
	padding-left: 1.2em;
	display: grid;
	gap: 0.35em;
	color: #b26a00;
}

.sin-campo {
	margin-top: 1em;
	font-size: 0.85em;
	color: #777;
}

.acciones {
	display: flex;
	justify-content: flex-end;
	margin-top: 1.5em;
}

.acciones button {
	background: linear-gradient(135deg, var(--violeta1) 0%, var(--violeta2) 100%);
	color: white;
	border: none;
	padding: 0.8em 1.5em;
	border-radius: 0.5em;
	font-size: 1em;
	font-weight: 600;
	cursor: pointer;
}

.acciones button:disabled {
	opacity: 0.6;
	cursor: not-allowed;
}
</style>
```

- [ ] **Step 2: Montarlo en la sección**

Reemplazar el contenido de `src/routes/admin/_components/mantenimiento/Dashboard/precios/Precios.svelte`:

```svelte
<script>
import ImportarTarifario from './ImportarTarifario.svelte';
import EditPrices from './EditPrices.svelte';
</script>

<div class="precios-container">
    <h2>Editar Precios</h2>
    <ImportarTarifario />
    <EditPrices />
</div>

<style>
.precios-container {
    padding: 2em;
    max-width: 1200px;
    margin: 0 auto;
}

h2 {
    color: var(--violeta2);
    margin-bottom: 1.5em;
    font-size: 1.8em;
}
</style>
```

- [ ] **Step 3: Verificar en el navegador**

Levantar el dev server con `preview_start` (nunca con Bash), entrar a `/admin`,
ir a Precios, y subir `docs/Tarifario V26.081  (08-2026).xlsx`.

Verificar: el resumen dice versión `26.081`, vigencia `2026-08-01`, 28 filas, 4
planes, 346 destinos, 35 filas de mostrador; el diff resalta `dgo_futbol`
29.500 → 25.610 y `antina_cine` 25.550 → 26.060; no hay avisos. Revisar la
consola con `read_console_messages`.

- [ ] **Step 4: Publicar y confirmar**

Apretar Publicar. Verificar que aparece el mensaje de éxito y que en PocketBase
quedó el registro de `tarifario` con el `.xlsx` adjunto.

- [ ] **Step 5: Commit**

```bash
git add src/routes/admin/_components/mantenimiento/Dashboard/precios/
git commit -m "feat(tarifario): importador de Excel en el panel de precios"
```

---

### Task 10: Página `/tarifas`

Réplica fiel de la tabla del Word: dos columnas, sub-ítems indentados, formato
`$ 20 787` (miles con espacio), versión al pie.

**Files:**
- Create: `src/lib/tarifario/formato.js`
- Create: `src/lib/tarifario/formato.test.js`
- Create: `src/routes/tarifas/+page.svelte`

- [ ] **Step 1: Write the failing test para el formato de fecha**

El tarifario guarda las vigencias en ISO (`2026-08-01`), que es lo correcto para
guardar y ordenar, pero acá se leen en español. Lo usan `/tarifas` y `/telefonia`,
así que va en un módulo compartido.

Crear `src/lib/tarifario/formato.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { formatearFecha } from './formato.js';

describe('formatearFecha', () => {
	it('pasa de ISO a DD/MM/AAAA', () => {
		expect(formatearFecha('2026-08-01')).toBe('01/08/2026');
		expect(formatearFecha('2026-06-01')).toBe('01/06/2026');
	});

	// No se construye un Date: `new Date('2026-08-01')` es medianoche UTC y en
	// Argentina (UTC-3) se lee como el 31/07.
	it('no corre la fecha por zona horaria', () => {
		expect(formatearFecha('2026-01-01')).toBe('01/01/2026');
	});

	it('devuelve null si no hay fecha o no tiene el formato esperado', () => {
		expect(formatearFecha(null)).toBe(null);
		expect(formatearFecha('')).toBe(null);
		expect(formatearFecha('agosto 2026')).toBe(null);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/tarifario/formato.test.js`
Expected: FAIL — no existe `./formato.js`.

- [ ] **Step 3: Write minimal implementation**

Crear `src/lib/tarifario/formato.js`:

```js
/**
 * Formateo compartido del tarifario.
 *
 * El dinero lo formatea cada pagina, porque no todas lo muestran igual:
 * /tarifas replica el formato del Word (miles con espacio) y /telefonia usa el
 * estilo local (miles con punto). La fecha, en cambio, se lee igual en todas.
 */

/**
 * `2026-08-01` -> `01/08/2026`.
 *
 * Se parte el string en vez de construir un `Date`: `new Date('2026-08-01')` es
 * medianoche UTC, y en Argentina (UTC-3) eso se leeria como el 31 de julio.
 *
 * @param {string | null | undefined} iso
 * @returns {string | null}
 */
export function formatearFecha(iso) {
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? '').trim());
	return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/tarifario/formato.test.js`
Expected: PASS — 3 tests.

- [ ] **Step 5: Crear la página**

Crear `src/routes/tarifas/+page.svelte`:

```svelte
<script>
/**
 * Tarifario publico, generado desde el Excel importado en el panel.
 *
 * Replica la tabla que hasta ahora se armaba a mano pegando el rango B5:D34 en
 * Word y renombrando el .htm a index.php. Mismo orden, mismas dos columnas y
 * misma sangria de los packs; lo unico que cambia es que sale sola.
 */
import { onMount } from 'svelte';
import { MetaTags } from 'svelte-meta-tags';
import ContactButtons from '$lib/components/ui/ContactButtons.svelte';
import Spinner from '$lib/components/ui/Spinner.svelte';
import { fetchTarifario } from '$lib/tarifario/fetchTarifario.js';
import { formatearFecha } from '$lib/tarifario/formato.js';

let data = $state(null);
let loading = $state(true);
let error = $state(null);

onMount(async () => {
	try {
		data = await fetchTarifario();
	} catch (e) {
		error = e instanceof Error ? e.message : 'Error al cargar el tarifario.';
		console.error('Tarifario:', e);
	} finally {
		loading = false;
	}
});

const vigencia = $derived(formatearFecha(data?.vigencia));

/**
 * Formato del Word: entero, miles separados con espacio. `$ 20 787`.
 * @param {number | null} valor
 */
function pesos(valor) {
	if (typeof valor !== 'number' || !Number.isFinite(valor)) return '—';
	return `$ ${Math.round(valor).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`;
}

const filas = $derived(data?.tarifasWeb?.filas ?? []);
</script>

<MetaTags
	title="Tarifas vigentes | Sista"
	description="Cuadro tarifario vigente de Sista: abonos mensuales de internet, TV y telefonía, con y sin impuestos nacionales."
/>

<section class="page">
	<header class="hero">
		<h1>Tarifas</h1>
		{#if vigencia}
			<p class="vigencia">Vigentes desde el {vigencia}</p>
		{/if}
	</header>

	{#if loading}
		<div class="state">
			<Spinner size={48} label="Cargando tarifas…" />
		</div>
	{:else if error}
		<div class="state state--error">
			<p>{error}</p>
			<p class="hint">Los valores se actualizan desde el tarifario oficial de Sista.</p>
		</div>
	{:else if filas.length}
		<div class="card">
			<div class="table-wrap">
				<table>
					<thead>
						<tr>
							<th class="th-plan"></th>
							<th class="th-precio">Sin impuestos nacionales</th>
							<th class="th-precio">Abono Mensual</th>
						</tr>
					</thead>
					<tbody>
						{#each filas as fila (fila.label)}
							<tr class:sub={fila.nivel === 1}>
								<th scope="row">{fila.label}</th>
								<td>{pesos(fila.sinImpuestos)}</td>
								<td>{pesos(fila.precioFinal)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			{#if data?.version}
				<p class="version">{data.version}</p>
			{/if}
		</div>
	{:else}
		<div class="state state--error">
			<p>Todavía no hay un tarifario publicado.</p>
		</div>
	{/if}

	<ContactButtons text="¿Querés contratar?" />
</section>

<style>
.page {
	padding: 6em 1em 2em;
	max-width: 56rem;
	margin: 0 auto;
}

.hero {
	text-align: center;
	margin-bottom: 1.75rem;
}

h1 {
	margin: 0;
	color: var(--violeta1);
}

.vigencia {
	margin: 0.5rem 0 0;
	font-size: 0.8rem;
	color: var(--violeta1);
	font-weight: 500;
	opacity: 0.85;
}

.state {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	min-height: 16rem;
	gap: 0.75rem;
}

.state--error p:first-child {
	margin: 0;
	text-align: center;
	color: #c62828;
	font-weight: 700;
	background: #ffebee;
	padding: 1rem 1.25rem;
	border-radius: var(--border-radius);
}

.hint {
	font-size: 0.95rem;
	opacity: 0.85;
}

.card {
	background: white;
	border-radius: 1rem;
	box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
	padding: 0.5rem 0.5rem 0.75rem;
	margin-bottom: 2rem;
}

.table-wrap {
	overflow-x: auto;
}

table {
	width: 100%;
	border-collapse: collapse;
	font-size: 0.95rem;
}

thead th {
	font-size: 0.7rem;
	font-weight: 700;
	text-transform: uppercase;
	letter-spacing: 0.05em;
	color: var(--violeta1);
	opacity: 0.7;
	padding: 0.7rem 0.75rem;
	text-align: right;
	white-space: nowrap;
}

thead .th-plan {
	text-align: left;
}

tbody th {
	text-align: left;
	font-weight: 600;
	color: #333;
}

tbody th,
tbody td {
	padding: 0.6rem 0.75rem;
	border-top: 1px solid #f0f0f0;
}

tbody td {
	text-align: right;
	white-space: nowrap;
	font-variant-numeric: tabular-nums;
	color: var(--violeta1);
}

tbody td:last-child {
	font-weight: 700;
}

/* Los packs son sub-items del servicio de arriba: en el Excel eso se ve como
   sangria y aca se mantiene. */
tr.sub th {
	padding-left: 2rem;
	font-weight: 500;
	color: #666;
}

.version {
	margin: 0.75rem 0.75rem 0;
	text-align: right;
	font-size: 0.75rem;
	color: #aaa;
}
</style>
```

- [ ] **Step 6: Verificar en el navegador**

Con el dev server levantado, ir a `/tarifas`. Comparar contra
`https://sista.com.ar/tarifas/`: mismas 28 filas, mismo orden, mismos valores.
Verificar que “Básico + Cine”, los tres Pack Fútbol, PARAMOUNT y UNIVERSAL
aparecen indentados, y que la vigencia se lee `01/08/2026`. Sacar un screenshot
y revisar la consola.

- [ ] **Step 7: Commit**

```bash
git add src/lib/tarifario/formato.js src/lib/tarifario/formato.test.js src/routes/tarifas/
git commit -m "feat(tarifario): pagina /tarifas generada desde el Excel"
```

---

### Task 11: `/telefonia` desde el tarifario

**Files:**
- Modify: `src/routes/telefonia/+page.svelte`

- [ ] **Step 1: Cambiar la fuente y el formateo**

En `src/routes/telefonia/+page.svelte`, reemplazar el bloque `<script>` desde el
import de `fetchLineaVipPrecios` hasta el final de `formatPrecio`:

```js
import { fetchTarifario } from '$lib/tarifario/fetchTarifario.js';
import { formatearFecha } from '$lib/tarifario/formato.js';

/** @type {import('$lib/tarifario/parseTarifario.js').LineaVip | null} */
let data = $state(null);
let loading = $state(true);
let error = $state(null);

onMount(async () => {
	try {
		data = (await fetchTarifario()).lineaVip;
	} catch (e) {
		error = e instanceof Error ? e.message : 'Error al cargar los precios.';
		console.error('Linea VIP precios:', e);
	} finally {
		loading = false;
	}
});

const vigencia = $derived(formatearFecha(data?.vigencia));

/**
 * Precio en pesos, estilo local: miles con punto y decimales con coma.
 *
 * Antes el simbolo venia pegado al dato ("$ 9 588"), porque el valor salia de
 * scrapear el HTML que exportaba Word. Ahora el tarifario guarda numeros y el
 * simbolo lo pone la pagina.
 *
 * @param {number | null | undefined} valor
 * @param {number} [decimales]
 */
function formatPrecio(valor, decimales = 0) {
	if (typeof valor !== 'number' || !Number.isFinite(valor)) return '—';
	const [entera, decimal] = valor.toFixed(decimales).split('.');
	const miles = entera.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
	return `$ ${decimal ? `${miles},${decimal}` : miles}`;
}
```

`displayFootnotes` queda igual.

- [ ] **Step 2: Ajustar el markup**

En el mismo archivo:

- La lista de planes cambió de nombre al venir del tarifario. Reemplazar

  ```svelte
  {@const plan = data.plans.find((p) => /221/i.test(p.nombre) && /fibra/i.test(p.clientes)) ?? data.plans[0]}
  ```

  por

  ```svelte
  {@const plan = data.planes.find((p) => /221/i.test(p.nombre) && /fibra/i.test(p.clientes)) ?? data.planes[0]}
  ```

  El `find` sigue resolviendo a "Linea VIP 221" / Fibra, que es el plan que esta
  página muestra. Antes el parser filtraba los planes de Radio antes de que
  llegaran acá; ahora llegan los cuatro y el `find` es el que elige.

- Vigencia: `{#if data?.vigencia}` → `{#if vigencia}` y
  `Precios vigentes desde el {data.vigencia}` → `Precios vigentes desde el {vigencia}`.
- Notas: `{#each displayFootnotes(data.footnotes) as note}` →
  `{#each displayFootnotes(data.notas) as note}`.
- Precios por minuto, que llevan dos decimales:
  - `{formatPrecio(plan.llamadasCelulares)}` → `{formatPrecio(plan.llamadasCelulares, 2)}`
  - `{formatPrecio(plan.excedenteLocal)}` → `{formatPrecio(plan.excedenteLocal, 2)}`
  - `{formatPrecio(plan.excedenteNacional)}` → `{formatPrecio(plan.excedenteNacional, 2)}`

`{formatPrecio(plan.abonoMensual)}` y `{plan.minutosLocales}` quedan igual.

- [ ] **Step 3: Verificar en el navegador**

Ir a `/telefonia`. Comparar contra la versión anterior: abono `$ 9.972`, 500
minutos, celulares `$ 140,96`, excedente local `$ 25,03`, nacional `$ 29,27`, y
las mismas notas al pie. Revisar la consola.

- [ ] **Step 4: Commit**

```bash
git add src/routes/telefonia/+page.svelte
git commit -m "feat(tarifario): /telefonia lee del tarifario importado"
```

---

### Task 12: `/telefonia/internacional` desde el tarifario

**Files:**
- Modify: `src/routes/telefonia/internacional/+page.svelte`

- [ ] **Step 1: Cambiar la fuente y el formateo**

En `src/routes/telefonia/internacional/+page.svelte`, reemplazar el import de
`fetchInternacionalPrecios`, el `onMount` y `formatUSD`:

```js
import { fetchTarifario } from '$lib/tarifario/fetchTarifario.js';
import { formatearFecha } from '$lib/tarifario/formato.js';

/** @type {import('$lib/tarifario/parseTarifario.js').Internacional | null} */
let data = $state(null);
let loading = $state(true);
let error = $state(null);
let query = $state('');

onMount(async () => {
	try {
		data = (await fetchTarifario()).internacional;
	} catch (e) {
		error = e instanceof Error ? e.message : 'Error al cargar las tarifas.';
		console.error('Tarifas internacionales:', e);
	} finally {
		loading = false;
	}
});

/**
 * Precio por minuto en dolares, con coma decimal. El simbolo lo pone la pagina:
 * el tarifario guarda numeros, no el "U$S 0.5" que traia el scrapeo del Word.
 *
 * @param {number | null} valor
 */
function formatUSD(valor) {
	if (typeof valor !== 'number' || !Number.isFinite(valor)) return '—';
	return `U$S ${String(valor).replace('.', ',')}`;
}
```

`destinos` y `filtered` quedan igual. Agregar, junto a ellos:

```js
const vigencia = $derived(formatearFecha(data?.vigencia));
```

En el markup, la vigencia (que es la propia de Internacional, `2026-06-01`, y no
la general): `{#if data?.vigencia}` → `{#if vigencia}`, y
`Vigente desde el {data.vigencia}` → `Vigente desde el {vigencia}`.

- [ ] **Step 2: Verificar en el navegador**

Ir a `/telefonia/internacional`. Verificar 346 destinos, que el buscador filtra
(probar "espa"), y que los precios se ven `U$S 0,1` / `U$S 0,5`. Con
`read_network_requests`, confirmar que ya no se baja el HTML de 14,5 MB.

- [ ] **Step 3: Commit**

```bash
git add src/routes/telefonia/internacional/+page.svelte
git commit -m "feat(tarifario): /telefonia/internacional lee del tarifario importado"
```

---

### Task 13: Retirar el scrapeo del sitio viejo

Solo después de verificar las tareas 11 y 12 en el navegador.

**Files:**
- Delete: `src/lib/telefonia/` (los 6 archivos)
- Modify: `vite.config.js`

- [ ] **Step 1: Confirmar que no queda nada apuntando ahí**

```bash
grep -rn "lib/telefonia\|fetchLineaVip\|fetchInternacional\|parseLineaVip\|parseInternacional" src/ vite.config.js
```

Expected: sin resultados. Si aparece alguno, arreglarlo antes de seguir.

- [ ] **Step 2: Borrar los módulos viejos**

```bash
git rm -r src/lib/telefonia
```

- [ ] **Step 3: Sacar el proxy de Vite**

En `vite.config.js`, borrar el bloque `server` completo (existía solo para
proxear `/lineavip` e `/internacional` a `sista.com.ar` en desarrollo):

```js
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}', 'scripts/**/*.{test,spec}.{js,ts}'],
		environment: 'node',
		// Los tests de fechas de la Cartera afirman resultados concretos ("el
		// 1/7 a las 01:00 UTC se muestra como 30/6 22:00"). Sin fijar la zona,
		// pasan en las maquinas del equipo y fallan en cualquier CI que corra
		// en UTC.
		env: { TZ: 'America/Argentina/Buenos_Aires' }
	}
});
```

- [ ] **Step 4: Correr toda la suite**

Run: `npm test`
Expected: PASS. Los tests de `parseLineaVip`/`parseInternacional` ya no existen;
los de `src/lib/tarifario/` los reemplazan.

- [ ] **Step 5: Verificar el build**

Run: `npm run build`
Expected: build exitoso, sin warnings de imports rotos.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore(tarifario): retirar el scrapeo de sista.com.ar y su proxy"
```

---

## Verificación final

- [ ] `npm test` — toda la suite en verde
- [ ] `npm run build` — sin errores
- [ ] `/tarifas` coincide fila por fila con `https://sista.com.ar/tarifas/`
- [ ] `/telefonia` y `/telefonia/internacional` se ven igual que antes del cambio
- [ ] `/precios`, el nav y el dropzone de imagen siguen funcionando como estaban
- [ ] Las páginas de planes y el wizard de TV toman los precios nuevos
