// Store con runes para la Cartera de clientes.
//
// La lista sale del snapshot en PocketBase (0 requests a IspCube). El refresco
// contra IspCube pasa por `/api/cartera/sync`, que devuelve datos frescos pero
// NO escribe: guardar es responsabilidad de este store, con el token del propio
// asesor, para que las reglas de la coleccion sigan siendo la unica
// autorizacion.
import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import { pb } from '$lib/pocketbase';
import { aRefrescar } from '$lib/cartera/refresco.js';
import { fusionarPagos } from '$lib/cartera/pagos.js';
import { alertasDe, proximoRecordatorio } from '$lib/cartera/alertas.js';
import { perfilDe } from '$lib/cartera/normalizar.js';
import { partesFecha } from '$lib/cartera/fechas.js';
import { CONFIG_DEFAULT, normalizarConfig } from '$lib/cartera/config.js';

const CLIENTES = 'cartera_clientes';
const NOTAS = 'cartera_notas';
const CONFIG = 'cartera_config';
const RECORDATORIOS = 'cartera_recordatorios';

// Mensajes de los dos codigos de error que devuelven todos los endpoints de
// /api/cartera: 401 (sesion invalida, no sabemos quien es) y 403 (sabemos
// quien es, no tiene el permiso "cartera"). Se centralizan aca porque
// `agregar` y `sincronizar` los necesitan por igual.
const ERROR_401 = 'Tu sesión expiró. Volvé a iniciar sesión.';
const ERROR_403 = 'No tenés permiso para usar la Cartera de clientes.';

let clientes = $state([]);
let config = $state({ ...CONFIG_DEFAULT });
let loading = $state(true);
let sincronizando = $state(false);
let error = $state('');

// Codigos cuyo ultimo intento de refresco contra IspCube fallo (fetch caido,
// 502, o ese code puntual con `ok: false` en la respuesta de /sync). Es la
// unica forma en que el detalle y la lista se enteran de un refresco fallido:
// antes esos casos solo llegaban a `console.error` y la pantalla se quedaba
// mostrando el snapshot viejo sin ningun aviso.
//
// `SvelteSet` y no `$state(new Set())`: el `$state` profundo de Svelte 5 alcanza
// a objetos y arrays, NO a Map/Set. Con un Set comun, `.add`/`.delete` no
// notifican a nadie y la vista se queda con el valor viejo.
const fallosRefresco = new SvelteSet();

// Se incrementa con cada anotacion guardada. Las notas no viven en el store
// (se piden por cliente al abrir el detalle), pero ahora no las escribe solo el
// formulario de anotaciones: tambien las escribe el chip de recordatorio, que
// es un componente hermano. Este contador es la senal para que la bitacora se
// recargue sin que un componente tenga que conocer al otro.
let notasVersion = $state(0);

// clienteId -> recordatorios pendientes (`hecho = false`), ordenados por fecha.
//
// Se traen de una sola vez para toda la cartera, no por cliente: la lista
// muestra hasta 500 filas y una consulta por fila seria inviable. Es el mismo
// motivo por el que `ultimo_contacto` esta desnormalizado, con la diferencia de
// que aca una sola consulta alcanza y no hace falta mantener una copia.
//
// `SvelteMap` por el mismo motivo que `fallosRefresco`: crear, completar o
// reprogramar un recordatorio son `.set`/`.delete` sobre una clave, y con un
// Map comun el chip del header seguia mostrando el recordatorio viejo.
const recordatorios = new SvelteMap();

// Codigos con un sync en vuelo ahora mismo. No es reactivo a proposito: solo
// lo lee `sincronizar` para no duplicar trabajo, ninguna vista lo muestra.
const codigosEnCurso = new Set();

/** Partes de la fecha de hoy, en hora local. */
function hoyPartes() {
	const d = new Date();
	return { anio: d.getFullYear(), mes: d.getMonth() + 1, dia: d.getDate() };
}

