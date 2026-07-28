import { describe, expect, it } from 'vitest';
import { parseInternacionalHtml } from './parseInternacional.js';

const SAMPLE = `
<table>
<tr><td></td><td>Precio del minuto de llamadas Internacionales</td></tr>
<tr><td></td><td></td><td></td><td>Vigencia a partir del:</td><td>01/06/2026</td></tr>
<tr><td></td><td>Prefijo</td><td>Destino</td><td>Fijo / Móvil</td><td>Precio [U$S]</td></tr>
<tr><td></td><td>0034</td><td>ESPANA</td><td>Fijo</td><td>U$S 0.1</td></tr>
<tr><td></td><td>00346</td><td>ESPANA</td><td>Movil</td><td>U$S 0.5</td></tr>
<tr><td></td><td>001907</td><td>ALASKA</td><td>Fijo</td><td>U$S 0.1</td></tr>
<tr><td></td><td>001907209</td><td>ALASKA</td><td>Movil</td><td>U$S 0.1</td></tr>
<tr><td></td><td>001</td><td>ESTADOS UNIDOS</td><td>Fijo</td><td>U$S 0.1</td></tr>
</table>
`;

describe('parseInternacionalHtml', () => {
	it('extrae la vigencia y agrupa por destino con precio fijo/móvil', () => {
		const data = parseInternacionalHtml(SAMPLE);

		expect(data.vigencia).toBe('01/06/2026');
		expect(data.unidad).toBe('U$S');
		expect(data.destinos).toHaveLength(3);

		expect(data.destinos[0]).toEqual({ destino: 'ESPANA', fijo: 'U$S 0.1', movil: 'U$S 0.5' });
		expect(data.destinos[1]).toEqual({ destino: 'ALASKA', fijo: 'U$S 0.1', movil: 'U$S 0.1' });
		expect(data.destinos[2]).toEqual({
			destino: 'ESTADOS UNIDOS',
			fijo: 'U$S 0.1',
			movil: null
		});
	});

	it('ignora el encabezado de la tabla', () => {
		const data = parseInternacionalHtml(SAMPLE);
		expect(data.destinos.some((d) => /Destino/i.test(d.destino))).toBe(false);
	});
});
