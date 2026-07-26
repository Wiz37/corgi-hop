import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@/main';
import { gameState, CORGIS, type CorgiId } from '@/game/systems/GameState';
import { PolishedButton } from '@/game/ui/PolishedButton';

/**
 * CorgiSelectScene — clean corgi picker.
 *
 * ROOT-CAUSE FIX (bug 5 — "gameplay dog running behind cards"):
 * Previously this scene called `buildParallax(this) + scatterMenuDecor(this, 920)`,
 * which drew all six parallax layers plus scatter decor beneath the cards.
 * Even though no gameplay corgi was launched here, the illustrated
 * countryside behind the cards visually competed with the selection UI and
 * looked like a live gameplay scene continuing under the picker.
 * Fixed by replacing the parallax background with a clean static polished
 * gradient background so the cards read cleanly.
 */
export class CorgiSelectScene extends Phaser.Scene {
  constructor() { super('CorgiSelectScene'); }

  create(): void {
    // ---- Clean static polished background (no gameplay dog, no parallax) ----
    const g = this.add.graphics().setDepth(0);
    // Soft blue sky gradient
    g.fillGradientStyle(0x3fa7ff, 0x3fa7ff, 0xd8efff, 0xd8efff, 1, 1, 1, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT * 0.72);
    // Rolling grass strip along the bottom (static — no parallax)
    g.fillGradientStyle(0x86d17a, 0x6ec867, 0x66bd60, 0x5dae57, 1);
    g.fillRect(0, GAME_HEIGHT * 0.72, GAME_WIDTH, GAME_HEIGHT * 0.28);
    // Two soft static cloud silhouettes for warmth
    g.fillStyle(0xffffff, 0.55);
    g.fillEllipse(200, 140, 240, 60);
    g.fillEllipse(540, 210, 260, 70);
    // Subtle dim overlay so the cards pop
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
    CORGIS.forEach((cd, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      this.buildCard(startX + col * (cardW + gapX), startY + row * (cardH + gapY), cardW, cardH, cd.id);
    });

    new PolishedButton(this, {
      x: GAME_WIDTH / 2, y: GAME_HEIGHT - 90, w: 320, h: 100,
      label: 'BACK', color: 0x2a3d67, shadowColor: 0x18223a,
      testId: 'select-back',
      onTap: () => this.scene.start('MenuScene'),
    });
  }

  private buildCard(x: number, y: number, w: number, h: number, id: CorgiId): void {
    const def = CORGIS.find((c) => c.id === id)!;
    const owned = gameState.isCorgiOwned(id);
    const selected = gameState.selectedCorgi === id;
    const c = this.add.container(x, y).setDepth(25);

    const g = this.add.graphics();
    g.fillStyle(0x18223a, 0.4);
    g.fillRoundedRect(-w / 2 + 4, -h / 2 + 6, w, h, 26);
    g.fillStyle(0xfff8ea, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 26);
    g.lineStyle(selected ? 8 : 5, selected ? 0xffb02f : 0x24304a, 1);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 26);
    c.add(g);

    // Preview art — the approved static polished portrait for this corgi.
    // The card is CLIPPED to its bounds via the container mask so the preview
    // never overflows even if the source art is oversized.
    const tex = this.textures.exists(def.texture) ? def.texture : 'corgi_idle';
    const img = this.add.image(0, -50, tex)
      .setDisplaySize(200, 200)
      .setAlpha(1)
      .setFlipX(false);   // always right-facing
    if (def.tint) img.setTint(def.tint);
    c.add(img);

    // Name label
    c.add(this.add.text(0, 70, def.name, {
      fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: '22px', fontStyle: '900', color: '#24304a',
    }).setOrigin(0.5));

