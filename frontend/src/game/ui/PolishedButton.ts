// PolishedButton — a Phaser button drawn entirely with Graphics + Text,
// so we get consistent, "premium mobile game" styling (deep shadow underlay,
// bright top gradient, thick dark navy stroke, bold white text with stroke).
//
// Usage:
//   const btn = new PolishedButton(this, {
//     x: 360, y: 700, w: 420, h: 118,
//     label: 'PLAY', color: 0xffb02f, testId: 'menu-play-button',
//     iconTexture: 'ui_paw_button',
//     onTap: () => this.scene.start('GameScene'),
//   });

import Phaser from 'phaser';

export interface PolishedButtonOptions {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  color?: number;         // main fill (default warm orange)
  shadowColor?: number;   // 3D underlay color
  strokeColor?: number;   // outer stroke color
  textColor?: string;
  fontSize?: number;
  iconTexture?: string;   // optional Phaser texture key rendered on the left
  iconScale?: number;
  testId?: string;
  depth?: number;
  onTap?: () => void;
}

export class PolishedButton extends Phaser.GameObjects.Container {
  private readonly onTapFn?: () => void;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly text: Phaser.GameObjects.Text;
  private readonly opts: Required<Omit<PolishedButtonOptions, 'iconTexture' | 'onTap' | 'testId' | 'iconScale' | 'depth'>> & PolishedButtonOptions;

  constructor(scene: Phaser.Scene, opts: PolishedButtonOptions) {
    super(scene, opts.x, opts.y);
    this.opts = {
      color: 0xffb02f,
      shadowColor: 0xb26810,
      strokeColor: 0x24304a,
      textColor: '#ffffff',
      fontSize: Math.round(opts.h * 0.42),
      iconScale: 1,
      depth: 30,
      ...opts,
    };
    this.setDepth(this.opts.depth ?? 30);
    this.onTapFn = opts.onTap;
    scene.add.existing(this);

    this.graphics = scene.add.graphics();
    this.add(this.graphics);
    this.drawBackground(false);

    if (opts.iconTexture && scene.textures.exists(opts.iconTexture)) {
      const icon = scene.add.image(-opts.w * 0.32, 0, opts.iconTexture);
      const iconSize = opts.h * 0.7 * (opts.iconScale ?? 1);
      icon.setDisplaySize(iconSize, iconSize);
      this.add(icon);
    }

    this.text = scene.add.text(0, -2, opts.label, {
      fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      fontSize: `${this.opts.fontSize}px`,
      fontStyle: '900',
      color: this.opts.textColor,
      stroke: '#24304a',
      strokeThickness: 6,
    }).setOrigin(0.5);
    this.add(this.text);

    this.setSize(opts.w, opts.h);
    this.setInteractive(
  new Phaser.Geom.Rectangle(
    -opts.w / 2 - 24,
    -opts.h / 2 - 24,
    opts.w + 48,
    opts.h + 48,
  ),
  Phaser.Geom.Rectangle.Contains,
);
    if (opts.testId) this.setData('testId', opts.testId);

    this.on('pointerdown', this.onDown, this);
    this.on('pointerup', this.onUp, this);
    this.on('pointerout', this.onOut, this);
  }

  private onDown = (): void => {
    this.drawBackground(true);
    this.scene.tweens.add({ targets: this, scale: 0.94, duration: 60, ease: 'Sine.easeOut' });
  };

  private onUp = (): void => {
    this.drawBackground(false);
    this.scene.tweens.add({ targets: this, scale: 1, duration: 90, ease: 'Back.Out' });
    if (this.onTapFn) {
      // Small delay so the bounce plays before scene changes.
      this.scene.time.delayedCall(60, () => this.onTapFn?.());
    }
  };

  private onOut = (): void => {
    this.drawBackground(false);
    this.scene.tweens.add({ targets: this, scale: 1, duration: 90, ease: 'Back.Out' });
  };

  private drawBackground(pressed: boolean): void {
    const { w, h, color, shadowColor, strokeColor } = this.opts;
    const g = this.graphics;
    g.clear();

    const radius = h / 2;
    const shadowOffset = pressed ? 4 : 10;

    // 3D underlay — a slightly-darker rounded rect offset down
    g.fillStyle(shadowColor, 1);
    g.fillRoundedRect(-w / 2, -h / 2 + shadowOffset, w, h, radius);

    // Main fill
    g.fillStyle(color, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h - (pressed ? 4 : 0), radius);

    // Top highlight strip (gloss)
    g.fillStyle(0xffffff, 0.35);
    g.fillRoundedRect(-w / 2 + 10, -h / 2 + 6, w - 20, h * 0.32, radius);

    // Outer stroke
    g.lineStyle(6, strokeColor, 1);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, radius);
  }
}

/** Compact circular icon button (settings, privacy, how-to-play in menu corners). */
export interface CircleIconButtonOptions {
  x: number;
  y: number;
  size: number;
  label: string;      // 1-2 char label, e.g. '?', 'ⓘ', 'P'
  color?: number;
  strokeColor?: number;
  testId?: string;
  onTap?: () => void;
}

export class CircleIconButton extends Phaser.GameObjects.Container {
  private readonly onTapFn?: () => void;
  private readonly graphics: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, opts: CircleIconButtonOptions) {
    super(scene, opts.x, opts.y);
    this.setDepth(35);
    this.onTapFn = opts.onTap;
    scene.add.existing(this);

    const color = opts.color ?? 0xffffff;
    const strokeColor = opts.strokeColor ?? 0x24304a;
    this.graphics = scene.add.graphics();
    // 3D underlay
    this.graphics.fillStyle(0x24304a, 0.45);
    this.graphics.fillCircle(3, 5, opts.size / 2);
    // Main
    this.graphics.fillStyle(color, 1);
    this.graphics.fillCircle(0, 0, opts.size / 2);
    // Highlight
    this.graphics.fillStyle(0xffffff, 0.35);
    this.graphics.fillCircle(-opts.size / 8, -opts.size / 6, opts.size / 3.5);
    // Stroke
    this.graphics.lineStyle(5, strokeColor, 1);
    this.graphics.strokeCircle(0, 0, opts.size / 2);
    this.add(this.graphics);

    const t = scene.add.text(0, 0, opts.label, {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: `${Math.round(opts.size * 0.5)}px`,
      fontStyle: '900',
      color: '#24304a',
    }).setOrigin(0.5, 0.55);
    this.add(t);

    this.setSize(opts.size, opts.size);
    this.setInteractive(new Phaser.Geom.Circle(0, 0, opts.size / 2), Phaser.Geom.Circle.Contains);
    if (opts.testId) this.setData('testId', opts.testId);

    this.on('pointerdown', () => scene.tweens.add({ targets: this, scale: 0.9, duration: 60, yoyo: true }));
    this.on('pointerup', () => this.onTapFn?.());
  }
}
