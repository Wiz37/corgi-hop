# 🐾 Corgi Hop — Native Capacitor Release Handoff

Complete build handoff for producing **iOS TestFlight** and **Google Play
Internal Testing** builds on your local machine. The Emergent-managed
Expo mobile deploy pipeline is **not compatible** with this project because
Corgi Hop is a Phaser 3 + Vite + Capacitor game (not Expo Router).
Do the store builds locally instead — everything is prepared.

> **Safety checkpoint:** `git checkout capacitor-native-release-handoff`
> restores this exact handoff-ready state at any time.

---

## 1. Confirmation that nothing was rewritten or migrated

| Preserved | Status |
|---|---|
| Phaser 3 + Vite + TypeScript gameplay layer (`src/main.ts`, `src/game/`) | ✅ Unchanged since `pre-native-config-checkpoint` |
| 6 corgis — Classic, Starter, Cowboy, Superhero, Pirate, Astronaut | ✅ All 6 sprite sheets present in `public/assets/` |
| 8-frame run animations + jump/fall/land poses | ✅ Untouched |
| Physics-validated `HurdleGenerator` | ✅ Untouched |
| Bone economy + permanent corgi unlocks + saved progress | ✅ Untouched (`src/game/systems/Storage.ts`) |
| Consent + AdMob + RevenueCat services | ✅ Behaviour-preserved (only API-compat repairs from Phase A) |
| Menus / UI / How-to-Play / Privacy scenes | ✅ Untouched |
| Home screen loads on launch | ✅ Verified via screenshot |

| Explicitly NOT created | Confirmed |
|---|---|
| Expo Router `frontend/app/` route tree | ✅ Absent |
| React Native replacement scenes | ✅ Absent |
| Expo gameplay wrapper | ✅ Absent |
| Any migration commits | ✅ None (see `git log capacitor-native-release-handoff`) |

**No Expo migration occurred.**

---

## 2. Repository export

The repository lives at **`/app/`** inside this workspace. From Emergent:

* Click **"Push to GitHub"** in the top-right (creates a repo with the full
  Vite + Capacitor + native project tree — no keys, no keystores).
* Or use the **"Download source"** option to grab a `.zip` locally.

The `.gitignore` already excludes secrets. Confirmed excluded from every
export:

- ❌ `.env` (dev copy — safe demo IDs, but not committed)
- ❌ `*.jks` / `*.keystore` / `*.p8` / `*.p12` / `*.pem` / `*.mobileprovision`
- ❌ `android/keystore/`, `android/app/keystore/`, `android/app/*.jks`
- ❌ `android/app/google-services.json`
- ❌ `ios/App/Pods/`, `ios/App/build/`, `ios/App/output/`
- ❌ Any RevenueCat REST secret keys (they would never reach the client)

Included and safe:
- ✅ Full Phaser+Vite source in `src/`
- ✅ `package.json`, `package-lock.json`, `yarn.lock` (all three in sync at RC 9.2.2)
- ✅ `capacitor.config.ts`
- ✅ `ios/` — full Xcode project (Info.plist, LaunchScreen, AppIcon, PrivacyInfo.xcprivacy)
- ✅ `android/` — full Gradle project (AndroidManifest, build.gradle, mipmap icons, splash)
- ✅ `public/assets/` — 41 PNGs (all corgi run sheets + parallax + UI + logo)
- ✅ `.env.example` (redacted placeholders)
- ✅ `NATIVE_BUILD.md` and this file (`HANDOFF.md`)
- ✅ `resources/` — canonical native icon/splash sources

---

## 3. File inventory (top-level shape)

