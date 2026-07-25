import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@/main';
import { gameState, CORGIS, type CorgiId } from '@/game/systems/GameState';
import { services } from '@/services';

/** Grid of corgis with select / try-with-ad / view-in-shop actions. */
export class CorgiSelectScene extends Phaser.Scene {
  constructor() { super('CorgiSelectScene'); }

  create(): void {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xa8dcff).setDepth(0);
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'bg_sky').setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setAlpha(0.6).setDepth(0);
    this.add.text(GAME_WIDTH / 2, 90, 'CHOOSE CORGI', {
      fontFamily: 'system-ui', fontSize: '64px', fontStyle: '900',
      color: '#ff7a1a', stroke: '#ffffff', strokeThickness: 10,
    }).setOrigin(0.5).setDepth(2).setData('testId', 'select-title');

    const cols = 2;
    const cardW = 300, cardH = 340;
    const gapX = 30, gapY = 30;
    const totalW = cols * cardW + (cols - 1) * gapX;
    const startX = (GAME_WIDTH - totalW) / 2 + cardW / 2;
    const startY = 220;
    CORGIS.forEach((cd, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      this.buildCard(startX + col * (cardW + gapX), startY + row * (cardH + gapY), cardW, cardH, cd.id);
    });

    // Back button
    const back = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT - 90).setDepth(3);
    const backImg = this.add.image(0, 0, 'ui_button_blue').setDisplaySize(300, 100);
    const backTxt = this.add.text(0, 0, 'BACK', {
      fontFamily: 'system-ui', fontSize: '28px', fontStyle: '900', color: '#ffffff', stroke: '#24304a', strokeThickness: 6,
    }).setOrigin(0.5);
    back.add([backImg, backTxt]);
    back.setSize(300, 100).setInteractive(new Phaser.Geom.Rectangle(-150, -50, 300, 100), Phaser.Geom.Rectangle.Contains);
    back.setData('testId', 'select-back');
    back.on('pointerup', () => this.scene.start('MenuScene'));
  }

  private buildCard(x: number, y: number, w: number, h: number, id: CorgiId): void {
    const def = CORGIS.find((c) => c.id === id)!;
    const owned = gameState.isCorgiOwned(id);
    const selected = gameState.selectedCorgi === id;
    const c = this.add.container(x, y).setDepth(2);
    const bg = this.add.rectangle(0, 0, w, h, 0xfff8ea).setStrokeStyle(selected ? 8 : 4, selected ? 0xffd23c : 0x24304a);
    const tex = this.textures.exists(def.texture) ? def.texture : 'corgi_idle';
    const img = this.add.image(0, -40, tex).setDisplaySize(180, 180);
    if (def.tint) img.setTint(def.tint);
    const name = this.add.text(0, 70, def.name, {
      fontFamily: 'system-ui', fontSize: '22px', fontStyle: '900', color: '#24304a',
    }).setOrigin(0.5);
    let actionLabel = owned ? (selected ? 'SELECTED' : 'SELECT') : 'LOCKED';
    if (!owned && def.premium) actionLabel = 'TRY (AD)';

    const btn = this.add.container(0, 130).setDepth(3);
    const btnImg = this.add.image(0, 0, selected ? 'ui_button_gold' : owned ? 'ui_button' : 'ui_button_blue').setDisplaySize(220, 80);
    const btnTxt = this.add.text(0, 0, actionLabel, {
      fontFamily: 'system-ui', fontSize: '20px', fontStyle: '900', color: '#ffffff', stroke: '#24304a', strokeThickness: 5,
    }).setOrigin(0.5);
    btn.add([btnImg, btnTxt]);
    btn.setSize(220, 80).setInteractive(new Phaser.Geom.Rectangle(-110, -40, 220, 80), Phaser.Geom.Rectangle.Contains);
    btn.setData('testId', `select-corgi-${id}-btn`);
    btn.on('pointerup', async () => {
      if (owned) {
        gameState.selectedCorgi = id;
        gameState.saveSelected();
        gameState.clearTrial();
        this.scene.restart();
      } else {
        const ok = await services.ads.showRewarded('trial_corgi');
        if (ok) {
          gameState.setTrialCorgi(id);
          gameState.selectedCorgi = id;
          // Do NOT save selected permanently (trial only). We do save for this run.
          gameState.saveSelected();
          this.scene.restart();
        }
      }
    });

    c.add([bg, img, name, btn]);
    c.setData('testId', `select-corgi-${id}`);
  }
}
