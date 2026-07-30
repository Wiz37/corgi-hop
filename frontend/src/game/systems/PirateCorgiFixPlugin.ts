import Phaser from 'phaser';
import { gameState, type CorgiId } from './GameState';

const BACKING_KEY = 'pirate_hat_solid_backing';
let installed = false;

function buildSolidHatBacking(scene: any): void {
  if (scene.textures?.exists?.(BACKING_KEY)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0x101827, 1);
  g.fillRoundedRect(0, 0, 72, 36, 16);
  g.lineStyle(2, 0x05080f, 1);
  g.strokeRoundedRect(0, 0, 72, 36, 16);
  g.generateTexture(BACKING_KEY, 72, 36);
  g.destroy();
}

function walkDisplayTree(node: any, visit: (child: any) => void): void {
  visit(node);
  if (Array.isArray(node?.list)) {
    for (const child of node.list) walkDisplayTree(child, visit);
  }
}

function removeOldSkullOverlays(scene: any): void {
  for (const root of [...(scene.children?.list ?? [])]) {
    walkDisplayTree(root, (child) => {
      if (child?.getData?.('pirateHatOverlay')) child.destroy?.();
    });
  }
}

function attachPortraitBacking(scene: any, portrait: any): void {
  if (portrait?.getData?.('pirateHatBackingAdded')) return;
  portrait?.setData?.('pirateHatBackingAdded', true);
  buildSolidHatBacking(scene);

  const displayW = Math.max(1, Number(portrait.displayWidth) || 188);
  const displayH = Math.max(1, Number(portrait.displayHeight) || 188);
  const backing = scene.add.image(0, 0, BACKING_KEY)
    .setDisplaySize(displayW * 0.24, displayH * 0.12)
    .setAlpha(1)
    .setData('pirateHatBacking', true);

  const localX = Number(portrait.x) + displayW * 0.07;
  const localY = Number(portrait.y) - displayH * 0.34;
  const parent = portrait.parentContainer;
  if (parent?.addAt) {
    const portraitIndex = Math.max(0, Number(parent.getIndex?.(portrait)) || 0);
    parent.addAt(backing, portraitIndex);
    backing.setPosition(localX, localY);
  } else {
    backing
      .setPosition(localX, localY)
      .setDepth(Math.max(0, (Number(portrait.depth) || 1) - 0.1));
  }
}

function repairPiratePortraits(scene: any): void {
  buildSolidHatBacking(scene);
  removeOldSkullOverlays(scene);

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
      attachPortraitBacking(scene, child);
    });

    const testId = root?.getData?.('testId');
    if (typeof testId === 'string' && testId.startsWith('select-corgi-') && testId.endsWith('-btn')) {
      const label = root.list?.find?.((child: any) => child instanceof Phaser.GameObjects.Text);
      label?.setFontSize?.(24);
    }
  }
}

function addGameplayHatBacking(scene: any): void {
  if (gameState.selectedCorgi !== 'pirate' || !scene.corgi) return;
  buildSolidHatBacking(scene);
  removeOldSkullOverlays(scene);

  // This sits BEHIND the existing pirate hat. It fills transparent pixels but
  // does not draw another skull, so the original hat art remains unchanged.
  const backing = scene.add.image(scene.corgi.x + 10, scene.corgi.y - 132, BACKING_KEY)
    .setDisplaySize(38, 20)
    .setDepth(14.9)
    .setAlpha(1)
    .setData('pirateHatBacking', true);

  const follow = () => {
    if (!backing.active || !scene.corgi?.active) return;
    backing.setPosition(scene.corgi.x + 10, scene.corgi.y - 132);
    backing.setVisible(!scene.ended && gameState.selectedCorgi === 'pirate');
  };
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, follow);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, follow);
    backing.destroy();
  });
}

/**
 * Fixes the stale pointer-release purchase loop and fills the transparent
 * Pirate-hat area without adding a duplicate skull emblem.
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
    addGameplayHatBacking(this);
    return result;
  };

  const selectProto = CorgiSelectSceneClass.prototype as any;
  const originalSelectCreate = selectProto.create;
  selectProto.create = function (...args: unknown[]) {
    const result = originalSelectCreate.apply(this, args);
    this.time.delayedCall(0, () => repairPiratePortraits(this));
    return result;
  };

  const originalConfirm = selectProto.showBonePurchaseConfirm;
  selectProto.showBonePurchaseConfirm = function (id: CorgiId, price: number, name: string) {
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