```
/app/frontend
├── .env.example              # redacted placeholders
├── .gitignore                # keystores + Pods + build/ excluded
├── HANDOFF.md                # THIS FILE
├── NATIVE_BUILD.md           # per-platform Xcode / Android Studio walkthrough
├── README.md                 # project overview
├── package.json              # yarn is authoritative
├── package-lock.json         # regenerated to match yarn.lock (RC 9.2.2)
├── yarn.lock                 # authoritative lockfile
├── capacitor.config.ts       # appId com.corgihop.game, portrait, brand-blue
├── vite.config.ts            # port 3000, base './', dist/ output
├── index.html                # Phaser boot HTML
├── tsconfig.json
├── resources/                # canonical native icon/splash source PNGs
│   ├── ios_appstore_1024.png
│   ├── android_adaptive_foreground.png
│   ├── android_adaptive_background.png
│   ├── android_legacy_512.png
│   ├── android_notification_mono.png
│   ├── splash_1242x2688.png             # iOS launch
│   └── android_splash_1920x1920.png     # Android 12+ splash
├── public/
│   └── assets/                          # 41 PNGs — 6 corgi run sheets, parallax, UI
├── scripts/
│   ├── postinstall.js                   # re-applies capacitor+expo shims on every install
│   ├── gen_app_icon.py                  # Gemini Nano Banana icon generator
│   ├── build_native_icons.py            # Pillow post-processor
│   ├── validate_hurdles.mjs             # 25 000-sequence hurdle physics validator
│   ├── cmd-guard.js + cmd-guard/        # Emergent command allow-list (leave alone)
│   └── … (asset-repair helpers)
├── src/
│   ├── main.ts                          # Phaser 3 boot + pause-on-interrupt handler
│   ├── game/
│   │   ├── scenes/                      # 11 scenes (Boot, Preload, Menu, Game, HUD,
│   │   │                                # Pause, GameOver, Shop, CorgiSelect,
│   │   │                                # Privacy, HowToPlay)
│   │   ├── systems/                     # GameState, Storage, HurdleGenerator, Parallax
│   │   └── ui/                          # PolishedButton, PolishedHUD
│   ├── services/
│   │   ├── ads/AdService.ts             # AdMob façade (mock in browser, real on device)
│   │   ├── purchases/PurchaseService.ts # RevenueCat façade (SDK pinned 9.2.2)
│   │   └── consent/ConsentService.ts    # GDPR/ATT stub
│   └── utils/
├── ios/                                 # Full Xcode project
│   └── App/
│       ├── App.xcodeproj/               # Signing team NOT set — you set it locally
│       ├── App.xcworkspace/             # OPEN THIS in Xcode (not the .xcodeproj)
│       ├── Podfile                      # platform :ios, '14.0'
│       └── App/
│           ├── Info.plist               # portrait, ATT, GADApplicationIdentifier,
│           │                            # 45 SKAdNetworkItems
│           ├── PrivacyInfo.xcprivacy    # ★ manually add to App target in Xcode
│           ├── Assets.xcassets/
│           │   ├── AppIcon.appiconset/  # 1024×1024 opaque corgi face
│           │   └── Splash.imageset/     # brand-blue CORGI HOP wordmark
│           └── Base.lproj/LaunchScreen.storyboard
└── android/                             # Full Gradle project
    ├── build.gradle
    ├── variables.gradle                 # compileSdk/targetSdk=35, minSdk=23
    ├── settings.gradle
    ├── gradlew, gradle/
    └── app/
        ├── build.gradle                 # versionName 1.0.0 versionCode 1
        │                                # applicationId com.corgihop.game
        ├── proguard-rules.pro
        └── src/main/
            ├── AndroidManifest.xml      # portrait, ADMOB APPLICATION_ID meta-data,
            │                            # AD_ID permission
            ├── java/com/corgihop/game/MainActivity.java
            ├── assets/public/           # Vite dist/ auto-copied by `cap sync`
            └── res/
                ├── mipmap-{mdpi..xxxhdpi}/ic_launcher{,_round,_foreground}.png
                ├── drawable-{port,land}-*/splash.png
                └── values/{strings,styles,colors,ic_launcher_background}.xml
```

---

## 4. Native project configuration snapshot

