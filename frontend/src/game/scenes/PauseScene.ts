import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@/main';
import { PolishedButton } from '@/game/ui/PolishedButton';
import { sound } from '@/services/audio/SoundService';

/** Semi-transparent pause overlay with Resume / Restart / Menu buttons. */
export class PauseScene extends Phaser.Scene {
  constructor() { super('PauseScene'); }

  create(): void {
    // Silence the background loop while the pause overlay is up.
    sound.pauseMusic();
    const dim = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.55).setDepth(0);
    dim.setInteractive();

    // Rounded panel drawn with Graphics
    const w = 560, h = 620;
    const g = this.add.graphics().setDepth(1);
    g.fillStyle(0x18223a, 0.55);
    g.fillRoundedRect(GAME_WIDTH / 2 - w / 2 + 4, GAME_HEIGHT / 2 - h / 2 + 8, w, h, 40);
    g.fillStyle(0xfff8ea, 1);
    g.fillRoundedRect(GAME_WIDTH / 2 - w / 2, GAME_HEIGHT / 2 - h / 2, w, h, 40);
    g.lineStyle(6, 0x24304a, 1);
    g.strokeRoundedRect(GAME_WIDTH / 2 - w / 2, GAME_HEIGHT / 2 - h / 2, w, h, 40);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 220, 'PAUSED', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '78px', fontStyle: '900',
      color: '#24304a', stroke: '#ffffff', strokeThickness: 10,
    }).setOrigin(0.5).setDepth(2).setData('testId', 'pause-title');

    new PolishedButton(this, {
      x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 - 60, w: 400, h: 110,
      label: 'RESUME', color: 0x4bb04b, shadowColor: 0x1e6b1e,
      testId: 'pause-resume',
      onTap: () => { sound.resumeMusic(); this.scene.resume('GameScene'); this.scene.stop(); },
    });
    new PolishedButton(this, {
      x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 + 60, w: 400, h: 110,
      label: 'RESTART', color: 0xffb02f, shadowColor: 0xb26810,
      testId: 'pause-restart',
      onTap: () => {
        this.scene.stop('GameScene');
        this.scene.stop('HUDScene');
        this.scene.start('GameScene');
        this.scene.launch('HUDScene');
        this.scene.stop();
      },
    });
    new PolishedButton(this, {
      x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 + 180, w: 400, h: 110,
      label: 'MAIN MENU', color: 0x4bb8ff, shadowColor: 0x1f6ea0,
      testId: 'pause-menu',
      onTap: () => {
        this.scene.stop('GameScene');
        this.scene.stop('HUDScene');
        this.scene.start('MenuScene');
        this.scene.stop();
      },
    });
  }
}
