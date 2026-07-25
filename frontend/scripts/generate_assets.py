#!/usr/bin/env python3
"""Generate polished Corgi Hop game assets using Gemini Nano Banana.

Usage: python3 generate_assets.py [asset_name]
       (no arg = generate ALL assets)
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

API_KEY = os.getenv("EMERGENT_LLM_KEY", "sk-emergent-01fF720Da4d2d48Ec3")
OUT_DIR = Path("/app/frontend/public/assets")
OUT_DIR.mkdir(parents=True, exist_ok=True)

STYLE = (
    "flat vector cartoon illustration, thick clean outlines, cel-shaded, "
    "saturated colors, mobile game art style similar to Crossy Road / Alto's Odyssey, "
    "highly polished, no text, no logos, no watermarks"
)

ASSETS = {
    # ---- Corgi character sprite sheet ----
    "corgi_run_sheet.png": (
        "A horizontal sprite sheet with EXACTLY 8 frames of the same cute orange and white "
        "Pembroke Welsh corgi running from left to right, arranged in a single row on a fully "
        "TRANSPARENT background. The corgi has short stubby legs, large upright triangular ears, "
        "a happy smiling face with tongue sticking out, a fluffy chest, and a small stubby tail. "
        "Each frame shows a different leg position in the run cycle (all four legs animate). "
        "The corgi's body slightly bounces up and down between frames. "
        "IMPORTANT: transparent background (no sky, no ground, no shadows behind), "
        "corgi centered in each frame cell, all 8 frames the same size and same character. "
        f"Style: {STYLE}. Frame cells about 256x256, total image 2048x256."
    ),
    "corgi_jump.png": (
        "A single frame of the same orange and white Pembroke corgi mid-jump, front legs stretched "
        "forward, back legs tucked, ears flapping up, tongue out, happy expression. "
        "TRANSPARENT background. "
        f"Style: {STYLE}. About 256x256."
    ),
    "corgi_fall.png": (
        "A single frame of the same orange and white Pembroke corgi falling downward from a jump, "
        "front legs reaching down, back legs slightly up, ears blown back. Happy face, tongue out. "
        "TRANSPARENT background. "
        f"Style: {STYLE}. About 256x256."
    ),
    "corgi_land.png": (
        "A single frame of the same orange and white Pembroke corgi in a landing squash pose: "
        "all four legs bent, body compressed, ears folded slightly. Determined happy face. "
        "TRANSPARENT background. "
        f"Style: {STYLE}. About 256x256."
    ),
    "corgi_hit.png": (
        "A single frame of the same orange and white Pembroke corgi tumbling / bumped: "
        "legs splayed, dizzy expression with X eyes and tongue out sideways, small stars around head. "
        "TRANSPARENT background. "
        f"Style: {STYLE}. About 256x256."
    ),
    "corgi_idle.png": (
        "A single frame of the same orange and white Pembroke corgi standing still facing right, "
        "big smile, tongue out, tail up, both ears upright. "
        "TRANSPARENT background. "
        f"Style: {STYLE}. About 256x256."
    ),

    # ---- Parallax background layers (each seamlessly tileable horizontally) ----
    "bg_sky.png": (
        "A vertical gradient sky background going from bright saturated sky-blue at the top "
        "(#3fa7ff) to lighter powder blue at the bottom (#a8dcff). Absolutely no clouds, "
        "no objects, no text. Portrait mobile game background, 1080x1920, extremely clean, no noise."
    ),
    "bg_clouds.png": (
        "A wide horizontal strip of soft fluffy cartoon white clouds scattered on a fully "
        "TRANSPARENT background. Clouds are rounded, cel-shaded with light blue underside shadow. "
        f"Style: {STYLE}. Seamlessly tileable left-right. About 1920x480."
    ),
    "bg_mountains.png": (
        "A wide horizontal strip of soft blue distant mountains and rolling hills silhouettes "
        "on a fully TRANSPARENT background. Layered blue tones from lightest (far) to darker "
        "(closer), gently curved cartoon shapes, cel-shaded. Absolutely NO sky behind them. "
        f"Style: {STYLE}. Seamlessly tileable. About 1920x400."
    ),
    "bg_hills.png": (
        "A wide horizontal strip of rolling bright green grassy hills on a fully TRANSPARENT "
        "background, with small distant cartoon trees and a low continuous white picket fence "
        "running horizontally in front of the hills. Cel-shaded, cheerful. "
        f"Style: {STYLE}. Seamlessly tileable. About 1920x360."
    ),
    "bg_grass.png": (
        "A wide horizontal strip of bright saturated cartoon grass field (green #6dc73a on top, "
        "darker green underneath) on a fully TRANSPARENT background. A few scattered darker green "
        "grass bushes and tufts. Clean top edge. "
        f"Style: {STYLE}. Seamlessly tileable. About 1920x260."
    ),
    "bg_path.png": (
        "A wide horizontal strip of a warm dirt running path (sandy brown #d3a15c with darker brown "
        "shading) on a fully TRANSPARENT background. Small pebbles and paw prints along the path. "
        f"Style: {STYLE}. Seamlessly tileable. About 1920x180."
    ),
    "bg_foreground.png": (
        "A wide horizontal strip of a foreground layer: bright cartoon grass with clusters of "
        "small yellow and white flowers, tiny leaves, and a few small rocks, on a fully TRANSPARENT "
        "background. Colorful, lush. "
        f"Style: {STYLE}. Seamlessly tileable. About 1920x220."
    ),

    # ---- Obstacles ----
    "fence.png": (
        "A single narrow white agility jump fence (two vertical white posts about 8px wide "
        "connected by two horizontal white crossbars near the top and middle). Clean cartoon "
        "outline, subtle shading. Standing upright. TRANSPARENT background. "
        f"Style: {STYLE}. About 120x220."
    ),

    # ---- UI elements ----
    "ui_trophy_panel.png": (
        "A UI panel for a mobile game: rounded rectangle in dark navy blue with a bright gold "
        "trophy cup icon on the left and empty space to the right for a number. Soft outline, "
        "clean cartoon shading. TRANSPARENT background outside the panel. "
        f"Style: {STYLE}. About 260x120."
    ),
    "ui_pause_button.png": (
        "A circular pause button for a mobile game: white circle with two vertical rounded bars "
        "in the center (pause icon), soft blue outline, subtle drop shadow. TRANSPARENT background. "
        f"Style: {STYLE}. About 180x180."
    ),
    "ui_paw_button.png": (
        "A large translucent circular button with a cute cartoon paw print icon in the center, "
        "white/light-green paw on a soft translucent white circle with a thin outline. "
        "TRANSPARENT background outside the circle. "
        f"Style: {STYLE}. About 400x400."
    ),
    "ui_panel.png": (
        "A generic UI panel for a mobile game: rounded rectangle in cream/off-white with a thick "
        "dark navy outline and subtle inner shadow. Empty inside for text to be overlaid. "
        "TRANSPARENT background outside the panel. "
        f"Style: {STYLE}. About 800x500."
    ),
    "ui_button.png": (
        "A green rounded rectangle mobile game button with a thick darker green outline, "
        "subtle top highlight, empty inside for text to be overlaid. TRANSPARENT background. "
        f"Style: {STYLE}. About 400x140."
    ),
    "ui_button_blue.png": (
        "A blue rounded rectangle mobile game button with a thick darker blue outline, "
        "subtle top highlight, empty inside for text to be overlaid. TRANSPARENT background. "
        f"Style: {STYLE}. About 400x140."
    ),
    "ui_button_gold.png": (
        "A gold/yellow rounded rectangle mobile game button with a thick darker orange outline, "
        "subtle top highlight, empty inside for text to be overlaid. TRANSPARENT background. "
        f"Style: {STYLE}. About 400x140."
    ),
    "treat.png": (
        "A cute cartoon dog bone treat, warm cream/beige color with brown outline and soft "
        "shading. TRANSPARENT background. "
        f"Style: {STYLE}. About 128x80."
    ),

    # ---- Corgi cosmetics (portrait icons for shop) ----
    "corgi_cowboy.png": (
        "The same cute orange and white Pembroke corgi from before, now wearing a small brown "
        "cowboy hat and a red bandana around the neck. Standing pose facing right, happy face, "
        "tongue out. TRANSPARENT background. "
        f"Style: {STYLE}. About 256x256."
    ),
    "corgi_superhero.png": (
        "The same cute orange and white Pembroke corgi from before, wearing a small red superhero "
        "cape and a blue eye mask. Standing pose facing right, brave happy face, tongue out. "
        "TRANSPARENT background. "
        f"Style: {STYLE}. About 256x256."
    ),
    "corgi_pirate.png": (
        "The same cute orange and white Pembroke corgi from before, wearing a black pirate hat "
        "with skull and a brown eye patch on one eye. Standing pose facing right. "
        "TRANSPARENT background. "
        f"Style: {STYLE}. About 256x256."
    ),
    "corgi_astronaut.png": (
        "The same cute orange and white Pembroke corgi from before, wearing a small white "
        "astronaut helmet with clear visor. Standing pose facing right, happy face inside helmet. "
        "TRANSPARENT background. "
        f"Style: {STYLE}. About 256x256."
    ),
    "corgi_starter.png": (
        "The same cute orange and white Pembroke corgi from before, wearing a bright teal "
        "collar with a golden star tag. Standing pose facing right, extra happy face. "
        "TRANSPARENT background. "
        f"Style: {STYLE}. About 256x256."
    ),

    # ---- Game logo ----
    "logo.png": (
        "A game title logo reading 'CORGI HOP' in a bold, chunky, playful cartoon font. "
        "The letters are bright orange with a thick white outline and a thick dark navy outer "
        "outline, with a soft yellow drop shadow. Slight upward arc. TRANSPARENT background. "
        f"Style: {STYLE}. About 900x400."
    ),
}


async def generate_one(name: str, prompt: str) -> bool:
    out_path = OUT_DIR / name
    if out_path.exists() and out_path.stat().st_size > 5000:
        print(f"[skip] {name} exists ({out_path.stat().st_size} bytes)")
        return True
    print(f"[gen ] {name} ...")
    try:
        chat = LlmChat(
            api_key=API_KEY,
            session_id=f"corgi-hop-{name}",
            system_message=(
                "You are a professional 2D game art generator. Always produce clean, "
                "polished vector-style cartoon game art with transparent backgrounds when "
                "requested. Never include text, watermarks, logos, or borders."
            ),
        )
        chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(
            modalities=["image", "text"]
        )
        msg = UserMessage(text=prompt)
        _text, images = await chat.send_message_multimodal_response(msg)
        if not images:
            print(f"[FAIL] {name}: no image returned")
            return False
        img_bytes = base64.b64decode(images[0]["data"])
        out_path.write_bytes(img_bytes)
        print(f"[ok  ] {name} ({len(img_bytes)} bytes)")
        return True
    except Exception as e:
        print(f"[ERR ] {name}: {e}")
        return False


async def main():
    only = sys.argv[1] if len(sys.argv) > 1 else None
    items = [(n, p) for n, p in ASSETS.items() if (only is None or only in n)]
    print(f"Generating {len(items)} assets -> {OUT_DIR}")
    # Small concurrency to keep API happy
    sem = asyncio.Semaphore(3)

    async def bounded(n, p):
        async with sem:
            return await generate_one(n, p)

    results = await asyncio.gather(*(bounded(n, p) for n, p in items))
    ok = sum(1 for r in results if r)
    print(f"Done: {ok}/{len(items)} succeeded")


if __name__ == "__main__":
    asyncio.run(main())
