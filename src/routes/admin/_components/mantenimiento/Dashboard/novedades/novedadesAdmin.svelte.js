/**
 * Estado y escrituras de la seccion Novedades del panel.
 *
 * Separado de la vista, como `carteraStore.svelte.js` y
 * `llamenmeStore.svelte.js`: el componente dibuja, este modulo habla con
 * PocketBase.
 *
 * Lista TODAS las novedades, incluidos los borradores: la List rule de la
 * coleccion (`publicada = true || @request.auth.id != ""`) le muestra todo a
 * un usuario logueado.
 */
import { pb } from '$lib/pocketbase';
import { ordenarNovedades, slugUnico } from '$lib/novedades.js';

const COLECCION = 'novedades';

let novedades = $state([]);
let cargando = $state(true);
let error = $state('');
let guardando = $state(false);

function mensajeDeError(err) {
	if (err?.status === 401 || err?.status === 403) {
		return 'Tu sesión expiró o no tenés permiso. Volvé a iniciar sesión.';
	}
	// `slugUnico` solo deduplica contra la lista que tiene cargada el navegador,
	// asi que si otra persona cargo el mismo titulo mientras tanto, el indice
	// unico de PocketBase rechaza el alta. El motivo real viene en
	// `err.data.data.slug`; `err.message` a secas dice "Failed to create
	// record.", que no le explica a nadie que tiene que cambiar el titulo.
	if (err?.status === 400 && err?.data?.data?.slug) {
		return 'Ya existe una novedad con un título muy parecido. Cambiá el título e intentá de nuevo.';
	}
	return err?.message || 'No pudimos completar la operación.';
}

async function cargar() {
	cargando = true;
	error = '';
	try {
		const items = await pb.collection(COLECCION).getFullList();
		novedades = ordenarNovedades(items);
	} catch (err) {
		console.error('[novedades] error al cargar:', err);
		error = mensajeDeError(err);
	} finally {
		cargando = false;
	}
}

/**
 * Arma el FormData del registro. Va como FormData y no como objeto porque la
 * imagen es un archivo.
 *
 * Si no eligieron imagen nueva, el campo no se manda: mandarlo vacio en una
 * edicion le borraria la foto a la novedad.
 */
function aFormData(datos, slug) {
	const fd = new FormData();
	fd.append('titulo', datos.titulo.trim());
	fd.append('fecha', datos.fecha);
	fd.append('bajada', datos.bajada.trim());
	fd.append('cuerpo', datos.cuerpo);
	fd.append('publicada', datos.publicada ? 'true' : 'false');
	fd.append('destacada', datos.destacada ? 'true' : 'false');
	if (slug) fd.append('slug', slug);
	if (datos.imagen instanceof File) fd.append('imagen', datos.imagen);
	return fd;
}

/**
 * Crea una novedad. El slug se calcula contra los slugs ya cargados: el campo
 * tiene indice unico en PocketBase y dos titulos iguales chocarian.
 * @returns {Promise<boolean>} si se guardo
 */
async function crear(datos) {
	guardando = true;
	error = '';
	try {
		const slug = slugUnico(datos.titulo, novedades.map((n) => n.slug));
		const record = await pb.collection(COLECCION).create(aFormData(datos, slug));
		novedades = ordenarNovedades([record, ...novedades]);
		return true;
	} catch (err) {
		console.error('[novedades] error al crear:', err);
		error = mensajeDeError(err);
		return false;
	} finally {
		guardando = false;
	}
}

/**
 * Edita una novedad. El slug NO se toca aunque cambie el titulo: cambiarlo
 * rompe los links de esa novedad que ya se compartieron.
 * @returns {Promise<boolean>} si se guardo
 */
async function actualizar(id, datos) {
	guardando = true;
	error = '';
	try {
		const record = await pb.collection(COLECCION).update(id, aFormData(datos, null));
		novedades = ordenarNovedades(novedades.map((n) => (n.id === id ? record : n)));
		return true;
	} catch (err) {
		console.error('[novedades] error al actualizar:', err);
		error = mensajeDeError(err);
		return false;
	} finally {
		guardando = false;
	}
}

/**
 * Borra una novedad.
 *
 * Marca `guardando` igual que `crear` y `actualizar` para que la vista pueda
 * desactivar el boton: sin eso, un doble clic manda dos DELETE, el segundo
 * vuelve 404 y la persona ve un error aunque el borrado haya salido bien.
 *
 * @returns {Promise<boolean>} si se borro
 */
async function eliminar(id) {
	guardando = true;
	error = '';
	try {
		await pb.collection(COLECCION).delete(id);
		novedades = novedades.filter((n) => n.id !== id);
		return true;
	} catch (err) {
		console.error('[novedades] error al eliminar:', err);
		error = mensajeDeError(err);
		return false;
	} finally {
		guardando = false;
	}
}

/** URL de la imagen de un registro, para la miniatura de la lista. */
function urlImagen(record, thumb = '300x200') {
	if (!record?.imagen) return null;
	return pb.files.getURL(record, record.imagen, { thumb });
}

/**
 * Borra el error a mano. `cargar`, `crear`, `actualizar` y `eliminar` ya lo
 * limpian al EMPEZAR, pero nada lo limpiaba al salir de un estado con error:
 * `error` es un string compartido por las cuatro operaciones, asi que el
 * error de una escritura fallida le quedaba pegado a cualquier vista que se
 * abriera despues (la lista, un formulario nuevo) hasta la proxima llamada al
 * store. La vista la llama en las transiciones donde eso importa.
 */
function limpiarError() {
	error = '';
}

export const novedadesAdmin = {
	get novedades() {
		return novedades;
	},
	get cargando() {
		return cargando;
	},
	get error() {
		return error;
	},
	get guardando() {
		return guardando;
	},
	cargar,
	crear,
	actualizar,
	eliminar,
	urlImagen,
	limpiarError
};
