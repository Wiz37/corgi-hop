# Corgi Hop — Phaser 3 + Capacitor mobile game

A polished portrait mobile runner built with **Phaser 3 (WebGL)**, **Vite +
TypeScript**, and packaged for iOS / Android via **Capacitor**. Monetization is
wired for Google AdMob (rewarded + interstitial) and RevenueCat (Apple StoreKit
+ Google Play Billing), with a fully-playable browser preview using clearly
labelled **test / simulated** ads and purchases.

## Preview / development

The browser preview is served by `vite` on port `3000`. It runs automatically
under the pod supervisor (via the shim at `node_modules/.bin/expo`). To reload,
restart the `expo` supervisor program:

```bash
sudo supervisorctl restart expo
```

Open the public preview URL and everything below will "just work":

- Menu → Play → Game → Game Over → Menu / Restart
- Corgi selection screen (rewarded-ad trial for premium corgis)
- Shop screen (mock in-app-purchase dialog, simulated success / cancel / offline)
- Privacy & purchase-management screen (consent + restore + policy links)
- Pause / Resume / Restart / auto-pause when the browser tab is backgrounded

## Assets

All artwork under `public/assets/` was generated with Google **Nano Banana**
(Gemini image gen) via the `EMERGENT_LLM_KEY`, then post-processed by
`scripts/postprocess_assets.py` to remove the transparent-preview checker
pattern and trim padding around single-object sprites.

- Corgi sprite sheet: 8 running frames in `corgi_run_sheet.png` (366×352 per
  frame), plus separate jump/fall/land/hit/idle poses.
- Parallax layers: `bg_sky`, `bg_clouds`, `bg_mountains`, `bg_hills`,
  `bg_grass`, `bg_path`, `bg_foreground`. Any missing layer is redrawn
  procedurally in Phaser Graphics at load time (see `PreloadScene`).
- Narrow white agility fence: `fence.png`.
- UI: trophy panel, big score font (Phaser text), circular pause button,
  translucent paw jump control, game-over / shop / menu panels, treats.

## Monetization

Every ad / purchase call goes through a small service layer:

- `src/services/ads/AdService.ts` — rewarded (revive, 2x treats, bonus treats,
  trial corgi) + interstitial. Native path uses AdMob TEST unit IDs from
  `import.meta.env.VITE_ADMOB_*`. Browser path shows a clearly labelled
  `AdSimOverlay` and only fires the reward callback after a completed timer.
- `src/services/purchases/PurchaseService.ts` — 4 non-consumable products
  (Remove Ads, Starter Pack, Premium Corgis, All Corgis Bundle) wired to
  entitlements in `GameState`. Native path uses RevenueCat; browser path uses
  a fully labelled simulated dialog with success / cancel / failed / offline
  states.
- `src/services/consent/ConsentService.ts` — GDPR / UMP consent gate + iOS
  App Tracking Transparency hook. Consent status is checked before any ad
  request; browser preview auto-marks status as `not_required`.

### Frequency rules (enforced in `AdService`)

- **Never** during active gameplay.
- **Never** for the first three completed runs.
- After that, **at most every fifth** completed run.
- Minimum **three-minute** cooldown between interstitials.
- **Never** immediately after a rewarded ad (30 s grace).
- **Never** to players who own `com.corgihop.remove_ads`.
- Failed / unavailable ads resolve immediately without blocking the game.

### Rewarded rules

- **Revive** — once per run, only after a completed reward callback. Removes
  the collided obstacle and grants 2 s of invulnerability.
- **2× Treats** — once per run, added only after the callback fires.
- **Bonus Treats (+25)** — max 3 claims per calendar day. Uses persist across
  restarts (stored in localStorage, reset when the local date changes).
- **Try a Premium Corgi** — grants a one-run trial only. Never permanent.

## Native (Capacitor) packaging

The Capacitor project is configured via `capacitor.config.ts`:

```
appId:     com.corgihop.game
appName:   Corgi Hop
webDir:    dist
```

Native builds must be produced outside the browser preview:

```bash
# once, from your dev machine
yarn build            # or: npx vite build
npx cap add ios
npx cap add android
npx cap sync
# Then open the native project and add:
#   - @capacitor-community/admob        (rewarded + interstitial + UMP)
#   - @revenuecat/purchases-capacitor   (Apple StoreKit / Google Play Billing)
# Wire real API keys via the .env → import.meta.env.VITE_* pipeline.
```

**Never commit production keys** — leave the `VITE_*` entries in `.env.example`
blank. AdMob TEST ad-unit IDs (Google's own reserved test IDs) are shipped in
`.env` for local development only.

## Product IDs

- `com.corgihop.remove_ads`      — Remove Ads Forever (non-consumable)
- `com.corgihop.starter_pack`    — 300 treats + Starter Corgi + starting shield + 7-day ad-free
- `com.corgihop.premium_corgis`  — Cowboy / Superhero / Pirate / Astronaut
- `com.corgihop.all_corgis`      — Everything above + 500 treats + all future standard skins

## Regenerating assets

```bash
python3 scripts/generate_assets.py             # regenerate everything missing
python3 scripts/postprocess_assets.py           # clean checkerboard + trim
```

## Privacy / data safety checklist (production before release)

- App Store privacy nutrition labels populated for AdMob + RevenueCat.
- Google Play Data Safety disclosure completed.
- Privacy Policy + Terms URLs configured (`VITE_PRIVACY_POLICY_URL`,
  `VITE_TERMS_URL`) and reachable from the in-game Privacy screen.
- ATT explainer shown before the system prompt (see `ConsentService`).
- Non-personalised / limited ads served when consent is unavailable.
