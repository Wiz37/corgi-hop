/**
 * HurdleGenerator — the authoritative obstacle spawn engine for Corgi Hop.
 *
 * DIFFICULTY OVERHAUL (July 2026):
 *   • Removed the "three-hurdle wall near score 20" regression.
 *   • Speed increases smoothly from 340 px/s to a 600 px/s hard cap.
 *   • Rare recovery doubles begin at 15, while close doubles wait until 75.
 *   • Reaction-window enforcement floor raised (0-30: ≥1250 ms, ...
 *     151+: ≥750 ms).
 *   • One-dimension-at-a-time rule: candidates that combine max height +
 *     max width + tight spacing are rejected by validate().
 *   • Every double is followed by two normal single recovery patterns.
 *
 * All maths here is pure JavaScript with no Phaser dependency, so the
 * `validate_hurdles.mjs` Node script can `import` this module (via `tsx`)
 * and exercise exactly the same generator + validator that ships in the
 * game (see 25 000-sequence audit run).
 */

// ---------------------------------------------------------------------------
// PHYSICS CONSTANTS — mirror the values in GameScene / main.ts
// ---------------------------------------------------------------------------
export const PHYSICS = {
  worldGravity: 2100,        // Phaser world gravity in main.ts
  gravityRise:  -300,
  gravityFall:   700,
  jumpVelocity: -950,        // peak ≈ 240 px (~1.5 corgi body-heights)
  baseSpeed:     340,
  maxSpeed:      600,        // hard cap
  dogColliderW:  120,
  fenceW:         80,
  maxHurdleH:    150,
  minHurdleH:     70,
  minHurdleW:     56,
  maxHurdleW:    130,
} as const;

/** Smooth progressive speed curve shared by gameplay and validation. */
const SPEED_CURVE: Array<[number, number]> = [
  [  0, 340],
  [ 15, 360],
  [ 30, 390],
  [ 60, 430],
  [100, 470],
  [150, 520],
  [220, 570],
  [300, 600],
];

export function speedForScore(score: number): number {
  if (score <= SPEED_CURVE[0][0]) return SPEED_CURVE[0][1];
  for (let i = 1; i < SPEED_CURVE.length; i++) {
    const [x1, y1] = SPEED_CURVE[i - 1];
    const [x2, y2] = SPEED_CURVE[i];
    if (score <= x2) {
      const t = (score - x1) / (x2 - x1);
      return Math.round(y1 + (y2 - y1) * t);
    }
  }
  return PHYSICS.maxSpeed;
}

