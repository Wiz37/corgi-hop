/**
 * HurdleGenerator — the authoritative obstacle spawn engine for Corgi Hop.
 *
 * Design goals (from the "10,000-sequence hurdle validator" spec):
 *   • Every generated hurdle MUST be clearable using the current live
 *     physics constants (jumpVelocity, world gravity, asymmetric
 *     gravity adjustments, corgi collision size, corgi horizontal speed).
 *   • Every sequence MUST provide the minimum reaction window for its
 *     difficulty tier (450 ms at scores 0-7, down to 200 ms at 30+).
 *   • Between-group runways MUST be long enough for the corgi to LAND,
 *     take a stride, and JUMP again before hitting the next hurdle.
 *   • Randomness must produce variety, but a validator can reject any
 *     candidate that fails ANY of the physical checks.
 *
 * All maths here is pure JavaScript with no Phaser dependency, so the
 * `validate_hurdles.mjs` Node script can `import` this module (via `tsx`)
 * and run exactly the same generator + validator that ships in the game.
 */

// ---------------------------------------------------------------------------
// PHYSICS CONSTANTS — these MUST match the values used in GameScene / main.ts
// If you change gravity or jumpVelocity in the game, mirror it here too.
// ---------------------------------------------------------------------------
export const PHYSICS = {
  worldGravity: 2400,        // main.ts arcade.gravity.y
  gravityRise:  -400,        // GameScene.applyAirGravity() delta while rising
  gravityFall:  1000,        // GameScene.applyAirGravity() delta while falling
  jumpVelocity: -1220,       // GameScene.jumpVelocity
  baseSpeed:     340,        // starting horizontal scroll speed (px/s)
  maxSpeed:      760,        // capped speed at high scores
  speedRampK:      8,        // targetSpeed = baseSpeed + score * speedRampK
  dogColliderW:  120,        // approximate corgi collision box width (px)
  fenceW:         80,        // picket-fence collision width (px)
  // Height cap = "safe height at slowest jump range" — 55% of peak so the
  // dog can always clear even in a marginal timing window.
  maxHurdleH:    170,
  minHurdleH:     70,
  minHurdleW:     56,        // narrowest picket fence still visible
  maxHurdleW:    130,        // widest picket fence still clearable in one jump
} as const;

// ---------------------------------------------------------------------------
// Difficulty tiers — matches the spec's fairness rules
// ---------------------------------------------------------------------------
export interface DifficultyTier {
  scoreMin: number;
  scoreMax: number;
  minReactionMs: number;     // absolute minimum valid input window
  heights: { min: number; max: number };
  widths:  { min: number; max: number };
  patterns: PatternSpec[];   // weighted pattern selection
}

export type PatternKind =
  | 'single'
  | 'single-tall'
  | 'double-close'
  | 'double-mid'
  | 'wide-double'
  | 'triple';

export interface PatternSpec {
  kind: PatternKind;
  weight: number;
}

