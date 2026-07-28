import { decodeLineaVipHtml, parseLineaVipHtml } from './parseLineaVip.js';

const LINEAVIP_PATH = '/lineavip/';

/** @returns {Promise<import('./parseLineaVip.js').LineaVipData>} */
export async function fetchLineaVipPrecios() {
	const res = await fetch(LINEAVIP_PATH, { cache: 'no-store' });
	if (!res.ok) {
		throw new Error(`No se pudo cargar ${LINEAVIP_PATH} (${res.status})`);
	}

	const html = decodeLineaVipHtml(await res.arrayBuffer());
	const data = parseLineaVipHtml(html);

	if (!data.plans.length) {
		throw new Error('La tabla de precios de Línea VIP no tiene planes.');
	}

	return data;
}
