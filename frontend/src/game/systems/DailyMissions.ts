import { storage, STORAGE_KEYS as K } from './Storage';

export type DailyMissionKind = 'hurdles' | 'treats' | 'double';

export interface DailyMissionDef {
  id: string;
  kind: DailyMissionKind;
  label: string;
  target: number;
  reward: number;
}

export interface DailyMissionEntry {
  progress: number;
  completed: boolean;
}

export interface DailyMissionState {
  dateKey: string;
  entries: Record<string, DailyMissionEntry>;
}

export interface MissionCompletion {
  mission: DailyMissionDef;
  reward: number;
}

export const DAILY_MISSION_DEFS: readonly DailyMissionDef[] = [
  { id: 'clear-20', kind: 'hurdles', label: 'Clear 20 hurdles', target: 20, reward: 50 },
  { id: 'collect-30', kind: 'treats', label: 'Collect 30 Bones', target: 30, reward: 75 },
  { id: 'clear-double', kind: 'double', label: 'Clear a double set', target: 1, reward: 100 },
] as const;

function localDateKey(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function freshState(dateKey = localDateKey()): DailyMissionState {
  return {
    dateKey,
    entries: Object.fromEntries(
      DAILY_MISSION_DEFS.map((mission) => [mission.id, { progress: 0, completed: false }]),
    ),
  };
}

class DailyMissionStore {
  private state: DailyMissionState = freshState();

  ensureToday(): void {
    const today = localDateKey();
    const saved = storage.getJSON<DailyMissionState>(K.dailyMissions, freshState(today));
    if (saved.dateKey !== today) {
      this.state = freshState(today);
      this.save();
      return;
    }

    const entries: Record<string, DailyMissionEntry> = {};
    for (const mission of DAILY_MISSION_DEFS) {
      const previous = saved.entries?.[mission.id];
      entries[mission.id] = {
        progress: Math.min(mission.target, Math.max(0, previous?.progress ?? 0)),
        completed: !!previous?.completed,
      };
    }
    this.state = { dateKey: today, entries };
  }

  progress(kind: DailyMissionKind, amount = 1): MissionCompletion[] {
    this.ensureToday();
    if (amount <= 0) return [];

    const completions: MissionCompletion[] = [];
    for (const mission of DAILY_MISSION_DEFS) {
      if (mission.kind !== kind) continue;
      const entry = this.state.entries[mission.id];
      if (entry.completed) continue;
      entry.progress = Math.min(mission.target, entry.progress + amount);
      if (entry.progress >= mission.target) {
        entry.completed = true;
        completions.push({ mission, reward: mission.reward });
      }
    }
    this.save();
    return completions;
  }

  getCurrent(): { mission: DailyMissionDef; entry: DailyMissionEntry } | null {
    this.ensureToday();
    for (const mission of DAILY_MISSION_DEFS) {
      const entry = this.state.entries[mission.id];
      if (!entry.completed) return { mission, entry: { ...entry } };
    }
    return null;
  }

  getCompletedCount(): number {
    this.ensureToday();
    return DAILY_MISSION_DEFS.filter((mission) => this.state.entries[mission.id].completed).length;
  }

  private save(): void {
    storage.setJSON(K.dailyMissions, this.state);
  }
}

export const dailyMissions = new DailyMissionStore();
