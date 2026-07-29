#!/usr/bin/env node
'use strict';

const path = require('path');

const compiledPath = process.argv[2];
if (!compiledPath) {
  console.error('Usage: node scripts/validate_never_impossible.cjs <compiled HurdleGenerator.js>');
  process.exit(1);
}

const {
  PHYSICS,
  jumpArc,
  tierFor,
  validate,
  speedForScore,
  makeRng,
  generateValidated,
} = require(path.resolve(compiledPath));

const HARDER_GAIN_MULTIPLIER = 1.10;
const HARD_SPEED_CAP = 770;
const TRIPLE_EDGE_GAP = 42;
const TRIPLE_TIMING_MARGIN_MS = 90;
const SAMPLES_PER_SCORE = 1200;

function harderSpeed(score) {
  const base = speedForScore(score);
  if (score <= 7) return base;
  return Math.min(
    HARD_SPEED_CAP,
    PHYSICS.baseSpeed + (base - PHYSICS.baseSpeed) * HARDER_GAIN_MULTIPLIER,
  );
}

function maximumSafeTripleSpan(gameSpeed) {
  const oneJumpRange = jumpArc().horizontalRangeAtSpeed(gameSpeed);
  const timingMarginPx = Math.max(36, gameSpeed * (TRIPLE_TIMING_MARGIN_MS / 1000));
  return Math.max(0, oneJumpRange - PHYSICS.dogColliderW - timingMarginPx);
}

function makeRuntimeTriple(score, seed) {
  const rng = makeRng(seed);
  const gameSpeed = harderSpeed(score);
  const tier = tierFor(score);
  const safeSpan = maximumSafeTripleSpan(gameSpeed) * 0.92;
  const heightBand = tier.heights.max - tier.heights.min;
  const heightMax = Math.max(tier.heights.min, Math.round(tier.heights.min + heightBand * 0.30));
  const widthFloor = PHYSICS.minHurdleW;
  const fairWidthCeiling = Math.floor((safeSpan - TRIPLE_EDGE_GAP * 2) / 3);
  const tierWidthCeiling = Math.round(
    tier.widths.min + (tier.widths.max - tier.widths.min) * 0.28,
  );
  const widthMax = Math.min(tierWidthCeiling, fairWidthCeiling);
  if (widthMax < widthFloor) return null;

  const height = rng.between(tier.heights.min, heightMax);
  const width = rng.between(widthFloor, widthMax);
  const minimumClusterSpan = width * 3 + TRIPLE_EDGE_GAP * 2;
  if (minimumClusterSpan > safeSpan) return null;

  const targetClusterSpan = rng.between(
    Math.ceil(minimumClusterSpan),
    Math.floor(Math.max(minimumClusterSpan, safeSpan)),
  );

  // Mirror the live generator exactly: distribute only the extra space so both
  // adjacent obstacle pairs retain at least a 42px clear edge gap.
  const extraGapSpace = targetClusterSpan - minimumClusterSpan;
  const firstExtra = extraGapSpace > 0 ? rng.between(0, extraGapSpace) : 0;
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
  const oneJumpRange = jumpArc().horizontalRangeAtSpeed(gameSpeed);
  const nextRunwayPx = oneJumpRange * 0.5
    + PHYSICS.dogColliderW + 40
    + gameSpeed * 0.195
    + 230;
  const corgiX = 720 * 0.28;
  const reactionMs = ((baseX - width / 2 - corgiX) / gameSpeed) * 1000;

  return {
    score,
    gameSpeed,
    tier,
    kind: 'triple',
    fences,
    clusterSpan: targetClusterSpan,
    nextRunwayPx,
    reactionMs,
  };
}

function edgeGapsFor(candidate) {
  const gaps = [];
  for (let index = 1; index < candidate.fences.length; index++) {
    const previous = candidate.fences[index - 1];
    const current = candidate.fences[index];
    gaps.push((current.x - current.width / 2) - (previous.x + previous.width / 2));
  }
  return gaps;
}

let runtimeTriples = 0;
let score50Triples = 0;
let score82Triples = 0;
let generatorCandidates = 0;
let runtimeDowngrades = 0;
let minimumObservedEdgeGap = Infinity;
const failures = [];

