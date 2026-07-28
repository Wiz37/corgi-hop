/**
 * HurdleGenerator — the authoritative obstacle spawn engine for Corgi Hop.
 *
 * DIFFICULTY OVERHAUL (TestFlight balance pass, July 2026):
 *   • Hurdles 0–7 remain tutorial-easy; difficulty starts rising at 8.
 *   • Easy two-jump doubles begin at score 15.
 *   • Double-hurdle spacing scales from the real jump arc so the corgi can
 *     land, recover, take a stride, and jump again.
 *   • Two guaranteed single patterns follow every double set.
 *   • Speed rises smoothly from 340 px/s and caps at 600 px/s around score 300.
 *   • Close doubles stay disabled until score 75; triples still begin at 101.
 *   • Reaction windows and one-dimension-at-a-time validation remain enforced.
 */

export const PHYSICS = {
  worldGravity: 2100,
  gravityRise: -300,
  gravityFall: 700,
  jumpVelocity: -950,
  baseSpeed: 340,
  maxSpeed: 600,
  dogColliderW: 120,
  fenceW: 80,
  maxHurdleH: 150,
  minHurdleH: 70,
  minHurdleW: 56,
  maxHurdleW: 130,
} as const;

const SPEED_CURVE: Array<[number, number]> = [
  [0, 340],
  [7, 340],
  [15, 360],
  [30, 390],
  [60, 430],
  [100, 470],
  [150, 520],
  [220, 570],
  [300, 600],
];

export function speedForScore(score: number): number {
  if (score <= SPEED_CURVE[0][0]) return SPEED_CURVE[0][1];
  for (let index = 1; index < SPEED_CURVE.length; index++) {
    const [x1, y1] = SPEED_CURVE[index - 1];
    const [x2, y2] = SPEED_CURVE[index];
    if (score <= x2) {
      const t = (score - x1) / (x2 - x1);
      return Math.round(y1 + (y2 - y1) * t);
    }
  }
  return PHYSICS.maxSpeed;
}

export interface DifficultyTier {
  scoreMin: number;
  scoreMax: number;
  minReactionMs: number;
  heights: { min: number; max: number };
  widths: { min: number; max: number };
  patterns: PatternSpec[];
}

export type PatternKind =
  | 'single'
  | 'single-tall'
  | 'double-mid'
  | 'double-close'
  | 'wide-double'
  | 'triple';

export interface PatternSpec {
  kind: PatternKind;
  weight: number;
}

