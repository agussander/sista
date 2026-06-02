<?php

// Configuración de la API de IspCube
// IMPORTANTE: Reemplaza estos valores con los reales de tu instalación de IspCube

// URL base de la API de IspCube
define('ISPCUBE_API_URL', 'https://tickets.sista.ar/api');

// Token de autenticación de la API
// Obtén este token desde el panel de administración de IspCube
define('ISPCUBE_API_TOKEN', 'tu_token_de_autenticacion_aqui');

// Configuración de timeouts y reintentos
define('ISPCUBE_TIMEOUT', 30);
define('ISPCUBE_MAX_REDIRECTS', 10);

// Configuración de tickets por defecto
define('DEFAULT_TICKET_PRIORITY', 'normal');
define('DEFAULT_TICKET_CATEGORY', 'baja_servicio');
define('DEFAULT_TICKET_SOURCE', 'web_form');

?>