// ---------------------------------------------------------------------------
// Difficulty tiers — the "1D-at-a-time" spec constrains BOTH pattern mix and
// height/width bands per tier. Reaction windows are enforced in validate().
// ---------------------------------------------------------------------------
export interface DifficultyTier {
  scoreMin: number;
  scoreMax: number;
  minReactionMs: number;
  heights: { min: number; max: number };
  widths:  { min: number; max: number };
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
    scoreMin: 0, scoreMax: 14, minReactionMs: 1450,
    heights: { min: 70, max: 84 }, widths: { min: 56, max: 72 },
    patterns: [{ kind: 'single', weight: 100 }],
  },
  // Doubles start at 6%: rare enough to teach the pattern without a spike.
  {
    scoreMin: 15, scoreMax: 30, minReactionMs: 1300,
    heights: { min: 70, max: 96 }, widths: { min: 56, max: 80 },
    patterns: [{ kind: 'single', weight: 94 }, { kind: 'double-mid', weight: 6 }],
  },
  {
    scoreMin: 31, scoreMax: 60, minReactionMs: 1100,
    heights: { min: 74, max: 115 }, widths: { min: 58, max: 92 },
    patterns: [
      { kind: 'single', weight: 78 }, { kind: 'single-tall', weight: 12 },
      { kind: 'double-mid', weight: 10 },
    ],
  },
  {
    scoreMin: 61, scoreMax: 74, minReactionMs: 950,
    heights: { min: 78, max: 128 }, widths: { min: 60, max: 105 },
    patterns: [
      { kind: 'single', weight: 60 }, { kind: 'single-tall', weight: 15 },
      { kind: 'double-mid', weight: 18 }, { kind: 'wide-double', weight: 7 },
    ],
  },
  // Close doubles remain completely unavailable before score 75.
  {
    scoreMin: 75, scoreMax: 100, minReactionMs: 950,
    heights: { min: 78, max: 128 }, widths: { min: 60, max: 105 },
    patterns: [
      { kind: 'single', weight: 58 }, { kind: 'single-tall', weight: 15 },
      { kind: 'double-mid', weight: 17 }, { kind: 'wide-double', weight: 7 },
      { kind: 'double-close', weight: 3 },
    ],
  },
  {
    scoreMin: 101, scoreMax: 150, minReactionMs: 850,
    heights: { min: 82, max: 138 }, widths: { min: 62, max: 115 },
    patterns: [
      { kind: 'single', weight: 55 }, { kind: 'single-tall', weight: 15 },
      { kind: 'double-mid', weight: 20 }, { kind: 'wide-double', weight: 5 },
      { kind: 'double-close', weight: 3 }, { kind: 'triple', weight: 2 },
    ],
  },
  {
    scoreMin: 151, scoreMax: 200, minReactionMs: 800,
    heights: { min: 85, max: 145 }, widths: { min: 64, max: 122 },
    patterns: [
      { kind: 'single', weight: 42 }, { kind: 'single-tall', weight: 13 },
      { kind: 'double-mid', weight: 22 }, { kind: 'wide-double', weight: 10 },
      { kind: 'double-close', weight: 8 }, { kind: 'triple', weight: 5 },
    ],
  },
  {
    scoreMin: 201, scoreMax: 9999, minReactionMs: 750,
    heights: { min: 88, max: PHYSICS.maxHurdleH }, widths: { min: 66, max: PHYSICS.maxHurdleW },
    patterns: [
      { kind: 'single', weight: 38 }, { kind: 'single-tall', weight: 14 },
      { kind: 'double-mid', weight: 22 }, { kind: 'wide-double', weight: 10 },
      { kind: 'double-close', weight: 8 }, { kind: 'triple', weight: 8 },
    ],
  },
];

export function tierFor(score: number): DifficultyTier {
  for (const t of TIERS) if (score >= t.scoreMin && score <= t.scoreMax) return t;
  return TIERS[TIERS.length - 1];
}

// ---------------------------------------------------------------------------
// Jump-arc math — derived from the live physics constants above.
// ---------------------------------------------------------------------------
export interface JumpArc {
  peakPx: number;
  ascentMs: number;
  descentMs: number;
  totalAirMs: number;
  horizontalRangeAtSpeed: (speed: number) => number;
}

export function jumpArc(): JumpArc {
  const v0 = Math.abs(PHYSICS.jumpVelocity);
  const gRise = PHYSICS.worldGravity + PHYSICS.gravityRise;
  const gFall = PHYSICS.worldGravity + PHYSICS.gravityFall;
  const ascent = v0 / gRise;
  const peakPx = (v0 * v0) / (2 * gRise);
  const descent = Math.sqrt((2 * peakPx) / gFall);
  return {
    peakPx,
    ascentMs: ascent * 1000,
    descentMs: descent * 1000,
    totalAirMs: (ascent + descent) * 1000,
    horizontalRangeAtSpeed: (spd: number) => spd * (ascent + descent),
  };
}

// ---------------------------------------------------------------------------
// Candidate + validator
// ---------------------------------------------------------------------------
export interface FenceSpec { x: number; height: number; width: number; }

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

// Landing squash lasts ~90 ms in GameScene, then the corgi returns to run.
// Add a small buffer so validation demands the player has landed AND recovered
// before another mandatory jump.
const LANDING_MS      = 90;
const RECOVERY_BUFFER = 130;

