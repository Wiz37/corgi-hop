import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@/main';
import { gameState, CORGIS, type CorgiId } from '@/game/systems/GameState';
import { services } from '@/services';
import { PolishedButton } from '@/game/ui/PolishedButton';
import { buildParallax, scatterMenuDecor } from '@/game/systems/Parallax';

/** Grid of corgis with select / try-with-ad actions. */
export class CorgiSelectScene extends Phaser.Scene {
  constructor() { super('CorgiSelectScene'); }

  create(): void {
    buildParallax(this);
    scatterMenuDecor(this, 920);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.35).setDepth(24);

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

    const tex = this.textures.exists(def.texture) ? def.texture : 'corgi_idle';
    const img = this.add.image(0, -50, tex).setDisplaySize(200, 200);
    if (def.tint) img.setTint(def.tint);
    c.add(img);
    c.add(this.add.text(0, 70, def.name, {
      fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: '22px', fontStyle: '900', color: '#24304a',
    }).setOrigin(0.5));

    let actionLabel: string;
    let color = 0x4bb8ff, shadow = 0x1f6ea0;
    if (owned) {
      actionLabel = selected ? 'SELECTED' : 'SELECT';
      color = selected ? 0xffb02f : 0x4bb04b;
      shadow = selected ? 0xb26810 : 0x1e6b1e;
    } else if (def.premium) {
      actionLabel = 'TRY (AD)';
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
          gameState.selectedCorgi = id;
          gameState.saveSelected();
          gameState.clearTrial();
          this.scene.restart();
        } else {
          const ok = await services.ads.showRewarded('trial_corgi');
          if (ok) {
            gameState.setTrialCorgi(id);
            gameState.selectedCorgi = id;
            gameState.saveSelected();
            this.scene.restart();
          }
        }
      },
    });

    c.setData('testId', `select-corgi-${id}`);
  }
}
