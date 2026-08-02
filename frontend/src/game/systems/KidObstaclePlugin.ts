import Phaser from 'phaser';
import {
  CORGI_HOP_BOY_OBSTACLE_ASPECT,
  CORGI_HOP_BOY_OBSTACLE_DATA_URI,
} from '../assets/CorgiHopBoyObstacle';
import {
  CORGI_HOP_GIRL_OBSTACLE_ASPECT,
  CORGI_HOP_GIRL_OBSTACLE_DATA_URI,
} from '../assets/CorgiHopGirlObstacle';

type SceneClass = { prototype: Record<string, any> };

type KidSkin = 'obstacle_boy' | 'obstacle_girl';

interface KidDefinition {
  key: KidSkin;
  dataUri: string;
  aspect: number;
}

const KIDS: KidDefinition[] = [
  {
    key: 'obstacle_boy',
    dataUri: CORGI_HOP_BOY_OBSTACLE_DATA_URI,
    aspect: CORGI_HOP_BOY_OBSTACLE_ASPECT,
  },
  {
    key: 'obstacle_girl',
    dataUri: CORGI_HOP_GIRL_OBSTACLE_DATA_URI,
    aspect: CORGI_HOP_GIRL_OBSTACLE_ASPECT,
  },
];

const KID_BY_KEY = new Map<KidSkin, KidDefinition>(
  KIDS.map((kid) => [kid.key, kid]),
);

let installed = false;

function fitKidObstacle(obstacle: Phaser.GameObjects.Sprite): void {
  const skin = obstacle.getData('funObstacleSkin') as KidSkin | undefined;
  if (!skin) return;

  const kid = KID_BY_KEY.get(skin);
  if (!kid || !obstacle.scene.textures.exists(kid.key)) return;

  // ObstacleVariety has already copied the validated hurdle dimensions onto
  // the sprite. Preserve that generated height, but restore the child's
  // natural aspect ratio instead of stretching the artwork into a square.
  const hurdleHeight = Math.max(70, Number(obstacle.displayHeight) || 90);
  const visualHeight = Math.min(132, hurdleHeight);
  const visualWidth = visualHeight * kid.aspect;

  obstacle
    .setTexture(kid.key)
    .setOrigin(0.5, 1)
    .setDisplaySize(visualWidth, visualHeight)
    .setAlpha(1)
    .setFlipX(false)
    .setAngle(0)
    .clearTint();

  // Use a deliberately smaller collision rectangle than the visible child.
  // This keeps the jump fair and prevents the original fence-width hitbox
  // from extending invisibly beyond the character artwork.
  const hitWidth = Math.max(26, visualWidth * 0.72);
  const hitHeight = visualHeight * 0.82;
  (obstacle as Phaser.GameObjects.Sprite & { hitRect?: Phaser.Geom.Rectangle }).hitRect =
    new Phaser.Geom.Rectangle(
      -hitWidth / 2,
      -hitHeight,
      hitWidth,
      hitHeight,
    );

  obstacle.setData('kidObstacle', true);
}

/**
 * Replaces the existing procedural boy/girl obstacle textures with the exact
 * Corgi Hop kid artwork and applies object-height scaling plus fair hitboxes.
 */
export function installKidObstacles(
  PreloadSceneClass: SceneClass,
  GameSceneClass: SceneClass,
): void {
  if (installed) return;
  installed = true;

  const preloadPrototype = PreloadSceneClass.prototype;
  const previousPreload = preloadPrototype.preload;
  preloadPrototype.preload = function preloadKidObstacles(this: Phaser.Scene): void {
    previousPreload.call(this);
    for (const kid of KIDS) {
      this.load.image(kid.key, kid.dataUri);
    }
  };

  const gamePrototype = GameSceneClass.prototype;
  const previousSpawnNext = gamePrototype.spawnNext;
  gamePrototype.spawnNext = function spawnNextWithKidArt(
    this: Phaser.Scene & Record<string, any>,
    ...args: any[]
  ): any {
    const before = this.obstacles?.getChildren?.().length ?? 0;
    const result = previousSpawnNext.apply(this, args);
    const children = this.obstacles?.getChildren?.() ?? [];

    for (const object of children.slice(before)) {
      if (!object?.active || object.getData?.('airHazard')) continue;
      fitKidObstacle(object as Phaser.GameObjects.Sprite);
    }

    return result;
  };
}
