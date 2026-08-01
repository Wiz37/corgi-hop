import Phaser from 'phaser';
import { CORGIS, CORGI_BONE_PRICE, gameState } from './GameState';
import { storage, STORAGE_KEYS as K } from './Storage';
import { PolishedButton } from '../ui/PolishedButton';
import {
  NEW_CORGI_ART_DATA_URI,
  NEW_CORGI_ART_FRAME_COUNT,
  NEW_CORGI_ART_FRAME_SIZE,
} from '../assets/NewCorgiArt';
import {
  PREMIUM_STORE_PORTRAITS_DATA_URI,
  PREMIUM_STORE_PORTRAIT_FRAME_COUNT,
  PREMIUM_STORE_PORTRAIT_FRAME_SIZE,
} from '../assets/PremiumStorePortraitsFull';

type SceneClass = { prototype: Record<string, any> };

interface NewCorgiDef {
  id: string;
  name: string;
  price: number;
  frame: number;
  runAnimKey: string;
}

interface RuntimeCorgiDef {
  id: string;
  name: string;
  texture: string;
  textureFrame?: number;
  runFrame?: number;
  runSheetKey?: string;
  runAnimKey?: string;
  jumpFrame?: number;
  fallFrame?: number;
  landFrame?: number;
  premium: boolean;
  entitlementProducts: string[];
}

const PAGE_SIZE = 6;
const CHARACTER_SHEET = 'approved_premium_corgis_20260801';
const STORE_PORTRAIT_SHEET = 'premium_store_portraits_page2_20260801';

const NEW_CORGIS: NewCorgiDef[] = [
  { id: 'blue_merle_chef', name: 'Blue Merle Chef Corgi', price: 2800, frame: 0, runAnimKey: 'blue_merle_chef_run' },
  { id: 'black_tri_tuxedo', name: 'Black Tri Tuxedo Corgi', price: 3200, frame: 1, runAnimKey: 'black_tri_tuxedo_run' },
  { id: 'red_tri_ninja', name: 'Red Tri Ninja Corgi', price: 3600, frame: 2, runAnimKey: 'red_tri_ninja_run' },
  { id: 'sable_aviator', name: 'Sable Aviator Corgi', price: 4000, frame: 3, runAnimKey: 'sable_aviator_run' },
  { id: 'brindle_viking', name: 'Brindle Viking Cardigan', price: 4400, frame: 4, runAnimKey: 'brindle_viking_run' },
  { id: 'heeler_lifeguard', name: 'Heeler Lifeguard Corgi', price: 4800, frame: 5, runAnimKey: 'heeler_lifeguard_run' },
  { id: 'pilot_bob', name: 'Pilot Bob', price: 5200, frame: 6, runAnimKey: 'pilot_bob_run' },
  { id: 'princess_lulu', name: 'Princess Lulu', price: 5600, frame: 7, runAnimKey: 'princess_lulu_run' },
];

const NEW_CORGI_IDS = new Set(NEW_CORGIS.map((def) => def.id));
let installed = false;

function requirePremiumTexture(scene: Phaser.Scene): void {
  if (!scene.textures.exists(CHARACTER_SHEET)) {
    throw new Error('[Corgi Hop] Approved premium corgi artwork failed to load. Refusing to substitute the Classic Corgi.');
  }
}

function hasStorePortraitTexture(scene: Phaser.Scene): boolean {
  return scene.textures.exists(STORE_PORTRAIT_SHEET);
}

function applyFullBodyStorePortraits(runtimeCorgis: RuntimeCorgiDef[]): void {
  for (let frame = 0; frame < PAGE_SIZE; frame++) {
    const storeDef = NEW_CORGIS[frame];
    const runtimeDef = runtimeCorgis.find((corgi) => corgi.id === storeDef.id);
    if (!runtimeDef) continue;
    runtimeDef.texture = STORE_PORTRAIT_SHEET;
    runtimeDef.textureFrame = frame;
  }
}

function registerAnimations(scene: Phaser.Scene): void {
  requirePremiumTexture(scene);

  for (const def of NEW_CORGIS) {
    if (scene.anims.exists(def.runAnimKey)) continue;
    scene.anims.create({
      key: def.runAnimKey,
      frames: [{ key: CHARACTER_SHEET, frame: def.frame }],
      frameRate: 1,
      repeat: -1,
    });
  }
}

