import Phaser from 'phaser';
import {
  PHYSICS,
  jumpArc,
  minimumDoubleCenterGap,
  tierFor,
  validate,
  type HurdleCandidate,
  type PatternKind,
} from './HurdleGenerator';
import {
  QUICK_TAP_SAFE_OBSTACLE_HEIGHT,
  quickTapJumpArc,
} from './VariableJumpPlugin';
import {
  CORGI_HOP_BOY_OBSTACLE_ASPECT,
} from '../assets/CorgiHopBoyObstacle';
import {
  CORGI_HOP_GIRL_OBSTACLE_ASPECT,
} from '../assets/CorgiHopGirlObstacle';

type SceneClass = { prototype: Record<string, any> };
type KidSkin = 'obstacle_boy' | 'obstacle_girl';

interface VarietyState {
  hawkCooldown: number;
  nextAirGroupId: number;
}

const GAME_WIDTH = 720;
const BASE_X = 900;
const HAWK_TEXTURE_KEY = 'obstacle_hawk_exact_20260802';
const HAWK_CHANCE = 0.14;
const KID_GROUP_CHANCE = 0.28;
const WHOLE_GAME_DOUBLE_CHANCE = 0.22;
const WHOLE_GAME_TRIPLE_CHANCE = 0.08;
const TRIPLE_EDGE_GAP = 42;
const TRIPLE_TIMING_MARGIN_MS = 90;
const LANDING_RECOVERY_MS = 195;

const KID_ASPECTS: Record<KidSkin, number> = {
  obstacle_boy: CORGI_HOP_BOY_OBSTACLE_ASPECT,
  obstacle_girl: CORGI_HOP_GIRL_OBSTACLE_ASPECT,
};

const states = new WeakMap<object, VarietyState>();
let installed = false;

const between = (minimum: number, maximum: number): number => {
  const min = Math.ceil(Math.min(minimum, maximum));
  const max = Math.floor(Math.max(minimum, maximum));
  return min + Math.floor(Math.random() * (max - min + 1));
};

const isDouble = (kind: PatternKind | undefined): boolean =>
  kind === 'double-mid' || kind === 'double-close' || kind === 'wide-double';

const isMulti = (kind: PatternKind | undefined): boolean =>
  isDouble(kind) || kind === 'triple';

function stateFor(scene: object): VarietyState {
  let state = states.get(scene);
  if (!state) {
    state = { hawkCooldown: 0, nextAirGroupId: 0 };
    states.set(scene, state);
  }
  return state;
}

function recentHistory(scene: Record<string, any>): PatternKind[] {
  return ((scene.recentPatternHistory ?? []) as PatternKind[]).slice();
}

function requiresRecovery(history: PatternKind[]): boolean {
  const last = history[history.length - 1];
  const previous = history[history.length - 2];
  return isMulti(last) || isDouble(previous);
}

function recordPattern(scene: Record<string, any>, kind: PatternKind): void {
  const history = recentHistory(scene);
  history.push(kind);
  while (history.length > 5) history.shift();
  scene.recentPatternHistory = history;
}

function reactionMsFor(firstX: number, firstWidth: number, speed: number): number {
  const corgiX = GAME_WIDTH * 0.28;
  return ((firstX - firstWidth / 2 - corgiX) / speed) * 1000;
}

function safeRunwayFor(speed: number, extra: number): number {
  const oneJumpRange = jumpArc().horizontalRangeAtSpeed(speed);
  const strideBuffer = PHYSICS.dogColliderW + 40;
  const landingRunway = speed * (LANDING_RECOVERY_MS / 1000);
  return Math.ceil(oneJumpRange * 0.5 + strideBuffer + landingRunway + extra);
}

