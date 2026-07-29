import Phaser from 'phaser';

export const TOUCH_CALIBRATION = {
  // Do not widen buttons beyond their visible left/right edges: neighboring
  // buttons must never steal each other's touches.
  horizontalPadding: 0,
  // A modest vertical margin improves thumb comfort without overlapping the
  // PLAY button and the button row beneath it.
  verticalPadding: 18,
  // The visible circular controls are already large; a small halo keeps the
  // HOW-TO and PRIVACY controls separate.
  circularPadding: 5,
  movementTolerance: 110,
  maximumTapDurationMs: 1400,
  duplicateGuardMs: 260,
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
  activateOnPointerDown?: boolean;
  onPress?: () => void;
  onRelease?: () => void;
}

/**
 * Mobile-first tap binding. Buttons can activate on pointer-down so they feel
 * immediate and do not require a perfectly aligned release. Pointer-up mode is
 * still available for controls that need drag rejection before activation.
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
  const activateOnPointerDown = options.activateOnPointerDown ?? true;

  let activePointerId: number | null = null;
  let downX = 0;
  let downY = 0;
  let downAt = 0;
  let lastActivatedAt = -Infinity;

  const releaseVisual = (): void => options.onRelease?.();

  const activate = (): void => {
    const now = scene.time.now;
    if (now - lastActivatedAt < TOUCH_CALIBRATION.duplicateGuardMs) return;
    lastActivatedAt = now;
    if (activationDelayMs > 0) scene.time.delayedCall(activationDelayMs, onTap);
    else onTap();
  };

  target.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
    if (activePointerId !== null) return;
    activePointerId = pointer.id;
    downX = pointer.x;
    downY = pointer.y;
    downAt = scene.time.now;
    options.onPress?.();
    if (activateOnPointerDown) activate();
  });

  const finish = (pointer: Phaser.Input.Pointer): void => {
    if (activePointerId === null || pointer.id !== activePointerId) return;

    activePointerId = null;
    releaseVisual();
    if (activateOnPointerDown) return;

    const distance = Phaser.Math.Distance.Between(downX, downY, pointer.x, pointer.y);
    const duration = Math.max(0, scene.time.now - downAt);
    if (distance > movementTolerance || duration > maximumTapDurationMs) return;
    activate();
  };

  target.on('pointerup', finish);
  target.on('pointerupoutside', finish);

  // Reset the visual when a finger drifts away. The press is kept armed until
  // release, but pointer-down activation has already made the control respond.
  target.on('pointerout', releaseVisual);
}
