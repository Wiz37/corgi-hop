#!/usr/bin/env python3
"""
STRONGER, MORE AGGRESSIVE opacity repair for every corgi asset.

Strategy — "fill from outside in":
  1) Build a boolean mask of "background" = every pixel reachable from
     any of the four corners via a flood fill through pixels with alpha < 30.
     That mask is the LEGITIMATE transparent margin outside the dog.
  2) EVERY pixel NOT in the background mask becomes fully opaque (alpha 255).
     Its RGB is kept if already present, otherwise averaged from its
     opaque neighbours.

This guarantees that everything inside the dog's outer silhouette is solid,
while everything outside stays transparent. The dark-brown outline naturally
seals the flood so it can't leak into the body.

Files repaired (idempotent):
  corgi_run_sheet.png (per-frame flood; sheet is 8 frames wide)
  corgi_jump.png
  corgi_fall.png
  corgi_land.png
  corgi_hit.png
  corgi_idle.png
  corgi_starter.png
  corgi_cowboy.png
  corgi_superhero.png
  corgi_pirate.png
  corgi_astronaut.png
"""
from pathlib import Path
from PIL import Image
from collections import deque

ASSETS = Path(__file__).resolve().parent.parent / "public" / "assets"
FILES = [
    "corgi_run_sheet.png", "corgi_jump.png", "corgi_fall.png",
    "corgi_land.png", "corgi_hit.png", "corgi_idle.png",
    "corgi_starter.png", "corgi_cowboy.png", "corgi_superhero.png",
    "corgi_pirate.png", "corgi_astronaut.png",
]
ALPHA_BG = 30


def flood_bg(px, w, h, x0, y0):
    """Return set of pixels reachable from (x0, y0) through alpha < ALPHA_BG."""
    if px[x0, y0][3] >= ALPHA_BG:
        return set()
    visited = set()
    q = deque([(x0, y0)])
    while q:
        x, y = q.popleft()
        if (x, y) in visited or x < 0 or y < 0 or x >= w or y >= h:
            continue
        if px[x, y][3] >= ALPHA_BG:
            continue
        visited.add((x, y))
        q.append((x + 1, y)); q.append((x - 1, y))
        q.append((x, y + 1)); q.append((x, y - 1))
    return visited


def repair_region(px, w, h, x0, x1, y0, y1):
    """Repair a single frame region [x0..x1)x[y0..y1)."""
    # Build background mask from the four corners of this region only.
    bg = set()
    for cx, cy in [(x0, y0), (x1 - 1, y0), (x0, y1 - 1), (x1 - 1, y1 - 1)]:
        bg |= flood_bg(px, w, h, cx, cy)
    if not bg:
        return 0
    # Everything inside the region NOT in bg must be opaque.
    filled = 0
    for y in range(y0, y1):
        for x in range(x0, x1):
            if (x, y) in bg:
                continue
            r, g, b, a = px[x, y]
            if a < 255:
                # Fill with existing RGB if plausible, otherwise average neighbours
                if a > 20 or (r + g + b > 45):
                    px[x, y] = (r, g, b, 255)
                else:
                    # Interpolate from opaque neighbours
                    rr = gg = bb = 0
                    n = 0
                    for dx in (-1, 0, 1):
                        for dy in (-1, 0, 1):
                            nx, ny = x + dx, y + dy
                            if 0 <= nx < w and 0 <= ny < h:
                                pc = px[nx, ny]
                                if pc[3] > 200:
                                    rr += pc[0]; gg += pc[1]; bb += pc[2]; n += 1
                    if n > 0:
                        px[x, y] = (rr // n, gg // n, bb // n, 255)
                    else:
                        px[x, y] = (245, 240, 225, 255)  # cream fallback
                filled += 1
    return filled


def repair_file(path: Path) -> None:
    im = Image.open(path).convert("RGBA")
    px = im.load()
    w, h = im.size
    if path.name == "corgi_run_sheet.png":
        # 8 frames horizontally
        fw = w // 8
        total = 0
        for i in range(8):
            total += repair_region(px, w, h, i * fw, (i + 1) * fw, 0, h)
        print(f"{path.name}: filled {total} pixels inside silhouette across 8 frames")
    else:
        total = repair_region(px, w, h, 0, w, 0, h)
        print(f"{path.name}: filled {total} pixels inside silhouette")
    im.save(path, "PNG", optimize=True)


def main() -> None:
    for f in FILES:
        p = ASSETS / f
        if p.exists():
            repair_file(p)


if __name__ == "__main__":
    main()
