#!/usr/bin/env node
/**
 * 25,000-sequence hurdle validator using the live game generator.
 */

import {
  PHYSICS, TIERS,
  jumpArc, makeRng, speedForScore,
  generateValidated, validate,
} from '../src/game/systems/HurdleGenerator.ts';

const TOTAL_SEQUENCES = 25000;
const OBSTACLES_PER_SEQUENCE = 30;
const DOUBLE_KINDS = ['double-mid', 'double-close', 'wide-double'];
const OLD_SPEED_CURVE = new Map([
  [15, 360], [30, 390], [60, 430], [100, 470],
  [150, 520], [220, 570], [300, 600],
]);

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
  perKind: {},
  earlyPatterns: 0,
  earlyDoubles: 0,
  invariantFailures: {
    tripleBefore101: 0,
    doubleBefore15: 0,
    belowReactionFloor: 0,
    closeDoubleBefore75: 0,
    doubleRecoveryViolation: 0,
    tutorialSpeedChanged: 0,
    noRampAfter7: 0,
    nonMonotonicSpeed: 0,
    speedGainBelowFiftyPercent: 0,
  },
  failures: [],
};

const arc = jumpArc();
console.log(`\nCorgi-Hop harder-balance validator — 25,000-sequence physics audit\n`);
console.log(`Physics: jump=${PHYSICS.jumpVelocity}, gravity=${PHYSICS.worldGravity}, speed=${PHYSICS.baseSpeed}..${PHYSICS.maxSpeed}`);
console.log(`Jump arc: peak=${arc.peakPx.toFixed(1)}px, air=${arc.totalAirMs.toFixed(0)}ms`);
console.log('Tiers:');
for (const tier of TIERS) {
  console.log(`  ${tier.scoreMin}-${tier.scoreMax}: reaction≥${tier.minReactionMs}ms, ${tier.patterns.map((pattern) => pattern.kind).join('/')}`);
}

const scoreSamples = [];
for (const tier of TIERS) {
  const span = Math.max(1, tier.scoreMax === 9999 ? 40 : tier.scoreMax - tier.scoreMin + 1);
  for (let score = tier.scoreMin; score <= Math.min(tier.scoreMax, tier.scoreMin + span - 1); score++) {
    scoreSamples.push(score);
  }
}
for (const score of [0, 7, 8, 15, 30, 60, 75, 100, 101, 150, 200, 220, 300, 400]) {
  for (let repeat = 0; repeat < 40; repeat++) scoreSamples.push(score);
}

for (let sequenceIndex = 0; sequenceIndex < TOTAL_SEQUENCES; sequenceIndex++) {
  const seed = 1000 + sequenceIndex;
  const rng = makeRng(seed);
  let score = scoreSamples[sequenceIndex % scoreSamples.length];
  const history = [];
  let lastCandidate = null;
  let worldOffset = 0;
  const groupBaseX = 840;

  for (let obstacleIndex = 0; obstacleIndex < OBSTACLES_PER_SEQUENCE; obstacleIndex++) {
    const gameSpeed = speedForScore(score);
    const { candidate, rejected } = generateValidated(score, gameSpeed, rng, history);
    stats.candidates += 1;
    stats.rejected += rejected;
    if (candidate.reactionMs === 9999) stats.fallbacks += 1;

    const worldFences = candidate.fences.map((fence) => ({
      x: fence.x - groupBaseX + worldOffset,
      height: fence.height,
      width: fence.width,
    }));
    const validation = validate(candidate);
    if (!validation.ok) {
      stats.failures.push({ seed, obstacleIndex, candidate, reasons: validation.reasons });
      break;
    }

    if (lastCandidate) {
      const previous = lastCandidate.worldFences[lastCandidate.worldFences.length - 1];
      const next = worldFences[0];
      const runway = (next.x - next.width / 2) - (previous.x + previous.width / 2);
      if (runway < lastCandidate.nextRunwayPx - 2) {
        stats.failures.push({
          seed,
          obstacleIndex,
          candidate,
          reasons: [`inter-group runway ${runway.toFixed(0)}px < declared ${lastCandidate.nextRunwayPx.toFixed(0)}px`],
        });
        break;
      }
      stats.minSpacing = Math.min(stats.minSpacing, runway);
      stats.maxSpacing = Math.max(stats.maxSpacing, runway);
    }

    for (const fence of candidate.fences) {
      stats.minHeight = Math.min(stats.minHeight, fence.height);
      stats.maxHeight = Math.max(stats.maxHeight, fence.height);
      stats.minWidth = Math.min(stats.minWidth, fence.width);
      stats.maxWidth = Math.max(stats.maxWidth, fence.width);
    }
    stats.minReactionMs = Math.min(stats.minReactionMs, candidate.reactionMs);
    stats.maxReactionMs = Math.max(stats.maxReactionMs, candidate.reactionMs);
    const tierName = `${candidate.tier.scoreMin}-${candidate.tier.scoreMax}`;
    stats.perTier[tierName] = (stats.perTier[tierName] || 0) + 1;
    stats.perKind[candidate.kind] = (stats.perKind[candidate.kind] || 0) + 1;

    const candidateIsDouble = DOUBLE_KINDS.includes(candidate.kind);
    if (candidate.kind === 'triple' && score < 101) stats.invariantFailures.tripleBefore101 += 1;
    if (candidateIsDouble && score < 15) stats.invariantFailures.doubleBefore15 += 1;
    if (candidate.reactionMs < candidate.tier.minReactionMs) stats.invariantFailures.belowReactionFloor += 1;
    if (candidate.kind === 'double-close' && score < 75) stats.invariantFailures.closeDoubleBefore75 += 1;
    if (score >= 15 && score <= 30) {
      stats.earlyPatterns += 1;
      if (candidateIsDouble) stats.earlyDoubles += 1;
    }
    const recentDouble = history.slice(-2).some((kind) => DOUBLE_KINDS.includes(kind));
    if (recentDouble && candidate.kind !== 'single') stats.invariantFailures.doubleRecoveryViolation += 1;

    history.push(candidate.kind);
    if (history.length > 5) history.shift();
    lastCandidate = { ...candidate, worldFences };
    const finalFence = worldFences[worldFences.length - 1];
    const finalEdge = finalFence.x + finalFence.width / 2;
    worldOffset = finalEdge + candidate.nextRunwayPx + groupBaseX;
    score = Math.min(400, score + 1);
  }

  stats.sequences += 1;
  if (stats.failures.length > 0) break;
}

