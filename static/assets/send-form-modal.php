<?php
require_once __DIR__ . '/includes/form-handler.php';

$config = [
    'subject' => 'Interesado en servicio - Web',
    'fields' => [
        'nombre' => 'Nombre',
        'contacto' => 'Contacto'
    ]
];

handle_form_submission($config);
?>
