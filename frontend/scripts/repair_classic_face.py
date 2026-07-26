#!/usr/bin/env python3
"""
Repair transparent HOLES inside the Classic Corgi's face + body silhouettes
for the jump/fall/land/hit poses.

Root cause: an earlier global near-white cleanup zeroed the alpha of every
near-white pixel — including the corgi's white muzzle patch, whites of eyes,
tongue highlights, and paw pads — leaving see-through holes inside the
outlined body.

Surgical fix (idempotent): for every fully-transparent pixel that is
SURROUNDED by opaque dark outline pixels, restore alpha to 255 with a
white/near-white fill. Any transparent pixel NOT surrounded by outline is
left transparent (that's the legitimate background margin).

Only these Classic-corgi PNGs are modified:
  * corgi_jump.png
  * corgi_fall.png
  * corgi_land.png
  * corgi_hit.png
Also cleans corgi_run_sheet.png defensively (safe re-run — script no-ops
if there are no holes).
"""

from pathlib import Path
from PIL import Image

FILES = [
    "corgi_jump.png",
    "corgi_fall.png",
    "corgi_land.png",
    "corgi_hit.png",
    "corgi_run_sheet.png",
]
ASSETS = Path(__file__).resolve().parent.parent / "public" / "assets"


def is_dark_outline(c):
    r, g, b, a = c
    # Corgi's dark brown outline
    return a > 200 and r < 90 and g < 70 and b < 60


def is_hole(c):
    """Fully-transparent pixel — regardless of RGB (the earlier cleanup left
    RGB values intact but zeroed alpha)."""
    return c[3] < 30


def repair(path: Path) -> None:
    im = Image.open(path).convert("RGBA")
    px = im.load()
    w, h = im.size

    # For each transparent pixel, check if 4+ of 8 outward probes hit dark
    # outline within R pixels. That's a hole INSIDE the silhouette.
    R = max(14, min(w, h) // 40)
    probes = [(R, 0), (-R, 0), (0, R), (0, -R),
              (R, R), (-R, -R), (R, -R), (-R, R)]
    long_probes = [(R * 2, 0), (-R * 2, 0), (0, R * 2), (0, -R * 2)]

    repaired = 0
    for y in range(h):
        for x in range(w):
            if not is_hole(px[x, y]):
                continue
            hits = 0
            for dx, dy in probes:
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and is_dark_outline(px[nx, ny]):
                    hits += 1
            for dx, dy in long_probes:
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and is_dark_outline(px[nx, ny]):
                    hits += 1
            if hits >= 4:
                # Fill with the RGB that was already there (from the AI's
                # original white/cream), fully opaque. If RGB is near-black
                # (a zeroed pixel), use cream.
                r, g, b, _ = px[x, y]
                if r + g + b < 90:
                    px[x, y] = (250, 246, 232, 255)   # cream fallback
                elif r > 200 and g > 200 and b > 200:
                    px[x, y] = (r, g, b, 255)          # restore white
                else:
                    px[x, y] = (r, g, b, 255)          # restore whatever tone
                repaired += 1

    # Two-pass 1-2 px hole close (fills small gaps between adjacent opaque
    # pixels — smooths the eye whites and tongue highlights).
    extra = 0
    for _ in range(2):
        for y in range(1, h - 1):
            for x in range(1, w - 1):
                if px[x, y][3] > 30:
                    continue
                neigh = 0
                rr = gg = bb = 0
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1),
                               (1, 1), (-1, -1), (1, -1), (-1, 1)):
                    nc = px[x + dx, y + dy]
                    if nc[3] > 200:
                        neigh += 1
                        rr += nc[0]; gg += nc[1]; bb += nc[2]
                if neigh >= 6:
                    px[x, y] = (rr // neigh, gg // neigh, bb // neigh, 255)
                    extra += 1

    im.save(path, "PNG", optimize=True)
    print(f"{path.name}: repaired {repaired} holes, closed {extra} 1-2px gaps")


def main() -> None:
    for f in FILES:
        p = ASSETS / f
        if p.exists():
            repair(p)
        else:
            print(f"skip missing {f}")


if __name__ == "__main__":
    main()
