import Phaser from 'phaser';
import { CORGIS, CORGI_BONE_PRICE, gameState, type CorgiId } from './GameState';
import { storage, STORAGE_KEYS as K } from './Storage';
import { PREMIUM_EXPANSION } from './PremiumExpansionCatalog';
import { buildPremiumExpansionPngTextures, queuePremiumExpansionAtlases } from './PremiumExpansionPngAssets';

let installed = false;

function registerDefinitions(): void {
  for (const def of PREMIUM_EXPANSION) {
    if (CORGIS.some((c) => String(c.id) === def.id)) continue;
    const id = def.id as CorgiId;
    CORGIS.push({
      id,
      name: def.name,
      texture: `corgi_${def.id}`,
      runSheetKey: `${def.id}_run`,
      runAnimKey: `${def.id}_run`,
      jumpFrame: 2,
      fallFrame: 6,
      landFrame: 0,
      premium: true,
      entitlementProducts: ['com.corgihop.all_corgis'],
    });
    (CORGI_BONE_PRICE as Record<string, number>)[def.id] = def.price;
    if (!(def.id in (gameState.boneUnlocks as Record<string, boolean>))) {
      (gameState.boneUnlocks as Record<string, boolean>)[def.id] = false;
    }
  }
}

function restoreExpansionSaves(): void {
  const ids = new Set(PREMIUM_EXPANSION.map((d) => d.id));
  const originalLoad = gameState.load.bind(gameState);
  gameState.load = () => {
    const selected = storage.getString(K.selectedCorgi, 'classic');
    const unlocks = storage.getJSON<Record<string, boolean>>(K.boneUnlocks, {});
    originalLoad();
    for (const def of PREMIUM_EXPANSION) {
      (gameState.boneUnlocks as Record<string, boolean>)[def.id] = !!unlocks[def.id];
    }
    if (ids.has(selected)) gameState.selectedCorgi = selected as CorgiId;
  };
}

function installAssetPipeline(SceneClass: { prototype: object }): void {
  const prototype = SceneClass.prototype as {
    preload?: (...args: unknown[]) => unknown;
    create?: (...args: unknown[]) => unknown;
  };

  const originalPreload = prototype.preload;
  prototype.preload = function (this: Phaser.Scene, ...args: unknown[]): unknown {
    const result = originalPreload?.apply(this, args);
    queuePremiumExpansionAtlases(this);
    return result;
  };

  const originalCreate = prototype.create;
  prototype.create = function (this: Phaser.Scene, ...args: unknown[]): unknown {
    buildPremiumExpansionPngTextures(this);
    return originalCreate?.apply(this, args);
  };
}

export function installPremiumExpansion(SceneClass: { prototype: object }): void {
  if (installed) return;
  installed = true;
  registerDefinitions();
  restoreExpansionSaves();
  installAssetPipeline(SceneClass);
}
