#!/usr/bin/env python3
"""Aggressively remove the cartoon face on rock.png.

The subtle-inpaint approach left eye outlines behind. This version:
1. Samples the median grey of the rock away from the face (the corners of the
   central region), gets a target rock colour + a gradient sample.
2. Paints an ellipse covering the face area with that colour, blending into
   the surrounding tones with a soft alpha mask so it looks natural.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

ASSETS = Path("/app/frontend/public/assets")


def flatten_rock_face() -> None:
    p = ASSETS / "rock.png"
    im = Image.open(p).convert("RGBA")
    arr = np.array(im)
    h, w = arr.shape[:2]

    # 1. Sample a "clean rock" patch just below the face (the smooth lower-mid).
    sample = arr[int(h * 0.55) : int(h * 0.75), int(w * 0.30) : int(w * 0.70), :3]
    # Filter out any black-outline pixels within the patch.
    mn = sample.min(axis=2)
    ok_mask = mn > 90
    clean = sample[ok_mask]
    if clean.size == 0:
        rock_rgb = (140, 140, 140)
    else:
        rock_rgb = tuple(int(v) for v in np.median(clean.reshape(-1, 3), axis=0))
    print(f"  rock target colour = {rock_rgb}")

    # 2. Build a soft ellipse mask centred on the face bounds.
    mask_layer = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(mask_layer)
    ex0, ey0 = int(w * 0.22), int(h * 0.20)
    ex1, ey1 = int(w * 0.80), int(h * 0.62)
    d.ellipse((ex0, ey0, ex1, ey1), fill=255)
    mask_layer = mask_layer.filter(ImageFilter.GaussianBlur(radius=14))

    # 3. Composite a flat rock rectangle over the face using that mask.
    flat = Image.new("RGBA", (w, h), rock_rgb + (0,))
    # Fill only where alpha is >0 so we don't spill outside the rock silhouette.
    flat_arr = np.array(flat)
    flat_arr[..., 3] = arr[..., 3]  # copy original alpha (keeps rock outline)
    flat_pil = Image.fromarray(flat_arr, "RGBA")

    result = Image.composite(flat_pil, im, mask_layer)
    result.save(p, "PNG", optimize=True)
    print(f"[ok  ] rock face flattened using {rock_rgb}")


def soften_flower_faces() -> None:
    """Same approach but tuned to yellow flower petals."""
    p = ASSETS / "flower_yellow.png"
    if not p.exists():
        return
    im = Image.open(p).convert("RGBA")
    arr = np.array(im)
    h, w = arr.shape[:2]

    # Any near-black feature pixel inside the flower area — replace with the
    # median orange colour of nearby non-black pixels.
    r, g, b, a = arr[..., 0], arr[..., 1], arr[..., 2], arr[..., 3]
    mx = np.maximum(np.maximum(r, g), b).astype(int)
    is_dark = (mx < 90) & (a > 0)
    # Only inside the flower area (drop the outer outline).
    inside = np.zeros_like(is_dark)
    inside[int(h * 0.28) : int(h * 0.72), int(w * 0.28) : int(w * 0.72)] = True
    mask = is_dark & inside
    if not mask.any():
        print("[skip] flower faces already clean")
        return

    # Sample the surrounding petal colour.
    petals = arr[..., :3][(mx > 180) & inside]
    petal_rgb = tuple(int(v) for v in np.median(petals.reshape(-1, 3), axis=0)) if petals.size else (255, 210, 60)
    out = arr.copy()
    out[mask, 0] = petal_rgb[0]
    out[mask, 1] = petal_rgb[1]
    out[mask, 2] = petal_rgb[2]
    Image.fromarray(out, "RGBA").save(p, "PNG", optimize=True)
    print(f"[ok  ] flower faces flattened using {petal_rgb} ({int(mask.sum())} px)")


if __name__ == "__main__":
    flatten_rock_face()
    soften_flower_faces()
