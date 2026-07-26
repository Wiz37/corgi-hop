#!/usr/bin/env python3
"""
Convert a Nano-Banana sprite-sheet PNG/JPG (with a baked-in gray/white
checkerboard "transparency indicator") into a true RGBA PNG where the
checkerboard cells are alpha 0.

Approach — edge-flood, per frame:
  1. Split the sheet into N equal-width frames (default 8).
  2. For each frame, compute a "checkerboard-like" mask from the pixel value
     (near light-gray ~ (210,210,210) or near white ~ (254,254,254) — both
     with very low chroma).
  3. Seed flood-fill from every pixel on the frame's border that satisfies
     the mask, then propagate through mask-only 4-connected neighbours.
  4. Set alpha 0 on the fill; everything else (dog + outfit) keeps alpha 255.

This preserves the dog's INTERIOR white belly / white outfit accents (they
are not connected to the frame border via checkerboard pixels).

Usage:
    python3 strip_checker_bg.py <in.png> <out.png> [--frames N]
"""

import argparse
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image


# Tuned tolerances for the Nano-Banana grey checkerboard.
LIGHT_GRAY = np.array([210, 210, 210])
WHITE = np.array([254, 254, 254])
CHROMA_MAX = 10     # max chroma allowed to still count as "grey"
GRAY_TOL = 18       # +/- around 210 to accept light-grey cell
WHITE_TOL = 12      # +/- around 254 to accept white cell


