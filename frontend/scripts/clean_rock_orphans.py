#!/usr/bin/env python3
"""
Conservative cleanup for rock.png — removes only the horizontal scratch
lines / speckles in the transparent margin. Does NOT flood into the rock's
interior gray fill.

Approach:
  1. Detect the largest connected opaque region (the rock itself), keep it
     100% intact.
  2. Kill EVERY pixel outside that main region.
"""

from pathlib import Path
from PIL import Image
from collections import deque

path = Path(__file__).resolve().parent.parent / "public" / "assets" / "rock.png"

im = Image.open(path).convert("RGBA")
px = im.load()
w, h = im.size

# Step 1: build a binary opacity mask (any pixel with alpha >= 40 is "on").
on = [[False] * w for _ in range(h)]
for y in range(h):
    for x in range(w):
        if px[x, y][3] >= 40:
            on[y][x] = True

# Step 2: find the largest connected on-component (using 4-neighbour BFS).
visited = [[False] * w for _ in range(h)]
best_component: set[tuple[int, int]] = set()
best_size = 0
for y in range(h):
    for x in range(w):
        if not on[y][x] or visited[y][x]:
            continue
        # BFS
        comp = []
        q = deque([(x, y)])
        while q:
            cx, cy = q.popleft()
            if cx < 0 or cy < 0 or cx >= w or cy >= h or visited[cy][cx]:
                continue
            if not on[cy][cx]:
                continue
            visited[cy][cx] = True
            comp.append((cx, cy))
            q.append((cx + 1, cy))
            q.append((cx - 1, cy))
            q.append((cx, cy + 1))
            q.append((cx, cy - 1))
        if len(comp) > best_size:
            best_size = len(comp)
            best_component = set(comp)

# Step 3: kill every pixel NOT in the main component.
kept = 0
killed = 0
for y in range(h):
    for x in range(w):
        if (x, y) in best_component:
            kept += 1
        else:
            if px[x, y][3] > 0:
                px[x, y] = (0, 0, 0, 0)
                killed += 1

im.save(path, "PNG", optimize=True)
print(f"rock.png: kept {kept} px in main component, cleared {killed} orphan px")
