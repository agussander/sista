<?php
require_once __DIR__ . '/includes/form-handler.php';

$config = [
    'subject' => 'Empresas - Contacto web',
    'fields' => [
        'nombre' => 'Nombre',
        'tel' => 'Contacto',
        'empresa' => 'Empresa',
        'mensaje' => 'Mensaje'
    ],
    'optional_fields' => ['empresa', 'mensaje']
];

handle_form_submission($config);
?>