def detect_bg_palette(rgb: np.ndarray, band: int = 40) -> tuple[np.ndarray, np.ndarray]:
    """Sample a small strip along the top edge of the frame and return the
    two dominant "background" colours (checkerboard cell A and cell B). We
    assume the top ~40 px are guaranteed to be checkerboard because the
    corgi never reaches the very top of the canvas.
    """
    H, W, _ = rgb.shape
    strip = rgb[:band, :, :].reshape(-1, 3)
    # Very cheap dominant-colour extraction — round to nearest 4 and take the
    # two most common rounded triplets.
    q = (strip // 4) * 4
    packed = q[:, 0].astype(np.int32) * 1000000 + q[:, 1].astype(np.int32) * 1000 + q[:, 2].astype(np.int32)
    vals, counts = np.unique(packed, return_counts=True)
    order = np.argsort(-counts)
    top2 = vals[order[:2]]
    def unpack(v: int) -> np.ndarray:
        r = (v // 1000000)
        g = (v // 1000) % 1000
        b = v % 1000
        return np.array([r, g, b], dtype=np.int16)
    a, b = unpack(int(top2[0])), unpack(int(top2[1]))
    return a, b


def build_checker_mask(rgb: np.ndarray) -> np.ndarray:
    """Return a bool mask where True == "looks like the checkerboard bg".

    Auto-detects the two checkerboard colours from a horizontal strip of the
    frame's top edge so the same pipeline works for the many colour palettes
    that Nano Banana rotates through (light-grey+white, mid-grey+lighter
    grey, blue+lighter-blue, etc). We fall back to a "very desaturated pale"
    rule if palette detection can't find a bimodal signal.
    """
    r, g, b = rgb[..., 0].astype(np.int16), rgb[..., 1].astype(np.int16), rgb[..., 2].astype(np.int16)
    max_c = np.maximum(np.maximum(r, g), b)
    min_c = np.minimum(np.minimum(r, g), b)
    chroma = max_c - min_c

    palette_a, palette_b = detect_bg_palette(rgb)

    def close_to(color: np.ndarray, tol: int = 22) -> np.ndarray:
        return (np.abs(r - color[0]) <= tol) \
             & (np.abs(g - color[1]) <= tol) \
             & (np.abs(b - color[2]) <= tol)

    palette_mask = close_to(palette_a) | close_to(palette_b)

    # Also keep the generic "pale + low-chroma" fallback so JPEG seam
    # in-between-cells still get caught even if palette detection missed.
    lightness = (r + g + b) // 3
    fallback = (chroma <= 20) & (lightness >= 150) & (lightness <= 258)

    return palette_mask | fallback


def edge_flood(mask: np.ndarray) -> np.ndarray:
    """Given a bool mask of "background-like" pixels, return a bool mask of
    only the connected region(s) that touch any of the four edges. This is a
    simple 4-neighbour BFS to avoid recursion depth issues on wide sheets.
    """
    h, w = mask.shape
    visited = np.zeros_like(mask, dtype=bool)
    queue: deque = deque()

    # Seed all edge pixels that are background-like
    for x in range(w):
        if mask[0, x]:
            queue.append((0, x)); visited[0, x] = True
        if mask[h - 1, x]:
            queue.append((h - 1, x)); visited[h - 1, x] = True
    for y in range(h):
        if mask[y, 0]:
            queue.append((y, 0)); visited[y, 0] = True
        if mask[y, w - 1]:
            queue.append((y, w - 1)); visited[y, w - 1] = True

    # BFS through background-like pixels only
    while queue:
        y, x = queue.popleft()
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not visited[ny, nx]:
                visited[ny, nx] = True
                queue.append((ny, nx))
    return visited


def strip_checker(input_path: Path, output_path: Path, frames: int) -> None:
    src = Image.open(input_path).convert("RGB")
    W, H = src.size
    if W % frames != 0:
        print(f"[warn] width {W} not divisible by {frames} frames")
    frame_w = W // frames

    rgb = np.array(src)
    out = np.dstack([rgb, np.full((H, W), 255, dtype=np.uint8)])  # RGBA

    total_bg = 0
    for i in range(frames):
        x0 = i * frame_w
        x1 = W if i == frames - 1 else (i + 1) * frame_w
        frame = rgb[:, x0:x1, :]
        mask = build_checker_mask(frame)
        flood = edge_flood(mask)

        # --- Second pass: rescue isolated checkerboard "islands" trapped by
        # thin JPEG-compression seams. Any small connected component of
        # checkerboard-like pixels that (a) does NOT touch the frame edge and
        # (b) is smaller than a jaw-drop threshold is almost certainly a
        # checkerboard cell that got walled off — safe to mark transparent.
        try:
            from scipy import ndimage  # type: ignore
            unlabeled = mask & ~flood
            labels, n_comp = ndimage.label(unlabeled)  # 4-connectivity by default
            if n_comp > 0:
                sizes = ndimage.sum(unlabeled, labels, index=np.arange(1, n_comp + 1))
                # Rescue any tiny (<3200 px) island. The dog's belly / white
                # patches are much larger (typically >8000 px) so they stay
                # safe. 3200 covers ≈ 5 checkerboard cells worth of joined
                # seam artifacts.
                keep_trans = sizes <= 3200
                rescue = np.isin(labels, np.arange(1, n_comp + 1)[keep_trans])
                flood = flood | rescue
            # --- Third pass: dilate the transparent region by 1 px so we
            # catch the anti-aliased seam pixels that sit right on the edge
            # of the checkerboard tiles.
            flood = ndimage.binary_dilation(flood, iterations=1)
            # But then RE-erode any pixel that was originally opaque and
            # had strong chroma — this prevents the dilation from eating
            # into the dog's outline.
            r_ = frame[..., 0].astype(np.int16)
            g_ = frame[..., 1].astype(np.int16)
            b_ = frame[..., 2].astype(np.int16)
            chroma = np.maximum(np.maximum(r_, g_), b_) - np.minimum(np.minimum(r_, g_), b_)
            protect = chroma >= 25  # anything vividly coloured stays opaque
            flood = flood & ~protect
        except Exception as ex:
            print(f"[frame {i}] scipy rescue/dilate skipped: {ex}")

        out[:, x0:x1, 3] = np.where(flood, 0, 255).astype(np.uint8)
        # Zero the RGB where alpha=0 so residual checker colour can't bleed
        # into a light-alpha edge during downstream resampling.
        for c in range(3):
            out[:, x0:x1, c] = np.where(flood, 0, rgb[:, x0:x1, c])
        n = int(flood.sum())
        total_bg += n
        print(f"[frame {i}] cleared {n} background px "
              f"({100.0 * n / (H * (x1 - x0)):.1f}% of frame)")

    Image.fromarray(out, "RGBA").save(output_path, "PNG")
    print(f"[done] wrote {output_path} ({total_bg} bg px total, size {W}x{H})")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("input")
    p.add_argument("output")
    p.add_argument("--frames", type=int, default=8)
    args = p.parse_args()
    strip_checker(Path(args.input), Path(args.output), args.frames)


if __name__ == "__main__":
    main()
