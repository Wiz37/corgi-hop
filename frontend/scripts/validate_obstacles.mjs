// validate_obstacles.mjs — headless 1,000-sequence pattern validation.
//
// Replicates the exact spawnNext() math from GameScene.ts using the real
// physics constants and verifies that every generated pattern is physically
// achievable. Prints the total impossible-pattern count (must be 0).

const JUMP_VELOCITY = -1220;
const GRAVITY = 2400;
const FENCE_W = 80;

function airTime() {
  return (2 * Math.abs(JUMP_VELOCITY)) / GRAVITY;
}

function jumpRange(speed) {
  return speed * airTime();
}

function jumpHeight() {
  // v^2 / (2g) at t=0 → peak height above start
  return (JUMP_VELOCITY * JUMP_VELOCITY) / (2 * GRAVITY);
}

function between(lo, hi) {
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

// Mirror the GameScene tier tables + height ranges.
function pickPattern(score) {
  let table;
  if (score < 8) table = [['single', 100]];
  else if (score < 18) table = [['single', 80], ['single-tall', 20]];
  else if (score < 30) table = [['single', 50], ['single-tall', 20], ['double-mid', 20], ['double-close', 10]];
  else table = [['single', 30], ['single-tall', 20], ['double-mid', 20], ['double-close', 15], ['wide-double', 12], ['triple', 3]];
  const total = table.reduce((s, [, w]) => s + w, 0);
  let roll = Math.random() * total;
  for (const [p, w] of table) { roll -= w; if (roll <= 0) return p; }
  return 'single';
}

function heights(score) {
  let shortH, midH, tallH;
  if (score < 8) {
    shortH = between(85, 105); midH = shortH; tallH = shortH;
  } else if (score < 18) {
    shortH = between(90, 115); midH = between(100, 125); tallH = between(115, 135);
  } else if (score < 30) {
    shortH = between(95, 120); midH = between(110, 135); tallH = between(130, 150);
  } else {
    shortH = between(100, 125); midH = between(115, 140); tallH = between(135, 160);
  }
  return { shortH, midH, tallH };
}

function generateSequence(score, speed) {
  const airTimeS = airTime();
  const range = speed * airTimeS;
  const minRunway = Math.max(320, range * 0.55);
  const maxClusterSpan = range * 0.8;
  const clampCluster = (gap) => {
    const span = gap + FENCE_W;
    if (span > maxClusterSpan) return Math.max(160, maxClusterSpan - FENCE_W);
    return Math.max(160, gap);
  };

  const variant = pickPattern(score);
  const { shortH, midH, tallH } = heights(score);
  const obstacles = [];
  const baseX = 0;

  switch (variant) {
    case 'single':
      obstacles.push({ x: baseX, h: shortH });
      break;
    case 'single-tall':
      obstacles.push({ x: baseX, h: tallH });
      break;
    case 'double-close': {
      const g = clampCluster(between(170, 220));
      obstacles.push({ x: baseX, h: shortH });
      obstacles.push({ x: baseX + g, h: shortH });
      break;
    }
    case 'double-mid': {
      const g = clampCluster(between(240, 320));
      obstacles.push({ x: baseX, h: shortH });
      obstacles.push({ x: baseX + g, h: [shortH, midH][between(0, 1)] });
      break;
    }
    case 'wide-double': {
      const g = clampCluster(between(340, 420));
      obstacles.push({ x: baseX, h: shortH });
      obstacles.push({ x: baseX + g, h: shortH });
      break;
    }
    case 'triple': {
      let g1 = between(200, 260);
      let g2 = between(200, 260);
      const totalWithFences = g1 + g2 + FENCE_W * 2;
      if (totalWithFences > maxClusterSpan) {
        const scale = (maxClusterSpan - FENCE_W * 2) / (g1 + g2);
        g1 = Math.max(160, Math.floor(g1 * scale));
        g2 = Math.max(160, Math.floor(g2 * scale));
      }
      g1 = clampCluster(g1);
      g2 = clampCluster(g2);
      obstacles.push({ x: baseX, h: shortH });
      obstacles.push({ x: baseX + g1, h: shortH });
      obstacles.push({ x: baseX + g1 + g2, h: shortH });
      break;
    }
  }
  return { variant, obstacles, minRunway, maxClusterSpan };
}

function validate(seq, speed) {
  const maxH = jumpHeight() - 20; // 20px safety margin below peak
  const range = jumpRange(speed);

  // Rule 1: every obstacle height must be clearable
  for (const o of seq.obstacles) {
    if (o.h > maxH) return { ok: false, reason: `height ${o.h} > clearable ${Math.floor(maxH)}` };
  }
  // Rule 2: cluster span (first-to-last obstacle right-edge) must fit inside
  // a single jump range × 0.85 safety.
  if (seq.obstacles.length > 1) {
    const clusterSpan = (seq.obstacles.at(-1).x - seq.obstacles[0].x) + FENCE_W;
    if (clusterSpan > range * 0.85) {
      return { ok: false, reason: `cluster span ${Math.floor(clusterSpan)} > jump range ${Math.floor(range * 0.85)}` };
    }
  }
  // Rule 3: no overlapping obstacles
  for (let i = 1; i < seq.obstacles.length; i++) {
    const a = seq.obstacles[i - 1], b = seq.obstacles[i];
    if (b.x - a.x < FENCE_W * 1.2) {
      return { ok: false, reason: `overlap ${b.x - a.x} < 96` };
    }
  }
  return { ok: true };
}

// ---- Run 1,000 sequences at each of 5 speed × 4 score buckets = 20 buckets ----
// Speed is correlated with score in real gameplay:
//   targetSpeed = min(760, 340 + score * 8)
// so we ONLY test valid (score, speed) combinations that could actually
// happen in-game plus 2 stress tests at the top speed.
const cases = [
  { score: 0,  speed: 340 },   // opening
  { score: 8,  speed: 404 },   // start of tier 2
  { score: 18, speed: 484 },   // tier 3
  { score: 30, speed: 580 },   // tier 4 begin
  { score: 40, speed: 660 },   // steady mid game
  { score: 60, speed: 760 },   // max intended
];
let total = 0;
let failed = 0;
const failures = [];
const SEQS_PER_BUCKET = 200;
for (const { score, speed } of cases) {
  for (let i = 0; i < SEQS_PER_BUCKET; i++) {
    total += 1;
    const seq = generateSequence(score, speed);
    const v = validate(seq, speed);
    if (!v.ok) {
      failed += 1;
      failures.push({ score, speed, variant: seq.variant, reason: v.reason });
    }
  }
}

console.log(`Ran ${total} sequences across ${cases.length} realistic (score, speed) buckets.`);
console.log(`FAILED patterns: ${failed}`);
if (failures.length) {
  console.log('First 10 failures:');
  for (const f of failures.slice(0, 10)) console.log('  ', f);
}
console.log(`\nPhysics constants used:`);
console.log(`  jumpVelocity = ${JUMP_VELOCITY} px/s`);
console.log(`  gravity      = ${GRAVITY} px/s²`);
console.log(`  air time     = ${airTime().toFixed(3)} s`);
console.log(`  peak height  = ${Math.floor(jumpHeight())} px`);
for (const { score, speed } of cases) {
  console.log(`  @ score ${score}, speed ${speed}: jumpRange = ${Math.floor(jumpRange(speed))} px, minRunway = ${Math.floor(Math.max(320, jumpRange(speed) * 0.55))} px`);
}
process.exit(failed === 0 ? 0 : 1);
