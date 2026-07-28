import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@/main';
import { gameState } from '@/game/systems/GameState';
import { drawCompactTrophy, drawCompactBones, drawCircleControl } from '@/game/ui/PolishedHUD';
import { sound } from '@/services/audio/SoundService';
import { dailyMissions } from '@/game/systems/DailyMissions';
import type { GameScene } from './GameScene';

export class HUDScene extends Phaser.Scene {
  private trophyCurrent!: Phaser.GameObjects.Text;
  private trophyBest!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private treatsText!: Phaser.GameObjects.Text;
  private missionText!: Phaser.GameObjects.Text;
  private streakText!: Phaser.GameObjects.Text;

  constructor() { super('HUDScene'); }

  create(): void {
    const gameScene = this.scene.get('GameScene') as GameScene;
    const trophy = drawCompactTrophy(this, 22, 30, gameState.bestScore, 0);
    this.trophyCurrent = trophy.currentText!;
    this.trophyBest = trophy.bestText;

    this.scoreText = this.add.text(GAME_WIDTH / 2, 130, '0', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '150px', fontStyle: '900', color: '#ffffff',
      stroke: '#3a7fd8', strokeThickness: 16,
      shadow: { color: '#24304a', fill: true, blur: 4, offsetX: 0, offsetY: 6 },
    }).setOrigin(0.5).setDepth(50).setData('testId', 'hud-score-text');

    const pause = drawCircleControl(this, GAME_WIDTH - 60, 62, 76, 'pause', 'hud-pause-button', 96);
    pause.on('pointerdown', () => this.tweens.add({ targets: pause, scale: 0.92, duration: 60, yoyo: true }));
    pause.on('pointerup', () => {
      this.scene.pause('GameScene');
      this.scene.launch('PauseScene');
    });

    const bones = drawCompactBones(this, GAME_WIDTH - 22, 120, gameState.treats, 'top-right');
    this.treatsText = bones.text;

