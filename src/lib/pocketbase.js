import PocketBase from 'pocketbase';

const url = typeof import.meta !== 'undefined' && import.meta.env?.VITE_POCKETBASE_URL
	? import.meta.env.VITE_POCKETBASE_URL
	: 'https://sista.pockethost.io';

export const pb = new PocketBase(url);

/**
 * Devuelve la URL de un archivo de PocketBase pidiendo una miniatura
 * redimensionada en el servidor (más liviana y cacheada que el original).
 *
 * @param {object} record   Registro de PocketBase
 * @param {string} fileName Nombre del archivo dentro del registro
 * @param {string} [thumb]  Tamaño p.ej. '1024x0' (ancho 1024, alto proporcional)
 */
export function getImageUrl(record, fileName, thumb) {
	if (!record || !fileName) return null;
	return pb.files.getURL(record, fileName, thumb ? { thumb } : {});
}
