<?php
require_once __DIR__ . '/../PHPMailer/PHPMailer.php';
require_once __DIR__ . '/../PHPMailer/SMTP.php';
require_once __DIR__ . '/../PHPMailer/Exception.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

class MailHandler {
    private const DEFAULT_RECIPIENT = 'info@sista.ar';

    private $to = self::DEFAULT_RECIPIENT;
    private $from_email;
    private $from_name = 'Web';
    private $reply_to = null;
    private $mailer;

    public function __construct() {
        require_once __DIR__ . '/load_env.php';

        $this->mailer = new PHPMailer(true);

        $host = getenv('SMTP_HOST') ?: 'mail.sista.ar';
        $port = (int) (getenv('SMTP_PORT') ?: 587);
        $user = getenv('SMTP_USER') ?: 'contactoweb@sista.com.ar';
        $pass = getenv('SMTP_PASSWORD') ?: '';

        $this->from_email = $user;

        $this->mailer->isSMTP();
        $this->mailer->Host = $host;
        $this->mailer->SMTPAuth = true;
        $this->mailer->Username = $user;
        $this->mailer->Password = $pass;
        $this->mailer->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $this->mailer->Port = $port;
        $this->mailer->AuthType = 'PLAIN';
        
        // Configuración de debug SMTP (0 = off, 1 = client messages, 2 = client and server messages)
        $this->mailer->SMTPDebug = 0;
        
        // Configuración adicional para mejorar compatibilidad
        $this->mailer->SMTPOptions = [
            'ssl' => [
                'verify_peer' => false,
                'verify_peer_name' => false,
                'allow_self_signed' => true
            ]
        ];
        
        // Timeouts más generosos
        $this->mailer->Timeout = 30;
        
        // Configuración general
        $this->mailer->CharSet = 'UTF-8';
        $this->mailer->isHTML(true);
        
        // Configuración del remitente por defecto
        $this->mailer->setFrom($this->from_email, $this->from_name);
    }

    public function setReplyTo($email) {
        $this->reply_to = $email;
        return $this;
    }

    public function setFrom($email, $name = '') {
        $this->from_email = $email;
        $this->from_name = $name ?: $email;
        return $this;
    }

    public function setTo($email) {
        $this->to = $email;
        return $this;
    }


    private function buildHtmlBody($template, $data) {
        if (file_exists($template)) {
            $body = file_get_contents($template);
            // Si el template tiene [data], generamos la lista de datos con HTML simple (sin inputs/textarea)
            if (strpos($body, '[data]') !== false) {
                $dataList = '';
                foreach ($data as $key => $value) {
                    if ($key !== 'title' && !empty($value)) {
                        $label = ucfirst(str_replace(['_', '-'], ' ', $key));
                        // Convertir saltos de línea a <br> para HTML
                        $safeValue = htmlspecialchars($value, ENT_QUOTES);
                        $safeValue = nl2br($safeValue);
                        
                        $dataList .= "<li><span class='label'>{$label}:</span><div class='value'>{$safeValue}</div></li>\n";
                    }
                }
                $body = str_replace('[data]', $dataList, $body);
            }
            // Reemplazo de [title] y cualquier otro placeholder directo
            foreach ($data as $key => $value) {
                $body = str_replace("[{$key}]", $value, $body);
            }
            return $body;
        }
        return $this->buildDefaultTemplate($data);
    }

    private function buildDefaultTemplate($data) {
        $html = "<h2>{$data['title']}</h2>";
        unset($data['title']);
        
        foreach ($data as $key => $value) {
            if ($key !== 'title' && !empty($value)) {
                $label = ucfirst(str_replace('_', ' ', $key));
                $html .= "<p><strong>{$label}:</strong> {$value}</p>";
            }
        }
        
        return $html;
    }

    public function send($subject, $data, $template = null, $attachments = []) {
        try {
            ini_set('max_execution_time', 60);

            // Reiniciar destinatarios y adjuntos
            $this->mailer->clearAddresses();
            $this->mailer->clearAttachments();
            
            // Configurar remitente
            $this->mailer->setFrom($this->from_email, $this->from_name);
            
            // Configurar destinatario principal
            $this->mailer->addAddress($this->to);
            
            // Configurar reply-to si existe
            if ($this->reply_to) {
                $this->mailer->addReplyTo($this->reply_to);
            }
            
            // Configurar asunto
            $this->mailer->Subject = $subject;
            
            // Construir el cuerpo del mensaje
            if ($template && file_exists($template)) {
                $body = $this->buildHtmlBody($template, $data);
            } else {
                if ($template && !file_exists($template)) {
                    error_log('Template file not found: ' . $template);
                }
                $body = $this->buildDefaultTemplate($data);
            }
            $this->mailer->Body = $body;
            
            // Agregar archivos adjuntos
            foreach ($attachments as $attachment) {
                if (!empty($attachment['size'])) {
                    $this->mailer->addAttachment(
                        $attachment['tmp_name'],
                        $attachment['name'],
                        'base64',
                        $attachment['type']
                    );
                }
            }
            
            // Enviar el correo
            $result = $this->mailer->send();

            if (!$result) {
                $errorInfo = $this->mailer->ErrorInfo;
                error_log('PHPMailer send failed: ' . $errorInfo);
                return [
                    'success' => false,
                    'message' => 'error',
                    'error' => $errorInfo
                ];
            }

            return [
                'success' => true,
                'message' => 'success'
            ];
        } catch (Exception $e) {
            $errorMessage = $e->getMessage();
            $errorInfo = $this->mailer->ErrorInfo ?? $errorMessage;
            
            // Log del error completo
            error_log('MailHandler Exception: ' . $errorMessage);
            error_log('PHPMailer ErrorInfo: ' . $errorInfo);
            
            return [
                'success' => false,
                'message' => 'error',
                'error' => $errorInfo
            ];
        }
    }
} 