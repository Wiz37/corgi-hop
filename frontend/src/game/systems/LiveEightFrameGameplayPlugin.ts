import Phaser from 'phaser';
import { CORGIS, gameState } from './GameState';

type SceneClass = { prototype: Record<string, any> };
type Pose = 'run' | 'jump' | 'fall' | 'land' | 'hit';

interface RuntimeCorgiDef {
  id: string;
  runFrame?: number;
  runSheetKey?: string;
  runAnimKey?: string;
  tint?: number;
}

const GAMEPLAY_ACTOR_DEPTH = 24;
let installed = false;

function selectedDefinition(): RuntimeCorgiDef | undefined {
  const selectedId = String((gameState as any).selectedCorgi ?? 'classic');
  return (CORGIS as unknown as RuntimeCorgiDef[])
    .find((candidate) => candidate.id === selectedId);
}

function hasEightFrameAnimation(
  scene: Phaser.Scene,
  definition: RuntimeCorgiDef,
): definition is RuntimeCorgiDef & { runSheetKey: string; runAnimKey: string } {
  if (!definition.runSheetKey || !definition.runAnimKey) return false;
  if (!scene.textures.exists(definition.runSheetKey)) return false;
  if (!scene.anims.exists(definition.runAnimKey)) return false;

  const animation = scene.anims.get(definition.runAnimKey);
  return !!animation && animation.frames.length >= 8;
}

function forceLiveEightFrameRun(scene: Phaser.Scene & Record<string, any>): void {
  const definition = selectedDefinition();
  const corgi = scene.corgi as Phaser.Physics.Arcade.Sprite | undefined;
  if (!definition || !corgi || !hasEightFrameAnimation(scene, definition)) return;

  const textureKey = definition.runSheetKey;
  const animationKey = definition.runAnimKey;
  const firstFrame = definition.runFrame ?? 0;

  scene.runTexKey = textureKey;
  scene.runAnimKey = animationKey;

  if (corgi.texture?.key !== textureKey) {
    corgi.setTexture(textureKey, firstFrame);
    if (typeof scene.sizeCorgiUniform === 'function') scene.sizeCorgiUniform();
  }

  corgi.clearMask();
  corgi.setOrigin(0.5, 1);
  corgi.setDepth(GAMEPLAY_ACTOR_DEPTH);
  corgi.setVisible(true);
  corgi.setAlpha(1);
  corgi.setFlipX(false);
  corgi.setAngle(0);
  corgi.clearTint();
  if (definition.tint !== undefined) corgi.setTint(definition.tint);
  corgi.setBlendMode(Phaser.BlendModes.NORMAL);

  const wrongAnimation = corgi.anims.currentAnim?.key !== animationKey;
  if (!corgi.anims.isPlaying || wrongAnimation) {
    corgi.play(animationKey, true);
  }
}

/**
 * Final gameplay animation owner.
 *
 * The character store and live game now read the exact same runSheetKey and
 * runAnimKey from the selected corgi definition. Installing this after every
 * character-specific patch prevents a pose swap or legacy portrait override
 * from leaving the playable corgi on one static frame. Whenever the logical
 * pose returns to `run`, the full eight-frame cycle is restarted immediately.
 */
export function installLiveEightFrameGameplay(GameSceneClass: SceneClass): void {
  if (installed) return;
  installed = true;

  const gamePrototype = GameSceneClass.prototype;
  const previousCreate = gamePrototype.create;
  gamePrototype.create = function createWithLiveEightFrameCorgi(
    this: Phaser.Scene & Record<string, any>,
    ...args: any[]
  ): any {
    const result = previousCreate.apply(this, args);
    forceLiveEightFrameRun(this);
    return result;
  };

  const previousSetPose = gamePrototype.setPose;
  gamePrototype.setPose = function setPoseWithLiveEightFrameRun(
    this: Phaser.Scene & Record<string, any>,
    pose: Pose,
  ): void {
    previousSetPose.call(this, pose);
    if (pose === 'run') forceLiveEightFrameRun(this);
  };
}