export const TIERS: DifficultyTier[] = [
  {
    scoreMin: 0, scoreMax: 7, minReactionMs: 1450,
    heights: { min: 70, max: 82 }, widths: { min: 56, max: 70 },
    patterns: [{ kind: 'single', weight: 100 }],
  },
  {
    scoreMin: 8, scoreMax: 14, minReactionMs: 1380,
    heights: { min: 70, max: 90 }, widths: { min: 56, max: 76 },
    patterns: [
      { kind: 'single', weight: 88 },
      { kind: 'single-tall', weight: 12 },
    ],
  },
  {
    scoreMin: 15, scoreMax: 30, minReactionMs: 1300,
    heights: { min: 70, max: 96 }, widths: { min: 56, max: 80 },
    patterns: [
      { kind: 'single', weight: 94 },
      { kind: 'double-mid', weight: 6 },
    ],
  },
  {
    scoreMin: 31, scoreMax: 60, minReactionMs: 1100,
    heights: { min: 74, max: 115 }, widths: { min: 58, max: 92 },
    patterns: [
      { kind: 'single', weight: 78 },
      { kind: 'single-tall', weight: 12 },
      { kind: 'double-mid', weight: 10 },
    ],
  },
  {
    scoreMin: 61, scoreMax: 74, minReactionMs: 950,
    heights: { min: 78, max: 128 }, widths: { min: 60, max: 105 },
    patterns: [
      { kind: 'single', weight: 60 },
      { kind: 'single-tall', weight: 15 },
      { kind: 'double-mid', weight: 18 },
      { kind: 'wide-double', weight: 7 },
    ],
  },
  {
    scoreMin: 75, scoreMax: 100, minReactionMs: 950,
    heights: { min: 78, max: 128 }, widths: { min: 60, max: 105 },
    patterns: [
      { kind: 'single', weight: 58 },
      { kind: 'single-tall', weight: 15 },
      { kind: 'double-mid', weight: 17 },
      { kind: 'wide-double', weight: 7 },
      { kind: 'double-close', weight: 3 },
    ],
  },
  {
    scoreMin: 101, scoreMax: 150, minReactionMs: 850,
    heights: { min: 82, max: 138 }, widths: { min: 62, max: 115 },
    patterns: [
      { kind: 'single', weight: 55 },
      { kind: 'single-tall', weight: 15 },
      { kind: 'double-mid', weight: 20 },
      { kind: 'wide-double', weight: 5 },
      { kind: 'double-close', weight: 3 },
      { kind: 'triple', weight: 2 },
    ],
  },
  {
    scoreMin: 151, scoreMax: 200, minReactionMs: 800,
    heights: { min: 85, max: 145 }, widths: { min: 64, max: 122 },
    patterns: [
      { kind: 'single', weight: 42 },
      { kind: 'single-tall', weight: 13 },
      { kind: 'double-mid', weight: 22 },
      { kind: 'wide-double', weight: 10 },
      { kind: 'double-close', weight: 8 },
      { kind: 'triple', weight: 5 },
    ],
  },
  {
    scoreMin: 201, scoreMax: 9999, minReactionMs: 750,
    heights: { min: 88, max: PHYSICS.maxHurdleH },
    widths: { min: 66, max: PHYSICS.maxHurdleW },
    patterns: [
      { kind: 'single', weight: 38 },
      { kind: 'single-tall', weight: 14 },
      { kind: 'double-mid', weight: 22 },
      { kind: 'wide-double', weight: 10 },
      { kind: 'double-close', weight: 8 },
      { kind: 'triple', weight: 8 },
    ],
  },
];

export function tierFor(score: number): DifficultyTier {
  for (const tier of TIERS) {
    if (score >= tier.scoreMin && score <= tier.scoreMax) return tier;
  }
  return TIERS[TIERS.length - 1];
}

export interface JumpArc {
  peakPx: number;
  ascentMs: number;
  descentMs: number;
  totalAirMs: number;
  horizontalRangeAtSpeed: (speed: number) => number;
}

export function jumpArc(): JumpArc {
  const initialVelocity = Math.abs(PHYSICS.jumpVelocity);
  const riseGravity = PHYSICS.worldGravity + PHYSICS.gravityRise;
  const fallGravity = PHYSICS.worldGravity + PHYSICS.gravityFall;
  const ascent = initialVelocity / riseGravity;
  const peakPx = (initialVelocity * initialVelocity) / (2 * riseGravity);
  const descent = Math.sqrt((2 * peakPx) / fallGravity);
  return {
    peakPx,
    ascentMs: ascent * 1000,
    descentMs: descent * 1000,
    totalAirMs: (ascent + descent) * 1000,
    horizontalRangeAtSpeed: (speed: number) => speed * (ascent + descent),
  };
}

export interface FenceSpec {
  x: number;
  height: number;
  width: number;
}

export interface HurdleCandidate {
  score: number;
  gameSpeed: number;
  tier: DifficultyTier;
  kind: PatternKind;
  fences: FenceSpec[];
  clusterSpan: number;
  nextRunwayPx: number;
  reactionMs: number;
}

export interface ValidationResult {
  ok: boolean;
  reasons: string[];
}

const LANDING_MS = 90;
const RECOVERY_BUFFER = 130;
const BETWEEN_JUMP_STRIDE_MS = 90;

