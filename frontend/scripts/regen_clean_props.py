#!/usr/bin/env python3
"""Regenerate ONLY the two problem assets — rock.png and flower_yellow.png —
with very explicit anti-anthropomorphism prompts so the AI stops baking faces
and background noise into them.
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
    raise SystemExit("EMERGENT_LLM_KEY missing")

OUT_DIR = Path("/app/frontend/public/assets")

ASSETS = {
    "rock.png": (
        "A single plain grey cartoon rock, oval / pebble shape, cel-shaded with "
        "a soft highlight on the upper-left and a slightly darker shadow underneath. "
        "IMPORTANT: NO FACE. NO EYES. NO MOUTH. NO NOSE. NO PUPILS. NO SMILE. "
        "The rock is completely inanimate and has NO facial features of any kind. "
        "Thick clean dark outline. Only ONE rock centered in the image. "
        "TRANSPARENT background — pure alpha zero, absolutely no checkerboard, "
        "no grid pattern, no dashes, no dotted lines, no watermark, no border. "
        "Flat vector cartoon illustration, mobile game art style. About 400x300."
    ),
    "flower_yellow.png": (
        "A small cluster of three cute cartoon yellow daisy flowers on green stems "
        "with a few small green leaves. Each flower has 6 rounded yellow petals "
        "arranged around a solid ORANGE center dot (like a real daisy). "
        "IMPORTANT: NO FACES on the flowers. NO EYES. NO MOUTHS. NO SMILES. "
        "The centers of the flowers are plain solid orange circles with no facial "
        "features drawn inside them. Thick clean dark outline. "
        "TRANSPARENT background — pure alpha zero, absolutely no checkerboard, "
        "no grid pattern, no dashes, no dotted lines, no scratches, no watermark. "
        "Flat vector cartoon illustration, mobile game art style. About 400x400."
    ),
}


async def gen_one(name: str, prompt: str) -> bool:
    out = OUT_DIR / name
    # Force regenerate — overwrite existing
    print(f"[gen ] {name}")
    try:
        chat = LlmChat(
            api_key=API_KEY,
            session_id=f"corgi-hop-clean-{name}",
            system_message=(
                "You are a professional 2D game art generator. Produce clean "
                "cartoon game props on a truly transparent background (alpha "
                "channel, not a visible checkerboard pattern in the pixels). "
                "Absolutely never include ANY text, watermark, logo, border, "
                "scratches, or dashed lines. Absolutely never anthropomorphize "
                "props: rocks, flowers, and other inanimate objects must NEVER "
                "have eyes, mouths, faces, or expressions."
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
    results = await asyncio.gather(*(gen_one(n, p) for n, p in items))
    print(f"Done: {sum(results)}/{len(items)}")


if __name__ == "__main__":
    asyncio.run(main())
