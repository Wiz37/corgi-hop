import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@/main';

/** Semi-transparent pause overlay with Resume / Restart / Menu buttons. */
export class PauseScene extends Phaser.Scene {
  constructor() { super('PauseScene'); }

  create(): void {
    const dim = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.55).setDepth(0);
    dim.setInteractive();

    const panel = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'ui_panel').setDisplaySize(560, 720).setDepth(1);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 260, 'PAUSED', {
      fontFamily: 'system-ui', fontSize: '80px', fontStyle: '900',
      color: '#24304a', stroke: '#ffffff', strokeThickness: 10,
    }).setOrigin(0.5).setDepth(2).setData('testId', 'pause-title');

    this.mkBtn(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80, 'RESUME', 'ui_button', 'pause-resume', () => {
      this.scene.resume('GameScene');
      this.scene.stop();
    });
    this.mkBtn(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 40, 'RESTART', 'ui_button_gold', 'pause-restart', () => {
      this.scene.stop('GameScene');
      this.scene.stop('HUDScene');
      this.scene.start('GameScene');
      this.scene.launch('HUDScene');
      this.scene.stop();
    });
    this.mkBtn(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 160, 'MAIN MENU', 'ui_button_blue', 'pause-menu', () => {
      this.scene.stop('GameScene');
      this.scene.stop('HUDScene');
      this.scene.start('MenuScene');
      this.scene.stop();
    });
  }

  private mkBtn(x: number, y: number, label: string, tex: string, testId: string, onTap: () => void) {
    const c = this.add.container(x, y).setDepth(3);
    const img = this.add.image(0, 0, tex).setDisplaySize(400, 110);
    const t = this.add.text(0, 0, label, {
      fontFamily: 'system-ui', fontSize: '38px', fontStyle: '900',
      color: '#ffffff', stroke: '#24304a', strokeThickness: 6,
    }).setOrigin(0.5);
    c.add([img, t]);
    c.setSize(400, 110).setInteractive(new Phaser.Geom.Rectangle(-200, -55, 400, 110), Phaser.Geom.Rectangle.Contains);
    c.setData('testId', testId);
    c.on('pointerdown', () => this.tweens.add({ targets: c, scale: 0.94, duration: 60, yoyo: true }));
    c.on('pointerup', onTap);
    return c;
  }
}