const isDoubleKind = (kind: PatternKind): boolean =>
  kind === 'double-mid' || kind === 'double-close' || kind === 'wide-double';

export function minimumDoubleCenterGap(gameSpeed: number): number {
  const arc = jumpArc();
  const recoveryMs = LANDING_MS + RECOVERY_BUFFER + BETWEEN_JUMP_STRIDE_MS;
  return Math.ceil(gameSpeed * ((arc.totalAirMs + recoveryMs) / 1000));
}

export function validate(candidate: HurdleCandidate): ValidationResult {
  const reasons: string[] = [];
  const arc = jumpArc();

  for (const fence of candidate.fences) {
    if (fence.height > PHYSICS.maxHurdleH) reasons.push(`fence too tall: ${fence.height}`);
    if (fence.height < PHYSICS.minHurdleH) reasons.push(`fence too short: ${fence.height}`);
    if (fence.width > PHYSICS.maxHurdleW) reasons.push(`fence too wide: ${fence.width}`);
    if (fence.width < PHYSICS.minHurdleW) reasons.push(`fence too narrow: ${fence.width}`);
    if (fence.height > arc.peakPx * 0.68) reasons.push(`fence exceeds safe jump peak: ${fence.height}`);
  }

  const oneJumpRange = arc.horizontalRangeAtSpeed(candidate.gameSpeed);
  if (isDoubleKind(candidate.kind) && candidate.fences.length === 2) {
    const centerGap = candidate.fences[1].x - candidate.fences[0].x;
    const minimumCenterGap = minimumDoubleCenterGap(candidate.gameSpeed);
    if (centerGap < minimumCenterGap) {
      reasons.push(`double center-gap ${centerGap.toFixed(0)}px < minimum ${minimumCenterGap}px`);
    }
    const easyHeightMax = candidate.tier.heights.min + (candidate.tier.heights.max - candidate.tier.heights.min) * 0.55;
    const easyWidthMax = candidate.tier.widths.min + (candidate.tier.widths.max - candidate.tier.widths.min) * 0.55;
    if (candidate.fences.some((fence) => fence.height > easyHeightMax || fence.width > easyWidthMax)) {
      reasons.push('double contains a fence outside the easy height/width band');
    }
  } else if (candidate.kind === 'triple' && candidate.clusterSpan > oneJumpRange * 0.85) {
    reasons.push(`triple span ${candidate.clusterSpan.toFixed(0)}px exceeds jump range`);
  }

  for (let index = 1; index < candidate.fences.length; index++) {
    const previous = candidate.fences[index - 1];
    const current = candidate.fences[index];
    const edgeGap = (current.x - current.width / 2) - (previous.x + previous.width / 2);
    if (edgeGap < 40) reasons.push(`fences overlap: ${edgeGap.toFixed(0)}px`);
  }

  const strideBuffer = PHYSICS.dogColliderW + 40;
  const landingRunway = (candidate.gameSpeed * (LANDING_MS + RECOVERY_BUFFER)) / 1000;
  const requiredRunway = oneJumpRange * 0.55 + strideBuffer + landingRunway;
  if (candidate.nextRunwayPx < requiredRunway) {
    reasons.push(`runway ${candidate.nextRunwayPx.toFixed(0)}px < required ${requiredRunway.toFixed(0)}px`);
  }
  if (candidate.reactionMs < candidate.tier.minReactionMs) {
    reasons.push(`reaction ${candidate.reactionMs.toFixed(0)}ms < minimum ${candidate.tier.minReactionMs}ms`);
  }

  const heightBand = candidate.tier.heights.max - candidate.tier.heights.min;
  const widthBand = candidate.tier.widths.max - candidate.tier.widths.min;
  const nearMaxHeight = (height: number) => (height - candidate.tier.heights.min) > heightBand * 0.85;
  const nearMaxWidth = (width: number) => (width - candidate.tier.widths.min) > widthBand * 0.85;
  for (const fence of candidate.fences) {
    if (nearMaxHeight(fence.height) && nearMaxWidth(fence.width)) {
      reasons.push('fence combines maximum height and width');
    }
  }
  if (candidate.fences.length >= 3) {
    const bigCount = candidate.fences.filter((fence) => nearMaxHeight(fence.height) || nearMaxWidth(fence.width)).length;
    if (bigCount > 1) reasons.push(`triple has ${bigCount} near-maximum fences`);
  }

  return { ok: reasons.length === 0, reasons };
}

