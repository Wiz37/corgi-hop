#!/usr/bin/env python3
"""
TARGETED cleanup for THREE specific corgi PNGs that still show the AI
generator's checkerboard/scratch artifacts on transparent areas:

  * corgi_fall.png
  * corgi_land.png
  * corgi_hit.png

Only these three files are modified. All other artwork (backgrounds, trees,
bushes, flowers, the 8-frame run sheet, jump, idle, premium corgis) is left
completely untouched.

Approach:
  1) Flood-fill from each corner of the image and delete any pixel that is
     a near-gray (200..250 grayscale) with high alpha — these are the
     checker cells surrounding the dog outline.
  2) Sweep any *isolated* checker pixels not connected to the corners
     (single grays inside the transparent margin).
  3) Snap edge alpha < 30 to 0.

Idempotent — re-running does not alter clean output.
"""

from pathlib import Path
from PIL import Image
from collections import deque

ASSETS = Path(__file__).resolve().parent.parent / "public" / "assets"
FILES = ["corgi_fall.png", "corgi_land.png", "corgi_hit.png"]


def is_bg(px):
    r, g, b, a = px
    if a == 0:
        return True
    # near-white
    if r > 225 and g > 225 and b > 225:
        return True
    # near-gray checker cells (140..245)
    if (
        abs(r - g) < 14
        and abs(g - b) < 14
        and abs(r - b) < 14
        and 140 <= r <= 245
    ):
        return True
    return False


def clean_file(path: Path) -> None:
    im = Image.open(path).convert("RGBA")
    px = im.load()
    w, h = im.size

    # Flood-fill from all four corners
    visited = [[False] * w for _ in range(h)]
    q = deque()
    for cx, cy in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        if is_bg(px[cx, cy]):
            q.append((cx, cy))
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or visited[y][x]:
            continue
        if not is_bg(px[x, y]):
            continue
        visited[y][x] = True
        px[x, y] = (0, 0, 0, 0)
        q.append((x + 1, y))
        q.append((x - 1, y))
        q.append((x, y + 1))
        q.append((x, y - 1))

    # Sweep isolated checker pixels not reached by the flood
    for y in range(h):
        for x in range(w):
            if not visited[y][x]:
                r, g, b, a = px[x, y]
                if is_bg(px[x, y]) and a > 200:
                    px[x, y] = (0, 0, 0, 0)

    # Snap edge alpha
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if 0 < a < 30:
                px[x, y] = (0, 0, 0, 0)

    im.save(path, "PNG", optimize=True)
    print(f"cleaned {path.name}")


def main() -> None:
    for f in FILES:
        p = ASSETS / f
        if not p.exists():
            print(f"skip missing {f}")
            continue
        clean_file(p)


if __name__ == "__main__":
    main()
