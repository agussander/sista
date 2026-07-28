import { decodeLineaVipHtml } from './parseLineaVip.js';
import { parseInternacionalHtml } from './parseInternacional.js';

const INTERNACIONAL_PATH = '/internacional/';

/** @returns {Promise<import('./parseInternacional.js').InternacionalData>} */
export async function fetchInternacionalPrecios() {
	const res = await fetch(INTERNACIONAL_PATH, { cache: 'no-store' });
	if (!res.ok) {
		throw new Error(`No se pudo cargar ${INTERNACIONAL_PATH} (${res.status})`);
	}

	const html = decodeLineaVipHtml(await res.arrayBuffer());
	const data = parseInternacionalHtml(html);

	if (!data.destinos.length) {
		throw new Error('La tabla de tarifas internacionales no tiene destinos.');
	}

	return data;
}