function buildWholeGameDouble(scene: Record<string, any>): HurdleCandidate | null {
  const realScore = Math.max(0, Number(scene.score) || 0);
  const validationScore = Math.max(5, realScore);
  const gameSpeed = Math.max(PHYSICS.baseSpeed, Number(scene.gameSpeed) || PHYSICS.baseSpeed);
  const tier = tierFor(validationScore);
  const heightBand = tier.heights.max - tier.heights.min;
  const widthBand = tier.widths.max - tier.widths.min;
  const heightMax = Math.min(
    QUICK_TAP_SAFE_OBSTACLE_HEIGHT - 8,
    Math.round(tier.heights.min + heightBand * 0.34),
  );
  const widthMax = Math.round(tier.widths.min + widthBand * 0.34);
  if (heightMax < tier.heights.min || widthMax < tier.widths.min) return null;

  const kind: PatternKind = Math.random() < 0.72 ? 'double-mid' : 'wide-double';
  const extraGap = kind === 'wide-double' ? between(60, 92) : between(32, 56);
  const centerGap = minimumDoubleCenterGap(gameSpeed) + extraGap;
  const firstHeight = between(tier.heights.min, heightMax);
  const secondHeight = between(tier.heights.min, heightMax);
  const firstWidth = between(tier.widths.min, widthMax);
  const secondWidth = between(tier.widths.min, widthMax);
  const fences = [
    { x: BASE_X, height: firstHeight, width: firstWidth },
    { x: BASE_X + centerGap, height: secondHeight, width: secondWidth },
  ];
  const first = fences[0];
  const last = fences[1];
  const candidate: HurdleCandidate = {
    score: validationScore,
    gameSpeed,
    tier,
    kind,
    fences,
    clusterSpan: (last.x + last.width / 2) - (first.x - first.width / 2),
    nextRunwayPx: safeRunwayFor(gameSpeed, 190),
    reactionMs: reactionMsFor(first.x, first.width, gameSpeed),
  };

  return validate(candidate).ok ? candidate : null;
}

function maximumQuickTapTripleSpan(gameSpeed: number): number {
  const speed = Math.max(PHYSICS.baseSpeed, gameSpeed);
  const quickRange = quickTapJumpArc().horizontalRangeAtSpeed(speed);
  const timingMargin = Math.max(36, speed * (TRIPLE_TIMING_MARGIN_MS / 1000));
  return Math.max(0, quickRange - PHYSICS.dogColliderW - timingMargin);
}

function buildWholeGameTriple(scene: Record<string, any>): HurdleCandidate | null {
  const realScore = Math.max(0, Number(scene.score) || 0);
  const validationScore = Math.max(30, realScore);
  const gameSpeed = Math.max(PHYSICS.baseSpeed, Number(scene.gameSpeed) || PHYSICS.baseSpeed);
  const tier = tierFor(validationScore);
  const safeSpan = maximumQuickTapTripleSpan(gameSpeed);
  const widthCeiling = Math.min(
    PHYSICS.maxHurdleW,
    tier.widths.min + 10,
    Math.floor((safeSpan - TRIPLE_EDGE_GAP * 2) / 3),
  );
  if (widthCeiling < PHYSICS.minHurdleW) return null;

  const width = between(PHYSICS.minHurdleW, widthCeiling);
  const minimumSpan = width * 3 + TRIPLE_EDGE_GAP * 2;
  const maximumTarget = Math.floor(safeSpan * 0.94);
  if (maximumTarget < minimumSpan) return null;

  const desiredLower = Math.max(minimumSpan, Math.floor(safeSpan * 0.82));
  const targetSpan = between(desiredLower, maximumTarget);
  const extraGapSpace = targetSpan - minimumSpan;
  const firstExtra = extraGapSpace > 0 ? between(0, extraGapSpace) : 0;
  const firstEdgeGap = TRIPLE_EDGE_GAP + firstExtra;
  const secondEdgeGap = TRIPLE_EDGE_GAP + (extraGapSpace - firstExtra);
  const firstCenterGap = width + firstEdgeGap;
  const secondCenterGap = width + secondEdgeGap;

  const heightBand = tier.heights.max - tier.heights.min;
  const heightMax = Math.min(
    QUICK_TAP_SAFE_OBSTACLE_HEIGHT - 10,
    Math.round(tier.heights.min + heightBand * 0.26),
  );
  const height = between(PHYSICS.minHurdleH, Math.max(PHYSICS.minHurdleH, heightMax));
  const fences = [
    { x: BASE_X, height, width },
    { x: BASE_X + firstCenterGap, height, width },
    { x: BASE_X + firstCenterGap + secondCenterGap, height, width },
  ];

  const candidate: HurdleCandidate = {
    score: validationScore,
    gameSpeed,
    tier,
    kind: 'triple',
    fences,
    clusterSpan: targetSpan,
    nextRunwayPx: safeRunwayFor(gameSpeed, 230),
    reactionMs: reactionMsFor(BASE_X, width, gameSpeed),
  };

  return validate(candidate).ok ? candidate : null;
}

