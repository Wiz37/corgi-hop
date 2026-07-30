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
import {
  bindForgivingTap,
  expandedCircle,
  expandedRectangle,
} from './TouchControls';

export interface PolishedButtonOptions {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  color?: number;
  shadowColor?: number;
  strokeColor?: number;
  textColor?: string;
  fontSize?: number;
  iconTexture?: string;
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
      fontSize: Math.round(opts.h * 0.48),
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

    const hasIcon = !!(opts.iconTexture && scene.textures.exists(opts.iconTexture));
    if (hasIcon && opts.iconTexture) {
      // Keep the icon and label centered as one visual group. The old -32% icon
      // offset left a large empty area on the right and made PLAY feel left-heavy.
      const iconX = -Math.min(opts.w * 0.18, opts.h * 0.68);
      const icon = scene.add.image(iconX, 0, opts.iconTexture);
      const iconSize = opts.h * 0.68 * (opts.iconScale ?? 1);
      icon.setDisplaySize(iconSize, iconSize);
      this.add(icon);
    }

    const labelX = hasIcon ? Math.min(opts.w * 0.09, opts.h * 0.32) : 0;
    this.text = scene.add.text(labelX, -2, opts.label, {
      fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      fontSize: `${this.opts.fontSize}px`,
      fontStyle: '900',
      color: this.opts.textColor,
      stroke: '#24304a',
      strokeThickness: 6,
      align: 'center',
    }).setOrigin(0.5);

    // Use more of the button face while guaranteeing that long labels still fit.
    const maxLabelWidth = hasIcon ? opts.w * 0.60 : opts.w - 28;
    if (this.text.width > maxLabelWidth) {
      const fitScale = maxLabelWidth / this.text.width;
      this.text.setScale(fitScale);
    }
    this.add(this.text);

    this.setSize(opts.w, opts.h);
    this.setInteractive(expandedRectangle(opts.w, opts.h), Phaser.Geom.Rectangle.Contains);
    if (opts.testId) this.setData('testId', opts.testId);

    bindForgivingTap(scene, this, () => this.onTapFn?.(), {
      activateOnPointerDown: true,
      activationDelayMs: 20,
      onPress: () => {
        this.drawBackground(true);
        scene.tweens.add({ targets: this, scale: 0.94, duration: 50, ease: 'Sine.easeOut' });
      },
      onRelease: () => {
        this.drawBackground(false);
        scene.tweens.add({ targets: this, scale: 1, duration: 80, ease: 'Back.Out' });
      },
    });
  }

  private drawBackground(pressed: boolean): void {
    const { w, h, color, shadowColor, strokeColor } = this.opts;
    const g = this.graphics;
    g.clear();

    const radius = h / 2;
    const shadowOffset = pressed ? 4 : 10;

    g.fillStyle(shadowColor, 1);
    g.fillRoundedRect(-w / 2, -h / 2 + shadowOffset, w, h, radius);

    g.fillStyle(color, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h - (pressed ? 4 : 0), radius);

    g.fillStyle(0xffffff, 0.35);
    g.fillRoundedRect(-w / 2 + 10, -h / 2 + 6, w - 20, h * 0.32, radius);

    g.lineStyle(6, strokeColor, 1);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, radius);
  }
}

/** Compact circular icon button (settings, privacy, how-to-play in menu corners). */
export interface CircleIconButtonOptions {
  x: number;
  y: number;
  size: number;
  label: string;
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
    this.graphics.fillStyle(0x24304a, 0.45);
    this.graphics.fillCircle(3, 5, opts.size / 2);
    this.graphics.fillStyle(color, 1);
    this.graphics.fillCircle(0, 0, opts.size / 2);
    this.graphics.fillStyle(0xffffff, 0.35);
    this.graphics.fillCircle(-opts.size / 8, -opts.size / 6, opts.size / 3.5);
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
    this.setInteractive(expandedCircle(opts.size), Phaser.Geom.Circle.Contains);
    if (opts.testId) this.setData('testId', opts.testId);

    bindForgivingTap(scene, this, () => this.onTapFn?.(), {
      activateOnPointerDown: true,
      activationDelayMs: 15,
      onPress: () => scene.tweens.add({ targets: this, scale: 0.9, duration: 50 }),
      onRelease: () => scene.tweens.add({ targets: this, scale: 1, duration: 75, ease: 'Back.Out' }),
    });
  }
}
