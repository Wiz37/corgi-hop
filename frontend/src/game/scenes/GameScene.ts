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
    const cd = CORGIS.find((c) => c.id === gameState.selectedCorgi) ?? CORGIS[0];
    const runTex = this.textures.exists('corgi_run') ? 'corgi_run' : 'corgi_idle';
    this.corgi = this.physics.add.sprite(GAME_WIDTH * 0.28, this.groundY - 20, runTex, 0);
    this.corgi.setDepth(12);
    this.corgi.setOrigin(0.5, 1);
    this.corgi.setDisplaySize(180, 170);
    if (cd.tint) this.corgi.setTint(cd.tint);
    if (this.anims.exists('run')) this.corgi.play('run');
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
    if (!this.textures.exists(key)) return;
    this.corgi.setTexture(key, frame);
    // Keep display size constant regardless of the source texture's native size.
    this.corgi.setDisplaySize(180, 170);
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
      if (body.velocity.y > 0) {
        // Just landed
        body.setVelocityY(0);
        this.coyoteUntil = time + this.COYOTE_MS;
        // Landing squash
        this.setCorgiTexture('corgi_land');
        this.tweens.add({ targets: this.corgi, displayHeight: 140, duration: 70, yoyo: true, onComplete: () => {
          if (!this.ended && this.anims.exists('run')) {
            this.setCorgiTexture('corgi_run', 0);
            this.corgi.play('run');
          }
        }});
      } else if (this.corgi.anims.currentAnim?.key !== 'run' && !this.ended) {
        if (this.anims.exists('run')) {
          this.setCorgiTexture('corgi_run', 0);
          this.corgi.play('run');
        }
      }
    } else {
      // Airborne — swap to jump/fall texture
      const vy = (this.corgi.body as Phaser.Physics.Arcade.Body).velocity.y;
      if (vy < 0) {
        this.setCorgiTexture('corgi_jump');
        this.corgi.anims.stop();
      } else if (vy > 0) {
        this.setCorgiTexture('corgi_fall');
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
    // Fair progression: only easy fences early on.
    let variant: 'single' | 'double' | 'wide-double' = 'single';
    if (score >= 18) {
      const r = Math.random();
      variant = r < 0.55 ? 'single' : r < 0.85 ? 'double' : 'wide-double';
    } else if (score >= 8) {
      variant = Math.random() < 0.75 ? 'single' : 'double';
    }

    const baseX = GAME_WIDTH + 120;
    const fenceH = 150; // display height of fence

    if (variant === 'single') {
      this.spawnFence(baseX, fenceH);
      this.nextGap = Phaser.Math.Between(560, 700);
    } else if (variant === 'double') {
      this.spawnFence(baseX, fenceH);
      this.spawnFence(baseX + 220, fenceH);
      this.nextGap = Phaser.Math.Between(620, 780);
    } else {
      this.spawnFence(baseX, fenceH);
      this.spawnFence(baseX + 360, fenceH);
      this.nextGap = Phaser.Math.Between(700, 860);
    }

    // Occasionally spawn a treat arc above the fence(s)
    if (Math.random() < 0.55) {
      const tx = baseX + (variant === 'wide-double' ? 180 : variant === 'double' ? 110 : 40);
      const ty = this.groundY - fenceH - 40 - Math.random() * 90;
      this.spawnTreat(tx, ty);
    }

    // Ensure spawn gap accounts for game speed (higher speed = longer gap so it's fair)
    const speedFactor = this.gameSpeed / 340;
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

    // Trigger game-over sequence
    this.running = false;
    this.ended = true;
    this.cameras.main.shake(220, 0.012);
    this.setCorgiTexture('corgi_hit');
    this.corgi.anims.stop();
    this.tweens.add({ targets: this.corgi, angle: -25, y: this.corgi.y - 40, duration: 300, ease: 'Sine.easeOut' });

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

  public getScore(): number { return this.score; }
  public getTreatsThisRun(): number { return this.treatsThisRun; }
}
