import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@/main';
import { gameState } from '@/game/systems/GameState';
import { services } from '@/services';
import { PolishedButton } from '@/game/ui/PolishedButton';

export interface GameOverInit {
  score: number;
  treatsThisRun: number;
  doubleTreatsClaimed: boolean;
  reviveUsed: boolean;
  onRevive: () => void;
  onDoubleTreats: () => void;
  onRestart: () => void;
  onMenu: () => void;
}

/**
 * GameOverScene — polished Phaser-rendered panel with big score, NEW BEST
 * badge, treats-this-run, revive + 2x treats rewarded offers, restart + menu.
 * All buttons drawn via PolishedButton for a consistent premium look.
 */
export class GameOverScene extends Phaser.Scene {
  private args!: GameOverInit;

  constructor() { super('GameOverScene'); }

  init(data: GameOverInit): void {
    this.args = data;
  }

  create(): void {
    gameState.incrementRunsCompleted();
    const isBest = gameState.updateBestIfHigher(this.args.score);

    // Dim + panel
    const dim = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.55).setDepth(0);
    dim.setInteractive();

    const w = 620, h = 800;
    const px = GAME_WIDTH / 2 - w / 2, py = GAME_HEIGHT / 2 - h / 2;
    const g = this.add.graphics().setDepth(1);
    g.fillStyle(0x18223a, 0.55);
    g.fillRoundedRect(px + 4, py + 8, w, h, 40);
    g.fillStyle(0xfff8ea, 1);
    g.fillRoundedRect(px, py, w, h, 40);
    g.lineStyle(6, 0x24304a, 1);
    g.strokeRoundedRect(px, py, w, h, 40);

    // Title
    const title = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 320, isBest ? 'NEW BEST!' : 'GAME OVER', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: isBest ? 78 : 66, fontStyle: '900',
      color: isBest ? '#ffb02f' : '#24304a',
      stroke: '#ffffff', strokeThickness: 10,
    }).setOrigin(0.5).setDepth(2);
    title.setData('testId', 'gameover-title');
    if (isBest) {
      this.tweens.add({ targets: title, scale: { from: 0.7, to: 1 }, duration: 320, ease: 'Back.Out' });
      // Celebration particles
      const tex = this.makeConfettiTexture();
      this.add.particles(GAME_WIDTH / 2, 200, tex, {
        speed: { min: 200, max: 500 },
        angle: { min: 0, max: 360 },
        gravityY: 500,
        lifespan: 1600,
        quantity: 3,
        frequency: 40,
        tint: [0xffb02f, 0xff7a1a, 0x4bb04b, 0x3fa7ff, 0xffd23c],
        scale: { start: 0.6, end: 0.05 },
      }).setDepth(3);
    }

    // Score display
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 210, 'SCORE', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '26px', fontStyle: '800', color: '#6a7280',
    }).setOrigin(0.5).setDepth(2);
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 140, `${this.args.score}`, {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '96px', fontStyle: '900',
      color: '#24304a', stroke: '#ffffff', strokeThickness: 10,
    }).setOrigin(0.5).setDepth(2).setData('testId', 'gameover-score');

    // Best + treats badges
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 55, `BEST: ${gameState.bestScore}      TREATS: +${this.args.treatsThisRun}`, {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '22px', fontStyle: '800', color: '#3a7fd8',
    }).setOrigin(0.5).setDepth(2).setData('testId', 'gameover-best-treats');

    // Rewarded: Revive
    if (!this.args.reviveUsed && services.ads.isRewardedAvailable()) {
      new PolishedButton(this, {
        x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 + 40, w: 460, h: 100,
        label: 'REVIVE (Ad)', color: 0xffb02f, shadowColor: 0xb26810,
        testId: 'gameover-revive',
        onTap: async () => {
          const ok = await services.ads.showRewarded('revive');
          if (ok) { this.args.onRevive(); this.scene.stop(); }
        },
      });
    }

    // Rewarded: Double treats
    const doubledLabel = this.args.doubleTreatsClaimed ? '2x TREATS ✓' : '2x TREATS (Ad)';
    const doubleBtn = new PolishedButton(this, {
      x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 + 160, w: 460, h: 100,
      label: doubledLabel, color: 0x4bb8ff, shadowColor: 0x1f6ea0,
      testId: 'gameover-double-treats',
      onTap: async () => {
        if (this.args.doubleTreatsClaimed) return;
        const ok = await services.ads.showRewarded('double_treats');
        if (ok) {
          this.args.doubleTreatsClaimed = true;
          this.args.onDoubleTreats();
          (doubleBtn.list[1] as unknown as Phaser.GameObjects.Text)?.setText?.('2x TREATS ✓');
        }
      },
    });

    // Restart / Menu
    new PolishedButton(this, {
      x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 + 280, w: 460, h: 100,
      label: 'RESTART', color: 0x4bb04b, shadowColor: 0x1e6b1e,
      testId: 'gameover-restart',
      onTap: async () => { await services.ads.maybeShowInterstitial(); this.args.onRestart(); },
    });
    new PolishedButton(this, {
      x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 + 380, w: 460, h: 100,
      label: 'MAIN MENU', color: 0x2a3d67, shadowColor: 0x18223a,
      testId: 'gameover-menu',
      onTap: async () => { await services.ads.maybeShowInterstitial(); this.args.onMenu(); },
    });
  }

  private makeConfettiTexture(): string {
    const key = 'confetti_particle';
    if (this.textures.exists(key)) return key;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 12, 24);
    g.generateTexture(key, 12, 24);
    g.destroy();
    return key;
  }
}
