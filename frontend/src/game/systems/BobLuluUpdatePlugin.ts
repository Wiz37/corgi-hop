import Phaser from 'phaser';
import { CORGIS } from './GameState';
import {
  BOB_STORE_PORTRAIT_DATA_URI,
  LULU_STORE_PORTRAIT_DATA_URI,
} from '../assets/BobLuluStorePortraits';

type SceneClass = { prototype: Record<string, any> };

interface RuntimeCorgiDef {
  id: string;
  texture: string;
  textureFrame?: number;
}

interface FocusedCorgi {
  id: 'pilot_bob' | 'princess_lulu';
  storeTextureKey: string;
  dataUri: string;
}

// Store artwork is intentionally separate from every gameplay spritesheet.
// This prevents neighboring animation frames, compression debris, and texture
// filtering from appearing inside Bob or Lulu's character-selection cards.
const FOCUSED_CORGIS: FocusedCorgi[] = [
  {
    id: 'pilot_bob',
    storeTextureKey: 'pilot_bob_store_standalone_20260801',
    dataUri: BOB_STORE_PORTRAIT_DATA_URI,
  },
  {
    id: 'princess_lulu',
    storeTextureKey: 'princess_lulu_store_standalone_20260801',
    dataUri: LULU_STORE_PORTRAIT_DATA_URI,
  },
];

let installed = false;

function storePortraitsReady(scene: Phaser.Scene): boolean {
  return FOCUSED_CORGIS.every((focused) =>
    scene.textures.exists(focused.storeTextureKey),
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

/** Installs clean standalone store portraits for Pilot Bob and Princess Lulu. */
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

    for (const focused of FOCUSED_CORGIS) {
      this.load.image(focused.storeTextureKey, focused.dataUri);
    }
  };

  const previousPreloadCreate = preloadPrototype.create;
  preloadPrototype.create = function createBobAndLuluPortraits(this: Phaser.Scene): any {
    const result = previousPreloadCreate.call(this);

    if (storePortraitsReady(this)) {
      configureStoreDefinitions();
    } else {
      console.error('[Corgi Hop] Standalone Bob/Lulu store portraits failed to load.');
    }

    return result;
  };

  // Reassert the standalone portrait keys immediately before every store render.
  const selectPrototype = CorgiSelectSceneClass.prototype;
  const previousSelectCreate = selectPrototype.create;
  selectPrototype.create = function createStoreWithCleanBobLulu(
    this: Phaser.Scene & Record<string, any>,
    ...args: any[]
  ): any {
    if (storePortraitsReady(this)) {
      configureStoreDefinitions();
    }

    return previousSelectCreate.apply(this, args);
  };
}
