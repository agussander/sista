/** @typedef {{
 *   nombre: string;
 *   clientes: string;
 *   numeroLocal: string;
 *   cargoInicial: string;
 *   abonoMensual: string;
 *   minutosLocales: string;
 *   llamadasCelulares: string | null;
 *   excedenteLocal: string;
 *   excedenteNacional: string | null;
 * }} LineaVipPlan */

/** @typedef {{
 *   vigencia: string | null;
 *   plans: LineaVipPlan[];
 *   aparatoTelefonico: string | null;
 *   linkInternacional: string | null;
 *   footnotes: string[];
 * }} LineaVipData */

/**
 * Decodifica el HTML de /lineavip (Word exporta UTF-16 LE con BOM).
 * @param {ArrayBuffer} buffer
 */
export function decodeLineaVipHtml(buffer) {
	const bytes = new Uint8Array(buffer);
	if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
		return new TextDecoder('utf-16le').decode(buffer);
	}
	return new TextDecoder('utf-8').decode(buffer);
}

/** @param {string} fragment */
function stripHtml(fragment) {
	return fragment
		.replace(/<[^>]+>/g, ' ')
		.replace(/&nbsp;/gi, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

/** @param {string} value */
function normalizeNumeroLocal(value) {
	return value.replace(/^(?:LP|AMBA)\s+/i, '').trim();
}

/** @param {string} html */
export function parseLineaVipHtml(html) {
	/** @type {string | null} */
	let vigencia = null;
	const vigenciaMatch = html.match(/color:\s*red[^>]*>([^<]+)/i);
	if (vigenciaMatch) vigencia = stripHtml(vigenciaMatch[1]);

	/** @type {LineaVipPlan[]} */
	const plans = [];
	const shared = { llamadasCelulares: null, excedenteNacional: null };

	const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
	for (const row of rows) {
		const rawCells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) =>
			stripHtml(m[1])
		);

		const start = rawCells.findIndex((cell) => /^Linea VIP/i.test(cell));
		if (start === -1) continue;

		const cells = rawCells.slice(start);

		/** @type {LineaVipPlan} */
		const plan = {
			nombre: cells[0],
			clientes: cells[1] ?? '',
			numeroLocal: normalizeNumeroLocal(cells[2] ?? ''),
			cargoInicial: cells[3] ?? '',
			abonoMensual: cells[4] ?? '',
			minutosLocales: cells[5] ?? '',
			llamadasCelulares: null,
			excedenteLocal: '',
			excedenteNacional: null
		};

		if (cells.length >= 9) {
			shared.llamadasCelulares = cells[6];
			shared.excedenteNacional = cells[8];
			plan.llamadasCelulares = cells[6];
			plan.excedenteLocal = cells[7];
			plan.excedenteNacional = cells[8];
		} else {
			plan.llamadasCelulares = shared.llamadasCelulares;
			plan.excedenteLocal = cells[6] ?? '';
			plan.excedenteNacional = shared.excedenteNacional;
		}

		plans.push(plan);
	}

	const filteredPlans = plans.filter((plan) => !/^Radio$/i.test(plan.clientes));

	/** @type {string[]} */
	const footnotes = [];
	let aparatoTelefonico = null;
	let linkInternacional = null;

	for (const row of rows) {
		const text = stripHtml(row[1]);
		if (!text) continue;

		if (/^Aparato telefon/i.test(text)) {
			aparatoTelefonico = text.replace(/\s+/g, ' ').trim();
			continue;
		}

		const hrefMatch = row[1].match(/href="([^"]+)"/i);
		if (hrefMatch && /internacional/i.test(hrefMatch[1])) {
			linkInternacional = hrefMatch[1];
		}

		if (
			/internacional|Valores en Pesos|Incluye IVA|abonado de fibra|abonado de ATA/i.test(text)
		) {
			if (!/^www\./i.test(text)) {
				footnotes.push(text);
			}
		}
	}

	return {
		vigencia,
		plans: filteredPlans,
		aparatoTelefonico,
		linkInternacional,
		footnotes
	};
}
