import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@/main';

/** How to Play — animated tutorial screen. */
export class HowToPlayScene extends Phaser.Scene {
  constructor() { super('HowToPlayScene'); }

  create(): void {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xa8dcff).setDepth(0);
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'bg_sky').setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setAlpha(0.6).setDepth(0);
    this.add.text(GAME_WIDTH / 2, 100, 'HOW TO PLAY', {
      fontFamily: 'system-ui', fontSize: '58px', fontStyle: '900',
      color: '#24304a', stroke: '#ffffff', strokeThickness: 8,
    }).setOrigin(0.5).setDepth(2).setData('testId', 'howto-title');

    // Corgi + paw button illustration
    const corgi = this.add.sprite(GAME_WIDTH / 2 - 120, 500, this.textures.exists('corgi_run') ? 'corgi_run' : 'corgi_idle', 0).setScale(0.5);
    if (this.anims.exists('run')) corgi.play('run');
    const paw = this.add.image(GAME_WIDTH / 2 + 160, 500, 'ui_paw_button').setDisplaySize(180, 180).setAlpha(0.9);
    this.tweens.add({ targets: paw, scale: paw.scale * 1.06, duration: 700, yoyo: true, repeat: -1 });

    this.add.text(GAME_WIDTH / 2, 700,
      'TAP anywhere or the PAW button to jump.\nAvoid the white fences.\nCollect bone treats to unlock new corgis.',
      {
        fontFamily: 'system-ui', fontSize: '22px', fontStyle: '700',
        color: '#24304a', align: 'center', wordWrap: { width: GAME_WIDTH - 80 },
      }
    ).setOrigin(0.5).setDepth(2);

    // Tips
    this.add.text(GAME_WIDTH / 2, 900,
      'Tips:\n• Timing beats speed — react to fences as they enter the screen.\n• Watch a rewarded ad to REVIVE once per run.\n• Optional 2x TREATS ad on the game-over screen.',
      {
        fontFamily: 'system-ui', fontSize: '18px', fontStyle: '600',
        color: '#3a4655', align: 'center', wordWrap: { width: GAME_WIDTH - 80 },
      }
    ).setOrigin(0.5).setDepth(2);

    this.mkBtn(GAME_WIDTH / 2, GAME_HEIGHT - 90, 'BACK', 'ui_button', 'howto-back', () => this.scene.start('MenuScene'));
  }

  private mkBtn(x: number, y: number, label: string, tex: string, testId: string, onTap: () => void) {
    const c = this.add.container(x, y).setDepth(3);
    const img = this.add.image(0, 0, tex).setDisplaySize(300, 100);
    const t = this.add.text(0, 0, label, {
      fontFamily: 'system-ui', fontSize: '28px', fontStyle: '900', color: '#ffffff', stroke: '#24304a', strokeThickness: 6,
    }).setOrigin(0.5);
    c.add([img, t]);
    c.setSize(300, 100).setInteractive(new Phaser.Geom.Rectangle(-150, -50, 300, 100), Phaser.Geom.Rectangle.Contains);
    c.setData('testId', testId);
    c.on('pointerup', onTap);
    return c;
  }
}
