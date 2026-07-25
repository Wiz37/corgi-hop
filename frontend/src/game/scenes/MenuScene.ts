import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@/main';
import { buildParallax, PARALLAX_SPEEDS, type ParallaxLayers } from '@/game/systems/Parallax';
import { gameState, CORGIS } from '@/game/systems/GameState';

/**
 * MenuScene — polished title screen. Renders the same parallax scene as the
 * game (so the transition feels seamless) plus a bouncing corgi, the game
 * logo, and Phaser-rendered buttons (Play, Corgis, Shop, How To Play, Privacy).
 */
export class MenuScene extends Phaser.Scene {
  private layers!: ParallaxLayers;
  private corgi!: Phaser.GameObjects.Sprite;

  constructor() { super('MenuScene'); }

  create(): void {
    this.layers = buildParallax(this);
    this.cameras.main.fadeIn(240, 63, 167, 255);

    // Bouncing corgi (placed on the left of the menu, running toward buttons)
    const cd = CORGIS.find((c) => c.id === gameState.selectedCorgi) ?? CORGIS[0];
    const tex = this.textures.exists(cd.texture) ? cd.texture : 'corgi_idle';
    this.corgi = this.add.sprite(160, this.layers.groundTop - 50, tex);
    this.corgi.setDepth(15);
    this.corgi.setDisplaySize(180, 170);
    if (cd.tint) this.corgi.setTint(cd.tint);
    if (this.anims.exists('run') && tex === 'corgi_idle') {
      // Fresh corgi menu — animate the run sheet even though we picked idle
      this.corgi.setTexture('corgi_run', 0);
      this.corgi.setDisplaySize(180, 170);
      this.corgi.play('run');
    }
    this.tweens.add({ targets: this.corgi, y: this.layers.groundTop - 90, duration: 550, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Title logo (Phaser text — no HTML/emoji)
    const title = this.add.text(GAME_WIDTH / 2, 220, 'CORGI HOP', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '120px',
      fontStyle: '900',
      color: '#ff7a1a',
      stroke: '#ffffff',
      strokeThickness: 16,
      shadow: { color: '#24304a', fill: true, blur: 6, offsetX: 0, offsetY: 8 },
    }).setOrigin(0.5).setDepth(30);
    this.tweens.add({ targets: title, scale: { from: 1, to: 1.04 }, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Buttons — rendered by Phaser (spec: no HTML buttons over gameplay)
    const cx = GAME_WIDTH / 2;
    const buttons: Array<{ label: string; y: number; tex: string; testId: string; onTap: () => void }> = [
      { label: 'PLAY',         y: 700,  tex: 'ui_button',       testId: 'menu-play-button',       onTap: () => this.gotoGame() },
      { label: 'CORGIS',       y: 830,  tex: 'ui_button_blue',  testId: 'menu-corgis-button',     onTap: () => this.scene.start('CorgiSelectScene') },
      { label: 'SHOP',         y: 960,  tex: 'ui_button_gold',  testId: 'menu-shop-button',       onTap: () => this.scene.start('ShopScene') },
      { label: 'HOW TO PLAY',  y: 1080, tex: 'ui_button',       testId: 'menu-howto-button',      onTap: () => this.scene.start('HowToPlayScene') },
      { label: 'PRIVACY',      y: 1180, tex: 'ui_button_blue',  testId: 'menu-privacy-button',    onTap: () => this.scene.start('PrivacyScene') },
    ];
    for (const b of buttons) this.makeButton(cx, b.y, b.label, b.tex, b.testId, b.onTap);

    // Trophy / best score panel (top-left) — matches design-reference
    this.buildTrophyPanel();

    // Treats counter (top-right)
    this.buildTreatsPanel();
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    this.layers.clouds.tilePositionX     += PARALLAX_SPEEDS.clouds * dt;
    this.layers.mountains.tilePositionX  += PARALLAX_SPEEDS.mountains * dt;
    this.layers.hills.tilePositionX      += PARALLAX_SPEEDS.hills * dt * 0.3;
    this.layers.grass.tilePositionX      += PARALLAX_SPEEDS.grass * dt * 0.3;
    this.layers.path.tilePositionX       += PARALLAX_SPEEDS.path * dt * 0.3;
    this.layers.foreground.tilePositionX += PARALLAX_SPEEDS.foreground * dt * 0.3;
  }

  private makeButton(x: number, y: number, label: string, tex: string, testId: string, onTap: () => void): Phaser.GameObjects.Container {
    const c = this.add.container(x, y).setDepth(30);
    const img = this.add.image(0, 0, tex).setDisplaySize(360, 110);
    const txt = this.add.text(0, 0, label, {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '38px',
      fontStyle: '900',
      color: '#ffffff',
      stroke: '#24304a',
      strokeThickness: 6,
    }).setOrigin(0.5);
    c.add([img, txt]);
    c.setSize(360, 110);
    c.setInteractive(new Phaser.Geom.Rectangle(-180, -55, 360, 110), Phaser.Geom.Rectangle.Contains);
    c.setData('testId', testId);
    c.on('pointerdown', () => {
      this.tweens.add({ targets: c, scale: 0.94, duration: 60, yoyo: true });
    });
    c.on('pointerup', () => onTap());
    return c;
  }

  private buildTrophyPanel(): void {
    const c = this.add.container(20, 32).setDepth(40);
    const panel = this.add.image(0, 0, 'ui_trophy_panel').setOrigin(0, 0).setDisplaySize(280, 110);
    const label = this.add.text(120, 45, `${gameState.bestScore}`, {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '44px',
      fontStyle: '900',
      color: '#ffffff',
      stroke: '#24304a',
      strokeThickness: 5,
    }).setOrigin(0, 0.5);
    const best = this.add.text(24, 92, `BEST: ${gameState.bestScore}`, {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '20px',
      fontStyle: '800',
      color: '#ffd23c',
      stroke: '#24304a',
      strokeThickness: 4,
    }).setOrigin(0, 0);
    c.add([panel, label, best]);
    c.setData('testId', 'menu-trophy-panel');
  }

  private buildTreatsPanel(): void {
    const c = this.add.container(GAME_WIDTH - 20, 32).setDepth(40);
    const bg = this.add.rectangle(-180, 40, 180, 60, 0x24304a, 0.7).setOrigin(0, 0.5);
    bg.setStrokeStyle(4, 0xffffff);
    const bone = this.add.image(-155, 40, 'treat').setDisplaySize(50, 28);
    const t = this.add.text(-115, 40, `${gameState.treats}`, {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '30px',
      fontStyle: '900',
      color: '#ffd23c',
      stroke: '#24304a',
      strokeThickness: 4,
    }).setOrigin(0, 0.5);
    c.add([bg, bone, t]);
    c.setData('testId', 'menu-treats-panel');
  }

  private gotoGame(): void {
    this.cameras.main.fadeOut(180, 63, 167, 255);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('GameScene');
      this.scene.launch('HUDScene');
    });
  }
}
