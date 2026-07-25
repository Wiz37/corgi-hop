#!/usr/bin/env python3
"""Erase the cartoon faces the AI baked into rock.png and flower_yellow.png.

The generator drew tiny eyes + smiles on background props. To keep the world
feeling like a countryside scene (not a face menagerie) we paint them out with
the dominant surrounding colour of each rock / petal.

Approach:
  1. Convert to numpy.
  2. Inside the central 60% region of the sprite, detect the FEATURE PIXELS:
     - near-black eyes / mouth (`max(r,g,b) < 60`)
     - near-white eye whites (`min(r,g,b) > 220` AND alpha=255)
  3. Grow the mask by a few pixels so we cover the anti-aliased edges too.
  4. Inpaint each feature pixel with the median colour of its neighbourhood
     (a 15×15 window).
"""
from pathlib import Path
from PIL import Image
import numpy as np

ASSETS = Path("/app/frontend/public/assets")


def dilate(mask: np.ndarray, k: int) -> np.ndarray:
    """Naive binary dilation by `k` pixels (no scipy dependency)."""
    out = mask.copy()
    for _ in range(k):
        shifted = np.zeros_like(out)
        shifted[:-1, :] |= out[1:, :]
        shifted[1:, :]  |= out[:-1, :]
        shifted[:, :-1] |= out[:, 1:]
        shifted[:, 1:]  |= out[:, :-1]
        out |= shifted
    return out


def inpaint_from_neighbours(arr: np.ndarray, mask: np.ndarray, radius: int = 8) -> np.ndarray:
    """Replace RGB channels of masked pixels with the median of a KxK window
    (excluding other masked pixels)."""
    r, g, b, a = arr[..., 0], arr[..., 1], arr[..., 2], arr[..., 3]
    out = arr.copy()
    ys, xs = np.where(mask)
    for y, x in zip(ys, xs):
        y0, y1 = max(0, y - radius), min(arr.shape[0], y + radius + 1)
        x0, x1 = max(0, x - radius), min(arr.shape[1], x + radius + 1)
        window_mask = ~mask[y0:y1, x0:x1] & (a[y0:y1, x0:x1] > 0)
        if window_mask.any():
            samples_r = r[y0:y1, x0:x1][window_mask]
            samples_g = g[y0:y1, x0:x1][window_mask]
            samples_b = b[y0:y1, x0:x1][window_mask]
            out[y, x, 0] = int(np.median(samples_r))
            out[y, x, 1] = int(np.median(samples_g))
            out[y, x, 2] = int(np.median(samples_b))
    return out


def erase_face(name: str, region_frac: tuple[float, float, float, float] = (0.15, 0.15, 0.7, 0.7)) -> None:
    """region_frac = (left, top, width, height) fractions of the image."""
    p = ASSETS / name
    if not p.exists():
        print(f"[skip] {name} missing")
        return
    im = Image.open(p).convert("RGBA")
    arr = np.array(im)
    h, w = arr.shape[:2]

    # Restrict feature detection to the central region so we don't nuke the
    # outer outline stroke.
    lx, ly, rw, rh = region_frac
    x0, y0 = int(w * lx), int(h * ly)
    x1, y1 = x0 + int(w * rw), y0 + int(h * rh)
    region = arr[y0:y1, x0:x1]

    r, g, b, a = region[..., 0], region[..., 1], region[..., 2], region[..., 3]
    mx = np.maximum(np.maximum(r, g), b).astype(int)
    mn = np.minimum(np.minimum(r, g), b).astype(int)
    is_near_black = (mx < 70) & (a > 0)
    is_near_white = (mn > 220) & (a > 0)
    feature_mask_region = is_near_black | is_near_white

    # Build a full-image mask
    mask = np.zeros((h, w), dtype=bool)
    mask[y0:y1, x0:x1] = feature_mask_region
    mask = dilate(mask, 3)

    if not mask.any():
        print(f"[skip] {name}: no face features detected")
        return

    fixed = inpaint_from_neighbours(arr, mask, radius=10)
    Image.fromarray(fixed, "RGBA").save(p, "PNG", optimize=True)
    print(f"[ok  ] {name}: repainted {int(mask.sum())} feature pixels")


def main():
    # Rock: face is roughly in the upper-central area
    erase_face("rock.png", region_frac=(0.15, 0.15, 0.7, 0.6))
    # Yellow flowers: multiple small faces at the centre of each petal cluster,
    # so we search the full central band.
    erase_face("flower_yellow.png", region_frac=(0.20, 0.20, 0.60, 0.55))


if __name__ == "__main__":
    main()
