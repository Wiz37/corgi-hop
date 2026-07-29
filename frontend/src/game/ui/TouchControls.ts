import Phaser from 'phaser';

export const TOUCH_CALIBRATION = {
  horizontalPadding: 18,
  verticalPadding: 44,
  circularPadding: 16,
  movementTolerance: 90,
  maximumTapDurationMs: 1200,
  duplicateGuardMs: 220,
} as const;

export function expandedRectangle(
  width: number,
  height: number,
  horizontalPadding = TOUCH_CALIBRATION.horizontalPadding,
  verticalPadding = TOUCH_CALIBRATION.verticalPadding,
): Phaser.Geom.Rectangle {
  return new Phaser.Geom.Rectangle(
    -width / 2 - horizontalPadding,
    -height / 2 - verticalPadding,
    width + horizontalPadding * 2,
    height + verticalPadding * 2,
  );
}

export function expandedCircle(
  diameter: number,
  padding = TOUCH_CALIBRATION.circularPadding,
): Phaser.Geom.Circle {
  return new Phaser.Geom.Circle(0, 0, diameter / 2 + padding);
}

interface ForgivingTapOptions {
  movementTolerance?: number;
  maximumTapDurationMs?: number;
  activationDelayMs?: number;
  onPress?: () => void;
  onRelease?: () => void;
}

/**
 * Keeps a tap armed when a finger drifts slightly outside the visible button.
 * This fixes the common mobile failure where pointerout cancels pointerup after
 * only a few pixels of natural thumb movement.
 */
export function bindForgivingTap(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.GameObject,
  onTap: () => void,
  options: ForgivingTapOptions = {},
): void {
  const movementTolerance = options.movementTolerance ?? TOUCH_CALIBRATION.movementTolerance;
  const maximumTapDurationMs = options.maximumTapDurationMs
    ?? TOUCH_CALIBRATION.maximumTapDurationMs;
  const activationDelayMs = options.activationDelayMs ?? 0;

  let activePointerId: number | null = null;
  let downX = 0;
  let downY = 0;
  let downAt = 0;
  let lastActivatedAt = -Infinity;

  const releaseVisual = (): void => options.onRelease?.();

  target.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
    if (activePointerId !== null) return;
    activePointerId = pointer.id;
    downX = pointer.x;
    downY = pointer.y;
    downAt = scene.time.now;
    options.onPress?.();
  });

  const finish = (pointer: Phaser.Input.Pointer): void => {
    if (activePointerId === null || pointer.id !== activePointerId) return;

    activePointerId = null;
    releaseVisual();

    const distance = Phaser.Math.Distance.Between(downX, downY, pointer.x, pointer.y);
    const duration = Math.max(0, scene.time.now - downAt);
    const now = scene.time.now;

    if (distance > movementTolerance || duration > maximumTapDurationMs) return;
    if (now - lastActivatedAt < TOUCH_CALIBRATION.duplicateGuardMs) return;
    lastActivatedAt = now;

    if (activationDelayMs > 0) scene.time.delayedCall(activationDelayMs, onTap);
    else onTap();
  };

  target.on('pointerup', finish);
  target.on('pointerupoutside', finish);

  // Reset the visual when the finger drifts away, but keep the tap armed. A
  // nearby release is still accepted by pointerupoutside.
  target.on('pointerout', releaseVisual);
}
