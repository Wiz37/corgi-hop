import Phaser from 'phaser';

type SceneClass = { prototype: Record<string, any> };

type KidSprite = Phaser.GameObjects.Sprite & {
  hitRect?: Phaser.Geom.Rectangle;
};

const KID_SCALE_MULTIPLIER = 1.5;
const MIN_VISIBLE_KID_HEIGHT = 160;
const MAX_VISIBLE_KID_HEIGHT = 190;
const KID_GAMEPLAY_DEPTH = 23;
let installed = false;

function isKidObstacle(object: any): object is KidSprite {
  const skin = object?.getData?.('funObstacleSkin');
  return object?.active
    && !object.getData?.('airHazard')
    && (object.getData?.('kidObstacle') || skin === 'obstacle_boy' || skin === 'obstacle_girl');
}

function enlargeKidObstacle(kid: KidSprite): void {
  if (kid.getData('kidSizeBoostApplied')) return;

  const originalWidth = Math.max(1, Number(kid.displayWidth) || 1);
  const originalHeight = Math.max(1, Number(kid.displayHeight) || 1);
  const aspect = originalWidth / originalHeight;

  // The previous implementation multiplied the generated fence height. A
  // short 70 px hurdle therefore created a child only about 105 px tall,
  // which looked like a tiny background decoration. Give both children a
  // consistent, clearly readable gameplay size instead.
  const visibleHeight = Phaser.Math.Clamp(
    originalHeight * KID_SCALE_MULTIPLIER,
    MIN_VISIBLE_KID_HEIGHT,
    MAX_VISIBLE_KID_HEIGHT,
  );
  const visibleWidth = visibleHeight * aspect;

  kid
    .setOrigin(0.5, 1)
    .setDisplaySize(visibleWidth, visibleHeight)
    .setDepth(KID_GAMEPLAY_DEPTH)
    .setAlpha(1)
    .setFlipX(false)
    .setAngle(0)
    .clearTint();

  // Keep collision based on the original validated hurdle dimensions. The
  // larger artwork is easier to see, but the required jump remains fair.
  const hitWidth = Math.max(26, originalWidth * 0.72);
  const hitHeight = originalHeight * 0.82;
  kid.hitRect = new Phaser.Geom.Rectangle(
    -hitWidth / 2,
    -hitHeight,
    hitWidth,
    hitHeight,
  );

  kid.setData('kidSizeBoostApplied', true);
}

/**
 * Final post-spawn pass that gives both supplied kid obstacles a consistent
 * visible size in every single, double, and triple group while preserving the
 * validated pre-boost collision dimensions.
 */
export function installKidSizeBoost(GameSceneClass: SceneClass): void {
  if (installed) return;
  installed = true;

  const prototype = GameSceneClass.prototype;
  const previousSpawnNext = prototype.spawnNext;
  prototype.spawnNext = function spawnWithLargerKids(
    this: Record<string, any>,
    ...args: unknown[]
  ): unknown {
    const before = this.obstacles?.getChildren?.().length ?? 0;
    const result = previousSpawnNext.apply(this, args);
    const children = this.obstacles?.getChildren?.() ?? [];

    for (const object of children.slice(before)) {
      if (isKidObstacle(object)) enlargeKidObstacle(object);
    }

    return result;
  };
}
