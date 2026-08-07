#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Deploy del sitio LEGACY (SvelteKit estático) por FTP.
#
# OJO: este NO es el deploy principal. El sitio vive en Hostinger como app Node
# y se despliega solo con `git push` (ver DEPLOY.md). Esto quedó para el sitio
# legacy de sista.com.ar, que se actualiza a mano y cada vez menos.
#
# Genera el build ESTÁTICO (`npm run build:static` -> `build-static/`) y lo sube
# por FTP a sista.ar, a las carpetas httpdocs y sista.com.ar. La subida es
# INCREMENTAL: lftp compara local vs remoto y sólo transfiere los archivos
# nuevos o que cambiaron (por tamaño).
#
# Uso:
#   ./deploy.sh                 build + subida incremental a las 2 carpetas
#   ./deploy.sh --no-build      no regenera el build, sube lo que ya hay en build-static/
#   ./deploy.sh --dry-run       muestra qué subiría/borraría, sin tocar el server
#   ./deploy.sh --delete        además borra del server lo que ya no existe local
#   ./deploy.sh --full          re-sube TODO (ignora la comparación)
#   ./deploy.sh --help
#
# Requisito: lftp  ->  brew install lftp
# Credenciales: archivo .deploy.env (ver .deploy.env.example).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Config / credenciales ───────────────────────────────────────────────────
if [[ -f "$SCRIPT_DIR/.deploy.env" ]]; then
  set -a; # shellcheck disable=SC1091
  source "$SCRIPT_DIR/.deploy.env"; set +a
fi

FTP_HOST="${FTP_HOST:-sista.ar}"
FTP_PORT="${FTP_PORT:-21}"
FTP_USER="${FTP_USER:-agustin}"
FTP_PASS="${FTP_PASS:-}"
FTP_SSL="${FTP_SSL:-true}"
FTP_PARALLEL="${FTP_PARALLEL:-2}"   # transferencias en paralelo. Bajo = más amable
                                    # con servers que limitan conexiones (este lo hace).
LOCAL_DIR="${LOCAL_DIR:-build-static}"
REMOTE_DIRS=("httpdocs" "sista.com.ar")

# ── Flags ───────────────────────────────────────────────────────────────────
DO_BUILD=1; FULL=0; DELETE=0; DRYRUN=0
for arg in "$@"; do
  case "$arg" in
    --no-build) DO_BUILD=0 ;;
    --full)     FULL=1 ;;
    --delete)   DELETE=1 ;;
    --dry-run)  DRYRUN=1 ;;
    -h|--help)
      # imprime el bloque de comentarios del encabezado (hasta la 1ra línea sin #)
      awk 'NR==1{next} /^#/{sub(/^# ?/,""); print; next} {exit}' "$0"
      exit 0 ;;
    *) echo "Opción desconocida: $arg  (probá --help)" >&2; exit 2 ;;
  esac
done

# ── Validaciones ─────────────────────────────────────────────────────────────
if ! command -v lftp >/dev/null 2>&1; then
  echo "✖ Falta 'lftp'. Instalalo con:" >&2
  echo "    brew install lftp" >&2
  exit 1
fi
if [[ -z "$FTP_PASS" ]]; then
  echo "✖ No hay contraseña. Definí FTP_PASS en .deploy.env (copiá .deploy.env.example)." >&2
  exit 1
fi

# ── Build ─────────────────────────────────────────────────────────────────────
if [[ "$DO_BUILD" -eq 1 ]]; then
  echo "▶ Generando build estático (npm run build:static)…"
  npm run build:static
fi
if [[ ! -d "$LOCAL_DIR" ]]; then
  echo "✖ No existe la carpeta '$LOCAL_DIR/'. Corré el build primero (sin --no-build)." >&2
  exit 1
fi

# ── Guard: nunca subir un build Node por FTP ─────────────────────────────────
# El hosting legacy es Apache: un build de adapter-node ahí no arranca, y encima
# publicaría el código del server como archivos sueltos. Como `npm run build`
# ahora ES el build Node, un LOCAL_DIR mal apuntado es un error plausible y
# destructivo (sobrescribe producción por FTP). Se chequea la forma del
# directorio, no el nombre.
if [[ -f "$LOCAL_DIR/server.js" || -f "$LOCAL_DIR/handler.js" || -d "$LOCAL_DIR/prerendered" ]]; then
  echo "✖ '$LOCAL_DIR/' parece un build NODE (tiene server.js/handler.js/prerendered/)." >&2
  echo "  Esto es el deploy FTP del sitio legacy y necesita el build ESTÁTICO." >&2
  echo "  Corré 'npm run build:static' (sale a build-static/) y reintentá." >&2
  exit 1
fi
if [[ ! -f "$LOCAL_DIR/index.html" ]]; then
  echo "✖ '$LOCAL_DIR/' no tiene index.html: no parece un build estático. Abortado." >&2
  exit 1
fi

# ── Opciones de mirror ────────────────────────────────────────────────────────
#  --reverse      : subir (local -> remoto)
#  --no-perms     : no intentar fijar permisos (evita errores en hosting compartido)
#  --ignore-time  : comparar por tamaño/existencia, NO por fecha. Clave: cada build
#                   reescribe las fechas; los assets cambian de nombre por hash, así
#                   que sólo suben los archivos realmente nuevos o distintos.
MIRROR_FLAGS="--reverse --verbose --no-perms --parallel=$FTP_PARALLEL"
MIRROR_FLAGS+=" --exclude-glob .DS_Store --exclude-glob .git*"
[[ "$FULL"   -eq 0 ]] && MIRROR_FLAGS+=" --ignore-time"
[[ "$DELETE" -eq 1 ]] && MIRROR_FLAGS+=" --delete"
[[ "$DRYRUN" -eq 1 ]] && MIRROR_FLAGS+=" --dry-run"

[[ "$FULL"   -eq 1 ]] && echo "▶ Modo --full: se re-suben TODOS los archivos."
[[ "$DELETE" -eq 1 ]] && echo "▶ Modo --delete: se borrarán del server los archivos que ya no existen local."
[[ "$DRYRUN" -eq 1 ]] && echo "▶ Modo --dry-run: simulación, no se modifica nada en el server."

echo "▶ Subiendo $LOCAL_DIR/ a $FTP_HOST:$FTP_PORT → ${REMOTE_DIRS[*]}"

# ── Subida ────────────────────────────────────────────────────────────────────
{
  echo "set ftp:ssl-allow $FTP_SSL"
  echo "set ftp:ssl-protect-data true"
  echo "set ssl:verify-certificate no"
  echo "set ftp:passive-mode true"
  echo "set net:timeout 15"
  echo "set net:max-retries 3"
  echo "set net:reconnect-interval-base 5"
  for d in "${REMOTE_DIRS[@]}"; do
    echo "echo '── mirror -> $d ─────────────────────────────'"
    echo "mirror $MIRROR_FLAGS \"$LOCAL_DIR/\" \"$d/\""
  done
  echo "bye"
} | lftp -p "$FTP_PORT" -u "$FTP_USER,$FTP_PASS" "$FTP_HOST"

echo "✓ Deploy terminado."
