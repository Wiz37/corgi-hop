import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Corgi Hop — Capacitor 6 configuration.
 *
 * Permanent identifiers (do not change):
 *   iOS bundle id     = com.corgihop.game
 *   Android package id = com.corgihop.game
 *
 * Version + build number are tracked in the native projects:
 *   iOS  → ios/App/App/Info.plist  (CFBundleShortVersionString + CFBundleVersion)
 *   Android → android/app/build.gradle  (versionName + versionCode)
 * They are kept identical to package.json "version" (1.0.0 / build 1) at
 * project creation. Bumping is done independently per platform.
 *
 * Monetization stays in TEST MODE for this build cycle:
 *   • AdMob → Google-official demo ad-unit IDs unless real IDs are provided.
 *   • RevenueCat → Apple StoreKit Sandbox (iOS) / Google Play Internal Test (Android).
 *   • Browser preview keeps its mock services (see src/services/).
 * `.env` never contains production keys; production values are injected by
 * the release pipeline before archive/AAB generation.
 */
const config: CapacitorConfig = {
  appId: 'com.corgihop.game',
  appName: 'Corgi Hop',
  webDir: 'dist',
  bundledWebRuntime: false,
  loggingBehavior: 'production',
  ios: {
    contentInset: 'always',
    backgroundColor: '#3fa7ff',
    scheme: 'Corgi Hop',
    // Portrait-only orientation is enforced by the ios/App/App/Info.plist
    // `UISupportedInterfaceOrientations` array — Capacitor 6 does NOT expose
    // that key here, so it lives in the native project.
    limitsNavigationsToAppBoundDomains: false,
  },
  android: {
    backgroundColor: '#3fa7ff',
    allowMixedContent: false,
    // captureInput = true so the game canvas keeps the tap gesture in-app
    // (matches the "hardware-accelerated" flag we add in AndroidManifest).
    captureInput: true,
    webContentsDebuggingEnabled: false, // disabled in release builds
  },
  server: {
    androidScheme: 'https',
    // The bundled dist/ is served from the WKWebView (iOS) and WebView
    // (Android) local file scheme — do NOT set `url` here or ad SDKs
    // treat the origin as remote and refuse to load.
  },
  plugins: {
    /**
     * AdMob — Test-mode by default.
     *   • initializeForTesting=true keeps Google's DEMO ad-unit IDs live
     *     even after the plugin's own initialise() call, so early rewarded/
     *     interstitial requests during QA never accidentally serve live ads.
     *   • requestTrackingAuthorization=true triggers Apple ATT AFTER the
     *     Consent UMP flow (see src/services/consent/ConsentService.ts).
     *   • testingDevices is populated from VITE_ADMOB_TEST_DEVICE_IDS at
     *     runtime in AdService.ts.
     */
    AdMob: {
      initializeForTesting: true,
      requestTrackingAuthorization: true,
      testingDevices: [],
      // Android application ID meta-data is set in AndroidManifest.xml
      // (`com.google.android.gms.ads.APPLICATION_ID`). iOS uses
      // GADApplicationIdentifier in Info.plist. Both default to Google's
      // demo App IDs — see resources/native-config-notes.md.
    },
    SplashScreen: {
      launchShowDuration: 800,
      launchAutoHide: true,
      backgroundColor: '#3fa7ff',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: false,
      showSpinner: false,
      // iOS uses the LaunchScreen storyboard directly — this plugin only
      // manages the hide-timing there.
    },
  },
};

export default config;