    // Action button
    const price = gameState.bonePriceFor(id);
    let actionLabel: string;
    let color = 0x4bb8ff, shadow = 0x1f6ea0;
    if (owned) {
      actionLabel = selected ? 'SELECTED' : 'SELECT';
      color = selected ? 0xffb02f : 0x4bb04b;
      shadow = selected ? 0xb26810 : 0x1e6b1e;
    } else if (price > 0) {
      // Bone-buy button: show the exact price. Colour = orange (spend cue).
      actionLabel = `BUY  ${price}`;
      color = 0xffb02f; shadow = 0xb26810;
      // Also show a small "bone" glyph label beneath the price so the price
      // is unambiguous even without the icon font.
      c.add(this.add.text(0, 108, `BONES`, {
        fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: '14px',
        fontStyle: '700', color: '#8a5000',
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
      onTap: async () => {
        if (owned) {
          // Persist immediately so selection survives app relaunch.
          gameState.selectedCorgi = id;
          gameState.saveSelected();
          gameState.clearTrial();
          this.scene.restart();
        } else if (price > 0) {
          // Bone-based unlock — show confirm dialog before spending.
          this.showBonePurchaseConfirm(id, price, def.name);
        }
      },
    });

    // Owned-badge for corgis already unlocked with bones — reassurance that
    // the previous purchase persisted.
    if (owned && id !== 'classic') {
      const badge = this.add.container(w / 2 - 30, -h / 2 + 30);
      const bg = this.add.graphics();
      bg.fillStyle(0x4bb04b, 1); bg.fillCircle(0, 0, 22);
      bg.lineStyle(3, 0xffffff, 1); bg.strokeCircle(0, 0, 22);
      badge.add(bg);
      badge.add(this.add.text(0, 0, '✓', {
        fontFamily: 'system-ui', fontSize: '28px', fontStyle: '900', color: '#ffffff',
      }).setOrigin(0.5));
      c.add(badge);
    }

    c.setData('testId', `select-corgi-${id}`);
  }

  /**
   * Bone-purchase confirmation dialog. Non-blocking to gameplay (we're on the
   * corgi picker scene). Anti double-tap enforced BOTH via the local
   * `confirming` guard and via GameState's purchaseInFlight semaphore.
   */
  private confirming = false;
  private showBonePurchaseConfirm(id: CorgiId, price: number, name: string): void {
    if (this.confirming) return;
    if (gameState.treats < price) {
      this.showToast(`Need ${price - gameState.treats} more Bones`);
      return;
    }
    this.confirming = true;
    // Dim overlay
    const dim = this.add.graphics().setDepth(60);
    dim.fillStyle(0x000000, 0.55); dim.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    dim.setInteractive(new Phaser.Geom.Rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT), Phaser.Geom.Rectangle.Contains);
    // Card
    const cx = GAME_WIDTH / 2, cy = GAME_HEIGHT / 2;
    const cardW = 520, cardH = 380;
    const cardG = this.add.graphics().setDepth(61);
    cardG.fillStyle(0xfff8ea, 1);
    cardG.fillRoundedRect(cx - cardW/2, cy - cardH/2, cardW, cardH, 24);
    cardG.lineStyle(6, 0xffb02f, 1);
    cardG.strokeRoundedRect(cx - cardW/2, cy - cardH/2, cardW, cardH, 24);
    const title = this.add.text(cx, cy - 130, 'CONFIRM UNLOCK', {
      fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: '30px', fontStyle: '900', color: '#24304a',
    }).setOrigin(0.5).setDepth(62);
    const body = this.add.text(cx, cy - 60,
      `Unlock ${name} for\n${price} Bones?`, {
      fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: '26px', color: '#24304a', align: 'center',
    }).setOrigin(0.5).setDepth(62);
    const balance = this.add.text(cx, cy + 10,
      `Balance: ${gameState.treats} → ${gameState.treats - price}`, {
      fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: '22px', fontStyle: '700', color: '#8a5000',
    }).setOrigin(0.5).setDepth(62);
    // Buttons
    let closed = false;
    const close = () => {
      if (closed) return; closed = true;
      dim.destroy(); cardG.destroy(); title.destroy(); body.destroy(); balance.destroy();
      confirmBtn.destroy(); cancelBtn.destroy();
      this.confirming = false;
    };
    const cancelBtn = new PolishedButton(this, {
      x: cx - 120, y: cy + 110, w: 200, h: 76,
      label: 'CANCEL', color: 0x2a3d67, shadowColor: 0x18223a,
      testId: `bone-buy-cancel-${id}`,
      onTap: () => close(),
    });
    const confirmBtn = new PolishedButton(this, {
      x: cx + 120, y: cy + 110, w: 200, h: 76,
      label: 'CONFIRM', color: 0x4bb04b, shadowColor: 0x1e6b1e,
      testId: `bone-buy-confirm-${id}`,
      onTap: () => {
        if (closed) return;    // anti double-tap
        closed = true;         // seal even before GameState guard fires
        const res = gameState.unlockCorgiWithBones(id);
        close();
        if (res.ok) {
          this.showToast(`Unlocked ${name}!  −${res.spent} Bones`);
          // Rebuild the scene so the new "SELECTED" state is reflected.
          this.time.delayedCall(500, () => this.scene.restart());
        } else {
          this.showToast(res.reason ?? 'Purchase failed');
        }
      },
    });
  }

  private showToast(text: string): void {
    const t = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 200, text, {
      fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: '24px', fontStyle: '900',
      color: '#ffffff', backgroundColor: '#18223a', padding: { left: 16, right: 16, top: 10, bottom: 10 },
    }).setOrigin(0.5).setDepth(80);
    this.tweens.add({
      targets: t, alpha: 0, y: t.y - 40, duration: 1800,
      onComplete: () => t.destroy(),
    });
  }
}
