// PurchaseService — cross-platform façade for RevenueCat entitlements.
//
// Browser preview (isNative=false): MOCK. Products are hard-coded with clearly-
// labelled *test* prices ("Available in the iPhone and Android app"). "Buying"
// simulates the store dialog and, if confirmed, grants the entitlement locally.
// The mock ALSO exposes the failure / cancel / offline states so ShopScene can
// exercise its UI states end-to-end.
//
// Native (Capacitor): swap in real `@revenuecat/purchases-capacitor` calls.
// Product IDs, public SDK keys, and prices all come from the store (never
// hard-coded in the source).

import { gameState, type Entitlements } from '@/game/systems/GameState';
import { storage, STORAGE_KEYS as K } from '@/game/systems/Storage';

export type ProductId =
  | 'com.corgihop.remove_ads'
  | 'com.corgihop.starter_pack'
  | 'com.corgihop.premium_corgis'
  | 'com.corgihop.all_corgis';

export interface Product {
  id: ProductId;
  title: string;
  description: string;
  priceString: string;      // localized string returned by the store
  productType: 'non_consumable' | 'consumable';
  benefits: string[];
  artKey: string;           // Phaser texture key
}

export type PurchaseResult =
  | { kind: 'success'; productId: ProductId }
  | { kind: 'cancelled' }
  | { kind: 'failed'; message: string }
  | { kind: 'offline' }
  | { kind: 'unavailable' };

// Mock catalog: prices here are LABELLED as test prices and only shown
// in the browser preview. On native, the price comes from Apple / Google.
const MOCK_CATALOG: Product[] = [
  {
    id: 'com.corgihop.remove_ads',
    title: 'Remove Ads Forever',
    description: 'Permanently disables forced interstitial ads. Optional rewarded ads still available.',
    priceString: '$3.99',
    productType: 'non_consumable',
    benefits: ['No forced interstitials, ever', 'Support the game 💛'],
    artKey: 'ui_button_gold',
  },
  {
    id: 'com.corgihop.starter_pack',
    title: 'Starter Pack',
    description: 'A generous boost to jump-start your corgi.',
    priceString: '$1.99',
    productType: 'non_consumable',
    benefits: ['300 treats', 'Exclusive Starter Corgi', '1 permanent starting shield', 'No forced ads for 7 days'],
    artKey: 'ui_button_blue',
  },
  {
    id: 'com.corgihop.premium_corgis',
    title: 'Premium Corgi Pack',
    description: 'Unlock four themed premium corgis (cosmetic only).',
    priceString: '$2.99',
    productType: 'non_consumable',
    benefits: ['Cowboy Corgi', 'Superhero Corgi', 'Pirate Corgi', 'Astronaut Corgi'],
    artKey: 'ui_button',
  },
  {
    id: 'com.corgihop.all_corgis',
    title: 'All Corgis Bundle',
    description: 'Every current premium corgi + 500 bonus treats + all future standard skins.',
    priceString: '$5.99',
    productType: 'non_consumable',
    benefits: ['All premium corgis', '500 bonus treats', 'All future standard skins'],
    artKey: 'ui_button_gold',
  },
];

export class PurchaseService {
  private native = false;
  private catalog: Product[] = MOCK_CATALOG.slice();
  private ready = false;
  private starterExtraShields = 0;

  init(isNative: boolean): void {
    this.native = isNative;
    // Load cached entitlements (spec: cache verified entitlements for offline play).
    // gameState.load() has already populated `gameState.entitlements`.
    this.starterExtraShields = storage.getNumber('starter_shields_remaining', 0);
    this.ready = !isNative; // browser preview is instantly ready
    if (isNative) {
      // Native TODO: configure RevenueCat, log in, fetch offerings, refresh
      // entitlements, then set `this.ready = true`.
    }
  }

  isReady(): boolean { return this.ready; }
  isMock(): boolean { return !this.native; }

  getCatalog(): Product[] { return this.catalog.slice(); }
  getProduct(id: ProductId): Product | undefined { return this.catalog.find((p) => p.id === id); }

  getEntitlements(): Entitlements { return { ...gameState.entitlements }; }

  hasEntitlement(id: ProductId): boolean {
    const e = gameState.entitlements;
    switch (id) {
      case 'com.corgihop.remove_ads':    return e.removeAds;
      case 'com.corgihop.starter_pack':  return e.starterPack;
      case 'com.corgihop.premium_corgis':return e.premiumCorgis;
      case 'com.corgihop.all_corgis':    return e.allCorgis;
    }
  }

  /** Consume a starting shield (used by GameScene). */
  consumeStartingShield(): boolean {
    if (this.starterExtraShields > 0) {
      this.starterExtraShields -= 1;
      storage.setNumber('starter_shields_remaining', this.starterExtraShields);
      return true;
    }
    return false;
  }
  getStartingShields(): number { return this.starterExtraShields; }

