import Phaser from 'phaser';
import { gameState } from './GameState';
import { dailyMissions, type DailyMissionKind } from './DailyMissions';
import { balanceTelemetry } from './BalanceTelemetry';
import type { PatternKind } from './HurdleGenerator';

interface FunRunState {
  streak: number;
  bestStreak: number;
  nextGroupId: number;
  encounteredDoubleGroups: Set<number>;
  runRecorded: boolean;
}

export interface FunRunSummary {
  bestStreak: number;
  currentStreak: number;
}

type ObstacleSkin =
  | 'picket_fence'
  | 'obstacle_log'
  | 'obstacle_hay'
  | 'obstacle_tires'
  | 'obstacle_cones';

const states = new WeakMap<object, FunRunState>();
let latestSummary: FunRunSummary = { bestStreak: 0, currentStreak: 0 };
let installed = false;

const isDouble = (kind: PatternKind): boolean =>
  kind === 'double-mid' || kind === 'double-close' || kind === 'wide-double';

const multiplierFor = (streak: number): number => {
  if (streak >= 30) return 5;
  if (streak >= 20) return 4;
  if (streak >= 10) return 3;
  if (streak >= 5) return 2;
  return 1;
};

function stateFor(scene: any): FunRunState {
  let state = states.get(scene);
  if (!state) {
    state = {
      streak: 0,
      bestStreak: 0,
      nextGroupId: 0,
      encounteredDoubleGroups: new Set<number>(),
      runRecorded: false,
    };
    states.set(scene, state);
  }
  return state;
}

function progressMission(scene: any, kind: DailyMissionKind, amount: number): void {
  const completions = dailyMissions.progress(kind, amount);
  scene.events.emit('missionUpdated');
  for (const completion of completions) {
    gameState.addTreats(completion.reward);
    scene.events.emit('treatsChanged', gameState.treats);
    scene.events.emit('skillFeedback', {
      text: `MISSION COMPLETE!  +${completion.reward}`,
      tint: 0x8ee65e,
    });
  }
}

function awardBones(scene: any, amount: number, label: string, tint = 0xffd23c): void {
  if (amount <= 0) return;
  scene.treatsThisRun = Math.max(0, Number(scene.treatsThisRun) || 0) + amount;
  gameState.addTreats(amount);
  scene.events.emit('treatsThisRun', scene.treatsThisRun);
  scene.events.emit('treatsChanged', gameState.treats);
  scene.events.emit('skillFeedback', { text: label, tint });
}

