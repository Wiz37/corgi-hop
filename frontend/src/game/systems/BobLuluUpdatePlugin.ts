import Phaser from 'phaser';
import { CORGIS } from './GameState';
import {
  BOB_LULU_FRAME_COUNT,
  BOB_LULU_FRAME_SIZE,
  BOB_LULU_SHEET_DATA_URI,
} from '../assets/BobLuluAssets';

type SceneClass = { prototype: Record<string, any> };

interface RuntimeCorgiDef {
  id: string;
  texture: string;
  textureFrame?: number;
}

interface FocusedCorgi {
  id: 'pilot_bob' | 'princess_lulu';
  sourceFrame: number;
  storeTextureKey: string;
}

// This plugin now owns only the two isolated store portraits. Gameplay for Bob
// and Lulu is controlled by GameplayAnimationPlugin's shared eight-frame cycle.
const SHEET_KEY = 'bob_lulu_sheet_20260801b';
const STORE_PADDING = 18;
const FOCUSED_CORGIS: FocusedCorgi[] = [
  {
    id: 'pilot_bob',
    sourceFrame: 0,
    storeTextureKey: 'pilot_bob_store_isolated_20260801c',
  },
  {
    id: 'princess_lulu',
    sourceFrame: 7,
    storeTextureKey: 'princess_lulu_store_isolated_20260801c',
  },
];

let installed = false;

/**
 * Copies exactly one portrait into a standalone padded CanvasTexture. The store
 * never samples from a tightly packed spritesheet, so adjacent frames cannot
 * bleed into Bob or Lulu's card.
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
    createIsolatedStoreTexture(scene, focused.storeTextureKey, focused.sourceFrame),
  );
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

/** Keeps only Pilot Bob and Princess Lulu's clean standalone store portraits. */
export function installBobLuluUpdate(
  PreloadSceneClass: SceneClass,
  CorgiSelectSceneClass: SceneClass,
  _GameSceneClass: SceneClass,
): void {
  if (installed) return;
  installed = true;

  const preloadPrototype = PreloadSceneClass.prototype;
  const previousPreload = preloadPrototype.preload;
  preloadPrototype.preload = function preloadBobAndLuluPortraits(this: Phaser.Scene): void {
    previousPreload.call(this);
    this.load.spritesheet(SHEET_KEY, BOB_LULU_SHEET_DATA_URI, {
      frameWidth: BOB_LULU_FRAME_SIZE,
      frameHeight: BOB_LULU_FRAME_SIZE,
      startFrame: 0,
      endFrame: BOB_LULU_FRAME_COUNT - 1,
    });
  };

  const previousPreloadCreate = preloadPrototype.create;
  preloadPrototype.create = function createBobAndLuluPortraits(this: Phaser.Scene): any {
    const result = previousPreloadCreate.call(this);

    try {
      if (prepareStorePortraits(this)) {
        configureStoreDefinitions();
      } else {
        console.error('[Corgi Hop] Bob/Lulu isolated store portraits were not created.');
      }
    } catch (error) {
      console.error('[Corgi Hop] Bob/Lulu store portrait setup failed.', error);
    }

    return result;
  };

  // Reassert the portrait keys immediately before every store render. This is
  // intentionally the only scene wrapper in this focused plugin.
  const selectPrototype = CorgiSelectSceneClass.prototype;
  const previousSelectCreate = selectPrototype.create;
  selectPrototype.create = function createStoreWithCleanBobLulu(
    this: Phaser.Scene & Record<string, any>,
    ...args: any[]
  ): any {
    if (this.textures.exists(SHEET_KEY) && prepareStorePortraits(this)) {
      configureStoreDefinitions();
    }
    return previousSelectCreate.apply(this, args);
  };
}