export function validate(c: HurdleCandidate): ValidationResult {
  const reasons: string[] = [];
  const arc = jumpArc();

  // 1) Fence dimensions must be within tier + global bounds.
  for (const f of c.fences) {
    if (f.height > PHYSICS.maxHurdleH) reasons.push(`fence too tall: ${f.height} > ${PHYSICS.maxHurdleH}`);
    if (f.height < PHYSICS.minHurdleH) reasons.push(`fence too short (invisible): ${f.height}`);
    if (f.width  > PHYSICS.maxHurdleW) reasons.push(`fence too wide: ${f.width}`);
    if (f.width  < PHYSICS.minHurdleW) reasons.push(`fence too narrow (invisible): ${f.width}`);
    if (f.height > arc.peakPx * 0.68)  reasons.push(`fence exceeds 68% of peakPx ${arc.peakPx.toFixed(0)}: ${f.height}`);
  }

  // 2) Close clusters fit in one jump; recovery doubles are two jumps.
  const oneJumpRange = arc.horizontalRangeAtSpeed(c.gameSpeed);
  if ((c.kind === 'double-close' || c.kind === 'triple') && c.clusterSpan > oneJumpRange * 0.85) {
    reasons.push(`cluster span ${c.clusterSpan.toFixed(0)}px > 85% of jump range ${oneJumpRange.toFixed(0)}px`);
  }

  // 3) No fence-to-fence overlap within a cluster (edge gap >= 40 px).
  for (let i = 1; i < c.fences.length; i++) {
    const prev = c.fences[i - 1];
    const cur  = c.fences[i];
    const edgeGap = (cur.x - cur.width / 2) - (prev.x + prev.width / 2);
    if (edgeGap < 40) reasons.push(`fences ${i - 1} & ${i} overlap (edge-gap ${edgeGap.toFixed(0)}px)`);
  }

  // Recovery doubles must leave time to land, settle, and jump again.
  if ((c.kind === 'double-mid' || c.kind === 'wide-double') && c.fences.length === 2) {
    const [first, second] = c.fences;
    const edgeGap = (second.x - second.width / 2) - (first.x + first.width / 2);
    const required = oneJumpRange
      + (c.gameSpeed * (LANDING_MS + RECOVERY_BUFFER)) / 1000
      + PHYSICS.dogColliderW / 2;
    if (edgeGap < required) reasons.push(`double recovery gap ${edgeGap.toFixed(0)}px < required ${required.toFixed(0)}px`);
  }

  // 4) Runway to next group must be long enough that the corgi can LAND +
  //    finish landing squash + take at least one stride + start the next jump.
  const strideBuffer = PHYSICS.dogColliderW + 40;
  const landingRunway = (c.gameSpeed * (LANDING_MS + RECOVERY_BUFFER)) / 1000;
  const requiredRunway = oneJumpRange * 0.55 + strideBuffer + landingRunway;
  if (c.nextRunwayPx < requiredRunway) {
    reasons.push(`runway ${c.nextRunwayPx.toFixed(0)}px < required ${requiredRunway.toFixed(0)}px`);
  }

  // 5) Reaction window must clear the tier minimum.
  if (c.reactionMs < c.tier.minReactionMs) {
    reasons.push(`reaction ${c.reactionMs.toFixed(0)}ms < tier min ${c.tier.minReactionMs}ms`);
  }

  // 6) ONE-DIMENSION-AT-A-TIME rule — refuse candidates that combine max
  //    height AND max width in the SAME fence, or a very tight double where
  //    both fences are near maximum.
  const heightBand = c.tier.heights.max - c.tier.heights.min;
  const widthBand  = c.tier.widths.max  - c.tier.widths.min;
  const isNearMaxH = (h: number) => (h - c.tier.heights.min) > heightBand * 0.85;
  const isNearMaxW = (w: number) => (w - c.tier.widths.min)  > widthBand  * 0.85;
  for (const f of c.fences) {
    if (isNearMaxH(f.height) && isNearMaxW(f.width)) {
      reasons.push(`fence at ${f.x} combines max height (${f.height}) AND max width (${f.width}) — spec forbids`);
    }
  }
  // Triples with two or more near-max fences → reject (variety-not-chaos).
  if (c.fences.length >= 3) {
    const bigCount = c.fences.filter(f => isNearMaxH(f.height) || isNearMaxW(f.width)).length;
    if (bigCount > 1) {
      reasons.push(`triple has ${bigCount} near-max fences — spec allows at most one`);
    }
  }

  return { ok: reasons.length === 0, reasons };
}

