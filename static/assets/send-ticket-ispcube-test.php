<?php

// Configurar headers para JSON
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

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

// Validar que los datos requeridos no estén vacíos
if (!$nro_cliente || !$dni_cliente || !$mensaje_ticket) {
    echo json_encode([
        'status' => 'error',
        'message' => 'Faltan datos necesarios'
    ]);
    exit;
}

// Simular una respuesta exitosa para testing
echo json_encode([
    'status' => 'success',
    'message' => 'Ticket creado exitosamente (modo test)',
    'ticket_id' => '12345',
    'ticket_number' => 'TKT-2024-' . str_pad(rand(1, 999), 3, '0', STR_PAD_LEFT)
]);

?>