console.log('\n--- Results ---');
console.log(`Total sequences: ${stats.sequences}`);
console.log(`Total candidates: ${stats.candidates}`);
console.log(`Rejected and retried: ${stats.rejected}`);
console.log(`Safe fallbacks: ${stats.fallbacks}`);
console.log(`Impossible sequences: ${stats.failures.length}`);
console.log(`Fence height: ${stats.minHeight}..${stats.maxHeight}px`);
console.log(`Fence width: ${stats.minWidth}..${stats.maxWidth}px`);
console.log(`Inter-group spacing: ${stats.minSpacing.toFixed(0)}..${stats.maxSpacing.toFixed(0)}px`);
console.log(`Reaction window: ${stats.minReactionMs.toFixed(0)}..${stats.maxReactionMs.toFixed(0)}ms`);

const earlyDoubleRate = 100 * stats.earlyDoubles / Math.max(1, stats.earlyPatterns);
console.log(`Score 15-30 double rate: ${earlyDoubleRate.toFixed(2)}%`);

console.log('\nSpeed curve and 50% gain check:');
const speedSamples = [0, 7, 8, 15, 30, 60, 100, 150, 220, 300, 400];
let previousSpeed = -Infinity;
for (const score of speedSamples) {
  const speed = speedForScore(score);
  console.log(`  ${score}: ${speed} px/s`);
  if (speed < previousSpeed) stats.invariantFailures.nonMonotonicSpeed += 1;
  previousSpeed = speed;
}
if (speedForScore(0) !== 340 || speedForScore(7) !== 340) stats.invariantFailures.tutorialSpeedChanged += 1;
if (speedForScore(8) <= 340) stats.invariantFailures.noRampAfter7 += 1;
for (const [score, oldSpeed] of OLD_SPEED_CURVE.entries()) {
  const oldGain = oldSpeed - 340;
  const newGain = speedForScore(score) - 340;
  if (newGain + 0.001 < oldGain * 1.5) {
    stats.invariantFailures.speedGainBelowFiftyPercent += 1;
    console.log(`  FAIL score ${score}: new gain ${newGain} < required ${oldGain * 1.5}`);
  }
}

const rateFailure = earlyDoubleRate < 8 || earlyDoubleRate > 11 ? 1 : 0;
const invariantFailureCount = Object.values(stats.invariantFailures).reduce((sum, count) => sum + count, 0) + rateFailure;

if (stats.failures.length > 0 || invariantFailureCount > 0) {
  console.log('\nFAILURES:');
  for (const failure of stats.failures.slice(0, 20)) {
    console.log(`  seed=${failure.seed} obstacle=${failure.obstacleIndex}: ${failure.reasons.join(', ')}`);
  }
  console.log(`Invariant violations: ${invariantFailureCount}`);
  process.exit(1);
}

console.log(`\nPASS — zero impossible sequences, and every post-tutorial speed anchor is at least 50% harder across ${stats.candidates} candidates.`);
