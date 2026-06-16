#!/usr/bin/env python3
"""Descarga los logos de DGO a static/images/dgo/ y reescribe los JSON a rutas locales.

Motivo: las url_logo apuntaban a la caché de Magento de DGO
(media.bss-prd.directvgo.com/.../cache/<hash>/...), que DGO regenera y deja en 404.
Los ORIGINALES (sin /cache/<hash>/) siguen vivos, así que bajamos esos y autohospedamos.

Idempotente: si el archivo ya existe no lo vuelve a bajar.
"""
import json
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]  # repo root
DEST_DIR = ROOT / "static" / "images" / "dgo"
PUBLIC_PREFIX = "/images/dgo"
JSON_FILES = [
    ROOT / "src" / "lib" / "data" / "dgo-channels.json",
    ROOT / "src" / "lib" / "data" / "dgo-lite-channels.json",
]
CACHE_RE = re.compile(r"/?cache/[a-f0-9]+/")


def original_url(url: str) -> str:
    """Quita el segmento /cache/<hash>/ para apuntar a la imagen original."""
    return CACHE_RE.sub("/", url)


def local_name(url: str) -> str:
    """Nombre de archivo local único derivado de la ruta tras product/."""
    path = url.split("media.bss-prd.directvgo.com/media/catalog/product/", 1)[-1]
    path = CACHE_RE.sub("", path)
    return re.sub(r"[/\\]+", "_", path)


def download(url: str, dest: Path) -> None:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        dest.write_bytes(r.read())


def main():
    DEST_DIR.mkdir(parents=True, exist_ok=True)
    ok = skipped = failed = 0
    for jf in JSON_FILES:
        data = json.loads(jf.read_text(encoding="utf-8"))
        for entry in data:
            url = entry.get("url_logo", "")
            if "media.bss-prd.directvgo.com" not in url:
                continue
            name = local_name(url)
            dest = DEST_DIR / name
            if not dest.exists():
                src = original_url(url)
                try:
                    download(src, dest)
                    ok += 1
                except Exception as e:  # noqa: BLE001
                    failed += 1
                    print(f"  FALLO {src} -> {e}", file=sys.stderr)
                    continue
            else:
                skipped += 1
            entry["url_logo"] = f"{PUBLIC_PREFIX}/{name}"
        jf.write_text(
            json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        print(f"Reescrito {jf.relative_to(ROOT)} ({len(data)} canales)")
    print(f"\nDescargados={ok}  ya_existían={skipped}  fallidos={failed}")
    print(f"Destino: {DEST_DIR.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
