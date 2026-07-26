#!/usr/bin/env python3
"""Comprehensive verification of transparent holes INSIDE the corgi silhouette
for every corgi PNG (poses + skins).

Method: build 'background' mask via flood fill from all four corners through
pixels with alpha<30. Any transparent pixel NOT reachable from the corners
is inside the outer silhouette — that is a HOLE.

For run_sheet, each of the 8 frames is verified independently.
Also composites each PNG over a dark checkerboard for visual verification.
"""
from pathlib import Path
from collections import deque
from PIL import Image, ImageDraw

ASSETS = Path("/app/frontend/public/assets")
OUT_DIR = Path("/app/test_reports/composites")
OUT_DIR.mkdir(parents=True, exist_ok=True)

FILES = [
    "corgi_run_sheet.png", "corgi_jump.png", "corgi_fall.png",
    "corgi_land.png", "corgi_hit.png", "corgi_idle.png",
    "corgi_starter.png", "corgi_cowboy.png", "corgi_superhero.png",
    "corgi_pirate.png", "corgi_astronaut.png",
]
ALPHA_BG = 30


def flood_bg_region(px, x0, x1, y0, y1):
    """Flood fill from the four corners of region [x0..x1)x[y0..y1).
    Returns set of pixel coords considered background."""
    bg = set()
    for sx, sy in [(x0, y0), (x1 - 1, y0), (x0, y1 - 1), (x1 - 1, y1 - 1)]:
        if px[sx, sy][3] >= ALPHA_BG:
            continue
        q = deque([(sx, sy)])
        while q:
            x, y = q.popleft()
            if (x, y) in bg:
                continue
            if x < x0 or y < y0 or x >= x1 or y >= y1:
                continue
            if px[x, y][3] >= ALPHA_BG:
                continue
            bg.add((x, y))
            q.append((x + 1, y)); q.append((x - 1, y))
            q.append((x, y + 1)); q.append((x, y - 1))
    return bg


def count_holes_region(px, x0, x1, y0, y1):
    bg = flood_bg_region(px, x0, x1, y0, y1)
    holes = 0
    for y in range(y0, y1):
        for x in range(x0, x1):
            if px[x, y][3] < ALPHA_BG and (x, y) not in bg:
                holes += 1
    return holes


def make_composite(im, path_out):
    w, h = im.size
    # Dark checkerboard, tile size scales with image
    tile = max(16, min(w, h) // 24)
    bg = Image.new("RGB", (w, h), (30, 30, 40))
    d = ImageDraw.Draw(bg)
    for y in range(0, h, tile):
        for x in range(0, w, tile):
            if ((x // tile) + (y // tile)) % 2 == 0:
                d.rectangle([x, y, x + tile - 1, y + tile - 1], fill=(60, 60, 75))
    bg.paste(im, (0, 0), im)
    # Downscale if huge
    if max(w, h) > 1500:
        s = 1500 / max(w, h)
        bg = bg.resize((int(w * s), int(h * s)), Image.LANCZOS)
    bg.save(path_out, "JPEG", quality=70)


results = {}
for f in FILES:
    p = ASSETS / f
    if not p.exists():
        print(f"{f}: MISSING")
        results[f] = {"missing": True}
        continue
    im = Image.open(p).convert("RGBA")
    px = im.load()
    w, h = im.size
    if f == "corgi_run_sheet.png":
        fw = w // 8
        per_frame = []
        total = 0
        for i in range(8):
            n = count_holes_region(px, i * fw, (i + 1) * fw, 0, h)
            per_frame.append(n)
            total += n
        verdict = "PASS" if total == 0 else f"FAIL ({total} holes)"
        print(f"{f}: size={w}x{h} 8-frames per_frame={per_frame} total_holes={total} -> {verdict}")
        results[f] = {"size": [w, h], "per_frame": per_frame, "holes": total,
                      "verdict": verdict}
    else:
        n = count_holes_region(px, 0, w, 0, h)
        verdict = "PASS" if n == 0 else f"FAIL ({n} holes)"
        print(f"{f}: size={w}x{h} holes_inside_silhouette={n} -> {verdict}")
        results[f] = {"size": [w, h], "holes": n, "verdict": verdict}
    # Composite
    out = OUT_DIR / (f.replace(".png", ".jpg"))
    make_composite(im, out)

print("\n=== SUMMARY ===")
total_holes = 0
for f, r in results.items():
    if r.get("missing"):
        print(f"  {f}: MISSING")
        continue
    total_holes += r["holes"]
    print(f"  {f}: {r['verdict']}")
print(f"\nTOTAL HOLES ACROSS ALL 11 PNGs: {total_holes}")
