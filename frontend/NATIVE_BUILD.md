# Corgi Hop — Native Build Guide

Both native projects are **pre-configured for TEST MODE**. Google's official
demo AdMob IDs and RevenueCat sandbox flows are wired up. **Do NOT enable
live monetization until every checklist item in the release section below
is satisfied.**

---

## Version Info

| Item | Value |
|---|---|
| Capacitor | `6.x` (core, cli, ios, android) |
| `@capacitor-community/admob` | `6.2.0` |
| `@revenuecat/purchases-capacitor` | **pinned** `9.2.2` — do NOT bump above 9.x without upgrading Capacitor first |
| iOS deployment target | `14.0` |
| Android `minSdk / targetSdk / compileSdk` | `23 / 35 / 35` |
| App marketing version | `1.0.0` |
| iOS `CFBundleVersion` / Android `versionCode` | `1` |
| iOS bundle id / Android package | `com.corgihop.game` |

Bumping versions:

* **iOS** — open `ios/App/App.xcodeproj` in Xcode → App target → General →
  `Version` (`MARKETING_VERSION`) and `Build` (`CURRENT_PROJECT_VERSION`).
* **Android** — edit `android/app/build.gradle`:
  ```groovy
  versionCode 2      // integer, monotonic
  versionName "1.0.1"
  ```

The two platforms are versioned **independently**.

---

## 1. Prerequisites (local machine — not this container)

* macOS with **Xcode 15.4 or newer** for iOS builds
  * `xcode-select --install`
  * Command Line Tools + at least one iOS simulator installed
  * Apple Developer account enrolled in the Apple Developer Program
  * CocoaPods:  `sudo gem install cocoapods` (or `brew install cocoapods`)
* **Android Studio Hedgehog (2023.1.1) or newer**
  * Android SDK Platform 35, Build-Tools 35.0.0, Emulator, Platform-Tools
  * A Google Play Console account
