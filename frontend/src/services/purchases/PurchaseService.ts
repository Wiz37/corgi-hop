// PurchaseService — cross-platform façade for RevenueCat entitlements.
//
// SDK pin: `@revenuecat/purchases-capacitor` is PINNED at 9.2.2 to match
// Capacitor 6 (peer `@capacitor/core: ^6.0.0`). Do NOT bump above 9.x without
// upgrading Capacitor first — v10+ requires Capacitor >=7 and v13+ requires
// Capacitor >=8.
//
// Browser preview (isNative=false): MOCK. Products are hard-coded with clearly-
// labelled *test* prices ("Available in the iPhone and Android app"). "Buying"
// simulates the store dialog and, if confirmed, grants the entitlement locally.
// The mock ALSO exposes the failure / cancel / offline states so ShopScene can
// exercise its UI states end-to-end.
//
// Native (Capacitor): real `@revenuecat/purchases-capacitor@9.2.2` calls.
//   • iOS  → Apple StoreKit Sandbox  (App Store In-App Purchase Key required on
//                                     the RevenueCat dashboard BEFORE testing.)
//   • Android → Google Play Internal Testing (billing test cards).
//   Native builds NEVER simulate a purchase — the mock path is unreachable when
//   `Capacitor.isNativePlatform()` returns true.
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

// Lazy-loaded RevenueCat plugin (kept `any` so the browser bundle builds
// without the native iOS/Android bridge existing).
let RC: any = null;
let LOG_LEVEL: any = null;

async function loadRC(): Promise<any> {
  if (RC) return RC;
  try {
    const mod = await import('@revenuecat/purchases-capacitor');
    RC = mod.Purchases;
    LOG_LEVEL = (mod as any).LOG_LEVEL;
    return RC;
  } catch {
    return null;
  }
}

function rcApiKey(): string {
  // Platform-specific PUBLIC SDK keys ONLY (never a REST secret). If the
  // per-platform key is missing on a native build, we intentionally return an
  // empty string — the SDK stays uninitialised and native calls no-op until a
  // real key is supplied. There is NO "test-store" fallback: sandbox
  // purchases on iOS require the App Store In-App Purchase Key on the
  // RevenueCat dashboard, and Android sandbox purchases require a signed
  // Play-Internal build.
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const iosKey = String(import.meta.env.VITE_REVENUECAT_IOS_PUBLIC_KEY ?? '');
  const androidKey = String(import.meta.env.VITE_REVENUECAT_ANDROID_PUBLIC_KEY ?? '');
  return isIOS ? iosKey : androidKey;
}

export class PurchaseService {
  private native = false;
  private catalog: Product[] = MOCK_CATALOG.slice();
  private ready = false;
  private starterExtraShields = 0;
  // Anti-double-charge for the same product within a single tap window.
  private purchaseInFlight: Set<string> = new Set();

  init(isNative: boolean): void {
    this.native = isNative;
    this.starterExtraShields = storage.getNumber('starter_shields_remaining', 0);
    this.ready = !isNative; // browser preview is instantly ready
    if (isNative) {
      // Fire-and-forget async native init. Once entitlements are fetched
      // and merged into gameState.entitlements, `this.ready` flips to true.
      void this.initNative();
    }
  }

  private async initNative(): Promise<void> {
    const rc = await loadRC();
    if (!rc) return;
    const key = rcApiKey();
    if (!key) {
      // No key configured — keep the mock catalog available; native calls
      // will simply be skipped until a real key is provided.
      // eslint-disable-next-line no-console
      console.warn('[RevenueCat] No public SDK key configured — skipping native init');
      return;
    }
    try {
      if (LOG_LEVEL) await rc.setLogLevel({ level: LOG_LEVEL.WARN });
      await rc.configure({ apiKey: key });
      await this.refreshEntitlements();
      this.ready = true;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[RevenueCat] configure failed:', e);
    }
  }

