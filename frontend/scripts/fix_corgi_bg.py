#!/usr/bin/env python3
"""Aggressive checker-pattern removal for `corgi_superhero.png` and
`corgi_astronaut.png`.

Both PNGs still have the AI-baked transparent-preview checker pattern drawn
as opaque pixels behind the corgi. Previous cleanup passes missed them
because their greys sit slightly outside the tolerance of the corner-sample
detector.

Strategy: flood-fill from every edge pixel that already registers as a
"checker grey" candidate. That gives us the connected background region
without ever touching any pixel inside the corgi silhouette (so the
astronaut helmet visor's transparent grey shading is preserved).

To be safe the flood-fill also treats *very light* pixels (near-white
or ~50% grey) as background — the AI's checker uses two alternating shades.
Anything the fill can't reach from an edge is left alone.
"""
from pathlib import Path
from PIL import Image
import numpy as np
from collections import deque

TARGETS = [
    "corgi_superhero.png",
    "corgi_astronaut.png",
]

ASSETS = Path("/app/frontend/public/assets")


def is_checker_pixel(r: int, g: int, b: int, a: int) -> bool:
    """Return True if the pixel looks like AI-drawn checker background."""
    if a == 0:
        return True  # already transparent — extend the fill through it
    mx = max(r, g, b)
    mn = min(r, g, b)
    if (mx - mn) > 25:  # coloured pixel — never background
        return False
    # Two shades of the AI checker: light (~230) and mid (~205 or ~185)
    if mn >= 175 and mx <= 250:
        return True
    return False


def flood_clear(name: str) -> None:
    p = ASSETS / name
    im = Image.open(p).convert("RGBA")
    arr = np.array(im)
    h, w = arr.shape[:2]
    r, g, b, a = arr[..., 0], arr[..., 1], arr[..., 2], arr[..., 3]

    # Precompute per-pixel candidate mask (avoids re-evaluating in the BFS).
    # The AI baked TWO shades of grey into these two files: a darker one
    # (~86-99) and a lighter one (~175+). We accept both shades as flood-fill
    # candidates, but stay well above the corgi outline's near-black range
    # (mx <= 55) so we never eat into the artwork's outline.
    mx = np.maximum(np.maximum(r, g), b).astype(int)
    mn = np.minimum(np.minimum(r, g), b).astype(int)
    grey = (mx - mn) <= 25
    checker_shade = (mn >= 60) & (mx <= 250)
    candidate = (a == 0) | (grey & checker_shade)

    visited = np.zeros((h, w), dtype=bool)
    q = deque()
    # Seed the queue with every edge pixel that is a candidate.
    for x in range(w):
        for y in (0, h - 1):
            if candidate[y, x] and not visited[y, x]:
                visited[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if candidate[y, x] and not visited[y, x]:
                visited[y, x] = True
                q.append((y, x))

    while q:
        y, x = q.popleft()
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx] and candidate[ny, nx]:
                visited[ny, nx] = True
                q.append((ny, nx))

    # Zero alpha on every visited pixel + zero its RGB so raw viewers show
    # pure transparency too.
    arr[visited, 0] = 0
    arr[visited, 1] = 0
    arr[visited, 2] = 0
    arr[visited, 3] = 0

    # Trim to the visible bounding box so the sprite is centred cleanly.
    a2 = arr[..., 3]
    ay = np.where(np.any(a2 > 5, axis=1))[0]
    ax = np.where(np.any(a2 > 5, axis=0))[0]
    if ay.size and ax.size:
        arr = arr[ay[0]:ay[-1] + 1, ax[0]:ax[-1] + 1]

    Image.fromarray(arr, "RGBA").save(p, "PNG", optimize=True)
    print(f"[ok  ] {name}: cleared {int(visited.sum())} bg pixels -> final {arr.shape[1]}x{arr.shape[0]}")


def main():
    for name in TARGETS:
        flood_clear(name)


if __name__ == "__main__":
    main()
