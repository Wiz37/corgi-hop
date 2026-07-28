import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@/main';
import { gameState, CORGIS } from '@/game/systems/GameState';
import { dailyMissions } from '@/game/systems/DailyMissions';
import { getLatestFunRunSummary } from '@/game/systems/FunGameplayPlugin';
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

export class GameOverScene extends Phaser.Scene {
  private args!: GameOverInit;

  constructor() { super('GameOverScene'); }

  init(data: GameOverInit): void {
    this.args = data;
  }

  create(): void {
    gameState.incrementRunsCompleted();
    const isBest = gameState.updateBestIfHigher(this.args.score);
    const funSummary = getLatestFunRunSummary();

    const dim = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.58).setDepth(0);
    dim.setInteractive();

    const width = 620;
    const height = 940;
    const panelX = GAME_WIDTH / 2 - width / 2;
    const panelY = GAME_HEIGHT / 2 - height / 2;
    const graphics = this.add.graphics().setDepth(1);
    graphics.fillStyle(0x18223a, 0.55);
    graphics.fillRoundedRect(panelX + 4, panelY + 8, width, height, 40);
    graphics.fillStyle(0xfff8ea, 1);
    graphics.fillRoundedRect(panelX, panelY, width, height, 40);
    graphics.lineStyle(6, 0x24304a, 1);
    graphics.strokeRoundedRect(panelX, panelY, width, height, 40);

    const title = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 395, isBest ? 'NEW BEST!' : 'GAME OVER', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: isBest ? 72 : 62, fontStyle: '900',
      color: isBest ? '#ffb02f' : '#24304a', stroke: '#ffffff', strokeThickness: 10,
    }).setOrigin(0.5).setDepth(2).setData('testId', 'gameover-title');
    if (isBest) {
      this.tweens.add({ targets: title, scale: { from: 0.7, to: 1 }, duration: 320, ease: 'Back.Out' });
      const texture = this.makeConfettiTexture();
      this.add.particles(GAME_WIDTH / 2, 200, texture, {
        speed: { min: 200, max: 500 }, angle: { min: 0, max: 360 }, gravityY: 500,
        lifespan: 1600, quantity: 3, frequency: 40,
        tint: [0xffb02f, 0xff7a1a, 0x4bb04b, 0x3fa7ff, 0xffd23c],
        scale: { start: 0.6, end: 0.05 },
      }).setDepth(3);
    }

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 305, 'SCORE', {
      fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: '24px', fontStyle: '800', color: '#6a7280',
    }).setOrigin(0.5).setDepth(2);
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 235, `${this.args.score}`, {
      fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: '88px', fontStyle: '900',
      color: '#24304a', stroke: '#ffffff', strokeThickness: 10,
    }).setOrigin(0.5).setDepth(2).setData('testId', 'gameover-score');

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 155, `BEST: ${gameState.bestScore}     BONES: +${this.args.treatsThisRun}`, {
      fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: '22px', fontStyle: '800', color: '#3a7fd8',
    }).setOrigin(0.5).setDepth(2).setData('testId', 'gameover-best-treats');

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 112, `RUN STREAK: ${funSummary.bestStreak}     BEST STREAK: ${gameState.bestStreak}`, {
      fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: '20px', fontStyle: '800', color: '#9a5b13',
    }).setOrigin(0.5).setDepth(2).setData('testId', 'gameover-streak');

    const mission = dailyMissions.getCurrent();
    const missionCopy = mission
      ? `DAILY: ${mission.mission.label}  ${mission.entry.progress}/${mission.mission.target}`
      : 'DAILY MISSIONS COMPLETE ✓';
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 72, missionCopy, {
      fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: '18px', fontStyle: '800', color: '#4b7b37',
    }).setOrigin(0.5).setDepth(2).setData('testId', 'gameover-mission');

    const nextCorgi = CORGIS.find((corgi) => !gameState.isCorgiOwned(corgi.id) && gameState.bonePriceFor(corgi.id) > 0);
    const unlockCopy = nextCorgi
      ? `${Math.max(0, gameState.bonePriceFor(nextCorgi.id) - gameState.treats)} Bones until ${nextCorgi.name}`
      : 'ALL EARNABLE CORGIS UNLOCKED!';
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 32, unlockCopy, {
      fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: '19px', fontStyle: '900', color: '#b26810',
    }).setOrigin(0.5).setDepth(2).setData('testId', 'gameover-next-unlock');

    if (!this.args.reviveUsed && services.ads.isRewardedAvailable()) {
      new PolishedButton(this, {
        x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 + 75, w: 460, h: 92,
        label: 'REVIVE (Ad)', color: 0xffb02f, shadowColor: 0xb26810,
        testId: 'gameover-revive',
        onTap: async () => {
          const ok = await services.ads.showRewarded('revive');
          if (ok) { this.args.onRevive(); this.scene.stop(); }
        },
      });
    }

    const doubledLabel = this.args.doubleTreatsClaimed ? '2x BONES ✓' : '2x BONES (Ad)';
    const doubleButton = new PolishedButton(this, {
      x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 + 185, w: 460, h: 92,
      label: doubledLabel, color: 0x4bb8ff, shadowColor: 0x1f6ea0,
      testId: 'gameover-double-treats',
      onTap: async () => {
        if (this.args.doubleTreatsClaimed) return;
        const ok = await services.ads.showRewarded('double_treats');
        if (ok) {
          this.args.doubleTreatsClaimed = true;
          this.args.onDoubleTreats();
          (doubleButton.list[1] as unknown as Phaser.GameObjects.Text)?.setText?.('2x BONES ✓');
        }
      },
    });

    new PolishedButton(this, {
      x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 + 295, w: 460, h: 92,
      label: 'PLAY AGAIN', color: 0x4bb04b, shadowColor: 0x1e6b1e,
      testId: 'gameover-restart',
      onTap: async () => { await services.ads.maybeShowInterstitial(); this.args.onRestart(); },
    });
    new PolishedButton(this, {
      x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 + 405, w: 460, h: 92,
      label: 'MAIN MENU', color: 0x2a3d67, shadowColor: 0x18223a,
      testId: 'gameover-menu',
      onTap: async () => { await services.ads.maybeShowInterstitial(); this.args.onMenu(); },
    });
  }

  private makeConfettiTexture(): string {
    const key = 'confetti_particle';
    if (this.textures.exists(key)) return key;
    const graphics = this.make.graphics({ x: 0, y: 0 }, false);
    graphics.fillStyle(0xffffff, 1);
    graphics.fillRect(0, 0, 12, 24);
    graphics.generateTexture(key, 12, 24);
    graphics.destroy();
    return key;
  }
}