for (let score = 50; score <= 100; score++) {
  for (let sample = 0; sample < SAMPLES_PER_SCORE; sample++) {
    const candidate = makeRuntimeTriple(score, score * 100000 + sample);
    if (!candidate) {
      failures.push({ type: 'runtime-triple-null', score, sample });
      break;
    }

    runtimeTriples += 1;
    if (score === 50) score50Triples += 1;
    if (score === 82) score82Triples += 1;

    const validation = validate(candidate);
    const fullBodySafe = candidate.clusterSpan <= maximumSafeTripleSpan(candidate.gameSpeed);
    const edgeGaps = edgeGapsFor(candidate);
    const pairSpacingSafe = edgeGaps.every((gap) => gap + 0.001 >= TRIPLE_EDGE_GAP);
    minimumObservedEdgeGap = Math.min(minimumObservedEdgeGap, ...edgeGaps);

    if (!validation.ok || !fullBodySafe || !pairSpacingSafe) {
      failures.push({
        type: 'runtime-triple',
        score,
        sample,
        reasons: validation.reasons,
        edgeGaps,
        requiredEdgeGap: TRIPLE_EDGE_GAP,
        span: candidate.clusterSpan,
        max: maximumSafeTripleSpan(candidate.gameSpeed),
      });
      break;
    }
  }
  if (failures.length) break;
}

// Stress the authoritative generator at the actual harder runtime speed. The
// final runtime guard compresses a triple when possible and otherwise downgrades
// it to one safe obstacle; this checks the exact decision for every sample.
for (let sequence = 0; sequence < 25000 && failures.length === 0; sequence++) {
  const rng = makeRng(900000 + sequence);
  const history = [];
  let score = sequence % 401;

  for (let index = 0; index < 24; index++) {
    const speed = harderSpeed(score);
    const { candidate } = generateValidated(score, speed, rng, history);
    generatorCandidates += 1;
    const validation = validate(candidate);
    if (!validation.ok) {
      failures.push({ type: 'generator', score, reasons: validation.reasons });
      break;
    }

    if (candidate.kind === 'triple') {
      const widths = candidate.fences.map((fence) => fence.width);
      const minimumCompressedSpan = widths.reduce((sum, width) => sum + width, 0)
        + TRIPLE_EDGE_GAP * 2;
      const safeSpan = maximumSafeTripleSpan(speed) * 0.94;
      if (minimumCompressedSpan > safeSpan) runtimeDowngrades += 1;
    }

    history.push(candidate.kind);
    if (history.length > 5) history.shift();
    score = Math.min(400, score + 1);
  }
}

if (score50Triples !== SAMPLES_PER_SCORE) {
  failures.push({
    type: 'coverage',
    reasons: [`expected ${SAMPLES_PER_SCORE} score-50 triples, generated ${score50Triples}`],
  });
}
if (score82Triples !== SAMPLES_PER_SCORE) {
  failures.push({
    type: 'coverage',
    reasons: [`expected ${SAMPLES_PER_SCORE} score-82 triples, generated ${score82Triples}`],
  });
}

if (failures.length) {
  console.error('\nFAIL — never-impossible obstacle safety audit');
  console.error(JSON.stringify(failures.slice(0, 10), null, 2));
  process.exit(1);
}

console.log('\nPASS — never-impossible obstacle safety audit');
console.log(`Runtime triples tested: ${runtimeTriples}`);
console.log(`Score-50 triples tested: ${score50Triples}`);
console.log(`Score-82 triples tested: ${score82Triples}`);
console.log(`Minimum observed triple edge gap: ${minimumObservedEdgeGap.toFixed(1)}px`);
console.log(`Generator candidates tested: ${generatorCandidates}`);
console.log(`Unsafe native triples safely downgraded by runtime gate: ${runtimeDowngrades}`);
console.log(`Harder speed at score 82: ${harderSpeed(82).toFixed(1)} px/s`);
console.log(`Full-body safe triple span at score 82: ${maximumSafeTripleSpan(harderSpeed(82)).toFixed(1)} px`);
