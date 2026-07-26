// AdService — cross-platform façade for rewarded + interstitial ads.
//
// Browser preview (isNative=false): MOCK via AdSimOverlay.
// Native (Capacitor 6): real AdMob via `@capacitor-community/admob@6`.
//   - Google TEST/DEMO ad-unit IDs unless VITE_* env vars provide real ones
//     AND VITE_USE_AD_TEST_IDS is not "true".
//   - Frequency rules: no ads during active runs, no banner, no app-open,
//     no interstitial before the 3rd game-over, ~1 every 4 game-overs,
//     ≥180 s between interstitials, removeAds disables interstitials.
//   - Rewards fire ONLY from the native reward callback; duplicate reward
//     dispatch is prevented by a single-shot flag per showRewarded call.
import { gameState } from '@/game/systems/GameState';
import { services } from '@/services';
import { AdSimOverlay } from './AdSimOverlay';

export type RewardKind = 'revive' | 'double_treats' | 'bonus_treats' | 'trial_corgi';

const MIN_INTERSTITIAL_GAP_MS = 3 * 60 * 1000; // 3 minutes
const INTERSTITIAL_START_AFTER_RUNS = 3;
const INTERSTITIAL_EVERY_N_RUNS = 4;   // ~every 4th eligible game over

// Google-official DEMO ad-unit IDs (safe for development on real devices).
const DEMO_INTERSTITIAL_ANDROID = 'ca-app-pub-3940256099942544/1033173712';
const DEMO_INTERSTITIAL_IOS     = 'ca-app-pub-3940256099942544/4411468910';
const DEMO_REWARDED_ANDROID     = 'ca-app-pub-3940256099942544/5224354917';
const DEMO_REWARDED_IOS         = 'ca-app-pub-3940256099942544/1712485313';

// Lazily-imported AdMob module. Kept `any` so the browser bundle can build
// without the native plugin's iOS/Android bridge existing.
let AdMob: any = null;

async function loadAdMob(): Promise<any> {
  if (AdMob) return AdMob;
  try {
    const mod = await import('@capacitor-community/admob');
    AdMob = mod.AdMob;
    return AdMob;
  } catch {
    return null;
  }
}

function isTestBuild(): boolean {
  const forced = String(import.meta.env.VITE_USE_AD_TEST_IDS ?? '').toLowerCase();
  if (forced === 'true' || forced === '1') return true;
  // Default to demo IDs whenever real IDs are not fully configured.
  const androidRealInt = String(import.meta.env.VITE_ADMOB_ANDROID_INTERSTITIAL_ID ?? '');
  const iosRealInt = String(import.meta.env.VITE_ADMOB_IOS_INTERSTITIAL_ID ?? '');
  const androidLooksReal = androidRealInt && !androidRealInt.includes('/1033173712');
  const iosLooksReal = iosRealInt && !iosRealInt.includes('/4411468910');
  return !(androidLooksReal || iosLooksReal);
}

function adUnitId(kind: 'interstitial' | 'rewarded'): string {
  // We don't know the platform without importing Capacitor — pick both and
  // let the plugin choose; on iOS the Android ID is ignored & vice-versa.
  // AdMob v6 API accepts a single adId, so we resolve here.
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (isTestBuild()) {
    if (kind === 'interstitial') return isIOS ? DEMO_INTERSTITIAL_IOS : DEMO_INTERSTITIAL_ANDROID;
    return isIOS ? DEMO_REWARDED_IOS : DEMO_REWARDED_ANDROID;
  }
  if (kind === 'interstitial') {
    return String(import.meta.env[isIOS ? 'VITE_ADMOB_IOS_INTERSTITIAL_ID' : 'VITE_ADMOB_ANDROID_INTERSTITIAL_ID']);
  }
  return String(import.meta.env[isIOS ? 'VITE_ADMOB_IOS_REWARDED_ID' : 'VITE_ADMOB_ANDROID_REWARDED_ID']);
}

