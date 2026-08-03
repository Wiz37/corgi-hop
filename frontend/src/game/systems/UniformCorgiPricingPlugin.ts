import { CORGIS, CORGI_BONE_PRICE } from './GameState';

const UNLOCK_PRICE_BONES = 1000;
let installed = false;

/**
 * Keeps the Classic Corgi free and prices every other selectable corgi at the
 * same 1,000-Bone unlock cost. Install this after NewCorgiPack so its runtime
 * characters are included as well.
 */
export function installUniformCorgiPricing(): void {
  if (installed) return;
  installed = true;

  const prices = CORGI_BONE_PRICE as unknown as Record<string, number>;
  const corgis = CORGIS as unknown as Array<{ id: string }>;

  for (const corgi of corgis) {
    prices[corgi.id] = corgi.id === 'classic' ? 0 : UNLOCK_PRICE_BONES;
  }
}
