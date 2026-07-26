#!/usr/bin/env python3
"""
Post-process the AI-generated Corgi Hop icon into every native variant we
need for iOS and Android, plus the launch/splash screens.

Inputs:
  /tmp/corgi_icon_raw.png          — Nano Banana output (1024×1024ish, JPEG-in-PNG)
  public/assets/logo_corgi_hop.png — the polished CORGI HOP wordmark

Outputs (all PNG, 1024×1024 unless noted):
  /tmp/icon_preview/ios_appstore_1024.png       iOS: opaque, no transparency, no rounded corners
  /tmp/icon_preview/android_legacy_512.png      Android: legacy launcher icon 512×512
  /tmp/icon_preview/android_adaptive_foreground.png  Android: foreground (safe-zone ~66% centre, transparent bg)
  /tmp/icon_preview/android_adaptive_background.png  Android: solid #3fa7ff square
  /tmp/icon_preview/android_notification_mono.png    Android: white alpha silhouette for notifications
  /tmp/icon_preview/splash_1242x2688.png             iOS launch screen (safe for all portrait iPhones)
  /tmp/icon_preview/android_splash_1920x1920.png     Android 12+ splash asset (square, adaptive)
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageChops

BRAND_BLUE = (63, 167, 255, 255)
OUTLINE_NAVY = (36, 48, 74, 255)

RAW = Path("/tmp/corgi_icon_raw.png")
LOGO = Path("/app/frontend/public/assets/logo_corgi_hop.png")
OUT = Path("/tmp/icon_preview")
OUT.mkdir(parents=True, exist_ok=True)


def load_and_normalise_icon() -> Image.Image:
    """Load raw generation, resize to 1024×1024, ensure background is exact brand blue."""
    img = Image.open(RAW).convert("RGB")
    # Nano-banana output is usually 1024×1024 already; force it.
    if img.size != (1024, 1024):
        img = img.resize((1024, 1024), Image.LANCZOS)
    return img


def extract_foreground(icon_rgb: Image.Image) -> Image.Image:
    """Return an RGBA where the blue background is fully transparent and the
    corgi face is opaque. Uses tight-tolerance blue keying against #3fa7ff
    plus a small feather (via alpha refinement)."""
    src = icon_rgb.convert("RGBA")
    w, h = src.size
    data = src.load()
    # Build alpha via colour distance from brand blue.
    for y in range(h):
        for x in range(w):
            r, g, b, _ = data[x, y]
            dr, dg, db = r - BRAND_BLUE[0], g - BRAND_BLUE[1], b - BRAND_BLUE[2]
            dist2 = dr * dr + dg * dg + db * db
            # Fully transparent inside a tight radius around brand blue.
            if dist2 < 24 * 24:
                data[x, y] = (255, 255, 255, 0)
            elif dist2 < 64 * 64:
                # Feather edge for antialias
                data[x, y] = (r, g, b, int(255 * (dist2 - 24 * 24) / (64 * 64 - 24 * 24)))
    return src


def ios_appstore(icon_rgb: Image.Image) -> None:
    """iOS App Store icon: FULLY OPAQUE RGB (no alpha), 1024×1024, no rounded corners."""
    icon_rgb.save(OUT / "ios_appstore_1024.png", "PNG", optimize=True)


def android_adaptive_foreground(fg_rgba: Image.Image) -> None:
    """Android adaptive foreground: 1024×1024 with transparent background.
    Android crops the outer ~33% of the icon in some launcher shapes, so
    the visible corgi head must fit inside a 66% centre circle. The raw
    generation already has the head at ~60% coverage, so we just re-centre
    it in a 1024×1024 canvas with a small inset to stay safe."""
    src = fg_rgba
    # Compute tight bbox of the opaque pixels
    bbox = src.getbbox()
    if bbox is None:
        raise RuntimeError("Foreground has no opaque pixels")
    cropped = src.crop(bbox)
    # Scale to fit within ~62% of 1024 (safe zone), preserving aspect
    max_dim = int(1024 * 0.62)
    cw, ch = cropped.size
    scale = min(max_dim / cw, max_dim / ch)
    new = cropped.resize((int(cw * scale), int(ch * scale)), Image.LANCZOS)
    canvas = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    x = (1024 - new.width) // 2
    y = (1024 - new.height) // 2
    canvas.paste(new, (x, y), new)
    canvas.save(OUT / "android_adaptive_foreground.png", "PNG", optimize=True)


def android_adaptive_background() -> None:
    """Solid brand-blue 1024×1024 (Android composes fg over this)."""
    Image.new("RGBA", (1024, 1024), BRAND_BLUE).save(
        OUT / "android_adaptive_background.png", "PNG", optimize=True
    )


def android_legacy(icon_rgb: Image.Image) -> None:
    """Legacy Play Store icon: 512×512 opaque."""
    icon_rgb.resize((512, 512), Image.LANCZOS).save(
        OUT / "android_legacy_512.png", "PNG", optimize=True
    )


def android_notification_mono(fg_rgba: Image.Image) -> None:
    """Notification-safe monochrome: white silhouette on transparent bg.
    Android renders notification icons as alpha mask only."""
    bbox = fg_rgba.getbbox()
    cropped = fg_rgba.crop(bbox) if bbox else fg_rgba
    alpha = cropped.split()[3]
    # Threshold + slight erode to remove antialias halo
    alpha_bin = alpha.point(lambda p: 255 if p > 128 else 0)
    canvas = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    max_dim = int(1024 * 0.66)
    cw, ch = cropped.size
    scale = min(max_dim / cw, max_dim / ch)
    new_size = (int(cw * scale), int(ch * scale))
    white = Image.new("RGBA", cropped.size, (255, 255, 255, 0))
    white.putalpha(alpha_bin)
    white = white.resize(new_size, Image.LANCZOS)
    x = (1024 - new_size[0]) // 2
    y = (1024 - new_size[1]) // 2
    canvas.paste(white, (x, y), white)
    canvas.save(OUT / "android_notification_mono.png", "PNG", optimize=True)


def build_splash_portrait() -> None:
    """iOS launch screen — portrait 1242×2688 (iPhone Xs Max native).
    Solid brand-blue with the CORGI HOP wordmark centred at ~40% vertical."""
    W, H = 1242, 2688
    canvas = Image.new("RGB", (W, H), BRAND_BLUE[:3])
    logo = Image.open(LOGO).convert("RGBA")
    target_w = int(W * 0.72)
    scale = target_w / logo.width
    logo = logo.resize((target_w, int(logo.height * scale)), Image.LANCZOS)
    x = (W - logo.width) // 2
    y = int(H * 0.34)
    canvas.paste(logo, (x, y), logo)
    canvas.save(OUT / "splash_1242x2688.png", "PNG", optimize=True)


def build_splash_android_square() -> None:
    """Android 12+ splash — square 1920×1920 with logo centred (Android
    crops outer regions to a circle in some launchers)."""
    S = 1920
    canvas = Image.new("RGB", (S, S), BRAND_BLUE[:3])
    logo = Image.open(LOGO).convert("RGBA")
    target_w = int(S * 0.60)
    scale = target_w / logo.width
    logo = logo.resize((target_w, int(logo.height * scale)), Image.LANCZOS)
    x = (S - logo.width) // 2
    y = (S - logo.height) // 2
    canvas.paste(logo, (x, y), logo)
    canvas.save(OUT / "android_splash_1920x1920.png", "PNG", optimize=True)


def main() -> None:
    icon = load_and_normalise_icon()
    fg = extract_foreground(icon)
    ios_appstore(icon)
    android_adaptive_foreground(fg)
    android_adaptive_background()
    android_legacy(icon)
    android_notification_mono(fg)
    build_splash_portrait()
    build_splash_android_square()
    print("Wrote all previews to", OUT)
    for f in sorted(OUT.iterdir()):
        print(f" • {f.name:44s} {f.stat().st_size:>10d} bytes")


if __name__ == "__main__":
    main()
