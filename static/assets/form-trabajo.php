<?php
require_once __DIR__ . '/includes/form-handler.php';

$config = [
    'subject' => 'Nueva postulación - ' . ($_POST['apellido'] ?? ''),
    'fields' => [
        'nombre' => 'Nombre',
        'apellido' => 'Apellido',
        'dni' => 'DNI',
        'nacimiento' => 'Fecha de Nacimiento',
        'telefono' => 'Teléfono',
        'mail' => 'Email',
        'puesto' => 'Puesto',
        'secundario' => 'Secundario',
        'formacion' => 'Formación Adicional',
        'experiencia' => 'Experiencia Laboral',
    ],
    'attachments' => isset($_FILES['curriculum']) && $_FILES['curriculum']['error'] === UPLOAD_ERR_OK
        ? [$_FILES['curriculum']]
        : [],
    'custom_recipient' => 'agustinsander@gmail.com',
    'reply_to' => $_POST['mail'] ?? null
];

handle_form_submission($config);
?>
