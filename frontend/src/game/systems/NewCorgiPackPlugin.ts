import Phaser from 'phaser';
import { CORGIS, CORGI_BONE_PRICE, gameState } from './GameState';
import { storage, STORAGE_KEYS as K } from './Storage';
import { PolishedButton } from '../ui/PolishedButton';
import type { ExpansionDef } from './PremiumExpansionCatalog';
import { buildPremiumPortrait, buildPremiumRun } from './PremiumExpansionArt';

type SceneClass = { prototype: Record<string, any> };
type NewCorgiDef = ExpansionDef;

interface RuntimeCorgiDef {
  id: string;
  name: string;
  texture: string;
  runSheetKey?: string;
  runAnimKey?: string;
  jumpFrame?: number;
  fallFrame?: number;
  landFrame?: number;
  premium: boolean;
  entitlementProducts: string[];
}

const PAGE_SIZE = 6;

/**
 * These definitions drive both the selector portrait and the full eight-frame
 * gameplay animation. Each character has its own coat and costume theme, so
 * no premium character can silently render as Classic Corgi.
 */
const NEW_CORGIS: NewCorgiDef[] = [
  { id: 'blue_merle_chef', name: 'Blue Merle Chef Corgi', price: 2800, coat: 'merle', theme: 'chef' },
  { id: 'black_tri_tuxedo', name: 'Black Tri Tuxedo Corgi', price: 3200, coat: 'tricolor', theme: 'tuxedo' },
  { id: 'red_tri_ninja', name: 'Red Tri Ninja Corgi', price: 3600, coat: 'tricolor', theme: 'ninja' },
  { id: 'sable_aviator', name: 'Sable Aviator Corgi', price: 4000, coat: 'sable', theme: 'aviator' },
  { id: 'brindle_viking', name: 'Brindle Viking Cardigan', price: 4400, coat: 'brindle', theme: 'viking' },
  { id: 'heeler_lifeguard', name: 'Blue Heeler Lifeguard Bob', price: 4800, coat: 'merle', theme: 'lifeguard' },
  { id: 'pilot_bob', name: 'Pilot Bob', price: 5200, coat: 'orange', theme: 'aviator' },
  { id: 'princess_lulu', name: 'Princess Lulu', price: 5600, coat: 'tricolor', theme: 'royal' },
];

let installed = false;

function portraitKey(def: NewCorgiDef): string {
  return `corgi_${def.id}`;
}

function runKey(def: NewCorgiDef): string {
  return `${def.id}_run`;
}

/**
 * Build native Phaser textures directly from the coat/costume definitions.
 * This is intentionally idempotent and is called from preload, the selector,
 * and gameplay so iOS can never fall back to the Classic dog because a
 * generated texture was missing from the cache.
 */
function ensureCharacterArt(scene: Phaser.Scene): void {
  for (const def of NEW_CORGIS) {
    buildPremiumPortrait(scene, def);
    buildPremiumRun(scene, def, runKey(def));
  }
}

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
        texture: portraitKey(def),
        runSheetKey: runKey(def),
        runAnimKey: runKey(def),
        jumpFrame: 2,
        fallFrame: 6,
        landFrame: 0,
        premium: true,
        entitlementProducts: ['com.corgihop.all_corgis'],
      });
    }

    runtimePrices[def.id] = def.price;
    if (!(def.id in state.boneUnlocks)) state.boneUnlocks[def.id] = false;
  }

  // GameState's original ID union only contains the launch characters.
  // Preserve premium unlocks and the selected premium character across loads.
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

  // Build every portrait and animated run sheet before leaving PreloadScene.
  const preloadProto = PreloadSceneClass.prototype;
  const originalPreloadCreate = preloadProto.create;
  preloadProto.create = function createNewCorgiArt(this: Phaser.Scene): void {
    ensureCharacterArt(this);
    originalPreloadCreate.call(this);
  };

  // Defensive iOS cache repair: rebuild missing character textures immediately
  // before gameplay instead of allowing GameScene to substitute Classic Corgi.
  const gameProto = GameSceneClass.prototype;
  const originalGameCreate = gameProto.create;
  gameProto.create = function createGameWithCorrectCorgi(
    this: Phaser.Scene & Record<string, any>,
    ...args: unknown[]
  ): unknown {
    ensureCharacterArt(this);
    return originalGameCreate.apply(this, args);
  };

  const selectProto = CorgiSelectSceneClass.prototype;
  const originalSelectCreate = selectProto.create;
  selectProto.create = function createPagedCorgiStore(
    this: Phaser.Scene & { scene: Phaser.Scenes.ScenePlugin },
    data?: { characterPage?: number },
  ): void {
    // Repair selector textures before any card decides whether to use fallback
    // artwork. This is the direct fix for every card showing Classic Corgi.
    ensureCharacterArt(this);

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
