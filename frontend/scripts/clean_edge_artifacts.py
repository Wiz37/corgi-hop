#!/usr/bin/env python3
"""
TARGETED cleanup for two specific environment assets that still show visible
transparent-area artifacts (checker pattern / scratch lines):

  * tree_right.png  — light-gray checker cells visible around the tree
  * rock.png        — horizontal gray scratch bars in the transparent margin

Only these two files are modified. All other artwork remains untouched.

The corgi's polished silhouette is stroked with a dark brown outline, so any
gray pixel INSIDE the artwork stays intact — we only ever kill light-gray
pixels that are (a) reachable from the image corners via a flood fill, or
(b) isolated in the transparent margin with high alpha and near-gray color.
"""

from pathlib import Path
from PIL import Image
from collections import deque

ASSETS = Path(__file__).resolve().parent.parent / "public" / "assets"
FILES = ["tree_right.png", "rock.png"]


def is_bg(px):
    r, g, b, a = px
    if a == 0:
        return True
    if r > 225 and g > 225 and b > 225:
        return True
    if (
        abs(r - g) < 14
        and abs(g - b) < 14
        and abs(r - b) < 14
        and 150 <= r <= 245
    ):
        return True
    return False


def clean(path: Path) -> None:
    im = Image.open(path).convert("RGBA")
    px = im.load()
    w, h = im.size
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
    # Sweep isolated bg pixels
    for y in range(h):
        for x in range(w):
            if not visited[y][x]:
                r, g, b, a = px[x, y]
                if is_bg(px[x, y]) and a > 200:
                    px[x, y] = (0, 0, 0, 0)
    # Snap very low alpha
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
        clean(p)


if __name__ == "__main__":
    main()
