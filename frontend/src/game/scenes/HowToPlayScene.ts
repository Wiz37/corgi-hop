import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@/main';
import { PolishedButton } from '@/game/ui/PolishedButton';
import { buildParallax, scatterMenuDecor } from '@/game/systems/Parallax';

/** How to Play — animated tutorial screen. */
export class HowToPlayScene extends Phaser.Scene {
  constructor() { super('HowToPlayScene'); }

  create(): void {
    buildParallax(this);
    scatterMenuDecor(this, 920);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.4).setDepth(24);

    this.add.text(GAME_WIDTH / 2, 100, 'HOW TO PLAY', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '54px', fontStyle: '900',
      color: '#ffffff', stroke: '#24304a', strokeThickness: 8,
    }).setOrigin(0.5).setDepth(30).setData('testId', 'howto-title');

    // Corgi + paw illustration
    if (this.textures.exists('corgi_run')) {
      const corgi = this.add.sprite(GAME_WIDTH / 2 - 140, 460, 'corgi_run', 0).setDisplaySize(220, 210).setDepth(30);
      if (this.anims.exists('run')) corgi.play('run');
    }
    if (this.textures.exists('ui_paw_button')) {
      const paw = this.add.image(GAME_WIDTH / 2 + 140, 460, 'ui_paw_button').setDisplaySize(200, 200).setAlpha(0.95).setDepth(30);
      this.tweens.add({ targets: paw, scale: paw.scale * 1.08, duration: 700, yoyo: true, repeat: -1 });
    }

    // Instructions card
    const w = GAME_WIDTH - 80, h = 340;
    const cx = GAME_WIDTH / 2, cy = 780;
    const g = this.add.graphics().setDepth(28);
    g.fillStyle(0x18223a, 0.4);
    g.fillRoundedRect(cx - w / 2 + 4, cy - h / 2 + 6, w, h, 26);
    g.fillStyle(0xfff8ea, 1);
    g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 26);
    g.lineStyle(4, 0x24304a, 1);
    g.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 26);

    this.add.text(cx, cy - 100, 'TAP anywhere or the paw button to jump.\nAvoid the white fences.\nCollect bone treats to unlock corgis.', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '22px', fontStyle: '700', color: '#24304a', align: 'center',
      wordWrap: { width: w - 40 },
    }).setOrigin(0.5).setDepth(30);
    this.add.text(cx, cy + 50,
      'TIPS\n• Timing beats speed — react to fences as they enter the screen.\n• Watch a rewarded ad to REVIVE once per run.\n• Optional 2× TREATS ad on the game-over screen.',
      { fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: '17px', fontStyle: '600', color: '#3a4655', align: 'center', wordWrap: { width: w - 40 } }
    ).setOrigin(0.5).setDepth(30);

    new PolishedButton(this, {
      x: GAME_WIDTH / 2, y: GAME_HEIGHT - 90, w: 320, h: 100,
      label: 'BACK', color: 0x2a3d67, shadowColor: 0x18223a,
      testId: 'howto-back',
      onTap: () => this.scene.start('MenuScene'),
    });
  }
}
