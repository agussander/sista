import { describe, expect, it } from 'vitest';
import { decodeLineaVipHtml, parseLineaVipHtml } from './parseLineaVip.js';

const SAMPLE_ROW = `
<tr>
  <td></td>
  <td>Linea VIP R11</td>
  <td>Radio</td>
  <td>AMBA 011</td>
  <td>$ 800</td>
  <td>$ 17 728</td>
  <td>500</td>
  <td>$ 82.92</td>
  <td>$ 20.86</td>
  <td>$ 28.69</td>
</tr>
<tr>
  <td></td>
  <td>Linea VIP R221</td>
  <td>Radio</td>
  <td>LP 0221</td>
  <td>$ 800</td>
  <td>$ 9 588</td>
  <td>500</td>
  <td>$ 20.86</td>
</tr>
<tr>
  <td></td>
  <td>Linea VIP 11</td>
  <td>Fibra</td>
  <td>AMBA 011</td>
  <td>--</td>
  <td>$ 17 728</td>
  <td>500</td>
  <td>$ 82.92</td>
  <td>$ 20.86</td>
  <td>$ 28.69</td>
</tr>
<tr>
  <td></td>
  <td>Linea VIP 221</td>
  <td>Fibra</td>
  <td>LP 0221</td>
  <td>--</td>
  <td>$ 9 588</td>
  <td>500</td>
  <td>$ 20.86</td>
</tr>
<tr>
  <td colspan="8">El precio de las llamadas internacionales se expresa en U$S según el Cuadro Tarifario Internacional vigente</td>
</tr>
<tr>
  <td colspan="3"><a href="http://www.sista.ar/internacional">www.sista.ar/internacional</a></td>
</tr>
<tr>
  <td colspan="8">Incluye IVA, del 21 %</td>
</tr>
`;

describe('parseLineaVipHtml', () => {
	it('parses plan rows, omits Radio plans and normalizes numero local', () => {
		const html = `<table><tr><td></td><td style="color:red">01/07/2026</td></tr>${SAMPLE_ROW}</table>`;
		const data = parseLineaVipHtml(html);

		expect(data.vigencia).toBe('01/07/2026');
		expect(data.plans).toHaveLength(2);
		expect(data.plans[0]).toMatchObject({
			nombre: 'Linea VIP 11',
			clientes: 'Fibra',
			numeroLocal: '011',
			llamadasCelulares: '$ 82.92',
			excedenteNacional: '$ 28.69'
		});
		expect(data.plans[1]).toMatchObject({
			nombre: 'Linea VIP 221',
			clientes: 'Fibra',
			numeroLocal: '0221',
			llamadasCelulares: '$ 82.92',
			excedenteNacional: '$ 28.69',
			excedenteLocal: '$ 20.86'
		});
		expect(data.linkInternacional).toBe('http://www.sista.ar/internacional');
		expect(data.footnotes.some((n) => /IVA/i.test(n))).toBe(true);
	});
});

describe('decodeLineaVipHtml', () => {
	it('decodes UTF-16 LE with BOM', () => {
		const text = '<html>Linea VIP</html>';
		const encoded = Buffer.from(text, 'utf16le');
		const withBom = new Uint8Array([0xff, 0xfe, ...encoded]);
		expect(decodeLineaVipHtml(withBom.buffer)).toContain('Linea VIP');
	});
});
