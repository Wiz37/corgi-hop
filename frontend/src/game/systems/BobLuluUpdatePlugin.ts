import Phaser from 'phaser';
import { CORGIS, gameState } from './GameState';
import {
  BOB_STORE_PORTRAIT_DATA_URI,
  LULU_STORE_PORTRAIT_DATA_URI,
} from '../assets/BobLuluStorePortraits';

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

interface FocusedCorgi {
  id: 'pilot_bob' | 'princess_lulu';
  storeTextureKey: string;
  storeDataUri: string;
  sourceRow: number;
  runAnimKey: string;
}

// GameplayAnimationPlugin already preloads this atlas. Rows 12 and 13 contain
// Bob and Lulu's four genuinely different run drawings plus jump/fall/land.
const GAMEPLAY_ATLAS_KEY = 'corgi_gameplay_atlas_20260801';
const FRAMES_PER_CORGI = 7;
const RUN_FRAME_COUNT = 4;

const FOCUSED_CORGIS: FocusedCorgi[] = [
  {
    id: 'pilot_bob',
    storeTextureKey: 'pilot_bob_store_standalone_20260801',
    storeDataUri: BOB_STORE_PORTRAIT_DATA_URI,
    sourceRow: 12,
    runAnimKey: 'pilot_bob_true_run_20260801',
  },
  {
    id: 'princess_lulu',
    storeTextureKey: 'princess_lulu_store_standalone_20260801',
    storeDataUri: LULU_STORE_PORTRAIT_DATA_URI,
    sourceRow: 13,
    runAnimKey: 'princess_lulu_true_run_20260801',
  },
];

const FOCUSED_BY_ID = new Map(FOCUSED_CORGIS.map((focused) => [focused.id, focused]));
let installed = false;
let gameplayReady = false;

function baseFrame(focused: FocusedCorgi): number {
  return focused.sourceRow * FRAMES_PER_CORGI;
}

function selectedFocusedCorgi(): FocusedCorgi | undefined {
  const selectedId = String(
    (gameState as any).selectedCorgi ?? 'classic',
  ) as FocusedCorgi['id'];
  return FOCUSED_BY_ID.get(selectedId);
}

function storePortraitsReady(scene: Phaser.Scene): boolean {
  return FOCUSED_CORGIS.every((focused) => scene.textures.exists(focused.storeTextureKey));
}

function configureStoreDefinitions(): void {
  const definitions = CORGIS as unknown as RuntimeCorgiDef[];

  for (const focused of FOCUSED_CORGIS) {
    const definition = definitions.find((candidate) => candidate.id === focused.id);
    if (!definition) continue;

    // Store cards always use the clean standalone portraits—not gameplay frames.
    definition.texture = focused.storeTextureKey;
    definition.textureFrame = 0;
  }
}

function configureGameplayDefinitions(): void {
  const definitions = CORGIS as unknown as RuntimeCorgiDef[];

  for (const focused of FOCUSED_CORGIS) {
    const definition = definitions.find((candidate) => candidate.id === focused.id);
    if (!definition) continue;

    const base = baseFrame(focused);
    definition.runFrame = base;
    definition.runSheetKey = GAMEPLAY_ATLAS_KEY;
    definition.runAnimKey = focused.runAnimKey;
    definition.jumpFrame = base + 4;
    definition.fallFrame = base + 5;
    definition.landFrame = base + 6;
  }
}

function registerTrueRunAnimations(scene: Phaser.Scene): void {
  for (const focused of FOCUSED_CORGIS) {
    if (scene.anims.exists(focused.runAnimKey)) scene.anims.remove(focused.runAnimKey);

    const base = baseFrame(focused);
    scene.anims.create({
      key: focused.runAnimKey,
      frames: Array.from({ length: RUN_FRAME_COUNT }, (_, offset) => ({
        key: GAMEPLAY_ATLAS_KEY,
        frame: base + offset,
      })),
      frameRate: 12,
      repeat: -1,
    });
  }
}

function applyVisualState(
  scene: Phaser.Scene & Record<string, any>,
  frame: number,
): void {
  const corgi = scene.corgi as Phaser.Physics.Arcade.Sprite | undefined;
  if (!corgi) return;

  const alreadyShowing =
    corgi.texture?.key === GAMEPLAY_ATLAS_KEY && String(corgi.frame?.name) === String(frame);

  if (!alreadyShowing) {
    corgi.setTexture(GAMEPLAY_ATLAS_KEY, frame);
    if (typeof scene.sizeCorgiUniform === 'function') scene.sizeCorgiUniform();
  }

  corgi.setFlipX(false);
  corgi.setAngle(0);
  corgi.clearTint();
  corgi.setAlpha(1);
  corgi.setBlendMode(Phaser.BlendModes.NORMAL);
}