export const TIERS: DifficultyTier[] = [
  {
    scoreMin: 0, scoreMax: 7,
    minReactionMs: 450,
    heights: { min: 70,  max: 95  },
    widths:  { min: 56,  max: 80  },
    patterns: [{ kind: 'single', weight: 100 }],
  },
  {
    scoreMin: 8, scoreMax: 17,
    minReactionMs: 350,
    heights: { min: 80,  max: 115 },
    widths:  { min: 60,  max: 90  },
    patterns: [
      { kind: 'single',      weight: 78 },
      { kind: 'single-tall', weight: 22 },
    ],
  },
  {
    scoreMin: 18, scoreMax: 29,
    minReactionMs: 275,
    heights: { min: 90,  max: 135 },
    widths:  { min: 62,  max: 100 },
    patterns: [
      { kind: 'single',       weight: 48 },
      { kind: 'single-tall',  weight: 22 },
      { kind: 'double-mid',   weight: 20 },
      { kind: 'double-close', weight: 10 },
    ],
  },
  {
    scoreMin: 30, scoreMax: 49,
    minReactionMs: 220,
    heights: { min: 95,  max: 150 },
    widths:  { min: 64,  max: 110 },
    patterns: [
      { kind: 'single',       weight: 30 },
      { kind: 'single-tall',  weight: 22 },
      { kind: 'double-mid',   weight: 22 },
      { kind: 'double-close', weight: 16 },
      { kind: 'wide-double',  weight: 8  },
      { kind: 'triple',       weight: 2  },
    ],
  },
  {
    scoreMin: 50, scoreMax: 9999,
    minReactionMs: 200,
    heights: { min: 100, max: PHYSICS.maxHurdleH },
    widths:  { min: 66,  max: PHYSICS.maxHurdleW },
    patterns: [
      { kind: 'single',       weight: 24 },
      { kind: 'single-tall',  weight: 22 },
      { kind: 'double-mid',   weight: 22 },
      { kind: 'double-close', weight: 16 },
      { kind: 'wide-double',  weight: 12 },
      { kind: 'triple',       weight: 4  },
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
  peakPx: number;         // maximum height above ground during a single jump
  ascentMs: number;       // ms to reach peak
  descentMs: number;      // ms from peak back to ground
  totalAirMs: number;     // total airborne time
  horizontalRangeAtSpeed: (speed: number) => number;
}

export function jumpArc(): JumpArc {
  const v0 = Math.abs(PHYSICS.jumpVelocity);                 // 1220
  const gRise = PHYSICS.worldGravity + PHYSICS.gravityRise;  // 2000
  const gFall = PHYSICS.worldGravity + PHYSICS.gravityFall;  // 3400
  const ascent = v0 / gRise;                                 // s to peak (v=0)
  const peakPx = (v0 * v0) / (2 * gRise);                    // 372 px
  const descent = Math.sqrt((2 * peakPx) / gFall);           // s back to ground
  return {
    peakPx,
    ascentMs: ascent * 1000,
    descentMs: descent * 1000,
    totalAirMs: (ascent + descent) * 1000,
    horizontalRangeAtSpeed: (spd: number) => spd * (ascent + descent),
  };
}

// ---------------------------------------------------------------------------
// Candidate pattern schema — a single generator run produces one of these,
// which is a validated group of 1..3 fences plus the runway that MUST follow
// before the next group can be spawned.
// ---------------------------------------------------------------------------
export interface FenceSpec { x: number; height: number; width: number; }

export interface HurdleCandidate {
  score: number;
  gameSpeed: number;
  tier: DifficultyTier;
  kind: PatternKind;
  fences: FenceSpec[];        // fences within THIS group, ordered by x
  clusterSpan: number;         // (last fence x + last fence w/2) - (first fence x - first fence w/2)
  nextRunwayPx: number;        // required horizontal runway to the NEXT group
  reactionMs: number;          // reaction window from spawn to first collision
}

export interface ValidationResult {
  ok: boolean;
  reasons: string[];
}

export function validate(c: HurdleCandidate): ValidationResult {
  const reasons: string[] = [];
  const arc = jumpArc();

  // 1) Every hurdle must be within the tier's height + width bands.
  for (const f of c.fences) {
    if (f.height > PHYSICS.maxHurdleH) reasons.push(`fence too tall: ${f.height} > ${PHYSICS.maxHurdleH}`);
    if (f.height < PHYSICS.minHurdleH) reasons.push(`fence too short (invisible): ${f.height} < ${PHYSICS.minHurdleH}`);
    if (f.width > PHYSICS.maxHurdleW)  reasons.push(`fence too wide: ${f.width} > ${PHYSICS.maxHurdleW}`);
    if (f.width < PHYSICS.minHurdleW)  reasons.push(`fence too narrow (invisible): ${f.width} < ${PHYSICS.minHurdleW}`);
    // Every fence must be clearable by peakPx with a comfy margin.
    if (f.height > arc.peakPx * 0.55) {
      reasons.push(`fence exceeds 55% of peakPx (${arc.peakPx.toFixed(0)}): ${f.height}`);
    }
  }
  // 2) The cluster span (first-to-last edge of a multi-fence group) must fit
  //    inside a single jump's horizontal range at the current game speed.
  const oneJumpRange = arc.horizontalRangeAtSpeed(c.gameSpeed);
  if (c.clusterSpan > oneJumpRange * 0.85) {
    reasons.push(`cluster span ${c.clusterSpan.toFixed(0)}px > 85% of jump range ${oneJumpRange.toFixed(0)}px`);
  }
  // 3) Within-cluster fence-to-fence gap check — no two fences may overlap.
  for (let i = 1; i < c.fences.length; i++) {
    const prev = c.fences[i - 1];
    const cur  = c.fences[i];
    const edgeGap = (cur.x - cur.width / 2) - (prev.x + prev.width / 2);
    if (edgeGap < 40) reasons.push(`fences ${i - 1} & ${i} too close (edge-gap ${edgeGap.toFixed(0)}px)`);
  }
  // 4) Runway to next group must be long enough that the corgi can LAND,
  //    take at least ONE stride (dogColliderW), then start the next jump.
  const strideBuffer = PHYSICS.dogColliderW + 40;
  const requiredRunway = oneJumpRange * 0.55 + strideBuffer;
  if (c.nextRunwayPx < requiredRunway) {
    reasons.push(`runway ${c.nextRunwayPx.toFixed(0)}px < required ${requiredRunway.toFixed(0)}px`);
  }
  // 5) Reaction window in milliseconds must clear the tier minimum.
  if (c.reactionMs < c.tier.minReactionMs) {
    reasons.push(`reaction ${c.reactionMs.toFixed(0)}ms < tier min ${c.tier.minReactionMs}ms`);
  }
  return { ok: reasons.length === 0, reasons };
}

// ---------------------------------------------------------------------------
// Deterministic RNG helpers (so the validator can seed runs)
// ---------------------------------------------------------------------------
export interface Rng { next: () => number; between: (a: number, b: number) => number; }

export function makeRng(seed: number): Rng {
  // Mulberry32 — small, fast, adequate for gameplay variety.
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

// Runtime speed derivation (matches GameScene.targetSpeed formula)
export function speedForScore(score: number): number {
  return Math.min(PHYSICS.maxSpeed, PHYSICS.baseSpeed + score * PHYSICS.speedRampK);
}

// ---------------------------------------------------------------------------
// Candidate generation. This is what GameScene calls each spawn tick.
// The generator PROPOSES a candidate; validate() verifies it; on failure the
// caller retries with a new seed. After 6 failed retries it should spawn the
// "safe fallback" pattern (single short hurdle w/ generous spacing).
// ---------------------------------------------------------------------------
export function generateCandidate(
  score: number,
  gameSpeed: number,
  rng: Rng,
  recentHistory: PatternKind[] = [],
): HurdleCandidate {
  const tier = tierFor(score);

  // Weighted pattern pick with anti-repeat — reject if the last two patterns
  // were identical (variety guarantee).
  const totalW = tier.patterns.reduce((s, p) => s + p.weight, 0);
  let kind: PatternKind = tier.patterns[0].kind;
  for (let attempt = 0; attempt < 6; attempt++) {
    let roll = rng.next() * totalW;
    for (const p of tier.patterns) {
      roll -= p.weight;
      if (roll <= 0) { kind = p.kind; break; }
    }
    const last2 = recentHistory.slice(-2);
    if (!(last2.length === 2 && last2[0] === kind && last2[1] === kind)) break;
  }

  const arc = jumpArc();
  const oneJumpRange = arc.horizontalRangeAtSpeed(gameSpeed);
  const cap = Math.min(oneJumpRange * 0.8, 900);
  const fenceW = () => rng.between(tier.widths.min, tier.widths.max);
  const fenceHShort = () => rng.between(tier.heights.min, Math.min(tier.heights.max, 110));
  const fenceHTall  = () => rng.between(Math.min(tier.heights.max, 110), tier.heights.max);
  const fenceHMid   = () => rng.between(tier.heights.min + 15, tier.heights.max);

  const baseX = 720 + 120; // GAME_WIDTH + offscreen buffer
  const fences: FenceSpec[] = [];

  switch (kind) {
    case 'single':
      fences.push({ x: baseX, height: fenceHShort(), width: fenceW() });
      break;
    case 'single-tall':
      fences.push({ x: baseX, height: fenceHTall(), width: fenceW() });
      break;
    case 'double-close': {
      const gap = Math.min(rng.between(170, 220), cap - 80);
      fences.push({ x: baseX,        height: fenceHShort(), width: fenceW() });
      fences.push({ x: baseX + gap,  height: fenceHShort(), width: fenceW() });
      break;
    }
    case 'double-mid': {
      const gap = Math.min(rng.between(240, 320), cap - 80);
      fences.push({ x: baseX,        height: fenceHShort(), width: fenceW() });
      fences.push({ x: baseX + gap,  height: fenceHMid(),   width: fenceW() });
      break;
    }
    case 'wide-double': {
      const gap = Math.min(rng.between(340, 420), cap - 80);
      fences.push({ x: baseX,        height: fenceHShort(), width: fenceW() });
      fences.push({ x: baseX + gap,  height: fenceHShort(), width: fenceW() });
      break;
    }
    case 'triple': {
      let g1 = rng.between(200, 260);
      let g2 = rng.between(200, 260);
      if (g1 + g2 + 160 > cap) {
        const scale = (cap - 160) / (g1 + g2);
        g1 = Math.max(160, Math.floor(g1 * scale));
        g2 = Math.max(160, Math.floor(g2 * scale));
      }
      fences.push({ x: baseX,           height: fenceHShort(), width: fenceW() });
      fences.push({ x: baseX + g1,      height: fenceHShort(), width: fenceW() });
      fences.push({ x: baseX + g1 + g2, height: fenceHShort(), width: fenceW() });
      break;
    }
  }

  // Cluster span = distance from left edge of first fence to right edge of last.
  const first = fences[0];
  const last  = fences[fences.length - 1];
  const clusterSpan = (last.x + last.width / 2) - (first.x - first.width / 2);

  // Required runway to next group: at least tier-safe stride + a variable extra.
  const strideBuffer = PHYSICS.dogColliderW + 40;
  const nextRunwayPx = Math.max(
    arc.horizontalRangeAtSpeed(gameSpeed) * 0.55 + strideBuffer,
    // Add a random extra runway so spacing doesn't repeat exactly.
    strideBuffer + rng.between(140, 340),
  );

  // Reaction window (ms) — how long from spawn (at baseX) until the first
  // fence hits the corgi at x = ~200 (GameScene spawns corgi at GAME_WIDTH*0.28
  // = 720*0.28 ≈ 202). Distance = baseX - 202 - width/2.
  const corgiX = 720 * 0.28;
  const collisionDistance = first.x - first.width / 2 - corgiX;
  const reactionMs = (collisionDistance / gameSpeed) * 1000;

  return { score, gameSpeed, tier, kind, fences, clusterSpan, nextRunwayPx, reactionMs };
}

/**
 * Generate a VALIDATED candidate. Retries up to `maxAttempts` times, then
 * falls back to a guaranteed-safe single-short-hurdle. Returns the candidate
 * plus a `rejectedCandidates` count so telemetry can be logged.
 */
export function generateValidated(
  score: number,
  gameSpeed: number,
  rng: Rng,
  recentHistory: PatternKind[] = [],
  maxAttempts = 6,
): { candidate: HurdleCandidate; rejected: number } {
  let rejected = 0;
  for (let i = 0; i < maxAttempts; i++) {
    const c = generateCandidate(score, gameSpeed, rng, recentHistory);
    if (validate(c).ok) return { candidate: c, rejected };
    rejected += 1;
  }
  // Fallback — guaranteed-safe single short hurdle with generous runway.
  const tier = tierFor(score);
  const arc = jumpArc();
  const safe: HurdleCandidate = {
    score, gameSpeed, tier,
    kind: 'single',
    fences: [{ x: 720 + 120, height: tier.heights.min + 10, width: tier.widths.min + 10 }],
    clusterSpan: tier.widths.min + 10,
    nextRunwayPx: arc.horizontalRangeAtSpeed(gameSpeed) * 0.9 + 100,
    reactionMs: 9999,
  };
  return { candidate: safe, rejected };
}
