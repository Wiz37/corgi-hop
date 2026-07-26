#!/usr/bin/env python3
"""
Generate a run-cycle sprite sheet for a premium corgi using Gemini Nano Banana.

Approach:
  1) Load the premium corgi's static portrait PNG as identity reference.
  2) Load Classic's approved run sheet as pose-cycle reference.
  3) Ask Gemini to produce ONE horizontal strip containing 8 pose frames
     matching Classic's stride cadence, while preserving the premium corgi's
     outfit accessories (collar+tag / hat+bandana / mask+cape / etc).

Usage:
    python3 gen_premium_run_sheet.py <corgi_id>
Where <corgi_id> is one of: starter, cowboy, superhero, pirate, astronaut.

Output is written to /tmp/<corgi_id>_run_sheet_raw.png so we can inspect
against a light + dark checkerboard before integration.
"""

import asyncio
import base64
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

ASSETS = Path(__file__).resolve().parents[1] / "public" / "assets"

# ------------------------------------------------------------------
# Per-corgi identity + prompt fragments
# ------------------------------------------------------------------
PROFILES = {
    "classic": {
        "portrait": "corgi_idle.png",
        "outfit_desc": (
            "NO OUTFIT and NO ACCESSORIES AT ALL. This is the base/regular/classic "
            "corgi — a plain Pembroke Welsh Corgi with natural orange-and-white fur, "
            "a small brown nose, a warm smile, and normal upright pointed ears. "
            "Absolutely no collar, no tag, no hat, no bandana, no cape, no mask, "
            "no helmet, no backpack, no emblem, no chest strap, no glasses. The dog "
            "must look identical to the character reference except in running poses."
        ),
    },
    "starter": {
        "portrait": "corgi_starter.png",
        "outfit_desc": (
            "a bright teal collar with a gold star-shaped tag hanging from it. "
            "The collar must be a solid teal band around the neck; the star tag "
            "must dangle just below the throat in every frame."
        ),
    },
    "cowboy": {
        "portrait": "corgi_cowboy.png",
        "outfit_desc": (
            "a brown cowboy hat with an upturned brim and a red bandana tied "
            "around the neck. Hat and bandana must be present and correctly "
            "coloured in every frame."
        ),
    },
    "superhero": {
        "portrait": "corgi_superhero.png",
        "outfit_desc": (
            "a red domino mask across the eyes and a red superhero cape draped "
            "over the back trailing behind. Cape must flow naturally in each "
            "frame; mask must sit over the eyes."
        ),
    },
    "pirate": {
        "portrait": "corgi_pirate.png",
        "outfit_desc": (
            "a black pirate captain's hat with a white skull-and-crossbones "
            "emblem on the front, and a small brown eye-patch strap. The skull "
            "emblem must be fully opaque white — never transparent or missing. "
            "Hat must sit securely on the head in every frame."
        ),
    },
    "astronaut": {
        "portrait": "corgi_astronaut.png",
        "outfit_desc": (
            "a translucent bubble-glass space helmet over the head with a small "
            "silver antenna, and a white backpack / life-support pack strapped "
            "to the back. Helmet, antenna, and backpack must be fully visible "
            "and correctly placed in every frame."
        ),
    },
}


