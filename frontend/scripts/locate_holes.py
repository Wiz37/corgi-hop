#!/usr/bin/env python3
"""Locate remaining holes and report their positions + neighborhood."""
from pathlib import Path
from PIL import Image

FILES = ["corgi_land.png", "corgi_run_sheet.png"]
ASSETS = Path("/app/frontend/public/assets")


def is_dark_outline(c):
    r, g, b, a = c
    return a > 200 and r < 90 and g < 70 and b < 60


for f in FILES:
    im = Image.open(ASSETS / f).convert("RGBA")
    px = im.load()
    w, h = im.size
    R = max(14, min(w, h) // 40)
    probes = [(R, 0), (-R, 0), (0, R), (0, -R),
              (R, R), (-R, -R), (R, -R), (-R, R),
              (R * 2, 0), (-R * 2, 0), (0, R * 2), (0, -R * 2)]
    holes = []
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
                holes.append((x, y, hits))
    print(f"\n{f}: R={R}, size={w}x{h}, holes={len(holes)}")
    for (x, y, hh) in holes:
        # find bounding neighbors' alpha
        neigh_a = []
        for dy in range(-1, 2):
            for dx in range(-1, 2):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h:
                    neigh_a.append(px[nx, ny][3])
        print(f"  ({x},{y}) probe_hits={hh} rgba={px[x,y]} neighbor_alphas={neigh_a}")