| Field | Value |
|---|---|
| **Capacitor core / cli / ios / android** | `6.x` |
| **@capacitor-community/admob** | `6.2.0` |
| **@revenuecat/purchases-capacitor** | **pinned exact `9.2.2`** (peer `^6.0.0` — DO NOT bump above 9.x without upgrading Capacitor) |
| **iOS bundle identifier** | `com.corgihop.game` |
| **iOS deployment target** | `14.0` (in `project.pbxproj` + `Podfile`) |
| **iOS marketing version / build** | `1.0.0` / `1` |
| **Android application ID** | `com.corgihop.game` |
| **Android compileSdk / targetSdk / minSdk** | `35 / 35 / 23` |
| **Android versionName / versionCode** | `1.0.0 / 1` |
| **Portrait-only** | ✅ (Info.plist + AndroidManifest `screenOrientation="portrait"`) |
| **AdMob demo App IDs baked in Info.plist + AndroidManifest** | ✅ (Google-official test IDs) |
| **PrivacyInfo.xcprivacy** | ✅ present at `ios/App/App/PrivacyInfo.xcprivacy` — **manually add to App target in Xcode** |

---

## 5. Build commands

The repo uses **Yarn 1.22.22** as the authoritative package manager
(`packageManager` field in `package.json`). Both lockfiles are in sync, so
either command set works.

### Fresh clean install
```bash
cd /app/frontend            # (or ./frontend in your local clone)

# Yarn (authoritative) — recommended
yarn install --frozen-lockfile

# Equivalent npm command (also works — package-lock.json is in sync)
npm ci
```

### Type-check + web bundle
```bash
npx tsc --noEmit            # ✔ 0 errors (verified in this workspace)
yarn vite build             # ✔ produces dist/ (~1.6 MB gzipped 365 KB)
```

### Copy web bundle into native projects
```bash
npx cap sync android        # ✔ verified — 2 plugins detected
npx cap sync ios            # ✔ verified — 2 plugins detected
                            #   ("Skipping pod install" is expected in this
                            #   Linux container; run on macOS locally.)
```

### Local dev server (optional)
```bash
yarn expo start --port 3000 # postinstall installs a shim so this launches
                            # Vite dev server, not Metro.
```

**Every install re-applies two patches automatically** via `scripts/postinstall.js`:

1. **@capacitor/cli tar-v7 shim** — otherwise `npx cap add / sync` fails with
   `Cannot read properties of undefined (reading 'extract')` because the repo
   pins `tar@7.5.19` (ESM-only) for security.
2. **expo → Vite shim** at `node_modules/.bin/expo` — makes `yarn expo start`
   launch Vite instead of Metro.

---

## 6. Local compile results

| Check | Where run | Result |
|---|---|---|
| `yarn install --frozen-lockfile` | this Linux container | ✅ Pass |
| `npm ci` (via lockfile sync check) | this Linux container | ✅ Pass |
| `npx tsc --noEmit` | this Linux container | ✅ **0 errors** |
| `yarn vite build` | this Linux container | ✅ `dist/` emitted, ~1.6 MB (gzipped 365 KB) |
| `npx cap sync android` | this Linux container | ✅ 2 plugins registered, no errors |
| `npx cap sync ios` | this Linux container | ✅ 2 plugins registered (pod install skipped — no CocoaPods) |
| **Browser preview → Corgi Hop home screen renders** | this Linux container | ✅ Verified |
| **Android debug APK** (`./gradlew :app:assembleDebug`) | **⚠ NOT RUN** | This container has no JDK / Android SDK. **You must run this on Windows in Android Studio (below).** |
| **iOS archive** (`xcodebuild archive`) | **⚠ NOT RUN** | This container has no Xcode / CocoaPods. **You must run this on macOS (below).** Per your rule 5, I do NOT claim this passed. |

---

## 7. Android build handoff (Windows / macOS / Linux)

### One-time setup
1. Install **Android Studio Hedgehog (2023.1.1) or newer** from
   <https://developer.android.com/studio>.
2. Inside Android Studio → **SDK Manager**:
   - Platform: **Android 15 (API 35)** — required by `compileSdk 35`
   - Build-Tools: **35.0.0**
   - Platform-Tools + Emulator (latest)
