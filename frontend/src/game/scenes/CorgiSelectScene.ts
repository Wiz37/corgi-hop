import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@/main';
import { gameState, CORGIS, type CorgiId } from '@/game/systems/GameState';
import { PolishedButton } from '@/game/ui/PolishedButton';

export class CorgiSelectScene extends Phaser.Scene {
  constructor() { super('CorgiSelectScene'); }

  create(): void {
    const g = this.add.graphics().setDepth(0);
    g.fillGradientStyle(0x3fa7ff, 0x3fa7ff, 0xd8efff, 0xd8efff, 1, 1, 1, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT * 0.72);
    g.fillGradientStyle(0x86d17a, 0x6ec867, 0x66bd60, 0x5dae57, 1);
    g.fillRect(0, GAME_HEIGHT * 0.72, GAME_WIDTH, GAME_HEIGHT * 0.28);
    g.fillStyle(0xffffff, 0.55);
    g.fillEllipse(200, 140, 240, 60);
    g.fillEllipse(540, 210, 260, 70);
    g.fillStyle(0x000000, 0.22);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this.add.text(GAME_WIDTH / 2, 90, 'CHOOSE CORGI', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '60px', fontStyle: '900',
      color: '#ffb02f', stroke: '#ffffff', strokeThickness: 12,
      shadow: { color: '#24304a', fill: true, blur: 4, offsetX: 0, offsetY: 6 },
    }).setOrigin(0.5).setDepth(30).setData('testId', 'select-title');

    const cols = 2;
    const cardW = 300, cardH = 340;
    const gapX = 30, gapY = 30;
    const totalW = cols * cardW + (cols - 1) * gapX;
    const startX = (GAME_WIDTH - totalW) / 2 + cardW / 2;
    const startY = 210;
    CORGIS.forEach((corgi, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      this.buildCard(startX + col * (cardW + gapX), startY + row * (cardH + gapY), cardW, cardH, corgi.id);
    });

