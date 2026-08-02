import Phaser from 'phaser';
import {
  HAWK_OBSTACLE_ASPECT,
  HAWK_OBSTACLE_DATA_URI,
} from '../assets/HawkObstacle';

type SceneClass = { prototype: Record<string, any> };

const HAWK_TEXTURE_KEY = 'obstacle_hawk_exact_20260802';
const HAWK_DISPLAY_WIDTH = 172;
const HAWK_DISPLAY_HEIGHT = HAWK_DISPLAY_WIDTH / HAWK_OBSTACLE_ASPECT;

let installed = false;

function replaceBirdWarning(scene: Phaser.Scene & Record<string, any>): void {
  const warning = [...(scene.children?.list ?? [])]
    .reverse()
    .find((object: any) => object?.type === 'Text' && object.text === 'CHIRP!') as
      | Phaser.GameObjects.Text
      | undefined;

  if (!warning) return;

  warning
    .setText('SCREEEEEECH!')
    .setFontSize(30)
    .setPosition(500, scene.groundY - 315)
    .setOrigin(0.5)
    .setDepth(35);
}

function turnAirHazardIntoHawk(
  scene: Phaser.Scene & Record<string, any>,
  obstacle: Phaser.GameObjects.Sprite,
): void {
  if (!scene.textures.exists(HAWK_TEXTURE_KEY)) return;

  // Keep the hawk high enough that a grounded corgi has a comfortable visual
  // and collision gap, making the intended action clearly "run underneath."
  obstacle
    .setTexture(HAWK_TEXTURE_KEY)
    .setOrigin(0.5)
    .setDisplaySize(HAWK_DISPLAY_WIDTH, HAWK_DISPLAY_HEIGHT)
    .setPosition(obstacle.x, scene.groundY - Phaser.Math.Between(232, 246))
    .setFlipX(false)
    .setAngle(0)
    .setAlpha(1)
    .clearTint();

  // The collision box covers the hawk's central body and inner wings rather
  // than the full decorative wingspan, so near-misses remain fair.
  (obstacle as Phaser.GameObjects.Sprite & { hitRect?: Phaser.Geom.Rectangle }).hitRect =
    new Phaser.Geom.Rectangle(-61, -21, 122, 42);

  obstacle.setData('funObstacleSkin', 'obstacle_hawk');
  obstacle.setData('hawkObstacle', true);
}

/**
 * Replaces the existing airborne bird hazard with the supplied cartoon hawk.
 * The existing safe spawn cadence is preserved, while the warning changes to
 * "SCREEEEEECH!" and the player is expected to stay grounded and run under it.
 */
export function installHawkObstacle(
  PreloadSceneClass: SceneClass,
  GameSceneClass: SceneClass,
): void {
  if (installed) return;
  installed = true;

  const preloadPrototype = PreloadSceneClass.prototype;
  const previousPreload = preloadPrototype.preload;
  preloadPrototype.preload = function preloadHawkObstacle(this: Phaser.Scene): void {
    previousPreload.call(this);
    this.load.image(HAWK_TEXTURE_KEY, HAWK_OBSTACLE_DATA_URI);
  };

  const gamePrototype = GameSceneClass.prototype;
  const previousSpawnNext = gamePrototype.spawnNext;
  gamePrototype.spawnNext = function spawnNextWithHawk(
    this: Phaser.Scene & Record<string, any>,
    ...args: any[]
  ): any {
    const before = this.obstacles?.getChildren?.().length ?? 0;
    const result = previousSpawnNext.apply(this, args);
    const children = this.obstacles?.getChildren?.() ?? [];
    const spawned = children.slice(before).filter((object: any) => object?.active);

    const airHazard = spawned.find((object: any) => object.getData?.('airHazard')) as
      | Phaser.GameObjects.Sprite
      | undefined;

    if (airHazard) {
      turnAirHazardIntoHawk(this, airHazard);
      replaceBirdWarning(this);
    }

    return result;
  };
}
