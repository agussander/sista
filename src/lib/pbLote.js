/**
 * Escrituras agrupadas contra PocketBase, con degradacion.
 *
 * La Batch API de PocketBase manda N escrituras en UN request, que es el
 * motivo de existir de este modulo: la Cartera hacia 20 `update()` sueltos por
 * apertura y agotaba el limite de requests por IP de PocketHost.
 *
 * Pero el lote es TRANSACCIONAL: si una de las 20 escrituras falla, se
 * revierten las 20 y vuelve un error. El codigo que lo usa necesita lo
 * contrario -que una escritura rota no se lleve puestas a las demas-, asi que
 * ante cualquier fallo del lote se rehace la tanda una por una, que es
 * exactamente lo que se hacia antes.
 *
 * De ahi la propiedad importante: el lote es una optimizacion, nunca un
 * requisito. Si la Batch API esta apagada en el servidor (responde
 * `403 "Batch requests are not allowed."`, que es lo que responde hoy
 * sista.pockethost.io) todo sigue funcionando igual que siempre, solo que sin
 * el ahorro.
 */

/**
 * Tope de escrituras por lote. PocketBase topea el batch en 50 por defecto
 * (`maxRequests` en Settings); 20 deja margen sin dejar de servir para el caso
 * que importa, que son los 20 snapshots de `MAX_POR_APERTURA`.
 */
const MAX_POR_LOTE = 20;

/**
 * Si vale la pena intentar el lote. Se apaga al primer 403/404 y no se vuelve
 * a prender: significa que el servidor no tiene la Batch API disponible, y
 * reintentarla en cada apertura seria pagar un request de mas para nada.
 *
 * Es estado de modulo -o sea, por carga de pagina-. Si el toggle se prende en
 * PocketBase, alcanza con recargar.
 */
let loteDisponible = true;

/** Solo para tests: vuelve a habilitar el intento de lote. */
export function reiniciarDeteccionDeLote() {
	loteDisponible = true;
}

/**
 * @typedef {object} Operacion
 * @property {string} coleccion Nombre de la coleccion
 * @property {'create'|'update'} accion
 * @property {string} [id] Requerido para `update`
 * @property {Record<string, any>} datos
 */

/**
 * @typedef {{ok: true, record: any} | {ok: false, error: any, operacion: Operacion}} Resultado
 */

/**
 * Escribe todas las operaciones y devuelve un resultado por cada una, en el
 * mismo orden que entraron.
 *
 * @param {any} pb Cliente de PocketBase (se pasa, no se importa: ver el plan)
 * @param {Operacion[]} operaciones
 * @returns {Promise<Resultado[]>}
 */
export async function escribirLote(pb, operaciones) {
	/** @type {Resultado[]} */
	const resultados = [];

	for (let i = 0; i < operaciones.length; i += MAX_POR_LOTE) {
		const trozo = operaciones.slice(i, i + MAX_POR_LOTE);
		resultados.push(...(await escribirTrozo(pb, trozo)));
	}

	return resultados;
}

/**
 * @param {any} pb
 * @param {Operacion[]} trozo
 * @returns {Promise<Resultado[]>}
 */
async function escribirTrozo(pb, trozo) {
	if (loteDisponible) {
		try {
			const batch = pb.createBatch();
			for (const op of trozo) {
				const sub = batch.collection(op.coleccion);
				if (op.accion === 'create') sub.create(op.datos);
				else sub.update(op.id, op.datos);
			}

			const respuesta = await batch.send();
			return respuesta.map((r) => ({ ok: true, record: r.body }));
		} catch (e) {
			// 403: la Batch API esta apagada. 404: el servidor es anterior a
			// PocketBase 0.23 y no tiene /api/batch. Un 403 tambien puede ser una
			// regla de coleccion que rechazo una escritura puntual, y en ese caso
			// apagar el lote es de mas -pero es inofensivo: lo unico que pasa es
			// que la sesion escribe una por una, como antes de este modulo-.
			if (e?.status === 403 || e?.status === 404) loteDisponible = false;

			// Cualquier otro fallo tambien cae aca. El lote es transaccional, asi
			// que no se escribio nada: se rehace una por una para no perder las
			// que si habrian andado.
		}
	}

	return unaPorUna(pb, trozo);
}

/**
 * @param {any} pb
 * @param {Operacion[]} trozo
 * @returns {Promise<Resultado[]>}
 */
async function unaPorUna(pb, trozo) {
	/** @type {Resultado[]} */
	const resultados = [];

	for (const op of trozo) {
		try {
			const record =
				op.accion === 'create'
					? await pb.collection(op.coleccion).create(op.datos)
					: await pb.collection(op.coleccion).update(op.id, op.datos);
			resultados.push({ ok: true, record });
		} catch (error) {
			resultados.push({ ok: false, error, operacion: op });
		}
	}

	return resultados;
}
