#!/usr/bin/env python3
"""Second-pass cleanup for the parallax background PNGs.

The first-pass `postprocess_assets.py` clears the mid-grey checkerboard, but
the AI outputs sometimes leave scattered near-WHITE speckle noise in the
areas that should be transparent (visible as static "grain" in the sky and
mountain areas of the game). This script does a targeted cleanup for those
specific background PNGs: any pixel above a brightness threshold that sits
in the top half of the image (where "sky-through" transparency belongs) gets
its alpha zeroed.

We only touch the four PNGs where this problem was observed and only clear
pixels that are near-white AND near-grey (low saturation) so we never erase
real cartoon highlights.
"""
from pathlib import Path
from PIL import Image
import numpy as np

ASSETS = Path("/app/frontend/public/assets")

# (filename, top_fraction) — clear speckles ONLY inside the top fraction of the
# image (that's the area that's supposed to be transparent).
TARGETS = [
    ("bg_mountains.png", 0.55),
    ("bg_grass.png", 0.45),
    ("bg_foreground.png", 0.45),
    ("bg_hills.png", 0.35),
    ("bg_clouds.png", 1.0),   # the WHOLE cloud strip should be alpha where not cloud
]

def clean_speckles(name: str, top_frac: float) -> None:
    p = ASSETS / name
    if not p.exists():
        print(f"[skip] {name} missing")
        return
    im = Image.open(p).convert("RGBA")
    arr = np.array(im)
    h, w = arr.shape[:2]
    r, g, b, a = arr[..., 0], arr[..., 1], arr[..., 2], arr[..., 3]
    cutoff = int(h * top_frac)

    mx = np.maximum(np.maximum(r, g), b).astype(int)
    mn = np.minimum(np.minimum(r, g), b).astype(int)
    # Near-grey pixels
    grey = (mx - mn) <= 30
    # Near-white pixels (specks)
    near_white = (mn >= 200) & (mx >= 220)
    # Only affect the top region
    row_mask = np.zeros((h, w), dtype=bool)
    row_mask[:cutoff, :] = True
    kill = grey & near_white & row_mask
    a2 = a.copy()
    a2[kill] = 0
    arr[..., 3] = a2
    Image.fromarray(arr, "RGBA").save(p, "PNG", optimize=True)
    print(f"[ok  ] {name}: cleared {int(kill.sum())} speckle pixels in top {int(top_frac*100)}%")


def main():
    for name, frac in TARGETS:
        clean_speckles(name, frac)


if __name__ == "__main__":
    main()