/**
 * Focused Bob/Lulu patch:
 * - preserves their standalone store portraits;
 * - replaces the duplicated/squashed pseudo-eight-frame motion with four
 *   genuinely different illustrated stride frames;
 * - uses dedicated jump, fall, and landing artwork from the same atlas.
 */
export function installBobLuluUpdate(
  PreloadSceneClass: SceneClass,
  CorgiSelectSceneClass: SceneClass,
  GameSceneClass: SceneClass,
): void {
  if (installed) return;
  installed = true;

  const preloadPrototype = PreloadSceneClass.prototype;
  const previousPreload = preloadPrototype.preload;
  preloadPrototype.preload = function preloadBobAndLuluPortraits(this: Phaser.Scene): void {
    previousPreload.call(this);

    for (const focused of FOCUSED_CORGIS) {
      this.load.image(focused.storeTextureKey, focused.storeDataUri);
    }
  };

  const previousPreloadCreate = preloadPrototype.create;
  preloadPrototype.create = function createBobAndLuluAssets(this: Phaser.Scene): any {
    const result = previousPreloadCreate.call(this);

    if (storePortraitsReady(this)) {
      configureStoreDefinitions();
    } else {
      console.error('[Corgi Hop] Standalone Bob/Lulu store portraits failed to load.');
    }

    gameplayReady = false;
    if (!this.textures.exists(GAMEPLAY_ATLAS_KEY)) {
      console.error('[Corgi Hop] Bob/Lulu source gameplay atlas is unavailable.');
      return result;
    }

    try {
      registerTrueRunAnimations(this);
      configureGameplayDefinitions();
      gameplayReady = true;
    } catch (error) {
      console.error('[Corgi Hop] Bob/Lulu gameplay animation setup failed.', error);
    }

    return result;
  };

  // Reassert clean standalone portrait keys immediately before every store render.
  const selectPrototype = CorgiSelectSceneClass.prototype;
  const previousSelectCreate = selectPrototype.create;
  selectPrototype.create = function createStoreWithCleanBobLulu(
    this: Phaser.Scene & Record<string, any>,
    ...args: any[]
  ): any {
    if (storePortraitsReady(this)) configureStoreDefinitions();
    return previousSelectCreate.apply(this, args);
  };

  // Installed after GameplayAnimationPlugin, so this final wrapper wins only for
  // Bob and Lulu while every other corgi keeps its existing gameplay behavior.
  const gamePrototype = GameSceneClass.prototype;
  const previousGameCreate = gamePrototype.create;
  gamePrototype.create = function createWithTrueBobLuluRun(
    this: Phaser.Scene & Record<string, any>,
    ...args: any[]
  ): any {
    const result = previousGameCreate.apply(this, args);
    const focused = selectedFocusedCorgi();
    const corgi = this.corgi as Phaser.Physics.Arcade.Sprite | undefined;

    if (!focused || !gameplayReady || !corgi || !this.textures.exists(GAMEPLAY_ATLAS_KEY)) {
      return result;
    }

    configureGameplayDefinitions();
    const base = baseFrame(focused);
    this.runTexKey = GAMEPLAY_ATLAS_KEY;
    this.runAnimKey = focused.runAnimKey;

    corgi.anims.stop();
    applyVisualState(this, base);
    if (this.anims.exists(focused.runAnimKey)) corgi.play(focused.runAnimKey);
    return result;
  };

  const previousSetPose = gamePrototype.setPose;
  gamePrototype.setPose = function setTrueBobLuluPose(
    this: Phaser.Scene & Record<string, any>,
    pose: Pose,
  ): void {
    const focused = selectedFocusedCorgi();
    const corgi = this.corgi as Phaser.Physics.Arcade.Sprite | undefined;

    if (!focused || !gameplayReady || !corgi || !this.textures.exists(GAMEPLAY_ATLAS_KEY)) {
      previousSetPose.call(this, pose);
      return;
    }

    // Keep the existing approved BONK/crash presentation.
    if (pose === 'hit') {
      previousSetPose.call(this, pose);
      return;
    }

    const base = baseFrame(focused);
    if (pose === 'run') {
      this.runTexKey = GAMEPLAY_ATLAS_KEY;
      this.runAnimKey = focused.runAnimKey;
      applyVisualState(this, base);
      const wrongAnimation = corgi.anims.currentAnim?.key !== focused.runAnimKey;
      if (this.anims.exists(focused.runAnimKey)
        && (!corgi.anims.isPlaying || wrongAnimation)) {
        corgi.play(focused.runAnimKey);
      }
      return;
    }

    corgi.anims.stop();
    const frame = pose === 'jump' ? base + 4 : pose === 'fall' ? base + 5 : base + 6;
    applyVisualState(this, frame);
  };
}