    this.missionText = this.add.text(GAME_WIDTH / 2, 272, '', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '20px', fontStyle: '800', color: '#ffffff',
      stroke: '#24304a', strokeThickness: 5,
      backgroundColor: 'rgba(36,48,74,0.72)',
      padding: { left: 14, right: 14, top: 7, bottom: 7 },
      align: 'center',
    }).setOrigin(0.5).setDepth(52).setData('testId', 'hud-daily-mission');
    this.updateMissionText();

    this.streakText = this.add.text(GAME_WIDTH / 2, 326, '', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '24px', fontStyle: '900', color: '#fff176',
      stroke: '#24304a', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(53).setAlpha(0).setData('testId', 'hud-streak');

    const pawX = GAME_WIDTH / 2;
    const pawY = GAME_HEIGHT - 230;
    const pawR = 118;
    const pawBg = this.add.graphics().setDepth(49);
    pawBg.fillStyle(0x18223a, 0.5);
    pawBg.fillCircle(pawX + 3, pawY + 6, pawR);
    pawBg.fillStyle(0xffffff, 0.55);
    pawBg.fillCircle(pawX, pawY, pawR);
    pawBg.fillStyle(0xffffff, 0.35);
    pawBg.fillCircle(pawX - pawR * 0.3, pawY - pawR * 0.3, pawR * 0.55);
    pawBg.lineStyle(6, 0xffffff, 0.9);
    pawBg.strokeCircle(pawX, pawY, pawR);

    const paw = this.add.image(pawX, pawY, 'ui_paw_button')
      .setDisplaySize(230, 230)
      .setAlpha(1)
      .setDepth(50)
      .setInteractive({ useHandCursor: true });
    paw.setData('testId', 'hud-jump-button');
    this.tweens.add({ targets: paw, scale: paw.scale * 1.04, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    paw.on('pointerdown', () => {
      this.tweens.add({ targets: paw, scale: paw.scale * 0.88, duration: 80, yoyo: true });
      if (typeof gameScene.tryJump === 'function') gameScene.tryJump();
    });

    const jumpLabel = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 100, 'TAP TO JUMP', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '30px', fontStyle: '900', color: '#ffffff',
      stroke: '#24304a', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(50);
    this.tweens.add({ targets: jumpLabel, alpha: { from: 1, to: 0.65 }, duration: 900, yoyo: true, repeat: -1 });

    if ((import.meta as any).env?.MODE !== 'production') {
      this.add.text(GAME_WIDTH - 20, GAME_HEIGHT - 40, 'TEST ADS', {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '18px', fontStyle: '900', color: '#ffffff', backgroundColor: '#ff5555',
        padding: { left: 8, right: 8, top: 3, bottom: 3 },
      }).setOrigin(1, 1).setDepth(60).setData('testId', 'hud-test-ads-badge');
    }

    this.buildMuteButton(60, 200);

    const milestones = new Set([10, 25, 50, 75, 100]);
    let lastNewBestBannerAt = -1;
    gameScene.events.on('scoreChanged', (score: number) => {
      this.scoreText.setText(`${score}`);
      this.trophyCurrent.setText(`${score}`);
      this.tweens.add({ targets: this.scoreText, scale: 1.12, duration: 90, yoyo: true });
      if (score > gameState.bestScore) {
        this.trophyBest.setText(`BEST: ${score}`);
        if (lastNewBestBannerAt !== score && score === gameState.bestScore + 1) {
          lastNewBestBannerAt = score;
          this.showMilestoneBanner('NEW BEST!', 0xffd23c);
        }
      }
      if (milestones.has(score)) {
        this.showMilestoneBanner(this.milestoneCopy(score), 0x8ee65e);
        this.spawnMilestoneConfetti();
      }
    });
    gameScene.events.on('treatsChanged', (treats: number) => this.treatsText.setText(`${treats}`));
    gameScene.events.on('missionUpdated', () => this.updateMissionText());
    gameScene.events.on('streakChanged', ({ streak, multiplier }: { streak: number; multiplier: number }) => {
      if (streak < 5) {
        this.streakText.setAlpha(0);
        return;
      }
      this.streakText.setText(`${streak} HOP STREAK  x${multiplier}`).setAlpha(1);
      this.tweens.add({ targets: this.streakText, scale: 1.12, duration: 90, yoyo: true });
    });
    gameScene.events.on('skillFeedback', ({ text, tint }: { text: string; tint?: number }) => {
      this.showMilestoneBanner(text, tint ?? 0xffd23c);
      if (text.startsWith('MISSION COMPLETE')) this.spawnMilestoneConfetti();
    });

    this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
      gameScene.events.off('scoreChanged');
      gameScene.events.off('treatsChanged');
      gameScene.events.off('missionUpdated');
      gameScene.events.off('streakChanged');
      gameScene.events.off('skillFeedback');
    });
  }

  private updateMissionText(): void {
    const current = dailyMissions.getCurrent();
    const completed = dailyMissions.getCompletedCount();
    if (!current) {
      this.missionText.setText('DAILY MISSIONS  3/3  ✓');
      return;
    }
    const { mission, entry } = current;
    this.missionText.setText(`DAILY ${completed + 1}/3  •  ${mission.label.toUpperCase()}  ${entry.progress}/${mission.target}  •  +${mission.reward}`);
  }

  private showMilestoneBanner(text: string, tint = 0xffd23c): void {
    const y = 260;
    const graphics = this.add.graphics().setDepth(70);
    graphics.fillStyle(0x18223a, 0.85);
    graphics.fillRoundedRect(GAME_WIDTH / 2 - 190, y - 42, 380, 84, 20);
    graphics.lineStyle(4, tint, 1);
    graphics.strokeRoundedRect(GAME_WIDTH / 2 - 190, y - 42, 380, 84, 20);
    const label = this.add.text(GAME_WIDTH / 2, y, text, {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '46px', fontStyle: '900', color: '#ffffff',
      stroke: '#24304a', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(71).setAlpha(0).setScale(0.8);
    graphics.setAlpha(0);
    this.tweens.add({ targets: [graphics, label], alpha: 1, duration: 140 });
    this.tweens.add({ targets: label, scale: 1, duration: 220, ease: 'Back.easeOut' });
    this.time.delayedCall(900, () => {
      this.tweens.add({
        targets: [graphics, label], alpha: 0, duration: 260,
        onComplete: () => { graphics.destroy(); label.destroy(); },
      });
    });
  }

  private milestoneCopy(score: number): string {
    if (score === 10) return 'NICE! 10 HOPS';
    if (score === 25) return '25 HOPS!';
    if (score === 50) return 'HALF CENTURY!';
    if (score === 75) return 'ON FIRE!';
    if (score === 100) return 'LEGENDARY!';
    return `${score}!`;
  }

  private buildMuteButton(cx: number, cy: number): void {
    const radius = 30;
    const background = this.add.graphics().setDepth(58);
    const icon = this.add.text(cx, cy, sound.isMuted ? '🔇' : '🔊', {
      fontFamily: 'system-ui, -apple-system, "Apple Color Emoji", "Segoe UI Emoji", sans-serif',
      fontSize: '36px',
    }).setOrigin(0.5).setDepth(60).setData('testId', 'hud-mute-button');

    const paint = (muted: boolean) => {
      background.clear();
      background.fillStyle(0x18223a, 0.5);
      background.fillCircle(cx + 2, cy + 3, radius);
      background.fillStyle(muted ? 0x8fa2c4 : 0xffffff, 0.9);
      background.fillCircle(cx, cy, radius);
      background.lineStyle(4, 0x24304a, 0.85);
      background.strokeCircle(cx, cy, radius);
      icon.setText(muted ? '🔇' : '🔊');
    };
    paint(sound.isMuted);

    const hit = this.add.zone(cx, cy, 76, 76).setDepth(61).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => {
      this.tweens.add({ targets: icon, scale: 0.85, duration: 60, yoyo: true });
      paint(sound.toggleMuted());
    });
    const unsubscribe = sound.onMuteChanged(paint);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribe);
  }

  private spawnMilestoneConfetti(): void {
    const key = 'milestone_conf';
    if (!this.textures.exists(key)) {
      const graphics = this.make.graphics({ x: 0, y: 0 }, false);
      graphics.fillStyle(0xffffff, 1);
      graphics.fillRect(0, 0, 8, 12);
      graphics.generateTexture(key, 8, 12);
      graphics.destroy();
    }
    const centerX = GAME_WIDTH / 2;
    const centerY = 260;
    const burst = this.add.particles(0, 0, key, {
      x: centerX, y: centerY,
      speedX: { min: -260, max: 260 },
      speedY: { min: -300, max: -60 },
      gravityY: 480,
      lifespan: 1100,
      scale: { start: 1, end: 0.6 },
      alpha: { start: 1, end: 0 },
      quantity: 24,
      tint: [0xff8a1a, 0xffd23c, 0x4bb0ff, 0x8ee65e, 0xff77a8],
      emitting: false,
    }).setDepth(69);
    burst.explode(24, centerX, centerY);
    this.time.delayedCall(1400, () => burst.destroy());
  }
}