3. Install **JDK 17** (Android Studio bundles it as *Embedded JDK* — leave that selected).
4. Clone / download this repo.

### Open + sync
```bash
cd frontend
yarn install --frozen-lockfile      # postinstall reinstalls the two shims
yarn vite build
npx cap sync android
npx cap open android                # opens Android Studio on the ./android project
```
Wait for **Gradle sync** to finish (first sync takes ~2 min).

### Run on device / emulator
1. Enable *Developer options* → *USB debugging* on the phone, or start an
   emulator (AVD Manager → any Android 10+ image).
2. In Android Studio toolbar → device dropdown → select your device →
   click **Run** ▶.
3. App should launch **directly into the Corgi Hop home screen**.

### Configure RevenueCat + AdMob test mode
1. Edit `frontend/.env` on your local machine (never commit):
   ```env
   VITE_REVENUECAT_ANDROID_PUBLIC_KEY=goog_XXXX…       # from RevenueCat dashboard
   # Leave AdMob IDs empty → runtime falls back to Google demo IDs
   ```
2. Re-run `yarn vite build && npx cap sync android` after any `.env` change.

### Generate a signed Android App Bundle for Play Console
1. **Create a private upload keystore** (never commit — `.gitignore` excludes it):
   ```bash
   mkdir -p ~/keystores
   keytool -genkey -v \
     -keystore ~/keystores/corgihop-upload.jks \
     -alias corgihop -keyalg RSA -keysize 2048 -validity 10000
   ```
   Store the passwords in a password manager. **This file is irreplaceable** —
   losing it means you cannot publish updates to the same Play listing.
2. Add `~/keystores/corgihop-upload.jks` path to `android/local.properties`
   (also git-ignored):
   ```properties
   MYAPP_UPLOAD_STORE_FILE=<absolute path>
   MYAPP_UPLOAD_STORE_PASSWORD=…
   MYAPP_UPLOAD_KEY_ALIAS=corgihop
   MYAPP_UPLOAD_KEY_PASSWORD=…
   ```
3. **Android Studio → Build → Generate Signed Bundle → Android App Bundle → Release**
4. Upload the produced `android/app/release/app-release.aab` in
   **Google Play Console → Testing → Internal testing → Create new release**.
5. In Play Console → *Setup → License testing* → add tester Gmail addresses
   so `Purchase Service` returns sandbox `success` for `com.corgihop.*` products.

---

## 8. iOS build handoff (macOS only)

### One-time setup
1. **Xcode 15.4 or newer** from Mac App Store.
2. `xcode-select --install`
3. **CocoaPods**: `sudo gem install cocoapods` (or `brew install cocoapods`).
4. Enrol in the Apple Developer Program ($99/yr) if not already.

### Build
```bash
cd frontend
yarn install --frozen-lockfile
yarn vite build
npx cap sync ios
cd ios/App && pod install
cd ../.. && npx cap open ios        # opens App.xcworkspace in Xcode
```

### Configure Xcode signing
1. Xcode → target **App** → *Signing & Capabilities*
   - **Team:** your Apple Developer team
   - Tick **Automatically manage signing**
   - Confirm **Bundle Identifier = `com.corgihop.game`** (must match the App
     ID you create in App Store Connect)
2. **File → Add Files…** → select `ios/App/App/PrivacyInfo.xcprivacy` → tick
   the *App* target. (Capacitor CLI does not auto-add this.)

### Configure RevenueCat + AdMob test mode
1. Edit `frontend/.env` on your Mac (never commit):
   ```env
   VITE_REVENUECAT_IOS_PUBLIC_KEY=appl_XXXX…            # RevenueCat dashboard
   ```
2. On the RevenueCat dashboard: **Project Settings → Apps → iOS App → App
   Store Connect API → paste your `.p8` In-App Purchase Key**. Sandbox
   purchases WILL FAIL WITH GENERIC ERROR MESSAGES until this .p8 is
   uploaded.
3. Re-run `yarn vite build && npx cap sync ios && cd ios/App && pod install`.

