/**
 * HTML del aviso de baja guiada. Puerto del template embebido en
 * `static/assets/send-email-baja.php`.
 *
 * No usa `correo_template.html` como el resto de los formularios: este mail
 * tiene su propio diseno, heredado del PHP, y su propio contrato de salida
 * (`{status}` en vez de `{success}`) porque asi lo consume Paso4.svelte.
 *
 * `mensaje_ticket` llega como HTML ya armado por el cliente (Paso4.svelte lo
 * construye con los datos del wizard) y se incrusta tal cual, igual que hacia
 * el PHP. No se escapa a proposito: el markup viene del propio frontend, no
 * de un campo libre del visitante.
 */

/**
 * @param {object} datos
 * @param {string} datos.nro_cliente
 * @param {string} datos.dni_cliente
 * @param {string} datos.mensaje_ticket HTML armado por el cliente
 * @param {string | null} [datos.numero_tramite] Si viene, se muestra destacado
 * @returns {string}
 */
export function renderBajaEmail({ nro_cliente, dni_cliente, mensaje_ticket, numero_tramite }) {
	const tramite = numero_tramite
		? `
			<div style="background-color:#d4edda;border:1px solid #c3e6cb;padding:15px;border-radius:5px;text-align:center;margin:20px 0;">
				<h3 style="color:#6f42c1;">🎫 Número de Trámite Generado</h3>
				<p style="font-size:24px;font-weight:bold;color:#6f42c1;margin:10px 0;">${numero_tramite}</p>
			</div>`
		: '';

	return `<!DOCTYPE html>
<html lang="es">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title>Nueva Solicitud de Baja de Servicio</title>
</head>
<body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:0;background-color:#f4f4f4;">
	<div style="max-width:600px;margin:0 auto;padding:20px;background-color:#ffffff;">
		<div style="background-color:#6f42c1;color:white;padding:20px;text-align:center;">
			<h1>Nueva Solicitud de Baja de Servicio</h1>
		</div>
		<div style="background-color:#f8f9fa;padding:20px;">
			<div style="margin-bottom:20px;">
				<h3 style="color:#6f42c1;border-bottom:2px solid #6f42c1;padding-bottom:5px;">📋 Información del Cliente</h3>
				<div style="margin-bottom:10px;">
					<span style="font-weight:bold;display:inline-block;width:200px;">Número de Cliente:</span>
					<span>${nro_cliente}</span>
				</div>
				<div style="margin-bottom:10px;">
					<span style="font-weight:bold;display:inline-block;width:200px;">DNI:</span>
					<span>${dni_cliente}</span>
				</div>
			</div>
			<div style="margin-bottom:20px;">
				<h3 style="color:#6f42c1;border-bottom:2px solid #6f42c1;padding-bottom:5px;">📄 Detalles de la Solicitud</h3>
				<div style="background-color:white;padding:15px;border-radius:5px;border-left:4px solid #6f42c1;">
					${mensaje_ticket}
				</div>
			</div>${tramite}
		</div>
	</div>
</body>
</html>`;
}
