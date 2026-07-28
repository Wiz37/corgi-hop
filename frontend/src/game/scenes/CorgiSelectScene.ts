import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@/main';
import { gameState, CORGIS, type CorgiId } from '@/game/systems/GameState';
import { PolishedButton } from '@/game/ui/PolishedButton';

export class CorgiSelectScene extends Phaser.Scene {
  private confirming = false;

  constructor() { super('CorgiSelectScene'); }

  create(): void {
    this.confirming = false;

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

    this.add.text(GAME_WIDTH / 2, 72, 'CHOOSE CORGI', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '56px', fontStyle: '900',
      color: '#ffb02f', stroke: '#ffffff', strokeThickness: 12,
      shadow: { color: '#24304a', fill: true, blur: 4, offsetX: 0, offsetY: 6 },
    }).setOrigin(0.5).setDepth(30).setData('testId', 'select-title');

    this.add.text(GAME_WIDTH / 2, 132, 'Tap a locked corgi to review and confirm the unlock', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '18px', fontStyle: '800', color: '#ffffff',
      stroke: '#24304a', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(30);

    const cols = 2;
    const cardW = 300, cardH = 326;
    const gapX = 30, gapY = 24;
    const totalW = cols * cardW + (cols - 1) * gapX;
    const startX = (GAME_WIDTH - totalW) / 2 + cardW / 2;
    const startY = 205;
    CORGIS.forEach((corgi, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      this.buildCard(startX + col * (cardW + gapX), startY + row * (cardH + gapY), cardW, cardH, corgi.id);
    });

    new PolishedButton(this, {
      x: GAME_WIDTH / 2, y: GAME_HEIGHT - 58, w: 300, h: 76,
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
    const image = this.add.image(0, -48, texture)
      .setDisplaySize(188, 188)
      .setAlpha(1)
      .setFlipX(false);
    if (def.tint) image.setTint(def.tint);
    card.add(image);

    card.add(this.add.text(0, 62, def.name, {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '21px', fontStyle: '900', color: '#24304a',
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
      actionLabel = `UNLOCK  ${price}`;
      color = 0xffb02f;
      shadow = 0xb26810;
      card.add(this.add.text(0, 96, 'BONES', {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '13px', fontStyle: '800', color: '#8a5000',
      }).setOrigin(0.5));
    } else {
      actionLabel = 'LOCKED';
    }

    const handleCardChoice = () => {
      if (owned) {
        gameState.selectedCorgi = id;
        gameState.saveSelected();
        gameState.clearTrial();
        this.scene.restart();
      } else if (price > 0) {
        this.showBonePurchaseConfirm(id, price, def.name);
      }
    };

    new PolishedButton(this, {
      x, y: y + 128, w: 224, h: 72,
      label: actionLabel,
      color, shadowColor: shadow,
      testId: `select-corgi-${id}-btn`,
      fontSize: 19,
      onTap: handleCardChoice,
    });

    card.setSize(w, h - 62);
    card.setInteractive(
      new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h - 62),
      Phaser.Geom.Rectangle.Contains,
    );
    card.on('pointerup', handleCardChoice);
    card.on('pointerdown', () => this.tweens.add({ targets: card, scale: 0.97, duration: 60, yoyo: true }));

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

  private showBonePurchaseConfirm(id: CorgiId, price: number, name: string): void {
    if (this.confirming) return;

    this.confirming = true;
    let isClosed = false;
    let purchaseInFlight = false;
    const canAfford = gameState.treats >= price;
    const shortage = Math.max(0, price - gameState.treats);
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const cardW = 620;
    const cardH = 570;

    const dim = this.add.graphics().setDepth(90);
    dim.fillStyle(0x000000, 0.74);
    dim.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    dim.setInteractive(new Phaser.Geom.Rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT), Phaser.Geom.Rectangle.Contains);

    const cardG = this.add.graphics().setDepth(91);
    cardG.fillStyle(0x18223a, 0.45);
    cardG.fillRoundedRect(cx - cardW / 2 + 5, cy - cardH / 2 + 9, cardW, cardH, 30);
    cardG.fillStyle(0xfff8ea, 1);
    cardG.fillRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 30);
    cardG.lineStyle(7, canAfford ? 0x4bb04b : 0xffb02f, 1);
    cardG.strokeRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 30);

    const title = this.add.text(cx, cy - 242, 'UNLOCK THIS CORGI?', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '34px', fontStyle: '900', color: '#24304a',
    }).setOrigin(0.5).setDepth(92);

    const def = CORGIS.find((corgi) => corgi.id === id)!;
    const previewKey = this.textures.exists(def.texture) ? def.texture : 'corgi_idle';
    const preview = this.add.image(cx, cy - 130, previewKey)
      .setDisplaySize(200, 200)
      .setFlipX(false)
      .setDepth(92);
    if (def.tint) preview.setTint(def.tint);

    const body = this.add.text(cx, cy - 10, name, {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '30px', fontStyle: '900', color: '#24304a', align: 'center',
    }).setOrigin(0.5).setDepth(92);
    const priceText = this.add.text(cx, cy + 40, `${price} BONES`, {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '30px', fontStyle: '900', color: '#b26810',
    }).setOrigin(0.5).setDepth(92);
    const balance = this.add.text(cx, cy + 86, `Balance: ${gameState.treats}  →  ${Math.max(0, gameState.treats - price)}`, {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '22px', fontStyle: '700', color: '#526078',
    }).setOrigin(0.5).setDepth(92);
    const status = this.add.text(cx, cy + 126,
      canAfford ? 'This corgi will be unlocked and equipped.' : `You need ${shortage} more Bones.`, {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '20px', fontStyle: '900',
        color: canAfford ? '#1e6b1e' : '#b23a2b',
      }).setOrigin(0.5).setDepth(92);

    let cancelButton: PolishedButton;
    let confirmButton: PolishedButton;
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
      status.destroy();
      cancelButton.destroy();
      confirmButton.destroy();
      this.confirming = false;
    };

