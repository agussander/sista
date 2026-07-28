#!/usr/bin/env python3
"""
Escanea los archivos de datos de canales y marca logoBlanco: true en los
logos que son blancos/grises claros sobre transparencia, para que el
componente ChannelGrid.svelte les aplique filter: invert(1) en el tema claro.

Uso:
    python3 scripts/mark-white-logos.py

Requiere Pillow:
    pip install Pillow

Criterio: el logo es "blanco" si sus píxeles opacos son mayoría blancuzcos
(min(R,G,B) > 158) y la imagen tiene suficiente transparencia (> 12% del
total), lo que descarta JPG con fondo sólido y logos a color.

Volver a correr cada vez que se agreguen o reemplacen logos.
"""

import json
import os
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    raise SystemExit("Pillow no está instalado. Corré: pip install Pillow")

ROOT = Path(__file__).parent.parent
DATA_DIR = ROOT / "src" / "lib" / "data"
STATIC_DIR = ROOT / "static"

CHANNEL_FILES = [
    "dgo-channels.json",
    "dgo-lite-channels.json",
    "gigaredplay-channels.json",
    "antina-channels.json",
]


def es_blanco(img_path: Path) -> bool | None:
    """
    Devuelve True si el logo es blanco sobre transparencia, False si no,
    None si no se pudo abrir el archivo.
    """
    try:
        im = Image.open(img_path).convert("RGBA")
    except Exception:
        return None

    pixels = list(im.getdata())
    total = len(pixels)
    opac = white = transp = 0

    for r, g, b, a in pixels:
        if a < 32:
            transp += 1
            continue
        opac += 1
        if min(r, g, b) > 158:
            white += 1

    if opac == 0:
        return False

    return (transp / total) > 0.12 and (white / opac) > 0.55


def procesar(filename: str) -> None:
    path = DATA_DIR / filename
    if not path.exists():
        print(f"  SKIP (no existe): {filename}")
        return

    data = json.loads(path.read_text(encoding="utf-8"))
    blancos = faltantes = 0

    for canal in data:
        canal.pop("logoBlanco", None)
        url = canal.get("url_logo", "")
        img_path = STATIC_DIR / url.lstrip("/")
        resultado = es_blanco(img_path)
        if resultado is None:
            faltantes += 1
        elif resultado:
            canal["logoBlanco"] = True
            blancos += 1

    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"  {filename:<30} total {len(data):>3}  blancos {blancos:>2}  faltantes {faltantes}")


if __name__ == "__main__":
    print("Marcando logos blancos...\n")
    for f in CHANNEL_FILES:
        procesar(f)
    print("\nListo.")
