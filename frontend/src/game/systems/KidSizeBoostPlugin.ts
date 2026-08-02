import Phaser from 'phaser';

type SceneClass = { prototype: Record<string, any> };

type KidSprite = Phaser.GameObjects.Sprite & {
  hitRect?: Phaser.Geom.Rectangle;
};

const KID_SCALE_MULTIPLIER = 1.5;
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

  kid
    .setOrigin(0.5, 1)
    .setDisplaySize(
      originalWidth * KID_SCALE_MULTIPLIER,
      originalHeight * KID_SCALE_MULTIPLIER,
    );

  // Make the artwork 50% larger without making the obstacle unfair. The
  // collision area remains based on the previous size and stays centered on
  // the child's body rather than expanding to the full new silhouette.
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
 * Final post-spawn pass that makes both supplied kid obstacles exactly 50%
 * larger in every single, double, and triple group while preserving fair
 * pre-boost collision dimensions.
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
