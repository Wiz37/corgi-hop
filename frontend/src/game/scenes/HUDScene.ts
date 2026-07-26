import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@/main';
import { gameState } from '@/game/systems/GameState';
import { drawCompactTrophy, drawCompactBones, drawCircleControl } from '@/game/ui/PolishedHUD';
import type { GameScene } from './GameScene';

/**
 * HUDScene — polished in-game overlay. All elements are Phaser-drawn to match
 * the design reference:
 *   - Trophy pill (top-left) with current score + BEST
 *   - Big chunky centre score
 *   - Circular pause button (top-right) with glossy 3D look
 *   - Treats pill (below pause) with bone icon + count
 *   - Translucent paw jump control (bottom-centre) with pulsing "TAP TO JUMP"
 *   - TEST ADS badge (only in development)
 */
export class HUDScene extends Phaser.Scene {
  private trophyCurrent!: Phaser.GameObjects.Text;
  private trophyBest!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private treatsText!: Phaser.GameObjects.Text;

  constructor() { super('HUDScene'); }

  create(): void {
    const gs = this.scene.get('GameScene') as GameScene;

    // ---- Compact borderless trophy (bug 6): small icon + BEST label,
    // positioned neatly in the top-left corner respecting the notch area.
    const tp = drawCompactTrophy(this, 22, 30, gameState.bestScore, 0);
    this.trophyCurrent = tp.currentText!;
    this.trophyBest = tp.bestText;

    // ---- Big centre score ----
    this.scoreText = this.add.text(GAME_WIDTH / 2, 130, '0', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '150px',
      fontStyle: '900',
      color: '#ffffff',
      stroke: '#3a7fd8',
      strokeThickness: 16,
      shadow: { color: '#24304a', fill: true, blur: 4, offsetX: 0, offsetY: 6 },
    }).setOrigin(0.5).setDepth(50);
    this.scoreText.setData('testId', 'hud-score-text');

    // ---- Smaller pause button (bug 7): visible size 76 with a 96 px tap
    // area so the touch target stays comfortable on phones.
    const pause = drawCircleControl(this, GAME_WIDTH - 60, 62, 76, 'pause', 'hud-pause-button', 96);
    pause.on('pointerdown', () => this.tweens.add({ targets: pause, scale: 0.92, duration: 60, yoyo: true }));
    pause.on('pointerup', () => {
      this.scene.pause('GameScene');
      this.scene.launch('PauseScene');
    });

    // ---- Compact borderless bones counter (top-right, below pause) ----
    const tt = drawCompactBones(this, GAME_WIDTH - 22, 120, gameState.treats, 'top-right');
    this.treatsText = tt.text;

    // ---- Bottom translucent paw jump control ----
    // Draw a solid filled circle behind the paw texture so the control
    // reads clearly as a filled premium button (not a hollow ring).
    const pawX = GAME_WIDTH / 2;
    const pawY = GAME_HEIGHT - 230;
    const pawR = 118;
    const pawBg = this.add.graphics().setDepth(49);
    // Drop shadow underlay
    pawBg.fillStyle(0x18223a, 0.5);
    pawBg.fillCircle(pawX + 3, pawY + 6, pawR);
    // Main fill (bright, near-opaque)
    pawBg.fillStyle(0xffffff, 0.55);
    pawBg.fillCircle(pawX, pawY, pawR);
    // Inner highlight for depth
    pawBg.fillStyle(0xffffff, 0.35);
    pawBg.fillCircle(pawX - pawR * 0.3, pawY - pawR * 0.3, pawR * 0.55);
    // Ring stroke
    pawBg.lineStyle(6, 0xffffff, 0.9);
    pawBg.strokeCircle(pawX, pawY, pawR);

    const paw = this.add.image(pawX, pawY, 'ui_paw_button')
      .setDisplaySize(230, 230)
      .setAlpha(1)
      .setDepth(50);
    paw.setInteractive({ useHandCursor: true });
    paw.setData('testId', 'hud-jump-button');
    // Subtle pulse
    this.tweens.add({ targets: paw, scale: paw.scale * 1.04, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    paw.on('pointerdown', () => {
      this.tweens.add({ targets: paw, scale: paw.scale * 0.88, duration: 80, yoyo: true });
      if (typeof gs.tryJump === 'function') gs.tryJump();
    });
    const jumpLabel = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 100, 'TAP TO JUMP', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '30px',
      fontStyle: '900',
      color: '#ffffff',
      stroke: '#24304a',
      strokeThickness: 6,
    }).setOrigin(0.5).setDepth(50);
    this.tweens.add({ targets: jumpLabel, alpha: { from: 1, to: 0.65 }, duration: 900, yoyo: true, repeat: -1 });

    // ---- Dev-only TEST ADS badge ----
    if ((import.meta as any).env?.MODE !== 'production') {
      const badge = this.add.text(GAME_WIDTH - 20, GAME_HEIGHT - 40, 'TEST ADS', {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '18px',
        fontStyle: '900',
        color: '#ffffff',
        backgroundColor: '#ff5555',
        padding: { left: 8, right: 8, top: 3, bottom: 3 },
      }).setOrigin(1, 1).setDepth(60);
      badge.setData('testId', 'hud-test-ads-badge');
    }

    // ---- Wire events from GameScene ----
    gs.events.on('scoreChanged', (s: number) => {
      this.scoreText.setText(`${s}`);
      this.trophyCurrent.setText(`${s}`);
      this.tweens.add({ targets: this.scoreText, scale: 1.12, duration: 90, yoyo: true });
      // Update best label live if surpassed during play
      if (s > gameState.bestScore) {
        this.trophyBest.setText(`BEST: ${s}`);
      }
    });
    gs.events.on('treatsChanged', (t: number) => {
      this.treatsText.setText(`${t}`);
    });

    // Cleanup on shutdown so we don't double-subscribe
    this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
      gs.events.off('scoreChanged');
      gs.events.off('treatsChanged');
    });
  }
}
