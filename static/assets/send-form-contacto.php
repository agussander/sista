<?php
require_once __DIR__ . '/includes/form-handler.php';

$config = [
    'subject' => 'Contacto Web',
    'fields' => [
        'nombre' => 'Nombre',
        'tel' => 'Contacto',
        'mensaje' => 'Mensaje'
    ]
];

handle_form_submission($config);
?>