function spawnBonusBone(scene: any, x: number, y: number, value = 1): void {
  if (!scene?.textures?.exists?.('treat') || !scene?.treats) return;
  const bone = scene.add.sprite(x, y, 'treat').setDepth(11);
  bone.setData('funBoneValue', value);
  if (value >= 5) {
    bone.setDisplaySize(84, 48).setTint(0xffd23c);
    scene.tweens.add({
      targets: bone,
      scaleX: bone.scaleX * 1.12,
      scaleY: bone.scaleY * 1.12,
      duration: 420,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  } else {
    bone.setDisplaySize(70, 40);
  }
  scene.treats.add(bone);
}

function buildObstacleTextures(scene: any): void {
  const make = (
    key: ObstacleSkin,
    width: number,
    height: number,
    draw: (graphics: Phaser.GameObjects.Graphics) => void,
  ) => {
    if (scene.textures.exists(key)) return;
    const graphics = scene.make.graphics({ x: 0, y: 0 }, false);
    draw(graphics);
    graphics.generateTexture(key, width, height);
    graphics.destroy();
  };

  make('obstacle_log', 240, 120, (g) => {
    g.fillStyle(0x24304a, 1);
    g.fillRoundedRect(4, 18, 232, 92, 38);
    g.fillStyle(0x9a5a2d, 1);
    g.fillRoundedRect(10, 24, 220, 80, 34);
    g.fillStyle(0xc98245, 1);
    g.fillRoundedRect(20, 30, 185, 66, 28);
    g.lineStyle(5, 0x6d3d20, 1);
    g.strokeCircle(204, 64, 30);
    g.strokeCircle(204, 64, 16);
    g.lineBetween(42, 36, 72, 92);
    g.lineBetween(92, 32, 122, 96);
  });

  make('obstacle_hay', 240, 200, (g) => {
    g.fillStyle(0x24304a, 1);
    g.fillRoundedRect(5, 8, 230, 184, 28);
    g.fillStyle(0xf1b928, 1);
    g.fillRoundedRect(12, 15, 216, 170, 24);
    g.fillStyle(0xffd95a, 1);
    g.fillRoundedRect(24, 27, 192, 146, 20);
    g.fillStyle(0x9c6724, 1);
    g.fillRect(70, 18, 18, 164);
    g.fillRect(152, 18, 18, 164);
    g.lineStyle(4, 0xd19022, 1);
    for (let y = 45; y <= 155; y += 28) g.lineBetween(30, y, 210, y - 10);
  });

  make('obstacle_tires', 180, 240, (g) => {
    const tire = (cx: number, cy: number, rx: number, ry: number) => {
      g.fillStyle(0x24304a, 1);
      g.fillEllipse(cx, cy, rx * 2 + 12, ry * 2 + 12);
      g.fillStyle(0x2f3440, 1);
      g.fillEllipse(cx, cy, rx * 2, ry * 2);
      g.fillStyle(0x7d8798, 1);
      g.fillEllipse(cx, cy, rx * 0.8, ry * 0.8);
      g.fillStyle(0x18223a, 1);
      g.fillEllipse(cx, cy, rx * 0.42, ry * 0.42);
    };
    tire(90, 188, 70, 34);
    tire(90, 123, 66, 32);
    tire(90, 62, 62, 30);
  });

  make('obstacle_cones', 240, 180, (g) => {
    const cone = (cx: number, baseY: number, scale: number) => {
      g.fillStyle(0x24304a, 1);
      g.fillRoundedRect(cx - 38 * scale, baseY - 13 * scale, 76 * scale, 20 * scale, 6 * scale);
      g.fillStyle(0xff7a1a, 1);
      g.fillTriangle(
        cx, baseY - 128 * scale,
        cx - 30 * scale, baseY - 14 * scale,
        cx + 30 * scale, baseY - 14 * scale,
      );
      g.fillStyle(0xffffff, 1);
      g.fillRect(cx - 22 * scale, baseY - 66 * scale, 44 * scale, 16 * scale);
    };
    cone(48, 166, 0.86);
    cone(120, 166, 1);
    cone(192, 166, 0.86);
  });
}

function chooseObstacleSkin(scene: any, spawned: any[], kind: PatternKind): ObstacleSkin {
  const score = Math.max(0, Number(scene.score) || 0);
  if (score <= 7) return 'picket_fence';

  const averageHeight = spawned.reduce((sum, obstacle) => sum + Number(obstacle.displayHeight || 0), 0) / spawned.length;
  const averageWidth = spawned.reduce((sum, obstacle) => sum + Number(obstacle.displayWidth || 0), 0) / spawned.length;
  const wideAndLow = averageWidth > averageHeight * 0.92;
  const roll = Math.random();

  if (score <= 14) return roll < 0.34 ? 'obstacle_cones' : roll < 0.55 ? 'obstacle_log' : 'picket_fence';
  if (kind === 'triple') return roll < 0.42 ? 'obstacle_cones' : roll < 0.72 ? 'obstacle_hay' : 'picket_fence';
  if (score >= 30 && averageHeight >= 108 && roll < 0.30) return 'obstacle_tires';
  if (wideAndLow && roll < 0.48) return 'obstacle_log';
  if (roll < 0.72) return 'obstacle_hay';
  if (roll < 0.88) return 'obstacle_cones';
  return 'picket_fence';
}

function applyObstacleSkin(obstacle: any, skin: ObstacleSkin): void {
  if (!obstacle?.active || !obstacle?.scene?.textures?.exists?.(skin)) return;
  const width = Number(obstacle.displayWidth) || 90;
  const height = Number(obstacle.displayHeight) || 90;
  obstacle.setTexture(skin);
  obstacle.setDisplaySize(width, height);
  obstacle.setAlpha(1);
  obstacle.clearTint?.();
  obstacle.setData('funObstacleSkin', skin);
}

function identifyPassedObstacle(scene: any): any | null {
  const corgiX = Number(scene?.corgi?.x) || 0;
  const candidates = scene?.obstacles?.getChildren?.()
    ?.filter((object: any) => object?.active && object.hasBeenPassed && !object.getData('funScored')) ?? [];
  if (!candidates.length) return null;
  candidates.sort((a: any, b: any) => Math.abs(a.x - corgiX) - Math.abs(b.x - corgiX));
  const obstacle = candidates[0];
  obstacle.setData('funScored', true);
  return obstacle;
}

function markDoubleAttempt(scene: any, state: FunRunState, obstacle: any): void {
  const kind = (obstacle?.getData?.('funPatternKind') ?? 'single') as PatternKind;
  const groupId = Number(obstacle?.getData?.('funPatternGroupId')) || 0;
  if (!isDouble(kind) || !groupId || state.encounteredDoubleGroups.has(groupId)) return;
  state.encounteredDoubleGroups.add(groupId);
  balanceTelemetry.recordDoubleAttempt();
}

export function getLatestFunRunSummary(): FunRunSummary {
  return { ...latestSummary };
}

export function installFunGameplay(GameSceneClass: { prototype: object }): void {
  if (installed) return;
  installed = true;
  const proto = GameSceneClass.prototype as any;

  const originalCreate = proto.create;
  proto.create = function (...args: unknown[]) {
    const result = originalCreate.apply(this, args);
    buildObstacleTextures(this);
    states.set(this, {
      streak: 0,
      bestStreak: 0,
      nextGroupId: 0,
      encounteredDoubleGroups: new Set<number>(),
      runRecorded: false,
    });
    latestSummary = { bestStreak: 0, currentStreak: 0 };
    dailyMissions.ensureToday();
    this.events.emit('missionUpdated');
    this.events.emit('streakChanged', { streak: 0, multiplier: 1 });
    return result;
  };

  const originalSpawnNext = proto.spawnNext;
  proto.spawnNext = function (...args: unknown[]) {
    const before = this.obstacles?.getChildren?.().length ?? 0;
    const result = originalSpawnNext.apply(this, args);
    const state = stateFor(this);
    const all = this.obstacles?.getChildren?.() ?? [];
    const spawned = all.slice(before).filter((object: any) => object?.active);
    if (!spawned.length) return result;

    const groupId = ++state.nextGroupId;
    let kind: PatternKind = 'single';
    if (spawned.length >= 3) kind = 'triple';
    else if (spawned.length === 2) kind = 'double-mid';

    const skin = chooseObstacleSkin(this, spawned, kind);
    spawned.forEach((obstacle: any, index: number) => {
      applyObstacleSkin(obstacle, skin);
      obstacle.setData('funPatternKind', kind);
      obstacle.setData('funPatternGroupId', groupId);
      obstacle.setData('funPatternIndex', index);
      obstacle.setData('funPatternLast', index === spawned.length - 1);
    });

    if (spawned.length === 2) {
      const first = spawned[0];
      const second = spawned[1];
      const gap = second.x - first.x;
      spawnBonusBone(this, first.x + gap * 0.45, this.groundY - 145, 1);
      spawnBonusBone(this, first.x + gap * 0.66, this.groundY - 100, Math.random() < 0.08 ? 5 : 1);
    } else if (spawned.length === 1 && Math.random() < 0.18) {
      const hurdle = spawned[0];
      const top = this.groundY - hurdle.displayHeight;
      spawnBonusBone(this, hurdle.x - 72, top - 30, 1);
      spawnBonusBone(this, hurdle.x, top - 80, Math.random() < 0.05 ? 5 : 1);
      spawnBonusBone(this, hurdle.x + 72, top - 30, 1);
    }
    return result;
  };

  const originalCollectTreat = proto.collectTreat;
  proto.collectTreat = function (sprite: any, ...rest: unknown[]) {
    const funValue = Math.max(0, Number(sprite?.getData?.('funBoneValue')) || 0);
    if (!funValue) {
      const wasActive = !!sprite?.active;
      const result = originalCollectTreat.call(this, sprite, ...rest);
      if (wasActive) progressMission(this, 'treats', 1);
      return result;
    }

    if (!sprite?.active) return;
    const x = sprite.x;
    const y = sprite.y;
    sprite.destroy();
    this.treatsThisRun = Math.max(0, Number(this.treatsThisRun) || 0) + funValue;
    gameState.addTreats(funValue);
    this.events.emit('treatsThisRun', this.treatsThisRun);
    this.events.emit('treatsChanged', gameState.treats);
    progressMission(this, 'treats', funValue);

    const pop = this.add.text(x, y, `+${funValue}`, {
      fontFamily: 'system-ui', fontSize: funValue >= 5 ? '34px' : '28px', fontStyle: '900',
      color: funValue >= 5 ? '#fff176' : '#ffd23c', stroke: '#24304a', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(30);
    this.tweens.add({
      targets: pop, y: pop.y - 60, alpha: 0, duration: 700,
      onComplete: () => pop.destroy(),
    });
  };

  const originalObstaclePassed = proto.onObstaclePassed;
  proto.onObstaclePassed = function (...args: unknown[]) {
    const obstacle = identifyPassedObstacle(this);
    const result = originalObstaclePassed.apply(this, args);
    const state = stateFor(this);
    state.streak += 1;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    gameState.updateBestStreakIfHigher(state.streak);
    latestSummary = { bestStreak: state.bestStreak, currentStreak: state.streak };

    progressMission(this, 'hurdles', 1);
    const multiplier = multiplierFor(state.streak);
    this.events.emit('streakChanged', { streak: state.streak, multiplier });

    if (obstacle) {
      const kind = (obstacle.getData('funPatternKind') ?? 'single') as PatternKind;
      markDoubleAttempt(this, state, obstacle);
      if (isDouble(kind) && obstacle.getData('funPatternLast')) {
        balanceTelemetry.recordDoubleClear();
        progressMission(this, 'double', 1);
      }

      const corgiBounds = this.corgi.getBounds();
      const obstacleTop = obstacle.y - obstacle.displayHeight * 0.95;
      const clearance = obstacleTop - corgiBounds.bottom;
      const velocityY = Number(this.corgi?.body?.velocity?.y) || 0;
      const airborne = this.corgi.y < this.groundY - 8 || Math.abs(velocityY) > 60;
      if (airborne && clearance >= -8 && clearance <= 26) {
        const reward = 2 * multiplier;
        awardBones(this, reward, `CLOSE CALL!  +${reward}`);
      } else if (airborne && clearance > 26 && clearance <= 72) {
        const reward = multiplier;
        awardBones(this, reward, `PERFECT!  +${reward}`);
      }
    }

    if (state.streak === 5) awardBones(this, 2, '5-HOP STREAK  x2');
    else if (state.streak === 10) awardBones(this, 3, '10-HOP STREAK  x3');
    else if (state.streak === 20) awardBones(this, 5, '20-HOP STREAK  x4');
    else if (state.streak >= 30 && state.streak % 10 === 0) {
      awardBones(this, 7, `${state.streak}-HOP STREAK  x5`);
    }
    return result;
  };

  const originalHitObstacle = proto.hitObstacle;
  proto.hitObstacle = function (obstacle: any, ...rest: unknown[]) {
    const state = stateFor(this);
    const shieldWillAbsorb = !!this.startingShieldActive;
    if (!shieldWillAbsorb) {
      const kind = (obstacle?.getData?.('funPatternKind') ?? 'single') as PatternKind;
      markDoubleAttempt(this, state, obstacle);
      balanceTelemetry.recordCollision(kind);
      if (!state.runRecorded) {
        state.runRecorded = true;
        balanceTelemetry.recordRun(Number(this.score) || 0);
      }
      state.streak = 0;
      latestSummary = { bestStreak: state.bestStreak, currentStreak: 0 };
      this.events.emit('streakChanged', { streak: 0, multiplier: 1 });
    }
    return originalHitObstacle.call(this, obstacle, ...rest);
  };
}
