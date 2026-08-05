import Phaser from 'phaser';
import { CORGIS, gameState } from './GameState';

type SceneClass = { prototype: Record<string, any> };
type Pose = 'run' | 'jump' | 'fall' | 'land' | 'hit';

interface RuntimeCorgiDef {
  id: string;
  texture: string;
  textureFrame?: number;
  runFrame?: number;
  runSheetKey?: string;
  runAnimKey?: string;
  jumpFrame?: number;
  fallFrame?: number;
  landFrame?: number;
}

const CORGI_ID = 'heeler_lifeguard';
const STORE_TEXTURE_KEY = 'heeler_lifeguard_store';
const RUN_SHEET_KEY = 'heeler_lifeguard_run_sheet';
const RUN_ANIMATION_KEY = 'heeler_lifeguard_verified_run';
const BASE_FRAME = 0;
const RUN_FRAME_OFFSETS = [0, 1, 2, 3, 4, 5, 6, 7];
const ACTOR_DEPTH = 30;
// All frames in the shipped atlas are 80×80. The dedicated airborne slots
// (offsets 4–6) contain cropped drawings with missing legs, so Heeler uses
// complete frames from the supplied eight-frame running sheet for every pose.
const FRAME_BASELINE = 1;
const JUMP_FRAME_OFFSET = 1;
const FALL_FRAME_OFFSET = 2;
const LAND_FRAME_OFFSET = 3;
let installed = false;
let ready = false;

function isSelected(): boolean {
  return String((gameState as any).selectedCorgi ?? 'classic') === CORGI_ID;
}

function definition(): RuntimeCorgiDef | undefined {
  return (CORGIS as unknown as RuntimeCorgiDef[])
    .find((candidate) => candidate.id === CORGI_ID);
}

function configureDefinition(): void {
  const def = definition();
  if (!def) return;

  def.texture = STORE_TEXTURE_KEY;
  def.textureFrame = BASE_FRAME;
  def.runFrame = BASE_FRAME;
  def.runSheetKey = RUN_SHEET_KEY;
  def.runAnimKey = RUN_ANIMATION_KEY;
  def.jumpFrame = BASE_FRAME + JUMP_FRAME_OFFSET;
  def.fallFrame = BASE_FRAME + FALL_FRAME_OFFSET;
  def.landFrame = BASE_FRAME + LAND_FRAME_OFFSET;
}

function registerAnimation(scene: Phaser.Scene): void {
  if (scene.anims.exists(RUN_ANIMATION_KEY)) {
    scene.anims.remove(RUN_ANIMATION_KEY);
  }

  scene.anims.create({
    key: RUN_ANIMATION_KEY,
    frames: RUN_FRAME_OFFSETS.map((offset) => ({
      key: RUN_SHEET_KEY,
      frame: BASE_FRAME + offset,
    })),
    frameRate: 14,
    repeat: -1,
  });
}

function applyFrame(
  scene: Phaser.Scene & Record<string, any>,
  frame: number,
): Phaser.Physics.Arcade.Sprite | undefined {
  const corgi = scene.corgi as Phaser.Physics.Arcade.Sprite | undefined;
  if (!corgi || !scene.textures.exists(RUN_SHEET_KEY)) return undefined;

  const alreadyShowing =
    corgi.texture?.key === RUN_SHEET_KEY
    && String(corgi.frame?.name) === String(frame);

  if (!alreadyShowing) {
    corgi.setTexture(RUN_SHEET_KEY, frame);
    if (typeof scene.sizeCorgiUniform === 'function') {
      scene.sizeCorgiUniform();
    }
  }

  // The supplied gameplay frames are 384×512. Bottom anchoring keeps the complete full-body
  // frame on the physics baseline. A high final depth keeps the dog above
  // trees, bushes, path artwork, and foreground foliage.
  corgi.clearMask();
  corgi.setOrigin(0.5, FRAME_BASELINE);
  corgi.setDepth(ACTOR_DEPTH);
  corgi.setVisible(true);
  corgi.setAlpha(1);
  corgi.setFlipX(false);
  corgi.setAngle(0);
  corgi.clearTint();
  corgi.setBlendMode(Phaser.BlendModes.NORMAL);
  return corgi;
}

function playRun(scene: Phaser.Scene & Record<string, any>): void {
  const corgi = applyFrame(scene, BASE_FRAME);
  if (!corgi || !scene.anims.exists(RUN_ANIMATION_KEY)) return;

  scene.runTexKey = RUN_SHEET_KEY;
  scene.runAnimKey = RUN_ANIMATION_KEY;

  const wrongAnimation = corgi.anims.currentAnim?.key !== RUN_ANIMATION_KEY;
  if (!corgi.anims.isPlaying || wrongAnimation) {
    corgi.play(RUN_ANIMATION_KEY, true);
  }
}

/**
 * First one-at-a-time premium-corgi repair.
 *
 * Heeler Lifeguard exclusively uses its own full-body atlas row for the store,
 * eight-frame running, jump, fall, and landing. This is installed after every
 * shared animation wrapper, so no global fallback can replace it with a still
 * portrait or move its visible paw baseline above the running path.
 */
export function installHeelerLifeguardFix(
  PreloadSceneClass: SceneClass,
  GameSceneClass: SceneClass,
): void {
  if (installed) return;
  installed = true;

  const preloadPrototype = PreloadSceneClass.prototype;
  const previousPreloadCreate = preloadPrototype.create;
  preloadPrototype.create = function createVerifiedHeelerAnimation(
    this: Phaser.Scene,
    ...args: any[]
  ): any {
    const result = previousPreloadCreate.apply(this, args);
    ready = false;

    if (!this.textures.exists(ATLAS_KEY)) {
      console.error('[Corgi Hop] Heeler Lifeguard gameplay atlas is unavailable.');
      return result;
    }

    try {
      registerAnimation(this);
      configureDefinition();
      ready = true;
    } catch (error) {
      console.error('[Corgi Hop] Heeler Lifeguard setup failed.', error);
    }

    return result;
  };

  const gamePrototype = GameSceneClass.prototype;
  const previousGameCreate = gamePrototype.create;
  gamePrototype.create = function createWithVerifiedHeeler(
    this: Phaser.Scene & Record<string, any>,
    ...args: any[]
  ): any {
    if (ready && isSelected()) configureDefinition();
    const result = previousGameCreate.apply(this, args);

    if (ready && isSelected()) {
      playRun(this);
    }

    return result;
  };

  const previousSetPose = gamePrototype.setPose;
  gamePrototype.setPose = function setVerifiedHeelerPose(
    this: Phaser.Scene & Record<string, any>,
    pose: Pose,
  ): void {
    if (!ready || !isSelected()) {
      previousSetPose.call(this, pose);
      return;
    }

    if (pose === 'hit') {
      previousSetPose.call(this, pose);
      return;
    }

    this.runTexKey = ATLAS_KEY;
    this.runAnimKey = RUN_ANIMATION_KEY;

    if (pose === 'run') {
      playRun(this);
      return;
    }

    const corgi = this.corgi as Phaser.Physics.Arcade.Sprite | undefined;
    corgi?.anims.stop();

    const frame = pose === 'jump'
      ? BASE_FRAME + JUMP_FRAME_OFFSET
      : pose === 'fall'
        ? BASE_FRAME + FALL_FRAME_OFFSET
        : BASE_FRAME + LAND_FRAME_OFFSET;

    applyFrame(this, frame);
  };
}