def build_prompt(corgi_id: str) -> str:
    outfit = PROFILES[corgi_id]["outfit_desc"]
    return f"""You are creating a game-quality run-cycle sprite sheet for a stylized cartoon corgi character.

The FIRST attached image is the CHARACTER REFERENCE — this is the exact corgi you must draw in every frame. Preserve its face, body proportions, colour palette, ear shape, muzzle, and outfit accessories exactly. The character wears {outfit}

The SECOND attached image is the POSE-CYCLE REFERENCE — a Classic corgi's approved 8-frame run cycle. Use its stride cadence and pose sequence as your guide (alternating front/rear leg extension, subtle body bob), but you must DRAW MY corgi from the first reference, not the Classic corgi.

Produce ONE single output image containing a horizontal sprite sheet with EXACTLY 8 evenly-spaced frames.

Sprite sheet rules — non-negotiable:
- EXACTLY 8 frames laid out left-to-right in a single horizontal strip.
- Each frame occupies an equal-width vertical slice of the canvas.
- All 8 frames FACE RIGHT (nose pointing to the right of the frame). No frame flipped.
- All 8 frames show the SAME character with the SAME outfit accessories.
- All 8 frames use the SAME body size, SAME head size, SAME feet baseline height. The feet in every frame must touch a common invisible horizontal ground line at the same y position.
- Legs must alternate stride: e.g. frame 1 front-right + back-left extended forward, frame 2 mid-stride, frame 3 front-left + back-right extended forward, frame 4 mid-stride, and so on across 8 frames forming a natural running cycle.
- Subtle vertical body bob is baked into the frames (higher on push-off frames, slightly lower on plant frames).
- The character is fully opaque with a solid outline. The dog's silhouette must be filled with its natural colours — NO transparency inside the body, face, muzzle, eyes, ears, legs, tail, or outfit pieces.
- The background is FULLY TRANSPARENT (alpha 0) — everything outside the corgi's silhouette is transparent.
- No white halo, no checkerboard, no shadows on the ground.
- No text, no labels, no numbers, no frame borders, no watermarks.
- The sheet's aspect ratio should be roughly 8:1 (very wide, short) so the 8 frames fit clearly side-by-side.

Output only the finished sprite sheet PNG.
"""


async def generate(corgi_id: str, out_path: Path) -> None:
    load_dotenv()
    load_dotenv("/app/backend/.env")
    api_key = os.getenv("EMERGENT_LLM_KEY")
    if not api_key:
        raise RuntimeError("EMERGENT_LLM_KEY missing in environment")

    profile = PROFILES[corgi_id]
    portrait_path = ASSETS / profile["portrait"]
    classic_sheet_path = ASSETS / "corgi_run_sheet.png"

    with open(portrait_path, "rb") as f:
        portrait_b64 = base64.b64encode(f.read()).decode()
    with open(classic_sheet_path, "rb") as f:
        classic_b64 = base64.b64encode(f.read()).decode()

    chat = LlmChat(
        api_key=api_key,
        session_id=f"corgi-run-{corgi_id}",
        system_message="You are a professional 2D game-art sprite sheet illustrator.",
    ).with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])

    prompt = build_prompt(corgi_id)
    msg = UserMessage(
        text=prompt,
        file_contents=[ImageContent(portrait_b64), ImageContent(classic_b64)],
    )
    print(f"[{corgi_id}] Sending prompt to Nano Banana (portrait + classic sheet as refs) …")
    text_resp, images = await chat.send_message_multimodal_response(msg)
    print(f"[{corgi_id}] Text response head: {text_resp[:120] if text_resp else '(none)'}")
    if not images:
        raise RuntimeError(f"No image returned for {corgi_id}")

    for i, img in enumerate(images):
        image_bytes = base64.b64decode(img["data"])
        out_file = out_path if i == 0 else out_path.with_stem(out_path.stem + f"_alt{i}")
        with open(out_file, "wb") as f:
            f.write(image_bytes)
        print(f"[{corgi_id}] Saved: {out_file} ({len(image_bytes)} bytes, {img['mime_type']})")


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: gen_premium_run_sheet.py <starter|cowboy|superhero|pirate|astronaut>")
        sys.exit(2)
    corgi_id = sys.argv[1].strip().lower()
    if corgi_id not in PROFILES:
        print(f"Unknown corgi id: {corgi_id}")
        sys.exit(2)
    out = Path("/tmp") / f"{corgi_id}_run_sheet_raw.png"
    asyncio.run(generate(corgi_id, out))


if __name__ == "__main__":
    main()
