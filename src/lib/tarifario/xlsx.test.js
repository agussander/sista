import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { leerCeldas, leerLibro, serialAFecha } from './xlsx.js';

const FIXTURE = new URL('./__fixtures__/tarifario-26.081.xlsx', import.meta.url);

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
