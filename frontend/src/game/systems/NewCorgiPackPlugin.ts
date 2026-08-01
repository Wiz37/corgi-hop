import Phaser from 'phaser';
import { CORGIS, CORGI_BONE_PRICE, gameState } from './GameState';
import { storage, STORAGE_KEYS as K } from './Storage';
import { PolishedButton } from '../ui/PolishedButton';

type SceneClass = { prototype: Record<string, any> };

interface NewCorgiDef {
  id: string;
  name: string;
  price: number;
  portraitFrame: number;
  runRow: number;
  runAnimKey: string;
}

interface RuntimeCorgiDef {
  id: string;
  name: string;
  texture: string;
  textureFrame?: number;
  runSheetKey?: string;
  runAnimKey?: string;
  jumpFrame?: number;
  fallFrame?: number;
  landFrame?: number;
  premium: boolean;
  entitlementProducts: string[];
}

const PORTRAIT_FRAME = 160;
const RUN_FRAME = 128;
const FRAMES_PER_CORGI = 8;
const PAGE_SIZE = 6;
const PORTRAIT_SHEET = 'new_corgi_portraits_v2';
const RUN_SHEET = 'new_corgi_runs_v2';
const PACK_VERSION = '20260801c';

const NEW_CORGIS: NewCorgiDef[] = [
  { id: 'blue_merle_chef', name: 'Blue Merle Chef Corgi', price: 2800, portraitFrame: 0, runRow: 0, runAnimKey: 'blue_merle_chef_run' },
  { id: 'black_tri_tuxedo', name: 'Black Tri Tuxedo Corgi', price: 3200, portraitFrame: 1, runRow: 1, runAnimKey: 'black_tri_tuxedo_run' },
  { id: 'red_tri_ninja', name: 'Red Tri Ninja Corgi', price: 3600, portraitFrame: 2, runRow: 2, runAnimKey: 'red_tri_ninja_run' },
  { id: 'sable_aviator', name: 'Sable Aviator Corgi', price: 4000, portraitFrame: 3, runRow: 3, runAnimKey: 'sable_aviator_run' },
  { id: 'brindle_viking', name: 'Brindle Viking Cardigan', price: 4400, portraitFrame: 4, runRow: 4, runAnimKey: 'brindle_viking_run' },
  { id: 'heeler_lifeguard', name: 'Heeler Lifeguard Corgi', price: 4800, portraitFrame: 5, runRow: 5, runAnimKey: 'heeler_lifeguard_run' },
  { id: 'pilot_bob', name: 'Pilot Bob', price: 5200, portraitFrame: 6, runRow: 6, runAnimKey: 'pilot_bob_run' },
  { id: 'princess_lulu', name: 'Princess Lulu', price: 5600, portraitFrame: 7, runRow: 7, runAnimKey: 'princess_lulu_run' },
];

let installed = false;

function registerAnimations(scene: Phaser.Scene): void {
  if (!scene.textures.exists(PORTRAIT_SHEET)) {
    console.error('[Corgi Hop] Missing premium portrait sheet.');
  }
  if (!scene.textures.exists(RUN_SHEET)) {
    console.error('[Corgi Hop] Missing premium gameplay sheet.');
    return;
  }

  for (const def of NEW_CORGIS) {
    if (scene.anims.exists(def.runAnimKey)) continue;
    const start = def.runRow * FRAMES_PER_CORGI;
    scene.anims.create({
      key: def.runAnimKey,
      frames: scene.anims.generateFrameNumbers(RUN_SHEET, {
        start,
        end: start + FRAMES_PER_CORGI - 1,
      }),
      frameRate: 14,
      repeat: -1,
    });
  }
}

/**
 * Adds the eight approved illustrated corgis using two direct sprite sheets.
 *
 * Store cards use a real frame from the portrait sheet. Gameplay uses the
 * matching row from the full-body run sheet. There is no generated outfit,
 * no canvas extraction, and no Classic-Corgi art substitution.
 */
export function installNewCorgiPack(
  PreloadSceneClass: SceneClass,
  CorgiSelectSceneClass: SceneClass,
): void {
  if (installed) return;
  installed = true;

  const runtimeCorgis = CORGIS as unknown as RuntimeCorgiDef[];
  const runtimePrices = CORGI_BONE_PRICE as unknown as Record<string, number>;
  const state = gameState as any;

  for (const def of NEW_CORGIS) {
    const start = def.runRow * FRAMES_PER_CORGI;
    const runtimeDef: RuntimeCorgiDef = {
      id: def.id,
      name: def.name,
      texture: PORTRAIT_SHEET,
      textureFrame: def.portraitFrame,
      runSheetKey: RUN_SHEET,
      runAnimKey: def.runAnimKey,
      jumpFrame: start + 3,
      fallFrame: start + 5,
      landFrame: start + 7,
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
      PORTRAIT_SHEET,
      `/assets/new_corgi_portraits_v2.webp?v=${PACK_VERSION}`,
      { frameWidth: PORTRAIT_FRAME, frameHeight: PORTRAIT_FRAME, startFrame: 0, endFrame: 7 },
    );
    this.load.spritesheet(
      RUN_SHEET,
      `/assets/new_corgi_runs_v2.webp?v=${PACK_VERSION}`,
      { frameWidth: RUN_FRAME, frameHeight: RUN_FRAME, startFrame: 0, endFrame: 63 },
    );
  };

  const originalPreloadCreate = preloadProto.create;
  preloadProto.create = function createNewCorgiAnimations(this: Phaser.Scene): void {
    registerAnimations(this);
    originalPreloadCreate.call(this);
  };

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
}
