import { describe, it, expect, beforeEach } from 'vitest';
import { escribirLote, reiniciarDeteccionDeLote } from './pbLote.js';

/**
 * Un `pb` falso. `batch` decide que hace `send()`: devolver resultados o
 * tirar un error. `sueltas` registra las escrituras una-por-una.
 */
function pbFalso({ batchSend, updateSuelta } = {}) {
	const registro = { opsDelLote: [], sueltas: [], lotesEnviados: 0 };

	const pb = {
		createBatch() {
			const ops = [];
			const sub = {
				create: (datos) => ops.push({ accion: 'create', datos }),
				update: (id, datos) => ops.push({ accion: 'update', id, datos })
			};
			return {
				collection: () => sub,
				send: async () => {
					registro.lotesEnviados++;
					registro.opsDelLote.push(ops);
					if (!batchSend) throw Object.assign(new Error('sin batch'), { status: 400 });
					return batchSend(ops);
				}
			};
		},
		collection: () => ({
			create: async (datos) => {
				registro.sueltas.push({ accion: 'create', datos });
				return { id: 'nuevo', ...datos };
			},
			update: async (id, datos) => {
				registro.sueltas.push({ accion: 'update', id, datos });
				if (updateSuelta) return updateSuelta(id, datos);
				return { id, ...datos };
			}
		})
	};

	return { pb, registro };
}

const ops = (n) =>
	Array.from({ length: n }, (_, i) => ({
		coleccion: 'cartera_clientes',
		accion: 'update',
		id: `rec${i}`,
		datos: { nombre: `N${i}` }
	}));

describe('escribirLote', () => {
	beforeEach(() => reiniciarDeteccionDeLote());

	it('manda un solo lote y devuelve los registros', async () => {
		const { pb, registro } = pbFalso({
			batchSend: (o) => o.map((x) => ({ status: 200, body: { id: x.id, ...x.datos } }))
		});

		const r = await escribirLote(pb, ops(3));

		expect(registro.lotesEnviados).toBe(1);
		expect(registro.sueltas).toHaveLength(0);
		expect(r).toEqual([
			{ ok: true, record: { id: 'rec0', nombre: 'N0' } },
			{ ok: true, record: { id: 'rec1', nombre: 'N1' } },
			{ ok: true, record: { id: 'rec2', nombre: 'N2' } }
		]);
	});

	it('parte en trozos de 20', async () => {
		const { pb, registro } = pbFalso({
			batchSend: (o) => o.map((x) => ({ status: 200, body: { id: x.id } }))
		});

		const r = await escribirLote(pb, ops(45));

		expect(registro.lotesEnviados).toBe(3);
		expect(registro.opsDelLote.map((o) => o.length)).toEqual([20, 20, 5]);
		expect(r).toHaveLength(45);
	});

	it('si el lote falla, reescribe una por una', async () => {
		const { pb, registro } = pbFalso();

		const r = await escribirLote(pb, ops(3));

		expect(registro.lotesEnviados).toBe(1);
		expect(registro.sueltas).toHaveLength(3);
		expect(r.every((x) => x.ok)).toBe(true);
	});

	it('una escritura suelta que falla no tumba a las demas', async () => {
		const { pb } = pbFalso({
			updateSuelta: (id) => {
				if (id === 'rec1') throw Object.assign(new Error('regla'), { status: 403 });
				return { id };
			}
		});

		const r = await escribirLote(pb, ops(3));

		expect(r[0].ok).toBe(true);
		expect(r[1].ok).toBe(false);
		expect(r[1].operacion.id).toBe('rec1');
		expect(r[2].ok).toBe(true);
	});

	it('con la Batch API apagada no reintenta el lote en la misma sesion', async () => {
		const { pb, registro } = pbFalso({
			batchSend: () => {
				throw Object.assign(new Error('Batch requests are not allowed.'), { status: 403 });
			}
		});

		await escribirLote(pb, ops(2));
		await escribirLote(pb, ops(2));

		expect(registro.lotesEnviados).toBe(1);
		expect(registro.sueltas).toHaveLength(4);
	});

	it('un fallo que no es 403 si deja reintentar el lote despues', async () => {
		const { pb, registro } = pbFalso();

		await escribirLote(pb, ops(1));
		await escribirLote(pb, ops(1));

		expect(registro.lotesEnviados).toBe(2);
	});

	it('con la lista vacia no toca PocketBase', async () => {
		const { pb, registro } = pbFalso();

		const r = await escribirLote(pb, []);

		expect(r).toEqual([]);
		expect(registro.lotesEnviados).toBe(0);
		expect(registro.sueltas).toHaveLength(0);
	});

	it('arma creates y updates en el mismo lote', async () => {
		const { pb, registro } = pbFalso({
			batchSend: (o) => o.map(() => ({ status: 200, body: {} }))
		});

		await escribirLote(pb, [
			{ coleccion: 'cartera_clientes', accion: 'create', datos: { code: '9' } },
			{ coleccion: 'cartera_clientes', accion: 'update', id: 'rec0', datos: { nombre: 'X' } }
		]);

		expect(registro.opsDelLote[0]).toEqual([
			{ accion: 'create', datos: { code: '9' } },
			{ accion: 'update', id: 'rec0', datos: { nombre: 'X' } }
		]);
	});

	// Los tres que siguen cubren el caso "el lote SE ESCRIBIO pero la respuesta
	// no es la esperada". Es el unico lugar donde se puede perder informacion
	// en silencio, porque reintentar ya no es una opcion: lo que se mando ya
	// esta guardado.

	it('un sub-request con status de error no se da por bueno', async () => {
		const { pb, registro } = pbFalso({
			batchSend: (o) => [
				{ status: 200, body: { id: o[0].id } },
				{ status: 400, body: { message: 'validacion' } },
				{ status: 200, body: { id: o[2].id } }
			]
		});

		const r = await escribirLote(pb, ops(3));

		expect(r[0].ok).toBe(true);
		expect(r[1].ok).toBe(false);
		expect(r[1].operacion.id).toBe('rec1');
		expect(r[2].ok).toBe(true);
		// No se reescribe: el lote ya entro, reintentar duplicaria.
		expect(registro.sueltas).toHaveLength(0);
	});

	it('si vuelven menos resultados que operaciones, falla en vez de reescribir', async () => {
		const { pb, registro } = pbFalso({
			batchSend: (o) => [{ status: 200, body: { id: o[0].id } }]
		});

		await expect(escribirLote(pb, ops(3))).rejects.toThrow(/no se puede interpretar/);
		expect(registro.sueltas).toHaveLength(0);
	});

	it('si la respuesta no es un array, falla en vez de reescribir', async () => {
		const { pb, registro } = pbFalso({ batchSend: () => ({ mensaje: 'raro' }) });

		await expect(escribirLote(pb, ops(2))).rejects.toThrow(/no se puede interpretar/);
		expect(registro.sueltas).toHaveLength(0);
	});
});
