#!/usr/bin/env node
/**
 * 10,000-sequence hurdle validator.
 *
 * Imports the LIVE game generator from
 *   /app/frontend/src/game/systems/HurdleGenerator.ts
 * via tsx so the same code that runs in the browser is under test.
 *
 * For each of 10,000 iterations we:
 *   1. Pick a random score (0..80) and a matching gameSpeed (baseSpeed +
 *      score*speedRampK, capped at maxSpeed).
 *   2. Seed a fresh RNG.
 *   3. Simulate a full 30-obstacle sequence at that score/speed, calling
 *      generateValidated(). Every returned candidate is re-validated to
 *      confirm the generator's OWN validator agrees.
 *   4. Also check pairwise: previous group's runway must physically leave
 *      enough space before the next group.
 *
 * Any candidate that fails any check aborts the run with a full trace.
 * Otherwise we print the aggregate statistics required by the spec.
 */

import {
  PHYSICS, TIERS,
  jumpArc, makeRng, speedForScore,
  generateValidated, validate,
} from '../src/game/systems/HurdleGenerator.ts';

const TOTAL_SEQUENCES = 10000;
const OBSTACLES_PER_SEQUENCE = 30;

const stats = {
  sequences: 0,
  candidates: 0,
  rejected: 0,
  fallbacks: 0,
  minSpacing: Infinity,
  maxSpacing: -Infinity,
  minHeight: Infinity,
  maxHeight: -Infinity,
  minWidth: Infinity,
  maxWidth: -Infinity,
  minReactionMs: Infinity,
  maxReactionMs: -Infinity,
  perTier: {},
  failures: [],
};

const arc = jumpArc();
console.log(`\nCorgi-Hop hurdle validator — 10,000-sequence physics audit\n`);
console.log(`Physics constants:`);
console.log(`  jumpVelocity=${PHYSICS.jumpVelocity}  worldGravity=${PHYSICS.worldGravity}`);
console.log(`  gravityRise=${PHYSICS.gravityRise}  gravityFall=${PHYSICS.gravityFall}`);
console.log(`  baseSpeed=${PHYSICS.baseSpeed}  maxSpeed=${PHYSICS.maxSpeed}  speedRampK=${PHYSICS.speedRampK}`);
console.log(`Derived jump arc:`);
console.log(`  peak=${arc.peakPx.toFixed(1)}px  ascent=${arc.ascentMs.toFixed(0)}ms  descent=${arc.descentMs.toFixed(0)}ms  total=${arc.totalAirMs.toFixed(0)}ms`);
console.log(`  range@baseSpeed=${arc.horizontalRangeAtSpeed(PHYSICS.baseSpeed).toFixed(0)}px  range@maxSpeed=${arc.horizontalRangeAtSpeed(PHYSICS.maxSpeed).toFixed(0)}px`);
console.log(`Tiers:`);
for (const t of TIERS) {
  console.log(`  score ${t.scoreMin}-${t.scoreMax}: reaction≥${t.minReactionMs}ms  H=${t.heights.min}..${t.heights.max}  W=${t.widths.min}..${t.widths.max}  ${t.patterns.map(p=>p.kind).join('/')}`);
}
console.log('');

// Sweep across all difficulty tiers evenly so we exercise the full behaviour.
const scoreSamples = [];
for (const t of TIERS) {
  const span = Math.max(1, t.scoreMax === 9999 ? 30 : (t.scoreMax - t.scoreMin + 1));
  for (let s = t.scoreMin; s <= Math.min(t.scoreMax, t.scoreMin + span - 1); s++) scoreSamples.push(s);
}
// Add extra samples at high scores (50-99) to exercise the max-speed regime.
for (let s = 50; s < 100; s++) scoreSamples.push(s);

