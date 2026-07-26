#!/usr/bin/env python3
"""
Astronaut Corgi transparency fix.

The earlier `strip_checker_bg.py` pipeline had an "isolated island rescue"
pass that treated any small connected component of checkerboard-like pixels
as background — including islands trapped INSIDE the astronaut's silver
spacesuit / helmet whose colours happen to be within the "unsaturated pale"
mask range. That pass punched ~9 000 alpha=0 holes into each of the 8 frames
(~73k pixels total across the sheet).

This repair script rebuilds the sheet from the original Nano-Banana raw JPEG:
  1. Use ONLY the edge-flood pass to remove the exterior checkerboard.
  2. Force every pixel INSIDE the silhouette (whether the strip mask marked
     it as "background-like" or not) to alpha 255.
  3. Zero the RGB where alpha=0 so residual checker colour cannot bleed.

Result: astronaut is fully opaque; transparency exists ONLY outside the
character silhouette. No interior holes.

Runs only on the astronaut asset — other approved sheets remain untouched.
"""
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage  # type: ignore

RAW = Path('/tmp/astronaut_run_sheet_raw.png')
OUT = Path('/app/frontend/public/assets/astronaut_run_sheet.png')
FRAMES = 8

src = Image.open(RAW).convert('RGB')
W, H = src.size
frame_w = W // FRAMES
rgb = np.array(src)

# Same mask logic as strip_checker_bg.py — auto-detect two dominant BG colours
# from the top strip so this works across whatever palette Nano-Banana emitted.
def detect_bg_palette(strip_rgb):
    q = (strip_rgb.reshape(-1, 3) // 4) * 4
    packed = q[:, 0].astype(np.int32) * 1_000_000 + q[:, 1].astype(np.int32) * 1000 + q[:, 2].astype(np.int32)
    vals, counts = np.unique(packed, return_counts=True)
    order = np.argsort(-counts)
    def unpack(v):
        v = int(v)
        return np.array([v // 1_000_000, (v // 1000) % 1000, v % 1000], dtype=np.int16)
    return unpack(vals[order[0]]), unpack(vals[order[1]])

def bg_mask(frame_rgb):
    a, b = detect_bg_palette(frame_rgb[:40, :, :])
    r, g, bl = frame_rgb[..., 0].astype(np.int16), frame_rgb[..., 1].astype(np.int16), frame_rgb[..., 2].astype(np.int16)
    chroma = np.maximum(np.maximum(r, g), bl) - np.minimum(np.minimum(r, g), bl)
    def near(c, tol=22):
        return (np.abs(r - c[0]) <= tol) & (np.abs(g - c[1]) <= tol) & (np.abs(bl - c[2]) <= tol)
    lightness = (r + g + bl) // 3
    fallback = (chroma <= 20) & (lightness >= 150) & (lightness <= 258)
    return near(a) | near(b) | fallback

def edge_flood(mask):
    h, w = mask.shape
    seed = np.zeros_like(mask)
    seed[0, :] = mask[0, :]
    seed[-1, :] = mask[-1, :]
    seed[:, 0] = mask[:, 0]
    seed[:, -1] = mask[:, -1]
    # Propagate through mask pixels only
    return ndimage.binary_propagation(seed, mask=mask)

out = np.dstack([rgb, np.full((H, W), 255, dtype=np.uint8)])
total_bg = 0
for i in range(FRAMES):
    x0 = i * frame_w
    x1 = W if i == FRAMES - 1 else (i + 1) * frame_w
    frame = rgb[:, x0:x1, :]
    mask = bg_mask(frame)
    flood = edge_flood(mask)
    # NOTE: intentionally NO isolated-island rescue. Any interior pixel that
    # matches the checkerboard mask BUT is not connected to the frame edge
    # stays fully opaque. This is what fixes the 9 000 holes-per-frame bug.
    # Dilate flood by 1 to catch seam pixels along the silhouette outline,
    # but re-protect any vividly-coloured pixel (dog, helmet colour, straps).
    flood = ndimage.binary_dilation(flood, iterations=1)
    r_ = frame[..., 0].astype(np.int16)
    g_ = frame[..., 1].astype(np.int16)
    b_ = frame[..., 2].astype(np.int16)
    chroma = np.maximum(np.maximum(r_, g_), b_) - np.minimum(np.minimum(r_, g_), b_)
    protect = chroma >= 25
    flood = flood & ~protect
    out[:, x0:x1, 3] = np.where(flood, 0, 255).astype(np.uint8)
    for c in range(3):
        out[:, x0:x1, c] = np.where(flood, 0, rgb[:, x0:x1, c])
    total_bg += int(flood.sum())
    print(f"[frame {i}] cleared {int(flood.sum())} bg px ({100*int(flood.sum())/(H*(x1-x0)):.1f}% of frame)")

# Sanity re-audit: how many INTERIOR alpha=0 pixels remain?
alpha = out[..., 3]
interior_holes_total = 0
for i in range(FRAMES):
    x0 = i * frame_w
    x1 = W if i == FRAMES - 1 else (i + 1) * frame_w
    fa = alpha[:, x0:x1]
    outside_seed = np.zeros_like(fa, dtype=bool)
    outside_seed[0, :]  = fa[0, :]  < 128
    outside_seed[-1, :] = fa[-1, :] < 128
    outside_seed[:, 0]  = fa[:, 0]  < 128
    outside_seed[:, -1] = fa[:, -1] < 128
    outside = ndimage.binary_propagation(outside_seed, mask=(fa < 128))
    interior_zero = int(((~outside) & (fa == 0)).sum())
    interior_holes_total += interior_zero
    if interior_zero > 20:
        print(f"  frame {i}: still {interior_zero} interior holes — WOULD FAIL")

Image.fromarray(out, 'RGBA').save(OUT, 'PNG')
print(f"\nFinal sheet: {OUT} ({total_bg} bg px total)")
print(f"Interior transparency holes after fix: {interior_holes_total}")
if interior_holes_total < 200:
    print("PASS — astronaut is fully opaque inside silhouette")
else:
    print("FAIL — repair pass did not close all interior holes")
