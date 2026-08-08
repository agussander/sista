/**
 * El parche que se escribe en `cartera_clientes` a partir de lo que devolvio
 * `/api/cartera/sync` para un cliente.
 *
 * Vive separado del store por dos motivos. Uno, es la logica con mas sutileza
 * del sync -la transicion de `instalado_aviso`- y aca se puede testear sin
 * PocketBase de por medio. Dos, el store necesita armar todos los parches
 * ANTES de escribir ninguno, para poder mandarlos en un solo lote.
 */
import { perfilDe } from './normalizar.js';
import { estadoInstalacionDe } from './instalacion.js';
import { fusionarPagos } from './pagos.js';

/**
 * @param {any} actual Registro de `cartera_clientes` tal cual esta en el store
 * @param {any} datos Datos frescos de `/api/cartera/sync` para ese code
 * @param {any} config Config normalizada de la cartera
 * @param {{anio: number, mes: number, dia: number}} hoy
 * @returns {Record<string, any>}
 */
export function construirParche(actual, datos, config, hoy) {
	const perfil = actual.perfil_manual
		? actual.perfil_pago
		: perfilDe(datos.entity_id, config.entidades_tarjeta, datos.comercial_activity);

	const connections = Array.isArray(datos.connections) ? datos.connections : [];
	// `datos.alta_nap` puede faltar si `/sync` no pudo traer tickets esta vez
	// (IspCube caido puntual): se conserva el ultimo valor conocido en vez de
	// perderlo.
	const altaNap = datos.alta_nap ??
		actual.alta_nap ?? { existe: false, cerrado: false, anulado: false, closed_date: '' };

	// La transicion se detecta comparando el estado ANTES de este parche contra
	// el que resulta de aplicarlo. La formula se escribe en CADA sync, nunca
	// solo cuando da true: la sync siguiente a una transicion encuentra
	// `estadoViejo === 'instalado'` (porque ya quedo guardado asi) y da false
	// sola, sin logica de "apagar" aparte.
	const estadoViejo = estadoInstalacionDe(actual);
	const estadoNuevo = estadoInstalacionDe({ connections, alta_nap: altaNap });
	const instaladoAviso = estadoNuevo === 'instalado' && estadoViejo !== 'instalado';

	const parche = {
		nombre: datos.nombre,
		// Si la coleccion todavia no tiene estos dos campos, PocketBase ignora
		// las claves extra y el update pasa igual: se pueden desplegar el codigo
		// y el cambio de schema en cualquier orden.
		doc_number: datos.doc_number,
		ciudad: datos.ciudad,
		estado: datos.estado,
		start_date: datos.start_date,
		entity_id: datos.entity_id,
		entity_nombre: datos.entity_nombre,
		perfil_pago: perfil,
		debt: datos.debt,
		duedebt: datos.duedebt,
		connections,
		promos: Array.isArray(datos.promos) ? datos.promos : [],
		alta_nap: altaNap,
		// Mismo mecanismo exacto que instalado_aviso: se escribe false en cada
		// sync sin condicion, asi que la primera sync despues de crearse (con
		// nuevo:true) lo apaga sola.
		nuevo: false,
		instalado_aviso: instaladoAviso,
		sincronizado: new Date().toISOString()
	};

	if (instaladoAviso && !actual.fecha_instalacion) {
		parche.fecha_instalacion = altaNap.closed_date;
	}

	if (datos.pagos) {
		parche.pagos = fusionarPagos(actual.pagos, datos.pagos, hoy);
	}
	if (datos.tickets) parche.tickets = datos.tickets;

	return parche;
}