function fitKidObstacle(obstacle: Phaser.GameObjects.Sprite, skin: KidSkin): void {
  if (!obstacle.scene.textures.exists(skin)) return;

  const hurdleHeight = Math.max(70, Number(obstacle.displayHeight) || 90);
  const visualHeight = Math.min(132, hurdleHeight);
  const visualWidth = visualHeight * KID_ASPECTS[skin];

  obstacle
    .setTexture(skin)
    .setOrigin(0.5, 1)
    .setDisplaySize(visualWidth, visualHeight)
    .setAlpha(1)
    .setFlipX(false)
    .setAngle(0)
    .clearTint();

  const hitWidth = Math.max(26, visualWidth * 0.72);
  const hitHeight = visualHeight * 0.82;
  (obstacle as Phaser.GameObjects.Sprite & { hitRect?: Phaser.Geom.Rectangle }).hitRect =
    new Phaser.Geom.Rectangle(-hitWidth / 2, -hitHeight, hitWidth, hitHeight);

  obstacle.setData('funObstacleSkin', skin);
  obstacle.setData('characterObstacle', true);
  obstacle.setData('kidObstacle', true);
}

function randomlyApplyKid(scene: Record<string, any>, spawned: any[]): void {
  if (Math.random() >= KID_GROUP_CHANCE) return;
  if (!scene.textures?.exists?.('obstacle_boy') || !scene.textures?.exists?.('obstacle_girl')) return;

  const ground = spawned.filter((object: any) =>
    object?.active && !object.getData?.('airHazard'),
  );
  if (!ground.length) return;

  const obstacle = ground[Math.floor(Math.random() * ground.length)] as Phaser.GameObjects.Sprite;
  const skin: KidSkin = Math.random() < 0.5 ? 'obstacle_boy' : 'obstacle_girl';
  fitKidObstacle(obstacle, skin);
}

function spawnValidatedMulti(scene: Record<string, any>, candidate: HurdleCandidate): any[] {
  const before = scene.obstacles?.getChildren?.().length ?? 0;

  for (const fence of candidate.fences) {
    scene.spawnFence(fence.x, fence.height, fence.width);
  }
  recordPattern(scene, candidate.kind);

  const first = candidate.fences[0];
  const last = candidate.fences[candidate.fences.length - 1];
  const clusterOffset = last.x - first.x;
  scene.lastSpawnX = GAME_WIDTH + clusterOffset + last.width / 2 + candidate.nextRunwayPx;

  const all = scene.obstacles?.getChildren?.() ?? [];
  return all.slice(before).filter((object: any) => object?.active);
}