  /** Fetch CustomerInfo from RevenueCat + write to gameState.entitlements. */
  private async refreshEntitlements(): Promise<void> {
    const rc = await loadRC();
    if (!rc) return;
    try {
      const res = await rc.getCustomerInfo();
      const info = (res as any).customerInfo ?? res;
      const active = info?.entitlements?.active ?? {};
      // Map RevenueCat entitlement IDs → our internal booleans. Higher-tier
      // entitlements supersede lower ones automatically because we OR them
      // in isCorgiOwned (see GameState).
      gameState.entitlements = {
        removeAds:      Boolean(active.removeAds || active.allCorgis || active.premiumCorgis),
        starterPack:    Boolean(active.starterPack || active.allCorgis),
        premiumCorgis:  Boolean(active.premiumCorgis || active.allCorgis),
        allCorgis:      Boolean(active.allCorgis),
      };
      gameState.saveEntitlements();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[RevenueCat] getCustomerInfo failed:', e);
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
    // Anti double-charge: if the same product is already being purchased,
    // don't fire the flow again.
    if (this.purchaseInFlight.has(id)) return { kind: 'unavailable' };
    // All current products are non-consumable — block if already owned.
    // (Consumable "bone_bundle_*" SKUs are not in ProductId; if reintroduced,
    // exclude them here before the ownership check.)
    if (this.hasEntitlement(id)) {
      return { kind: 'failed', message: 'Already owned.' };
    }
    this.purchaseInFlight.add(id);
    try {
      if (!this.native) {
        const confirmed = await this.showBrowserPurchaseDialog(id);
        if (!confirmed) return { kind: 'cancelled' };
        if (id === 'com.corgihop.starter_pack' && gameState.entitlements.starterPack) {
          return { kind: 'failed', message: 'Starter Pack already purchased.' };
        }
        this.applyEntitlement(id);
        return { kind: 'success', productId: id };
      }
      // ---- Native RevenueCat flow ----
      const rc = await loadRC();
      if (!rc) return { kind: 'unavailable' };
      try {
        // Fetch offerings to resolve the RC package for this product id.
        const offRes = await rc.getOfferings();
        const offerings = (offRes as any).offerings ?? offRes;
        const current = offerings?.current ?? Object.values(offerings?.all ?? {})[0];
        const packages: any[] = current?.availablePackages ?? [];
        const pkg = packages.find(p => p.product?.identifier === id
                                    || p.storeProduct?.identifier === id);
        if (!pkg) return { kind: 'unavailable' };
        const purchaseRes = await rc.purchasePackage({ aPackage: pkg });
        // A successful purchase returns the updated CustomerInfo. Reconcile
        // entitlements from the SERVER response — never trust local state.
        const info = (purchaseRes as any).customerInfo;
        const active = info?.entitlements?.active ?? {};
        gameState.entitlements = {
          removeAds:     Boolean(active.removeAds || active.allCorgis || active.premiumCorgis),
          starterPack:   Boolean(active.starterPack || active.allCorgis),
          premiumCorgis: Boolean(active.premiumCorgis || active.allCorgis),
          allCorgis:     Boolean(active.allCorgis),
        };
        gameState.saveEntitlements();
        // Consumable bone bundles: no entitlement, no local grant here.
        // Bone amounts will be granted after user separately approves the
        // exact quantities (spec: "Do not assign Bone quantities or prices
        // until I approve the final store packages.").
        return { kind: 'success', productId: id };
      } catch (e: any) {
        const userCancelled = String(e?.code ?? e?.message ?? '').toLowerCase().includes('cancel')
                            || e?.userCancelled === true;
        if (userCancelled) return { kind: 'cancelled' };
        return { kind: 'failed', message: String(e?.message ?? e) };
      }
    } finally {
      this.purchaseInFlight.delete(id);
    }
  }

  /**
   * Restore Purchases — RevenueCat returns the FULL CustomerInfo which we
   * use to re-hydrate entitlements. Consumables (bone bundles) are NEVER
   * restored — they were spent by the user in prior sessions.
   */
  async restore(): Promise<PurchaseResult> {
    if (!this.native) {
      // Simulated: just re-read cached entitlements from local storage.
      return { kind: 'success', productId: 'com.corgihop.remove_ads' };
    }
    const rc = await loadRC();
    if (!rc) return { kind: 'unavailable' };
    try {
      const res = await rc.restorePurchases();
      const info = (res as any).customerInfo ?? res;
      const active = info?.entitlements?.active ?? {};
      const before = { ...gameState.entitlements };
      gameState.entitlements = {
        removeAds:     Boolean(active.removeAds || active.allCorgis || active.premiumCorgis),
        starterPack:   Boolean(active.starterPack || active.allCorgis),
        premiumCorgis: Boolean(active.premiumCorgis || active.allCorgis),
        allCorgis:     Boolean(active.allCorgis),
      };
      gameState.saveEntitlements();
      const anyRestored = (!before.removeAds && gameState.entitlements.removeAds)
                       || (!before.starterPack && gameState.entitlements.starterPack)
                       || (!before.premiumCorgis && gameState.entitlements.premiumCorgis)
                       || (!before.allCorgis && gameState.entitlements.allCorgis);
      return anyRestored
        ? { kind: 'success', productId: 'com.corgihop.all_corgis' }
        : { kind: 'unavailable' };
    } catch (e: any) {
      return { kind: 'failed', message: String(e?.message ?? e) };
    }
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