* **Node 20+** and **Yarn 1.22.x** (matches this repo's `packageManager` field)

---

## 2. Building the web bundle

Every native run needs a fresh `dist/`.  From `/app/frontend`:

```bash
yarn install          # first time only
yarn vite build       # produces dist/
npx cap sync          # copies dist/ into ios/ and android/, updates plugins
```

`cap sync` should list **exactly two plugins** and NO warnings:
```
Found 2 Capacitor plugins for ios / android:
  @capacitor-community/admob@6.2.0
  @revenuecat/purchases-capacitor@9.2.2
```

---

## 3. iOS — TestFlight build

1. `cd ios/App && pod install`  (installs AdMob + RevenueCat native SDKs)
2. Open **`ios/App/App.xcworkspace`** (the *workspace*, not the .xcodeproj) in Xcode.
3. Select the **App** target → **Signing & Capabilities** →
   * Set **Team** to your Apple Developer team.
   * Tick **Automatically manage signing**.
4. **Bundle Identifier** is already `com.corgihop.game` — must match the
   entry you create in App Store Connect.
5. **Manually add `PrivacyInfo.xcprivacy` to the App target**:
   Xcode → File → Add Files… → select `ios/App/App/PrivacyInfo.xcprivacy`
   → tick the *App* target.  (Capacitor CLI does not auto-add this file.)
6. Select a physical iPhone (or `Any iOS Device (arm64)` for archive) → build
   & run.  Confirm the app launches into the **Corgi Hop home screen**.
7. To archive: **Product → Archive** → Organizer window opens → **Distribute
   App** → **App Store Connect** → **Upload**.
8. In App Store Connect → TestFlight → Builds → your build appears in ~15 min
   after processing.  Add internal testers and TestFlight sends the invite.

**RevenueCat sandbox requirement**: before the first real purchase test on
iOS, upload the App Store In-App Purchase Key to the RevenueCat dashboard
(RevenueCat → Project Settings → Apps → your iOS app → *App Store Connect
API* → paste the .p8 key). Without this, sandbox purchases fail with a
generic "Unknown error" popup.

---

## 4. Android — Google Play Internal Testing build

1. Open **`android/`** in Android Studio → wait for Gradle sync to finish.
2. Confirm `Build → Select Build Variant… → app → release`.
3. **Create a local upload keystore** (do NOT commit it):
   ```bash
   mkdir -p ~/keystores
   keytool -genkey -v \
     -keystore ~/keystores/corgihop-upload.jks \
     -alias corgihop \
     -keyalg RSA -keysize 2048 -validity 10000
   ```
   Store the password in a password manager. This file is **irreplaceable** —
   losing it means you can no longer publish updates on the same listing.
4. Add local signing config to **`android/local.properties`** (already
   git-ignored):
   ```properties
   MYAPP_UPLOAD_STORE_FILE=/Users/YOU/keystores/corgihop-upload.jks
   MYAPP_UPLOAD_STORE_PASSWORD=…
   MYAPP_UPLOAD_KEY_ALIAS=corgihop
   MYAPP_UPLOAD_KEY_PASSWORD=…
   ```
5. Add release signing to **`android/app/build.gradle`** (only present on
   your local machine — never committed):
   ```groovy
   android {
     signingConfigs {
       release {
         storeFile     file(MYAPP_UPLOAD_STORE_FILE)
         storePassword MYAPP_UPLOAD_STORE_PASSWORD
         keyAlias      MYAPP_UPLOAD_KEY_ALIAS
         keyPassword   MYAPP_UPLOAD_KEY_PASSWORD
       }
     }
     buildTypes {
       release {
         signingConfig signingConfigs.release
       }
     }
   }
   ```
6. **Build → Generate Signed Bundle / APK → Android App Bundle → Release**.
7. In Play Console → Testing → Internal testing → **Create new release** →
   upload `android/app/release/app-release.aab` → save & roll out.
8. Add up to 100 testers by email → they follow the Play test-link and
   install via the Play Store.

**Test purchases**: Play Console → Setup → License testing → add tester
Gmail addresses. Testers must join the internal testing programme first.

---

## 5. Test-mode → Production checklist (before store submission)

Do **not** flip production monetization until **every** item is checked:

- [ ] `.env` has real `VITE_REVENUECAT_IOS_PUBLIC_KEY` and `VITE_REVENUECAT_ANDROID_PUBLIC_KEY` (public SDK keys only — never REST secrets)
- [ ] `.env` has real `VITE_ADMOB_IOS_APP_ID`, `VITE_ADMOB_ANDROID_APP_ID` and all 4 ad-unit IDs (**none containing `ca-app-pub-3940256099942544`**)
- [ ] `ios/App/App/Info.plist` `GADApplicationIdentifier` matches `VITE_ADMOB_IOS_APP_ID`
- [ ] `android/app/src/main/AndroidManifest.xml` `com.google.android.gms.ads.APPLICATION_ID` matches `VITE_ADMOB_ANDROID_APP_ID`
- [ ] `VITE_APP_ENV=production`, `VITE_ENABLE_PRODUCTION_MONETIZATION=true`, `VITE_USE_AD_TEST_IDS` unset
- [ ] `VITE_PRIVACY_POLICY_URL`, `VITE_TERMS_URL`, `VITE_SUPPORT_URL`, `VITE_MARKETING_URL` are reachable HTTPS URLs
- [ ] iOS `PrivacyInfo.xcprivacy` reviewed and reflects actual data collection
- [ ] iOS ATT usage description in Info.plist reads well for reviewers
- [ ] RevenueCat dashboard: **App Store In-App Purchase Key** uploaded (iOS) + Google Play Service Account credentials uploaded (Android)
- [ ] All 4 product IDs (`com.corgihop.remove_ads`, `com.corgihop.starter_pack`, `com.corgihop.premium_corgis`, `com.corgihop.all_corgis`) exist in App Store Connect and Google Play with pricing set
- [ ] Store listings uploaded (screenshots, description, age rating, category)
- [ ] AdMob dashboard: app added, ad units created, ads.txt hosted at your website root
- [ ] Test rewarded ad + interstitial + purchase + restore on **at least one real device per platform** (test IDs) → validate NO crashes, NO duplicate reward events, NO console errors

**Never** simulate a successful purchase inside a native production/staging
build — the mock path lives behind `if (!this.native)` and is unreachable
on device.

---

## 6. Common gotchas

* If `pod install` fails with an M-chip Mac error, run
  `arch -x86_64 pod install` once, then delete `ios/App/Pods` and re-run.
* If Android Studio complains about `minSdkVersion` mismatch after a plugin
  update, edit `android/variables.gradle` (not `build.gradle`).
* Never commit `google-services.json`, `.jks`, `.keystore`, `.p8`, `.p12`,
  or `.mobileprovision` files. `.gitignore` already excludes them.
* If AdMob interstitials refuse to load on device, verify `AD_ID` permission
  is present and the app has been granted "Ads" access under Play Store →
  Settings → Family & policies.
