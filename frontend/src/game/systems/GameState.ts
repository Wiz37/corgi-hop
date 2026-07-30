// Central game state — high score, treats, cosmetics, entitlements, run counters.
// Owned by the browser (localStorage). Native purchases sync into `entitlements`
// via PurchaseService.

import { storage, STORAGE_KEYS as K } from './Storage';
import { balanceTelemetry } from './BalanceTelemetry';

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
  texture: string;
  runSheetKey?: string;
  runAnimKey?: string;
  jumpFrame?: number;
  fallFrame?: number;
  landFrame?: number;
  premium: boolean;
  entitlementProducts: string[];
  tint?: number;
}

export const CORGIS: CorgiDef[] = [
  { id: 'classic', name: 'Classic Corgi', texture: 'corgi_idle',
    runSheetKey: 'corgi_run', runAnimKey: 'run',
    jumpFrame: 4, fallFrame: 6, landFrame: 0,
    premium: false, entitlementProducts: [] },
  { id: 'starter', name: 'Starter Corgi', texture: 'corgi_starter',
    runSheetKey: 'starter_run', runAnimKey: 'starter_run',
    jumpFrame: 4, fallFrame: 6, landFrame: 0,
    premium: true, entitlementProducts: ['com.corgihop.starter_pack', 'com.corgihop.all_corgis'] },
  { id: 'cowboy', name: 'Cowboy Corgi', texture: 'corgi_cowboy',
    runSheetKey: 'cowboy_run', runAnimKey: 'cowboy_run',
    jumpFrame: 4, fallFrame: 6, landFrame: 0,
    premium: true, entitlementProducts: ['com.corgihop.premium_corgis', 'com.corgihop.all_corgis'] },
  { id: 'superhero', name: 'Superhero Corgi', texture: 'corgi_superhero',
    runSheetKey: 'superhero_run', runAnimKey: 'superhero_run',
    jumpFrame: 4, fallFrame: 6, landFrame: 0,
    premium: true, entitlementProducts: ['com.corgihop.premium_corgis', 'com.corgihop.all_corgis'] },
  { id: 'pirate', name: 'Pirate Corgi', texture: 'corgi_pirate',
    runSheetKey: 'pirate_run_fixed', runAnimKey: 'pirate_run_fixed',
    jumpFrame: 4, fallFrame: 6, landFrame: 0,
    premium: true, entitlementProducts: ['com.corgihop.premium_corgis', 'com.corgihop.all_corgis'] },
  { id: 'astronaut', name: 'Astronaut Corgi', texture: 'corgi_astronaut',
    runSheetKey: 'astronaut_run', runAnimKey: 'astronaut_run',
    jumpFrame: 4, fallFrame: 6, landFrame: 0,
    premium: true, entitlementProducts: ['com.corgihop.premium_corgis', 'com.corgihop.all_corgis'] },
];

export const CORGI_BONE_PRICE: Record<CorgiId, number> = {
  classic: 0,
  starter: 250,
  cowboy: 500,
  superhero: 900,
  pirate: 1400,
  astronaut: 2200,
};

export const RARE_CORGI_BONE_PRICE = 3500;

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
  bestStreak = 0;
  treats = 0;
  selectedCorgi: CorgiId = 'classic';
  runsCompleted = 0;
  lastInterstitialAt = 0;
  entitlements: Entitlements = { ...EMPTY_ENTITLEMENTS };
  starterAdFreeUntil = 0;
  totalTreatsEarned = 0;
  totalJumps = 0;

  private trialCorgi: CorgiId | null = null;
  boneUnlocks: Record<CorgiId, boolean> = {
    classic: true,
    starter: false,
    cowboy: false,
    superhero: false,
    pirate: false,
    astronaut: false,
  };
  private purchaseInFlight = false;

  load(): void {
    this.bestScore = storage.getNumber(K.bestScore, 0);
    this.bestStreak = storage.getNumber(K.bestStreak, 0);
    this.treats = storage.getNumber(K.treats, 0);
    this.selectedCorgi = storage.getString(K.selectedCorgi, 'classic') as CorgiId;
    this.runsCompleted = storage.getNumber(K.runsCompleted, 0);
    this.lastInterstitialAt = storage.getNumber(K.lastInterstitialAt, 0);
    this.entitlements = storage.getJSON<Entitlements>(K.entitlements, { ...EMPTY_ENTITLEMENTS });
    this.starterAdFreeUntil = storage.getNumber(K.starterAdFreeUntil, 0);
    this.totalTreatsEarned = storage.getNumber(K.totalTreatsEarned, 0);
    this.totalJumps = storage.getNumber(K.totalJumps, 0);
    const persisted = storage.getJSON<Record<string, boolean>>(K.boneUnlocks, {} as Record<string, boolean>);
    this.boneUnlocks = {
      classic: true,
      starter: !!persisted.starter,
      cowboy: !!persisted.cowboy,
      superhero: !!persisted.superhero,
      pirate: !!persisted.pirate,
      astronaut: !!persisted.astronaut,
    };
  }

  saveBoneUnlocks(): void { storage.setJSON(K.boneUnlocks, this.boneUnlocks); }
  saveTreats(): void { storage.setNumber(K.treats, this.treats); }
  saveBest(): void { storage.setNumber(K.bestScore, this.bestScore); }
  saveBestStreak(): void { storage.setNumber(K.bestStreak, this.bestStreak); }
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

  updateBestStreakIfHigher(streak: number): boolean {
    if (streak > this.bestStreak) {
      this.bestStreak = streak;
      this.saveBestStreak();
      return true;
    }
    return false;
  }

  isCorgiOwned(id: CorgiId): boolean {
    if (this.trialCorgi === id) return true;
    if (this.boneUnlocks[id]) return true;
    const def = CORGIS.find((c) => c.id === id);
    if (!def) return false;
    if (!def.premium) return true;
    for (const product of def.entitlementProducts) {
      if (product === 'com.corgihop.starter_pack' && this.entitlements.starterPack) return true;
      if (product === 'com.corgihop.premium_corgis' && this.entitlements.premiumCorgis) return true;
      if (product === 'com.corgihop.all_corgis' && this.entitlements.allCorgis) return true;
    }
    return false;
  }

  unlockCorgiWithBones(id: CorgiId): { ok: boolean; reason?: string; spent?: number } {
    if (this.purchaseInFlight) return { ok: false, reason: 'Purchase already in progress' };
    if (this.isCorgiOwned(id)) return { ok: false, reason: 'Already unlocked' };
    const def = CORGIS.find((c) => c.id === id);
    if (!def) return { ok: false, reason: 'Unknown corgi' };
    const price = CORGI_BONE_PRICE[id] ?? 0;
    if (price <= 0) return { ok: false, reason: 'This corgi is free' };
    if (this.treats < price) return { ok: false, reason: `Need ${price - this.treats} more Bones` };
    this.purchaseInFlight = true;
    try {
      this.treats -= price;
      this.saveTreats();
      this.boneUnlocks[id] = true;
      this.saveBoneUnlocks();
      this.selectedCorgi = id;
      this.saveSelected();
      balanceTelemetry.recordCorgiUnlock(id);
      return { ok: true, spent: price };
    } finally {
      this.purchaseInFlight = false;
    }
  }

  bonePriceFor(id: CorgiId): number {
    return CORGI_BONE_PRICE[id] ?? 0;
  }

  setTrialCorgi(id: CorgiId | null): void { this.trialCorgi = id; }
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
