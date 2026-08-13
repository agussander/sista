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
import { alertasDe, proximoRecordatorio } from '$lib/cartera/alertas.js';
import { perfilDe } from '$lib/cartera/normalizar.js';
import { partesFecha, sumarMeses } from '$lib/cartera/fechas.js';
import { estadoInstalacionDe } from '$lib/cartera/instalacion.js';
import { CONFIG_DEFAULT, normalizarConfig } from '$lib/cartera/config.js';
import { construirParche } from '$lib/cartera/parche.js';
import { escribirLote } from '$lib/pbLote.js';
import { almacenDeSesion, leerConfigCache, guardarConfigCache } from '$lib/cartera/configCache.js';

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
 * `{anio, mes, dia}` a `"YYYY-MM-DD"`.
 *
 * No se exporta: hoy por hoy solo la usan `hoyISO` y `descubrirCandidatosDeVendedor`
 * (para su ventana fija de 30 dias), y ninguna depende de datos de IspCube (a
 * diferencia de `fechas.js`, que solo parsea fechas que vienen de la API).
 */
function fechaISO(partes) {
	return `${partes.anio}-${String(partes.mes).padStart(2, '0')}-${String(partes.dia).padStart(2, '0')}`;
}

/**
 * Fecha de hoy como `YYYY-MM-DD`, sin pasar por toISOString (que es UTC).
 *
 * No se exporta: hoy por hoy solo la usa `marcarContactado`, para sellar
 * `ultimo_contacto`.
 */
function hoyISO() {
	return fechaISO(hoyPartes());
}

