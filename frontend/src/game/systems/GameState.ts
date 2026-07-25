// Central game state — high score, treats, cosmetics, entitlements, run counters.
// Owned by the browser (localStorage). Native purchases sync into `entitlements`
// via PurchaseService.

import { storage, STORAGE_KEYS as K } from './Storage';

export type CorgiId =
  | 'classic'
  | 'starter'
  | 'cowboy'
  | 'superhero'
  | 'pirate'
  | 'astronaut';

export interface CorgiDef {
  id: CorgiId;
  name: string;
  texture: string; // preload key
  premium: boolean; // requires an entitlement to own
  entitlementProducts: string[]; // any of these entitlements unlocks the corgi
  tint?: number; // fallback tint if texture is missing
}

export const CORGIS: CorgiDef[] = [
  { id: 'classic',    name: 'Classic Corgi',   texture: 'corgi_idle',    premium: false, entitlementProducts: [] },
  { id: 'starter',    name: 'Starter Corgi',   texture: 'corgi_starter', premium: true,  entitlementProducts: ['com.corgihop.starter_pack', 'com.corgihop.all_corgis'], tint: 0x9de6d5 },
  { id: 'cowboy',     name: 'Cowboy Corgi',    texture: 'corgi_cowboy',  premium: true,  entitlementProducts: ['com.corgihop.premium_corgis', 'com.corgihop.all_corgis'] },
  { id: 'superhero',  name: 'Superhero Corgi', texture: 'corgi_superhero', premium: true, entitlementProducts: ['com.corgihop.premium_corgis', 'com.corgihop.all_corgis'], tint: 0xff6666 },
  { id: 'pirate',     name: 'Pirate Corgi',    texture: 'corgi_pirate',  premium: true,  entitlementProducts: ['com.corgihop.premium_corgis', 'com.corgihop.all_corgis'] },
  { id: 'astronaut',  name: 'Astronaut Corgi', texture: 'corgi_astronaut', premium: true, entitlementProducts: ['com.corgihop.premium_corgis', 'com.corgihop.all_corgis'], tint: 0xffffff },
];

export interface Entitlements {
  removeAds: boolean;
  starterPack: boolean;
  premiumCorgis: boolean;
  allCorgis: boolean;
}

export const EMPTY_ENTITLEMENTS: Entitlements = {
  removeAds: false,
  starterPack: false,
  premiumCorgis: false,
  allCorgis: false,
};

class GameStateStore {
  bestScore = 0;
  treats = 0;
  selectedCorgi: CorgiId = 'classic';
  runsCompleted = 0;
  lastInterstitialAt = 0;
  entitlements: Entitlements = { ...EMPTY_ENTITLEMENTS };
  starterAdFreeUntil = 0;
  totalTreatsEarned = 0;
  totalJumps = 0;

  private trialCorgi: CorgiId | null = null; // one-run rewarded trial

  load(): void {
    this.bestScore = storage.getNumber(K.bestScore, 0);
    this.treats = storage.getNumber(K.treats, 0);
    this.selectedCorgi = storage.getString(K.selectedCorgi, 'classic') as CorgiId;
    this.runsCompleted = storage.getNumber(K.runsCompleted, 0);
    this.lastInterstitialAt = storage.getNumber(K.lastInterstitialAt, 0);
    this.entitlements = storage.getJSON<Entitlements>(K.entitlements, { ...EMPTY_ENTITLEMENTS });
    this.starterAdFreeUntil = storage.getNumber(K.starterAdFreeUntil, 0);
    this.totalTreatsEarned = storage.getNumber(K.totalTreatsEarned, 0);
    this.totalJumps = storage.getNumber(K.totalJumps, 0);
  }

  saveTreats(): void { storage.setNumber(K.treats, this.treats); }
  saveBest(): void { storage.setNumber(K.bestScore, this.bestScore); }
  saveSelected(): void { storage.setString(K.selectedCorgi, this.selectedCorgi); }
  saveEntitlements(): void { storage.setJSON(K.entitlements, this.entitlements); }
  saveRuns(): void { storage.setNumber(K.runsCompleted, this.runsCompleted); }
  saveInterstitialAt(): void { storage.setNumber(K.lastInterstitialAt, this.lastInterstitialAt); }
  saveStarterAdFree(): void { storage.setNumber(K.starterAdFreeUntil, this.starterAdFreeUntil); }
  saveTotals(): void {
    storage.setNumber(K.totalTreatsEarned, this.totalTreatsEarned);
    storage.setNumber(K.totalJumps, this.totalJumps);
  }

  addTreats(n: number): void {
    if (n <= 0) return;
    this.treats += n;
    this.totalTreatsEarned += n;
    this.saveTreats();
    this.saveTotals();
  }

  spendTreats(n: number): boolean {
    if (this.treats < n) return false;
    this.treats -= n;
    this.saveTreats();
    return true;
  }

  updateBestIfHigher(score: number): boolean {
    if (score > this.bestScore) {
      this.bestScore = score;
      this.saveBest();
      return true;
    }
    return false;
  }

  isCorgiOwned(id: CorgiId): boolean {
    if (this.trialCorgi === id) return true;
    const def = CORGIS.find((c) => c.id === id);
    if (!def) return false;
    if (!def.premium) return true;
    for (const p of def.entitlementProducts) {
      if (p === 'com.corgihop.starter_pack' && this.entitlements.starterPack) return true;
      if (p === 'com.corgihop.premium_corgis' && this.entitlements.premiumCorgis) return true;
      if (p === 'com.corgihop.all_corgis' && this.entitlements.allCorgis) return true;
    }
    return false;
  }

  setTrialCorgi(id: CorgiId | null): void {
    this.trialCorgi = id;
  }
  getTrialCorgi(): CorgiId | null { return this.trialCorgi; }

  clearTrial(): void { this.trialCorgi = null; }

  isAdFree(): boolean {
    if (this.entitlements.removeAds) return true;
    if (this.starterAdFreeUntil && Date.now() < this.starterAdFreeUntil) return true;
    return false;
  }

  incrementRunsCompleted(): void {
    this.runsCompleted += 1;
    this.saveRuns();
  }

  markInterstitialShown(): void {
    this.lastInterstitialAt = Date.now();
    this.saveInterstitialAt();
  }
}

export const gameState = new GameStateStore();
