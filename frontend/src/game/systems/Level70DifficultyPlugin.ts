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

type SceneClass = { prototype: Record<string, any> };

type MultiChance = {
  double: number;
  triple: number;
};

const GAME_WIDTH = 720;
const BASE_X = 900;
const TRIPLE_EDGE_GAP = 42;
const TRIPLE_TIMING_MARGIN_MS = 90;
const LANDING_RECOVERY_MS = 195;
const MAX_DIFFICULTY_SPEED = 760;

const HARD_SPEED_CURVE: Array<[number, number]> = [
  [0, 340],
  [4, 340],
  [5, 355],
  [10, 390],
  [20, 445],
  [30, 500],
  [40, 550],
  [50, 595],
  [60, 640],
  [70, 680],
  [100, 735],
  [150, MAX_DIFFICULTY_SPEED],
];

let installed = false;

const isDouble = (kind: PatternKind | undefined): boolean =>
  kind === 'double-mid' || kind === 'double-close' || kind === 'wide-double';

const isMulti = (kind: PatternKind | undefined): boolean =>
  isDouble(kind) || kind === 'triple';

const between = (minimum: number, maximum: number): number => {
  const min = Math.ceil(Math.min(minimum, maximum));
  const max = Math.floor(Math.max(minimum, maximum));
  return min + Math.floor(Math.random() * (max - min + 1));
};

export function level70SpeedForScore(score: number): number {
  const safeScore = Math.max(0, Number(score) || 0);
  for (let index = 1; index < HARD_SPEED_CURVE.length; index++) {
    const [x1, y1] = HARD_SPEED_CURVE[index - 1];
    const [x2, y2] = HARD_SPEED_CURVE[index];
    if (safeScore <= x2) {
      const progress = (safeScore - x1) / Math.max(1, x2 - x1);
      return Math.round(y1 + (y2 - y1) * progress);
    }
  }
  return MAX_DIFFICULTY_SPEED;
}

function multiChanceForScore(score: number): MultiChance {
  if (score < 5) return { double: 0, triple: 0 };
  if (score < 10) return { double: 0.14, triple: 0 };
  if (score < 20) return { double: 0.28, triple: 0 };
  if (score < 30) return { double: 0.36, triple: 0 };
  if (score < 40) return { double: 0.38, triple: 0.08 };
  if (score < 50) return { double: 0.42, triple: 0.12 };
  if (score < 60) return { double: 0.46, triple: 0.16 };
  if (score < 70) return { double: 0.50, triple: 0.20 };
  return { double: 0.54, triple: 0.24 };
}

