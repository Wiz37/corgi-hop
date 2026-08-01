import Phaser from 'phaser';
import { CORGIS, gameState } from './GameState';
import {
  BOB_LULU_FRAME_COUNT,
  BOB_LULU_FRAME_SIZE,
  BOB_LULU_SHEET_DATA_URI,
} from '../assets/BobLuluAssets';

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
  baseFrame: number;
  runAnimKey: string;
  storeTextureKey: string;
}

// Versioned keys prevent an older WebGL texture from being reused after an OTA
// or TestFlight update.
const SHEET_KEY = 'bob_lulu_sheet_20260801b';
const RUN_FRAME_COUNT = 4;
const STORE_PADDING = 18;
const FOCUSED_CORGIS: FocusedCorgi[] = [
  {
    id: 'pilot_bob',
    baseFrame: 0,
    runAnimKey: 'pilot_bob_run_20260801b',
    storeTextureKey: 'pilot_bob_store_isolated_20260801b',
  },
  {
    id: 'princess_lulu',
    baseFrame: 7,
    runAnimKey: 'princess_lulu_run_20260801b',
    storeTextureKey: 'princess_lulu_store_isolated_20260801b',
  },
];
const BY_ID = new Map(FOCUSED_CORGIS.map((entry) => [entry.id, entry]));

let installed = false;
let ready = false;

function selectedFocusedCorgi(): FocusedCorgi | undefined {
  return BY_ID.get(String((gameState as any).selectedCorgi) as FocusedCorgi['id']);
}

/**
 * Copies exactly one gameplay frame into a standalone, padded CanvasTexture.
 * The store never samples directly from the tightly packed animation sheet,
 * preventing neighboring frames and horizontal lines from bleeding into cards.
 */
function createIsolatedStoreTexture(
  scene: Phaser.Scene,
  textureKey: string,
  sourceFrameIndex: number,
): boolean {
  if (scene.textures.exists(textureKey)) return true;
  if (!scene.textures.exists(SHEET_KEY)) return false;

  const sourceFrame = scene.textures.get(SHEET_KEY).get(sourceFrameIndex);
  if (!sourceFrame?.source?.image) return false;

  const width = sourceFrame.cutWidth + STORE_PADDING * 2;
  const height = sourceFrame.cutHeight + STORE_PADDING * 2;
  const isolated = scene.textures.createCanvas(textureKey, width, height);
  if (!isolated) return false;

  const context = isolated.getContext();
  context.imageSmoothingEnabled = true;
  context.clearRect(0, 0, width, height);
  context.drawImage(
    sourceFrame.source.image as CanvasImageSource,
    sourceFrame.cutX,
    sourceFrame.cutY,
    sourceFrame.cutWidth,
    sourceFrame.cutHeight,
    STORE_PADDING,
    STORE_PADDING,
    sourceFrame.cutWidth,
    sourceFrame.cutHeight,
  );
  isolated.refresh();
  return true;
}

function prepareStorePortraits(scene: Phaser.Scene): boolean {
  return FOCUSED_CORGIS.every((focused) =>
    createIsolatedStoreTexture(scene, focused.storeTextureKey, focused.baseFrame),
  );
}

function configureDefinitions(): void {
  const definitions = CORGIS as unknown as RuntimeCorgiDef[];

  for (const focused of FOCUSED_CORGIS) {
    const definition = definitions.find((candidate) => candidate.id === focused.id);
    if (!definition) continue;

    // Store uses an isolated texture, never a spritesheet frame.
    definition.texture = focused.storeTextureKey;
    definition.textureFrame = 0;

    // Gameplay keeps the dedicated seven-state Bob/Lulu sheet.
    definition.runFrame = focused.baseFrame;
    definition.runSheetKey = SHEET_KEY;
    definition.runAnimKey = focused.runAnimKey;
    definition.jumpFrame = focused.baseFrame + 4;
    definition.fallFrame = focused.baseFrame + 5;
    definition.landFrame = focused.baseFrame + 6;
  }
}

function registerAnimations(scene: Phaser.Scene): void {
  for (const focused of FOCUSED_CORGIS) {
    if (scene.anims.exists(focused.runAnimKey)) {
      scene.anims.remove(focused.runAnimKey);
    }

    scene.anims.create({
      key: focused.runAnimKey,
      frames: Array.from({ length: RUN_FRAME_COUNT }, (_, offset) => ({
        key: SHEET_KEY,
        frame: focused.baseFrame + offset,
      })),
      frameRate: 12,
      repeat: -1,
    });
  }
}

