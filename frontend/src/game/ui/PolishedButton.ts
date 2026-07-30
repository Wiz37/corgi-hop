// PolishedButton — a Phaser button drawn entirely with Graphics + Text,
// so we get consistent, premium mobile-game styling.

import Phaser from 'phaser';
import {
  bindForgivingTap,
  expandedCircle,
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
  private readonly touchZone: Phaser.GameObjects.Zone;
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
    this.text = scene.add.text(0, -2, opts.label, {
      fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      fontSize: `${this.opts.fontSize}px`,
      fontStyle: '900',
      color: this.opts.textColor,
      stroke: '#24304a',
      strokeThickness: 6,
      align: 'center',
    }).setOrigin(0.5);

    const iconSize = hasIcon ? opts.h * 0.58 * (opts.iconScale ?? 1) : 0;
    const gap = hasIcon ? Math.max(12, Math.round(opts.h * 0.10)) : 0;
    const maxLabelWidth = hasIcon
      ? Math.max(80, opts.w - iconSize - gap - 42)
      : opts.w - 28;
    if (this.text.width > maxLabelWidth) {
      this.text.setScale(maxLabelWidth / this.text.width);
    }

    if (hasIcon && opts.iconTexture) {
      const labelWidth = this.text.displayWidth;
      const groupWidth = iconSize + gap + labelWidth;
      const groupLeft = -groupWidth / 2;
      const icon = scene.add.image(groupLeft + iconSize / 2, 0, opts.iconTexture);
      icon.setDisplaySize(iconSize, iconSize);
      this.text.setX(groupLeft + iconSize + gap + labelWidth / 2);
      this.add(icon);
    } else {
      this.text.setX(0);
    }
    this.add(this.text);

    this.setSize(opts.w, opts.h);
    if (opts.testId) this.setData('testId', opts.testId);

    // Use a separate scene-level zone at the exact visual coordinates. This
    // avoids Container-local coordinate offsets that made iPhone taps register
    // to the left of the drawn button.
    this.touchZone = scene.add.zone(opts.x, opts.y, opts.w, opts.h + 24)
      .setDepth((this.opts.depth ?? 30) + 1)
      .setInteractive({ useHandCursor: true });
    if (opts.testId) this.touchZone.setData('testId', `${opts.testId}-touch-zone`);

    bindForgivingTap(scene, this.touchZone, () => this.onTapFn?.(), {
      activateOnPointerDown: true,
      activationDelayMs: 15,
      onPress: () => {
        this.drawBackground(true);
        scene.tweens.add({ targets: this, scale: 0.96, duration: 45, ease: 'Sine.easeOut' });
      },
      onRelease: () => {
        this.drawBackground(false);
        scene.tweens.add({ targets: this, scale: 1, duration: 75, ease: 'Back.Out' });
      },
    });

    this.once(Phaser.GameObjects.Events.DESTROY, () => this.touchZone.destroy());
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

    // Keep the white gloss inset evenly so its outline follows the button.
    g.fillStyle(0xffffff, 0.26);
    g.fillRoundedRect(
      -w / 2 + 12,
      -h / 2 + 8,
      w - 24,
      Math.max(18, h * 0.24),
      Math.max(12, radius - 8),
    );

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
