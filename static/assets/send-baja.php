<?php

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

// Acceder a los datos
$nro_cliente = $data['nro_cliente'] ?? null; // Usar null si no existe
$dni_cliente = $data['dni_cliente'] ?? null; // Usar null si no existe
$mensaje_ticket = $data['mensaje_ticket'] ?? null; // Usar null si no existe

// Asegúrate de que los datos requeridos no estén vacíos
if (!$nro_cliente || !$dni_cliente || !$mensaje_ticket) {
    echo json_encode([
        'status' => 'error',
        'message' => 'Faltan datos necesarios'
    ]);
    exit;
}

// Realizar la petición cURL a la API externa
$curl = curl_init();

curl_setopt_array($curl, [
    CURLOPT_URL => 'https://tickets.sista.ar/baja-cliente-web',
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_ENCODING => '',
    CURLOPT_MAXREDIRS => 10,
    CURLOPT_TIMEOUT => 30,
    CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
    CURLOPT_CUSTOMREQUEST => 'POST',
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json'
    ],
    CURLOPT_POSTFIELDS => json_encode([
        'nro_cliente' => $nro_cliente,
        'dni_cliente' => $dni_cliente,
        'mensaje_ticket' => $mensaje_ticket
    ]),
]);

$response = curl_exec($curl);
$http_code = curl_getinfo($curl, CURLINFO_HTTP_CODE); // Obtener el código de estado HTTP
$err = curl_error($curl);

curl_close($curl);

// Manejar la respuesta de la API externa
if ($err) {
    echo json_encode([
        'status' => 'error',
        'message' => 'Error en la solicitud a la API: ' . $err
    ]);
} else {
    // Interpretar la respuesta basada en el código de estado HTTP
    switch ($http_code) {
        case 200:
            $responseData = json_decode($response, true);
            echo json_encode([
                'status' => 'success',
                'message' => $responseData['message'] ?? 'Respuesta sin mensaje',
            ]);
            break;

        case 400:
            $responseData = json_decode($response, true);
            echo json_encode([
                'status' => 'error',
                'message' => $responseData['error'] ?? 'Error desconocido'
            ]);
            break;

        default:
            echo json_encode([
                'status' => 'error',
                'message' => 'Respuesta inesperada: ' . $http_code
            ]);
            break;
    }
}

?>