    new PolishedButton(this, {
      x: GAME_WIDTH / 2, y: GAME_HEIGHT - 90, w: 320, h: 100,
      label: 'BACK', color: 0x2a3d67, shadowColor: 0x18223a,
      testId: 'select-back',
      onTap: () => this.scene.start('MenuScene'),
    });
  }

  private buildCard(x: number, y: number, w: number, h: number, id: CorgiId): void {
    const def = CORGIS.find((corgi) => corgi.id === id)!;
    const owned = gameState.isCorgiOwned(id);
    const selected = gameState.selectedCorgi === id;
    const card = this.add.container(x, y).setDepth(25);

    const g = this.add.graphics();
    g.fillStyle(0x18223a, 0.4);
    g.fillRoundedRect(-w / 2 + 4, -h / 2 + 6, w, h, 26);
    g.fillStyle(0xfff8ea, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 26);
    g.lineStyle(selected ? 8 : 5, selected ? 0xffb02f : 0x24304a, 1);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 26);
    card.add(g);

    const texture = this.textures.exists(def.texture) ? def.texture : 'corgi_idle';
    const image = this.add.image(0, -50, texture)
      .setDisplaySize(200, 200)
      .setAlpha(1)
      .setFlipX(false);
    if (def.tint) image.setTint(def.tint);
    card.add(image);

    card.add(this.add.text(0, 70, def.name, {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '22px', fontStyle: '900', color: '#24304a',
    }).setOrigin(0.5));

    const price = gameState.bonePriceFor(id);
    let actionLabel: string;
    let color = 0x4bb8ff;
    let shadow = 0x1f6ea0;
    if (owned) {
      actionLabel = selected ? 'SELECTED' : 'SELECT';
      color = selected ? 0xffb02f : 0x4bb04b;
      shadow = selected ? 0xb26810 : 0x1e6b1e;
    } else if (price > 0) {
      actionLabel = `BUY  ${price}`;
      color = 0xffb02f;
      shadow = 0xb26810;
      card.add(this.add.text(0, 108, 'BONES', {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '14px', fontStyle: '700', color: '#8a5000',
      }).setOrigin(0.5));
    } else {
      actionLabel = 'LOCKED';
    }

    new PolishedButton(this, {
      x, y: y + 140, w: 220, h: 78,
      label: actionLabel,
      color, shadowColor: shadow,
      testId: `select-corgi-${id}-btn`,
      fontSize: 20,
      onTap: () => {
        if (owned) {
          gameState.selectedCorgi = id;
          gameState.saveSelected();
          gameState.clearTrial();
          this.scene.restart();
        } else if (price > 0) {
          this.showBonePurchaseConfirm(id, price, def.name);
        }
      },
    });

    if (owned && id !== 'classic') {
      const badge = this.add.container(w / 2 - 30, -h / 2 + 30);
      const bg = this.add.graphics();
      bg.fillStyle(0x4bb04b, 1);
      bg.fillCircle(0, 0, 22);
      bg.lineStyle(3, 0xffffff, 1);
      bg.strokeCircle(0, 0, 22);
      badge.add(bg);
      badge.add(this.add.text(0, 0, '✓', {
        fontFamily: 'system-ui', fontSize: '28px', fontStyle: '900', color: '#ffffff',
      }).setOrigin(0.5));
      card.add(badge);
    }

    card.setData('testId', `select-corgi-${id}`);
  }

  private confirming = false;

  private showBonePurchaseConfirm(id: CorgiId, price: number, name: string): void {
    if (this.confirming) return;
    if (gameState.treats < price) {
      this.showToast(`Need ${price - gameState.treats} more Bones`);
      return;
    }

    this.confirming = true;
    let isClosed = false;
    let purchaseInFlight = false;
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const cardW = 600;
    const cardH = 530;

    const dim = this.add.graphics().setDepth(60);
    dim.fillStyle(0x000000, 0.68);
    dim.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    dim.setInteractive(new Phaser.Geom.Rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT), Phaser.Geom.Rectangle.Contains);

    const cardG = this.add.graphics().setDepth(61);
    cardG.fillStyle(0x18223a, 0.45);
    cardG.fillRoundedRect(cx - cardW / 2 + 5, cy - cardH / 2 + 9, cardW, cardH, 30);
    cardG.fillStyle(0xfff8ea, 1);
    cardG.fillRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 30);
    cardG.lineStyle(7, 0xffb02f, 1);
    cardG.strokeRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 30);

    const title = this.add.text(cx, cy - 220, 'CONFIRM PURCHASE', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '34px', fontStyle: '900', color: '#24304a',
    }).setOrigin(0.5).setDepth(62);

    const def = CORGIS.find((corgi) => corgi.id === id)!;
    const previewKey = this.textures.exists(def.texture) ? def.texture : 'corgi_idle';
    const preview = this.add.image(cx, cy - 115, previewKey)
      .setDisplaySize(190, 190)
      .setFlipX(false)
      .setDepth(62);
    if (def.tint) preview.setTint(def.tint);

    const body = this.add.text(cx, cy + 5, name, {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '30px', fontStyle: '900', color: '#24304a', align: 'center',
    }).setOrigin(0.5).setDepth(62);
    const priceText = this.add.text(cx, cy + 53, `${price} BONES`, {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '28px', fontStyle: '900', color: '#b26810',
    }).setOrigin(0.5).setDepth(62);
    const balance = this.add.text(cx, cy + 95, `Balance: ${gameState.treats}  →  ${gameState.treats - price}`, {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '21px', fontStyle: '700', color: '#526078',
    }).setOrigin(0.5).setDepth(62);

    let cancelButton: PolishedButton;
    let buyButton: PolishedButton;
    const cleanup = () => {
      if (isClosed) return;
      isClosed = true;
      dim.destroy();
      cardG.destroy();
      title.destroy();
      preview.destroy();
      body.destroy();
      priceText.destroy();
      balance.destroy();
      cancelButton.destroy();
      buyButton.destroy();
      this.confirming = false;
    };

    cancelButton = new PolishedButton(this, {
      x: cx - 155, y: cy + 185, w: 230, h: 82,
      label: 'CANCEL', color: 0x73809a, shadowColor: 0x46516a,
      depth: 64,
      testId: `bone-buy-cancel-${id}`,
      onTap: cleanup,
    });

    buyButton = new PolishedButton(this, {
      x: cx + 120, y: cy + 185, w: 300, h: 82,
      label: `BUY FOR ${price} BONES`, color: 0x4bb04b, shadowColor: 0x1e6b1e,
      depth: 64,
      fontSize: 19,
      testId: `bone-buy-confirm-${id}`,
      onTap: () => {
        if (isClosed || purchaseInFlight) return;
        purchaseInFlight = true;
        const result = gameState.unlockCorgiWithBones(id);
        cleanup();
        if (result.ok) {
          this.showToast(`Unlocked ${name}!  −${result.spent} Bones`);
          this.time.delayedCall(500, () => this.scene.restart());
        } else {
          this.showToast(result.reason ?? 'Purchase failed');
        }
      },
    });
  }

  private showToast(text: string): void {
    const toast = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 200, text, {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '24px', fontStyle: '900', color: '#ffffff', backgroundColor: '#18223a',
      padding: { left: 16, right: 16, top: 10, bottom: 10 },
    }).setOrigin(0.5).setDepth(80);
    this.tweens.add({
      targets: toast, alpha: 0, y: toast.y - 40, duration: 1800,
      onComplete: () => toast.destroy(),
    });
  }
}
