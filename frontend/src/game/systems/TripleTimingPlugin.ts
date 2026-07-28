import {
  jumpArc,
  tierFor,
  validate,
  type HurdleCandidate,
  type PatternKind,
} from './HurdleGenerator';

let installed = false;

const isDouble = (kind: PatternKind): boolean =>
  kind === 'double-mid' || kind === 'double-close' || kind === 'wide-double';

const between = (minimum: number, maximum: number): number =>
  Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;

function tripleChance(score: number): number {
  if (score < 50 || score > 100) return 0;
  if (score <= 60) return 0.05;
  if (score <= 74) return 0.06;
  return 0.07;
}

function canSpawnTriple(scene: any): boolean {
  const score = Math.max(0, Number(scene.score) || 0);
  if (Math.random() >= tripleChance(score)) return false;

  const history = (scene.recentPatternHistory ?? []) as PatternKind[];
  if (history[history.length - 1] === 'triple') return false;
  if (history.slice(-2).some(isDouble)) return false;
  return true;
}

function buildSafeTriple(scene: any): HurdleCandidate | null {
  const score = Math.max(50, Number(scene.score) || 50);
  const gameSpeed = Math.max(340, Number(scene.gameSpeed) || 340);
  const tier = tierFor(score);
  const arc = jumpArc();
  const oneJumpRange = arc.horizontalRangeAtSpeed(gameSpeed);

  const heightBand = tier.heights.max - tier.heights.min;
  const widthBand = tier.widths.max - tier.widths.min;
  const heightMax = Math.max(
    tier.heights.min,
    Math.round(tier.heights.min + heightBand * 0.34),
  );
  const widthMax = Math.max(
    tier.widths.min,
    Math.round(tier.widths.min + widthBand * 0.34),
  );

  const height = between(tier.heights.min, heightMax);
  const width = between(tier.widths.min, widthMax);
  const targetClusterSpan = oneJumpRange * between(73, 78) / 100;
  const minimumCenterSpan = 2 * (width + 44);
  const totalCenterSpan = Math.max(minimumCenterSpan, targetClusterSpan - width);
  const firstGap = Math.round(totalCenterSpan * between(48, 52) / 100);
  const secondGap = Math.round(totalCenterSpan - firstGap);
  const baseX = 840;

  const fences = [
    { x: baseX, height, width },
    { x: baseX + firstGap, height, width },
    { x: baseX + firstGap + secondGap, height, width },
  ];

  const clusterSpan = totalCenterSpan + width;
  const strideBuffer = 160;
  const landingRunway = gameSpeed * 0.195;
  const nextRunwayPx = oneJumpRange * 0.5 + strideBuffer + landingRunway + 210;
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

  return validate(candidate).ok ? candidate : null;
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
  console.debug(`[hurdle] score=${candidate.score} injected safe triple`);
}

/**
 * Adds rare, physics-validated triples from hurdle 50 through 100.
 * The authoritative generator continues to handle every other pattern,
 * including doubles beginning at hurdle 15 and its normal triples at 101+.
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
