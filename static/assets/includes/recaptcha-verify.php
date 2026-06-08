<?php
/**
 * Verificación server-side de reCAPTCHA v3.
 * Extraído del flujo de form-handler.php para reusar en endpoints nuevos
 * sin tocar las forms existentes.
 */
if (!function_exists('verify_recaptcha')) {
    /**
     * @param  string|null $token    Token g-recaptcha-response del cliente
     * @param  string|null $remoteip IP del cliente (opcional)
     * @return array{ok: bool, reason: string, score: float|null}
     */
    function verify_recaptcha($token, $remoteip = null) {
        $token = is_string($token) ? trim($token) : '';
        if ($token === '') {
            return ['ok' => false, 'reason' => 'empty', 'score' => null];
        }

        $secretKey = getenv('RECAPTCHA_SECRET_KEY') ?: '';
        if ($secretKey === '') {
            error_log('verify_recaptcha: RECAPTCHA_SECRET_KEY no configurada');
            return ['ok' => false, 'reason' => 'config', 'score' => null];
        }

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, 'https://www.google.com/recaptcha/api/siteverify');
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
            'secret'   => $secretKey,
            'response' => $token,
            'remoteip' => $remoteip,
        ]));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        $raw = curl_exec($ch);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($curlError) {
            error_log('verify_recaptcha cURL error: ' . $curlError);
            return ['ok' => false, 'reason' => 'network', 'score' => null];
        }

        $data = json_decode($raw, true);
        if (!$data || !isset($data['success'])) {
            error_log('verify_recaptcha respuesta inválida: ' . $raw);
            return ['ok' => false, 'reason' => 'invalid', 'score' => null];
        }

        $score = isset($data['score']) ? (float) $data['score'] : null;
        if (!$data['success']) {
            return ['ok' => false, 'reason' => 'failed', 'score' => $score];
        }
        if ($score !== null && $score < 0.5) {
            return ['ok' => false, 'reason' => 'low_score', 'score' => $score];
        }
        return ['ok' => true, 'reason' => 'ok', 'score' => $score];
    }
}
