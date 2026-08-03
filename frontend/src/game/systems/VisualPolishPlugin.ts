import Phaser from 'phaser';

const RUN_TEXTURE_KEYS = [
  'corgi_run',
  'starter_run',
  'cowboy_run',
  'superhero_run',
  'pirate_run',
  'astronaut_run',
] as const;

const GAMEPLAY_CORGI_DEPTH = 24;
let installed = false;

function sharpenRunSheets(scene: any): void {
  for (const key of RUN_TEXTURE_KEYS) {
    if (!scene?.textures?.exists?.(key)) continue;
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
}

function replaceDamagedTreeArtwork(scene: any): void {
  if (!scene?.textures?.exists?.('tree_right')) return;

  for (const child of scene.children?.list ?? []) {
    if (child?.texture?.key !== 'tree_left' || typeof child.setTexture !== 'function') continue;

    const displayWidth = Math.max(1, Number(child.displayWidth) || 1);
    const displayHeight = Math.max(1, Number(child.displayHeight) || 1);
    child.setTexture('tree_right');
    child.setDisplaySize(displayWidth, displayHeight);
    child.setFlipX(true);
    child.setAlpha(1);
    child.clearTint?.();
  }
}

function disableContinuousCorgiTrail(scene: any): void {
  // The same emitter is still available for the intentional landing explosion,
  // but it no longer follows the corgi every frame and looks like an afterimage.
  if (!scene?.dust) return;
  scene.dust.stop?.();
  scene.dust.emitting = false;
}

function keepCorgiAboveScenery(scene: any): void {
  // The foreground foliage tile is depth 20. The player used to sit at depth
  // 15, which allowed trees/foliage to visually merge with airborne corgis.
  // Keep the player clearly readable without changing physics or collision.
  scene?.corgi?.setDepth?.(GAMEPLAY_CORGI_DEPTH);
}

function wrapCreate(SceneClass: { prototype: object }, cleanGameplayTrail: boolean): void {
  const proto = SceneClass.prototype as any;
  const originalCreate = proto.create;
  if (typeof originalCreate !== 'function') return;

  proto.create = function (...args: unknown[]) {
    const result = originalCreate.apply(this, args);
    sharpenRunSheets(this);
    replaceDamagedTreeArtwork(this);
    if (cleanGameplayTrail) {
      disableContinuousCorgiTrail(this);
      keepCorgiAboveScenery(this);
    }
    return result;
  };
}

/**
 * Removes the damaged tree texture from every rendered scene, prevents run-sheet
 * frame bleed, disables the continuous dust trail, and keeps the gameplay corgi
 * above foreground scenery while preserving jump and landing bursts.
 */
export function installVisualPolish(
  GameSceneClass: { prototype: object },
  MenuSceneClass: { prototype: object },
): void {
  if (installed) return;
  installed = true;
  wrapCreate(GameSceneClass, true);
  wrapCreate(MenuSceneClass, false);
}
