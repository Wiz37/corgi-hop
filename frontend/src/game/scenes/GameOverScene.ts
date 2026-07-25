import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@/main';
import { gameState } from '@/game/systems/GameState';
import { services } from '@/services';

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
 * GameOverScene — polished Phaser-rendered panel with final score, best-score,
 * treats-this-run, and optional rewarded-ad offers (Revive, 2x Treats).
 * All ads are non-blocking: a failed ad continues the game immediately.
 */
export class GameOverScene extends Phaser.Scene {
  private args!: GameOverInit;
  private newBestBadge?: Phaser.GameObjects.Text;

  constructor() { super('GameOverScene'); }

  init(data: GameOverInit): void {
    this.args = data;
  }

  create(): void {
    // Count the run + maybe show interstitial (never before restart/menu buttons).
    gameState.incrementRunsCompleted();
    const isBest = gameState.updateBestIfHigher(this.args.score);

    const dim = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.55).setDepth(0);
    dim.setInteractive();

    const panel = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'ui_panel').setDisplaySize(620, 820).setDepth(1);

    const title = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 320, isBest ? 'NEW BEST!' : 'GAME OVER', {
      fontFamily: 'system-ui', fontSize: isBest ? 74 : 64, fontStyle: '900',
      color: isBest ? '#ffd23c' : '#24304a', stroke: '#ffffff', strokeThickness: 10,
    }).setOrigin(0.5).setDepth(2);
    title.setData('testId', 'gameover-title');
    if (isBest) {
      this.tweens.add({ targets: title, scale: { from: 0.7, to: 1 }, duration: 320, ease: 'Back.Out' });
      this.newBestBadge = title;
      // Celebration particles
      const tex = this.makeConfettiTexture();
      this.add.particles(GAME_WIDTH / 2, 200, tex, {
        speed: { min: 200, max: 500 },
        angle: { min: 0, max: 360 },
        gravityY: 500,
        lifespan: 1600,
        quantity: 3,
        frequency: 40,
        tint: [0xffd23c, 0xff7a1a, 0x4bb04b, 0x3fa7ff],
        scale: { start: 0.6, end: 0.05 },
      }).setDepth(3);
    }

    // Score + best
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 200, 'SCORE', { fontFamily: 'system-ui', fontSize: '28px', fontStyle: '800', color: '#6a7280' }).setOrigin(0.5).setDepth(2);
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 140, `${this.args.score}`, {
      fontFamily: 'system-ui', fontSize: '84px', fontStyle: '900',
      color: '#24304a', stroke: '#ffffff', strokeThickness: 10,
    }).setOrigin(0.5).setDepth(2).setData('testId', 'gameover-score');

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60, `BEST: ${gameState.bestScore}    TREATS: +${this.args.treatsThisRun}`, {
      fontFamily: 'system-ui', fontSize: '22px', fontStyle: '800',
      color: '#3a7fd8',
    }).setOrigin(0.5).setDepth(2).setData('testId', 'gameover-best-treats');

    // Rewarded: Revive (only offered once per run and only if reward layer available)
    if (!this.args.reviveUsed && services.ads.isRewardedAvailable()) {
      this.mkBtn(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 30, 'REVIVE (Watch Ad)', 'ui_button_gold', 'gameover-revive', async () => {
        const ok = await services.ads.showRewarded('revive');
        if (ok) {
          this.args.onRevive();
          this.scene.stop();
        }
      });
    }

    // Rewarded: Double treats (once per run)
    const doubledText = this.args.doubleTreatsClaimed ? '2x TREATS ✓' : `2x TREATS (Watch Ad)`;
    const doubleBtn = this.mkBtn(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 160, doubledText, 'ui_button_blue', 'gameover-double-treats', async () => {
      if (this.args.doubleTreatsClaimed) return;
      const ok = await services.ads.showRewarded('double_treats');
      if (ok) {
        this.args.doubleTreatsClaimed = true;
        this.args.onDoubleTreats();
        (doubleBtn.list[1] as Phaser.GameObjects.Text).setText('2x TREATS ✓');
      }
    });

    // Restart + Menu
    this.mkBtn(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 280, 'RESTART', 'ui_button', 'gameover-restart', async () => {
      // Show interstitial on natural transition (rules enforced in AdService).
      await services.ads.maybeShowInterstitial();
      this.args.onRestart();
    });
    this.mkBtn(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 380, 'MAIN MENU', 'ui_button_blue', 'gameover-menu', async () => {
      await services.ads.maybeShowInterstitial();
      this.args.onMenu();
    });
  }

  private makeConfettiTexture(): string {
    const key = 'confetti_particle';
    if (this.textures.exists(key)) return key;
    const g = this.add.graphics({ x: -100, y: -100 });
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 12, 24);
    g.generateTexture(key, 12, 24);
    g.destroy();
    return key;
  }

  private mkBtn(x: number, y: number, label: string, tex: string, testId: string, onTap: () => void) {
    const c = this.add.container(x, y).setDepth(3);
    const img = this.add.image(0, 0, tex).setDisplaySize(460, 100);
    const t = this.add.text(0, 0, label, {
      fontFamily: 'system-ui', fontSize: '30px', fontStyle: '900',
      color: '#ffffff', stroke: '#24304a', strokeThickness: 6,
    }).setOrigin(0.5);
    c.add([img, t]);
    c.setSize(460, 100).setInteractive(new Phaser.Geom.Rectangle(-230, -50, 460, 100), Phaser.Geom.Rectangle.Contains);
    c.setData('testId', testId);
    c.on('pointerdown', () => this.tweens.add({ targets: c, scale: 0.94, duration: 60, yoyo: true }));
    c.on('pointerup', onTap);
    return c;
  }
}
