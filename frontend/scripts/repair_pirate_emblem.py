#!/usr/bin/env python3
"""
Repair the Pirate Corgi hat's skull-and-bones emblem.

Root cause: at some point during asset cleanup, near-white pixels inside the
black pirate hat (the skull outline + crossbones) had their alpha zeroed
along with the transparent margin. Result: the hat looks like it has holes
punched through where the skull should be white.

Surgical repair:
  For every fully-transparent, near-white pixel in the top ~40% of the image
  that is *surrounded* by opaque dark hat pixels within a small radius,
  restore alpha to 255 and keep the near-white RGB. Anything not surrounded
  by hat (i.e. exterior margin) is left transparent.

Only corgi_pirate.png is modified.
"""

from pathlib import Path
from PIL import Image

path = Path(__file__).resolve().parent.parent / "public" / "assets" / "corgi_pirate.png"

im = Image.open(path).convert("RGBA")
px = im.load()
w, h = im.size

# Restrict to top 45% of the image — the hat area. This prevents accidental
# repair of white belly pixels lower in the corgi's body.
scan_bottom = int(h * 0.45)

# Helper: is this pixel a "dark hat" pixel?
def is_dark_hat(c):
    r, g, b, a = c
    return a > 200 and r < 80 and g < 80 and b < 90


# Helper: is this pixel a near-white, fully transparent "hole"?
def is_transparent_white(c):
    r, g, b, a = c
    return a < 30 and r > 220 and g > 220 and b > 220


repaired = 0
# For every transparent-white pixel, count how many dark-hat pixels are within
# a small 10-px cross around it. If ≥ 3 of the 4 arms are dark hat, this
# pixel is inside the emblem — repair it.
R = 12
for y in range(0, scan_bottom):
    for x in range(0, w):
        c = px[x, y]
        if not is_transparent_white(c):
            continue
        hits = 0
        for dx, dy in ((R, 0), (-R, 0), (0, R), (0, -R), (R, R), (-R, -R), (R, -R), (-R, R)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h:
                if is_dark_hat(px[nx, ny]):
                    hits += 1
        if hits >= 3:
            px[x, y] = (245, 245, 245, 255)   # restore as bright white, fully opaque
            repaired += 1

# Also close small holes (1-2 px) by looking for transparent pixels
# with 3+ opaque neighbours (any color). Only inside the top 45%.
extra = 0
for _ in range(2):  # two passes to close deep holes
    for y in range(1, scan_bottom - 1):
        for x in range(1, w - 1):
            r, g, b, a = px[x, y]
            if a > 30:
                continue
            neigh = 0
            neigh_rgb = [0, 0, 0]
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
                nc = px[x + dx, y + dy]
                if nc[3] > 200:
                    neigh += 1
                    for i in range(3):
                        neigh_rgb[i] += nc[i]
            if neigh >= 6:
                avg = tuple(int(v / neigh) for v in neigh_rgb)
                px[x, y] = (*avg, 255)
                extra += 1

im.save(path, "PNG", optimize=True)
print(f"pirate emblem repair: restored {repaired} white pixels, closed {extra} 1-2px holes")