export class AdService {
  private native = false;
  private initialized = false;
  private lastRewardedAt = 0;
  private rewardedInFlight = false;
  private interstitialInFlight = false;

  init(isNative: boolean): void {
    this.native = isNative;
    if (!isNative) return;
    // Native init happens lazily on the first `ensureInitialised` call so
    // we can wait until AFTER the consent flow has completed.
  }

  private async ensureInitialised(): Promise<boolean> {
    if (!this.native || this.initialized) return this.initialized;
    const ad = await loadAdMob();
    if (!ad) return false;
    try {
      await ad.initialize({
        // Register hashed device IDs from env so real-device testing serves
        // test creatives even when live IDs are configured.
        testingDevices: String(import.meta.env.VITE_ADMOB_TEST_DEVICE_IDS ?? '')
          .split(',').map(s => s.trim()).filter(Boolean),
        initializeForTesting: isTestBuild(),
      });
      this.initialized = true;
    } catch (e) {
      // Silent — native mock persists via AdSimOverlay.
      // eslint-disable-next-line no-console
      console.warn('[AdMob] initialize failed:', e);
    }
    return this.initialized;
  }

  isMock(): boolean { return !this.native; }

  async showRewarded(kind: RewardKind): Promise<boolean> {
    if (services.consent.getStatus() === 'denied') return false;
    if (this.rewardedInFlight) return false;   // duplicate-tap guard
    this.rewardedInFlight = true;
    try {
      if (!this.native) {
        const ok = await AdSimOverlay.showRewarded(kind);
        if (ok) this.lastRewardedAt = Date.now();
        return ok;
      }
      const ready = await this.ensureInitialised();
      const ad = await loadAdMob();
      if (!ready || !ad) return false;
      try {
        await ad.prepareRewardVideoAd({
          adId: adUnitId('rewarded'),
          isTesting: isTestBuild(),
        });
        // ONE-SHOT reward flag — only the FIRST 'onRewardedVideoReward'
        // event may grant the reward; subsequent duplicate listener fires
        // are ignored. AdMob v6 uses adReward event on the AdMob plugin.
        let earned = false;
        const rewardListener = await ad.addListener('adReward', () => {
          if (!earned) earned = true;
        });
        try {
          await ad.showRewardVideoAd();
        } finally {
          await rewardListener.remove();
        }
        if (earned) {
          this.lastRewardedAt = Date.now();
          return true;
        }
        return false;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[AdMob] rewarded flow failed:', e);
        return false;
      }
    } finally {
      this.rewardedInFlight = false;
    }
  }

  async maybeShowInterstitial(): Promise<void> {
    if (gameState.isAdFree()) return;
    if (services.consent.getStatus() === 'denied') return;
    if (this.interstitialInFlight) return;

    const runs = gameState.runsCompleted;
    if (runs < INTERSTITIAL_START_AFTER_RUNS) return;
    if (runs % INTERSTITIAL_EVERY_N_RUNS !== 0) return;

    const now = Date.now();
    if (now - gameState.lastInterstitialAt < MIN_INTERSTITIAL_GAP_MS) return;
    if (now - this.lastRewardedAt < 30_000) return;

    this.interstitialInFlight = true;
    try {
      if (!this.native) {
        await AdSimOverlay.showInterstitial();
        gameState.markInterstitialShown();
        return;
      }
      const ready = await this.ensureInitialised();
      const ad = await loadAdMob();
      if (!ready || !ad) return;
      try {
        await ad.prepareInterstitial({
          adId: adUnitId('interstitial'),
          isTesting: isTestBuild(),
        });
        await ad.showInterstitial();
        gameState.markInterstitialShown();
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[AdMob] interstitial flow failed:', e);
      }
    } finally {
      this.interstitialInFlight = false;
    }
  }

  isRewardedAvailable(): boolean { return true; }
}