### Run on a physical iPhone
1. Connect iPhone via USB, trust the computer.
2. Xcode top bar → select your iPhone (not simulator).
3. Click **Run** ▶. The device may prompt to *Trust this developer* under
   Settings → General → VPN & Device Management on first run.

### Archive + TestFlight upload
1. Xcode top bar → select **Any iOS Device (arm64)**.
2. **Product → Archive** → wait ~2 min → Organizer opens.
3. Click **Distribute App → App Store Connect → Upload**.
4. App Store Connect → *TestFlight → Builds* → your build appears after ~15
   min of processing → add internal testers.

---

## 9. Test environment (kept, per spec §6)

* Google-official AdMob DEMO IDs everywhere (Info.plist, AndroidManifest,
  runtime fallback in `AdService.ts`).
* Apple Sandbox purchases (iOS): triggered on TestFlight builds after the
  RevenueCat App Store In-App Purchase Key is uploaded.
* Google Play test purchases (Android): triggered on Internal Testing
  builds for tester Gmail accounts.
* **Browser preview keeps its mock services** — production/staging native
  builds cannot reach the mock path because it is gated behind
  `if (!this.native)` (see `PurchaseService.ts` line 200 and `AdService.ts`).
* **No live ads, no real charges** anywhere.

### `.env.example` placeholders (already in repo)
```env
VITE_REVENUECAT_IOS_PUBLIC_KEY=
VITE_REVENUECAT_ANDROID_PUBLIC_KEY=
VITE_ADMOB_IOS_APP_ID=
VITE_ADMOB_ANDROID_APP_ID=
VITE_ADMOB_IOS_REWARDED_ID=ca-app-pub-3940256099942544/1712485313
VITE_ADMOB_ANDROID_REWARDED_ID=ca-app-pub-3940256099942544/5224354917
VITE_ADMOB_IOS_INTERSTITIAL_ID=ca-app-pub-3940256099942544/4411468910
VITE_ADMOB_ANDROID_INTERSTITIAL_ID=ca-app-pub-3940256099942544/1033173712
VITE_PRIVACY_POLICY_URL=
VITE_TERMS_URL=
VITE_SUPPORT_URL=
VITE_MARKETING_URL=
```
> RevenueCat REST secret keys **must never** appear in the client. Only
> public SDK keys go into `.env`.

---

## 10. Native QA checklist (run on a real device with the built app)

- [ ] App icon = orange-and-white corgi face on brand-blue (installed launcher icon matches `resources/ios_appstore_1024.png` / adaptive foreground)
- [ ] App opens directly to the **Corgi Hop home screen** — never to a monetization/privacy/test screen
- [ ] All 6 corgis load in Choose Corgi (Classic, Starter, Cowboy, Superhero, Pirate, Astronaut)
- [ ] Run / jump / fall / land animations render smoothly at 60 fps
- [ ] Hurdles remain fair (no impossible spacing during the first 30 runs)
- [ ] Bone collection persists across app restarts (kill + relaunch → wallet unchanged)
- [ ] Bone spending in Shop is one-shot — no double-charge on rapid tap
- [ ] Permanent corgi unlocks persist across app restarts
- [ ] Rewarded revive video → revive granted exactly once (native reward event, not the fallback)
- [ ] Rewarded double-Bones video → doubling applied exactly once
- [ ] Interstitial does NOT show before the 3rd game-over
- [ ] Interstitials respect the 3-minute cool-down (rapid retries → no ad)
- [ ] Remove-Ads entitlement disables interstitials permanently
- [ ] **Restore Purchases** on Privacy scene re-hydrates entitlements
- [ ] Backgrounding the app while playing → auto-pause; foreground → PauseScene remains, must tap Resume
- [ ] Phone call interruption → auto-pause behaves identically
- [ ] Consent form (UMP / ATT) shown once, then persists
- [ ] Chrome DevTools inspector (Android via `chrome://inspect`) → NO uncaught exceptions and NO duplicate `adReward` listener registrations
- [ ] Verify **NO live ads** — every ad served during QA shows the "Test Ad" label

