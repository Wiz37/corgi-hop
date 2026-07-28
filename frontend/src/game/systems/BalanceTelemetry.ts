import { storage, STORAGE_KEYS as K } from './Storage';
import type { PatternKind } from './HurdleGenerator';
import type { CorgiId } from './GameState';

export interface BalanceTelemetryState {
  runs: number;
  totalScore: number;
  highestScore: number;
  reachedScore15: number;
  doubleAttempts: number;
  doubleClears: number;
  collisionsByPattern: Partial<Record<PatternKind, number>>;
  corgiUnlocks: Partial<Record<CorgiId, number>>;
}

const EMPTY: BalanceTelemetryState = {
  runs: 0,
  totalScore: 0,
  highestScore: 0,
  reachedScore15: 0,
  doubleAttempts: 0,
  doubleClears: 0,
  collisionsByPattern: {},
  corgiUnlocks: {},
};

class BalanceTelemetryStore {
  private read(): BalanceTelemetryState {
    return storage.getJSON<BalanceTelemetryState>(K.balanceTelemetry, { ...EMPTY });
  }

  private write(state: BalanceTelemetryState): void {
    storage.setJSON(K.balanceTelemetry, state);
  }

  recordRun(score: number): void {
    const state = this.read();
    state.runs += 1;
    state.totalScore += Math.max(0, score);
    state.highestScore = Math.max(state.highestScore, score);
    if (score >= 15) state.reachedScore15 += 1;
    this.write(state);
  }

  recordDoubleAttempt(): void {
    const state = this.read();
    state.doubleAttempts += 1;
    this.write(state);
  }

  recordDoubleClear(): void {
    const state = this.read();
    state.doubleClears += 1;
    this.write(state);
  }

  recordCollision(kind: PatternKind): void {
    const state = this.read();
    state.collisionsByPattern[kind] = (state.collisionsByPattern[kind] ?? 0) + 1;
    this.write(state);
  }

  recordCorgiUnlock(id: CorgiId): void {
    const state = this.read();
    state.corgiUnlocks[id] = (state.corgiUnlocks[id] ?? 0) + 1;
    this.write(state);
  }

  snapshot(): BalanceTelemetryState {
    return this.read();
  }
}

export const balanceTelemetry = new BalanceTelemetryStore();
