# Corgi Hop — Product Requirements

## Overview

Corgi Hop is a polished portrait mobile runner built with **Phaser 3 (WebGL)**,
Vite + TypeScript, and packaged for iOS / Android via **Capacitor**. It ships
with a fully playable browser preview and a clean service layer that swaps
between mock (browser) and native (AdMob + RevenueCat) implementations at
runtime.

## Tech stack

- **Rendering:** Phaser 3.90 (WebGL first, Canvas fallback)
- **Bundler:** Vite 5 (dev server on port 3000, runs under the supervisor
  `expo` program via a shim at `node_modules/.bin/expo`)
- **Language:** TypeScript 5, strict mode
- **Native shell:** `@capacitor/core`, `@capacitor/ios`, `@capacitor/android`
- **Ads:** `@capacitor-community/admob` (native only)
- **IAP:** `@revenuecat/purchases-capacitor` (native only)

## Directory layout

```
frontend/
  index.html
  vite.config.ts
  capacitor.config.ts
  public/assets/           # AI-generated PNG art
  src/
    main.ts                # Phaser bootstrap
    game/
      scenes/              # BootScene, PreloadScene, MenuScene, GameScene,
                           # HUDScene, PauseScene, GameOverScene, ShopScene,
                           # CorgiSelectScene, PrivacyScene, HowToPlayScene
      systems/             # Parallax, GameState, Storage
    services/
      ads/                 # AdService + AdSimOverlay (browser mock)
      purchases/           # PurchaseService
      consent/             # ConsentService
  scripts/
    generate_assets.py     # Nano Banana asset generation
    postprocess_assets.py  # Checker-pattern removal + trim
```

## Implemented features

### Gameplay
- One-tap jump (mouse, touch, Space, Arrow Up, on-screen paw button)
- 8-frame corgi run animation, distinct jump / fall / land / hit / idle poses
- Coyote time (110 ms) + jump input buffer (140 ms) for forgiving feel
- Progressive difficulty: single fences → doubles → wide doubles at score 8/18
- Smoothly ramping game speed (340 → 760 px/s)
- Fair collision boxes (fence hitRect matches visible art)
- Score, best score, treats-per-run, in-run treat collectables
- Reliable pause / resume, instant restart, auto-pause on tab background

### Rendering
- Layered parallax: sky, clouds, mountains, hills, grass, dirt path, foreground
  foliage (each scrolls at its own speed)
- Dust particle emitter behind the running corgi + shrinking shadow while airborne
- Landing squash tween, camera shake on collision, confetti particle celebration
  on a new best score
- Camera fade transitions between scenes; scale mode `FIT` at 720×1280 design
  resolution scales to any portrait phone

### UI (all Phaser-rendered — no HTML on top of gameplay)
- Trophy + best-score panel top-left
- Big centre score
- Circular pause button top-right
- Treats counter with bone icon
- Translucent paw jump control with pulsing "TAP TO JUMP" label
- Menu with Play, Corgis, Shop, How to Play, Privacy buttons
- Game-over panel with new-best animation, revive + 2× treats rewarded offers,
  restart, main menu
- Corgi selection grid (owned / selected / TRY (AD) states)
- Shop with 4 products + bonus-treats rewarded row + Restore + Back
- Privacy + purchase-management screen (Manage Privacy Choices, Restore,
  privacy policy / terms links, consent status readout)

### Monetization (mock in browser, native-ready via Capacitor)
- **Rewarded**
  - Revive (once per run) — reward gated on completed ad callback
  - 2× Treats (once per run, once claimed)
  - Bonus +25 Treats (max 3 per calendar day, persistent)
  - Trial Premium Corgi (one-run trial, does not permanently unlock)
- **Interstitial**
  - Never during gameplay
  - Never before 3 completed runs
  - At most every 5th completed run after that
  - Minimum 3-minute cooldown
  - Never immediately after a rewarded ad (30 s grace)
  - Disabled by Remove Ads entitlement
- **Purchases (RevenueCat product IDs)**
  - `com.corgihop.remove_ads` — Remove Ads Forever
  - `com.corgihop.starter_pack` — 300 treats + Starter Corgi + starting shield +
    7-day ad-free (one-shot, gated so it can't be claimed twice)
  - `com.corgihop.premium_corgis` — Cowboy / Superhero / Pirate / Astronaut
  - `com.corgihop.all_corgis` — Everything + 500 treats + future skins
- **Purchase UI states:** buy, in-progress, success, cancelled, failed, offline,
  unavailable, restore
- **Privacy:** Consent flow, restore purchases, privacy / terms links, TEST ADS
  badge visible in development builds

### Assets
- All artwork generated with Nano Banana (Gemini 3.1 Flash image preview) via
  `EMERGENT_LLM_KEY`. Post-processed to remove the AI-baked transparent-preview
  checker pattern and trim padding.
- Missing assets (bg_clouds, ui_paw_button, superhero/astronaut/starter corgi
  cosmetic textures) fall back to procedural Phaser Graphics or tinted variants
  of the base corgi, so the game boots and runs even without them.

## Environment variables (never committed for production)

See `.env.example` for the full list. AdMob TEST ad-unit IDs (Google's public
reserved test IDs) are hard-coded in `.env` for local development ONLY.

## Deferred / native-only

- Real AdMob rewarded + interstitial calls (native path in `AdService`)
- Real RevenueCat purchase / entitlement sync (native path in `PurchaseService`)
- Google UMP consent form and iOS App Tracking Transparency native prompt
- Haptics via `@capacitor/haptics`
- Store-provided localized pricing (browser preview uses mocked prices; native
  uses whatever Apple / Google returns)
