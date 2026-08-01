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
}

const SHEET_KEY = 'bob_lulu_sheet_20260801';
const RUN_FRAME_COUNT = 4;
const FOCUSED_CORGIS: FocusedCorgi[] = [
  { id: 'pilot_bob', baseFrame: 0, runAnimKey: 'pilot_bob_run_20260801' },
  { id: 'princess_lulu', baseFrame: 7, runAnimKey: 'princess_lulu_run_20260801' },
];
const BY_ID = new Map(FOCUSED_CORGIS.map((entry) => [entry.id, entry]));

let installed = false;
let ready = false;

function selectedFocusedCorgi(): FocusedCorgi | undefined {
  return BY_ID.get(String((gameState as any).selectedCorgi) as FocusedCorgi['id']);
}

function configureDefinitions(): void {
  const definitions = CORGIS as unknown as RuntimeCorgiDef[];

  for (const focused of FOCUSED_CORGIS) {
    const definition = definitions.find((candidate) => candidate.id === focused.id);
    if (!definition) continue;

    Object.assign(definition, {
      // The selection store uses the same full-body cartoon frame as gameplay.
      texture: SHEET_KEY,
      textureFrame: focused.baseFrame,
      runFrame: focused.baseFrame,
      runSheetKey: SHEET_KEY,
      runAnimKey: focused.runAnimKey,
      jumpFrame: focused.baseFrame + 4,
      fallFrame: focused.baseFrame + 5,
      landFrame: focused.baseFrame + 6,
    });
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

/**
 * Focused replacement for only Pilot Bob and Princess Lulu.
 *
 * Existing characters and existing gameplay systems are left untouched. The
 * original preload/create chain always completes first so this optional art
 * cannot trap the application on the loading screen.
 */
export function installBobLuluUpdate(
  PreloadSceneClass: SceneClass,
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
    const result = previousPreloadCreate.call(this);
    ready = false;

    if (!this.textures.exists(SHEET_KEY)) {
      console.error('[Corgi Hop] Pilot Bob / Princess Lulu sheet did not load.');
      return result;
    }

    try {
      registerAnimations(this);
      configureDefinitions();
      ready = true;
    } catch (error) {
      console.error('[Corgi Hop] Pilot Bob / Princess Lulu setup failed.', error);
    }

    return result;
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

    // Keep the game's approved BONK/crash image and behavior.
    if (pose === 'hit') {
      previousSetPose.call(this, pose);
      return;
    }

    if (pose === 'run') {
      applyVisualState(this, focused.baseFrame);
      if (this.anims.exists(focused.runAnimKey) && corgi.anims.currentAnim?.key !== focused.runAnimKey) {
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
