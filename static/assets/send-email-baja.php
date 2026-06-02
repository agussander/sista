<?php

// Configurar headers para JSON
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// Incluir PHPMailer
require_once __DIR__ . '/includes/MailHandler.php';

// Obtener los datos del cuerpo de la solicitud como JSON
$data = json_decode(file_get_contents("php://input"), true);

// Verificar que los datos hayan sido recibidos correctamente
if ($data === null) {
    echo json_encode([
        'status' => 'error',
        'message' => 'Datos no válidos'
    ]);
    exit;
}

// Acceder a los datos del formulario
$nro_cliente = $data['nro_cliente'] ?? null;
$dni_cliente = $data['dni_cliente'] ?? null;
$form_type = $data['form_type'] ?? null;
$mensaje_ticket = $data['mensaje_ticket'] ?? null;
$numero_tramite = $data['numero_tramite'] ?? null;
$nombre_cliente = $data['nombre_cliente'] ?? null;

// Validar que los datos requeridos no estén vacíos
if (!$nro_cliente || !$dni_cliente || !$mensaje_ticket) {
    echo json_encode([
        'status' => 'error',
        'message' => 'Faltan datos necesarios para el email'
    ]);
    exit;
}

// Configuración del email
$to = 'agustinsander@gmail.com';
$subject = 'Nueva Solicitud de Baja - Cliente: ' . $nro_cliente;

// Crear el contenido del email
$email_content = "
<!DOCTYPE html PUBLIC '-//W3C//DTD XHTML 1.0 Transitional//EN' 'http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd'>
<html xmlns='http://www.w3.org/1999/xhtml'>
<head>
    <meta http-equiv='Content-Type' content='text/html; charset=UTF-8' />
    <meta name='viewport' content='width=device-width, initial-scale=1.0' />
    <title>Nueva Solicitud de Baja de Servicio</title>
    <!--[if !mso]><!-->
    <meta http-equiv='X-UA-Compatible' content='IE=edge' />
    <!--<![endif]-->
    <style type='text/css'>
        body { 
            font-family: Arial, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            margin: 0; 
            padding: 0; 
            background-color: #f4f4f4;
        }
        .container { 
            max-width: 600px; 
            margin: 0 auto; 
            padding: 20px; 
            background-color: #ffffff;
        }
        .header { 
            background-color: #6f42c1; 
            color: white; 
            padding: 20px; 
            text-align: center; 
        }
        .content { 
            background-color: #f8f9fa; 
            padding: 20px; 
        }
        .section { 
            margin-bottom: 20px; 
        }
        .section h3 { 
            color: #6f42c1; 
            border-bottom: 2px solid #6f42c1; 
            padding-bottom: 5px; 
        }
        .data-row { 
            margin-bottom: 10px; 
        }
        .data-label { 
            font-weight: bold; 
            display: inline-block;
            width: 200px; 
        }
        .data-value { 
            display: inline-block;
        }
        .tramite { 
            background-color: #d4edda; 
            border: 1px solid #c3e6cb; 
            padding: 15px; 
            border-radius: 5px; 
            text-align: center; 
            margin: 20px 0; 
        }
        .footer { 
            background-color: #e9ecef; 
            padding: 15px; 
            text-align: center; 
            font-size: 12px; 
            color: #6c757d; 
        }
    </style>
</head>
<body>
    <!-- Preheader text -->
    <div style='display: none; font-size: 1px; color: #fefefe; line-height: 1px; font-family: Arial, sans-serif; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;'>
        Nueva solicitud de baja de servicio - Cliente: {$nro_cliente} - DNI: {$dni_cliente}
    </div>
    
    <div class='container'>
        <div class='header'>
            <h1>Nueva Solicitud de Baja de Servicio</h1>
        </div>
        
        <div class='content'>
            <div class='section'>
                <h3>📋 Información del Cliente</h3>
                <div class='data-row'>
                    <span class='data-label'>Número de Cliente:</span>
                    <span class='data-value'>{$nro_cliente}</span>
                </div>
                <div class='data-row'>
                    <span class='data-label'>DNI:</span>
                    <span class='data-value'>{$dni_cliente}</span>
                </div>
            </div>
            
            <div class='section'>
                <h3>📄 Detalles de la Solicitud</h3>
                <div style='background-color: white; padding: 15px; border-radius: 5px; border-left: 4px solid #6f42c1;'>
                    " . $mensaje_ticket . "
                </div>
            </div>
            
            " . ($numero_tramite ? "
            <div class='tramite'>
                <h3>🎫 Número de Trámite Generado</h3>
                <p style='font-size: 24px; font-weight: bold; color: #6f42c1; margin: 10px 0;'>{$numero_tramite}</p>
            </div>
            " : "") . "
        </div>
    </div>
</body>
</html>
";

// Usar mail() nativo de PHP (más simple y confiable)
try {
    // Configuración del email
    $to = 'agustinsander@gmail.com';
    $subject = 'Nueva Solicitud de Baja - Cliente: ' . $nro_cliente;
    
    // Crear versión de texto plano
    $text_content = "Nueva Solicitud de Baja de Servicio\n\n";
    $text_content .= "Información del Cliente:\n";
    $text_content .= "Número de Cliente: {$nro_cliente}\n";
    $text_content .= "DNI: {$dni_cliente}\n\n";
    $text_content .= "Detalles de la Solicitud:\n";
    $text_content .= strip_tags($mensaje_ticket) . "\n\n";
    if ($numero_tramite) {
        $text_content .= "Número de Trámite: {$numero_tramite}\n\n";
    }
    
    // Crear boundary para multipart
    $boundary = md5(uniqid(time()));
    
    // Headers del email
    $headers = [
        'MIME-Version: 1.0',
        'Content-Type: multipart/alternative; boundary="' . $boundary . '"',
        'From: Sistema SISTA <noreply@sista.com.ar>',
        'Reply-To: noreply@sista.com.ar',
        'X-Mailer: PHP/' . phpversion(),
        'X-Priority: 3'
    ];
    
    // Crear el cuerpo del email multipart
    $body = "--{$boundary}\r\n";
    $body .= "Content-Type: text/plain; charset=UTF-8\r\n";
    $body .= "Content-Transfer-Encoding: 8bit\r\n\r\n";
    $body .= $text_content . "\r\n\r\n";
    $body .= "--{$boundary}\r\n";
    $body .= "Content-Type: text/html; charset=UTF-8\r\n";
    $body .= "Content-Transfer-Encoding: 8bit\r\n\r\n";
    $body .= $email_content . "\r\n\r\n";
    $body .= "--{$boundary}--\r\n";
    
    // Enviar el email
    $mail_sent = mail($to, $subject, $body, implode("\r\n", $headers));
    
    if ($mail_sent) {
        echo json_encode([
            'status' => 'success',
            'message' => 'Email enviado correctamente'
        ]);
    } else {
        echo json_encode([
            'status' => 'error',
            'message' => 'Error al enviar el email'
        ]);
    }
    
} catch (Exception $e) {
    echo json_encode([
        'status' => 'error',
        'message' => 'Error al enviar el email: ' . $e->getMessage()
    ]);
}

?>