    cancelButton = new PolishedButton(this, {
      x: cx - 150, y: cy + 215, w: 225, h: 84,
      label: 'CANCEL', color: 0x73809a, shadowColor: 0x46516a,
      depth: 94,
      testId: `bone-buy-cancel-${id}`,
      onTap: cleanup,
    });

    confirmButton = new PolishedButton(this, {
      x: cx + 135, y: cy + 215, w: 320, h: 84,
      label: 'CONFIRM UNLOCK',
      color: canAfford ? 0x4bb04b : 0x9aa4b5,
      shadowColor: canAfford ? 0x1e6b1e : 0x626d80,
      depth: 94,
      fontSize: 20,
      testId: `bone-buy-confirm-${id}`,
      onTap: () => {
        if (isClosed || purchaseInFlight) return;
        if (!canAfford) {
          this.showToast(`Need ${shortage} more Bones`);
          return;
        }
        purchaseInFlight = true;
        const result = gameState.unlockCorgiWithBones(id);
        cleanup();
        if (result.ok) {
          this.showToast(`Unlocked and equipped ${name}!  −${result.spent} Bones`);
          this.time.delayedCall(500, () => this.scene.restart());
        } else {
          this.showToast(result.reason ?? 'Purchase failed');
        }
      },
    });
  }

  private showToast(text: string): void {
    const toast = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 170, text, {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '24px', fontStyle: '900', color: '#ffffff', backgroundColor: '#18223a',
      padding: { left: 16, right: 16, top: 10, bottom: 10 },
    }).setOrigin(0.5).setDepth(120);
    this.tweens.add({
      targets: toast, alpha: 0, y: toast.y - 40, duration: 1800,
      onComplete: () => toast.destroy(),
    });
  }
}
