let installed = false;

/** Adds a visible X-eyes reaction to every corgi skin after a real crash. */
export function installBonkEyes(GameSceneClass: { prototype: object }): void {
  if (installed) return;
  installed = true;

  const proto = GameSceneClass.prototype as any;
  const originalHitObstacle = proto.hitObstacle;
  if (typeof originalHitObstacle !== 'function') return;

  proto.hitObstacle = function (...args: unknown[]) {
    const shieldWasActive = Boolean(this.startingShieldActive);
    const alreadyEnded = Boolean(this.ended);
    const result = originalHitObstacle.apply(this, args);

    // A shielded bump is not a game-over BONK.
    if (shieldWasActive || alreadyEnded || !this.ended || !this.corgi?.active) {
      return result;
    }

    const xEyes = this.add.text(
      this.corgi.x + 43,
      this.corgi.y - 108,
      'X   X',
      {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '27px',
        fontStyle: '900',
        color: '#18223a',
        stroke: '#ffffff',
        strokeThickness: 5,
      },
    )
      .setOrigin(0.5)
      .setDepth(42)
      .setData('testId', 'bonk-x-eyes');

    // Match the corgi's brief upward squash/pop, then leave the eyes visible
    // long enough to read before the game-over panel appears.
    this.tweens.add({
      targets: xEyes,
      y: xEyes.y - 32,
      duration: 110,
      yoyo: true,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: xEyes,
          alpha: 0,
          delay: 360,
          duration: 140,
          onComplete: () => xEyes.destroy(),
        });
      },
    });

    return result;
  };
}
