import {
  PHYSICS,
  jumpArc,
  tierFor,
  validate,
  type HurdleCandidate,
  type PatternKind,
} from './HurdleGenerator';

let installed = false;

const TRIPLE_EDGE_GAP = 42;
const TRIPLE_TIMING_MARGIN_MS = 90;

const isDouble = (kind: PatternKind): boolean =>
  kind === 'double-mid' || kind === 'double-close' || kind === 'wide-double';

const between = (minimum: number, maximum: number): number =>
  Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;

function tripleChance(score: number): number {
  if (score < 50 || score > 100) return 0;
  if (score <= 60) return 0.08;
  if (score <= 74) return 0.10;
  return 0.12;
}

function canSpawnTriple(scene: any): boolean {
  const score = Math.max(0, Number(scene.score) || 0);
  if (Math.random() >= tripleChance(score)) return false;

  const history = (scene.recentPatternHistory ?? []) as PatternKind[];
  if (history[history.length - 1] === 'triple') return false;
  if (history.slice(-2).some(isDouble)) return false;
  return true;
}

function maximumSafeTripleSpan(gameSpeed: number): number {
  const speed = Math.max(PHYSICS.baseSpeed, Number(gameSpeed) || PHYSICS.baseSpeed);
  const oneJumpRange = jumpArc().horizontalRangeAtSpeed(speed);
  const timingMarginPx = Math.max(36, speed * (TRIPLE_TIMING_MARGIN_MS / 1000));
  return Math.max(0, oneJumpRange - PHYSICS.dogColliderW - timingMarginPx);
}

function buildSafeTriple(scene: any): HurdleCandidate | null {
  const score = Math.max(50, Number(scene.score) || 50);
  const gameSpeed = Math.max(PHYSICS.baseSpeed, Number(scene.gameSpeed) || PHYSICS.baseSpeed);
  const tier = tierFor(score);
  const safeSpan = maximumSafeTripleSpan(gameSpeed) * 0.92;

  const heightBand = tier.heights.max - tier.heights.min;
  const heightMax = Math.max(
    tier.heights.min,
    Math.round(tier.heights.min + heightBand * 0.30),
  );

  // Early triples need narrower individual pieces than normal singles. This is
  // limited to triple groups and never goes below the global validated minimum.
  const widthFloor = PHYSICS.minHurdleW;
  const fairWidthCeiling = Math.floor((safeSpan - TRIPLE_EDGE_GAP * 2) / 3);
  const tierWidthCeiling = Math.round(
    tier.widths.min + (tier.widths.max - tier.widths.min) * 0.28,
  );
  const widthMax = Math.min(tierWidthCeiling, fairWidthCeiling);
  if (widthMax < widthFloor) return null;

  for (let attempt = 0; attempt < 8; attempt++) {
    const height = between(tier.heights.min, heightMax);
    const width = between(widthFloor, widthMax);
    const minimumClusterSpan = width * 3 + TRIPLE_EDGE_GAP * 2;
    if (minimumClusterSpan > safeSpan) continue;

    const targetClusterSpan = between(
      Math.ceil(minimumClusterSpan),
      Math.floor(Math.max(minimumClusterSpan, safeSpan)),
    );

    // Split only the EXTRA space. Both pairs always retain the full 42px clear
    // edge gap, so rounding can never squeeze one pair below the safe minimum.
    const extraGapSpace = targetClusterSpan - minimumClusterSpan;
    const firstExtra = extraGapSpace > 0 ? between(0, extraGapSpace) : 0;
    const firstEdgeGap = TRIPLE_EDGE_GAP + firstExtra;
    const secondEdgeGap = TRIPLE_EDGE_GAP + (extraGapSpace - firstExtra);
    const firstCenterGap = width + firstEdgeGap;
    const secondCenterGap = width + secondEdgeGap;
    const baseX = 840;

    const fences = [
      { x: baseX, height, width },
      { x: baseX + firstCenterGap, height, width },
      { x: baseX + firstCenterGap + secondCenterGap, height, width },
    ];

    const clusterSpan = targetClusterSpan;
    const oneJumpRange = jumpArc().horizontalRangeAtSpeed(gameSpeed);
    const strideBuffer = PHYSICS.dogColliderW + 40;
    const landingRunway = gameSpeed * 0.195;
    const nextRunwayPx = oneJumpRange * 0.5 + strideBuffer + landingRunway + 230;
    const corgiX = 720 * 0.28;
    const reactionMs = ((baseX - width / 2 - corgiX) / gameSpeed) * 1000;

    const candidate: HurdleCandidate = {
      score,
      gameSpeed,
      tier,
      kind: 'triple',
      fences,
      clusterSpan,
      nextRunwayPx,
      reactionMs,
    };

    if (validate(candidate).ok && clusterSpan <= maximumSafeTripleSpan(gameSpeed)) {
      return candidate;
    }
  }

  return null;
}

function spawnTriple(scene: any, candidate: HurdleCandidate): void {
  for (const fence of candidate.fences) {
    scene.spawnFence(fence.x, fence.height, fence.width);
  }

  const history = (scene.recentPatternHistory ?? []) as PatternKind[];
  history.push('triple');
  if (history.length > 5) history.shift();
  scene.recentPatternHistory = history;

  const last = candidate.fences[candidate.fences.length - 1];
  const clusterOffset = last.x - candidate.fences[0].x;
  scene.lastSpawnX = 720 + clusterOffset + last.width / 2 + candidate.nextRunwayPx;

  // Kept local for TestFlight balancing; no user data is transmitted.
  // eslint-disable-next-line no-console
  console.debug(`[hurdle] score=${candidate.score} injected one-jump-safe triple`);
}

/**
 * Adds harder but strictly one-jump-safe triples from hurdle 50 through 100.
 * Doubles still begin at hurdle 15 through the authoritative generator.
 */
export function installTripleTiming(GameSceneClass: { prototype: object }): void {
  if (installed) return;
  installed = true;

  const proto = GameSceneClass.prototype as any;
  const originalSpawnNext = proto.spawnNext;
  if (typeof originalSpawnNext !== 'function') return;

  proto.spawnNext = function (...args: unknown[]) {
    if (canSpawnTriple(this)) {
      const candidate = buildSafeTriple(this);
      if (candidate) {
        spawnTriple(this, candidate);
        return;
      }
    }
    return originalSpawnNext.apply(this, args);
  };
}