function spawnHawk(scene: Record<string, any>, state: VarietyState): void {
  if (!scene.textures?.exists?.(HAWK_TEXTURE_KEY)) return;

  const x = 1020;
  const y = scene.groundY - Phaser.Math.Between(232, 246);
  const hawk = scene.add.sprite(x, y, HAWK_TEXTURE_KEY)
    .setOrigin(0.5)
    .setDepth(13)
    .setDisplaySize(172, 86)
    .setAlpha(1)
    .setFlipX(false);

  (hawk as Phaser.GameObjects.Sprite & { hitRect?: Phaser.Geom.Rectangle }).hitRect =
    new Phaser.Geom.Rectangle(-61, -21, 122, 42);
  hawk.setData('airHazard', true);
  hawk.setData('hawkObstacle', true);
  hawk.setData('funPatternKind', 'single');
  hawk.setData('funPatternGroupId', 2_000_000 + ++state.nextAirGroupId);
  hawk.setData('funPatternIndex', 0);
  hawk.setData('funPatternLast', true);
  hawk.setData('funObstacleSkin', 'obstacle_hawk');
  scene.obstacles.add(hawk);

  const baseScaleY = hawk.scaleY;
  scene.tweens.add({
    targets: hawk,
    y: y - 9,
    scaleY: baseScaleY * 0.88,
    duration: 210,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  const warning = scene.add.text(500, scene.groundY - 315, 'SCREEEEEECH!', {
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '30px',
    fontStyle: '900',
    color: '#fff45c',
    stroke: '#5b2400',
    strokeThickness: 7,
  }).setOrigin(0.5).setDepth(35).setScale(0.55);

  scene.tweens.add({
    targets: warning,
    scale: 1,
    y: warning.y - 18,
    duration: 180,
    ease: 'Back.easeOut',
    onComplete: () => scene.tweens.add({
      targets: warning,
      alpha: 0,
      delay: 430,
      duration: 180,
      onComplete: () => warning.destroy(),
    }),
  });

  if (typeof scene.spawnTreat === 'function') {
    scene.spawnTreat(x - 58, scene.groundY - 78);
    scene.spawnTreat(x + 42, scene.groundY - 78);
  }

  recordPattern(scene, 'single');
  const speed = Math.max(PHYSICS.baseSpeed, Number(scene.gameSpeed) || PHYSICS.baseSpeed);
  scene.lastSpawnX = GAME_WIDTH + Math.max(980, speed * 1.5);
  state.hawkCooldown = 2;
}

/**
 * Final obstacle controller. It intentionally runs after the older difficulty
 * wrappers so hawks, kids, doubles, and triples all remain available from the
 * beginning through the end of every run.
 */
export function installWholeGameVariety(GameSceneClass: SceneClass): void {
  if (installed) return;
  installed = true;

  const prototype = GameSceneClass.prototype;
  const previousCreate = prototype.create;
  prototype.create = function createWholeGameVariety(
    this: Record<string, any>,
    ...args: unknown[]
  ): unknown {
    const result = previousCreate.apply(this, args);
    states.set(this, { hawkCooldown: 0, nextAirGroupId: 0 });
    return result;
  };

  const previousSpawnNext = prototype.spawnNext;
  prototype.spawnNext = function spawnWholeGameVariety(
    this: Record<string, any>,
    ...args: unknown[]
  ): unknown {
    const state = stateFor(this);
    const history = recentHistory(this);
    const recoveryRequired = requiresRecovery(history);

    if (!recoveryRequired
      && state.hawkCooldown === 0
      && this.textures?.exists?.(HAWK_TEXTURE_KEY)
      && Math.random() < HAWK_CHANCE) {
      spawnHawk(this, state);
      return undefined;
    }

    if (!recoveryRequired) {
      const roll = Math.random();
      let candidate: HurdleCandidate | null = null;

      if (roll < WHOLE_GAME_TRIPLE_CHANCE) {
        candidate = buildWholeGameTriple(this);
      } else if (roll < WHOLE_GAME_TRIPLE_CHANCE + WHOLE_GAME_DOUBLE_CHANCE) {
        candidate = buildWholeGameDouble(this);
      }

      if (candidate) {
        const spawned = spawnValidatedMulti(this, candidate);
        randomlyApplyKid(this, spawned);
        state.hawkCooldown = Math.max(0, state.hawkCooldown - 1);
        return undefined;
      }
    }

    const before = this.obstacles?.getChildren?.().length ?? 0;
    const result = previousSpawnNext.apply(this, args);
    const all = this.obstacles?.getChildren?.() ?? [];
    const spawned = all.slice(before).filter((object: any) => object?.active);
    randomlyApplyKid(this, spawned);
    state.hawkCooldown = Math.max(0, state.hawkCooldown - 1);
    return result;
  };
}
