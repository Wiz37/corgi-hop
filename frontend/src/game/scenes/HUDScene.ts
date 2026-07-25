import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@/main';
import { gameState } from '@/game/systems/GameState';

/**
 * HUDScene — Phaser-rendered heads-up display. Sits on top of GameScene and
 * listens for score / treats events. Includes trophy panel (top-left),
 * big center score, circular pause button (top-right), and the translucent
 * paw jump control near the bottom.
 */
export class HUDScene extends Phaser.Scene {
  private scoreText!: Phaser.GameObjects.Text;
  private bestText!: Phaser.GameObjects.Text;
  private treatsText!: Phaser.GameObjects.Text;

  constructor() { super('HUDScene'); }

  create(): void {
    const gs = this.scene.get('GameScene');

    // Trophy panel top-left
    const trophyC = this.add.container(24, 32).setDepth(50);
    const trophyPanel = this.add.image(0, 0, 'ui_trophy_panel').setOrigin(0, 0).setDisplaySize(280, 110);
    const trophyNumber = this.add.text(120, 50, `${gameState.bestScore}`, {
      fontFamily: 'system-ui', fontSize: '44px', fontStyle: '900',
      color: '#ffffff', stroke: '#24304a', strokeThickness: 5,
    }).setOrigin(0, 0.5);
    const bestLabel = this.add.text(24, 95, `BEST: ${gameState.bestScore}`, {
      fontFamily: 'system-ui', fontSize: '20px', fontStyle: '800',
      color: '#ffd23c', stroke: '#24304a', strokeThickness: 4,
    }).setOrigin(0, 0);
    trophyC.add([trophyPanel, trophyNumber, bestLabel]);
    trophyC.setData('testId', 'hud-trophy-panel');
    this.bestText = bestLabel;

    // Center big score
    this.scoreText = this.add.text(GAME_WIDTH / 2, 100, '0', {
      fontFamily: 'system-ui', fontSize: '140px', fontStyle: '900',
      color: '#ffffff', stroke: '#3a7fd8', strokeThickness: 14,
      shadow: { color: '#24304a', fill: true, blur: 4, offsetX: 0, offsetY: 6 },
    }).setOrigin(0.5).setDepth(50);
    this.scoreText.setData('testId', 'hud-score-text');

    // Pause button top-right (circular, image asset)
    const pause = this.add.image(GAME_WIDTH - 80, 90, 'ui_pause_button').setDisplaySize(110, 110).setDepth(50);
    pause.setInteractive({ useHandCursor: true });
    pause.setData('testId', 'hud-pause-button');
    pause.on('pointerdown', () => { this.tweens.add({ targets: pause, scale: pause.scale * 0.92, duration: 60, yoyo: true }); });
    pause.on('pointerup', () => {
      this.scene.pause('GameScene');
      this.scene.launch('PauseScene');
    });

    // Treats counter (top-right beneath pause)
    const treatsC = this.add.container(GAME_WIDTH - 24, 170).setDepth(50);
    const tbg = this.add.rectangle(-190, 0, 190, 56, 0x24304a, 0.75).setOrigin(0, 0.5).setStrokeStyle(4, 0xffffff);
    const tbone = this.add.image(-170, 0, 'treat').setDisplaySize(50, 28);
    this.treatsText = this.add.text(-135, 0, `${gameState.treats}`, {
      fontFamily: 'system-ui', fontSize: '28px', fontStyle: '900',
      color: '#ffd23c', stroke: '#24304a', strokeThickness: 4,
    }).setOrigin(0, 0.5);
    treatsC.add([tbg, tbone, this.treatsText]);
    treatsC.setData('testId', 'hud-treats-panel');

    // Bottom paw jump control
    const paw = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT - 200, 'ui_paw_button').setDisplaySize(220, 220).setAlpha(0.85).setDepth(50);
    paw.setInteractive({ useHandCursor: true });
    paw.setData('testId', 'hud-jump-button');
    paw.on('pointerdown', () => {
      this.tweens.add({ targets: paw, scale: paw.scale * 0.9, duration: 80, yoyo: true });
      // Directly forward to GameScene's tryJump handler.
      const game = this.scene.get('GameScene') as any;
      if (game && typeof game.tryJump === 'function') game.tryJump();
    });
    const label = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 84, 'TAP TO JUMP', {
      fontFamily: 'system-ui', fontSize: '30px', fontStyle: '900',
      color: '#ffffff', stroke: '#24304a', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(50);
    this.tweens.add({ targets: label, alpha: { from: 1, to: 0.7 }, duration: 900, yoyo: true, repeat: -1 });

    // Test-mode watermark for development builds
    if ((import.meta as any).env?.MODE !== 'production') {
      const badge = this.add.text(GAME_WIDTH - 20, GAME_HEIGHT - 40, 'TEST ADS', {
        fontFamily: 'system-ui', fontSize: '18px', fontStyle: '900',
        color: '#ffffff', backgroundColor: '#ff5555', padding: { left: 8, right: 8, top: 3, bottom: 3 },
      }).setOrigin(1, 1).setDepth(60);
      badge.setData('testId', 'hud-test-ads-badge');
    }

    // Listen to GameScene events
    gs.events.on('scoreChanged', (s: number) => {
      this.scoreText.setText(`${s}`);
      this.tweens.add({ targets: this.scoreText, scale: 1.15, duration: 90, yoyo: true });
    });
    gs.events.on('treatsChanged', (t: number) => {
      this.treatsText.setText(`${t}`);
    });

    // Cleanup on shutdown
    this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
      gs.events.off('scoreChanged');
      gs.events.off('treatsChanged');
    });
  }
}