function doubleKindForScore(score: number): PatternKind {
  if (score < 10) return 'double-mid';
  const roll = Math.random();
  if (score < 30) return roll < 0.72 ? 'double-mid' : 'wide-double';
  if (roll < 0.42) return 'double-mid';
  if (roll < 0.72) return 'double-close';
  return 'wide-double';
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

function buildSafeDouble(scene: any, kind: PatternKind): HurdleCandidate | null {
  const score = Math.max(5, Number(scene.score) || 5);
  const gameSpeed = Math.max(PHYSICS.baseSpeed, Number(scene.gameSpeed) || PHYSICS.baseSpeed);
  const tier = tierFor(score);
  const heightBand = tier.heights.max - tier.heights.min;
  const widthBand = tier.widths.max - tier.widths.min;
  const heightMax = Math.min(
    QUICK_TAP_SAFE_OBSTACLE_HEIGHT - 8,
    Math.round(tier.heights.min + heightBand * 0.35),
  );
  const widthMax = Math.round(tier.widths.min + widthBand * 0.35);
  if (heightMax < tier.heights.min || widthMax < tier.widths.min) return null;

  const extraGap = kind === 'double-close'
    ? between(10, 25)
    : kind === 'wide-double'
      ? between(60, 95)
      : between(30, 55);
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
    score,
    gameSpeed,
    tier,
    kind,
    fences,
    clusterSpan: (last.x + last.width / 2) - (first.x - first.width / 2),
    nextRunwayPx: safeRunwayFor(gameSpeed, 180),
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

function buildSafeTriple(scene: any): HurdleCandidate | null {
  const score = Math.max(30, Number(scene.score) || 30);
  const gameSpeed = Math.max(PHYSICS.baseSpeed, Number(scene.gameSpeed) || PHYSICS.baseSpeed);
  const tier = tierFor(score);
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
    Math.round(tier.heights.min + heightBand * 0.28),
  );
  const height = between(PHYSICS.minHurdleH, Math.max(PHYSICS.minHurdleH, heightMax));
  const fences = [
    { x: BASE_X, height, width },
    { x: BASE_X + firstCenterGap, height, width },
    { x: BASE_X + firstCenterGap + secondCenterGap, height, width },
  ];

  const candidate: HurdleCandidate = {
    score,
    gameSpeed,
    tier,
    kind: 'triple',
    fences,
    clusterSpan: targetSpan,
    nextRunwayPx: safeRunwayFor(gameSpeed, 220),
    reactionMs: reactionMsFor(BASE_X, width, gameSpeed),
  };
  return validate(candidate).ok ? candidate : null;
}

function requiresRecovery(history: PatternKind[]): boolean {
  const last = history[history.length - 1];
  const previous = history[history.length - 2];
  // One recovery single after a triple; two after every double.
  return isMulti(last) || isDouble(previous);
}

function recordPattern(scene: any, kind: PatternKind): void {
  const history = ((scene.recentPatternHistory ?? []) as PatternKind[]).slice();
  history.push(kind);
  while (history.length > 5) history.shift();
  scene.recentPatternHistory = history;
}

function spawnValidatedMulti(scene: any, candidate: HurdleCandidate): void {
  for (const fence of candidate.fences) {
    scene.spawnFence(fence.x, fence.height, fence.width);
  }
  recordPattern(scene, candidate.kind);

  const first = candidate.fences[0];
  const last = candidate.fences[candidate.fences.length - 1];
  const clusterOffset = last.x - first.x;
  scene.lastSpawnX = GAME_WIDTH + clusterOffset + last.width / 2 + candidate.nextRunwayPx;

  // Local-only balance log for TestFlight tuning; no user data leaves the device.
  // eslint-disable-next-line no-console
  console.debug(`[level70] score=${candidate.score} speed=${Math.round(candidate.gameSpeed)} pattern=${candidate.kind}`);
}

function spawnGuaranteedSingle(
  scene: any,
  originalSpawnNext: (...args: unknown[]) => unknown,
  args: unknown[],
): unknown {
  // The existing authoritative generator produces only a tutorial-safe single at
  // score zero. Temporarily borrowing that tier avoids duplicating treat and
  // obstacle bookkeeping while preventing older double/triple plugins from
  // bypassing this progression curve.
  const savedScore = scene.score;
  scene.score = 0;
  try {
    return originalSpawnNext.apply(scene, args);
  } finally {
    scene.score = savedScore;
  }
}

/**
 * Hard-but-fair progression aimed at making score 70 a genuine achievement:
 *   - 0–4: singles only.
 *   - 5–9: occasional safe doubles.
 *   - 10–29: randomized mid/wide doubles with steadily higher frequency.
 *   - 30+: strictly quick-tap-clearable triples enter and intensify toward 70.
 *
 * Every injected multi-pattern is validated before spawning, and mandatory
 * recovery singles prevent impossible chained combinations.
 */
export function installLevel70Difficulty(GameSceneClass: SceneClass): void {
  if (installed) return;
  installed = true;

  const prototype = GameSceneClass.prototype;

  const previousUpdate = prototype.update;
  prototype.update = function updateLevel70Difficulty(
    this: Record<string, any>,
    ...args: unknown[]
  ): unknown {
    const result = previousUpdate.apply(this, args);
    if (!this.ended) {
      const harderTarget = level70SpeedForScore(this.score);
      this.targetSpeed = Math.min(
        MAX_DIFFICULTY_SPEED,
        Math.max(Number(this.targetSpeed) || PHYSICS.baseSpeed, harderTarget),
      );
    }
    return result;
  };

  const previousSpawnNext = prototype.spawnNext;
  prototype.spawnNext = function spawnLevel70Pattern(
    this: Record<string, any>,
    ...args: unknown[]
  ): unknown {
    const score = Math.max(0, Number(this.score) || 0);
    const history = ((this.recentPatternHistory ?? []) as PatternKind[]).slice();

    if (score < 5 || requiresRecovery(history)) {
      return spawnGuaranteedSingle(this, previousSpawnNext, args);
    }

    const chance = multiChanceForScore(score);
    const roll = Math.random();
    let candidate: HurdleCandidate | null = null;

    if (score >= 30 && roll < chance.triple) {
      candidate = buildSafeTriple(this);
    } else if (roll < chance.triple + chance.double) {
      candidate = buildSafeDouble(this, doubleKindForScore(score));
    }

    if (candidate) {
      spawnValidatedMulti(this, candidate);
      return undefined;
    }

    return spawnGuaranteedSingle(this, previousSpawnNext, args);
  };
}
