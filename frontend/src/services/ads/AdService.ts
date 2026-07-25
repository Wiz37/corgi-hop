// AdService — cross-platform façade for rewarded + interstitial ads.
//
// Browser preview (isNative=false): MOCK implementation.
//   - Rewarded ads show a clearly-labelled "TEST AD" simulation dialog
//     handled by AdSimOverlay. The reward callback fires only after the
//     simulated ad "completes" (a 3s timer or explicit "Complete" button).
//   - Interstitials are simulated with a brief blocking overlay.
//   - No real ad SDK is loaded.
//
// Native (Capacitor): swap in real AdMob (`@capacitor-community/admob`).
//   - Uses Google-supplied TEST ad-unit IDs during development.
//   - Production IDs pulled from `import.meta.env.VITE_ADMOB_*` at build time.
//   - Enforces the frequency rules described in MASTER_BUILD_PROMPT.md.

import { gameState } from '@/game/systems/GameState';
import { services } from '@/services';
import { AdSimOverlay } from './AdSimOverlay';

export type RewardKind = 'revive' | 'double_treats' | 'bonus_treats' | 'trial_corgi';

const MIN_INTERSTITIAL_GAP_MS = 3 * 60 * 1000; // 3 minutes
const INTERSTITIAL_START_AFTER_RUNS = 3;
const INTERSTITIAL_EVERY_N_RUNS = 5;

export class AdService {
  private native = false;
  private lastRewardedAt = 0;

  init(isNative: boolean): void {
    this.native = isNative;
    // Native TODO: initialise `@capacitor-community/admob` here once
    // consent has been granted (see ConsentService).
  }

  /** True if we are running in the browser preview (mock ads only). */
  isMock(): boolean { return !this.native; }

  /**
   * Show a rewarded ad. Resolves with `true` **only** after the ad's reward
   * callback confirms completion. Cancelled / failed / unavailable ads
   * resolve with `false` and the caller MUST NOT grant the reward.
   */
  async showRewarded(kind: RewardKind): Promise<boolean> {
    // Consent is checked; if the user has not consented in a jurisdiction
    // where consent is required, we still allow rewarded ads but as
    // non-personalized. That decision is made by ConsentService.
    if (services.consent.getStatus() === 'denied') return false;

    if (!this.native) {
      const ok = await AdSimOverlay.showRewarded(kind);
      if (ok) this.lastRewardedAt = Date.now();
      return ok;
    }
    // Native TODO: real AdMob rewarded flow.
    return false;
  }

  /**
   * Show an interstitial after a completed run — subject to all the rules
   * from the spec. Never call during active gameplay.
   * Resolves once the ad is dismissed (or immediately if we skipped it).
   */
  async maybeShowInterstitial(): Promise<void> {
    if (gameState.isAdFree()) return; // Remove Ads / Starter no-ads window
    if (services.consent.getStatus() === 'denied') return;

    const runs = gameState.runsCompleted;
    if (runs < INTERSTITIAL_START_AFTER_RUNS) return;
    if (runs % INTERSTITIAL_EVERY_N_RUNS !== 0) return;

    const now = Date.now();
    if (now - gameState.lastInterstitialAt < MIN_INTERSTITIAL_GAP_MS) return;
    // Never directly after a rewarded ad (30s grace)
    if (now - this.lastRewardedAt < 30_000) return;

    if (!this.native) {
      await AdSimOverlay.showInterstitial();
      gameState.markInterstitialShown();
      return;
    }
    // Native TODO: real AdMob interstitial flow. Failure => resolve silently.
  }

  /** Called by GameOverScene BEFORE rewarded flows to check availability. */
  isRewardedAvailable(): boolean {
    // In the browser preview we always allow simulated ads.
    // Native builds would poll `AdMob.isReady`.
    return true;
  }
}
