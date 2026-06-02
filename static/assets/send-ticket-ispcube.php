<?php

require_once __DIR__ . '/includes/load_env.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

$base_url = rtrim(getenv('ISPCUBE_API_URL') ?: 'https://sista.ispcube.online', '/');
$auth_url = $base_url . '/api/sanctum/token';
$tickets_url = $base_url . '/tickets';
$username = getenv('ISPCUBE_USERNAME') ?: '';
$password = getenv('ISPCUBE_PASSWORD') ?: '';

// Configuración de timeouts y reintentos
$timeout = 30;
$max_redirects = 10;

// Configuración de tickets por defecto
$default_priority = 'normal';
$default_category = 'baja_servicio';
$default_source = 'web_form';

// Función para obtener token de autenticación (igual que en client-handler.php)
function getAuthToken() {
    global $auth_url, $username, $password;
    
    $login_data = [
        'username' => $username,
        'password' => $password
    ];
    
    $api_key = getenv('ISPCUBE_API_KEY') ?: '';
    $client_id = getenv('ISPCUBE_CLIENT_ID') ?: '734';
    $headers = [
        "Content-Type: application/json",
        "Accept: application/json",
        "api-key: $api_key",
        "client-id: $client_id",
        "login-type: api"
    ];
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $auth_url);
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($login_data));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    
    $response = curl_exec($ch);
    curl_close($ch);
    
    $response_data = json_decode($response, true);
    
    if (isset($response_data['data']['token'])) {
        return $response_data['data']['token'];
    }
    
    return null;
}

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
$bearer_token = $data['bearer_token'] ?? null;

// Validar que los datos requeridos no estén vacíos
if (!$nro_cliente || !$dni_cliente || !$mensaje_ticket) {
    echo json_encode([
        'status' => 'error',
        'message' => 'Faltan datos necesarios'
    ]);
    exit;
}

// Preparar los datos para enviar a la API de IspCube
$ticket_data = [
    'subject' => 'Solicitud de Baja - Cliente: ' . $nro_cliente,
    'description' => $mensaje_ticket,
    'customer_id' => $nro_cliente,
    'customer_dni' => $dni_cliente,
    // 'priority' => $default_priority,
    // 'category' => $default_category,
    // 'source' => $default_source,
    'form_type' => $form_type
];

// Usar el bearer token recibido o obtener uno nuevo si no se proporciona
if ($bearer_token) {
    $auth_token = $bearer_token;
    error_log("Usando token guardado: " . substr($bearer_token, 0, 20) . "...");
} else {
    // Fallback: obtener token de autenticación si no se proporciona
    error_log("No se recibió token, obteniendo uno nuevo...");
    $auth_token = getAuthToken();
    
    if (!$auth_token) {
        echo json_encode([
            'status' => 'error',
            'message' => 'Error al obtener token de autenticación'
        ]);
        exit;
    }
}

// Realizar la petición cURL a la API de IspCube
$curl = curl_init();

curl_setopt_array($curl, [
    CURLOPT_URL => $tickets_url,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_ENCODING => '',
    CURLOPT_MAXREDIRS => $max_redirects,
    CURLOPT_TIMEOUT => $timeout,
    CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
    CURLOPT_CUSTOMREQUEST => 'POST',
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $auth_token,
        'Accept: application/json',
        'api-key: ' . (getenv('ISPCUBE_API_KEY') ?: ''),
        'client-id: ' . (getenv('ISPCUBE_CLIENT_ID') ?: '734')
    ],
    CURLOPT_POSTFIELDS => json_encode($ticket_data),
]);

$response = curl_exec($curl);
$http_code = curl_getinfo($curl, CURLINFO_HTTP_CODE);
$err = curl_error($curl);

curl_close($curl);

// Manejar la respuesta de la API de IspCube
if ($err) {
    echo json_encode([
        'status' => 'error',
        'message' => 'Error en la solicitud a la API de IspCube: ' . $err
    ]);
} else {
    // Interpretar la respuesta basada en el código de estado HTTP
    switch ($http_code) {
        case 200:
        case 201:
            $responseData = json_decode($response, true);
            echo json_encode([
                'status' => 'success',
                'message' => 'Ticket creado exitosamente',
                'ticket_id' => $responseData['ticket_id'] ?? null,
                'ticket_number' => $responseData['ticket_number'] ?? null
            ]);
            break;

        case 400:
            $responseData = json_decode($response, true);
            echo json_encode([
                'status' => 'error',
                'message' => 'Error en los datos enviados: ' . ($responseData['error'] ?? 'Error desconocido')
            ]);
            break;

        case 401:
            echo json_encode([
                'status' => 'error',
                'message' => 'Error de autenticación con la API de IspCube'
            ]);
            break;

        case 403:
            echo json_encode([
                'status' => 'error',
                'message' => 'No tiene permisos para crear tickets'
            ]);
            break;

        case 422:
            $responseData = json_decode($response, true);
            echo json_encode([
                'status' => 'error',
                'message' => 'Datos de validación incorrectos: ' . ($responseData['errors'] ?? 'Error de validación')
            ]);
            break;

        default:
            echo json_encode([
                'status' => 'error',
                'message' => 'Error inesperado de la API: ' . $http_code,
                'response' => $response
            ]);
            break;
    }
}

// Manejo de errores de PHP
if (json_last_error() !== JSON_ERROR_NONE) {
    echo json_encode([
        'status' => 'error',
        'message' => 'Error al procesar JSON: ' . json_last_error_msg()
    ]);
}

?>
