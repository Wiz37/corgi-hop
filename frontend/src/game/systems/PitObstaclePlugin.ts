import Phaser from 'phaser';

interface PitState {
  lastGroupWasPit: boolean;
}

const states = new WeakMap<object, PitState>();
let installed = false;

function stateFor(scene: object): PitState {
  let state = states.get(scene);
  if (!state) {
    state = { lastGroupWasPit: false };
    states.set(scene, state);
  }
  return state;
}

function buildPitTexture(scene: any): void {
  const key = 'obstacle_pit';
  if (scene.textures.exists(key)) return;

  const width = 300;
  const height = 126;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  // Dirt cliff faces on both sides.
  g.fillStyle(0x24304a, 1);
  g.fillRoundedRect(4, 26, 86, 84, 14);
  g.fillRoundedRect(width - 90, 26, 86, 84, 14);
  g.fillStyle(0x7a4b29, 1);
  g.fillRoundedRect(10, 32, 76, 74, 11);
  g.fillRoundedRect(width - 86, 32, 76, 74, 11);

  // Deep hole with a subtle inner rim.
  g.fillStyle(0x07101d, 1);
  g.fillEllipse(width / 2, 82, 196, 62);
  g.fillStyle(0x10263a, 1);
  g.fillEllipse(width / 2, 73, 168, 38);
  g.fillStyle(0x050910, 1);
  g.fillEllipse(width / 2, 84, 144, 34);

  // Grass lips make the takeoff and landing edges readable.
  g.fillStyle(0x24304a, 1);
  g.fillRoundedRect(0, 14, 98, 30, 13);
  g.fillRoundedRect(width - 98, 14, 98, 30, 13);
  g.fillStyle(0x6bc45f, 1);
  g.fillRoundedRect(5, 18, 91, 22, 10);
  g.fillRoundedRect(width - 96, 18, 91, 22, 10);
  g.fillStyle(0xa1e58f, 0.9);
  g.fillRoundedRect(10, 20, 81, 7, 4);
  g.fillRoundedRect(width - 91, 20, 81, 7, 4);

  // Small cracks in the cliff faces.
  g.lineStyle(4, 0x4c2d19, 0.9);
  g.beginPath();
  g.moveTo(48, 45); g.lineTo(57, 59); g.lineTo(50, 75);
  g.moveTo(width - 48, 45); g.lineTo(width - 59, 61); g.lineTo(width - 51, 78);
  g.strokePath();

  g.generateTexture(key, width, height);
  g.destroy();
}

function pitChanceForScore(score: number): number {
  if (score < 8) return 0;
  if (score < 25) return 0.10;
  if (score < 60) return 0.14;
  return 0.18;
}

function convertToPit(scene: any, obstacle: any): void {
  const originalWidth = Math.max(56, Number(obstacle.displayWidth) || 90);
  const previousHit = obstacle.hitRect as Phaser.Geom.Rectangle | undefined;
  const previousCollisionWidth = Math.max(42, Number(previousHit?.width) || originalWidth * 0.82);
  const visualWidth = Math.max(104, Math.min(154, originalWidth + 34));

  obstacle.setTexture('obstacle_pit');
  obstacle.setOrigin(0.5, 1);
  obstacle.setDisplaySize(visualWidth, 86);
  obstacle.y = Number(scene.groundY) + 6;
  obstacle.setDepth(8);
  obstacle.setAlpha(1);
  obstacle.clearTint?.();

  // The pit collision is never wider than the original validated obstacle.
  // It is also very shallow, so any normal approved jump clears it easily.
  const collisionWidth = Math.min(previousCollisionWidth, visualWidth * 0.70);
  obstacle.hitRect = new Phaser.Geom.Rectangle(
    -collisionWidth / 2,
    -42,
    collisionWidth,
    46,
  );

  obstacle.setData('funObstacleSkin', 'obstacle_pit');
  obstacle.setData('pitObstacle', true);
  obstacle.setData('characterObstacle', false);
}

/**
 * Adds occasional cliffs/holes by reskinning only complete validated SINGLE
 * groups. Birds, children, the mean dog, doubles, and triples are never altered.
 */
export function installPitObstacles(GameSceneClass: { prototype: object }): void {
  if (installed) return;
  installed = true;

  const proto = GameSceneClass.prototype as any;

  const originalCreate = proto.create;
  if (typeof originalCreate === 'function') {
    proto.create = function (...args: unknown[]) {
      const result = originalCreate.apply(this, args);
      buildPitTexture(this);
      states.set(this, { lastGroupWasPit: false });
      return result;
    };
  }

  const originalSpawnNext = proto.spawnNext;
  if (typeof originalSpawnNext !== 'function') return;

  proto.spawnNext = function (...args: unknown[]) {
    const before = this.obstacles?.getChildren?.().length ?? 0;
    const result = originalSpawnNext.apply(this, args);
    const all = this.obstacles?.getChildren?.() ?? [];
    const spawned = all.slice(before).filter((object: any) => object?.active);
    const state = stateFor(this);

    const eligible = spawned.filter((object: any) =>
      !object.getData?.('airHazard')
      && !object.getData?.('characterObstacle')
      && !object.getData?.('pitObstacle'),
    );

    const score = Math.max(0, Number(this.score) || 0);
    const isSafeSingleGroup = spawned.length === 1 && eligible.length === 1;
    const shouldConvert = isSafeSingleGroup
      && !state.lastGroupWasPit
      && this.textures?.exists?.('obstacle_pit')
      && Math.random() < pitChanceForScore(score);

    if (shouldConvert) {
      convertToPit(this, eligible[0]);
      state.lastGroupWasPit = true;
    } else {
      state.lastGroupWasPit = false;
    }

    return result;
  };
}