function selectedPremium(runtimeCorgis: RuntimeCorgiDef[]): RuntimeCorgiDef | undefined {
  const selectedId = String((gameState as any).selectedCorgi ?? 'classic');
  if (!NEW_CORGI_IDS.has(selectedId)) return undefined;
  return runtimeCorgis.find((corgi) => corgi.id === selectedId);
}

/**
 * Installs the eight approved illustrated corgis.
 *
 * Gameplay uses the bundled animation artwork. The six page-two store cards
 * use separate padded, full-body portraits so paws and legs cannot be clipped.
 */
export function installNewCorgiPack(
  PreloadSceneClass: SceneClass,
  CorgiSelectSceneClass: SceneClass,
  GameSceneClass: SceneClass,
): void {
  if (installed) return;
  installed = true;

  const runtimeCorgis = CORGIS as unknown as RuntimeCorgiDef[];
  const runtimePrices = CORGI_BONE_PRICE as unknown as Record<string, number>;
  const state = gameState as any;

  for (const def of NEW_CORGIS) {
    const runtimeDef: RuntimeCorgiDef = {
      id: def.id,
      name: def.name,
      texture: CHARACTER_SHEET,
      textureFrame: def.frame,
      runFrame: def.frame,
      runSheetKey: CHARACTER_SHEET,
      runAnimKey: def.runAnimKey,
      jumpFrame: def.frame,
      fallFrame: def.frame,
      landFrame: def.frame,
      premium: true,
      entitlementProducts: ['com.corgihop.all_corgis'],
    };

    const existing = runtimeCorgis.find((corgi) => corgi.id === def.id);
    if (existing) Object.assign(existing, runtimeDef);
    else runtimeCorgis.push(runtimeDef);

    runtimePrices[def.id] = def.price;
    if (!(def.id in state.boneUnlocks)) state.boneUnlocks[def.id] = false;
  }

  const originalLoad = state.load.bind(state);
  state.load = (): void => {
    const selectedBeforeLoad = storage.getString(K.selectedCorgi, 'classic');
    const unlocksBeforeLoad = storage.getJSON<Record<string, boolean>>(K.boneUnlocks, {});
    originalLoad();

    for (const def of NEW_CORGIS) {
      state.boneUnlocks[def.id] = !!unlocksBeforeLoad[def.id];
    }
    if (runtimeCorgis.some((corgi) => corgi.id === selectedBeforeLoad)) {
      state.selectedCorgi = selectedBeforeLoad;
    }
    state.saveBoneUnlocks();
    state.saveSelected();
  };

  const preloadProto = PreloadSceneClass.prototype;
  const originalPreload = preloadProto.preload;
  preloadProto.preload = function preloadNewCorgis(this: Phaser.Scene): void {
    originalPreload.call(this);
    this.load.spritesheet(
      CHARACTER_SHEET,
      NEW_CORGI_ART_DATA_URI,
      {
        frameWidth: NEW_CORGI_ART_FRAME_SIZE,
        frameHeight: NEW_CORGI_ART_FRAME_SIZE,
        startFrame: 0,
        endFrame: NEW_CORGI_ART_FRAME_COUNT - 1,
      },
    );
    this.load.spritesheet(
      STORE_PORTRAIT_SHEET,
      PREMIUM_STORE_PORTRAITS_DATA_URI,
      {
        frameWidth: PREMIUM_STORE_PORTRAIT_FRAME_SIZE,
        frameHeight: PREMIUM_STORE_PORTRAIT_FRAME_SIZE,
        startFrame: 0,
        endFrame: PREMIUM_STORE_PORTRAIT_FRAME_COUNT - 1,
      },
    );
  };

  const originalPreloadCreate = preloadProto.create;
  preloadProto.create = function createNewCorgiAnimations(this: Phaser.Scene): void {
    registerAnimations(this);
    // Store portraits are optional at boot. A failed portrait decode must never
    // prevent the loader from leaving 100% and entering the menu.
    originalPreloadCreate.call(this);
  };

  const selectProto = CorgiSelectSceneClass.prototype;
  const originalSelectCreate = selectProto.create;
  selectProto.create = function createPagedCorgiStore(
    this: Phaser.Scene & { scene: Phaser.Scenes.ScenePlugin },
    data?: { characterPage?: number },
  ): void {
    requirePremiumTexture(this);
    if (hasStorePortraitTexture(this)) {
      applyFullBodyStorePortraits(runtimeCorgis);
    }

    const allCorgis = runtimeCorgis.slice();
    const pageCount = Math.max(1, Math.ceil(allCorgis.length / PAGE_SIZE));
    const requestedPage = Number(data?.characterPage ?? 0);
    const page = Phaser.Math.Clamp(
      Number.isFinite(requestedPage) ? requestedPage : 0,
      0,
      pageCount - 1,
    );
    const pageCorgis = allCorgis.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

    runtimeCorgis.splice(0, runtimeCorgis.length, ...pageCorgis);
    try {
      originalSelectCreate.call(this);
    } finally {
      runtimeCorgis.splice(0, runtimeCorgis.length, ...allCorgis);
    }

    if (pageCount <= 1) return;

    this.add.text(360, 1141, `CORGIS ${page + 1}/${pageCount}`, {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '24px',
      fontStyle: '900',
      color: '#ffffff',
      stroke: '#24304a',
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(45);

    if (page > 0) {
      new PolishedButton(this, {
        x: 145,
        y: 1140,
        w: 90,
        h: 68,
        label: '<',
        color: 0x2a3d67,
        shadowColor: 0x18223a,
        depth: 45,
        testId: 'corgi-page-prev',
        onTap: () => this.scene.restart({ characterPage: page - 1 }),
      });
    }

    if (page < pageCount - 1) {
      new PolishedButton(this, {
        x: 575,
        y: 1140,
        w: 90,
        h: 68,
        label: '>',
        color: 0x2a3d67,
        shadowColor: 0x18223a,
        depth: 45,
        testId: 'corgi-page-next',
        onTap: () => this.scene.restart({ characterPage: page + 1 }),
      });
    }
  };

  const gameProto = GameSceneClass.prototype;
  const originalGameCreate = gameProto.create;
  gameProto.create = function createWithApprovedCorgiArt(this: Phaser.Scene & Record<string, any>, ...args: any[]): any {
    const result = originalGameCreate.apply(this, args);
    const selected = selectedPremium(runtimeCorgis);
    if (!selected) return result;

    requirePremiumTexture(this);
    const corgi = this.corgi as Phaser.Physics.Arcade.Sprite | undefined;
    if (!corgi) throw new Error('[Corgi Hop] Gameplay corgi sprite was not created.');

    const frame = selected.runFrame ?? selected.textureFrame ?? 0;
    corgi.setTexture(CHARACTER_SHEET, frame);
    corgi.setFlipX(false);
    corgi.setAngle(0);
    corgi.clearTint();
    if (selected.runAnimKey && this.anims.exists(selected.runAnimKey)) {
      corgi.play(selected.runAnimKey);
    }
    return result;
  };

  const originalSetPose = gameProto.setPose;
  if (typeof originalSetPose === 'function') {
    gameProto.setPose = function setApprovedPremiumPose(
      this: Phaser.Scene & Record<string, any>,
      logicalPose: 'run' | 'jump' | 'fall' | 'land' | 'hit',
    ): void {
      const selected = selectedPremium(runtimeCorgis);
      if (!selected) {
        originalSetPose.call(this, logicalPose);
        return;
      }

      requirePremiumTexture(this);
      const corgi = this.corgi as Phaser.Physics.Arcade.Sprite | undefined;
      if (!corgi) return;

      const frame = selected.runFrame ?? selected.textureFrame ?? 0;
      const currentFrame = Number(corgi.frame?.name);
      if (corgi.texture.key !== CHARACTER_SHEET || currentFrame !== frame) {
        corgi.setTexture(CHARACTER_SHEET, frame);
      }
      corgi.setFlipX(false);
      corgi.setAngle(0);
      corgi.clearTint();
    };
  }
}
