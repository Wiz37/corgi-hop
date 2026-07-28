import Phaser from 'phaser';
import type { PatternKind } from './HurdleGenerator';

type GroundSkin =
  | 'picket_fence'
  | 'obstacle_log'
  | 'obstacle_hay'
  | 'obstacle_tires'
  | 'obstacle_cones';

interface VarietyState {
  birdCooldown: number;
  nextAirGroupId: number;
  lastGroundSkin: GroundSkin | null;
}

const GROUND_SKINS: GroundSkin[] = [
  'picket_fence',
  'obstacle_log',
  'obstacle_hay',
  'obstacle_tires',
  'obstacle_cones',
];

const states = new WeakMap<object, VarietyState>();
let installed = false;

const isDouble = (kind: PatternKind): boolean =>
  kind === 'double-mid' || kind === 'double-close' || kind === 'wide-double';

function stateFor(scene: object): VarietyState {
  let state = states.get(scene);
  if (!state) {
    state = { birdCooldown: 0, nextAirGroupId: 0, lastGroundSkin: null };
    states.set(scene, state);
  }
  return state;
}

function buildBirdTexture(scene: any): void {
  const key = 'obstacle_bird';
  if (scene.textures.exists(key)) return;

  const graphics = scene.make.graphics({ x: 0, y: 0 }, false);

  // Tail and wings.
  graphics.fillStyle(0x24304a, 1);
  graphics.fillTriangle(34, 48, 8, 31, 13, 61);
  graphics.fillTriangle(78, 42, 51, 7, 93, 31);
  graphics.fillTriangle(80, 52, 56, 84, 101, 62);

  // Body and head.
  graphics.fillStyle(0x5bb6e8, 1);
  graphics.fillEllipse(76, 50, 82, 48);
  graphics.fillStyle(0x79cff4, 1);
  graphics.fillCircle(116, 42, 24);

  // Belly, eye, and beak.
  graphics.fillStyle(0xd8f5ff, 1);
  graphics.fillEllipse(78, 58, 45, 22);
  graphics.fillStyle(0x18223a, 1);
  graphics.fillCircle(122, 36, 5);
  graphics.fillStyle(0xffa62b, 1);
  graphics.fillTriangle(138, 43, 158, 50, 138, 56);

  // Wing detail.
  graphics.lineStyle(5, 0x24304a, 1);
  graphics.strokeEllipse(73, 49, 45, 27);

  graphics.generateTexture(key, 164, 92);
  graphics.destroy();
}

function pickGroundSkin(scene: any, state: VarietyState, used: Set<GroundSkin>): GroundSkin {
  const available = GROUND_SKINS.filter((skin) =>
    scene.textures.exists(skin) && !used.has(skin) && skin !== state.lastGroundSkin,
  );
  const fallback = GROUND_SKINS.filter((skin) => scene.textures.exists(skin) && !used.has(skin));
  const choices = available.length ? available : fallback.length ? fallback : ['picket_fence' as GroundSkin];
  return choices[Math.floor(Math.random() * choices.length)];
}

function randomizeGroundGroup(scene: any, spawned: any[], state: VarietyState): void {
  if (!spawned.length) return;
  const used = new Set<GroundSkin>();

  for (const obstacle of spawned) {
    if (!obstacle?.active || obstacle.getData?.('airHazard')) continue;
    const width = Number(obstacle.displayWidth) || 90;
    const height = Number(obstacle.displayHeight) || 90;
    const skin = pickGroundSkin(scene, state, used);
    used.add(skin);

    obstacle.setTexture(skin);
    obstacle.setDisplaySize(width, height);
    obstacle.setAlpha(1);
    obstacle.clearTint?.();
    obstacle.setData('funObstacleSkin', skin);
    state.lastGroundSkin = skin;
  }
}

function birdChanceForScore(score: number): number {
  if (score < 5) return 0;
  if (score < 15) return 0.06;
  if (score < 30) return 0.09;
  if (score < 60) return 0.12;
  return 0.15;
}

function canSpawnBird(scene: any, state: VarietyState): boolean {
  const score = Math.max(0, Number(scene.score) || 0);
  if (state.birdCooldown > 0 || Math.random() >= birdChanceForScore(score)) return false;

  const history = (scene.recentPatternHistory ?? []) as PatternKind[];
  const lastKind = history[history.length - 1];

  // Preserve two normal recovery singles after doubles, and never place a bird
  // immediately after a triple. Birds always replace an entire ground group.
  if (history.slice(-2).some(isDouble) || lastKind === 'triple') return false;
  return true;
}

