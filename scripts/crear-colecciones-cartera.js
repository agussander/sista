/**
 * Crea en PocketBase las cuatro colecciones de la Cartera de clientes.
 *
 * Es la Task 13 del plan (`docs/superpowers/plans/2026-08-03-cartera-de-clientes.md`),
 * que estaba documentada como pasos manuales en el admin de PocketBase. Son 18
 * campos + un indice unico + 5 reglas de API solo en `cartera_clientes`:
 * a mano es tedioso y facil de equivocar, y un error en una regla de API no
 * falla ruidoso, falla dejando datos de clientes expuestos.
 *
 * NO toca `users` ni el campo `permisos`: eso ya esta hecho en la instancia.
 *
 * Es idempotente: una coleccion que ya existe se saltea, no se pisa. Correrlo
 * dos veces no rompe nada.
 *
 * La excepcion es `ponerCampoOpcional`, que SI modifica una coleccion existente
 * (con un PATCH), pero solo si el campo todavia no esta como corresponde.
 *
 * Uso:
 *
 *   PB_TOKEN='...' node scripts/crear-colecciones-cartera.js
 *   PB_TOKEN='...' node scripts/crear-colecciones-cartera.js --dry-run
 *
 * El token sale de las devtools del admin de PocketBase ya logueado
 * (Application -> Local Storage -> la clave `pocketbase_superuser_auth`, campo
 * `token`). Alternativamente, `PB_SUPERUSER_EMAIL` + `PB_SUPERUSER_PASSWORD`.
 * Pasalos por env, no los escribas en el archivo ni los commitees.
 *
 * Requiere PocketBase >= 0.23 (schema con `fields`, admins en `_superusers`).
 */

const PB_URL = (process.env.PB_URL || 'https://sista.pockethost.io').replace(/\/+$/, '');
const DRY_RUN = process.argv.includes('--dry-run');

/** Valores confirmados en la Task 1 del plan; ver la tabla de `cartera_config`. */
const CONFIG_INICIAL = {
	entidades_tarjeta: [152, 64, 153, 59, 54],
	areas_soporte: [1],
	estados_cerrados: [3, 6, 8],
	dia_corte_1: 10,
	dia_corte_2: 20,
	dia_corte_tarjeta: 21
};

const texto = (name, extra = {}) => ({ name, type: 'text', required: false, ...extra });
const numero = (name) => ({ name, type: 'number', required: false });
const booleano = (name) => ({ name, type: 'bool', required: false });
/** `maxSize` es obligatorio en los campos json de PocketBase 0.23+. */
const json = (name) => ({ name, type: 'json', required: false, maxSize: 2_000_000 });

/**
 * Desde PocketBase 0.23 `created` y `updated` NO son campos de sistema
 * implicitos: son campos `autodate` normales que el admin agrega por defecto
 * al crear una coleccion desde la UI, pero que por API hay que declarar.
 *
 * No son decorativos aca: `carteraStore.notasDe()` ordena por `-created`, y
 * sin el campo esa consulta falla con 400.
 */
