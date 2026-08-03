import Phaser from 'phaser';

type SceneClass = { prototype: Record<string, any> };

const FILL_EMPTY_GROUP_CHANCE = 0.58;
const TWO_BONE_CLUSTER_CHANCE = 0.35;
const BONE_SPACING = 72;
let installed = false;

function rightEdge(object: any): number {
  const x = Number(object?.x) || 0;
  const width = Math.max(0, Number(object?.displayWidth) || 0);
  return x + width / 2;
}

/**
 * Raises the effective Bone-bearing obstacle-group rate from roughly 30% to
 * about 70%. The original spawn is preserved; this pass only fills groups
 * where the base game did not already create a Bone cluster.
 *
 * Extra Bones are placed after the newly spawned obstacle group and before
 * the following runway, so they never overlap a fence, kid, or hawk.
 */
export function installFrequentBones(GameSceneClass: SceneClass): void {
  if (installed) return;
  installed = true;

  const prototype = GameSceneClass.prototype;
  const previousSpawnNext = prototype.spawnNext;
  if (typeof previousSpawnNext !== 'function') return;

  prototype.spawnNext = function spawnWithMoreBones(
    this: Record<string, any>,
    ...args: unknown[]
  ): unknown {
    const treatsBefore = new Set(this.treats?.getChildren?.() ?? []);
    const obstaclesBefore = new Set(this.obstacles?.getChildren?.() ?? []);

    const result = previousSpawnNext.apply(this, args);

    if (typeof this.spawnTreat !== 'function') return result;

    const treatsAfter: any[] = this.treats?.getChildren?.() ?? [];
    const baseGameAlreadySpawnedBones = treatsAfter.some((treat) => !treatsBefore.has(treat));
    if (baseGameAlreadySpawnedBones || Math.random() >= FILL_EMPTY_GROUP_CHANCE) {
      return result;
    }

    const newObstacles: any[] = (this.obstacles?.getChildren?.() ?? [])
      .filter((obstacle: any) => obstacle?.active && !obstaclesBefore.has(obstacle));

    const screenWidth = Math.max(720, Number(this.scale?.width) || 720);
    const obstacleRight = newObstacles.reduce(
      (maximum: number, obstacle: any) => Math.max(maximum, rightEdge(obstacle)),
      screenWidth + 80,
    );

    const count = Math.random() < TWO_BONE_CLUSTER_CHANCE ? 2 : 1;
    const idealStartX = obstacleRight + 90;
    const nextSpawnX = Number(this.lastSpawnX);
    const runwayLimit = Number.isFinite(nextSpawnX)
      ? nextSpawnX - 150 - (count - 1) * BONE_SPACING
      : idealStartX;
    const startX = Math.min(idealStartX, runwayLimit);

    // Skip this optional cluster if a custom obstacle layout left no clean
    // runway. Never trade fairness for a pickup.
    if (startX < obstacleRight + 35) return result;

    const groundY = Number(this.groundY) || 900;
    for (let index = 0; index < count; index++) {
      const x = startX + index * BONE_SPACING;
      const arcLift = index % 2 === 0 ? 0 : 34;
      const y = groundY - 112 - arcLift - Phaser.Math.Between(0, 24);
      this.spawnTreat(x, y);
    }

    return result;
  };
}
