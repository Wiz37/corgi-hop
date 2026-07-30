import Phaser from 'phaser';

export const QUICK_TAP_VELOCITY = -850;
export const HOLD_START_DELAY_MS = 45;
export const MAX_HOLD_MS = 320;
export const HOLD_UPWARD_ACCELERATION = 650;
export const MAX_HELD_UPWARD_VELOCITY = -1100;

const WORLD_GRAVITY = 2100;
const RISE_GRAVITY_OFFSET = -300;
const FALL_GRAVITY_OFFSET = 700;

interface VariableJumpState {
  pointerHeld: boolean;
  jumpStartedAt: number;
}

const states = new WeakMap<object, VariableJumpState>();
let installed = false;

function stateFor(scene: object): VariableJumpState {
  let state = states.get(scene);
  if (!state) {
    state = { pointerHeld: false, jumpStartedAt: 0 };
    states.set(scene, state);
  }
  return state;
}

export interface QuickTapArc {
  peakPx: number;
  totalAirMs: number;
  horizontalRangeAtSpeed: (speed: number) => number;
}

/** The quick-tap arc remains the fairness baseline. */
export function quickTapJumpArc(): QuickTapArc {
  const initialVelocity = Math.abs(QUICK_TAP_VELOCITY);
  const riseGravity = WORLD_GRAVITY + RISE_GRAVITY_OFFSET;
  const fallGravity = WORLD_GRAVITY + FALL_GRAVITY_OFFSET;
  const ascent = initialVelocity / riseGravity;
  const peakPx = (initialVelocity * initialVelocity) / (2 * riseGravity);
  const descent = Math.sqrt((2 * peakPx) / fallGravity);
  return {
    peakPx,
    totalAirMs: (ascent + descent) * 1000,
    horizontalRangeAtSpeed: (speed: number) => speed * (ascent + descent),
  };
}

export const QUICK_TAP_SAFE_OBSTACLE_HEIGHT = Math.floor(quickTapJumpArc().peakPx * 0.68);

/**
 * Tap gives the approved lower jump. Holding now gives a modestly higher ceiling
 * than the previous build, while all required obstacle validation still uses
 * the lower quick-tap arc.
 */
export function installVariableJump(
  GameSceneClass: { prototype: object },
  HUDSceneClass: { prototype: object },
): void {
  if (installed) return;
  installed = true;

  const gameProto = GameSceneClass.prototype as any;

  const originalCreate = gameProto.create;
  gameProto.create = function (...args: unknown[]) {
    const result = originalCreate.apply(this, args);
    this.jumpVelocity = QUICK_TAP_VELOCITY;
    states.set(this, { pointerHeld: false, jumpStartedAt: 0 });

    const originalTryJump = this.tryJump;
    this.input?.off?.('pointerdown', originalTryJump, this);
    this.input?.keyboard?.off?.('keydown-SPACE', originalTryJump, this);
    this.input?.keyboard?.off?.('keydown-UP', originalTryJump, this);

    this.tryJump = (...jumpArgs: unknown[]) => {
      const state = stateFor(this);
      state.pointerHeld = true;
      const beforeVelocity = Number(this.corgi?.body?.velocity?.y) || 0;
      const jumpResult = originalTryJump.apply(this, jumpArgs);
      const afterVelocity = Number(this.corgi?.body?.velocity?.y) || 0;
      if (afterVelocity <= QUICK_TAP_VELOCITY + 5 && afterVelocity < beforeVelocity - 100) {
        state.jumpStartedAt = Number(this.time?.now) || 0;
      }
      return jumpResult;
    };

    this.input?.on?.('pointerdown', this.tryJump, this);
    this.input?.keyboard?.on?.('keydown-SPACE', this.tryJump, this);
    this.input?.keyboard?.on?.('keydown-UP', this.tryJump, this);

    const release = () => this.releaseJump?.();
    this.input?.on?.('pointerup', release);
    this.input?.on?.('pointerupoutside', release);
    this.input?.keyboard?.on?.('keyup-SPACE', release);
    this.input?.keyboard?.on?.('keyup-UP', release);
    return result;
  };

  gameProto.releaseJump = function (): void {
    stateFor(this).pointerHeld = false;
  };

  const originalUpdate = gameProto.update;
  gameProto.update = function (time: number, delta: number, ...args: unknown[]) {
    const result = originalUpdate.call(this, time, delta, ...args);
    const state = stateFor(this);
    const elapsed = time - state.jumpStartedAt;
    const body = this.corgi?.body as Phaser.Physics.Arcade.Body | undefined;

    if (
      state.pointerHeld
      && state.jumpStartedAt > 0
      && elapsed >= HOLD_START_DELAY_MS
      && elapsed <= MAX_HOLD_MS
      && body
      && body.velocity.y < 0
      && !this.ended
    ) {
      const boost = HOLD_UPWARD_ACCELERATION * Math.max(0, delta) / 1000;
      body.setVelocityY(Math.max(MAX_HELD_UPWARD_VELOCITY, body.velocity.y - boost));
    }

    if (elapsed > MAX_HOLD_MS) state.pointerHeld = false;
    return result;
  };

  const hudProto = HUDSceneClass.prototype as any;
  const originalHudCreate = hudProto.create;
  hudProto.create = function (...args: unknown[]) {
    const result = originalHudCreate.apply(this, args);
    const gameScene = this.scene.get('GameScene') as any;
    const jumpHit = (this.children?.list ?? []).find(
      (child: any) => child?.getData?.('testId') === 'hud-jump-button',
    );
    jumpHit?.on?.('pointerup', () => gameScene.releaseJump?.());
    jumpHit?.on?.('pointerout', () => gameScene.releaseJump?.());

    const label = (this.children?.list ?? []).find(
      (child: any) => child instanceof Phaser.GameObjects.Text && child.text === 'TAP TO JUMP',
    ) as Phaser.GameObjects.Text | undefined;
    label?.setText('TAP = LOW  •  HOLD = HIGH');
    label?.setFontSize(24);
    label?.setY(900);
    label?.setDepth(54);
    label?.setBackgroundColor('rgba(36,48,74,0.58)');
    label?.setPadding(12, 6, 12, 6);
    return result;
  };
}
