// Service surface for Corgi Hop.
// Browser preview uses clearly-labelled MOCK implementations (see docs in each file).
// Native (Capacitor) builds swap in real AdMob + RevenueCat implementations at runtime.

import { AdService } from './ads/AdService';
import { PurchaseService } from './purchases/PurchaseService';
import { ConsentService } from './consent/ConsentService';
import { gameState } from '@/game/systems/GameState';

export interface Services {
  ads: AdService;
  purchases: PurchaseService;
  consent: ConsentService;
  isNative: boolean;
  init(): void;
}

function detectNative(): boolean {
  // Capacitor injects `window.Capacitor` in native builds. In the browser
  // preview this is undefined, so all monetization stays mocked.
  const w = window as any;
  return !!(w.Capacitor && w.Capacitor.isNativePlatform && w.Capacitor.isNativePlatform());
}

export const services: Services = {
  ads: new AdService(),
  purchases: new PurchaseService(),
  consent: new ConsentService(),
  isNative: false,
  init() {
    this.isNative = detectNative();
    gameState.load();
    this.consent.init(this.isNative);
    this.ads.init(this.isNative);
    this.purchases.init(this.isNative);
  },
};
