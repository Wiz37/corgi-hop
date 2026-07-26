import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@/main';
import { gameState } from '@/game/systems/GameState';
import { drawCompactTrophy, drawCompactBones, drawCircleControl } from '@/game/ui/PolishedHUD';
import { sound } from '@/services/audio/SoundService';
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
    // Mute / unmute button — small circular control in the top-left BELOW
    // the trophy pill so it doesn't overlap the trophy, the centre score,
    // the pause button, or the paw jump control. 60 px visible with a
    // 76 px tap radius (comfortable for thumbs on phones).
    this.buildMuteButton(60, 200);

    const MILESTONES = new Set([10, 25, 50, 75, 100]);
    let lastNewBestBannerAt = -1;
    gs.events.on('scoreChanged', (s: number) => {
      this.scoreText.setText(`${s}`);
      this.trophyCurrent.setText(`${s}`);
      this.tweens.add({ targets: this.scoreText, scale: 1.12, duration: 90, yoyo: true });
      // Update best label live if surpassed during play
      if (s > gameState.bestScore) {
        this.trophyBest.setText(`BEST: ${s}`);
        // "New best!" pill — fires ONCE per session when the player passes
        // their previous record. Non-blocking, does not cover the corgi or
        // the paw button (positioned at top-third of the screen).
        if (lastNewBestBannerAt !== s && s === gameState.bestScore + 1) {
          lastNewBestBannerAt = s;
          this.showMilestoneBanner('NEW BEST!', 0xffd23c);
        }
      }
      // Score milestones — celebratory particle burst + brief banner.
      if (MILESTONES.has(s)) {
        this.showMilestoneBanner(this.milestoneCopy(s), 0x8ee65e);
        this.spawnMilestoneConfetti();
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

  /**
   * Brief milestone banner shown near the top-third of the screen — non-
   * blocking, does not pause gameplay, does not cover the corgi or the
   * paw jump button. Fades in / holds ~700ms / fades out.
   */
  private showMilestoneBanner(text: string, tint: number = 0xffd23c): void {
    const y = 260;
    const g = this.add.graphics().setDepth(70);
    const bg = 0x18223a;
    g.fillStyle(bg, 0.85);
    g.fillRoundedRect(GAME_WIDTH / 2 - 190, y - 42, 380, 84, 20);
    g.lineStyle(4, tint, 1);
    g.strokeRoundedRect(GAME_WIDTH / 2 - 190, y - 42, 380, 84, 20);
    const label = this.add.text(GAME_WIDTH / 2, y, text, {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '46px', fontStyle: '900',
      color: '#ffffff', stroke: '#24304a', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(71);
    // Pop in
    g.setAlpha(0); label.setAlpha(0); label.setScale(0.8);
    this.tweens.add({ targets: [g, label], alpha: 1, duration: 140 });
    this.tweens.add({ targets: label, scale: 1, duration: 220, ease: 'Back.easeOut' });
    // Hold + fade out
    this.time.delayedCall(900, () => {
      this.tweens.add({
        targets: [g, label], alpha: 0, duration: 260,
        onComplete: () => { g.destroy(); label.destroy(); },
      });
    });
  }

  private milestoneCopy(score: number): string {
    if (score === 10)  return 'NICE! 10 HOPS';
    if (score === 25)  return '25 HOPS!';
    if (score === 50)  return 'HALF CENTURY!';
    if (score === 75)  return 'ON FIRE!';
    if (score === 100) return 'LEGENDARY!';
    return `${score}!`;
  }

  /**
   * Small mute/unmute icon in the top-left corner. Uses the same procedural
   * drawing style as the rest of the HUD (Graphics + Text, no extra image
   * asset). Persists state via `sound.setMuted` (which writes to
   * localStorage). Tap area 76×76 for comfortable thumb targeting; visible
   * disc is 60×60 so it sits neatly under the trophy pill.
   */
  private buildMuteButton(cx: number, cy: number): void {
    const r = 30;
    // Circular tap-target
    const bg = this.add.graphics().setDepth(58);
    const icon = this.add.text(cx, cy, sound.isMuted ? '🔇' : '🔊', {
      fontFamily: 'system-ui, -apple-system, "Apple Color Emoji", "Segoe UI Emoji", sans-serif',
      fontSize: '36px',
    }).setOrigin(0.5).setDepth(60);
    icon.setData('testId', 'hud-mute-button');

    const paint = (muted: boolean) => {
      bg.clear();
      // Drop shadow
      bg.fillStyle(0x18223a, 0.5);
      bg.fillCircle(cx + 2, cy + 3, r);
      // Main fill — dim when muted, bright when playing
      bg.fillStyle(muted ? 0x8fa2c4 : 0xffffff, 0.9);
      bg.fillCircle(cx, cy, r);
      bg.lineStyle(4, 0x24304a, 0.85);
      bg.strokeCircle(cx, cy, r);
      icon.setText(muted ? '🔇' : '🔊');
    };
    paint(sound.isMuted);

    // 76 px hit-box for comfortable tap
    const hit = this.add.zone(cx, cy, 76, 76)
      .setDepth(61)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => {
      this.tweens.add({ targets: icon, scale: 0.85, duration: 60, yoyo: true });
      const nowMuted = sound.toggleMuted();
      paint(nowMuted);
    });
    // Also subscribe to programmatic mute changes (e.g. from a future
    // Settings screen) so the icon stays in sync.
    const unsubscribe = sound.onMuteChanged(paint);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribe);
  }


  private spawnMilestoneConfetti(): void {
    // Small, tasteful confetti burst — sourced from a procedural coloured
    // square texture. Bursts 24 particles that fall / drift for ~1s and
    // then destroy themselves.
    const key = 'milestone_conf';
    if (!this.textures.exists(key)) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xffffff, 1);
      g.fillRect(0, 0, 8, 12);
      g.generateTexture(key, 8, 12);
      g.destroy();
    }
    const cx = GAME_WIDTH / 2;
    const cy = 260;
    const colours = [0xff8a1a, 0xffd23c, 0x4bb0ff, 0x8ee65e, 0xff77a8];
    const burst = this.add.particles(0, 0, key, {
      x: cx, y: cy,
      speedX: { min: -260, max: 260 },
      speedY: { min: -300, max: -60 },
      gravityY: 480,
      lifespan: 1100,
      scale: { start: 1, end: 0.6 },
      alpha: { start: 1, end: 0 },
      quantity: 24,
      tint: colours,
      emitting: false,
    }).setDepth(69);
    burst.explode(24, cx, cy);
    this.time.delayedCall(1400, () => burst.destroy());
  }
}
