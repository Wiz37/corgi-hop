type SceneClass = { prototype: Record<string, any> };

let installed = false;

/**
 * Bob and Lulu now use the same eight-frame gameplay atlas path as the other
 * newer corgis. Their store cards are animated by StoreFullBodyFixPlugin from
 * those exact gameplay frames, so no standalone portrait can override or
 * replace their playable animation.
 */
export function installBobLuluUpdate(
  _PreloadSceneClass: SceneClass,
  _CorgiSelectSceneClass: SceneClass,
  _GameSceneClass: SceneClass,
): void {
  if (installed) return;
  installed = true;
}