// ---------------------------------------------------------------------------
// RNG (Mulberry32)
// ---------------------------------------------------------------------------
export interface Rng { next: () => number; between: (a: number, b: number) => number; }

export function makeRng(seed: number): Rng {
  let s = seed | 0;
  const next = () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    between: (a: number, b: number) => Math.floor(next() * (b - a + 1)) + a,
  };
}

// ---------------------------------------------------------------------------
// Candidate generation
// ---------------------------------------------------------------------------
export function generateCandidate(
  score: number,
  gameSpeed: number,
  rng: Rng,
  recentHistory: PatternKind[] = [],
): HurdleCandidate {
  const tier = tierFor(score);

  const isDouble = (k: PatternKind | undefined) =>
    k === 'double-mid' || k === 'double-close' || k === 'wide-double';
  const lastKind = recentHistory[recentHistory.length - 1];
  let kind: PatternKind;
  // A double is always followed by two normal singles. This also makes
  // consecutive doubles impossible regardless of weighted selection.
  if (recentHistory.slice(-2).some(isDouble) || lastKind === 'triple') {
    kind = 'single';
  } else {
    // Weighted pattern pick. Recovery rules above provide the safety cadence.
    const totalW = tier.patterns.reduce((s, p) => s + p.weight, 0);
    kind = tier.patterns[0].kind;
    for (let attempt = 0; attempt < 8; attempt++) {
      let roll = rng.next() * totalW;
      let picked: PatternKind = tier.patterns[0].kind;
      for (const p of tier.patterns) {
        roll -= p.weight;
        if (roll <= 0) { picked = p.kind; break; }
      }
      if (isDouble(picked) && score < 15) {
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
      kind = picked;
      break;
    }
  }

  const arc = jumpArc();
  const oneJumpRange = arc.horizontalRangeAtSpeed(gameSpeed);
  const cap = Math.min(oneJumpRange * 0.8, 900);

  // The "1D-at-a-time" spec says: when picking a challenging obstacle, make at
  // least one other property forgiving. Concretely, roll a hard-axis per
  // fence — one of {height, width, spacing} — and constrain the OTHERS to
  // the easy side of the band.
  const hardAxis = (): 'height' | 'width' | 'spacing' => {
    const r = rng.next();
    if (r < 0.34) return 'height';
    if (r < 0.68) return 'width';
    return 'spacing';
  };
  const rollFence = (): FenceSpec => {
    const ax = hardAxis();
    const hMin = tier.heights.min;
    const hMax = tier.heights.max;
    const wMin = tier.widths.min;
    const wMax = tier.widths.max;
    // Easy band = lower 50%, hard band = upper 50%.
    const hMid = (hMin + hMax) / 2;
    const wMid = (wMin + wMax) / 2;
    const height = ax === 'height'
      ? rng.between(Math.round(hMid), hMax)
      : rng.between(hMin, Math.round(hMid));
    const width = ax === 'width'
      ? rng.between(Math.round(wMid), wMax)
      : rng.between(wMin, Math.round(wMid));
    return { x: 0, height, width };
  };

  const baseX = 720 + 120; // GAME_WIDTH + offscreen buffer
  const fences: FenceSpec[] = [];

  switch (kind) {
    case 'single': {
      const f = rollFence(); f.x = baseX;
      fences.push(f);
      break;
    }
    case 'single-tall': {
      // Explicit tall — but keep width easy (1D-at-a-time).
      const height = rng.between(Math.round((tier.heights.min + tier.heights.max) / 2), tier.heights.max);
      const width  = rng.between(tier.widths.min, Math.round((tier.widths.min + tier.widths.max) / 2));
      fences.push({ x: baseX, height, width });
      break;
    }
    case 'double-mid': {
      // Two short, narrow hurdles separated into two complete jumps.
      const height = rng.between(tier.heights.min, Math.round(tier.heights.min + (tier.heights.max - tier.heights.min) * 0.35));
      const width = rng.between(tier.widths.min, Math.round(tier.widths.min + (tier.widths.max - tier.widths.min) * 0.35));
      const centerGap = oneJumpRange
        + (gameSpeed * (LANDING_MS + RECOVERY_BUFFER)) / 1000
        + PHYSICS.dogColliderW / 2 + width + rng.between(40, 100);
      fences.push({ x: baseX, height, width }, { x: baseX + Math.ceil(centerGap), height, width });
      break;
    }
    case 'double-close': {
      const gap = Math.min(rng.between(230, 280), cap - 80);
      const height = rng.between(tier.heights.min, Math.round((tier.heights.min + tier.heights.max) / 2));
      const width  = rng.between(tier.widths.min,  Math.round((tier.widths.min  + tier.widths.max)  / 2));
      fences.push({ x: baseX, height, width }, { x: baseX + gap, height, width });
      break;
    }
    case 'wide-double': {
      const height = rng.between(tier.heights.min, Math.round((tier.heights.min + tier.heights.max) / 2));
      const width = rng.between(tier.widths.min, Math.round((tier.widths.min + tier.widths.max) / 2));
      const gap = Math.ceil(oneJumpRange
        + (gameSpeed * (LANDING_MS + RECOVERY_BUFFER)) / 1000
        + PHYSICS.dogColliderW / 2 + width + rng.between(120, 200));
      fences.push({ x: baseX, height, width }, { x: baseX + gap, height, width });
      break;
    }
    case 'triple': {
      // All three fences must be short + narrow (spec: never combine 3
      // near-max fences). Gaps are validated to fit inside 85% of jump range.
      let g1 = rng.between(210, 270);
      let g2 = rng.between(210, 270);
      if (g1 + g2 + 160 > cap) {
        const scale = (cap - 160) / (g1 + g2);
        g1 = Math.max(180, Math.floor(g1 * scale));
        g2 = Math.max(180, Math.floor(g2 * scale));
      }
      const height = rng.between(tier.heights.min, Math.round(tier.heights.min + (tier.heights.max - tier.heights.min) * 0.4));
      const width  = rng.between(tier.widths.min,  Math.round(tier.widths.min  + (tier.widths.max  - tier.widths.min)  * 0.4));
      fences.push(
        { x: baseX,           height, width },
        { x: baseX + g1,      height, width },
        { x: baseX + g1 + g2, height, width },
      );
      break;
    }
  }

  const first = fences[0];
  const last  = fences[fences.length - 1];
  const clusterSpan = (last.x + last.width / 2) - (first.x - first.width / 2);

  // Runway: physics-derived minimum + a random extra so spacing never repeats
  // exactly. Wider runway for post-triple / high-speed candidates.
  const strideBuffer = PHYSICS.dogColliderW + 40;
  const landingRunway = (gameSpeed * (LANDING_MS + RECOVERY_BUFFER)) / 1000;
  const baseRunway = arc.horizontalRangeAtSpeed(gameSpeed) * 0.55 + strideBuffer + landingRunway;
  const nextRunwayPx = Math.max(
    baseRunway + rng.between(120, 340),
    kind === 'triple' ? baseRunway + 260 : baseRunway,
    // Reaction-window guarantee: nextRunway must be at least (tier.minReactionMs / 1000) * gameSpeed.
    (tier.minReactionMs / 1000) * gameSpeed + strideBuffer,
  );

  // Reaction window (ms) = time from spawn until first collision at corgi
  // world-x ≈ 720 * 0.28 = 202.
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
  for (let i = 0; i < maxAttempts; i++) {
    const c = generateCandidate(score, gameSpeed, rng, recentHistory);
    if (validate(c).ok) return { candidate: c, rejected };
    rejected += 1;
  }
  // Guaranteed-safe fallback — a single short, narrow hurdle with generous
  // runway. Never rejected.
  const tier = tierFor(score);
  const arc = jumpArc();
  const safe: HurdleCandidate = {
    score, gameSpeed, tier,
    kind: 'single',
    fences: [{ x: 720 + 120, height: tier.heights.min + 5, width: tier.widths.min + 5 }],
    clusterSpan: tier.widths.min + 5,
    nextRunwayPx: arc.horizontalRangeAtSpeed(gameSpeed) * 0.9 + 220,
    reactionMs: 9999,
  };
  return { candidate: safe, rejected };
}
