#!/usr/bin/env python3
"""Post-process the AI-generated assets:

Some Nano Banana outputs render the *checker-board pattern* that image tools use
to visualise transparency as literal pixels in the output PNG, instead of using
real alpha. This script detects the two greys of that checker pattern in the
corners and edges and rewrites them as fully transparent alpha.

It ALSO trims heavy transparent padding around single-object sprites (fence,
paw button, pause button, treat, etc.) so the collision math + display sizing
line up with the visible artwork.
"""
from pathlib import Path
from PIL import Image
import numpy as np

ASSETS = Path("/app/frontend/public/assets")

# Files that are supposed to have a transparent background.
TRANSPARENT_FILES = [
    "corgi_run_sheet.png",
    "corgi_jump.png",
    "corgi_fall.png",
    "corgi_land.png",
    "corgi_hit.png",
    "corgi_idle.png",
    "corgi_cowboy.png",
    "corgi_pirate.png",
    "corgi_superhero.png",
    "corgi_astronaut.png",
    "corgi_starter.png",
    "bg_clouds.png",
    "bg_mountains.png",
    "bg_hills.png",
    "bg_grass.png",
    "bg_path.png",
    "bg_foreground.png",
    "fence.png",
    "ui_paw_button.png",
    "ui_pause_button.png",
    "ui_panel.png",
    "ui_button.png",
    "ui_button_blue.png",
    "ui_button_gold.png",
    "ui_trophy_panel.png",
    "treat.png",
    "logo_corgi_hop.png",
    "tree_left.png",
    "tree_right.png",
    "bush.png",
    "flower_yellow.png",
    "rock.png",
    "trophy.png",
]

# Files that should be trimmed to their non-transparent bounding box AFTER
# the checker pattern is removed.
TRIM_FILES = {
    "fence.png",
    "ui_paw_button.png",
    "ui_pause_button.png",
    "ui_panel.png",
    "ui_button.png",
    "ui_button_blue.png",
    "ui_button_gold.png",
    "ui_trophy_panel.png",
    "treat.png",
    "corgi_jump.png",
    "corgi_fall.png",
    "corgi_land.png",
    "corgi_hit.png",
    "corgi_idle.png",
    "corgi_cowboy.png",
    "corgi_pirate.png",
    "corgi_superhero.png",
    "corgi_astronaut.png",
    "corgi_starter.png",
    "logo_corgi_hop.png",
    "tree_left.png",
    "tree_right.png",
    "bush.png",
    "flower_yellow.png",
    "rock.png",
    "trophy.png",
}


def sample_checker_colors(img_np: np.ndarray) -> list[tuple[int, int, int]]:
    """Sample the two greys of the transparency checkerboard from the corner
    areas (virtually always background). Quantise to 8-value bins to survive
    JPEG-style compression artifacts."""
    h, w = img_np.shape[:2]
    corners = [
        img_np[0:80, 0:80, :3],
        img_np[0:80, w - 80 : w, :3],
        img_np[h - 80 : h, 0:80, :3],
        img_np[h - 80 : h, w - 80 : w, :3],
    ]
    patch = np.concatenate([c.reshape(-1, 3) for c in corners], axis=0)
    # Filter to near-grey pixels only (checkerboard is greyscale).
    r, g, b = patch[:, 0].astype(int), patch[:, 1].astype(int), patch[:, 2].astype(int)
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    grey_mask = (mx - mn) <= 22
    greys = patch[grey_mask]
    if greys.size == 0:
        return []
    # Quantise so slightly varying JPEG greys collapse into the same bucket.
    q = (greys // 8) * 8
    uniq, counts = np.unique(q, axis=0, return_counts=True)
    order = np.argsort(-counts)
    result = []
    for idx in order[:4]:
        c = uniq[idx]
        if counts[idx] < 200:
            break
        rr, gg, bb = int(c[0]), int(c[1]), int(c[2])
        if 100 <= min(rr, gg, bb) and max(rr, gg, bb) <= 250:
            result.append((rr, gg, bb))
    return result


def remove_checkerboard(img: Image.Image) -> Image.Image:
    """Make pixels that match the sampled checkerboard greys fully transparent."""
    img = img.convert("RGBA")
    arr = np.array(img)
    samples = sample_checker_colors(arr)
    if not samples:
        return img
    r, g, b, a = arr[..., 0], arr[..., 1], arr[..., 2], arr[..., 3]
    mask = np.zeros(r.shape, dtype=bool)
    for sr, sg, sb in samples:
        # Match a bit loosely to cover JPEG-style edges from the model.
        m = (
            (np.abs(r.astype(int) - sr) <= 14)
            & (np.abs(g.astype(int) - sg) <= 14)
            & (np.abs(b.astype(int) - sb) <= 14)
        )
        # Also require the pixel is near-grey (low saturation) to avoid nuking
        # real similarly-lit colors in the artwork.
        mx = np.maximum(np.maximum(r, g), b).astype(int)
        mn = np.minimum(np.minimum(r, g), b).astype(int)
        near_grey = (mx - mn) <= 18
        mask |= m & near_grey
    a2 = a.copy()
    a2[mask] = 0
    arr[..., 3] = a2
    return Image.fromarray(arr, "RGBA")


def trim_to_content(img: Image.Image) -> Image.Image:
    """Trim leading/trailing fully-transparent columns / rows."""
    arr = np.array(img)
    if arr.shape[2] < 4:
        return img
    a = arr[..., 3]
    if a.max() == 0:
        return img
    rows = np.any(a > 5, axis=1)
    cols = np.any(a > 5, axis=0)
    r0, r1 = np.argmax(rows), len(rows) - np.argmax(rows[::-1])
    c0, c1 = np.argmax(cols), len(cols) - np.argmax(cols[::-1])
    return img.crop((c0, r0, c1, r1))


def process_file(name: str) -> None:
    p = ASSETS / name
    if not p.exists():
        print(f"[skip] {name} missing")
        return
    img = Image.open(p).convert("RGBA")
    before_alpha = np.array(img)[..., 3]
    fixed = remove_checkerboard(img)
    if name in TRIM_FILES:
        fixed = trim_to_content(fixed)
    after_alpha = np.array(fixed)[..., 3]
    fixed.save(p, "PNG", optimize=True)
    removed = int((before_alpha > 0).sum() - (after_alpha > 0).sum())
    print(f"[ok  ] {name}: {img.size} -> {fixed.size} (cleared {removed} px)")


def main():
    for f in TRANSPARENT_FILES:
        process_file(f)


if __name__ == "__main__":
    main()
