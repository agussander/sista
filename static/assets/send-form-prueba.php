<?php
// Clave del sitio de reCAPTCHA
$siteKey = '6Ld7gjEqAAAAAC-iqERMIvuYBJ02zSoW-3Dph7dQ';

// Captura el token de reCAPTCHA desde el formulario
$recaptchaResponse = isset($_POST['g-recaptcha-response']) ? $_POST['g-recaptcha-response'] : '';

// Verifica si el token de reCAPTCHA está presente
if (empty($recaptchaResponse)) {
    echo json_encode(['error' => true, 'message' => 'reCAPTCHA token is missing.']);
    exit;
}

// Verifica la respuesta de reCAPTCHA con Google
$apiKey = '6LdBk_YmAAAAAJAM7B2-HXaobQq3lyQt6u5hNDGa'; // Agrega tu clave de API aquí
$verifyURL = "https://recaptchaenterprise.googleapis.com/v1/projects/rare-hull-391814/assessments?key=$apiKey";
$data = [
    'event' => [
        'token' => $recaptchaResponse,
        'siteKey' => $siteKey,
        'expectedAction' => 'submit'
    ]
];

$options = [
    'http' => [
        'header' => "Content-Type: application/json\r\n",
        'method' => 'POST',
        'content' => json_encode($data),
    ],
];

$context = stream_context_create($options);
$verifyResponse = file_get_contents($verifyURL, false, $context);
$responseData = json_decode($verifyResponse);

// Verifica si reCAPTCHA fue exitoso
if ($responseData && isset($responseData->tokenProperties) && $responseData->tokenProperties->valid && isset($responseData->riskAnalysis) && $responseData->riskAnalysis->score >= 0.5) {
    // Captura los datos del formulario
    $text = isset($_POST['text']) ? trim($_POST['text']) : '';
    $check = isset($_POST['check']) ? trim($_POST['check']) : '';


    if (empty($text) || empty($check)) {
        echo json_encode(['error' => true, 'message' => 'Please complete all the fields']);
        exit;
    }

    // Configura los detalles del correo
    $to = 'agustinsander@gmail.com';
    $subject = 'New Contact Form Message';
    $headers = "Content-Type: text/html; charset=UTF-8\r\n";

    $body = "
    <h2>New message from contact form</h2>
    <p><strong>Name:</strong> $text</p>
    <p><strong>Email:</strong> $check</p>
    ";


    // Envía el correo y responde al frontend
    if (mail($to, $subject, $body, $headers)) {
        echo json_encode(['success' => true, 'message' => 'Your message has been sent successfully.']);
    } else {
        echo json_encode(['error' => true, 'message' => 'Sorry, there was an error sending your message.']);
    }
} else {
    // Devuelve un mensaje de error si la verificación de reCAPTCHA falla
    echo json_encode(['error' => true, 'message' => 'reCAPTCHA verification failed.', 'details' => $responseData]);
}
?>
