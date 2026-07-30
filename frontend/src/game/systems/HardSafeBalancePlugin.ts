import { PHYSICS } from './HurdleGenerator';
import {
  QUICK_TAP_SAFE_OBSTACLE_HEIGHT,
  quickTapJumpArc,
} from './VariableJumpPlugin';

const TUTORIAL_SPEED = PHYSICS.baseSpeed;
const HARDER_GAIN_MULTIPLIER = 1.13;
const HARD_SPEED_CAP = 770;
const EARLY_RAMP_START_SCORE = 5;
const EARLY_RAMP_END_SCORE = 15;
const EARLY_RAMP_END_SPEED = 380;
const TRIPLE_EDGE_GAP = 42;
const TRIPLE_TIMING_MARGIN_MS = 90;
const BASE_MULTI_SKINS = [
  'picket_fence',
  'obstacle_log',
  'obstacle_hay',
  'obstacle_tires',
  'obstacle_cones',
] as const;

let installed = false;

export function maximumSafeTripleSpan(gameSpeed: number): number {
  const speed = Math.max(TUTORIAL_SPEED, Number(gameSpeed) || TUTORIAL_SPEED);
  const oneJumpRange = quickTapJumpArc().horizontalRangeAtSpeed(speed);
  const timingMarginPx = Math.max(36, speed * (TRIPLE_TIMING_MARGIN_MS / 1000));

  // The LOWER quick-tap jump is the source of truth. Holding is never required.
  return Math.max(0, oneJumpRange - PHYSICS.dogColliderW - timingMarginPx);
}

function earlyRampTarget(score: number): number {
  if (score <= EARLY_RAMP_START_SCORE) return TUTORIAL_SPEED;
  const progress = Math.min(
    1,
    (score - EARLY_RAMP_START_SCORE) / (EARLY_RAMP_END_SCORE - EARLY_RAMP_START_SCORE),
  );
  return TUTORIAL_SPEED + (EARLY_RAMP_END_SPEED - TUTORIAL_SPEED) * progress;
}

function chooseReadableMultiSkin(scene: any): string {
  const available = BASE_MULTI_SKINS.filter((key) => scene?.textures?.exists?.(key));
  return available.length
    ? available[Math.floor(Math.random() * available.length)]
    : 'picket_fence';
}

function makeMultiGroupReadable(scene: any, spawned: any[]): void {
  if (spawned.length < 2) return;
  const skin = chooseReadableMultiSkin(scene);

  for (const obstacle of spawned) {
    if (!obstacle?.active || obstacle.getData?.('airHazard')) continue;
    const width = Number(obstacle.displayWidth) || 90;
    const height = Number(obstacle.displayHeight) || 90;
    obstacle.setTexture(skin);
    obstacle.setDisplaySize(width, height);
    obstacle.setAlpha(1);
    obstacle.clearTint?.();
    obstacle.setData('funObstacleSkin', skin);
    obstacle.setData('characterObstacle', false);
  }
}

function enforceQuickTapHeight(spawned: any[]): void {
  for (const obstacle of spawned) {
    if (
      !obstacle?.active
      || obstacle.getData?.('airHazard')
      || obstacle.getData?.('pitObstacle')
    ) continue;

    const width = Math.max(1, Number(obstacle.displayWidth) || 90);
    const height = Math.max(1, Number(obstacle.displayHeight) || 90);
    if (height <= QUICK_TAP_SAFE_OBSTACLE_HEIGHT) continue;

    obstacle.setDisplaySize(width, QUICK_TAP_SAFE_OBSTACLE_HEIGHT);
    const hitRect = obstacle.hitRect;
    if (hitRect) {
      const collisionHeight = Math.min(
        Number(hitRect.height) || QUICK_TAP_SAFE_OBSTACLE_HEIGHT,
        QUICK_TAP_SAFE_OBSTACLE_HEIGHT * 0.90,
      );
      hitRect.y = -collisionHeight;
      hitRect.height = collisionHeight;
    }
    obstacle.setData('quickTapHeightClamped', true);
  }
}

