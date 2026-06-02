<?php
// Configurar manejo de errores
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

require_once __DIR__ . '/load_env.php';
require_once __DIR__ . '/MailHandler.php';

header('Content-Type: application/json');

// Evitar que cualquier output antes del JSON cause problemas
ob_start();

function handle_form_submission($config) {
    $secretKey = getenv('RECAPTCHA_SECRET_KEY') ?: '';

    // Captura el token de reCAPTCHA
    $recaptchaResponse = isset($_POST['g-recaptcha-response']) ? $_POST['g-recaptcha-response'] : '';
    if (empty($recaptchaResponse)) {
        echo json_encode(['success' => false, 'message' => 'recaptcha']);
        exit;
    }

    // Verifica reCAPTCHA v3 según documentación oficial de Google
    $verifyURL = 'https://www.google.com/recaptcha/api/siteverify';
    $data = [
        'secret' => $secretKey, 
        'response' => $recaptchaResponse, 
        'remoteip' => $_SERVER['REMOTE_ADDR'] ?? null
    ];
    
    // Usar cURL para mejor manejo de errores (más robusto que file_get_contents)
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $verifyURL);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($data));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    
    $verifyResponse = curl_exec($ch);
    $curlError = curl_error($ch);
    curl_close($ch);
    
    if ($curlError) {
        error_log('reCAPTCHA cURL error: ' . $curlError);
        echo json_encode(['success' => false, 'message' => 'recaptcha', 'error' => 'Error de conexión']);
        exit;
    }
    
    $responseData = json_decode($verifyResponse, true);
    
    // Verificar que la respuesta sea válida
    if (!$responseData || !isset($responseData['success'])) {
        error_log('reCAPTCHA respuesta inválida: ' . $verifyResponse);
        echo json_encode(['success' => false, 'message' => 'recaptcha', 'error' => 'Respuesta inválida']);
        exit;
    }
    
    // Verificar éxito y score (reCAPTCHA v3 siempre incluye score)
    // Score de 0.0 a 1.0: 1.0 = muy probablemente humano, 0.0 = muy probablemente bot
    // Según documentación oficial de Google, umbral recomendado es 0.5
    $score = $responseData['score'] ?? null;
    
    if (!$responseData['success']) {
        // Verificar errores específicos de reCAPTCHA
        $errorCodes = $responseData['error-codes'] ?? [];
        error_log('reCAPTCHA error codes: ' . implode(', ', $errorCodes));
        echo json_encode(['success' => false, 'message' => 'recaptcha', 'error_codes' => $errorCodes]);
        exit;
    }
    
    // Verificar score solo si existe (reCAPTCHA v3 siempre lo incluye)
    if ($score !== null && $score < 0.5) {
        error_log('reCAPTCHA score bajo: ' . $score);
        echo json_encode(['success' => false, 'message' => 'recaptcha', 'score' => $score]);
        exit;
    }
    
    // Si score es null, podría ser reCAPTCHA v2 (no tiene score)
    // En este caso, solo verificamos success

    // Recopila y valida los datos del formulario
    $formData = ['title' => $config['subject']];
    foreach ($config['fields'] as $field => $label) {
        $value = isset($_POST[$field]) ? trim($_POST[$field]) : null;
        
        // Los campos no requeridos pueden estar vacíos
        $is_required = !in_array($field, $config['optional_fields'] ?? []);

        if ($is_required && empty($value)) {
            echo json_encode(['success' => false, 'message' => 'incompleto', 'field' => $field]);
            exit;
        }
        $formData[$label] = $value;
    }

    // Envía el correo
    $mailHandler = new MailHandler();

    // Configura destinatario personalizado si existe
    if (!empty($config['custom_recipient'])) {
        $mailHandler->setTo($config['custom_recipient']);
    }

    // Configura reply-to si existe
    if (!empty($config['reply_to'])) {
        $mailHandler->setReplyTo($config['reply_to']);
    }

    $templatePath = __DIR__ . '/../correo_template.html';
    $attachments = $config['attachments'] ?? [];
    $result = $mailHandler->send($config['subject'], $formData, $templatePath, $attachments);

    // Log del resultado para debugging
    if (!$result['success']) {
        error_log('Error enviando email: ' . ($result['error'] ?? 'Error desconocido'));
    }

    // Limpiar cualquier output buffer y enviar JSON
    ob_clean();
    echo json_encode($result);
    exit;
}
?> 