---

## 11. Missing before store submission (blockers for you to resolve locally)

| Missing item | Where to add |
|---|---|
| Real `VITE_REVENUECAT_IOS_PUBLIC_KEY` | Local `.env` (never commit) |
| Real `VITE_REVENUECAT_ANDROID_PUBLIC_KEY` | Local `.env` |
| Real `VITE_ADMOB_IOS_APP_ID` (`ca-app-pub-…~…` **not** `~1458002511`) | `.env` + `ios/App/App/Info.plist` `GADApplicationIdentifier` |
| Real `VITE_ADMOB_ANDROID_APP_ID` | `.env` + `android/app/src/main/AndroidManifest.xml` `com.google.android.gms.ads.APPLICATION_ID` |
| Real ad-unit IDs (4×) | `.env` |
| Privacy Policy URL | Host on your website + set `VITE_PRIVACY_POLICY_URL` + list in App Store Connect / Play Console |
| Terms of Service URL | Same |
| Support URL | Same |
| Marketing website URL | App Store Connect / Play Console listing |
| Apple Developer team | Xcode signing pane |
| App Store In-App Purchase `.p8` key | Upload to RevenueCat dashboard (iOS sandbox purchases fail otherwise) |
| Google Play Service Account JSON | Upload to RevenueCat dashboard (Android sandbox purchases) |
| 4 product IDs in App Store Connect + Play Console | Match `.env` product ID variables |
| Store listing screenshots (6.5"/6.7" iPhone, 7" tablet, phone Android) | App Store Connect / Play Console |
| Signed upload keystore (Android) | Create locally with `keytool`; NEVER commit |

---

## 12. Known limitations

- **Container cannot compile native code** — no JDK / Android SDK / Xcode /
  CocoaPods installed. All native compile & archive steps must run on your
  local machine.
- **RevenueCat 9.x has no "Test Store"** — real sandbox on iOS requires the
  App Store In-App Purchase Key on the RevenueCat dashboard.
- **Emergent's managed Expo deploy pipeline cannot deploy this project** —
  it is a Vite + Capacitor game, not an Expo Router app. Use the local
  Android Studio / Xcode workflow above instead.
- The Phaser bundle is a single 1.56 MB JS chunk. Not a bug — Phaser is
  intentionally shipped as one file. Gzip brings it to ~365 KB.
- Background audio, PiP, and true background operation require a native
  build to test (not verifiable in browser preview).

---

## 13. Final handoff summary

1. **GitHub / export status:** Ready — hit *Push to GitHub* or *Download source*.
2. **Repository location:** `/app/frontend/` in this workspace; safety
   checkpoint tag `capacitor-native-release-handoff`.
3. **File inventory:** Complete tree in §3 above.
4. **Build commands:** §5.
5. **Android compilation result:** `cap sync` ✅, actual Gradle build **not
   attempted** in this container (no JDK/Android SDK). Please run
   `./gradlew :app:assembleDebug` on Windows.
6. **iOS synchronization result:** `cap sync` ✅ (2 plugins), pod install
   skipped in this container. Actual archive **not attempted** (no macOS).
7. **Missing public keys:** All 4 (RC iOS/Android + AdMob iOS/Android App IDs).
8. **Missing store credentials:** Apple Developer team, App Store IAP `.p8`,
   Play Service Account, upload keystore.
9. **Missing URLs:** privacy policy, terms, support, marketing.
10. **Known limitations:** §12.
11. **Android Studio instructions:** §7.
12. **Xcode / TestFlight instructions:** §8.
13. **Game not rewritten:** ✅ Confirmed — no changes to `src/game/**`,
    `public/assets/**`, or `src/services/**` behaviour since Phase A's
    RevenueCat API-compat repair.
14. **No Expo migration:** ✅ Confirmed — no `frontend/app/` route tree
    exists, no Expo Router files, `app.json` untouched from previous state,
    all game code remains Phaser 3 + Vite + TypeScript.

**Do not publish to the stores automatically. This handoff stops here.**