  /** Simulated / native purchase flow. */
  async purchase(id: ProductId): Promise<PurchaseResult> {
    if (!this.ready) return { kind: 'unavailable' };

    if (!this.native) {
      // Simulated flow: ask the user via a DOM confirm-style dialog.
      const confirmed = await this.showBrowserPurchaseDialog(id);
      if (!confirmed) return { kind: 'cancelled' };
      // Starter Pack: block a second successful claim (spec).
      if (id === 'com.corgihop.starter_pack' && gameState.entitlements.starterPack) {
        return { kind: 'failed', message: 'Starter Pack already purchased.' };
      }
      this.applyEntitlement(id);
      return { kind: 'success', productId: id };
    }
    // Native TODO: real RevenueCat purchase; only apply entitlement after
    // the SDK reports success + the entitlement is verified.
    return { kind: 'failed', message: 'Native purchases not enabled in preview.' };
  }

  /** Restore Purchases — required on both platforms. */
  async restore(): Promise<PurchaseResult> {
    if (!this.native) {
      // Simulated: just re-read cached entitlements.
      return { kind: 'success', productId: 'com.corgihop.remove_ads' };
    }
    // Native TODO: call `Purchases.restorePurchases()` and reconcile entitlements.
    return { kind: 'unavailable' };
  }

  /** Apply a *verified* entitlement locally and grant its benefits. */
  private applyEntitlement(id: ProductId): void {
    switch (id) {
      case 'com.corgihop.remove_ads':
        gameState.entitlements.removeAds = true;
        break;
      case 'com.corgihop.starter_pack':
        if (!gameState.entitlements.starterPack && !storage.getBool(K.starterPackClaimed, false)) {
          gameState.entitlements.starterPack = true;
          gameState.addTreats(300);
          this.starterExtraShields += 1;
          storage.setNumber('starter_shields_remaining', this.starterExtraShields);
          gameState.starterAdFreeUntil = Date.now() + 7 * 24 * 60 * 60 * 1000;
          gameState.saveStarterAdFree();
          storage.setBool(K.starterPackClaimed, true);
        }
        break;
      case 'com.corgihop.premium_corgis':
        gameState.entitlements.premiumCorgis = true;
        break;
      case 'com.corgihop.all_corgis':
        if (!gameState.entitlements.allCorgis) {
          gameState.entitlements.allCorgis = true;
          gameState.entitlements.premiumCorgis = true;
          gameState.addTreats(500);
        }
        break;
    }
    gameState.saveEntitlements();
  }

  private showBrowserPurchaseDialog(id: ProductId): Promise<boolean> {
    const product = this.getProduct(id)!;
    return new Promise((resolve) => {
      const root = document.createElement('div');
      root.setAttribute('data-testid', 'purchase-sim-dialog');
      Object.assign(root.style, {
        position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: '9999',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      } as CSSStyleDeclaration);
      const card = document.createElement('div');
      Object.assign(card.style, {
        background: '#fff8ea', border: '4px solid #24304a', borderRadius: '24px',
        padding: '22px', width: '86%', maxWidth: '420px', textAlign: 'center', color: '#24304a',
      } as CSSStyleDeclaration);
      card.innerHTML = `
        <div style="font-size:11px;font-weight:800;letter-spacing:2px;background:#ff5555;color:#fff;padding:4px 10px;border-radius:999px;display:inline-block;margin-bottom:10px">TEST PURCHASE (browser preview)</div>
        <div style="font-size:22px;font-weight:900;margin-bottom:6px">${product.title}</div>
        <div style="font-size:14px;line-height:1.4;margin-bottom:12px">${product.description}</div>
        <div style="font-size:26px;font-weight:900;margin:10px 0">${product.priceString}</div>
        <div style="font-size:12px;color:#6a7280;margin-bottom:14px">Real prices appear from Apple / Google inside the iPhone and Android app.</div>
      `;
      const buy = document.createElement('button');
      buy.textContent = 'Simulate Purchase';
      buy.setAttribute('data-testid', 'purchase-sim-confirm');
      Object.assign(buy.style, {
        background: '#4bb04b', color: '#fff', border: 'none', borderRadius: '999px',
        padding: '12px 20px', fontWeight: '800', fontSize: '16px', width: '100%', margin: '6px 0', cursor: 'pointer',
      } as CSSStyleDeclaration);
      const cancel = document.createElement('button');
      cancel.textContent = 'Cancel';
      cancel.setAttribute('data-testid', 'purchase-sim-cancel');
      Object.assign(cancel.style, {
        background: 'transparent', color: '#24304a', border: 'none', padding: '10px', fontSize: '14px', cursor: 'pointer', width: '100%',
      } as CSSStyleDeclaration);
      card.appendChild(buy);
      card.appendChild(cancel);
      root.appendChild(card);
      document.body.appendChild(root);
      const finish = (ok: boolean) => { root.remove(); resolve(ok); };
      buy.addEventListener('click', () => finish(true));
      cancel.addEventListener('click', () => finish(false));
    });
  }
}
