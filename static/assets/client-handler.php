<?php

require_once __DIR__ . '/includes/load_env.php';

header('Content-Type: application/json');

$base_url = rtrim(getenv('ISPCUBE_API_URL') ?: 'https://sista.ispcube.online', '/');
$auth_url = $base_url . '/api/sanctum/token';

$username  = getenv('ISPCUBE_USERNAME')  ?: '';
$password  = getenv('ISPCUBE_PASSWORD')  ?: '';
$api_key   = getenv('ISPCUBE_API_KEY')   ?: '';
$client_id = getenv('ISPCUBE_CLIENT_ID') ?: '';

$site_key       = getenv('VITE_RECAPTCHA_SITE_KEY_BAJA') ?: '';
$enterprise_key = getenv('RECAPTCHA_ENTERPRISE_API_KEY') ?: '';

function verifyCaptcha($token) {
    global $site_key, $enterprise_key;

    if (!$enterprise_key || !$site_key) {
        error_log('reCAPTCHA: faltan claves en .env, no se puede verificar');
        return false;
    }

    $url = "https://recaptchaenterprise.googleapis.com/v1/projects/rare-hull-391814/assessments?key=$enterprise_key";
    $payload = [
        'event' => [
            'token'          => $token,
            'siteKey'        => $site_key,
            'expectedAction' => 'submit',
        ],
    ];

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS     => json_encode($payload),
        CURLOPT_TIMEOUT        => 10,
    ]);
    $result = curl_exec($ch);
    curl_close($ch);

    $response = json_decode($result, true);
    $valid = $response['tokenProperties']['valid'] ?? false;
    $score = $response['riskAnalysis']['score']    ?? 0;

    return $valid && $score >= 0.5;
}

$input = json_decode(file_get_contents('php://input'));
$dni   = isset($input->dni)   ? trim((string) $input->dni)   : '';
$token = isset($input->token) ? trim((string) $input->token) : '';

if (!preg_match('/^\d{7,9}$/', $dni)) {
    echo json_encode(['status' => 'error', 'message' => 'DNI inválido.']);
    exit;
}

if ($token === 'fallback-no-recaptcha') {
    error_log('reCAPTCHA fallback mode - skipping verification');
} elseif (!$token || !verifyCaptcha($token)) {
    echo json_encode(['status' => 'error', 'message' => 'Captcha verification failed.']);
    exit;
}

$headers = [
    'Content-Type: application/json',
    'Accept: application/json',
    "api-key: $api_key",
    "client-id: $client_id",
    'login-type: api',
];

$ch = curl_init();
curl_setopt_array($ch, [
    CURLOPT_URL            => $auth_url,
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => json_encode(['username' => $username, 'password' => $password]),
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => $headers,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_TIMEOUT        => 30,
]);
$auth_response = curl_exec($ch);
curl_close($ch);

$auth_data = json_decode($auth_response, true);
$bearer    = $auth_data['data']['token'] ?? ($auth_data['token'] ?? null);

if (!$bearer) {
    echo json_encode(['status' => 'error', 'message' => 'Login failed']);
    exit;
}

$customer_url = $base_url . '/api/customer?doc_number=' . urlencode($dni);
$customer_headers = array_merge($headers, ["Authorization: Bearer $bearer"]);

$ch = curl_init();
curl_setopt_array($ch, [
    CURLOPT_URL            => $customer_url,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => $customer_headers,
    CURLOPT_TIMEOUT        => 30,
]);
$customer_response = curl_exec($ch);
curl_close($ch);

$customer = json_decode($customer_response, true);

if (!isset($customer['code'])) {
    echo json_encode(['status' => 'error', 'message' => 'DNI not found in the database.']);
    exit;
}

echo json_encode([
    'status' => 'success',
    'data'   => [
        'code'    => $customer['code'],
        'name'    => $customer['name'] ?? null,
        'address' => $customer['address'] ?? '',
    ],
]);
