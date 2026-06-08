<?php
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

// 1. Honeypot: si vino lleno, es bot
$honeypot = isset($_POST['website']) ? trim($_POST['website']) : '';
if ($honeypot !== '') {
    json_out(['success' => false, 'message' => 'spam']);
}

// 2. reCAPTCHA v3
$token = $_POST['g-recaptcha-response'] ?? '';
$captcha = verify_recaptcha($token, $_SERVER['REMOTE_ADDR'] ?? null);
if (!$captcha['ok']) {
    json_out(['success' => false, 'message' => 'recaptcha', 'reason' => $captcha['reason']]);
}

// 3. Validación de campos
$nombre = isset($_POST['nombre']) ? trim($_POST['nombre']) : '';
$numero = isset($_POST['numero']) ? trim($_POST['numero']) : '';
if ($nombre === '') {
    json_out(['success' => false, 'message' => 'incompleto', 'field' => 'nombre']);
}
if ($numero === '') {
    json_out(['success' => false, 'message' => 'incompleto', 'field' => 'numero']);
}
$nombre = mb_substr($nombre, 0, 80);
$numero = mb_substr($numero, 0, 40);

// 4. Write a PocketBase (fuente de verdad)
$pbUrl = rtrim(getenv('VITE_POCKETBASE_URL') ?: 'https://sista.pockethost.io', '/');
$pbEndpoint = $pbUrl . '/api/collections/quiero_que_me_llamen/records';

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $pbEndpoint);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['nombre' => $nombre, 'numero' => $numero]));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 10);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
$pbRaw = curl_exec($ch);
$pbStatus = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$pbError = curl_error($ch);
curl_close($ch);

if ($pbError || $pbStatus < 200 || $pbStatus >= 300) {
    error_log('send-llamenme pb error (' . $pbStatus . '): ' . ($pbError ?: $pbRaw));
    json_out(['success' => false, 'message' => 'pb']);
}

// 5. Email best-effort (el lead ya está guardado en pb)
try {
    $mailHandler = new MailHandler();
    $mailHandler->setTo('agustin@sista.ar');
    $templatePath = __DIR__ . '/correo_template.html';
    $mailResult = $mailHandler->send('Quiero que me llamen', [
        'title'  => 'Quiero que me llamen',
        'Nombre' => $nombre,
        'Numero' => $numero,
    ], $templatePath);
    if (empty($mailResult['success'])) {
        error_log('send-llamenme email falló: ' . ($mailResult['error'] ?? 'desconocido'));
    }
} catch (Throwable $e) {
    error_log('send-llamenme email excepción: ' . $e->getMessage());
}

// 6. OK
json_out(['success' => true]);