function spawnBird(scene: any, state: VarietyState): void {
  const x = 1020;
  const y = scene.groundY - Phaser.Math.Between(198, 224);
  const bird = scene.add.sprite(x, y, 'obstacle_bird')
    .setOrigin(0.5)
    .setDepth(13)
    .setDisplaySize(118, 66)
    .setAlpha(1);

  // The collision rectangle is deliberately smaller than the artwork. At its
  // lowest allowed flight height, a grounded corgi still has a safe gap.
  (bird as any).hitRect = new Phaser.Geom.Rectangle(-43, -22, 86, 44);
  bird.setData('airHazard', true);
  bird.setData('funPatternKind', 'single');
  bird.setData('funPatternGroupId', 1_000_000 + ++state.nextAirGroupId);
  bird.setData('funPatternIndex', 0);
  bird.setData('funPatternLast', true);
  bird.setData('funObstacleSkin', 'obstacle_bird');
  scene.obstacles.add(bird);

  const baseScaleY = bird.scaleY;
  scene.tweens.add({
    targets: bird,
    y: y - 10,
    scaleY: baseScaleY * 0.84,
    duration: 220,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  // A clear warning makes the new timing choice readable: stay low under the
  // bird instead of automatically jumping at every obstacle.
  const warning = scene.add.text(620, scene.groundY - 315, 'CHIRP!', {
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '34px',
    fontStyle: '900',
    color: '#fff45c',
    stroke: '#24304a',
    strokeThickness: 7,
  }).setOrigin(0.5).setDepth(35).setScale(0.55);
  scene.tweens.add({
    targets: warning,
    scale: 1,
    y: warning.y - 18,
    duration: 180,
    ease: 'Back.easeOut',
    onComplete: () => scene.tweens.add({
      targets: warning,
      alpha: 0,
      delay: 330,
      duration: 180,
      onComplete: () => warning.destroy(),
    }),
  });

  // Bones beneath the bird visually teach the safe route without adding text.
  if (typeof scene.spawnTreat === 'function') {
    scene.spawnTreat(x - 58, scene.groundY - 78);
    scene.spawnTreat(x + 42, scene.groundY - 78);
  }

  const history = (scene.recentPatternHistory ?? []) as PatternKind[];
  history.push('single');
  if (history.length > 5) history.shift();
  scene.recentPatternHistory = history;

  // Do not spawn a ground hurdle until the bird has safely passed the corgi.
  const speed = Math.max(340, Number(scene.gameSpeed) || 340);
  scene.lastSpawnX = 720 + Math.max(980, speed * 1.5);
  state.birdCooldown = 2;
}

/**
 * Makes every ground obstacle visually random from the first hurdle while
 * preserving the validated dimensions and collision boxes. It also introduces
 * rare, clearly telegraphed airborne birds that replace—not combine with—a
 * ground obstacle group, so every sequence remains avoidable with one-button
 * controls.
 */
export function installObstacleVariety(GameSceneClass: { prototype: object }): void {
  if (installed) return;
  installed = true;

  const proto = GameSceneClass.prototype as any;

  const originalCreate = proto.create;
  proto.create = function (...args: unknown[]) {
    const result = originalCreate.apply(this, args);
    buildBirdTexture(this);
    states.set(this, { birdCooldown: 0, nextAirGroupId: 0, lastGroundSkin: null });
    return result;
  };

  const originalSpawnNext = proto.spawnNext;
  proto.spawnNext = function (...args: unknown[]) {
    const state = stateFor(this);
    if (this.textures?.exists?.('obstacle_bird') && canSpawnBird(this, state)) {
      spawnBird(this, state);
      return;
    }

    const before = this.obstacles?.getChildren?.().length ?? 0;
    const result = originalSpawnNext.apply(this, args);
    const all = this.obstacles?.getChildren?.() ?? [];
    const spawned = all.slice(before).filter((object: any) => object?.active);
    randomizeGroundGroup(this, spawned, state);
    state.birdCooldown = Math.max(0, state.birdCooldown - 1);
    return result;
  };
}