const fechasAutomaticas = () => [
	{ name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
	{ name: 'updated', type: 'autodate', onCreate: true, onUpdate: true }
];

let token = process.env.PB_TOKEN || '';

async function api(path, { method = 'GET', body } = {}) {
	const res = await fetch(`${PB_URL}${path}`, {
		method,
		headers: {
			'Content-Type': 'application/json',
			...(token ? { Authorization: token } : {})
		},
		body: body ? JSON.stringify(body) : undefined
	});

	const cuerpo = await res.text();
	let data;
	try {
		data = cuerpo ? JSON.parse(cuerpo) : null;
	} catch {
		data = cuerpo;
	}

	return { ok: res.ok, status: res.status, data };
}

async function autenticar() {
	if (!token) {
		const identity = process.env.PB_SUPERUSER_EMAIL;
		const password = process.env.PB_SUPERUSER_PASSWORD;
		if (!identity || !password) {
			console.error(
				'Falta autenticacion. Pasa PB_TOKEN, o PB_SUPERUSER_EMAIL + PB_SUPERUSER_PASSWORD.'
			);
			process.exit(1);
		}

		const res = await api('/api/collections/_superusers/auth-with-password', {
			method: 'POST',
			body: { identity, password }
		});
		if (!res.ok) {
			console.error('No se pudo autenticar como superuser:', res.status, res.data);
			process.exit(1);
		}
		token = res.data.token;
		console.log('Autenticado como superuser.');
	}

	// Un PB_TOKEN vencido, o de un usuario comun en vez de un superuser, no se
	// nota aca: se nota en la primera llamada real. Antes eso salia como "no se
	// encontro la coleccion `users`", que manda a buscar el problema al lugar
	// equivocado. Se valida de entrada, con el mismo permiso que necesita el
	// resto del script (listar colecciones).
	const chequeo = await api('/api/collections?perPage=1');
	if (!chequeo.ok) {
		if (chequeo.status === 401 || chequeo.status === 403) {
			console.error(
				`El token no sirve para administrar colecciones (${chequeo.status}): esta vencido, ` +
					'o es de un usuario comun y no de un superuser.\n' +
					'Lo mas simple es dejar que el script se autentique solo:\n' +
					'  PB_SUPERUSER_EMAIL=... PB_SUPERUSER_PASSWORD=... node scripts/crear-colecciones-cartera.js --dry-run'
			);
		} else {
			console.error(`No se pudo hablar con PocketBase: ${chequeo.status}`, chequeo.data);
		}
		process.exit(1);
	}
	console.log('Token validado.');
}

/**
 * El id de una coleccion por nombre, o null si no existe.
 *
 * Solo un 404 cuenta como "no existe". Cualquier otro fallo corta con el
 * status a la vista: confundir "no tengo permiso" con "no esta" fue
 * exactamente lo que hizo perder tiempo la primera vez.
 */
async function idDe(nombre) {
	const res = await api(`/api/collections/${nombre}`);
	if (res.ok) return res.data.id;
	if (res.status === 404) return null;
	console.error(`No se pudo consultar la coleccion \`${nombre}\`: ${res.status}`, res.data);
	process.exit(1);
}

/**
 * Crea la coleccion si no existe. Devuelve su id en los dos casos, para que
 * las relaciones de las colecciones siguientes puedan apuntarle.
 */
async function crear(definicion) {
	const existente = await idDe(definicion.name);
	if (existente) {
		console.log(`- ${definicion.name}: ya existe, se saltea.`);
		return existente;
	}

	if (DRY_RUN) {
		console.log(`- ${definicion.name}: SE CREARIA (${definicion.fields.length} campos).`);
		return `dry-run-${definicion.name}`;
	}

	const res = await api('/api/collections', { method: 'POST', body: definicion });
	if (!res.ok) {
		console.error(`- ${definicion.name}: FALLO`, res.status, JSON.stringify(res.data, null, 2));
		process.exit(1);
	}
	console.log(`- ${definicion.name}: creada.`);
	return res.data.id;
}

/**
 * Cambia `required` a false en un campo de una coleccion que YA existe.
 *
 * `crear()` es idempotente salteando la coleccion entera, asi que no sirve para
 * modificar algo que ya esta en produccion: hace falta un PATCH. Es el unico
 * paso del script que toca una coleccion existente, por eso avisa siempre que
 * hizo (o que no hizo, si ya estaba como corresponde).
 */
async function ponerCampoOpcional(nombreColeccion, nombreCampo) {
	const res = await api(`/api/collections/${nombreColeccion}`);
	if (!res.ok) {
		// Igual que en idDe(): solo un 404 cuenta como "no existe". En --dry-run
		// sobre una instancia nueva, crear() no crea nada de verdad, asi que la
		// coleccion nunca llego a existir; no hay nada que migrar. Cualquier otro
		// status (403, 500, ...) es un fallo real y corta el script.
		if (res.status === 404) {
			console.log(`- ${nombreColeccion}.${nombreCampo}: la coleccion no existe, nada que migrar.`);
			return;
		}
		console.error(`- ${nombreColeccion}: no se pudo leer para migrar (${res.status})`, res.data);
		process.exit(1);
	}

	const campo = res.data.fields.find((f) => f.name === nombreCampo);
	if (!campo) {
		console.error(`- ${nombreColeccion}.${nombreCampo}: el campo no existe. Abortado.`);
		process.exit(1);
	}
	if (!campo.required) {
		console.log(`- ${nombreColeccion}.${nombreCampo}: ya es opcional, se saltea.`);
		return;
	}
	if (DRY_RUN) {
		console.log(`- ${nombreColeccion}.${nombreCampo}: SE PONDRIA opcional.`);
		return;
	}

	// El PATCH reemplaza `fields` entero: hay que mandar todos los campos, no
	// solo el que cambia, o los demas se borran.
	const fields = res.data.fields.map((f) =>
		f.name === nombreCampo ? { ...f, required: false } : f
	);
	const patch = await api(`/api/collections/${nombreColeccion}`, {
		method: 'PATCH',
		body: { fields }
	});
	if (!patch.ok) {
		console.error(
			`- ${nombreColeccion}.${nombreCampo}: FALLO`,
			patch.status,
			JSON.stringify(patch.data, null, 2)
		);
		process.exit(1);
	}
	console.log(`- ${nombreColeccion}.${nombreCampo}: ahora es opcional.`);
}

async function main() {
	console.log(`PocketBase: ${PB_URL}${DRY_RUN ? '  (dry run, no escribe nada)' : ''}\n`);
	await autenticar();

	const usersId = await idDe('users');
	if (!usersId) {
		console.error('No se encontro la coleccion `users`. Abortado.');
		process.exit(1);
	}

	console.log('\nColecciones:');

	// --- cartera_clientes -----------------------------------------------------
	// Las cinco reglas exigen que el registro sea del asesor autenticado. En
	// Create se mira `@request.body.asesor` en vez de `asesor` (el registro
	// todavia no existe) para que nadie cree filas a nombre de otro.
	const clientesId = await crear({
		name: 'cartera_clientes',
		type: 'base',
		fields: [
			{
				name: 'asesor',
				type: 'relation',
				required: true,
				collectionId: usersId,
				maxSelect: 1,
				cascadeDelete: true
			},
			texto('code', { required: true, pattern: '^\\d{1,12}$' }),
			texto('fecha_instalacion', { required: true }),
			texto('nombre'),
			texto('estado'),
			texto('start_date'),
			numero('entity_id'),
			texto('entity_nombre'),
			{
				name: 'perfil_pago',
				type: 'select',
				required: false,
				maxSelect: 1,
				values: ['ventanilla', 'tarjeta']
			},
			booleano('perfil_manual'),
			numero('debt'),
			numero('duedebt'),
			json('pagos'),
			json('tickets'),
			texto('tickets_vistos_hasta'),
			texto('ultimo_contacto'),
			texto('sincronizado'),
			booleano('archivado'),
			...fechasAutomaticas()
		],
		indexes: [
			'CREATE UNIQUE INDEX `idx_cartera_asesor_code` ON `cartera_clientes` (`asesor`, `code`)'
		],
		listRule: '@request.auth.id != "" && asesor = @request.auth.id',
		viewRule: '@request.auth.id != "" && asesor = @request.auth.id',
		createRule: '@request.auth.id != "" && @request.body.asesor = @request.auth.id',
		updateRule: '@request.auth.id != "" && asesor = @request.auth.id',
		deleteRule: '@request.auth.id != "" && asesor = @request.auth.id'
	});

	// --- cartera_notas --------------------------------------------------------
	const reglaPorCliente = '@request.auth.id != "" && cliente.asesor = @request.auth.id';
	await crear({
		name: 'cartera_notas',
		type: 'base',
		fields: [
			{
				name: 'cliente',
				type: 'relation',
				required: true,
				collectionId: clientesId,
				maxSelect: 1,
				cascadeDelete: true
			},
			{
				name: 'autor',
				type: 'relation',
				required: true,
				collectionId: usersId,
				maxSelect: 1,
				cascadeDelete: false
			},
			{
				name: 'tipo',
				type: 'select',
				required: true,
				maxSelect: 1,
				values: ['llamada', 'whatsapp', 'visita', 'nota']
			},
			texto('texto', { required: true }),
			...fechasAutomaticas()
		],
		listRule: reglaPorCliente,
		viewRule: reglaPorCliente,
		createRule: reglaPorCliente,
		updateRule: reglaPorCliente,
		deleteRule: reglaPorCliente
	});

	// --- cartera_recordatorios ------------------------------------------------
	// Mismas reglas que las notas: el dueño es el cliente, y el cliente es del
	// asesor. `fecha` es texto YYYY-MM-DD y no un campo `date` por lo mismo que
	// `fecha_instalacion`: todo src/lib/cartera/fechas.js compara fechas por sus
	// partes en hora local, y un `date` de PocketBase se serializa en UTC, que
	// es justo el bug que ese modulo existe para evitar.
	await crear({
		name: 'cartera_recordatorios',
		type: 'base',
		fields: [
			{
				name: 'cliente',
				type: 'relation',
				required: true,
				collectionId: clientesId,
				maxSelect: 1,
				cascadeDelete: true
			},
			{
				name: 'autor',
				type: 'relation',
				required: true,
				collectionId: usersId,
				maxSelect: 1,
				cascadeDelete: false
			},
			texto('fecha', { required: true }),
			texto('texto', { required: true }),
			booleano('hecho'),
			...fechasAutomaticas()
		],
		listRule: reglaPorCliente,
		viewRule: reglaPorCliente,
		createRule: reglaPorCliente,
		updateRule: reglaPorCliente,
		deleteRule: reglaPorCliente
	});

	// --- cartera_config -------------------------------------------------------
	// Es configuracion compartida de toda la Cartera, no de un asesor: cualquier
	// asesor autenticado la lee y (por ahora) la edita. Sin Create ni Delete:
	// es un unico registro, el de abajo.
	await crear({
		name: 'cartera_config',
		type: 'base',
		fields: [
			json('entidades_tarjeta'),
			json('areas_soporte'),
			json('estados_cerrados'),
			numero('dia_corte_1'),
			numero('dia_corte_2'),
			numero('dia_corte_tarjeta'),
			...fechasAutomaticas()
		],
		listRule: '@request.auth.id != ""',
		viewRule: '@request.auth.id != ""',
		createRule: null,
		updateRule: '@request.auth.id != ""',
		deleteRule: null
	});

	// --- migraciones de campos ------------------------------------------------
	// `tipo` nacio obligatorio, cuando elegirlo tambien decidia si se apagaba la
	// alerta de seguimiento. Ahora es solo una etiqueta descriptiva y se puede
	// dejar vacia.
	console.log('\nMigraciones de campos:');
	await ponerCampoOpcional('cartera_notas', 'tipo');

	// --- el registro unico de configuracion -----------------------------------
	console.log('\nRegistro de configuracion:');
	if (DRY_RUN) {
		console.log('- SE CREARIA con', JSON.stringify(CONFIG_INICIAL));
	} else {
		const actual = await api('/api/collections/cartera_config/records?perPage=1');
		if (actual.ok && actual.data.items.length > 0) {
			console.log('- ya hay un registro, se saltea.');
		} else {
			const res = await api('/api/collections/cartera_config/records', {
				method: 'POST',
				body: CONFIG_INICIAL
			});
			if (!res.ok) {
				console.error('- FALLO', res.status, JSON.stringify(res.data, null, 2));
				process.exit(1);
			}
			console.log('- creado con', JSON.stringify(CONFIG_INICIAL));
		}
	}

	// --- verificacion ---------------------------------------------------------
	// Step 4 del plan: sin autenticar, las cuatro colecciones NO pueden listar.
	// Un 200 aca significa que una regla quedo vacia y la base de clientes esta
	// abierta a internet.
	console.log('\nVerificacion (sin autenticar, debe dar 403/404):');
	let mal = false;
	for (const c of ['cartera_clientes', 'cartera_notas', 'cartera_config', 'cartera_recordatorios']) {
		const res = await fetch(`${PB_URL}/api/collections/${c}/records?perPage=1`);
		const ok = res.status === 403 || res.status === 404;
		if (!ok) mal = true;
		console.log(`- ${c}: ${res.status} ${ok ? 'OK' : '<-- ABIERTA, REVISAR LA REGLA'}`);
	}

	if (mal) process.exit(1);
	console.log(`\nListo.${DRY_RUN ? ' (dry run: no se escribio nada)' : ''}`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
