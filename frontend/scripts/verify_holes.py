#!/usr/bin/env python3
"""Verify transparent holes remaining INSIDE Classic Corgi silhouettes.

For each pose PNG, compute the count of fully-transparent pixels whose
8-direction outward probes hit at least 4 dark-brown outline pixels
within radius R. These are 'holes inside the silhouette'.
"""
from pathlib import Path
from PIL import Image

FILES = ["corgi_jump.png", "corgi_fall.png", "corgi_land.png", "corgi_hit.png", "corgi_run_sheet.png"]
ASSETS = Path("/app/frontend/public/assets")


def is_dark_outline(c):
    r, g, b, a = c
    return a > 200 and r < 90 and g < 70 and b < 60


def count_holes(path):
    im = Image.open(path).convert("RGBA")
    px = im.load()
    w, h = im.size
    R = max(14, min(w, h) // 40)
    probes = [(R, 0), (-R, 0), (0, R), (0, -R),
              (R, R), (-R, -R), (R, -R), (-R, R),
              (R * 2, 0), (-R * 2, 0), (0, R * 2), (0, -R * 2)]
    holes = 0
    for y in range(h):
        for x in range(w):
            if px[x, y][3] >= 30:
                continue
            hits = 0
            for dx, dy in probes:
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and is_dark_outline(px[nx, ny]):
                    hits += 1
                    if hits >= 4:
                        break
            if hits >= 4:
                holes += 1
    return holes, (w, h)


for f in FILES:
    p = ASSETS / f
    if not p.exists():
        print(f"{f}: MISSING")
        continue
    n, size = count_holes(p)
    verdict = "PASS" if n == 0 else f"FAIL ({n} holes)"
    print(f"{f}: size={size} holes_inside_silhouette={n} -> {verdict}")
