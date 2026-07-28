<?php
// ─────────────────────────────────────────────────────────────────────────────
// Solicitud de baja.
// CONTINGENCIA: la casilla de correo fue eliminada, así que el SMTP no autentica.
// Para NO perder bajas, la fuente de verdad es PocketBase (colección "bajas").
// El email queda como best-effort: cuando se recree la casilla, vuelve solo.
// Patrón copiado de send-llamenme.php.
// ─────────────────────────────────────────────────────────────────────────────
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

require_once __DIR__ . '/includes/load_env.php';
require_once __DIR__ . '/includes/recaptcha-verify.php';
require_once __DIR__ . '/includes/MailHandler.php';

header('Content-Type: application/json');
ob_start();

function json_out($payload) {
    ob_clean();
    echo json_encode($payload);
    exit;
}

// 1. reCAPTCHA v3 (bloqueante)
$token = $_POST['g-recaptcha-response'] ?? '';
$captcha = verify_recaptcha($token, $_SERVER['REMOTE_ADDR'] ?? null);
if (!$captcha['ok']) {
    json_out(['success' => false, 'message' => 'recaptcha', 'reason' => $captcha['reason']]);
}

// 2. Validación: todos los campos son obligatorios
$campos = ['nombre', 'mail', 'tel', 'motivo'];
$datos = [];
foreach ($campos as $campo) {
    $valor = isset($_POST[$campo]) ? trim($_POST[$campo]) : '';
    if ($valor === '') {
        json_out(['success' => false, 'message' => 'incompleto', 'field' => $campo]);
    }
    $datos[$campo] = mb_substr($valor, 0, 2000);
}

// 3. Guardar en PocketBase (fuente de verdad). Todo en el campo "data" (json).
$pbUrl = rtrim(getenv('VITE_POCKETBASE_URL') ?: 'https://sista.pockethost.io', '/');
$pbEndpoint = $pbUrl . '/api/collections/bajas/records';

$payload = [
    'data' => [
        'nombre' => $datos['nombre'],
        'mail'   => $datos['mail'],
        'tel'    => $datos['tel'],
        'motivo' => $datos['motivo'],
        'origen' => $_SERVER['HTTP_HOST'] ?? null,
        'fecha'  => date('c'),
    ],
];

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $pbEndpoint);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 10);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
$pbRaw = curl_exec($ch);
$pbStatus = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$pbError = curl_error($ch);
curl_close($ch);

if ($pbError || $pbStatus < 200 || $pbStatus >= 300) {
    error_log('send-form-baja2 pb error (' . $pbStatus . '): ' . ($pbError ?: $pbRaw));
    json_out(['success' => false, 'message' => 'pb']);
}

// 4. Email best-effort (la baja ya quedó guardada en PocketBase)
try {
    $mailHandler = new MailHandler();
    $templatePath = __DIR__ . '/correo_template.html';
    $mailResult = $mailHandler->send('Solicitud de Baja - Web', [
        'title'    => 'Solicitud de Baja - Web',
        'Nombre'   => $datos['nombre'],
        'Teléfono' => $datos['tel'],
        'Email'    => $datos['mail'],
        'Motivo'   => $datos['motivo'],
    ], $templatePath);
    if (empty($mailResult['success'])) {
        error_log('send-form-baja2 email falló: ' . ($mailResult['error'] ?? 'desconocido'));
    }
} catch (Throwable $e) {
    error_log('send-form-baja2 email excepción: ' . $e->getMessage());
}

// 5. OK
json_out(['success' => true]);