/**
 * Fecha de hoy como `YYYY-MM-DD`, sin pasar por toISOString (que es UTC).
 *
 * No se exporta: hoy por hoy solo lo usa `marcarContactado` para sellar
 * `ultimo_contacto`, y no depende de datos de IspCube (a diferencia de
 * `fechas.js`, que solo parsea fechas que vienen de la API). Si otra pantalla
 * llega a necesitar "hoy en YYYY-MM-DD", se exporta entonces.
 */
function hoyISO() {
	const { anio, mes, dia } = hoyPartes();
	return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

async function cargarConfig() {
	try {
		const lista = await pb.collection(CONFIG).getList(1, 1);
		// `normalizarConfig` (no un `{ ...CONFIG_DEFAULT, ...record }` a mano)
		// porque un dia de corte en 0 -invalido, pero no "vacio"- pasaria un
		// spread o un `?? 10` sin que nadie lo note, y `alertas.js` lo usaria
		// tal cual: `hoy.dia > 0` es cierto todos los dias, para todos los
		// clientes de la cartera.
		if (lista.items.length > 0) config = normalizarConfig(lista.items[0]);
	} catch (e) {
		// Sin config el panel funciona con los defaults: todos ventanilla, todas
		// las areas cuentan como soporte.
		console.error('[cartera] no se pudo leer la configuracion:', e);
	}
}

async function cargar() {
	loading = true;
	error = '';
	try {
		await cargarConfig();
		const res = await pb.collection(CLIENTES).getList(1, 500, {
			filter: 'archivado = false',
			sort: '-created'
		});
		clientes = res.items;
		await cargarRecordatorios();
	} catch (e) {
		console.error(e);
		error = 'No se pudieron cargar los clientes.';
	} finally {
		loading = false;
	}

	// Deliberadamente sin await: la lista pinta con el snapshot tal cual esta,
	// y el refresco contra IspCube llega despues y va actualizando filas. Pero
	// sincronizar() es async y puede rechazar (fetch caido, etc.); sin este
	// catch esa promesa quedaria colgando como una unhandled rejection.
	refrescarVencidos().catch((e) => console.error('[cartera] fallo el refresco automatico:', e));
}

async function cargarRecordatorios() {
	try {
		const res = await pb.collection(RECORDATORIOS).getList(1, 500, {
			// Sin filtrar por asesor a proposito: la listRule de la coleccion ya
			// limita el resultado a los clientes del asesor autenticado. Es la
			// misma propiedad de la que depende `notasDe`.
			//
			// El tope de 500 es sobre recordatorios pendientes de toda la cartera,
			// no sobre clientes: comparte el limite de la consulta de clientes de
			// mas arriba, pero como aca son recordatorios x clientes se llena mas
			// rapido y no queda registrado si algo se trunca.
			filter: 'hecho = false',
			sort: 'fecha'
		});

		const porCliente = new Map();
		for (const r of res.items) {
			const lista = porCliente.get(r.cliente) ?? [];
			lista.push(r);
			porCliente.set(r.cliente, lista);
		}
		// Se vuelca sobre el mismo SvelteMap en vez de reasignarlo: la referencia
		// es la que estan leyendo los componentes.
		recordatorios.clear();
		for (const [cliente, lista] of porCliente) recordatorios.set(cliente, lista);
	} catch (e) {
		// La Cartera funciona sin recordatorios: no es motivo para romper la
		// carga entera y dejar al asesor sin lista.
		console.error('[cartera] no se pudieron cargar los recordatorios:', e);
		recordatorios.clear();
	}
}

/** Recordatorios pendientes de un cliente. Siempre un array. */
function recordatoriosDe(clienteId) {
	return recordatorios.get(clienteId) ?? [];
}

/**
 * dd/mm/aaaa para los textos de la bitacora.
 *
 * Por partes y no con `new Date(iso)`: un "2026-08-04" se interpreta en UTC y
 * en Argentina (UTC-3) queda escrito un dia antes. Mismo motivo que en el resto
 * de la Cartera.
 */
function fmtFecha(iso) {
	const p = partesFecha(iso);
	if (!p) return iso;
	return `${String(p.dia).padStart(2, '0')}/${String(p.mes).padStart(2, '0')}/${p.anio}`;
}

/**
 * Deja el rastro de una accion sobre un recordatorio en la bitacora.
 *
 * Los recordatorios son efimeros -al completarse salen de la lista de
 * pendientes y no queda nada-, asi que sin esto la bitacora no mostraba ni que
 * se habia planificado un contacto ni cuando se cumplio.
 */
async function notaDeRecordatorio(clienteId, texto) {
	try {
		// Etiqueta `nota` (nota interna): no es una llamada ni un WhatsApp, es el
		// sistema anotando lo que hizo el asesor.
		await agregarNota(clienteId, 'nota', texto);
	} catch (e) {
		// La anotacion es el rastro, no la accion: el recordatorio ya se guardo,
		// y hacer fallar la operacion entera por la bitacora seria peor.
		console.error('[cartera] no se pudo dejar la anotacion del recordatorio:', e);
	}
}

async function crearRecordatorio(clienteId, fecha, texto) {
	const creado = await pb.collection(RECORDATORIOS).create({
		cliente: clienteId,
		autor: pb.authStore.record.id,
		fecha,
		texto,
		hecho: false
	});

	recordatorios.set(
		clienteId,
		[...recordatoriosDe(clienteId), creado].sort((a, b) => a.fecha.localeCompare(b.fecha))
	);
	await notaDeRecordatorio(clienteId, `Recordatorio seteado para el ${fmtFecha(fecha)}: ${texto}`);
	return creado;
}

async function completarRecordatorio(recordatorio) {
	await pb.collection(RECORDATORIOS).update(recordatorio.id, { hecho: true });

	const lista = recordatoriosDe(recordatorio.cliente).filter((r) => r.id !== recordatorio.id);
	if (lista.length > 0) recordatorios.set(recordatorio.cliente, lista);
	else recordatorios.delete(recordatorio.cliente);

	await notaDeRecordatorio(
		recordatorio.cliente,
		`✓ Recordatorio listo: ${recordatorio.texto} (${fmtFecha(recordatorio.fecha)})`
	);
}

/** Mueve un recordatorio pendiente a otra fecha, sin tocar su texto. */
async function reprogramarRecordatorio(recordatorio, fecha) {
	const guardado = await pb.collection(RECORDATORIOS).update(recordatorio.id, { fecha });

	recordatorios.set(
		recordatorio.cliente,
		recordatoriosDe(recordatorio.cliente)
			.map((r) => (r.id === guardado.id ? guardado : r))
			.sort((a, b) => a.fecha.localeCompare(b.fecha))
	);

	await notaDeRecordatorio(
		recordatorio.cliente,
		`Recordatorio reprogramado para el ${fmtFecha(fecha)}: ${recordatorio.texto}`
	);
	return guardado;
}

// No se exporta suelta: como el resto de la logica del store, solo se expone
// a traves del objeto `carteraStore` de mas abajo (junto con `cargar`,
// `sincronizar`, etc.), para que consumirla desde un componente sea siempre
// `carteraStore.alertasDeCliente(...)`.
function alertasDeCliente(cliente) {
	return alertasDe(cliente, hoyPartes(), config, recordatoriosDe(cliente.id), cliente.promos ?? []);
}

/**
 * El proximo recordatorio pendiente del cliente, vencido o no.
 *
 * Igual que `alertasDeCliente`, no se exporta suelta: se consume siempre como
 * `carteraStore.proximoRecordatorioDe(...)`.
 */
function proximoRecordatorioDe(cliente) {
	return proximoRecordatorio(recordatoriosDe(cliente.id), hoyPartes());
}

async function refrescarVencidos() {
	const codes = aRefrescar(clientes, { ahora: Date.now(), hoy: hoyPartes(), config });
	if (codes.length > 0) await sincronizar(codes);
}

/**
 * Pide a `/api/cartera/sync` datos frescos de `codes` y guarda lo que
 * responda ok.
 *
 * Deduplica por codigo en vez de con un candado global. La lista dispara
 * `refrescarVencidos()` al cargar y el detalle dispara `sincronizar([code])`
 * al montar: si esta funcion rechazara la llamada entera con "ya hay una
 * sincronizacion en curso", el detalle se quedaria sin su refresco cada vez
 * que abre mientras la lista todavia esta sincronizando. Filtrando por
 * codigo, dos llamadas con codigos distintos corren en paralelo sin pisarse
 * (cada una termina en un update() sobre una fila distinta) y solo se evita
 * pedir dos veces el mismo codigo al mismo tiempo.
 */
async function sincronizar(codesEntrada) {
	const codes = (codesEntrada ?? []).filter((c) => !codigosEnCurso.has(c));
	if (codes.length === 0) return;

	codes.forEach((c) => codigosEnCurso.add(c));
	sincronizando = true;

	try {
		const res = await fetch('/api/cartera/sync', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${pb.authStore.token}`
			},
			body: JSON.stringify({
				codes,
				areasSoporte: config.areas_soporte,
				estadosCerrados: config.estados_cerrados
			})
		});

		// 401/403 no son un fallo de IspCube ni de un cliente puntual: son la
		// sesion o el permiso del asesor. Se informan aparte para que el asesor
		// sepa que tiene que volver a loguearse o pedir el permiso, en vez de
		// creer que la Cartera esta rota.
		if (res.status === 401) {
			error = ERROR_401;
			return;
		}
		if (res.status === 403) {
			error = ERROR_403;
			return;
		}
		if (!res.ok) throw new Error(`sync respondio ${res.status}`);

		const { resultados } = await res.json();

		for (const r of resultados) {
			if (!r.ok) {
				// El fetch a /sync funciono, pero IspCube no pudo responder para
				// este cliente puntual (not_found, 502, etc). El snapshot local
				// sigue siendo el que habia: se marca como "no se pudo
				// actualizar" para que el detalle y la lista lo digan, en vez de
				// mostrar la fecha vieja como si estuviera al dia.
				fallosRefresco.add(r.code);
				continue;
			}
			fallosRefresco.delete(r.code);
			await guardarSnapshot(r.code, r.datos);
		}
	} catch (e) {
		// fetch rechazado (red caida) o un status que no sea 401/403/2xx: no se
		// sabe el resultado individual de ningun code de este lote, asi que se
		// marcan todos. Es el lado seguro: en el peor caso un cliente que si se
		// pudo refrescar queda marcado como "no se pudo" hasta el proximo
		// intento, nunca al reves.
		console.error('[cartera] fallo la sincronizacion:', e);
		codes.forEach((c) => fallosRefresco.add(c));
	} finally {
		codes.forEach((c) => codigosEnCurso.delete(c));
		sincronizando = codigosEnCurso.size > 0;
	}
}

/** Si el ultimo intento de refrescar `code` contra IspCube fallo. */
function refrescoFallido(code) {
	return fallosRefresco.has(code);
}

async function guardarSnapshot(code, datos) {
	const actual = clientes.find((c) => c.code === code);
	if (!actual) return;

	const perfil = actual.perfil_manual
		? actual.perfil_pago
		: perfilDe(datos.entity_id, config.entidades_tarjeta, datos.comercial_activity);

	const parche = {
		nombre: datos.nombre,
		estado: datos.estado,
		start_date: datos.start_date,
		entity_id: datos.entity_id,
		entity_nombre: datos.entity_nombre,
		perfil_pago: perfil,
		debt: datos.debt,
		duedebt: datos.duedebt,
		connections: Array.isArray(datos.connections) ? datos.connections : [],
		promos: Array.isArray(datos.promos) ? datos.promos : [],
		sincronizado: new Date().toISOString()
	};

	if (datos.pagos) {
		parche.pagos = fusionarPagos(actual.pagos, datos.pagos, hoyPartes());
	}
	if (datos.tickets) parche.tickets = datos.tickets;

	try {
		const guardado = await pb.collection(CLIENTES).update(actual.id, parche);
		clientes = clientes.map((c) => (c.id === guardado.id ? guardado : c));
	} catch (e) {
		console.error('[cartera] no se pudo guardar el snapshot de', code, e);
	}
}

/**
 * Busca, entre TODOS los registros del asesor (incluidos los archivados), uno
 * con este `code`. `null` si no existe ninguno.
 */
async function buscarExistente(code) {
	try {
		return await pb
			.collection(CLIENTES)
			.getFirstListItem(pb.filter('asesor = {:asesor} && code = {:code}', {
				asesor: pb.authStore.record.id,
				code
			}));
	} catch (e) {
		if (e?.status === 404) return null;
		throw e;
	}
}

async function agregar(code, fechaInstalacion) {
	if (!/^\d{1,12}$/.test(code)) {
		return { ok: false, error: 'El número de cliente son solo dígitos.' };
	}
	if (!partesFecha(fechaInstalacion)) {
		return { ok: false, error: 'Falta la fecha de instalación.' };
	}
	if (clientes.some((c) => c.code === code)) {
		return { ok: false, error: 'Ese cliente ya está en tu cartera.' };
	}

	try {
		// El chequeo de arriba solo mira la lista en memoria, que excluye a los
		// archivados (se cargan con `archivado = false`). Sin este segundo
		// chequeo, volver a agregar a alguien archivado pega contra el indice
		// unico (asesor, code) de PocketBase y sale un error generico. En vez de
		// eso, reaparece: se reactiva el mismo registro con la fecha de
		// instalacion nueva, conservando su historial de pagos y tickets.
		//
		// Si `existente` esta activo (no archivado) es que el chequeo en memoria
		// de arriba quedo desactualizado por una carga concurrente: se lo trata
		// como duplicado, no se lo pisa.
		const existente = await buscarExistente(code);
		if (existente && !existente.archivado) {
			return { ok: false, error: 'Ese cliente ya está en tu cartera.' };
		}
		if (existente && existente.archivado) {
			const restaurado = await pb
				.collection(CLIENTES)
				.update(existente.id, { archivado: false, fecha_instalacion: fechaInstalacion });
			clientes = [restaurado, ...clientes];
			return { ok: true, cliente: restaurado };
		}

		const res = await fetch(`/api/cartera/cliente/${encodeURIComponent(code)}`, {
			headers: { Authorization: `Bearer ${pb.authStore.token}` }
		});

		if (res.status === 404) return { ok: false, error: 'No encontramos ese número de cliente.' };
		if (res.status === 401) return { ok: false, error: ERROR_401 };
		if (res.status === 403) return { ok: false, error: ERROR_403 };
		if (!res.ok) return { ok: false, error: 'No pudimos consultar IspCube. Probá de nuevo.' };

		const datos = await res.json();

		const registro = {
			asesor: pb.authStore.record.id,
			code,
			fecha_instalacion: fechaInstalacion,
			nombre: datos.cliente.nombre,
			estado: datos.cliente.estado,
			start_date: datos.cliente.start_date,
			entity_id: datos.cliente.entity_id,
			entity_nombre: datos.cliente.entity_nombre,
			perfil_pago: perfilDe(datos.cliente.entity_id, config.entidades_tarjeta, datos.cliente.comercial_activity),
			perfil_manual: false,
			debt: datos.cliente.debt,
			duedebt: datos.cliente.duedebt,
			connections: Array.isArray(datos.cliente.connections) ? datos.cliente.connections : [],
			promos: Array.isArray(datos.cliente.promos) ? datos.cliente.promos : [],
			pagos: Array.isArray(datos.pagos) ? datos.pagos : [],
			tickets: datos.tickets?.error ? null : datos.tickets,
			tickets_vistos_hasta: '',
			ultimo_contacto: '',
			sincronizado: new Date().toISOString(),
			archivado: false
		};

		const creado = await pb.collection(CLIENTES).create(registro);
		clientes = [creado, ...clientes];
		return { ok: true, cliente: creado };
	} catch (e) {
		console.error(e);
		return { ok: false, error: 'No se pudo agregar el cliente.' };
	}
}

async function notasDe(clienteId) {
	const res = await pb.collection(NOTAS).getList(1, 100, {
		// Bindeado con pb.filter en vez de interpolar el id a mano: el id hoy
		// sale siempre de un registro propio, pero interpolar strings en un
		// filtro es la forma de una inyeccion aunque el input actual sea sano.
		filter: pb.filter('cliente = {:id}', { id: clienteId }),
		sort: '-created'
	});
	return res.items;
}

/**
 * Guarda una anotacion en la bitacora del cliente.
 *
 * `tipo` es solo una etiqueta descriptiva y puede venir vacio: apagar la alerta
 * de seguimiento es `marcarContactado`, una decision explicita del asesor, no
 * una consecuencia de elegir una etiqueta en el formulario.
 */
async function agregarNota(clienteId, tipo, texto) {
	const creada = await pb.collection(NOTAS).create({
		cliente: clienteId,
		autor: pb.authStore.record.id,
		tipo,
		texto
	});
	notasVersion += 1;
	return creada;
}

/**
 * Marca al cliente como contactado hoy: apaga la alerta de seguimiento.
 *
 * `ultimo_contacto` existe desnormalizado en el registro del cliente porque la
 * lista muestra hasta 500 clientes y deducirlo de la bitacora costaria una
 * consulta por fila.
 *
 * @returns {Promise<boolean>} si se pudo guardar
 */
async function marcarContactado(cliente) {
	try {
		const guardado = await pb
			.collection(CLIENTES)
			.update(cliente.id, { ultimo_contacto: hoyISO() });
		clientes = clientes.map((c) => (c.id === guardado.id ? guardado : c));
		return true;
	} catch (e) {
		console.error('[cartera] no se pudo marcar el contacto:', e);
		return false;
	}
}

/** Marca los tickets del cliente como vistos: apaga la alerta de tickets. */
async function marcarTicketsVistos(cliente) {
	const marca = new Date().toISOString();
	try {
		const guardado = await pb
			.collection(CLIENTES)
			.update(cliente.id, { tickets_vistos_hasta: marca });
		clientes = clientes.map((c) => (c.id === guardado.id ? guardado : c));
	} catch (e) {
		console.error('[cartera] no se pudo marcar los tickets como vistos:', e);
	}
}

async function archivar(cliente) {
	try {
		await pb.collection(CLIENTES).update(cliente.id, { archivado: true });
		clientes = clientes.filter((c) => c.id !== cliente.id);
	} catch (e) {
		console.error(e);
		error = 'No se pudo archivar el cliente.';
		setTimeout(() => (error = ''), 3000);
	}
}

// Se exporta como objeto con getters para conservar la reactividad de runes
// al consumirlo desde los componentes.
export const carteraStore = {
	get clientes() {
		return clientes;
	},
	get config() {
		return config;
	},
	get loading() {
		return loading;
	},
	get sincronizando() {
		return sincronizando;
	},
	get notasVersion() {
		return notasVersion;
	},
	get error() {
		return error;
	},
	cargar,
	sincronizar,
	agregar,
	notasDe,
	agregarNota,
	marcarContactado,
	recordatoriosDe,
	crearRecordatorio,
	completarRecordatorio,
	reprogramarRecordatorio,
	marcarTicketsVistos,
	archivar,
	refrescoFallido,
	alertasDeCliente,
	proximoRecordatorioDe
};
