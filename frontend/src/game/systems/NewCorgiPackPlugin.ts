import Phaser from 'phaser';
import { CORGIS, CORGI_BONE_PRICE, gameState } from './GameState';
import { storage, STORAGE_KEYS as K } from './Storage';
import { PolishedButton } from '../ui/PolishedButton';

type SceneClass = { prototype: Record<string, any> };

interface NewCorgiDef {
  id: string;
  name: string;
  price: number;
  atlasFrame: number;
  runAnimKey: string;
}

interface RuntimeCorgiDef {
  id: string;
  name: string;
  texture: string;
  textureFrame?: number;
  runSheetKey?: string;
  runAnimKey?: string;
  runFrame?: number;
  jumpFrame?: number;
  fallFrame?: number;
  landFrame?: number;
  premium: boolean;
  entitlementProducts: string[];
}

const FRAME = 192;
const PAGE_SIZE = 6;
const PACK_VERSION = '20260731b';
const ATLAS_KEY = 'new_corgi_portraits_atlas';

const NEW_CORGIS: NewCorgiDef[] = [
  { id: 'blue_merle_chef', name: 'Blue Merle Chef Corgi', price: 2800, atlasFrame: 0, runAnimKey: 'blue_merle_chef_run' },
  { id: 'black_tri_tuxedo', name: 'Black Tri Tuxedo Corgi', price: 3200, atlasFrame: 1, runAnimKey: 'black_tri_tuxedo_run' },
  { id: 'red_tri_ninja', name: 'Red Tri Ninja Corgi', price: 3600, atlasFrame: 2, runAnimKey: 'red_tri_ninja_run' },
  { id: 'sable_aviator', name: 'Sable Aviator Corgi', price: 4000, atlasFrame: 3, runAnimKey: 'sable_aviator_run' },
  { id: 'brindle_viking', name: 'Brindle Viking Cardigan', price: 4400, atlasFrame: 4, runAnimKey: 'brindle_viking_run' },
  { id: 'heeler_lifeguard', name: 'Heeler Lifeguard Corgi', price: 4800, atlasFrame: 5, runAnimKey: 'heeler_lifeguard_run' },
  { id: 'pilot_bob', name: 'Pilot Bob', price: 5200, atlasFrame: 6, runAnimKey: 'pilot_bob_run' },
  { id: 'princess_lulu', name: 'Princess Lulu', price: 5600, atlasFrame: 7, runAnimKey: 'princess_lulu_run' },
];

let installed = false;

function registerCharacterAnimations(scene: Phaser.Scene): void {
  if (!scene.textures.exists(ATLAS_KEY)) return;

  for (const def of NEW_CORGIS) {
    if (scene.anims.exists(def.runAnimKey)) continue;
    scene.anims.create({
      key: def.runAnimKey,
      frames: [{ key: ATLAS_KEY, frame: def.atlasFrame }],
      frameRate: 1,
      repeat: -1,
    });
  }
}

function selectedNewCorgi(): NewCorgiDef | undefined {
  return NEW_CORGIS.find((def) => def.id === (gameState as any).selectedCorgi);
}

/**
 * Adds the approved illustrated corgis without generating or cutting textures
 * at runtime. Store cards and gameplay both use frames directly from the
 * bundled atlas. This avoids the iOS fallback that displayed Classic Corgi on
 * every new card when runtime-created textures were unavailable.
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
    if (!runtimeCorgis.some((corgi) => corgi.id === def.id)) {
      runtimeCorgis.push({
        id: def.id,
        name: def.name,
        texture: ATLAS_KEY,
        textureFrame: def.atlasFrame,
        runSheetKey: ATLAS_KEY,
        runAnimKey: def.runAnimKey,
        runFrame: def.atlasFrame,
        jumpFrame: def.atlasFrame,
        fallFrame: def.atlasFrame,
        landFrame: def.atlasFrame,
        premium: true,
        entitlementProducts: ['com.corgihop.all_corgis'],
      });
    }
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
      ATLAS_KEY,
      `/assets/new_corgi_portraits.webp?v=${PACK_VERSION}`,
      { frameWidth: FRAME, frameHeight: FRAME },
    );
  };

  const originalPreloadCreate = preloadProto.create;
  preloadProto.create = function createNewCorgiAnimations(this: Phaser.Scene): void {
    registerCharacterAnimations(this);
    originalPreloadCreate.call(this);
  };

  // GameScene assumes frame zero is the running frame. The new characters
  // share one atlas, so force the selected character's own frame after any
  // semantic pose swap. This preserves the complete outfit in the air and on
  // landing instead of switching to another dog or a clipped generated frame.
  const gameProto = GameSceneClass.prototype;
  const originalSetPose = gameProto.setPose;
  if (typeof originalSetPose === 'function') {
    gameProto.setPose = function setNewCorgiPose(this: Phaser.Scene & Record<string, any>, logicalPose: string): void {
      originalSetPose.call(this, logicalPose);
      if (logicalPose === 'hit') return;
      const def = selectedNewCorgi();
      const corgi = this.corgi as Phaser.Physics.Arcade.Sprite | undefined;
      if (!def || !corgi || !this.textures.exists(ATLAS_KEY)) return;
      corgi.setTexture(ATLAS_KEY, def.atlasFrame);
      corgi.setAlpha(1);
      corgi.setFlipX(false);
      corgi.clearTint();
      corgi.setBlendMode(Phaser.BlendModes.NORMAL);
    };
  }

  const selectProto = CorgiSelectSceneClass.prototype;
  const originalSelectCreate = selectProto.create;
  selectProto.create = function createPagedCorgiStore(
    this: Phaser.Scene & { scene: Phaser.Scenes.ScenePlugin },
    data?: { characterPage?: number },
  ): void {
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
      originalSelectCreate.call(this, data);
    } finally {
      runtimeCorgis.splice(0, runtimeCorgis.length, ...allCorgis);
    }

    if (pageCount <= 1) return;

    const navY = pageCorgis.length <= 2 ? 1050 : 1100;
    this.add.text(360, navY + 1, `CORGIS ${page + 1}/${pageCount}`, {
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
        y: navY,
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
        y: navY,
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
}
