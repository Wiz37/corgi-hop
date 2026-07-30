import Phaser from 'phaser';
import { gameState, type CorgiId } from './GameState';

const PATCH_KEY = 'pirate_hat_badge_opaque';
let installed = false;

function buildOpaqueHatBadge(scene: any): void {
  if (scene.textures?.exists?.(PATCH_KEY)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  // Solid dark backing prevents the scenery / Bone art from showing through.
  g.fillStyle(0x101827, 1);
  g.fillRoundedRect(1, 4, 70, 38, 17);
  g.lineStyle(3, 0x05080f, 1);
  g.strokeRoundedRect(1, 4, 70, 38, 17);

  // Crossbones.
  g.lineStyle(6, 0xf7f1df, 1);
  g.beginPath();
  g.moveTo(17, 14); g.lineTo(52, 34);
  g.moveTo(52, 14); g.lineTo(17, 34);
  g.strokePath();
  g.fillStyle(0xf7f1df, 1);
  g.fillCircle(15, 13, 4); g.fillCircle(54, 35, 4);
  g.fillCircle(54, 13, 4); g.fillCircle(15, 35, 4);

  // Skull.
  g.fillStyle(0xf7f1df, 1);
  g.fillCircle(35, 22, 11);
  g.fillRoundedRect(28, 25, 14, 10, 4);
  g.fillStyle(0x101827, 1);
  g.fillCircle(31, 21, 3);
  g.fillCircle(39, 21, 3);
  g.fillTriangle(35, 24, 32, 29, 38, 29);

  g.generateTexture(PATCH_KEY, 72, 44);
  g.destroy();
}

function walkDisplayTree(node: any, visit: (child: any) => void): void {
  visit(node);
  if (Array.isArray(node?.list)) {
    for (const child of node.list) walkDisplayTree(child, visit);
  }
}

function attachPortraitBadge(scene: any, portrait: any): void {
  if (portrait?.getData?.('opaquePirateHatFixed')) return;
  portrait?.setData?.('opaquePirateHatFixed', true);

  const displayW = Math.max(1, Number(portrait.displayWidth) || 188);
  const displayH = Math.max(1, Number(portrait.displayHeight) || 188);
  const badge = scene.add.image(0, 0, PATCH_KEY)
    .setDisplaySize(displayW * 0.25, displayH * 0.15)
    .setDepth((Number(portrait.depth) || 0) + 2)
    .setData('pirateHatOverlay', true);

  const localX = Number(portrait.x) + displayW * 0.10;
  const localY = Number(portrait.y) - displayH * 0.34;
  if (portrait.parentContainer?.add) {
    portrait.parentContainer.add(badge);
    badge.setPosition(localX, localY);
  } else {
    badge.setPosition(localX, localY);
  }
}

function repairPiratePortraits(scene: any): void {
  buildOpaqueHatBadge(scene);
  for (const root of scene.children?.list ?? []) {
    walkDisplayTree(root, (child) => {
      const key = child?.texture?.key;
      if (key !== 'corgi_pirate' && key !== 'pirate_run') return;
      if (typeof child.setTexture !== 'function') return;

      const w = Math.max(1, Number(child.displayWidth) || 188);
      const h = Math.max(1, Number(child.displayHeight) || 188);
      if (scene.textures?.exists?.('pirate_run')) child.setTexture('pirate_run', 0);
      child.setDisplaySize?.(w, h);
      child.setAlpha?.(1);
      child.clearTint?.();
      attachPortraitBadge(scene, child);
    });

    const testId = root?.getData?.('testId');
    if (typeof testId === 'string' && testId.startsWith('select-corgi-') && testId.endsWith('-btn')) {
      const label = root.list?.find?.((child: any) => child instanceof Phaser.GameObjects.Text);
      label?.setFontSize?.(24);
    }
  }
}

function addGameplayHatPatch(scene: any): void {
  if (gameState.selectedCorgi !== 'pirate' || !scene.corgi) return;
  buildOpaqueHatBadge(scene);

  const badge = scene.add.image(scene.corgi.x + 14, scene.corgi.y - 132, PATCH_KEY)
    .setDisplaySize(38, 24)
    .setDepth(16)
    .setAlpha(1);

  const follow = () => {
    if (!badge.active || !scene.corgi?.active) return;
    badge.setPosition(scene.corgi.x + 14, scene.corgi.y - 132);
    badge.setVisible(!scene.ended && gameState.selectedCorgi === 'pirate');
  };
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, follow);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, follow);
    badge.destroy();
  });
}

/**
 * Fixes the stale pointer-release purchase loop and replaces the transparent
 * pirate skull area with a fully opaque badge in menus and gameplay.
 */
export function installPirateCorgiFix(
  GameSceneClass: { prototype: object },
  CorgiSelectSceneClass: { prototype: object },
): void {
  if (installed) return;
  installed = true;

  const gameProto = GameSceneClass.prototype as any;
  const originalGameCreate = gameProto.create;
  gameProto.create = function (...args: unknown[]) {
    const result = originalGameCreate.apply(this, args);
    addGameplayHatPatch(this);
    return result;
  };

  const selectProto = CorgiSelectSceneClass.prototype as any;
  const originalSelectCreate = selectProto.create;
  selectProto.create = function (...args: unknown[]) {
    const result = originalSelectCreate.apply(this, args);
    repairPiratePortraits(this);
    return result;
  };

  const originalConfirm = selectProto.showBonePurchaseConfirm;
  selectProto.showBonePurchaseConfirm = function (id: CorgiId, price: number, name: string) {
    // The confirm button activates on touch-down. The same finger release can
    // reach the card after the modal closes; always re-check live ownership so
    // that release selects the corgi instead of reopening the purchase modal.
    if (gameState.isCorgiOwned(id)) {
      this.confirming = false;
      gameState.selectedCorgi = id;
      gameState.saveSelected();
      gameState.clearTrial();
      this.time.delayedCall(40, () => this.scene.restart());
      return;
    }

    const result = originalConfirm.call(this, id, price, name);
    if (id === 'pirate') this.time.delayedCall(0, () => repairPiratePortraits(this));
    return result;
  };
}
