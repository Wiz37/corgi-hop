import Phaser from 'phaser';
import { gameState } from './GameState';

const BACKING_KEY = 'pirate_hat_solid_backing';
let installed = false;

function ensureBackingTexture(scene: any): void {
  if (scene.textures?.exists?.(BACKING_KEY)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0x101827, 1);
  g.fillRoundedRect(0, 0, 72, 36, 16);
  g.lineStyle(2, 0x05080f, 1);
  g.strokeRoundedRect(0, 0, 72, 36, 16);
  g.generateTexture(BACKING_KEY, 72, 36);
  g.destroy();
}

function walk(node: any, visit: (child: any) => void): void {
  visit(node);
  if (Array.isArray(node?.list)) {
    for (const child of node.list) walk(child, visit);
  }
}

function addPortraitBacking(scene: any, portrait: any): void {
  if (portrait?.getData?.('pirateHatBackingAdded')) return;
  portrait?.setData?.('pirateHatBackingAdded', true);
  ensureBackingTexture(scene);

  const w = Math.max(1, Number(portrait.displayWidth) || 188);
  const h = Math.max(1, Number(portrait.displayHeight) || 188);
  const backing = scene.add.image(0, 0, BACKING_KEY)
    .setDisplaySize(w * 0.24, h * 0.12)
    .setDepth(Math.max(0, (Number(portrait.depth) || 1) - 1))
    .setData('pirateHatBacking', true);

  const localX = Number(portrait.x) + w * 0.07;
  const localY = Number(portrait.y) - h * 0.34;
  if (portrait.parentContainer?.add) {
    portrait.parentContainer.addAt?.(backing, 0);
    if (!backing.parentContainer) portrait.parentContainer.add(backing);
    backing.setPosition(localX, localY);
  } else {
    backing.setPosition(localX, localY);
  }
}

function fixSelectionPortraits(scene: any): void {
  for (const root of scene.children?.list ?? []) {
    walk(root, (child) => {
      const key = child?.texture?.key;
      if (key === 'corgi_pirate' || key === 'pirate_run') addPortraitBacking(scene, child);
      if (child?.getData?.('pirateHatOverlay')) child.destroy?.();
    });
  }
}

function addGameplayBacking(scene: any): void {
  if (gameState.selectedCorgi !== 'pirate' || !scene.corgi) return;
  ensureBackingTexture(scene);

  for (const child of scene.children?.list ?? []) {
    if (child?.getData?.('pirateHatOverlay')) child.destroy?.();
  }

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

export function installPirateHatBacking(
  GameSceneClass: { prototype: object },
  CorgiSelectSceneClass: { prototype: object },
): void {
  if (installed) return;
  installed = true;

  const gameProto = GameSceneClass.prototype as any;
  const originalGameCreate = gameProto.create;
  gameProto.create = function (...args: unknown[]) {
    const result = originalGameCreate.apply(this, args);
    addGameplayBacking(this);
    return result;
  };

  const selectProto = CorgiSelectSceneClass.prototype as any;
  const originalSelectCreate = selectProto.create;
  selectProto.create = function (...args: unknown[]) {
    const result = originalSelectCreate.apply(this, args);
    this.time.delayedCall(0, () => fixSelectionPortraits(this));
    return result;
  };
}
