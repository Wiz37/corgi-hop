import { gameState, type CorgiId } from './GameState';

let installed = false;

/**
 * Keeps the Pirate Corgi purchase/selection flow atomic.
 *
 * Pirate artwork is repaired directly in pirate_run_sheet.png. No runtime
 * overlay or backing object is added, so nothing can drift, duplicate, or show
 * around the hat while the corgi animates.
 */
export function installPirateCorgiFix(
  _GameSceneClass: { prototype: object },
  CorgiSelectSceneClass: { prototype: object },
): void {
  if (installed) return;
  installed = true;

  const selectProto = CorgiSelectSceneClass.prototype as any;
  const originalConfirm = selectProto.showBonePurchaseConfirm;

  selectProto.showBonePurchaseConfirm = function (
    id: CorgiId,
    price: number,
    name: string,
  ) {
    // Buttons activate on touch-down. Re-check live ownership so the release
    // from the same finger cannot reopen the purchase modal after a successful
    // Pirate unlock.
    if (gameState.isCorgiOwned(id)) {
      this.confirming = false;
      gameState.selectedCorgi = id;
      gameState.saveSelected();
      gameState.clearTrial();
      this.time.delayedCall(40, () => this.scene.restart());
      return;
    }

    return originalConfirm.call(this, id, price, name);
  };
}
