import { storage, STORAGE_KEYS as K } from './Storage';

export interface AchievementDef {
  id: string;
  label: string;
  description: string;
  reward: number;
}

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: 'first-hop', label: 'FIRST HOP', description: 'Clear your first obstacle.', reward: 25 },
  { id: 'hot-paws', label: 'HOT PAWS', description: 'Reach a 10-hop streak.', reward: 75 },
  { id: 'park-pro', label: 'PARK PRO', description: 'Score 25 in one run.', reward: 100 },
  { id: 'bone-hound', label: 'BONE HOUND', description: 'Earn 500 Bones lifetime.', reward: 150 },
  { id: 'half-century', label: 'HALF CENTURY', description: 'Score 50 in one run.', reward: 150 },
  { id: 'corgi-legend', label: 'CORGI LEGEND', description: 'Score 100 in one run.', reward: 300 },
] as const;

class AchievementStore {
  private loaded = false;
  private unlocked = new Set<string>();

  private ensureLoaded(): void {
    if (this.loaded) return;
    const saved = storage.getJSON<string[]>(K.achievements, []);
    this.unlocked = new Set(saved.filter((id) => ACHIEVEMENTS.some((achievement) => achievement.id === id)));
    this.loaded = true;
  }

  unlock(id: string): AchievementDef | null {
    this.ensureLoaded();
    if (this.unlocked.has(id)) return null;
    const achievement = ACHIEVEMENTS.find((entry) => entry.id === id);
    if (!achievement) return null;
    this.unlocked.add(id);
    this.save();
    return achievement;
  }

  isUnlocked(id: string): boolean {
    this.ensureLoaded();
    return this.unlocked.has(id);
  }

  getUnlockedCount(): number {
    this.ensureLoaded();
    return this.unlocked.size;
  }

  getTotalCount(): number {
    return ACHIEVEMENTS.length;
  }

  getProgressText(): string {
    return `${this.getUnlockedCount()}/${this.getTotalCount()} BADGES`;
  }

  private save(): void {
    storage.setJSON(K.achievements, Array.from(this.unlocked));
  }
}

export const achievements = new AchievementStore();