async function cargarConfig() {
	const almacen = almacenDeSesion();

	// El cacheado ya paso por normalizarConfig cuando se guardo, pero se
	// vuelve a normalizar igual: es barato, y asi un JSON viejo de una version
	// anterior del esquema no se cuela sin validar.
	const cacheada = leerConfigCache(almacen);
	if (cacheada) {
		config = normalizarConfig(cacheada);
		return;
	}

	try {
		const lista = await pb.collection(CONFIG).getList(1, 1);
		// `normalizarConfig` (no un `{ ...CONFIG_DEFAULT, ...record }` a mano)
		// porque un dia de corte en 0 -invalido, pero no "vacio"- pasaria un
		// spread o un `?? 10` sin que nadie lo note, y `alertas.js` lo usaria
		// tal cual: `hoy.dia > 0` es cierto todos los dias, para todos los
		// clientes de la cartera.
		if (lista.items.length > 0) {
			config = normalizarConfig(lista.items[0]);
			guardarConfigCache(almacen, config);
		}
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
	// Mismo criterio: no bloquea el pintado de la lista existente.
	descubrirCandidatosDeVendedor().catch((e) =>
		console.error('[cartera] fallo el descubrimiento de candidatos:', e)
	);
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

/** Edita fecha y texto de un recordatorio pendiente. */
async function editarRecordatorio(recordatorio, fecha, texto) {
	const guardado = await pb.collection(RECORDATORIOS).update(recordatorio.id, { fecha, texto });

	recordatorios.set(
		recordatorio.cliente,
		recordatoriosDe(recordatorio.cliente)
			.map((r) => (r.id === guardado.id ? guardado : r))
			.sort((a, b) => a.fecha.localeCompare(b.fecha))
	);

	await notaDeRecordatorio(
		recordatorio.cliente,
		`Recordatorio editado, para el ${fmtFecha(fecha)}: ${texto}`
	);
	return guardado;
}

/** Elimina un recordatorio pendiente. */
async function eliminarRecordatorio(recordatorio) {
	await pb.collection(RECORDATORIOS).delete(recordatorio.id);

	const lista = recordatoriosDe(recordatorio.cliente).filter((r) => r.id !== recordatorio.id);
	if (lista.length > 0) recordatorios.set(recordatorio.cliente, lista);
	else recordatorios.delete(recordatorio.cliente);

	await notaDeRecordatorio(
		recordatorio.cliente,
		`Recordatorio eliminado: ${recordatorio.texto} (${fmtFecha(recordatorio.fecha)})`
	);
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
 * Busca clientes nuevos por vendedor y los suma solos a la cartera.
 *
 * Sin `id_vendedor` en el usuario autenticado (columna que se carga a mano
 * en PocketBase, fuera de este codigo), no hace nada: el asesor simplemente
 * no participa. Ver el spec del 2026-08-06.
 */
async function descubrirCandidatosDeVendedor() {
	const idVendedor = pb.authStore.record?.id_vendedor;
	if (!idVendedor) {
		console.error('[cartera] sin id_vendedor en el usuario autenticado, no se descubren candidatos');
		return;
	}

	// Ventana fija de 30 dias, siempre -no "el cliente mas viejo que ya
	// tengo"-. Un vendedor con cartera historica (años de clientes) tiene un
	// alta muy vieja como cliente mas antiguo: usarla de corte hacia atras
	// hacia que el tope duro de paginas de /candidatos (500 registros, que a
	// este ritmo cubre 2-3 meses de TODA la base) fuera el que terminaba
	// mandando, trayendo de arrastre meses de historial que el asesor no
	// pidio. Con la ventana fija, cada carga mira nada mas que los ultimos 30
	// dias, se pida cuando se pida.
	const antes = fechaISO(sumarMeses(hoyPartes(), -1));

	try {
		const res = await fetch(
			`/api/cartera/candidatos?vendedor=${encodeURIComponent(idVendedor)}&antes=${antes}`,
			{ headers: { Authorization: `Bearer ${pb.authStore.token}` } }
		);
		if (!res.ok) {
			console.error(`[cartera] /api/cartera/candidatos respondio ${res.status}`, await res.text());
			return;
		}

		const { candidatos } = await res.json();
		const conocidos = new Set(clientes.map((c) => c.code));
		const nuevos = candidatos.filter((c) => !conocidos.has(c.code));
		if (nuevos.length === 0) return;

		// `conocidos` sale de `clientes`, que solo trae activos (cargar() filtra
		// archivado = false): un cliente archivado a proposito, cuyo registro de
		// IspCube todavia cae dentro de la ventana de descubrimiento, no aparece
		// ahi y sin este chequeo se reintentaria el create() en cada carga de
		// pagina, rebotando siempre contra el indice unico (asesor, code).
		//
		// Una sola consulta por TODOS los codes de `nuevos`, no un
		// getFirstListItem por candidato: con la ventana de 30 dias esto podia
		// ser decenas o cientos de requests a PocketBase en cada carga de la
		// Cartera, y fue lo que agoto el limite por IP el 2026-08-06.
		const existentes = await buscarExistentes(nuevos.map((c) => c.code));

		const aCrear = [];
		for (const candidato of nuevos) {
			if (existentes.has(candidato.code)) continue;

			aCrear.push({
				coleccion: CLIENTES,
				accion: 'create',
				datos: {
					asesor: pb.authStore.record.id,
					code: candidato.code,
					fecha_instalacion: '',
					nombre: candidato.nombre,
					doc_number: candidato.doc_number,
					ciudad: candidato.ciudad,
					estado: candidato.estado,
					start_date: candidato.start_date,
					entity_id: candidato.entity_id,
					entity_nombre: candidato.entity_nombre,
					perfil_pago: perfilDe(
						candidato.entity_id,
						config.entidades_tarjeta,
						candidato.comercial_activity
					),
					perfil_manual: false,
					debt: candidato.debt,
					duedebt: candidato.duedebt,
					connections: candidato.connections,
					promos: candidato.promos,
					pagos: [],
					tickets: null,
					alta_nap: null,
					nuevo: true,
					instalado_aviso: false,
					tickets_vistos_hasta: '',
					ultimo_contacto: '',
					// Vacio a proposito, no new Date().toISOString(): hace que
					// aRefrescar() lo tome como prioritario en la carga siguiente, asi
					// el primer sync real (el que trae tickets y calcula alta_nap)
					// llega pronto y no hay que esperar las 12h de FRESCO_MS.
					sincronizado: '',
					archivado: false
				}
			});
		}

		if (aCrear.length === 0) return;

		// Un solo request para todas las altas. Si el lote rebota -por ejemplo
		// porque dos pestanias corrieron el descubrimiento a la vez y una alta
		// choca contra el indice unico (asesor, code)-, escribirLote las rehace
		// una por una y solo se pierde la que choco, igual que antes.
		const creados = await escribirLote(pb, aCrear);

		const nuevosRegistros = [];
		for (const c of creados) {
			if (c.ok) nuevosRegistros.push(c.record);
			else
				console.error(
					'[cartera] no se pudo sumar el candidato',
					c.operacion.datos.code,
					JSON.stringify(c.error?.response ?? c.error)
				);
		}
		if (nuevosRegistros.length > 0) clientes = [...nuevosRegistros, ...clientes];
	} catch (e) {
		console.error('[cartera] fallo el descubrimiento de candidatos por vendedor:', e);
	}
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

		// Se arman TODOS los parches antes de escribir ninguno: es lo que
		// permite mandarlos en un solo request en vez de 20.
		const aEscribir = [];
		// id de PocketBase -> code del cliente, solo para poder loguear un
		// fallo por el numero que el asesor reconoce y puede buscar en IspCube.
		// `escribirLote` devuelve la operacion, y ahi el cliente es un id.
		const codePorId = new Map();
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

			const actual = clientes.find((c) => c.code === r.code);
			// El cliente pudo haberse archivado mientras /sync estaba en vuelo.
			if (!actual) continue;

			codePorId.set(actual.id, r.code);
			aEscribir.push({
				coleccion: CLIENTES,
				accion: 'update',
				id: actual.id,
				datos: construirParche(actual, r.datos, config, hoyPartes())
			});
		}

		if (aEscribir.length > 0) {
			const escritos = await escribirLote(pb, aEscribir);

			const porId = new Map();
			for (const e of escritos) {
				if (e.ok) porId.set(e.record.id, e.record);
				else
					console.error(
						'[cartera] no se pudo guardar el snapshot de',
						codePorId.get(e.operacion.id),
						e.error
					);
			}
			// Una sola reasignacion de `clientes` para toda la tanda, en vez de
			// una por cliente como hacia el loop de guardarSnapshot.
			if (porId.size > 0) clientes = clientes.map((c) => porId.get(c.id) ?? c);
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

/**
 * Igual que `buscarExistente`, pero para varios codes a la vez: una sola
 * consulta con un OR de todos ellos, en vez de un `getFirstListItem` por
 * code. La usa `descubrirCandidatosDeVendedor`, donde `codes` puede tener
 * decenas de entradas por carga de la Cartera.
 *
 * @returns {Promise<Set<string>>} los codes de `codes` que ya existen.
 */
async function buscarExistentes(codes) {
	if (codes.length === 0) return new Set();

	const filtroCodes = codes.map((code) => pb.filter('code = {:code}', { code })).join(' || ');
	const filtroAsesor = pb.filter('asesor = {:asesor}', { asesor: pb.authStore.record.id });

	const items = await pb.collection(CLIENTES).getFullList({
		filter: `${filtroAsesor} && (${filtroCodes})`
	});
	return new Set(items.map((i) => i.code));
}

async function agregar(code) {
	if (!/^\d{1,12}$/.test(code)) {
		return { ok: false, error: 'El número de cliente son solo dígitos.' };
	}
	if (clientes.some((c) => c.code === code)) {
		return { ok: false, error: 'Ese cliente ya está en tu cartera.' };
	}

	try {
		const existente = await buscarExistente(code);
		if (existente && !existente.archivado) {
			return { ok: false, error: 'Ese cliente ya está en tu cartera.' };
		}
		if (existente && existente.archivado) {
			// Se reactiva tal cual estaba, sin tocar su fecha_instalacion: ya la
			// tenia cargada (a mano de antes de este cambio, o completada sola por
			// un sync), y no hay motivo para pisarla.
			const restaurado = await pb.collection(CLIENTES).update(existente.id, { archivado: false });
			clientes = [restaurado, ...clientes];
			return { ok: true, cliente: restaurado };
		}

		// `areas`/`cerrados` en la query: sin ellos el endpoint los toma como
		// listas vacias y `resumenAltaNap` no puede reconocer ningun estado
		// como "cerrado", asi que un cliente agregado a mano con el ticket de
		// NAP ya cerrado en IspCube quedaba marcado "NAP faltante" igual.
		const areas = (config.areas_soporte ?? []).join(',');
		const cerrados = (config.estados_cerrados ?? []).join(',');
		const res = await fetch(
			`/api/cartera/cliente/${encodeURIComponent(code)}?areas=${encodeURIComponent(areas)}&cerrados=${encodeURIComponent(cerrados)}`,
			{ headers: { Authorization: `Bearer ${pb.authStore.token}` } }
		);

		if (res.status === 404) return { ok: false, error: 'No encontramos ese número de cliente.' };
		if (res.status === 401) return { ok: false, error: ERROR_401 };
		if (res.status === 403) return { ok: false, error: ERROR_403 };
		if (!res.ok) return { ok: false, error: 'No pudimos consultar IspCube. Probá de nuevo.' };

		const datos = await res.json();
		const connections = Array.isArray(datos.cliente.connections) ? datos.cliente.connections : [];
		const altaNap = datos.alta_nap ?? { existe: false, cerrado: false, anulado: false, closed_date: '' };
		// Caso borde: un cliente que se agrega a mano cuando su ticket de NAP ya
		// estaba cerrado desde antes (por ejemplo, se cargo tarde). No dispara el
		// aviso "instalado" -no es una transicion, es su estado de entrada-, pero
		// si completa la fecha real de una.
		const estado = estadoInstalacionDe({ connections, alta_nap: altaNap });

		const registro = {
			asesor: pb.authStore.record.id,
			code,
			fecha_instalacion: estado === 'instalado' ? altaNap.closed_date : '',
			nombre: datos.cliente.nombre,
			doc_number: datos.cliente.doc_number,
			ciudad: datos.cliente.ciudad,
			estado: datos.cliente.estado,
			start_date: datos.cliente.start_date,
			entity_id: datos.cliente.entity_id,
			entity_nombre: datos.cliente.entity_nombre,
			perfil_pago: perfilDe(datos.cliente.entity_id, config.entidades_tarjeta, datos.cliente.comercial_activity),
			perfil_manual: false,
			debt: datos.cliente.debt,
			duedebt: datos.cliente.duedebt,
			connections,
			promos: Array.isArray(datos.cliente.promos) ? datos.cliente.promos : [],
			pagos: Array.isArray(datos.pagos) ? datos.pagos : [],
			tickets: datos.tickets?.error ? null : datos.tickets,
			alta_nap: altaNap,
			nuevo: false,
			instalado_aviso: false,
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
	editarRecordatorio,
	eliminarRecordatorio,
	marcarTicketsVistos,
	archivar,
	refrescoFallido,
	alertasDeCliente,
	proximoRecordatorioDe
};
