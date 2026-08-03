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
  useStandaloneGameplay?: boolean;
}

// Bob and Lulu's shipped atlas rows can render cropped or partially transparent
// in gameplay. Both now use the same proven standalone full-body portraits that
// already render correctly in the store. The normal gameplay bounce and jump
// physics still provide motion while preserving every leg and paw.
const GAMEPLAY_ATLAS_KEY = 'corgi_gameplay_atlas_20260801';
const FRAMES_PER_CORGI = 7;
const RUN_FRAME_COUNT = 4;
const GAMEPLAY_ACTOR_DEPTH = 24;

const FOCUSED_CORGIS: FocusedCorgi[] = [
  {
    id: 'pilot_bob',
    storeTextureKey: 'pilot_bob_store_standalone_20260801',
    storeDataUri: BOB_STORE_PORTRAIT_DATA_URI,
    sourceRow: 12,
    runAnimKey: 'pilot_bob_full_body_run_20260803',
    useStandaloneGameplay: true,
  },
  {
    id: 'princess_lulu',
    storeTextureKey: 'princess_lulu_store_standalone_20260801',
    storeDataUri: LULU_STORE_PORTRAIT_DATA_URI,
    sourceRow: 13,
    runAnimKey: 'princess_lulu_full_body_run_20260803',
    useStandaloneGameplay: true,
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

function gameplayTextureKey(focused: FocusedCorgi): string {
  return focused.useStandaloneGameplay ? focused.storeTextureKey : GAMEPLAY_ATLAS_KEY;
}

function gameplayTextureReady(scene: Phaser.Scene, focused: FocusedCorgi): boolean {
  return scene.textures.exists(gameplayTextureKey(focused));
}

function configureStoreDefinitions(): void {
  const definitions = CORGIS as unknown as RuntimeCorgiDef[];

  for (const focused of FOCUSED_CORGIS) {
    const definition = definitions.find((candidate) => candidate.id === focused.id);
    if (!definition) continue;

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

    // Keep the atlas as the temporary boot sheet so GameScene can construct a
    // normal sprite with a numeric frame. The one-frame standalone animations
    // and final create wrapper replace it before either dog is rendered.
    definition.runFrame = base;
    definition.runSheetKey = GAMEPLAY_ATLAS_KEY;
    definition.runAnimKey = focused.runAnimKey;
    definition.jumpFrame = base + 4;
    definition.fallFrame = base + 5;
    definition.landFrame = base + 6;
  }
}

function registerRunAnimations(scene: Phaser.Scene): void {
  for (const focused of FOCUSED_CORGIS) {
    if (scene.anims.exists(focused.runAnimKey)) scene.anims.remove(focused.runAnimKey);

    if (focused.useStandaloneGameplay) {
      scene.anims.create({
        key: focused.runAnimKey,
        frames: [{ key: focused.storeTextureKey }],
        frameRate: 1,
        repeat: -1,
      });
      continue;
    }

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
  textureKey: string,
  frame?: number,
): void {
  const corgi = scene.corgi as Phaser.Physics.Arcade.Sprite | undefined;
  if (!corgi) return;

  const sameTexture = corgi.texture?.key === textureKey;
  const sameFrame = frame === undefined || String(corgi.frame?.name) === String(frame);

  if (!(sameTexture && sameFrame)) {
    if (frame === undefined) corgi.setTexture(textureKey);
    else corgi.setTexture(textureKey, frame);

    if (typeof scene.sizeCorgiUniform === 'function') scene.sizeCorgiUniform();
  }

  // Clear every visual state that could cause the transparent/cropped look
  // seen in TestFlight. These portraits are known-good because the store uses
  // the exact same textures successfully.
  corgi.clearMask();
  corgi.setOrigin(0.5, 1);
  corgi.setDepth(GAMEPLAY_ACTOR_DEPTH);
  corgi.setVisible(true);
  corgi.setFlipX(false);
  corgi.setAngle(0);
  corgi.clearTint();
  corgi.setAlpha(1);
  corgi.setBlendMode(Phaser.BlendModes.NORMAL);
}

/**
 * Focused Bob/Lulu patch:
 * - preserves their standalone store portraits;
 * - uses clean full-body standalone portraits for all gameplay states;
 * - prevents cropped legs, missing paws, masks, and partial transparency;
 * - keeps the existing run bounce and physical jump behavior for both dogs.
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
      console.error('[Corgi Hop] Standalone Bob/Lulu portraits failed to load.');
    }

    gameplayReady = false;
    if (!storePortraitsReady(this) || !this.textures.exists(GAMEPLAY_ATLAS_KEY)) {
      console.error('[Corgi Hop] Bob/Lulu gameplay textures are unavailable.');
      return result;
    }

    try {
      registerRunAnimations(this);
      configureGameplayDefinitions();
      gameplayReady = true;
    } catch (error) {
      console.error('[Corgi Hop] Bob/Lulu gameplay setup failed.', error);
    }

    return result;
  };

  const selectPrototype = CorgiSelectSceneClass.prototype;
  const previousSelectCreate = selectPrototype.create;
  selectPrototype.create = function createStoreWithCleanBobLulu(
    this: Phaser.Scene & Record<string, any>,
    ...args: any[]
  ): any {
    if (storePortraitsReady(this)) configureStoreDefinitions();
    return previousSelectCreate.apply(this, args);
  };

  // Installed after GameplayAnimationPlugin, so this final wrapper wins only
  // for Bob and Lulu while every other corgi keeps its existing behavior.
  const gamePrototype = GameSceneClass.prototype;
  const previousGameCreate = gamePrototype.create;
  gamePrototype.create = function createWithCleanBobAndLulu(
    this: Phaser.Scene & Record<string, any>,
    ...args: any[]
  ): any {
    const result = previousGameCreate.apply(this, args);
    const focused = selectedFocusedCorgi();
    const corgi = this.corgi as Phaser.Physics.Arcade.Sprite | undefined;

    if (!focused || !gameplayReady || !corgi || !gameplayTextureReady(this, focused)) {
      return result;
    }

    configureGameplayDefinitions();
    const textureKey = gameplayTextureKey(focused);
    const frame = focused.useStandaloneGameplay ? undefined : baseFrame(focused);
    this.runTexKey = textureKey;
    this.runAnimKey = focused.runAnimKey;

    corgi.anims.stop();
    applyVisualState(this, textureKey, frame);
    if (this.anims.exists(focused.runAnimKey)) corgi.play(focused.runAnimKey);
    return result;
  };

  const previousSetPose = gamePrototype.setPose;
  gamePrototype.setPose = function setCleanBobLuluPose(
    this: Phaser.Scene & Record<string, any>,
    pose: Pose,
  ): void {
    const focused = selectedFocusedCorgi();
    const corgi = this.corgi as Phaser.Physics.Arcade.Sprite | undefined;

    if (!focused || !gameplayReady || !corgi || !gameplayTextureReady(this, focused)) {
      previousSetPose.call(this, pose);
      return;
    }

    // Keep the existing approved BONK/crash presentation.
    if (pose === 'hit') {
      previousSetPose.call(this, pose);
      return;
    }

    const textureKey = gameplayTextureKey(focused);

    if (focused.useStandaloneGameplay) {
      this.runTexKey = textureKey;
      this.runAnimKey = focused.runAnimKey;
      applyVisualState(this, textureKey);

      if (pose === 'run') {
        const wrongAnimation = corgi.anims.currentAnim?.key !== focused.runAnimKey;
        if (this.anims.exists(focused.runAnimKey)
          && (!corgi.anims.isPlaying || wrongAnimation)) {
          corgi.play(focused.runAnimKey);
        }
      } else {
        corgi.anims.stop();
      }
      return;
    }

    const base = baseFrame(focused);
    if (pose === 'run') {
      this.runTexKey = textureKey;
      this.runAnimKey = focused.runAnimKey;
      applyVisualState(this, textureKey, base);
      const wrongAnimation = corgi.anims.currentAnim?.key !== focused.runAnimKey;
      if (this.anims.exists(focused.runAnimKey)
        && (!corgi.anims.isPlaying || wrongAnimation)) {
        corgi.play(focused.runAnimKey);
      }
      return;
    }

    corgi.anims.stop();
    const frame = pose === 'jump' ? base + 4 : pose === 'fall' ? base + 5 : base + 6;
    applyVisualState(this, textureKey, frame);
  };
}