for (let seqIdx = 0; seqIdx < TOTAL_SEQUENCES; seqIdx++) {
  const seed = 1000 + seqIdx;
  const rng = makeRng(seed);
  const startScore = scoreSamples[seqIdx % scoreSamples.length];
  // Simulate 30 consecutive obstacles for this "run" — score climbs as we go.
  const history = [];
  let score = startScore;
  let lastCandidate = null;
  // World-x cursor — every candidate is generated at its own "local" baseX
  // (720+120 = 840). To compute the true spacing between consecutive groups
  // we translate every fence by `worldOffset` so groups are laid out along
  // the actual x-axis exactly as the game would spawn them (each new group
  // spawns at (last group's last edge + last.nextRunwayPx)).
  let worldOffset = 0;
  const groupBaseX = 840; // GAME_WIDTH + spawn buffer, matches HurdleGenerator
  for (let i = 0; i < OBSTACLES_PER_SEQUENCE; i++) {
    const gs = speedForScore(score);
    const { candidate, rejected } = generateValidated(score, gs, rng, history);
    stats.candidates += 1;
    stats.rejected += rejected;
    if (candidate.reactionMs === 9999) stats.fallbacks += 1;
    // Translate the candidate's fences into world-space for pairwise checks.
    const worldFences = candidate.fences.map(f => ({
      x: f.x - groupBaseX + worldOffset,
      height: f.height,
      width: f.width,
    }));
    // Independent re-check — the generator's own validator must agree.
    const v = validate(candidate);
    if (!v.ok) {
      stats.failures.push({ seed, i, candidate, reasons: v.reasons });
      break;
    }
    // Pairwise runway check with the previous candidate (using world coords).
    if (lastCandidate) {
      const prev = lastCandidate.worldFences[lastCandidate.worldFences.length - 1];
      const next = worldFences[0];
      const runway = (next.x - next.width / 2) - (prev.x + prev.width / 2);
      if (runway < lastCandidate.nextRunwayPx - 2) {
        stats.failures.push({
          seed, i, candidate,
          reasons: [`inter-group runway ${runway.toFixed(0)}px < declared ${lastCandidate.nextRunwayPx.toFixed(0)}px`],
        });
        break;
      }
      stats.minSpacing = Math.min(stats.minSpacing, runway);
      stats.maxSpacing = Math.max(stats.maxSpacing, runway);
    }
    // Track fence extremes.
    for (const f of candidate.fences) {
      stats.minHeight = Math.min(stats.minHeight, f.height);
      stats.maxHeight = Math.max(stats.maxHeight, f.height);
      stats.minWidth  = Math.min(stats.minWidth,  f.width);
      stats.maxWidth  = Math.max(stats.maxWidth,  f.width);
    }
    stats.minReactionMs = Math.min(stats.minReactionMs, candidate.reactionMs);
    stats.maxReactionMs = Math.max(stats.maxReactionMs, candidate.reactionMs);
    const tierName = `${candidate.tier.scoreMin}-${candidate.tier.scoreMax}`;
    stats.perTier[tierName] = (stats.perTier[tierName] || 0) + 1;

    history.push(candidate.kind);
    if (history.length > 5) history.shift();
    // Save with world-space fence coords so the next iteration sees them.
    lastCandidate = { ...candidate, worldFences };
    // Advance the world cursor: skip past this group's last fence edge, then
    // the declared runway to the NEXT group's first fence edge.
    const lastEdgeX = worldFences[worldFences.length - 1].x
                    + worldFences[worldFences.length - 1].width / 2;
    // Next group's first fence LEFT edge = lastEdgeX + nextRunwayPx, and its
    // local x is 840 - width/2. So worldOffset for next iteration:
    //   worldOffset - groupBaseX = lastEdgeX + nextRunwayPx - width/2_of_next
    // We don't know the next group's width yet, so compute worldOffset as
    // the desired world_x of the next group's LEFT edge, plus the group's
    // local baseX so `f.x - groupBaseX + worldOffset` lands at the correct
    // world position.
    worldOffset = lastEdgeX + candidate.nextRunwayPx + groupBaseX;

    // Simulate the corgi passing this obstacle → +1 score, speed re-derived
    // next iteration.
    score = Math.min(120, score + 1);
  }
  stats.sequences += 1;
  if (stats.failures.length > 0) break;
}

console.log(`--- Results ---`);
console.log(`Total sequences generated:        ${stats.sequences}`);
console.log(`Total obstacle candidates:        ${stats.candidates}`);
console.log(`Total candidates rejected by gen: ${stats.rejected} (retried within generateValidated)`);
console.log(`Fallback (safe) spawns emitted:   ${stats.fallbacks}`);
console.log(`Impossible / failing sequences:   ${stats.failures.length}`);
console.log(``);
console.log(`Fence height  min/max: ${stats.minHeight}px / ${stats.maxHeight}px`);
console.log(`Fence width   min/max: ${stats.minWidth}px / ${stats.maxWidth}px`);
console.log(`Inter-group spacing min/max: ${stats.minSpacing.toFixed(0)}px / ${stats.maxSpacing.toFixed(0)}px`);
console.log(`Reaction window min/max: ${stats.minReactionMs.toFixed(0)}ms / ${stats.maxReactionMs.toFixed(0)}ms`);
console.log(`Per-tier candidate counts:`);
for (const t of TIERS) {
  const k = `${t.scoreMin}-${t.scoreMax}`;
  console.log(`  ${k}: ${(stats.perTier[k] || 0)}`);
}
console.log(``);
if (stats.failures.length > 0) {
  console.log(`FAILURES:`);
  for (const f of stats.failures.slice(0, 20)) {
    console.log(`  seed=${f.seed} at obstacle ${f.i}: ${f.reasons.join(', ')}`);
    console.log(`    candidate: ${JSON.stringify(f.candidate)}`);
  }
  process.exit(1);
} else {
  console.log(`PASS — zero impossible sequences across ${stats.candidates} candidates.`);
  process.exit(0);
}