export interface Rng {
  next: () => number;
  between: (a: number, b: number) => number;
}

export function makeRng(seed: number): Rng {
  let state = seed | 0;
  const next = () => {
    state = (state + 0x6D2B79F5) | 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    between: (minimum: number, maximum: number) => Math.floor(next() * (maximum - minimum + 1)) + minimum,
  };
}

export function generateCandidate(
  score: number,
  gameSpeed: number,
  rng: Rng,
  recentHistory: PatternKind[] = [],
): HurdleCandidate {
  const tier = tierFor(score);
  const lastKind = recentHistory[recentHistory.length - 1];
  const doubleInLastTwo = recentHistory.slice(-2).some(isDoubleKind);
  let kind: PatternKind;

  if (lastKind === 'triple' || doubleInLastTwo) {
    kind = 'single';
  } else {
    const totalWeight = tier.patterns.reduce((sum, pattern) => sum + pattern.weight, 0);
    kind = tier.patterns[0].kind;
    for (let attempt = 0; attempt < 8; attempt++) {
      let roll = rng.next() * totalWeight;
      let picked = tier.patterns[0].kind;
      for (const pattern of tier.patterns) {
        roll -= pattern.weight;
        if (roll <= 0) {
          picked = pattern.kind;
          break;
        }
      }
      if (isDoubleKind(picked) && score < 15) {
        kind = 'single';
        continue;
      }
      if (picked === 'double-close' && score < 75) {
        kind = 'single';
        continue;
      }
      if (picked === 'triple' && score < 101) {
        kind = 'single';
        continue;
      }
      const lastTwo = recentHistory.slice(-2);
      if (picked !== 'single' && lastTwo.length === 2 && lastTwo[0] === picked && lastTwo[1] === picked) continue;
      kind = picked;
      break;
    }
  }

  const arc = jumpArc();
  const oneJumpRange = arc.horizontalRangeAtSpeed(gameSpeed);
  const tripleSpanCap = Math.min(oneJumpRange * 0.8, 900);
  const hardAxis = (): 'height' | 'width' | 'spacing' => {
    const roll = rng.next();
    if (roll < 0.34) return 'height';
    if (roll < 0.68) return 'width';
    return 'spacing';
  };
  const rollFence = (): FenceSpec => {
    const axis = hardAxis();
    const heightMiddle = (tier.heights.min + tier.heights.max) / 2;
    const widthMiddle = (tier.widths.min + tier.widths.max) / 2;
    const height = axis === 'height'
      ? rng.between(Math.round(heightMiddle), tier.heights.max)
      : rng.between(tier.heights.min, Math.round(heightMiddle));
    const width = axis === 'width'
      ? rng.between(Math.round(widthMiddle), tier.widths.max)
      : rng.between(tier.widths.min, Math.round(widthMiddle));
    return { x: 0, height, width };
  };

  const baseX = 840;
  const fences: FenceSpec[] = [];
  switch (kind) {
    case 'single': {
      const fence = rollFence();
      fence.x = baseX;
      fences.push(fence);
      break;
    }
    case 'single-tall': {
      const height = rng.between(Math.round((tier.heights.min + tier.heights.max) / 2), tier.heights.max);
      const width = rng.between(tier.widths.min, Math.round((tier.widths.min + tier.widths.max) / 2));
      fences.push({ x: baseX, height, width });
      break;
    }
    case 'double-mid':
    case 'double-close':
    case 'wide-double': {
      const minimumGap = minimumDoubleCenterGap(gameSpeed);
      const extraByKind: Record<'double-mid' | 'double-close' | 'wide-double', [number, number]> = {
        'double-close': [20, 55],
        'double-mid': [55, 100],
        'wide-double': [90, 150],
      };
      const [extraMinimum, extraMaximum] = extraByKind[kind];
      const gap = minimumGap + rng.between(extraMinimum, extraMaximum);
      const easyHeightMax = Math.round(tier.heights.min + (tier.heights.max - tier.heights.min) * 0.5);
      const easyWidthMax = Math.round(tier.widths.min + (tier.widths.max - tier.widths.min) * 0.5);
      fences.push(
        {
          x: baseX,
          height: rng.between(tier.heights.min, easyHeightMax),
          width: rng.between(tier.widths.min, easyWidthMax),
        },
        {
          x: baseX + gap,
          height: rng.between(tier.heights.min, easyHeightMax),
          width: rng.between(tier.widths.min, easyWidthMax),
        },
      );
      break;
    }
    case 'triple': {
      let firstGap = rng.between(210, 270);
      let secondGap = rng.between(210, 270);
      if (firstGap + secondGap + 160 > tripleSpanCap) {
        const scale = (tripleSpanCap - 160) / (firstGap + secondGap);
        firstGap = Math.max(180, Math.floor(firstGap * scale));
        secondGap = Math.max(180, Math.floor(secondGap * scale));
      }
      const height = rng.between(tier.heights.min, Math.round(tier.heights.min + (tier.heights.max - tier.heights.min) * 0.4));
      const width = rng.between(tier.widths.min, Math.round(tier.widths.min + (tier.widths.max - tier.widths.min) * 0.4));
      fences.push(
        { x: baseX, height, width },
        { x: baseX + firstGap, height, width },
        { x: baseX + firstGap + secondGap, height, width },
      );
      break;
    }
  }

  const first = fences[0];
  const last = fences[fences.length - 1];
  const clusterSpan = (last.x + last.width / 2) - (first.x - first.width / 2);
  const strideBuffer = PHYSICS.dogColliderW + 40;
  const landingRunway = (gameSpeed * (LANDING_MS + RECOVERY_BUFFER)) / 1000;
  const baseRunway = arc.horizontalRangeAtSpeed(gameSpeed) * 0.55 + strideBuffer + landingRunway;
  const multiRecovery = isDoubleKind(kind) ? 240 : kind === 'triple' ? 300 : 0;
  const nextRunwayPx = Math.max(
    baseRunway + rng.between(140, 340),
    baseRunway + multiRecovery,
    (tier.minReactionMs / 1000) * gameSpeed + strideBuffer,
  );
  const corgiX = 720 * 0.28;
  const collisionDistance = first.x - first.width / 2 - corgiX;
  const reactionMs = (collisionDistance / gameSpeed) * 1000;

  return { score, gameSpeed, tier, kind, fences, clusterSpan, nextRunwayPx, reactionMs };
}

export function generateValidated(
  score: number,
  gameSpeed: number,
  rng: Rng,
  recentHistory: PatternKind[] = [],
  maxAttempts = 8,
): { candidate: HurdleCandidate; rejected: number } {
  let rejected = 0;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = generateCandidate(score, gameSpeed, rng, recentHistory);
    if (validate(candidate).ok) return { candidate, rejected };
    rejected += 1;
  }
  const tier = tierFor(score);
  const arc = jumpArc();
  const safe: HurdleCandidate = {
    score,
    gameSpeed,
    tier,
    kind: 'single',
    fences: [{ x: 840, height: tier.heights.min + 5, width: tier.widths.min + 5 }],
    clusterSpan: tier.widths.min + 5,
    nextRunwayPx: arc.horizontalRangeAtSpeed(gameSpeed) * 0.9 + 220,
    reactionMs: 9999,
  };
  return { candidate: safe, rejected };
}
