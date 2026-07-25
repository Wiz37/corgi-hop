#!/usr/bin/env python3
"""Generate the extra polish assets Corgi Hop still needs.

This is a smaller, focused batch (missing background/UI + game logo + trees
+ decoration sprites) so it stays inside the LLM budget.
"""
import asyncio
import base64
import os
import sys
from pathlib import Path

sys.path.insert(0, "/app/backend")
from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage

load_dotenv("/app/backend/.env")

API_KEY = os.getenv("EMERGENT_LLM_KEY")
if not API_KEY:
    raise SystemExit("EMERGENT_LLM_KEY is not set — populate /app/backend/.env before running.")

OUT_DIR = Path("/app/frontend/public/assets")
OUT_DIR.mkdir(parents=True, exist_ok=True)

STYLE = (
    "flat vector cartoon illustration, thick clean outlines, cel-shaded, "
    "saturated colors, mobile game art style similar to Crossy Road / Alto's Odyssey, "
    "highly polished, no text, no logos, no watermarks"
)

ASSETS = {
    # ---- Missing background layer ----
    "bg_clouds.png": (
        "A wide horizontal strip of soft fluffy cartoon white clouds scattered on a fully "
        "TRANSPARENT background (pure alpha=0, no checkerboard). Clouds are rounded, "
        "cel-shaded with light blue underside shadow. About 10-12 separate cloud shapes "
        "spread along the strip. "
        f"Style: {STYLE}. Seamlessly tileable left-right. About 1920x480."
    ),
    "ui_paw_button.png": (
        "A large translucent circular button with a cute cartoon paw print icon in the center, "
        "white/light-green paw pads on a soft translucent white circle with a thin outline. "
        "TRANSPARENT background (pure alpha=0). "
        f"Style: {STYLE}. About 512x512."
    ),

    # ---- Logo ----
    "logo_corgi_hop.png": (
        "A game title logo reading exactly 'CORGI HOP' in a bold, chunky, playful cartoon font, "
        "arranged on two lines (CORGI on top, HOP below, slightly tilted). Bright orange letters "
        "with thick white inner outline and thick dark navy outer outline, subtle gold shadow. "
        "TRANSPARENT background. NO other text or objects. "
        f"Style: {STYLE}. About 900x520."
    ),

    # ---- Menu decoration ----
    "tree_left.png": (
        "A single tall cute cartoon deciduous tree, dark green rounded canopy with lighter green "
        "highlights, brown trunk with subtle shading. Standing straight. TRANSPARENT background. "
        f"Style: {STYLE}. About 400x600."
    ),
    "tree_right.png": (
        "A single medium cartoon pine tree, dark green triangular canopy with lighter highlights, "
        "brown trunk. Standing straight. TRANSPARENT background. "
        f"Style: {STYLE}. About 380x580."
    ),
    "bush.png": (
        "A cluster of cute cartoon green bushes with tiny yellow flowers on top, cel-shaded with "
        "darker green underside. TRANSPARENT background. "
        f"Style: {STYLE}. About 400x220."
    ),
    "flower_yellow.png": (
        "A tiny cluster of 3 cute cartoon yellow flowers with small green leaves, cel-shaded. "
        "TRANSPARENT background. "
        f"Style: {STYLE}. About 200x180."
    ),
    "rock.png": (
        "A small cute cartoon grey rock with soft rounded shape and cel-shaded highlight and shadow. "
        "TRANSPARENT background. "
        f"Style: {STYLE}. About 240x180."
    ),
    "trophy.png": (
        "A single shiny gold trophy cup icon with a small red gem in front, cel-shaded with "
        "highlights. TRANSPARENT background. NO panel or background behind it. "
        f"Style: {STYLE}. About 300x320."
    ),

    # ---- Corgi variants that failed on the first pass ----
    "corgi_superhero.png": (
        "A cute orange and white Pembroke corgi with short stubby legs, wearing a small bright "
        "red superhero cape flapping behind and a blue eye mask over the eyes. Standing pose "
        "facing right, brave happy face, tongue out. TRANSPARENT background. "
        f"Style: {STYLE}. About 512x512."
    ),
    "corgi_astronaut.png": (
        "A cute orange and white Pembroke corgi with short stubby legs, wearing a small white "
        "astronaut space helmet with clear glass visor showing the happy corgi face inside, "
        "small blue oxygen tank on back. Standing pose facing right. TRANSPARENT background. "
        f"Style: {STYLE}. About 512x512."
    ),
    "corgi_starter.png": (
        "A cute orange and white Pembroke corgi with short stubby legs, wearing a bright teal "
        "collar with a golden star tag hanging in front. Standing pose facing right, extra big "
        "happy smile, tongue out. TRANSPARENT background. "
        f"Style: {STYLE}. About 512x512."
    ),
}


async def gen_one(name: str, prompt: str) -> bool:
    out = OUT_DIR / name
    if out.exists() and out.stat().st_size > 5000:
        print(f"[skip] {name} exists ({out.stat().st_size} bytes)")
        return True
    print(f"[gen ] {name}")
    try:
        chat = LlmChat(
            api_key=API_KEY,
            session_id=f"corgi-hop-polish-{name}",
            system_message=(
                "You are a professional 2D game art generator. Produce clean polished cartoon "
                "game art on a truly transparent background (alpha channel, not a visible "
                "checkerboard). Never include any text, watermark, logo, or border. Always "
                "use vibrant saturated colors and thick clean outlines."
            ),
        )
        chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(
            modalities=["image", "text"]
        )
        _text, images = await chat.send_message_multimodal_response(UserMessage(text=prompt))
        if not images:
            print(f"[FAIL] {name}: no image returned")
            return False
        out.write_bytes(base64.b64decode(images[0]["data"]))
        print(f"[ok  ] {name} ({out.stat().st_size} bytes)")
        return True
    except Exception as e:
        print(f"[ERR ] {name}: {e}")
        return False


async def main():
    only = sys.argv[1] if len(sys.argv) > 1 else None
    items = [(n, p) for n, p in ASSETS.items() if (only is None or only in n)]
    sem = asyncio.Semaphore(3)

    async def bounded(n, p):
        async with sem:
            return await gen_one(n, p)

    results = await asyncio.gather(*(bounded(n, p) for n, p in items))
    print(f"Done: {sum(results)}/{len(items)}")


if __name__ == "__main__":
    asyncio.run(main())
