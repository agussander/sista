#!/usr/bin/env python3
"""Downloads all DGO channel logos into static/assets/logos/<categoria>/."""
import json
import re
import sys
import urllib.request
from pathlib import Path

HERE = Path(__file__).parent


def slugify(s: str) -> str:
    s = s.strip().lower()
    s = (s.replace("á", "a").replace("é", "e").replace("í", "i")
           .replace("ó", "o").replace("ú", "u").replace("ñ", "n"))
    s = re.sub(r"[^a-z0-9]+", "_", s)
    return s.strip("_")


def main():
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "DGO-channels.json"
    if not src.is_absolute():
        src = HERE / src
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else HERE / "logos"
    if not out.is_absolute():
        out = HERE / out

    channels = json.loads(src.read_text(encoding="utf-8"))
    OUT = out
    OUT.mkdir(exist_ok=True)

    ok, failed = 0, 0
    for ch in channels:
        cat_dir = OUT / slugify(ch["categoria"])
        cat_dir.mkdir(exist_ok=True)

        ext = Path(ch["url_logo"]).suffix or ".png"
        base = slugify(ch["nombre"])
        dest = cat_dir / f"{base}{ext}"
        n = 2
        while dest.exists():
            dest = cat_dir / f"{base}_{n}{ext}"
            n += 1

        try:
            req = urllib.request.Request(
                ch["url_logo"],
                headers={"User-Agent": "Mozilla/5.0"},
            )
            with urllib.request.urlopen(req, timeout=20) as resp:
                dest.write_bytes(resp.read())
            ok += 1
            print(f"✓ {ch['categoria']} / {ch['nombre']}")
        except Exception as e:
            failed += 1
            print(f"✗ {ch['nombre']}: {e}", file=sys.stderr)

    print(f"\nDescargados: {ok} | Fallidos: {failed}")
    print(f"Carpeta: {OUT}")


if __name__ == "__main__":
    main()
