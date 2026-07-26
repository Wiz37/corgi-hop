#!/usr/bin/env python3
"""
Generate the Corgi Hop APP ICON using Gemini Nano Banana.

Design brief (matches user spec exactly):
  • Polished stylized corgi FACE/HEAD (no full body)
  • Centered on solid brand-blue background (#3fa7ff)
  • Friendly orange-and-white corgi face
  • Bold readable silhouette clear at 40×40
  • Minimal tiny details, thick outline
  • No text, no borders baked in, no shadows outside the silhouette
  • No transparency (icon must be fully opaque — Apple/Google apply masks)
  • No Emergent / Capacitor / RevenueCat / Expo branding

Output:  /tmp/corgi_icon_raw.png
Aspect:  1:1 square (native model default), we will centre-crop to a
          perfect 1024×1024 square after generation.
"""

import asyncio
import base64
import os
from pathlib import Path

from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

ASSETS = Path(__file__).resolve().parents[1] / "public" / "assets"
OUT = Path("/tmp/corgi_icon_raw.png")

PROMPT = """You are a professional mobile game APP ICON designer. Produce the
Corgi Hop iOS/Android app icon based on the character reference image below.

App icon rules — NON-NEGOTIABLE:
- Perfect 1:1 square canvas. Full-bleed, no transparency, no rounded corners.
- Background is a SOLID single colour: brand blue #3fa7ff filling the entire
  square. No gradients, no clouds, no scenery, no shadows behind the icon.
- The subject is ONLY the corgi's face and head — no body, no legs, no paws,
  no tail. Head is CENTRED and takes up ~72% of the icon's shortest side so
  it reads clearly at 40×40 pixels.
- Style: friendly, plush, chunky, kid-friendly cartoon in the same
  hand-drawn art style as the character reference. Warm orange-and-white
  Pembroke Welsh Corgi face:
    • Rounded orange head with a white blaze between the eyes
    • Two upright pointy ears (natural Pembroke shape), inner ear pink
    • Large expressive round black eyes with tiny white highlights
    • Small triangular black nose
    • Warm subtle smile with the pink tongue slightly poking out
- Line-work: THICK uniform dark-navy (~#24304a) outline around the entire
  head + inner shape divisions, so the silhouette reads at 24×24. NO fine
  detail lines. NO facial texture strokes.
- Absolutely NO text, NO letters, NO numbers, NO logo, NO frame, NO border,
  NO badge, NO watermark, NO shadow inside the blue background, NO
  photorealistic textures.
- The corgi must look happy, energetic, and premium — matching the polished
  casual-game aesthetic of the reference character.

Output only the finished 1:1 icon PNG.
"""


async def generate() -> None:
    load_dotenv()
    load_dotenv("/app/backend/.env")
    api_key = os.getenv("EMERGENT_LLM_KEY")
    if not api_key:
        raise RuntimeError("EMERGENT_LLM_KEY missing in environment")

    portrait_path = ASSETS / "corgi_idle.png"
    with open(portrait_path, "rb") as f:
        portrait_b64 = base64.b64encode(f.read()).decode()

    chat = (
        LlmChat(
            api_key=api_key,
            session_id="corgi-app-icon",
            system_message="You are a professional 2D mobile game app icon illustrator.",
        )
        .with_model("gemini", "gemini-3.1-flash-image-preview")
        .with_params(modalities=["image", "text"])
    )
    msg = UserMessage(text=PROMPT, file_contents=[ImageContent(portrait_b64)])
    print("Sending icon prompt to Nano Banana …")
    text_resp, images = await chat.send_message_multimodal_response(msg)
    print(f"Text head: {(text_resp or '')[:120]}")
    if not images:
        raise RuntimeError("No image returned for app icon")
    for i, img in enumerate(images):
        out = OUT if i == 0 else OUT.with_stem(OUT.stem + f"_alt{i}")
        out.write_bytes(base64.b64decode(img["data"]))
        print(f"Saved: {out} ({out.stat().st_size} bytes, {img['mime_type']})")


if __name__ == "__main__":
    asyncio.run(generate())
