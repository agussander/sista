import { describe, it, expect } from 'vitest';
import { RUTAS_INTERNAS, shouldTrack } from './tracking.js';

describe('RUTAS_INTERNAS', () => {
	it('lista las rutas de uso interno, sin barra final', () => {
		expect(RUTAS_INTERNAS).toEqual([
			'/admin',
			'/internacional',
			'/lineavip',
			'/mail-banner',
			'/tolosano'
		]);
	});
});

describe('shouldTrack', () => {
	it('trackea la home', () => {
		expect(shouldTrack('/')).toBe(true);
	});

	it('trackea las paginas publicas', () => {
		expect(shouldTrack('/tv')).toBe(true);
		expect(shouldTrack('/formasdepago/')).toBe(true);
		expect(shouldTrack('/solicitudbaja')).toBe(true);
		expect(shouldTrack('/conectarlaciudad/juegos')).toBe(true);
	});

	it('trackea /puntos, que es publica aunque no tenga nav', () => {
		expect(shouldTrack('/puntos')).toBe(true);
		expect(shouldTrack('/puntos/12345')).toBe(true);
	});

	it('no trackea las rutas internas', () => {
		expect(shouldTrack('/admin')).toBe(false);
		expect(shouldTrack('/mail-banner')).toBe(false);
		expect(shouldTrack('/tolosano')).toBe(false);
	});

	it('no trackea los cuadros tarifarios crudos', () => {
		// Se pasan por link a quien los pide; no tienen que llegar a Google.
		expect(shouldTrack('/lineavip')).toBe(false);
		expect(shouldTrack('/lineavip/')).toBe(false);
		expect(shouldTrack('/internacional')).toBe(false);
		expect(shouldTrack('/internacional/')).toBe(false);
	});

	it('trackea /telefonia/internacional, que si es publica', () => {
		// La version maquetada del cuadro internacional vive adentro de
		// /telefonia y no comparte prefijo con la ruta interna.
		expect(shouldTrack('/telefonia/internacional')).toBe(true);
	});

	it('no trackea las subrutas de una ruta interna', () => {
		expect(shouldTrack('/admin/cartera')).toBe(false);
		expect(shouldTrack('/tolosano/codigos')).toBe(false);
	});

	it('no trackea la ruta interna con barra final', () => {
		expect(shouldTrack('/admin/')).toBe(false);
	});

	it('trackea una ruta que solo comparte el prefijo de texto', () => {
		// El borde que importa: sin chequear el limite de segmento, `/admin`
		// tambien matchearia estas y las dejaria sin medir en silencio.
		expect(shouldTrack('/administracion')).toBe(true);
		expect(shouldTrack('/tolosano-fiestas')).toBe(true);
	});

	it('trackea cuando el path viene vacio o no es string', () => {
		// Ante la duda, una pagina publica: es el caso mucho mas comun.
		expect(shouldTrack('')).toBe(true);
		expect(shouldTrack(null)).toBe(true);
		expect(shouldTrack(undefined)).toBe(true);
		expect(shouldTrack(42)).toBe(true);
	});
});
