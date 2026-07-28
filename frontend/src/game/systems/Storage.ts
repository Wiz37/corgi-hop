// Simple typed localStorage-backed store for Corgi Hop persistent state.
// Everything is namespaced to `corgihop:` so it never collides with other apps.

const NS = 'corgihop:';

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(NS + key);
  } catch {
    return null;
  }
}
function writeRaw(key: string, value: string): void {
  try {
    localStorage.setItem(NS + key, value);
  } catch {
    /* ignore quota errors */
  }
}

export const storage = {
  getNumber(key: string, fallback = 0): number {
    const v = readRaw(key);
    if (v == null) return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  },
  setNumber(key: string, value: number): void {
    writeRaw(key, String(value));
  },
  getString(key: string, fallback = ''): string {
    return readRaw(key) ?? fallback;
  },
  setString(key: string, value: string): void {
    writeRaw(key, value);
  },
  getBool(key: string, fallback = false): boolean {
    const v = readRaw(key);
    if (v == null) return fallback;
    return v === '1' || v === 'true';
  },
  setBool(key: string, value: boolean): void {
    writeRaw(key, value ? '1' : '0');
  },
  getJSON<T>(key: string, fallback: T): T {
    const v = readRaw(key);
    if (v == null) return fallback;
    try {
      return JSON.parse(v) as T;
    } catch {
      return fallback;
    }
  },
  setJSON<T>(key: string, value: T): void {
    writeRaw(key, JSON.stringify(value));
  },
  remove(key: string): void {
    try {
      localStorage.removeItem(NS + key);
    } catch {
      /* ignore */
    }
  },
};

export const STORAGE_KEYS = {
  bestScore: 'best_score',
  bestStreak: 'best_streak',
  treats: 'treats',
  selectedCorgi: 'selected_corgi',
  ownedCorgis: 'owned_corgis',
  boneUnlocks: 'bone_unlocks',
  entitlements: 'entitlements',
  runsCompleted: 'runs_completed',
  lastInterstitialAt: 'last_interstitial_at',
  bonusTreatsDayKey: 'bonus_day_key',
  bonusTreatsUsed: 'bonus_used',
  starterPackClaimed: 'starter_claimed',
  starterAdFreeUntil: 'starter_ad_free_until',
  consentGiven: 'consent_given',
  consentPersonalized: 'consent_personalized',
  audioEnabled: 'audio_enabled',
  totalTreatsEarned: 'total_treats_earned',
  totalJumps: 'total_jumps',
  achievements: 'achievements',
  dailyMissions: 'daily_missions',
  balanceTelemetry: 'balance_telemetry',
} as const;
