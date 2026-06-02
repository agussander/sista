#!/usr/bin/env python3
"""Extracts (categoria, nombre, url_logo) from the DGO modal outerHTML."""
import csv
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

HERE = Path(__file__).parent


class ChannelParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.current_category = None
        self.in_title_span = False
        self.in_channel_name_div = False
        self.channel_name_buffer = []
        self.pending_img_url = None
        self.rows = []  # (categoria, nombre, url)
        self._div_depth_since_circle = None

    def handle_starttag(self, tag, attrs):
        attrs_d = dict(attrs)
        cls = attrs_d.get("class", "")

        if tag == "span" and "content__title" in cls:
            self.in_title_span = True
            self._title_buffer = []
            return

        if tag == "img" and self.pending_img_url is None:
            src = attrs_d.get("src")
            if src and "directvgo" in src:
                self.pending_img_url = src
            return

        # After an img is captured, the next <div> with text is the channel name
        if tag == "div" and self.pending_img_url and not self.in_channel_name_div:
            # Only capture leaf divs without a class (the name container has no class)
            if "channel_list_circle" not in cls and "content_channels-list" not in cls:
                self.in_channel_name_div = True
                self.channel_name_buffer = []

    def handle_endtag(self, tag):
        if tag == "span" and self.in_title_span:
            self.in_title_span = False
            self.current_category = "".join(self._title_buffer).strip()
            return

        if tag == "div" and self.in_channel_name_div:
            name = "".join(self.channel_name_buffer).strip()
            name = re.sub(r"\s+", " ", name)
            if name and self.pending_img_url:
                self.rows.append((self.current_category or "", name, self.pending_img_url))
            self.in_channel_name_div = False
            self.pending_img_url = None
            self.channel_name_buffer = []

    def handle_data(self, data):
        if self.in_title_span:
            self._title_buffer.append(data)
        elif self.in_channel_name_div:
            self.channel_name_buffer.append(data)


def main():
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "DGO-outerhtml.html"
    if not src.is_absolute():
        src = HERE / src
    html = src.read_text(encoding="utf-8")
    p = ChannelParser()
    p.feed(html)

    stem = src.stem.replace("-outerhtml", "").replace("outerhtml", "") or src.stem
    stem = stem.rstrip("-") or "channels"

    # Write CSV
    csv_path = HERE / f"{stem}-channels.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["categoria", "nombre", "url_logo"])
        w.writerows(p.rows)

    # Write JSON
    json_path = HERE / f"{stem}-channels.json"
    json_path.write_text(
        json.dumps(
            [{"categoria": c, "nombre": n, "url_logo": u} for c, n, u in p.rows],
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    # Summary
    by_cat = {}
    for c, _, _ in p.rows:
        by_cat[c] = by_cat.get(c, 0) + 1
    print(f"Total canales: {len(p.rows)}")
    for c, n in by_cat.items():
        print(f"  - {c!r}: {n}")
    print(f"\nGenerado: {csv_path}")
    print(f"Generado: {json_path}")


if __name__ == "__main__":
    main()
