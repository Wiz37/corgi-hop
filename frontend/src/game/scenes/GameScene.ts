import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@/main';
import { buildParallax, PARALLAX_SPEEDS, type ParallaxLayers } from '@/game/systems/Parallax';
import { gameState, CORGIS } from '@/game/systems/GameState';
import { services } from '@/services';

/**
 * GameScene — the actual gameplay. Single-tap jumping runner with progressive
 * difficulty. Uses Arcade Physics for the corgi, but obstacles + treats are
 * plain Sprites moved by the systems below so we control speed/spacing exactly.
 */
export class GameScene extends Phaser.Scene {
  private layers!: ParallaxLayers;
  private corgi!: Phaser.Physics.Arcade.Sprite;
  private shadow!: Phaser.GameObjects.Ellipse;

  private obstacles!: Phaser.GameObjects.Group;
  private treats!: Phaser.GameObjects.Group;
  private dust!: Phaser.GameObjects.Particles.ParticleEmitter;
  private decor: Phaser.GameObjects.Image[] = [];

  private gameSpeed = 340;                // px/s, current world scroll speed
  private targetSpeed = 340;              // eased target
  private jumpVelocity = -1220;
  // Base uniform scale set by sizeCorgiUniform(). The body-bounce tween
  // oscillates scaleY around this value, and pose swaps use it as the reset
  // target so scale never drifts during a run.
  private baseScale = 1;
  // Physics-safe body bounce for the "running" feel — a yoyo on scaleY,
  // which never modifies the physics body's y coordinate. Applies to ALL
  // corgis (classic ALSO plays its 8-frame leg animation on top of this).
  private runBounceTween: Phaser.Tweens.Tween | null = null;
  // Tracks the current run frame rate so we only recreate the animation +
  // bounce tween when the world speed changes meaningfully (avoids
  // rebuilding a Phaser tween every frame).
  private currentRunFps = 0;
  // Phase accumulator for the vertical body bob applied while grounded and
  // running. Advances proportionally to `currentRunFps` so the bob stays
  // synced to the stride cadence at every game speed.
  private runBobPhase = 0;
  // Which sheet / animation the currently-selected corgi uses. Captured once
  // in create() so state transitions in update() never have to look them up
  // again — and so tests can assert the correct sheet is bound.
  private runTexKey = 'corgi_run';
  private runAnimKey = 'run';
  // Distance in world-pixels a single run frame should "cover". Chosen so
  // the corgi's stride cadence feels natural across the full speed range
  // (340 → 760 px/s ⇒ 12–27 fps). Prevents the "ice-skating" effect where
  // frames advance at a fixed rate while the world scrolls faster.
  private readonly STRIDE_PIX = 28;
  private score = 0;
  private treatsThisRun = 0;
  private doubleTreatsClaimed = false;

  private running = false;
  private ended = false;
  private groundY = 900;
  private lastSpawnX = GAME_WIDTH + 240;
  private nextGap = 520;                  // spawn distance ahead of screen
  private invulnerableUntil = 0;
  private reviveUsed = false;
  private startingShieldActive = false;

  // Jump feel
  private coyoteUntil = 0;
  private jumpBufferedUntil = 0;
  private readonly COYOTE_MS = 110;
  private readonly BUFFER_MS = 140;

  constructor() { super('GameScene'); }