function downgradeUnsafeTriple(spawned: any[]): void {
  // A safe single is always preferable to allowing a mathematically impossible
  // triple into a live run. This is a last-resort runtime guard.
  const keep = spawned[0];
  for (const obstacle of spawned.slice(1)) obstacle?.destroy?.();
  keep?.setData?.('funPatternKind', 'single');
  keep?.setData?.('funPatternIndex', 0);
  keep?.setData?.('funPatternLast', true);
}

function enforceOneJumpTriple(scene: any, spawned: any[]): void {
  const live = spawned
    .filter((obstacle) => obstacle?.active && !obstacle.getData?.('airHazard'))
    .sort((a, b) => Number(a.x) - Number(b.x));

  if (live.length !== 3) return;

  const speed = Math.max(TUTORIAL_SPEED, Number(scene.gameSpeed) || TUTORIAL_SPEED);
  const safeSpan = maximumSafeTripleSpan(speed) * 0.94;
  const widths = live.map((obstacle) => Math.max(1, Number(obstacle.displayWidth) || 90));
  const minimumSpan = widths.reduce((sum, width) => sum + width, 0)
    + TRIPLE_EDGE_GAP * (live.length - 1);

  if (minimumSpan > safeSpan) {
    downgradeUnsafeTriple(live);
    return;
  }

  const firstLeftEdge = Number(live[0].x) - widths[0] / 2;
  const currentLastRightEdge = Number(live[2].x) + widths[2] / 2;
  const currentSpan = currentLastRightEdge - firstLeftEdge;
  const targetSpan = Math.max(minimumSpan, Math.min(currentSpan, safeSpan));
  const extraPerGap = (targetSpan - minimumSpan) / 2;
  const edgeGap = TRIPLE_EDGE_GAP + extraPerGap;

  let cursor = firstLeftEdge;
  live.forEach((obstacle, index) => {
    const width = widths[index];
    obstacle.x = cursor + width / 2;
    obstacle.setData('funPatternKind', 'triple');
    obstacle.setData('funPatternIndex', index);
    obstacle.setData('funPatternLast', index === live.length - 1);
    cursor += width + edgeGap;
  });
}

/**
 * Starts a modest speed ramp immediately after hurdle five and applies final
 * runtime safety gates using the lower quick-tap jump—not the optional hold.
 */
export function installHardSafeBalance(GameSceneClass: { prototype: object }): void {
  if (installed) return;
  installed = true;

  const proto = GameSceneClass.prototype as any;

  const originalUpdate = proto.update;
  if (typeof originalUpdate === 'function') {
    proto.update = function (...args: unknown[]) {
      const result = originalUpdate.apply(this, args);
      const score = Math.max(0, Number(this.score) || 0);
      const baseTarget = Math.max(TUTORIAL_SPEED, Number(this.targetSpeed) || TUTORIAL_SPEED);
      if (score > EARLY_RAMP_START_SCORE && !this.ended) {
        const harderCurveTarget = TUTORIAL_SPEED
          + (baseTarget - TUTORIAL_SPEED) * HARDER_GAIN_MULTIPLIER;
        this.targetSpeed = Math.min(
          HARD_SPEED_CAP,
          Math.max(baseTarget, harderCurveTarget, earlyRampTarget(score)),
        );
      }
      return result;
    };
  }

  const originalSpawnNext = proto.spawnNext;
  if (typeof originalSpawnNext === 'function') {
    proto.spawnNext = function (...args: unknown[]) {
      const before = this.obstacles?.getChildren?.().length ?? 0;
      const result = originalSpawnNext.apply(this, args);
      const all = this.obstacles?.getChildren?.() ?? [];
      const spawned = all.slice(before).filter((obstacle: any) => obstacle?.active);

      makeMultiGroupReadable(this, spawned);
      enforceQuickTapHeight(spawned);
      enforceOneJumpTriple(this, spawned);
      return result;
    };
  }
}
