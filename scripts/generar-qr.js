/**
 * Genera el PNG del QR de un cliente para la plataforma de puntos.
 *
 * One-off: no es parte de ningun build. Se corre a mano.
 *
 * Uso:
 *   node scripts/generar-qr.js 003566
 *   node scripts/generar-qr.js 003566 http://192.168.1.132:3100
 */
import { mkdir } from 'node:fs/promises';
import QRCode from 'qrcode';

const BASE_POR_DEFECTO = 'https://ghostwhite-okapi-714606.hostingersite.com';

const [, , nro, base = BASE_POR_DEFECTO] = process.argv;

if (!nro || !/^\d{1,12}$/.test(nro)) {
	console.error('Uso: node scripts/generar-qr.js <nro-cliente> [base-url]');
	console.error('El numero va con sus ceros: 003566, no 3566.');
	process.exit(1);
}

// La barra final NO es opcional: `src/routes/+layout.js` fija
// `trailingSlash: 'always'`, asi que sin ella cada escaneo se come un 308.
const url = `${base.replace(/\/+$/, '')}/puntos/${nro}/`;
const salida = `qr/qr-${nro}.png`;

await mkdir('qr', { recursive: true });
await QRCode.toFile(salida, url, { width: 800, margin: 2, errorCorrectionLevel: 'M' });

console.log(`QR generado: ${salida}`);
console.log(`URL codificada: ${url}`);
