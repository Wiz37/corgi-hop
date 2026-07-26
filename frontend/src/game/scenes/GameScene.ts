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

    // Corgi
    // ROOT-CAUSE FIX (bug 4 — selected outfit lost in gameplay):
    // Previously the run texture was hardcoded to `corgi_run` regardless of
    // `gameState.selectedCorgi`. That meant premium corgis (cowboy, superhero,
    // pirate, astronaut, starter) reverted to Classic during runs. Now the
    // selected corgi's own texture is used — Classic keeps the animated
    // sprite-sheet, premium corgis use their static outfit art with a
    // subtle running bounce (approved-artwork fallback rule).
    const cd = CORGIS.find((c) => c.id === gameState.selectedCorgi) ?? CORGIS[0];
    const isClassic = cd.id === 'classic';
    const runTex = isClassic
      ? (this.textures.exists('corgi_run') ? 'corgi_run' : 'corgi_idle')
      : (this.textures.exists(cd.texture) ? cd.texture : (this.textures.exists('corgi_run') ? 'corgi_run' : 'corgi_idle'));
    // ROOT-CAUSE FIX (bug 2 — landing rock on start): spawn exactly on the
    // ground so the "wasFalling" branch doesn't trigger on frame 1.
    this.corgi = this.physics.add.sprite(GAME_WIDTH * 0.28, this.groundY, runTex, 0);
    this.corgi.setDepth(15);        // above foreground foliage
    this.corgi.setAlpha(1);         // guaranteed fully opaque
    this.corgi.clearTint();         // never tint the classic corgi
    this.corgi.setFlipX(false);     // always right-facing — NEVER flipped
    this.corgi.setAngle(0);         // no rotation, ever
    this.corgi.setOrigin(0.5, 1);
    this.corgi.setDisplaySize(190, 180);
    this.corgi.setBlendMode(Phaser.BlendModes.NORMAL);
    if (isClassic && this.anims.exists('run')) {
      this.corgi.play('run');
    } else if (!isClassic) {
      // Approved-artwork safe fallback: static outfit texture + subtle 2 px
      // vertical bounce tween so the outfit appears to be running.
      this.corgi.anims.stop();
      this.tweens.add({
        targets: this.corgi,
        y: this.corgi.y - 2,
        duration: 220,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
    // Collision box in physics body units — since arcade physics bodies are
    // sized in *source texture* units, compute from the source dimensions so the
    // hitbox stays consistent regardless of displaySize.
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

  private setCorgiTexture(key: string, frame: number | string = 0): void {
    // ROOT-CAUSE FIX (bug 4): route pose swaps through the selected corgi.
    // Only the Classic corgi has distinct jump/fall/land textures — for
    // every other outfit we keep the current outfit texture visible so the
    // hat / cape / helmet / bandana never disappears mid-run.
    const def = CORGIS.find((c) => c.id === gameState.selectedCorgi) ?? CORGIS[0];
    let finalKey = key;
    if (def.id !== 'classic') {
      // Premium corgi — stay on the outfit texture regardless of pose.
      finalKey = this.textures.exists(def.texture) ? def.texture : key;
    }
    if (!this.textures.exists(finalKey)) return;
    this.corgi.setTexture(finalKey, frame);
    // Defensive resets: opacity + orientation + display size never drift.
    this.corgi.setDisplaySize(190, 180);
    this.corgi.setAlpha(1);
    this.corgi.setFlipX(false);
    this.corgi.setBlendMode(Phaser.BlendModes.NORMAL);
    this.corgi.clearTint();
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
      (this.corgi.body as Phaser.Physics.Arcade.Body).setVelocityY(this.jumpVelocity);
      this.jumpBufferedUntil = 0;
      this.coyoteUntil = 0;
      gameState.totalJumps += 1;
      gameState.saveTotals();
      this.setCorgiTexture('corgi_jump');
      this.corgi.anims.stop();
    }
  }

  update(time: number, delta: number): void {
    if (this.ended) return;
    const dt = delta / 1000;

    // Ease game speed toward target for smooth acceleration
    this.gameSpeed += (this.targetSpeed - this.gameSpeed) * Math.min(1, dt * 2);

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
    if (this.corgi.y >= this.groundY) {
      this.corgi.y = this.groundY;
      const body = this.corgi.body as Phaser.Physics.Arcade.Body;
      // ROOT-CAUSE FIX (bug 2): only trigger the landing squash if the corgi
      // was actually FALLING FAST (>400 px/s downward). Otherwise plain
      // gravity slop would fire this every frame and the yoyo squash
      // produced a visible "rocking" pop.
      const wasFalling = body.velocity.y > 400;
      if (wasFalling) {
        body.setVelocityY(0);
        this.coyoteUntil = time + this.COYOTE_MS;
        // Landing squash — swap texture and hold briefly. NO yoyo tween on
        // displayHeight anymore (that was the source of the rocking).
        this.setCorgiTexture('corgi_land');
        this.corgi.anims.stop();
        const def = CORGIS.find((c) => c.id === gameState.selectedCorgi) ?? CORGIS[0];
        const isClassic = def.id === 'classic';
        this.time.delayedCall(90, () => {
          if (!this.ended) {
            if (isClassic && this.anims.exists('run')) {
              this.setCorgiTexture('corgi_run', 0);
              this.corgi.play('run');
            } else if (!isClassic) {
              // Premium: keep showing outfit texture
              this.setCorgiTexture(def.texture);
            }
          }
        });
      } else {
        body.setVelocityY(0);
        // On ground with negligible velocity → stay in run state.
        const def = CORGIS.find((c) => c.id === gameState.selectedCorgi) ?? CORGIS[0];
        const isClassic = def.id === 'classic';
        if (isClassic && this.corgi.anims.currentAnim?.key !== 'run' && !this.ended) {
          if (this.anims.exists('run')) {
            this.setCorgiTexture('corgi_run', 0);
            this.corgi.play('run');
          }
        }
      }
    } else {
      // Airborne — swap to jump/fall texture (NO angle tween, NO rotation).
      const vy = (this.corgi.body as Phaser.Physics.Arcade.Body).velocity.y;
      const def = CORGIS.find((c) => c.id === gameState.selectedCorgi) ?? CORGIS[0];
      const isClassic = def.id === 'classic';
      if (vy < 0) {
        // Ascending
        this.setCorgiTexture(isClassic ? 'corgi_jump' : def.texture);
        this.corgi.anims.stop();
      } else if (vy > 0) {
        // Descending
        this.setCorgiTexture(isClassic ? 'corgi_fall' : def.texture);
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
        const g1 = clampCluster(Phaser.Math.Between(200, 260));
        const g2 = clampCluster(Phaser.Math.Between(200, 260));
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
    const fenceW = 80;
    const f = this.add.sprite(x, this.groundY, 'fence').setOrigin(0.5, 1).setDepth(10);
    f.setDisplaySize(fenceW, fenceH);
    // Collision box matches the visible artwork exactly (fair collisions).
    (f as any).hitRect = new Phaser.Geom.Rectangle(-fenceW / 2 * 0.7, -fenceH * 0.95, fenceW * 0.7, fenceH * 0.9);
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
    this.cameras.main.shake(220, 0.012);
    this.setCorgiTexture('corgi_hit');
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
    if (this.anims.exists('run')) { this.setCorgiTexture('corgi_run', 0); this.corgi.play('run'); }
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