  create(): void {
    // Reset per-run state (decor is rebuilt in create, but keep the array
    // reference clean between restarts).
    this.decor = [];
    this.running = true;
    this.ended = false;
    this.gameSpeed = 340;
    this.targetSpeed = 340;
    this.score = 0;
    this.treatsThisRun = 0;
    this.doubleTreatsClaimed = false;
    this.reviveUsed = false;
    this.invulnerableUntil = 0;
    this.lastSpawnX = GAME_WIDTH + 900; // generous get-ready runway

    this.layers = buildParallax(this);
    this.groundY = this.layers.groundTop;
    this.cameras.main.fadeIn(220, 63, 167, 255);

    // Physics world bounds (leave floor open — we handle ground manually).
    this.physics.world.setBounds(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Corgi — resolve the selected corgi and its dedicated run sprite sheet.
    // Every corgi (Classic + all 5 premium skins) now runs from its OWN
    // 8-frame sheet loaded in PreloadScene, so the selected outfit stays
    // visible for the entire run and the leg cycle is baked into the frames.
    //
    // No cross-substitution: Classic never uses a premium sheet, and no
    // premium corgi uses Classic art. Airborne / landing poses for premium
    // corgis freeze on a specific frame of their OWN sheet (see cd.jumpFrame
    // / cd.fallFrame / cd.landFrame). Classic uses its dedicated corgi_jump /
    // corgi_fall / corgi_land pose textures instead.
    const cd = CORGIS.find((c) => c.id === gameState.selectedCorgi) ?? CORGIS[0];
    // The run sheet KEY (both the texture key and the animation key are
    // stored on the CorgiDef; both fall back to the classic run if the
    // premium sheet failed to preload for any reason).
    const runTexKey  = (cd.runSheetKey && this.textures.exists(cd.runSheetKey))
      ? cd.runSheetKey
      : 'corgi_run';
    const runAnimKey = (cd.runAnimKey && this.anims.exists(cd.runAnimKey))
      ? cd.runAnimKey
      : 'run';
    // Store on the scene so state transitions in update() can reuse them.
    this.runTexKey = runTexKey;
    this.runAnimKey = runAnimKey;
    // ROOT-CAUSE FIX (bug 2 — landing rock on start): spawn exactly on the
    // ground so the "wasFalling" branch doesn't trigger on frame 1.
    this.corgi = this.physics.add.sprite(GAME_WIDTH * 0.28, this.groundY, runTexKey, 0);
    this.corgi.setDepth(15);        // above foreground foliage
    this.corgi.setAlpha(1);         // guaranteed fully opaque
    this.corgi.clearTint();         // never tint the corgi
    this.corgi.setFlipX(false);     // always right-facing — NEVER flipped
    this.corgi.setAngle(0);         // no rotation, ever
    this.corgi.setOrigin(0.5, 1);
    this.corgi.setBlendMode(Phaser.BlendModes.NORMAL);
    // Uniform scaling — target a display HEIGHT and let width scale naturally
    // so every texture (run sheet, jump, fall, land, hit, and every premium
    // outfit) keeps its natural aspect ratio. This is the root fix for the
    // "oversized / vertically stretched" regression.
    this.sizeCorgiUniform();
    // Play the selected corgi's OWN run animation — every corgi now has a
    // real 8-frame leg cycle rather than a static-slide.
    if (this.anims.exists(runAnimKey)) {
      this.corgi.play(runAnimKey);
    }
    // Kick off the physics-safe body-bounce for the running gait. Applies to
    // EVERY corgi so premium outfits also visibly "run" and never look like
    // a still image sliding across the ground.
    this.startRunBounce();
    // Collision box in physics body units — since arcade physics bodies are
    // sized in *source texture* units, compute from the source dimensions so the
    // hitbox stays consistent regardless of displaySize.
    // NOTE: this is intentionally done AFTER sizeCorgiUniform() because the
    // latter also sets a body — we override with a slightly tighter box.
    this.corgi.body!.setSize(this.corgi.width * 0.55, this.corgi.height * 0.6, false);
    this.corgi.body!.setOffset(this.corgi.width * 0.22, this.corgi.height * 0.32);
    (this.corgi.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(false);

    // Ground shadow ellipse under the corgi
    this.shadow = this.add.ellipse(this.corgi.x, this.groundY - 4, 130, 26, 0x000000, 0.25).setDepth(11);

    // Dust particle emitter (small puff behind feet)
    const dustTex = this.makeDustTexture();
    this.dust = this.add.particles(0, 0, dustTex, {
      speedX: { min: -80, max: -30 },
      speedY: { min: -30, max: -60 },
      scale: { start: 0.5, end: 0.05 },
      alpha: { start: 0.7, end: 0 },
      lifespan: 500,
      quantity: 1,
      frequency: 60,
      follow: this.corgi,
      followOffset: { x: -55, y: -8 },
    }).setDepth(11);

    this.obstacles = this.add.group();
    this.treats = this.add.group();

    // Scatter static decor (bushes / rocks / flowers) properly anchored to
    // the ground. Placed AFTER the corgi so we can use the same groundY.
    this.addStaticDecor();

    // Start with a starting shield if the player has one from Starter Pack.
    if (services.purchases.consumeStartingShield()) {
      this.startingShieldActive = true;
      this.invulnerableUntil = this.time.now + 3000;
      this.flashShieldEffect();
    }

    // Input
    this.input.on('pointerdown', this.tryJump, this);
    this.input.keyboard?.on('keydown-SPACE', this.tryJump, this);
    this.input.keyboard?.on('keydown-UP', this.tryJump, this);

    // POST_UPDATE runs AFTER Arcade physics has copied body.y back to
    // sprite.y for the frame. Applying the vertical body-bob here means the
    // physics engine can't overwrite our draw offset — the bob is visible
    // every frame it's set.
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, this.applyRunBob, this);

    // Fire an event so HUD picks up score changes.
    this.events.emit('scoreChanged', this.score);
    this.events.emit('treatsChanged', gameState.treats);

    // Cleanly stop HUD & pause when parent scene stops
    this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.removeAllListeners();
      this.input.keyboard?.removeAllListeners();
    });
  }

  private makeDustTexture(): string {
    const key = 'dust_particle';
    if (this.textures.exists(key)) return key;
    const g = this.add.graphics({ x: -100, y: -100 });
    g.fillStyle(0xffffff, 1);
    g.fillCircle(16, 16, 16);
    g.generateTexture(key, 32, 32);
    g.destroy();
    return key;
  }

  /**
   * Uniform-scale sizing for the corgi sprite. Chooses ONE scale value based
   * on the target visible height (~160 px at 720x1280 design res) and
   * applies it as `setScale(s, s)`. This preserves the natural aspect ratio
   * of every source texture — no more independent width/height stretching.
   *
   * If a run-bounce tween is active it is stopped first so we can update
   * `baseScale` cleanly, and callers decide whether to restart it (they do
   * so after entering the "run" state via `startRunBounce()`).
   *
   * Also re-fits the arcade-physics body to match the visible dog so
   * collisions stay accurate as the texture changes between run / jump /
   * fall / land / hit poses.
   */
  private sizeCorgiUniform(): void {
    const TARGET_H = 160; // approved gameplay height
    const src = this.corgi.frame?.height ?? this.corgi.height;
    if (!src) return;
    if (this.runBounceTween && this.runBounceTween.isPlaying()) {
      this.runBounceTween.stop();
      this.runBounceTween = null;
    }
    const s = TARGET_H / src;
    this.baseScale = s;
    this.corgi.setScale(s, s);
    // Physics body — inset by ~15% on each side so the hit-box hugs the dog
    // rather than the whole transparent bounding rectangle.
    const body = this.corgi.body as Phaser.Physics.Arcade.Body | undefined;
    if (body) {
      const w = this.corgi.width;
      const h = this.corgi.height;
      const bw = w * 0.62;
      const bh = h * 0.78;
      body.setSize(bw, bh, false);
      body.setOffset((w - bw) / 2, h - bh);
    }
  }

  /**
   * Start the running body-bounce. Physics-safe because it only modifies
   * `scaleY` — the sprite's `y` coordinate is left alone so arcade physics
   * (gravity + jump velocity) works normally. Origin is (0.5, 1) so the
   * bounce compresses toward the feet, exactly like a real running gait.
   * Works for CLASSIC (on top of the 8-frame animation) and every premium
   * corgi (where it is the only source of motion).
   *
   * The bounce duration is derived from the current `gameSpeed` so the
   * bounce cadence stays synchronized with the leg-cycle frame rate (see
   * `syncRunTiming`). One full bounce = one stride.
   */
  private startRunBounce(): void {
    if (this.runBounceTween && this.runBounceTween.isPlaying()) return;
    if (this.baseScale <= 0) return;
    // Bounce duration follows the run FPS: half-cycle = 2 frames worth of time.
    const fps = Math.max(10, this.currentRunFps || (this.gameSpeed / this.STRIDE_PIX));
    const halfCycleMs = Math.max(70, (2000 / fps));
    this.runBounceTween = this.tweens.add({
      targets: this.corgi,
      scaleY: this.baseScale * 0.94,
      duration: halfCycleMs,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /**
   * Sync the run animation frame rate + body-bounce cadence to `gameSpeed`
   * so the corgi's legs cycle at a speed that matches how fast the world
   * is scrolling past it. Solves the classic 2D "ice-skating" problem where
   * the character's stride is out of sync with the ground movement.
   *
   * Called every update tick — cheap, only rebuilds the tween when the fps
   * changes by more than 0.5 to avoid churn.
   */
  private syncRunTiming(): void {
    const fps = Math.max(10, Math.min(30, this.gameSpeed / this.STRIDE_PIX));
    if (Math.abs(fps - this.currentRunFps) < 0.5) return;
    this.currentRunFps = fps;
    // Every corgi (Classic + all 5 premium skins) has its own 8-frame sheet
    // + registered animation. Retime the current animation's playback rate
    // so the leg cycle stays locked to the world scroll speed.
    const anim = this.corgi.anims.currentAnim;
    if (anim && anim.key === this.runAnimKey) {
      const msPerFrame = 1000 / fps;
      this.corgi.anims.msPerFrame = msPerFrame;
    }
    // Body-bounce tween: recreate at the new cadence so it stays locked to
    // the leg cycle. Only do this while the tween is already running (i.e.
    // corgi is on the ground). Otherwise the update to startRunBounce()'s
    // duration formula will pick up the new fps on the next start.
    if (this.runBounceTween && this.runBounceTween.isPlaying()) {
      this.runBounceTween.stop();
      this.runBounceTween = null;
      this.startRunBounce();
    }
  }

  /** Stop the running bounce and reset scaleY to the base value. */
  private stopRunBounce(): void {
    if (this.runBounceTween) {
      this.runBounceTween.stop();
      this.runBounceTween = null;
    }
    if (this.corgi) {
      this.corgi.setScale(this.baseScale, this.baseScale);
    }
  }

  /**
   * Apply asymmetric gravity to the corgi body so the jump feels responsive:
   *   - Rising:   lower total gravity  → the ascent "hangs" a bit near the peak.
   *   - Falling:  higher total gravity → the descent is snappier.
   * World gravity is 2400 (set in main.ts). We add a local body.gravity.y
   * offset that only affects this sprite.
   */
  private applyAirGravity(): void {
    const body = this.corgi.body as Phaser.Physics.Arcade.Body | undefined;
    if (!body) return;
    const vy = body.velocity.y;
    if (this.corgi.y >= this.groundY - 0.5 && vy === 0) {
      // Grounded — no offset.
      body.setGravityY(0);
    } else if (vy < 0) {
      // Rising: total gravity 2400 - 400 = 2000 → slower rise, satisfying hangtime.
      body.setGravityY(-400);
    } else {
      // Falling: total gravity 2400 + 1000 = 3400 → snappier fall.
      body.setGravityY(1000);
    }
  }

  /**
   * Route pose swaps through the currently-selected corgi. Every corgi has
   * its OWN run sprite sheet + its OWN jump/fall/land poses (either as
   * dedicated PNGs for Classic, or as specific frames of its run sheet for
   * every premium skin). Under NO circumstance is Classic artwork used as a
   * visual substitute for a premium outfit and vice-versa.
   *
   * `logicalPose` is one of the semantic states — 'run' | 'jump' | 'fall' |
   * 'land' | 'hit'. We map that to a concrete (texture-key, frame-index)
   * pair based on the selected corgi.
   */
  private setPose(logicalPose: 'run' | 'jump' | 'fall' | 'land' | 'hit'): void {
    const def = CORGIS.find((c) => c.id === gameState.selectedCorgi) ?? CORGIS[0];
    let texKey: string;
    let frame: number = 0;
    if (def.id === 'classic') {
      // Classic has dedicated pose textures.
      switch (logicalPose) {
        case 'run':  texKey = 'corgi_run';  break;
        case 'jump': texKey = 'corgi_jump'; break;
        case 'fall': texKey = 'corgi_fall'; break;
        case 'land': texKey = 'corgi_land'; break;
        case 'hit':  texKey = 'corgi_hit';  break;
      }
    } else {
      // Premium corgi — every pose uses THIS corgi's own run sheet so the
      // outfit (hat, cape, helmet, bandana, collar) is guaranteed to be
      // visible during every state. Airborne / landing poses freeze on a
      // per-corgi tuned frame index.
      texKey = def.runSheetKey!;
      switch (logicalPose) {
        case 'run':  frame = 0; break;
        case 'jump': frame = def.jumpFrame ?? 4; break;
        case 'fall': frame = def.fallFrame ?? 6; break;
        case 'land': frame = def.landFrame ?? 0; break;
        case 'hit':  frame = def.landFrame ?? 0; break;
      }
    }
    // Fallback if the resolved texture isn't loaded (should never happen in
    // production but keeps us safe).
    if (!this.textures.exists(texKey)) return;
    // Guard against redundant per-frame calls (this prevents sizeCorgiUniform
    // from stopping every launch-pop tween on the first ascend frame).
    const sameTex = this.corgi.texture && this.corgi.texture.key === texKey;
    const currentFrameName = this.corgi.frame?.name;
    const sameFrame = String(frame) === String(currentFrameName);
    if (sameTex && sameFrame) return;
    this.corgi.setTexture(texKey, frame);
    this.sizeCorgiUniform();
    this.corgi.setAlpha(1);
    this.corgi.setFlipX(false);
    this.corgi.setBlendMode(Phaser.BlendModes.NORMAL);
    this.corgi.clearTint();
  }

  /**
   * @deprecated Legacy pose setter — kept only for external callers that
   * hardcode Classic texture keys. New code should use `setPose()`.
   */
  private setCorgiTexture(key: string, frame: number | string = 0): void {
    // Route to setPose based on the classic key mapping.
    if (key === 'corgi_run')  { this.setPose('run');  return; }
    if (key === 'corgi_jump') { this.setPose('jump'); return; }
    if (key === 'corgi_fall') { this.setPose('fall'); return; }
    if (key === 'corgi_land') { this.setPose('land'); return; }
    if (key === 'corgi_hit')  { this.setPose('hit');  return; }
    // Unknown legacy key — best-effort direct swap.
    if (!this.textures.exists(key)) return;
    if (this.corgi.texture && this.corgi.texture.key === key) return;
    this.corgi.setTexture(key, frame);
    this.sizeCorgiUniform();
    this.corgi.setAlpha(1);
    this.corgi.setFlipX(false);
    this.corgi.setBlendMode(Phaser.BlendModes.NORMAL);
    this.corgi.clearTint();
  }

  /**
   * Applied AFTER Arcade physics — safely nudges the sprite's y up by a
   * sine-wave bob whenever the corgi is on the ground and running. Never
   * touches the physics body, so gravity / jump velocity behave normally.
   */
  private applyRunBob(): void {
    if (this.ended || !this.corgi) return;
    const body = this.corgi.body as Phaser.Physics.Arcade.Body | undefined;
    if (!body) return;
    // Only bob while on the ground with roughly zero vertical velocity.
    const nearGround = this.corgi.y >= this.groundY - 5;
    const still = Math.abs(body.velocity.y) < 20;
    if (!(nearGround && still)) return;
    const bob = Math.sin(this.runBobPhase);
    const upBob = Math.max(0, bob) * 3; // 0..3 px
    this.corgi.y = this.groundY - upBob;
  }

  public tryJump = (): void => {
    if (this.ended || !this.running) return;
    this.jumpBufferedUntil = this.time.now + this.BUFFER_MS;
    this.executeJumpIfPossible();
  };

  private executeJumpIfPossible(): void {
    const now = this.time.now;
    const onGround = this.corgi.body!.velocity.y === 0 && this.corgi.y >= this.groundY - 1;
    const canCoyote = now < this.coyoteUntil;
    if ((onGround || canCoyote) && now < this.jumpBufferedUntil) {
      // Stop the running bounce BEFORE applying jump velocity so scaleY is
      // reset cleanly. The tween can no longer interfere with the jump arc.
      this.stopRunBounce();
      (this.corgi.body as Phaser.Physics.Arcade.Body).setVelocityY(this.jumpVelocity);
      this.jumpBufferedUntil = 0;
      this.coyoteUntil = 0;
      gameState.totalJumps += 1;
      gameState.saveTotals();
      this.setPose('jump');
      this.corgi.anims.stop();
      // PHYSICAL-JUMP POLISH — Emit a one-shot "launch pop" tween that
      // squash-stretches the sprite briefly on takeoff. Purely visual: the
      // tween runs on scaleX/scaleY around the current baseScale so the
      // physics body is never affected. Emphasises that the corgi is
      // physically launching itself off the ground.
      this.playLaunchPop();
      // Kick a small dust puff at the corgi's feet so the takeoff reads as
      // a real physical lift-off instead of a static texture swap.
      this.spawnJumpPuff();
    }
  }

  /**
   * Plays a brief squash → stretch → settle tween on the corgi sprite the
   * instant a jump is initiated. Never touches the physics body — only
   * scaleX / scaleY. Uses baseScale so it stays proportional across all
   * corgis (Classic + premium outfits).
   */
  private playLaunchPop(): void {
    if (!this.corgi || this.baseScale <= 0) return;
    // Kill any residual scale tween so this one always wins visually.
    this.tweens.killTweensOf(this.corgi);
    const b = this.baseScale;
    // Reset then run a very short pop.
    this.corgi.setScale(b, b);
    this.tweens.add({
      targets: this.corgi,
      scaleX: b * 0.92,
      scaleY: b * 1.14,
      duration: 90,
      ease: 'Quad.easeOut',
      yoyo: true,
      onComplete: () => {
        // Return exactly to base so subsequent pose swaps don't drift.
        if (this.corgi) this.corgi.setScale(this.baseScale, this.baseScale);
      },
    });
  }

  /**
   * One-shot "kick puff" of dust at the corgi's paws when the jump fires.
   * Uses the same dust texture as the running trail but bursts a batch of
   * particles in a tight cone downward-behind, then fades out.
   */
  private spawnJumpPuff(): void {
    if (!this.corgi) return;
    const key = this.makeDustTexture();
    const px = this.corgi.x - 20;
    const py = this.groundY - 6;
    const burst = this.add.particles(0, 0, key, {
      x: px,
      y: py,
      speedX: { min: -220, max: -60 },
      speedY: { min: -140, max: -40 },
      scale: { start: 0.75, end: 0.05 },
      alpha: { start: 0.85, end: 0 },
      lifespan: 480,
      quantity: 8,
      emitting: false,
    }).setDepth(11);
    burst.explode(8, px, py);
    // Auto-destroy after the burst fades so we don't leak emitters.
    this.time.delayedCall(600, () => burst.destroy());
  }

  update(time: number, delta: number): void {
    if (this.ended) return;
    const dt = delta / 1000;

    // Ease game speed toward target for smooth acceleration
    this.gameSpeed += (this.targetSpeed - this.gameSpeed) * Math.min(1, dt * 2);

    // Keep the run animation cadence + body-bounce locked to the current
    // world scroll speed — no more "ice-skating" corgi.
    this.syncRunTiming();
    // Apply asymmetric gravity so the jump slows near the peak and drops
    // faster on the way down.
    this.applyAirGravity();

    // Parallax: distance layers move slower
    const spd = this.gameSpeed / 420; // normalised
    this.layers.clouds.tilePositionX     += PARALLAX_SPEEDS.clouds * dt;
    this.layers.mountains.tilePositionX  += PARALLAX_SPEEDS.mountains * dt * spd;
    this.layers.hills.tilePositionX      += PARALLAX_SPEEDS.hills * dt * spd;
    this.layers.grass.tilePositionX      += PARALLAX_SPEEDS.grass * dt * spd;
    this.layers.path.tilePositionX       += this.gameSpeed * dt;
    this.layers.foreground.tilePositionX += this.gameSpeed * dt * 1.15;

    // Move obstacles + treats
    const dx = this.gameSpeed * dt;
    // Scroll static decor (bushes / trees / rocks) at their per-item rate,
    // wrapping around off the left edge so the horizon feels continuously
    // populated.
    for (const d of this.decor) {
      const scrollRate = (d as any).__scroll ?? 60;
      d.x -= scrollRate * dt * (this.gameSpeed / 340);
      if (d.x < -160) d.x += GAME_WIDTH + 640; // re-enter from the right
    }
    this.obstacles.getChildren().forEach((o) => {
      const s = o as Phaser.GameObjects.Sprite & { hasBeenPassed?: boolean };
      s.x -= dx;
      if (!s.hasBeenPassed && s.x < this.corgi.x - 30) {
        s.hasBeenPassed = true;
        this.onObstaclePassed();
      }
      if (s.x < -160) s.destroy();
    });
    this.treats.getChildren().forEach((o) => {
      const s = o as Phaser.GameObjects.Sprite;
      s.x -= dx;
      // Rotate slightly for life
      s.rotation += dt * 2;
      if (s.x < -80) s.destroy();
      // Pickup collision
      const dxp = s.x - this.corgi.x;
      const dyp = s.y - (this.corgi.y - 90);
      if (Math.hypot(dxp, dyp) < 60) {
        this.collectTreat(s);
      }
    });

    // Constrain corgi to ground
    // We treat a small band above `groundY` as "still on the ground" so the
    // per-stride vertical body bob (see below) does not accidentally flip the
    // corgi into the airborne branch.
    const BOB_TOLERANCE = 5;
    if (this.corgi.y >= this.groundY - BOB_TOLERANCE
        && (this.corgi.body as Phaser.Physics.Arcade.Body).velocity.y >= -1) {
      // NOTE: we DON'T force `this.corgi.y = groundY` here anymore. The
      // per-stride bob below sets y to `groundY - upBob` each frame. Doing
      // this at the top of the branch would immediately erase the bob.
      const body = this.corgi.body as Phaser.Physics.Arcade.Body;
      // ROOT-CAUSE FIX (bug 2): only trigger the landing squash if the corgi
      // was actually FALLING FAST (>400 px/s downward). Otherwise plain
      // gravity slop would fire this every frame and the yoyo squash
      // produced a visible "rocking" pop.
      const wasFalling = body.velocity.y > 400;
      if (wasFalling) {
        body.setVelocityY(0);
        this.coyoteUntil = time + this.COYOTE_MS;
        // Landing squash — swap to the per-corgi land pose (Classic uses
        // corgi_land.png; premium corgis freeze on their `landFrame` of
        // their own run sheet so the outfit stays visible).
        this.setPose('land');
        this.corgi.anims.stop();
        this.stopRunBounce();   // squash pose — no bounce while landing
        this.time.delayedCall(90, () => {
          if (!this.ended) {
            // Return to the SELECTED corgi's OWN run animation (per-corgi
            // namespace: run / starter_run / cowboy_run / superhero_run /
            // pirate_run / astronaut_run).
            this.setPose('run');
            if (this.anims.exists(this.runAnimKey)) {
              this.corgi.play(this.runAnimKey);
            }
            // Restart the physics-safe body-bounce for the run.
            this.startRunBounce();
          }
        });
      } else {
        body.setVelocityY(0);
        // On ground with negligible velocity → stay in run state.
        if (this.corgi.anims.currentAnim?.key !== this.runAnimKey && !this.ended) {
          if (this.anims.exists(this.runAnimKey)) {
            this.setPose('run');
            this.corgi.play(this.runAnimKey);
          }
        }
        // Make sure the body-bounce is running whenever we are grounded and
        // still alive — recovers from any edge case where it was stopped.
        if (!this.ended && (!this.runBounceTween || !this.runBounceTween.isPlaying())) {
          this.startRunBounce();
        }
      }

      // ------ Vertical body bob (grounded-only, physics-safe) ------
      // Phase clock advances proportional to `currentRunFps` (one full bob
      // per 4 anim frames). The actual y offset is applied in the
      // POST_UPDATE hook (see `applyRunBob`) so physics.step cannot
      // overwrite it before the frame renders.
      if (!this.ended) {
        this.runBobPhase += dt * this.currentRunFps * (Math.PI * 2 / 4);
      }
    } else {
      // Airborne — swap to jump/fall pose (NO angle tween, NO rotation).
      const vy = (this.corgi.body as Phaser.Physics.Arcade.Body).velocity.y;
      // Body-bounce must not run while airborne — stops the scaleY yoyo
      // interfering with the natural jump/fall silhouette.
      if (this.runBounceTween && this.runBounceTween.isPlaying()) {
        this.stopRunBounce();
      }
      if (vy < 0) {
        // Ascending — every corgi shows its own jump pose (Classic uses the
        // corgi_jump texture; premium corgis freeze on their tuned jumpFrame
        // of their own run sheet so the hat/cape/helmet stays visible).
        this.setPose('jump');
        this.corgi.anims.stop();
      } else if (vy > 0) {
        // Descending — same idea for fall pose.
        this.setPose('fall');
        this.corgi.anims.stop();
      }
    }

    // Shadow follows the corgi horizontally, shrinks/fades as it rises
    const airborne = Math.max(0, this.groundY - this.corgi.y);
    this.shadow.setScale(Math.max(0.4, 1 - airborne / 400));
    this.shadow.setAlpha(Math.max(0.08, 0.28 - airborne / 800));

    // Buffered / coyote jump attempt
    if (time < this.jumpBufferedUntil) this.executeJumpIfPossible();

    // Spawn obstacles / treats ahead
    this.lastSpawnX -= dx;
    if (this.lastSpawnX < GAME_WIDTH - 30) this.spawnNext();

    // Obstacle collisions
    this.checkObstacleCollisions(time);

    // Difficulty ramp: score increases over time
    // (score ticks per obstacle pass; speed climbs continuously with distance)
    this.targetSpeed = Math.min(760, 340 + this.score * 8);
  }

  private spawnNext(): void {
    const score = this.score;

    // ---- Difficulty tiers (fair progression, more variety than before) ----
    // Each tier is a weighted table of obstacle patterns. Weights are picked so
    // that early runs stay easy and every run has different rhythm.
    type Pattern = 'single' | 'single-tall' | 'double-close' | 'double-mid' | 'wide-double' | 'triple';
    let table: Array<[Pattern, number]>;
    if (score < 8) {
      // Very easy opening — mostly single short hurdles, extremely generous
      // spacing (spec: scores 0-7).
      table = [['single', 100]];
    } else if (score < 18) {
      table = [['single', 80], ['single-tall', 20]];
    } else if (score < 30) {
      table = [['single', 50], ['single-tall', 20], ['double-mid', 20], ['double-close', 10]];
    } else {
      table = [['single', 30], ['single-tall', 20], ['double-mid', 20], ['double-close', 15], ['wide-double', 12], ['triple', 3]];
    }
    const totalW = table.reduce((s, [, w]) => s + w, 0);
    let roll = Math.random() * totalW;
    let variant: Pattern = 'single';
    for (const [p, w] of table) { roll -= w; if (roll <= 0) { variant = p; break; } }

    // ---- Hurdle heights — SHORTER and RANDOMISED per spec ----
    // The corgi can jump ~310 px high given jumpVelocity/gravity, so any
    // hurdle up to ~180 px is comfortably clearable. We stay well below that
    // for fairness and keep the maximum well within the corgi's arc.
    let shortH: number, midH: number, tallH: number;
    if (score < 8) {
      shortH = Phaser.Math.Between(85, 105);
      midH = shortH; tallH = shortH;
    } else if (score < 18) {
      shortH = Phaser.Math.Between(90, 115);
      midH = Phaser.Math.Between(100, 125);
      tallH = Phaser.Math.Between(115, 135);
    } else if (score < 30) {
      shortH = Phaser.Math.Between(95, 120);
      midH = Phaser.Math.Between(110, 135);
      tallH = Phaser.Math.Between(130, 150);
    } else {
      shortH = Phaser.Math.Between(100, 125);
      midH = Phaser.Math.Between(115, 140);
      tallH = Phaser.Math.Between(135, 160);
    }

    const baseX = GAME_WIDTH + 120;

    // ---- Physics-derived spacing limits (obstacle-generation validation) ----
    // Given jumpVelocity=-1220 and gravity=2400 the total air-time is ~1.02s.
    // Horizontal cover in one jump at the current gameSpeed:
    const airTime = (2 * Math.abs(this.jumpVelocity)) / 2400;
    const jumpRange = this.gameSpeed * airTime;
    // Between OBSTACLE GROUPS the corgi must land + take a stride + jump.
    // Enforce a runway of at least 55% of a jump-range or 320 px, whichever
    // is greater — no possible pattern spawns beyond this.
    const minRunway = Math.max(320, jumpRange * 0.55);
    // WITHIN a cluster (double / triple) the corgi jumps ONCE over both.
    // Cap the cluster span at 80% of jump range so it is always clearable.
    const maxClusterSpan = jumpRange * 0.8;
    const fenceW = 80;
    const clampCluster = (gap: number) => {
      const span = gap + fenceW;
      if (span > maxClusterSpan) return Math.max(160, maxClusterSpan - fenceW);
      return Math.max(160, gap);
    };
    const gapAfter = (lo: number, hi: number) =>
      Phaser.Math.Between(Math.max(lo, minRunway), Math.max(hi, minRunway + 60));

    // ---- Spawn each pattern with validated spacing ----
    switch (variant) {
      case 'single':
        this.spawnFence(baseX, shortH);
        this.nextGap = gapAfter(500, 720);
        break;
      case 'single-tall':
        this.spawnFence(baseX, tallH);
        this.nextGap = gapAfter(560, 780);
        break;
      case 'double-close': {
        const gap = clampCluster(Phaser.Math.Between(170, 220));
        this.spawnFence(baseX, shortH);
        this.spawnFence(baseX + gap, shortH);
        this.nextGap = gapAfter(620, 820);
        break;
      }
      case 'double-mid': {
        const gap = clampCluster(Phaser.Math.Between(240, 320));
        this.spawnFence(baseX, shortH);
        this.spawnFence(baseX + gap, Phaser.Math.RND.pick([shortH, midH]));
        this.nextGap = gapAfter(660, 860);
        break;
      }
      case 'wide-double': {
        const gap = clampCluster(Phaser.Math.Between(340, 420));
        this.spawnFence(baseX, shortH);
        this.spawnFence(baseX + gap, shortH);
        this.nextGap = gapAfter(720, 900);
        break;
      }
      case 'triple': {
        // Total cluster span must fit within a single jump. Distribute the
        // two internal gaps proportionally if they'd exceed maxClusterSpan.
        let g1 = Phaser.Math.Between(200, 260);
        let g2 = Phaser.Math.Between(200, 260);
        const totalWithFences = g1 + g2 + fenceW * 2;
        if (totalWithFences > maxClusterSpan) {
          const scale = (maxClusterSpan - fenceW * 2) / (g1 + g2);
          g1 = Math.max(160, Math.floor(g1 * scale));
          g2 = Math.max(160, Math.floor(g2 * scale));
        }
        g1 = clampCluster(g1);
        g2 = clampCluster(g2);
        this.spawnFence(baseX, shortH);
        this.spawnFence(baseX + g1, shortH);
        this.spawnFence(baseX + g1 + g2, shortH);
        this.nextGap = gapAfter(780, 980);
        break;
      }
    }

    // Randomised treats — sometimes over the fence, sometimes between them
    if (Math.random() < 0.6) {
      const treatCount = Math.random() < 0.25 ? 3 : Math.random() < 0.5 ? 2 : 1;
      for (let i = 0; i < treatCount; i++) {
        const tx = baseX + Phaser.Math.Between(20, 260) + i * 70;
        const ty = this.groundY - shortH - 30 - Phaser.Math.Between(0, 100);
        this.spawnTreat(tx, ty);
      }
    }

    // Ensure spawn gap accounts for game speed (higher speed = longer gap so it's fair)
    const speedFactor = Math.max(1, this.gameSpeed / 340);
    this.lastSpawnX = GAME_WIDTH + this.nextGap * speedFactor;
  }

  private spawnFence(x: number, fenceH: number): void {
    // WHITE PICKET FENCE hurdle — a single fully-opaque procedural texture
    // ('picket_fence') scaled to the requested height. Aspect is preserved
    // so pickets stay proportional. Bright white with a dark navy outline,
    // guaranteed visible against sky + background fence.
    const fenceW = 90;
    const f = this.add.sprite(x, this.groundY, 'picket_fence')
      .setOrigin(0.5, 1)
      .setDepth(10)
      .setAlpha(1);
    f.setDisplaySize(fenceW, fenceH);
    // Collision box matches the visible artwork exactly (fair collisions).
    (f as any).hitRect = new Phaser.Geom.Rectangle(-fenceW / 2 * 0.85, -fenceH * 0.95, fenceW * 0.85, fenceH * 0.9);
    this.obstacles.add(f);
  }

  private spawnTreat(x: number, y: number): void {
    const t = this.add.sprite(x, y, 'treat').setDepth(11).setDisplaySize(70, 40);
    this.treats.add(t);
  }

  private collectTreat(s: Phaser.GameObjects.Sprite): void {
    if (!s.active) return;
    s.destroy();
    this.treatsThisRun += 1;
    this.events.emit('treatsThisRun', this.treatsThisRun);
    gameState.addTreats(1);
    this.events.emit('treatsChanged', gameState.treats);
    // Little pop
    const pop = this.add.text(s.x, s.y, '+1', {
      fontFamily: 'system-ui', fontSize: '28px', fontStyle: '900',
      color: '#ffd23c', stroke: '#24304a', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(30);
    this.tweens.add({ targets: pop, y: pop.y - 60, alpha: 0, duration: 700, onComplete: () => pop.destroy() });
  }

  private onObstaclePassed(): void {
    this.score += 1;
    this.events.emit('scoreChanged', this.score);
  }

  private checkObstacleCollisions(time: number): void {
    if (time < this.invulnerableUntil) return;
    const cb = this.corgi.getBounds();
    // Shrink corgi collision a touch further for fairness.
    cb.x += 20; cb.y += 20; cb.width -= 40; cb.height -= 30;
    const children = this.obstacles.getChildren();
    for (const o of children) {
      const s = o as Phaser.GameObjects.Sprite & { hitRect?: Phaser.Geom.Rectangle };
      if (!s.active) continue;
      const hr = s.hitRect ?? new Phaser.Geom.Rectangle(-30, -160, 60, 160);
      const worldRect = new Phaser.Geom.Rectangle(s.x + hr.x, s.y + hr.y, hr.width, hr.height);
      if (Phaser.Geom.Intersects.RectangleToRectangle(cb, worldRect)) {
        this.hitObstacle(s);
        return;
      }
    }
  }

  private hitObstacle(obstacle: Phaser.GameObjects.Sprite): void {
    // Starting shield absorbs the first hit
    if (this.startingShieldActive) {
      this.startingShieldActive = false;
      this.invulnerableUntil = this.time.now + 1200;
      this.cameras.main.shake(120, 0.006);
      obstacle.destroy();
      return;
    }

    // Trigger game-over sequence. NO angle tween on the corgi any more —
    // that was the source of the "spinning" bug. We keep a small vertical
    // pop for feedback but never rotate the body.
    this.running = false;
    this.ended = true;
    this.stopRunBounce();      // no more scaleY oscillation after death
    this.cameras.main.shake(220, 0.012);
    this.setPose('hit');
    this.corgi.anims.stop();
    this.corgi.setAngle(0);
    this.corgi.setFlipX(false);
    this.tweens.add({ targets: this.corgi, y: this.corgi.y - 40, duration: 300, ease: 'Sine.easeOut' });

    // Save last collided obstacle for potential revive.
    const scene = this;
    this.time.delayedCall(600, () => {
      scene.scene.launch('GameOverScene', {
        score: scene.score,
        treatsThisRun: scene.treatsThisRun,
        doubleTreatsClaimed: scene.doubleTreatsClaimed,
        reviveUsed: scene.reviveUsed,
        onRevive: () => scene.revive(obstacle),
        onDoubleTreats: () => scene.applyDoubleTreats(),
        onRestart: () => scene.restart(),
        onMenu: () => scene.goMenu(),
      });
      scene.scene.pause();
    });
  }

  private revive(obstacle: Phaser.GameObjects.Sprite | null): void {
    // Called by GameOverScene AFTER a completed rewarded ad callback.
    this.reviveUsed = true;
    this.ended = false;
    this.running = true;
    if (obstacle && obstacle.active) obstacle.destroy();
    // Remove any obstacle currently overlapping the corgi
    const cb = this.corgi.getBounds();
    for (const o of this.obstacles.getChildren()) {
      const s = o as Phaser.GameObjects.Sprite;
      if (Phaser.Geom.Intersects.RectangleToRectangle(cb, s.getBounds())) s.destroy();
    }
    this.corgi.setAngle(0);
    this.corgi.y = this.groundY - 40;
    (this.corgi.body as Phaser.Physics.Arcade.Body).setVelocityY(-700);
    this.invulnerableUntil = this.time.now + 2000;
    if (this.anims.exists(this.runAnimKey)) { this.setPose('run'); this.corgi.play(this.runAnimKey); }
    this.scene.resume();
    this.flashShieldEffect();
  }

  private applyDoubleTreats(): void {
    // Called by GameOverScene AFTER completed rewarded ad; only once per run.
    if (this.doubleTreatsClaimed) return;
    this.doubleTreatsClaimed = true;
    gameState.addTreats(this.treatsThisRun); // add another copy
    this.events.emit('treatsChanged', gameState.treats);
  }

  private restart(): void {
    // Runs completed counter + maybe interstitial handled by GameOverScene.
    this.scene.stop('GameOverScene');
    this.scene.stop('HUDScene');
    this.scene.restart();
    this.scene.launch('HUDScene');
  }

  private goMenu(): void {
    this.scene.stop('GameOverScene');
    this.scene.stop('HUDScene');
    this.scene.start('MenuScene');
  }

  private flashShieldEffect(): void {
    const c = this.add.circle(this.corgi.x, this.corgi.y - 80, 90, 0xffffff, 0.4).setDepth(14);
    this.tweens.add({ targets: c, scale: 1.6, alpha: 0, duration: 500, onComplete: () => c.destroy() });
  }

  /** Sprinkle scrolling background decor grounded to the running path. */
  private addStaticDecor(): void {
    // ROOT-CAUSE FIX (bug 10 — floating bushes):
    // Bushes must render OVER the grass strip (depth 5) but BEHIND the corgi
    // (depth 15). Previously depth 4.7 placed them BEHIND the grass, causing
    // the top of each bush to poke above the grass edge — visually "floating".
    // Depth 6-7 puts them cleanly on top of the grass strip, feet grounded.
    // We also nudge the Y so the bush base (origin 0.5, 1) rests on the path
    // top, not below it.
    const items: Array<{ key: string; y: number; scale: number; depth: number; alpha?: number; scroll: number }> = [
      // Big trees sit slightly behind the fence line so their roots still
      // touch the grass strip.
      { key: 'tree_left',  y: this.groundY - 4,  scale: 0.35, depth: 6.4, alpha: 0.95, scroll: 60 },
      { key: 'tree_right', y: this.groundY - 4,  scale: 0.32, depth: 6.4, alpha: 0.95, scroll: 60 },
      // Small bushes hug the grass line (feet just above the path).
      { key: 'bush',       y: this.groundY - 2,  scale: 0.22, depth: 6.8, alpha: 1,    scroll: 90 },
      { key: 'bush',       y: this.groundY - 4,  scale: 0.20, depth: 6.8, alpha: 1,    scroll: 90 },
      // Rocks between the corgi and the horizon
      { key: 'rock',       y: this.groundY - 2,  scale: 0.20, depth: 6.8, alpha: 1,    scroll: 90 },
    ];
    const spacing = 520;
    for (let i = 0; i < 10; i++) {
      const spec = items[i % items.length];
      if (!this.textures.exists(spec.key)) continue;
      const x = 240 + i * spacing + Phaser.Math.Between(-70, 70);
      const img = this.add.image(x, spec.y, spec.key)
        .setOrigin(0.5, 1)
        .setDepth(spec.depth)
        .setScale(spec.scale)
        .setAlpha(spec.alpha ?? 1);
      (img as any).__scroll = spec.scroll;
      this.decor.push(img);
    }
  }

  public getScore(): number { return this.score; }
  public getTreatsThisRun(): number { return this.treatsThisRun; }
}
