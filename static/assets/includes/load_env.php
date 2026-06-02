<?php
/**
 * Carga variables desde .env a putenv() para que getenv() las encuentre.
 * Busca .env en la raíz del proyecto (varios niveles arriba de static/assets).
 */
if (!function_exists('sista_load_env')) {
    function sista_load_env() {
        $paths = [
            __DIR__ . '/../../../.env',   // desde static/assets/includes/
            __DIR__ . '/../../.env',     // desde static/assets/
            __DIR__ . '/../.env',
            __DIR__ . '/.env',
        ];
        foreach ($paths as $path) {
            if (is_file($path) && is_readable($path)) {
                $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
                if ($lines === false) return;
                foreach ($lines as $line) {
                    $line = trim($line);
                    if ($line === '' || $line[0] === '#') continue;
                    if (strpos($line, '=') === false) continue;
                    list($name, $value) = explode('=', $line, 2);
                    $name = trim($name);
                    $value = trim($value);
                    if ($name === '') continue;
                    if ((strpos($value, '"') === 0 && substr($value, -1) === '"') || (strpos($value, "'") === 0 && substr($value, -1) === "'")) {
                        $value = substr($value, 1, -1);
                    }
                    putenv("$name=$value");
                    $_ENV[$name] = $value;
                }
                return;
            }
        }
    }
}
sista_load_env();
