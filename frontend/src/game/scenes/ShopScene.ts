import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@/main';
import { services } from '@/services';
import { gameState } from '@/game/systems/GameState';
import { storage, STORAGE_KEYS as K } from '@/game/systems/Storage';
import { PolishedButton } from '@/game/ui/PolishedButton';
import { buildParallax, scatterMenuDecor } from '@/game/systems/Parallax';

/** In-game shop — polished panel over the parallax scene. */
export class ShopScene extends Phaser.Scene {
  constructor() { super('ShopScene'); }

  create(): void {
    // Illustrated backdrop
    buildParallax(this);
    scatterMenuDecor(this, 920);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.35).setDepth(24);

    this.add.text(GAME_WIDTH / 2, 80, 'SHOP', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '76px', fontStyle: '900',
      color: '#ffb02f', stroke: '#ffffff', strokeThickness: 12,
      shadow: { color: '#24304a', fill: true, blur: 4, offsetX: 0, offsetY: 6 },
    }).setOrigin(0.5).setDepth(30).setData('testId', 'shop-title');

    // Treats readout at top-right
    this.drawTreatsCounter(GAME_WIDTH / 2, 160);

    if (services.purchases.isMock()) {
      this.add.text(GAME_WIDTH / 2, 210,
        'Test purchases only — real prices appear inside the iPhone and Android app',
        {
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontSize: '16px', fontStyle: '700', color: '#24304a', backgroundColor: '#ffd23c',
          padding: { left: 10, right: 10, top: 4, bottom: 4 }, wordWrap: { width: GAME_WIDTH - 60 }, align: 'center',
        }).setOrigin(0.5).setDepth(30).setData('testId', 'shop-preview-notice');
    }

    // Product cards
    const catalog = services.purchases.getCatalog();
    const startY = 300;
    const rowH = 168;
    catalog.forEach((p, i) => this.buildProductCard(startY + i * rowH, p));

    this.buildBonusTreatsRow(startY + catalog.length * rowH);

    // Bottom controls
    new PolishedButton(this, {
      x: GAME_WIDTH / 2 - 150, y: GAME_HEIGHT - 90, w: 260, h: 96,
      label: 'RESTORE', color: 0x4bb8ff, shadowColor: 0x1f6ea0,
      testId: 'shop-restore',
      onTap: async () => {
        const r = await services.purchases.restore();
        this.toast(r.kind === 'success' ? 'Purchases restored' : r.kind === 'unavailable' ? 'Restore unavailable in preview' : 'Restore failed');
      },
    });
    new PolishedButton(this, {
      x: GAME_WIDTH / 2 + 150, y: GAME_HEIGHT - 90, w: 260, h: 96,
      label: 'BACK', color: 0x2a3d67, shadowColor: 0x18223a,
      testId: 'shop-back',
      onTap: () => this.scene.start('MenuScene'),
    });
  }

  private drawTreatsCounter(x: number, y: number): void {
    const w = 250, h = 60;
    const g = this.add.graphics().setDepth(30);
    g.fillStyle(0x2a3d67, 0.95);
    g.fillRoundedRect(x - w / 2, y - h / 2, w, h, h / 2);
    g.lineStyle(4, 0xffffff, 1);
    g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, h / 2);
    if (this.textures.exists('treat')) {
      this.add.image(x - 65, y, 'treat').setDisplaySize(60, 32).setDepth(30);
    }
    this.add.text(x - 25, y, `${gameState.treats}`, {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '30px', fontStyle: '900', color: '#ffd23c', stroke: '#24304a', strokeThickness: 4,
    }).setOrigin(0, 0.5).setDepth(31);
  }

  private buildProductCard(y: number, p: ReturnType<typeof services.purchases.getCatalog>[number]): void {
    const owned = services.purchases.hasEntitlement(p.id);
    const cardW = GAME_WIDTH - 60;
    const cardH = 150;
    const c = this.add.container(GAME_WIDTH / 2, y).setDepth(25);

    const g = this.add.graphics();
    g.fillStyle(0x18223a, 0.4);
    g.fillRoundedRect(-cardW / 2 + 4, -cardH / 2 + 6, cardW, cardH, 26);
    g.fillStyle(0xfff8ea, 1);
    g.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 26);
    g.lineStyle(4, 0x24304a, 1);
    g.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 26);
    c.add(g);

    c.add(this.add.text(-cardW / 2 + 24, -cardH / 2 + 20, p.title, {
      fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: '24px', fontStyle: '900', color: '#24304a',
    }));
    c.add(this.add.text(-cardW / 2 + 24, -cardH / 2 + 58, p.description, {
      fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: '15px', fontStyle: '500', color: '#3a4655',
      wordWrap: { width: cardW - 220 },
    }));
    c.add(this.add.text(-cardW / 2 + 24, -cardH / 2 + 108, '• ' + p.benefits.join('   • '), {
      fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: '13px', fontStyle: '600', color: '#4bb04b',
      wordWrap: { width: cardW - 220 },
    }));

    // Buy button (pinned to right)
    const buyLabel = owned ? 'OWNED' : p.priceString;
    const buy = new PolishedButton(this, {
      x: cardW / 2 - 100 + GAME_WIDTH / 2, y: y, w: 180, h: 84,
      label: buyLabel,
      color: owned ? 0x2a3d67 : 0x4bb04b, shadowColor: owned ? 0x18223a : 0x1e6b1e,
      testId: `shop-buy-${p.id}`,
      fontSize: 24,
      onTap: owned ? undefined : async () => {
        const res = await services.purchases.purchase(p.id);
        if (res.kind === 'success') { this.toast(`${p.title} unlocked!`); this.scene.restart(); }
        else if (res.kind === 'cancelled') this.toast('Purchase cancelled');
        else if (res.kind === 'failed') this.toast(res.message || 'Purchase failed');
        else if (res.kind === 'offline') this.toast('You appear to be offline');
        else this.toast('Available in the iPhone and Android app');
      },
    });
    void buy;
  }

  private buildBonusTreatsRow(y: number): void {
    const todayKey = new Date().toISOString().slice(0, 10);
    const savedDay = storage.getString(K.bonusTreatsDayKey, '');
    const used = savedDay === todayKey ? storage.getNumber(K.bonusTreatsUsed, 0) : 0;
    const remaining = Math.max(0, 3 - used);

    const cardW = GAME_WIDTH - 60;
    const cardH = 130;
    const c = this.add.container(GAME_WIDTH / 2, y).setDepth(25);
    const g = this.add.graphics();
    g.fillStyle(0x18223a, 0.4);
    g.fillRoundedRect(-cardW / 2 + 4, -cardH / 2 + 6, cardW, cardH, 26);
    g.fillStyle(0xffedb5, 1);
    g.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 26);
    g.lineStyle(4, 0xb26810, 1);
    g.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 26);
    c.add(g);
    c.add(this.add.text(-cardW / 2 + 24, -cardH / 2 + 20, 'FREE +25 TREATS', {
      fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: '22px', fontStyle: '900', color: '#24304a',
    }));
    c.add(this.add.text(-cardW / 2 + 24, -cardH / 2 + 60, `Watch a short ad. ${remaining} of 3 remaining today.`, {
      fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: '16px', fontStyle: '600', color: '#3a4655',
    }));
    new PolishedButton(this, {
      x: cardW / 2 - 100 + GAME_WIDTH / 2, y: y, w: 180, h: 84,
      label: remaining > 0 ? 'WATCH' : 'DONE',
      color: remaining > 0 ? 0xffb02f : 0x2a3d67,
      shadowColor: remaining > 0 ? 0xb26810 : 0x18223a,
      testId: 'shop-bonus-treats',
      fontSize: 24,
      onTap: remaining > 0 ? async () => {
        const ok = await services.ads.showRewarded('bonus_treats');
        if (ok) {
          gameState.addTreats(25);
          storage.setString(K.bonusTreatsDayKey, todayKey);
          storage.setNumber(K.bonusTreatsUsed, used + 1);
          this.toast('+25 treats!');
          this.scene.restart();
        }
      } : undefined,
    });
  }

  private toast(msg: string): void {
    const t = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 200, msg, {
      fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: '22px', fontStyle: '800',
      color: '#ffffff', backgroundColor: '#24304a', padding: { left: 14, right: 14, top: 8, bottom: 8 },
    }).setOrigin(0.5).setDepth(60);
    t.setData('testId', 'shop-toast');
    this.tweens.add({ targets: t, y: t.y - 60, alpha: 0, duration: 1600, delay: 900, onComplete: () => t.destroy() });
  }
}