function applyVisualState(scene: Phaser.Scene & Record<string, any>, frame: number): void {
  const corgi = scene.corgi as Phaser.Physics.Arcade.Sprite | undefined;
  if (!corgi) return;

  const alreadyShowing =
    corgi.texture?.key === SHEET_KEY && String(corgi.frame?.name) === String(frame);

  if (!alreadyShowing) {
    corgi.setTexture(SHEET_KEY, frame);
    if (typeof scene.sizeCorgiUniform === 'function') scene.sizeCorgiUniform();
  }

  corgi.setFlipX(false);
  corgi.setAngle(0);
  corgi.clearTint();
  corgi.setAlpha(1);
  corgi.setBlendMode(Phaser.BlendModes.NORMAL);
}

/** Focused replacement for only Pilot Bob and Princess Lulu. */
export function installBobLuluUpdate(
  PreloadSceneClass: SceneClass,
  CorgiSelectSceneClass: SceneClass,
  GameSceneClass: SceneClass,
): void {
  if (installed) return;
  installed = true;

  const preloadPrototype = PreloadSceneClass.prototype;
  const previousPreload = preloadPrototype.preload;
  preloadPrototype.preload = function preloadBobAndLulu(this: Phaser.Scene): void {
    previousPreload.call(this);
    this.load.spritesheet(SHEET_KEY, BOB_LULU_SHEET_DATA_URI, {
      frameWidth: BOB_LULU_FRAME_SIZE,
      frameHeight: BOB_LULU_FRAME_SIZE,
      startFrame: 0,
      endFrame: BOB_LULU_FRAME_COUNT - 1,
    });
  };

  const previousPreloadCreate = preloadPrototype.create;
  preloadPrototype.create = function createBobAndLulu(this: Phaser.Scene): any {
    // Finish the original preload chain and menu transition first.
    const result = previousPreloadCreate.call(this);
    ready = false;

    if (!this.textures.exists(SHEET_KEY)) {
      console.error('[Corgi Hop] Pilot Bob / Princess Lulu sheet did not load.');
      return result;
    }

    try {
      if (!prepareStorePortraits(this)) {
        console.error('[Corgi Hop] Bob/Lulu isolated store portraits were not created.');
        return result;
      }

      registerAnimations(this);
      configureDefinitions();
      ready = true;
    } catch (error) {
      console.error('[Corgi Hop] Pilot Bob / Princess Lulu setup failed.', error);
    }

    return result;
  };

  // Re-assert the isolated portrait definitions immediately before every store
  // render. This prevents an older compatibility plugin or scene restart from
  // restoring the raw spritesheet frames.
  const selectPrototype = CorgiSelectSceneClass.prototype;
  const previousSelectCreate = selectPrototype.create;
  selectPrototype.create = function createStoreWithCleanBobLulu(
    this: Phaser.Scene & Record<string, any>,
    ...args: any[]
  ): any {
    if (this.textures.exists(SHEET_KEY) && prepareStorePortraits(this)) {
      configureDefinitions();
    }
    return previousSelectCreate.apply(this, args);
  };

  const gamePrototype = GameSceneClass.prototype;
  const previousGameCreate = gamePrototype.create;
  gamePrototype.create = function createFocusedCorgi(
    this: Phaser.Scene & Record<string, any>,
    ...args: any[]
  ): any {
    const result = previousGameCreate.apply(this, args);
    const focused = selectedFocusedCorgi();
    const corgi = this.corgi as Phaser.Physics.Arcade.Sprite | undefined;

    if (!ready || !focused || !corgi || !this.textures.exists(SHEET_KEY)) {
      return result;
    }

    configureDefinitions();
    this.runTexKey = SHEET_KEY;
    this.runAnimKey = focused.runAnimKey;
    corgi.anims.stop();
    applyVisualState(this, focused.baseFrame);
    if (this.anims.exists(focused.runAnimKey)) corgi.play(focused.runAnimKey);
    return result;
  };

  const previousSetPose = gamePrototype.setPose;
  gamePrototype.setPose = function setFocusedPose(
    this: Phaser.Scene & Record<string, any>,
    pose: Pose,
  ): void {
    const focused = selectedFocusedCorgi();
    const corgi = this.corgi as Phaser.Physics.Arcade.Sprite | undefined;

    if (!ready || !focused || !corgi || !this.textures.exists(SHEET_KEY)) {
      previousSetPose.call(this, pose);
      return;
    }

    if (pose === 'hit') {
      previousSetPose.call(this, pose);
      return;
    }

    if (pose === 'run') {
      applyVisualState(this, focused.baseFrame);
      if (
        this.anims.exists(focused.runAnimKey) &&
        corgi.anims.currentAnim?.key !== focused.runAnimKey
      ) {
        corgi.play(focused.runAnimKey);
      }
      return;
    }

    corgi.anims.stop();
    const frame = pose === 'jump'
      ? focused.baseFrame + 4
      : pose === 'fall'
        ? focused.baseFrame + 5
        : focused.baseFrame + 6;
    applyVisualState(this, frame);
  };
}
