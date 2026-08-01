import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@/main';
import { buildParallax, scatterMenuDecor, type ParallaxLayers } from '@/game/systems/Parallax';
import { gameState, CORGIS } from '@/game/systems/GameState';
import { PolishedButton, CircleIconButton } from '@/game/ui/PolishedButton';
import { drawCompactTrophy, drawCompactBones } from '@/game/ui/PolishedHUD';

/**
 * MenuScene — polished illustrated countryside title screen.
 *
 * Composition:
 *   - Full sunny parallax scene (sky → sun → clouds → mountains → hills → grass → path → foliage)
 *   - Trees anchored to both sides of the ground, bushes + rocks + flowers
 *     scattered along the horizon
 *   - Big animated CORGI HOP logo (real texture) centred at the top
 *   - Focal PLAY button (extra large, gold, with paw icon)
 *   - Two secondary buttons (CORGIS, SHOP)
 *   - Small circular icon buttons for HOW-TO-PLAY and PRIVACY in the top-right
 *   - Trophy pill + treats pill along the top
 *   - Running corgi that crosses the scene from left to right and loops
 */
export class MenuScene extends Phaser.Scene {
  private layers!: ParallaxLayers;
  private corgi!: Phaser.GameObjects.Sprite;

  constructor() { super('MenuScene'); }

  create(): void {
    this.layers = buildParallax(this);
    // Menu is a static illustrated title screen — force all tile layers to a
    // known starting position and never advance them in update().
    this.layers.cloudsFar.tilePositionX = 0;
    this.layers.clouds.tilePositionX = 0;
    this.layers.mountains.tilePositionX = 0;
    this.layers.hills.tilePositionX = 0;
    this.layers.grass.tilePositionX = 0;
    this.layers.path.tilePositionX = 0;
    this.layers.foreground.tilePositionX = 0;
    scatterMenuDecor(this, this.layers.groundTop);
    this.cameras.main.fadeIn(260, 63, 167, 255);

    // ---- Running corgi that walks across the scene ----
    const runTex = this.textures.exists('corgi_run') ? 'corgi_run' : 'corgi_idle';
    this.corgi = this.add.sprite(-120, this.layers.groundTop - 40, runTex, 0);
    this.corgi.setDepth(15);
    this.corgi.setDisplaySize(200, 190);
    if (this.anims.exists('run')) this.corgi.play('run');
    // Ground shadow follows the corgi
    const shadow = this.add.ellipse(this.corgi.x, this.layers.groundTop - 4, 140, 26, 0x000000, 0.22).setDepth(14);
    // Corgi bounce
    this.tweens.add({ targets: this.corgi, y: this.layers.groundTop - 70, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // Corgi walks across screen and restarts
    this.tweens.add({
      targets: this.corgi,
      x: GAME_WIDTH + 140,
      duration: 9500,
      repeat: -1,
      onRepeat: () => { this.corgi.x = -120; },
      onUpdate: () => { shadow.x = this.corgi.x; },
      ease: 'Linear',
    });

    // ---- Logo (frozen — no scale/angle pulse) ----
    if (this.textures.exists('logo_corgi_hop')) {
      const logo = this.add.image(GAME_WIDTH / 2, 300, 'logo_corgi_hop').setDepth(40);
      const targetW = GAME_WIDTH * 0.78;
      logo.setScale(targetW / logo.width);
      logo.setData('testId', 'menu-logo');
    } else {
      const t = this.add.text(GAME_WIDTH / 2, 280, 'CORGI\nHOP', {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '130px',
        fontStyle: '900',
        color: '#ff8a1a',
        stroke: '#ffffff',
        strokeThickness: 16,
        align: 'center',
        shadow: { color: '#24304a', fill: true, blur: 4, offsetX: 0, offsetY: 8 },
      }).setOrigin(0.5).setDepth(40);
      this.tweens.add({ targets: t, scale: 1.03, angle: -1, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    // ---- Borderless HUD (matches gameplay style) ----
    // Compact trophy top-left, compact bones top-right — no panels/borders.
    drawCompactTrophy(this, 22, 30, gameState.bestScore);
    drawCompactBones(this, GAME_WIDTH - 22, 30, gameState.treats, 'top-right');

    // ---- Top-right corner icon buttons (privacy, how-to-play) ----
    new CircleIconButton(this, {
      x: GAME_WIDTH - 70, y: 156, size: 76, label: '?',
      testId: 'menu-howto-button',
      onTap: () => this.scene.start('HowToPlayScene'),
    });
    new CircleIconButton(this, {
      x: GAME_WIDTH - 70, y: 244, size: 76, label: 'P',
      color: 0xffedb5,
      testId: 'menu-privacy-button',
      onTap: () => this.scene.start('PrivacyScene'),
    });

    // ---- Big focal PLAY button ----
    new PolishedButton(this, {
      x: GAME_WIDTH / 2, y: 640, w: 460, h: 140,
      label: 'PLAY',
      color: 0xffb02f, shadowColor: 0xb26810,
      testId: 'menu-play-button',
      iconTexture: 'ui_paw_button', iconScale: 0.85,
      onTap: () => this.gotoGame(),
    });

    // Two smaller secondary buttons (side by side)
    new PolishedButton(this, {
      x: GAME_WIDTH / 2 - 130, y: 800, w: 260, h: 96,
      label: 'CORGIS', color: 0x4bb8ff, shadowColor: 0x1f6ea0,
      testId: 'menu-corgis-button',
      onTap: () => this.scene.start('CorgiSelectScene'),
    });
    new PolishedButton(this, {
      x: GAME_WIDTH / 2 + 130, y: 800, w: 260, h: 96,
      label: 'SHOP', color: 0x4bb04b, shadowColor: 0x1e6b1e,
      testId: 'menu-shop-button',
      onTap: () => this.scene.start('ShopScene'),
    });

    // Selected corgi indicator (small pill above the play button)
    const cd = CORGIS.find((c) => c.id === gameState.selectedCorgi) ?? CORGIS[0];
    const label = `Playing as: ${cd.name}`;
    const w = 320, h = 44, x = GAME_WIDTH / 2, y = 540;
    const g = this.add.graphics().setDepth(30);
    g.fillStyle(0x24304a, 0.75);
    g.fillRoundedRect(x - w / 2, y - h / 2, w, h, h / 2);
    g.lineStyle(3, 0xffffff, 0.85);
    g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, h / 2);
    this.add.text(x, y, label, {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '20px', fontStyle: '800', color: '#ffffff',
    }).setOrigin(0.5).setDepth(31);

    // "TAP" hint under buttons (frozen — no alpha pulse per freeze rules)
    this.add.text(GAME_WIDTH / 2, 920, 'Tap PLAY to start hopping!', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '22px', fontStyle: '800', color: '#ffffff',
      stroke: '#24304a', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(30);
  }

  // NOTE: no `update()` on MenuScene — the title is a static illustrated
  // scene. Only GameScene runs the parallax tick.

  private gotoGame(): void {
    this.cameras.main.fadeOut(200, 63, 167, 255);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('GameScene');
      this.scene.launch('HUDScene');
    });
  }
}
