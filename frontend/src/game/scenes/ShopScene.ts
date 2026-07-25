import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@/main';
import { services } from '@/services';
import { gameState } from '@/game/systems/GameState';
import { storage, STORAGE_KEYS as K } from '@/game/systems/Storage';

/** In-game shop — polished panel over the parallax scene. */
export class ShopScene extends Phaser.Scene {
  constructor() { super('ShopScene'); }

  create(): void {
    // Backdrop (soft parallax-tinted)
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xa8dcff).setDepth(0);
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'bg_sky').setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setAlpha(0.6).setDepth(0);

    this.add.text(GAME_WIDTH / 2, 90, 'SHOP', {
      fontFamily: 'system-ui', fontSize: '80px', fontStyle: '900',
      color: '#ff7a1a', stroke: '#ffffff', strokeThickness: 12,
    }).setOrigin(0.5).setDepth(3).setData('testId', 'shop-title');

    // Treats readout
    const treatsC = this.add.container(GAME_WIDTH / 2, 170).setDepth(3);
    const tbg = this.add.rectangle(0, 0, 260, 60, 0x24304a, 0.9).setStrokeStyle(4, 0xffffff);
    const bone = this.add.image(-90, 0, 'treat').setDisplaySize(56, 32);
    const tt = this.add.text(-40, 0, `${gameState.treats}`, {
      fontFamily: 'system-ui', fontSize: '32px', fontStyle: '900',
      color: '#ffd23c', stroke: '#24304a', strokeThickness: 4,
    }).setOrigin(0, 0.5);
    treatsC.add([tbg, bone, tt]);
    treatsC.setData('testId', 'shop-treats-panel');

    if (services.purchases.isMock()) {
      const note = this.add.text(GAME_WIDTH / 2, 220, 'Available in the iPhone and Android app · Browser preview uses simulated test purchases', {
        fontFamily: 'system-ui', fontSize: '18px', fontStyle: '700',
        color: '#24304a', backgroundColor: '#ffd23c',
        padding: { left: 10, right: 10, top: 4, bottom: 4 }, wordWrap: { width: GAME_WIDTH - 60 }, align: 'center',
      }).setOrigin(0.5).setDepth(3);
      note.setData('testId', 'shop-preview-notice');
    }

    // Product cards
    const catalog = services.purchases.getCatalog();
    const startY = 320;
    const rowH = 180;
    catalog.forEach((p, i) => {
      const y = startY + i * rowH;
      this.buildProductCard(y, p);
    });

    // Bonus treats rewarded ad (home-screen reward)
    this.buildBonusTreatsRow(startY + catalog.length * rowH);

    // Bottom controls: Restore + Back
    this.mkBtn(GAME_WIDTH / 2 - 150, GAME_HEIGHT - 90, 'RESTORE', 'ui_button_blue', 'shop-restore', async () => {
      const r = await services.purchases.restore();
      this.showResultToast(r.kind === 'success' ? 'Purchases restored' : r.kind === 'unavailable' ? 'Restore unavailable in preview' : 'Restore failed');
    });
    this.mkBtn(GAME_WIDTH / 2 + 150, GAME_HEIGHT - 90, 'BACK', 'ui_button', 'shop-back', () => this.scene.start('MenuScene'));
  }

  private buildProductCard(y: number, p: ReturnType<typeof services.purchases.getCatalog>[number]) {
    const container = this.add.container(GAME_WIDTH / 2, y).setDepth(2);
    const card = this.add.rectangle(0, 0, GAME_WIDTH - 60, 160, 0xfff8ea).setStrokeStyle(4, 0x24304a);
    const owned = services.purchases.hasEntitlement(p.id);

    const title = this.add.text(-GAME_WIDTH / 2 + 60, -50, p.title, {
      fontFamily: 'system-ui', fontSize: '26px', fontStyle: '900', color: '#24304a',
    }).setOrigin(0, 0.5);
    const desc = this.add.text(-GAME_WIDTH / 2 + 60, -8, p.description, {
      fontFamily: 'system-ui', fontSize: '16px', fontStyle: '500', color: '#3a4655',
      wordWrap: { width: GAME_WIDTH - 320 },
    }).setOrigin(0, 0.5);
    const benefits = this.add.text(-GAME_WIDTH / 2 + 60, 40, p.benefits.map((b) => '• ' + b).join('   '), {
      fontFamily: 'system-ui', fontSize: '14px', fontStyle: '600', color: '#4bb04b',
      wordWrap: { width: GAME_WIDTH - 320 },
    }).setOrigin(0, 0.5);

    const priceLabel = owned ? 'OWNED' : p.priceString;
    const buyBtn = this.add.container(GAME_WIDTH / 2 - 150, 0);
    const buyImg = this.add.image(0, 0, owned ? 'ui_button' : p.artKey).setDisplaySize(220, 90);
    const buyTxt = this.add.text(0, 0, priceLabel, {
      fontFamily: 'system-ui', fontSize: '26px', fontStyle: '900', color: '#ffffff',
      stroke: '#24304a', strokeThickness: 5,
    }).setOrigin(0.5);
    buyBtn.add([buyImg, buyTxt]);
    buyBtn.setSize(220, 90).setInteractive(new Phaser.Geom.Rectangle(-110, -45, 220, 90), Phaser.Geom.Rectangle.Contains);
    buyBtn.setData('testId', `shop-buy-${p.id}`);
    if (!owned) {
      buyBtn.on('pointerdown', () => this.tweens.add({ targets: buyBtn, scale: 0.94, duration: 60, yoyo: true }));
      buyBtn.on('pointerup', async () => {
        buyTxt.setText('…');
        const res = await services.purchases.purchase(p.id);
        buyTxt.setText(services.purchases.hasEntitlement(p.id) ? 'OWNED' : p.priceString);
        if (res.kind === 'success') {
          this.showResultToast(`${p.title} unlocked!`);
          this.scene.restart();
        } else if (res.kind === 'cancelled') {
          this.showResultToast('Purchase cancelled');
        } else if (res.kind === 'failed') {
          this.showResultToast(res.message || 'Purchase failed');
        } else if (res.kind === 'offline') {
          this.showResultToast('You appear to be offline');
        } else {
          this.showResultToast('Available in the iPhone and Android app');
        }
      });
    }
    container.add([card, title, desc, benefits, buyBtn]);
  }

  private buildBonusTreatsRow(y: number): void {
    const todayKey = new Date().toISOString().slice(0, 10);
    const savedDay = storage.getString(K.bonusTreatsDayKey, '');
    const used = savedDay === todayKey ? storage.getNumber(K.bonusTreatsUsed, 0) : 0;
    const remaining = Math.max(0, 3 - used);

    const c = this.add.container(GAME_WIDTH / 2, y).setDepth(2);
    const card = this.add.rectangle(0, 0, GAME_WIDTH - 60, 140, 0xffedb5).setStrokeStyle(4, 0x24304a);
    this.add.existing(card); c.add(card);
    const title = this.add.text(-GAME_WIDTH / 2 + 60, -30, 'FREE +25 TREATS', {
      fontFamily: 'system-ui', fontSize: '24px', fontStyle: '900', color: '#24304a',
    }).setOrigin(0, 0.5);
    const sub = this.add.text(-GAME_WIDTH / 2 + 60, 8, `Watch a short ad. ${remaining} of 3 remaining today.`, {
      fontFamily: 'system-ui', fontSize: '16px', fontStyle: '600', color: '#3a4655',
    }).setOrigin(0, 0.5);
    c.add([title, sub]);
    const btn = this.add.container(GAME_WIDTH / 2 - 150, 0);
    const bimg = this.add.image(0, 0, 'ui_button_gold').setDisplaySize(220, 90);
    const btxt = this.add.text(0, 0, remaining > 0 ? 'WATCH' : 'DONE', {
      fontFamily: 'system-ui', fontSize: '24px', fontStyle: '900', color: '#ffffff', stroke: '#24304a', strokeThickness: 5,
    }).setOrigin(0.5);
    btn.add([bimg, btxt]);
    btn.setSize(220, 90).setInteractive(new Phaser.Geom.Rectangle(-110, -45, 220, 90), Phaser.Geom.Rectangle.Contains);
    btn.setData('testId', 'shop-bonus-treats');
    if (remaining > 0) {
      btn.on('pointerup', async () => {
        const ok = await services.ads.showRewarded('bonus_treats');
        if (ok) {
          gameState.addTreats(25);
          storage.setString(K.bonusTreatsDayKey, todayKey);
          storage.setNumber(K.bonusTreatsUsed, used + 1);
          this.showResultToast('+25 treats!');
          this.scene.restart();
        }
      });
    }
    c.add(btn);
  }

  private mkBtn(x: number, y: number, label: string, tex: string, testId: string, onTap: () => void) {
    const c = this.add.container(x, y).setDepth(3);
    const img = this.add.image(0, 0, tex).setDisplaySize(240, 100);
    const t = this.add.text(0, 0, label, {
      fontFamily: 'system-ui', fontSize: '26px', fontStyle: '900', color: '#ffffff', stroke: '#24304a', strokeThickness: 6,
    }).setOrigin(0.5);
    c.add([img, t]);
    c.setSize(240, 100).setInteractive(new Phaser.Geom.Rectangle(-120, -50, 240, 100), Phaser.Geom.Rectangle.Contains);
    c.setData('testId', testId);
    c.on('pointerdown', () => this.tweens.add({ targets: c, scale: 0.94, duration: 60, yoyo: true }));
    c.on('pointerup', onTap);
    return c;
  }

  private showResultToast(msg: string): void {
    const t = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 200, msg, {
      fontFamily: 'system-ui', fontSize: '22px', fontStyle: '800', color: '#ffffff', backgroundColor: '#24304a',
      padding: { left: 14, right: 14, top: 8, bottom: 8 },
    }).setOrigin(0.5).setDepth(50);
    t.setData('testId', 'shop-toast');
    this.tweens.add({ targets: t, y: t.y - 60, alpha: 0, duration: 1600, delay: 900, onComplete: () => t.destroy() });
  }
}
