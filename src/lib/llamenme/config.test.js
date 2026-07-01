import { describe, it, expect, vi } from 'vitest';
import { fetchOverride, saveOverride } from './config.js';

describe('fetchOverride', () => {
	it('devuelve el estado guardado', async () => {
		const pb = {
			collection: () => ({
				getFirstListItem: vi.fn().mockResolvedValue({ id: '1', values: { state: 'abierto' } })
			})
		};
		expect(await fetchOverride(pb)).toBe('abierto');
	});

	it('normaliza un estado inválido a "auto"', async () => {
		const pb = {
			collection: () => ({
				getFirstListItem: vi.fn().mockResolvedValue({ id: '1', values: { state: 'lo-que-sea' } })
			})
		};
		expect(await fetchOverride(pb)).toBe('auto');
	});

	it('hace fail-open a "auto" si la colección falla', async () => {
		const pb = {
			collection: () => ({
				getFirstListItem: vi.fn().mockRejectedValue(new Error('no existe'))
			})
		};
		expect(await fetchOverride(pb)).toBe('auto');
	});
});

describe('saveOverride', () => {
	it('guarda el nuevo estado preservando otras claves de values', async () => {
		const update = vi.fn().mockImplementation((id, data) => Promise.resolve({ id, ...data }));
		const pb = {
			collection: () => ({
				getFirstListItem: vi.fn().mockResolvedValue({ id: '1', values: { state: 'auto', otraClave: 42 } }),
				update
			})
		};
		const result = await saveOverride(pb, 'cerrado');
		expect(result).toBe('cerrado');
		expect(update).toHaveBeenCalledWith('1', { values: { state: 'cerrado', otraClave: 42 } });
	});

	it('propaga el error si falla la actualización', async () => {
		const pb = {
			collection: () => ({
				getFirstListItem: vi.fn().mockResolvedValue({ id: '1', values: { state: 'auto' } }),
				update: vi.fn().mockRejectedValue(new Error('network'))
			})
		};
		await expect(saveOverride(pb, 'abierto')).rejects.toThrow('network');
	});
});
