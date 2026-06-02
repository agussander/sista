<?php
require_once __DIR__ . '/includes/form-handler.php';

$config = [
    'subject' => 'Solicitud de Baja - Web',
    'fields' => [
        'nombre' => 'Nombre',
        'tel' => 'Teléfono',
        'mail' => 'Email',
        'motivo' => 'Motivo'
    ],
];

handle_form_submission($config);
?>
