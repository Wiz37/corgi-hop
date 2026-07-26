import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@/main';

/**
 * PreloadScene — loads all core assets (backgrounds, corgi frames, UI, obstacle
 * sprites) and shows a polished loading bar. When complete it transitions to
 * the MenuScene.
 */
export class PreloadScene extends Phaser.Scene {
  constructor() { super('PreloadScene'); }

  preload(): void {
    // Sky as full-screen backdrop for the loader
    const sky = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'bg_sky');
    sky.setDisplaySize(GAME_WIDTH, GAME_HEIGHT);

    // Title text
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.35, 'CORGI HOP', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '96px',
      fontStyle: '900',
      color: '#ff7a1a',
      stroke: '#ffffff',
      strokeThickness: 14,
      shadow: { color: '#24304a', fill: true, blur: 4, offsetX: 0, offsetY: 6 },
    }).setOrigin(0.5);

    // Loading bar
    const barW = GAME_WIDTH * 0.7;
    const barH = 28;
    const barX = (GAME_WIDTH - barW) / 2;
    const barY = GAME_HEIGHT * 0.58;
    const bg = this.add.rectangle(barX + barW / 2, barY + barH / 2, barW + 12, barH + 12, 0x24304a).setOrigin(0.5);
    bg.setStrokeStyle(4, 0xffffff);
    const fill = this.add.rectangle(barX, barY, 0, barH, 0xffd23c).setOrigin(0, 0);
    const pct = this.add.text(GAME_WIDTH / 2, barY + barH + 32, '0%', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '26px',
      fontStyle: '700',
      color: '#ffffff',
      stroke: '#24304a',
      strokeThickness: 4,
    }).setOrigin(0.5);
    this.load.on('progress', (v: number) => {
      fill.width = barW * v;
      pct.setText(`${Math.round(v * 100)}%`);
    });

    // Parallax background layers
    this.load.image('bg_clouds', '/assets/bg_clouds.png');
    this.load.image('bg_mountains', '/assets/bg_mountains.png');
    this.load.image('bg_hills', '/assets/bg_hills.png');
    this.load.image('bg_grass', '/assets/bg_grass.png');
    this.load.image('bg_path', '/assets/bg_path.png');
    this.load.image('bg_foreground', '/assets/bg_foreground.png');

    // Silently ignore missing assets so procedural fallbacks can take over
    // (Phaser also logs its own `Failed to process file` error to the console —
    // we can't suppress that from userland, so we accept the two known misses:
    // bg_clouds.png and ui_paw_button.png, which are drawn procedurally).
    this.load.on('loaderror', () => {
      // no-op: PreloadScene.create() rebuilds any missing texture with Graphics.
    });

    // Decoration sprites for the menu / gameplay foreground
    this.load.image('tree_left', '/assets/tree_left.png');
    this.load.image('tree_right', '/assets/tree_right.png');
    this.load.image('bush', '/assets/bush.png');
    this.load.image('flower_yellow', '/assets/flower_yellow.png');
    this.load.image('rock', '/assets/rock.png');
    this.load.image('trophy', '/assets/trophy.png');

    // Game logo (used on the menu title screen)
    this.load.image('logo_corgi_hop', '/assets/logo_corgi_hop.png');

    // Corgi: 8-frame horizontal run sheet (2928 x 352 => 366 x 352 per frame).
    // Cache-bust query string (`?v=…`) forces the browser to fetch the latest
    // repaired PNG whenever the corgi assets are updated — bypasses any stale
    // sprite data cached from earlier gameplay sessions.
    const V = 'v=20260726d';
    this.load.spritesheet('corgi_run', `/assets/corgi_run_sheet.png?${V}`, {
      frameWidth: 366,
      frameHeight: 352,
    });
    this.load.image('corgi_jump', `/assets/corgi_jump.png?${V}`);
    this.load.image('corgi_fall', `/assets/corgi_fall.png?${V}`);
    this.load.image('corgi_land', `/assets/corgi_land.png?${V}`);
    this.load.image('corgi_hit',  `/assets/corgi_hit.png?${V}`);
    this.load.image('corgi_idle', `/assets/corgi_idle.png?${V}`);

    // Premium corgi run sprite sheets — each 2928x352 laid out identically to
    // Classic's sheet so the same frame-width/height applies. Registered
    // under distinct texture keys so each corgi has its OWN animation
    // namespace (no cross-contamination of outfits, no visual substitution).
    this.load.spritesheet('starter_run',   `/assets/starter_run_sheet.png?${V}`,   { frameWidth: 366, frameHeight: 352 });
    this.load.spritesheet('cowboy_run',    `/assets/cowboy_run_sheet.png?${V}`,    { frameWidth: 366, frameHeight: 352 });
    this.load.spritesheet('superhero_run', `/assets/superhero_run_sheet.png?${V}`, { frameWidth: 366, frameHeight: 352 });
    this.load.spritesheet('pirate_run',    `/assets/pirate_run_sheet.png?${V}`,    { frameWidth: 366, frameHeight: 352 });
    this.load.spritesheet('astronaut_run', `/assets/astronaut_run_sheet.png?${V}`, { frameWidth: 366, frameHeight: 352 });

    // Cosmetic corgis — static portraits used on menus and shop.
    this.load.image('corgi_cowboy',    `/assets/corgi_cowboy.png?${V}`);
    this.load.image('corgi_pirate',    `/assets/corgi_pirate.png?${V}`);
    this.load.image('corgi_superhero', `/assets/corgi_superhero.png?${V}`);
    this.load.image('corgi_astronaut', `/assets/corgi_astronaut.png?${V}`);
    this.load.image('corgi_starter',   `/assets/corgi_starter.png?${V}`);

    // Obstacles
    this.load.image('fence', '/assets/fence.png');

    // UI
    this.load.image('ui_trophy_panel', '/assets/ui_trophy_panel.png');
    this.load.image('ui_pause_button', '/assets/ui_pause_button.png');
    this.load.image('ui_paw_button', '/assets/ui_paw_button.png');
    this.load.image('ui_panel', '/assets/ui_panel.png');
    this.load.image('ui_button', '/assets/ui_button.png');
    this.load.image('ui_button_blue', '/assets/ui_button_blue.png');
    this.load.image('ui_button_gold', '/assets/ui_button_gold.png');
    this.load.image('treat', '/assets/treat.png');
  }

  create(): void {
    // Define named animations up-front.
    if (!this.anims.exists('run')) {
      this.anims.create({
        key: 'run',
        frames: this.anims.generateFrameNumbers('corgi_run', { start: 0, end: 7 }),
        frameRate: 14,
        repeat: -1,
      });
    }
    // Per-corgi run animations — one animation per premium sheet so each
    // outfit gets its own namespace. All share Classic's stride cadence
    // (14 fps default; GameScene retimes msPerFrame each tick based on
    // gameSpeed via syncRunTiming()).
    const premiumRuns: Array<[string, string]> = [
      ['starter_run',   'starter_run'],
      ['cowboy_run',    'cowboy_run'],
      ['superhero_run', 'superhero_run'],
      ['pirate_run',    'pirate_run'],
      ['astronaut_run', 'astronaut_run'],
    ];
    for (const [animKey, texKey] of premiumRuns) {
      if (!this.anims.exists(animKey) && this.textures.exists(texKey)) {
        this.anims.create({
          key: animKey,
          frames: this.anims.generateFrameNumbers(texKey, { start: 0, end: 7 }),
          frameRate: 14,
          repeat: -1,
        });
      }
    }

    // Procedural fallbacks for any assets that failed to generate.
    if (!this.textures.exists('bg_clouds')) this.buildFallbackClouds();
    if (!this.textures.exists('ui_paw_button')) this.buildFallbackPaw();
    // ALWAYS rebuild the fence texture procedurally as a bright, opaque
    // white picket slat with a dark outline — the shipped fence.png is a
    // pale 3D bar that visually vanishes against the sky. See buildPicket().
    this.buildPicketSlat();

    // Small fade to menu
    this.cameras.main.fadeOut(220, 63, 167, 255);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('MenuScene');
    });
  }

  private buildFallbackClouds(): void {
    const W = 1600, H = 320;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    let rng = Phaser.Math.RND;
    interface Puff { x: number; y: number; r: number }
    const clouds: Puff[][] = [];
    let cx = 40;
    while (cx < W - 100) {
      const cloud: Puff[] = [];
      const cy = 30 + rng.between(0, 180);
      const puffs = rng.between(4, 7);
      for (let i = 0; i < puffs; i++) {
        cloud.push({ x: cx + i * 45 - puffs * 20 + rng.between(-10, 10), y: cy + rng.between(-10, 10), r: rng.between(38, 70) });
      }
      clouds.push(cloud);
      cx += rng.between(180, 320);
    }
    // Underside shadow
    g.fillStyle(0xa8dcff, 1);
    for (const c of clouds) for (const p of c) g.fillCircle(p.x, p.y + 10, p.r);
    // White body
    g.fillStyle(0xffffff, 1);
    for (const c of clouds) for (const p of c) g.fillCircle(p.x, p.y, p.r);
    g.generateTexture('bg_clouds', W, H);
    g.destroy();
  }

  private buildFallbackPaw(): void {
    const S = 400;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    // Translucent white circle
    g.fillStyle(0xffffff, 0.35);
    g.fillCircle(S / 2, S / 2, S / 2 - 6);
    g.lineStyle(6, 0xffffff, 0.9);
    g.strokeCircle(S / 2, S / 2, S / 2 - 6);
    // Center pad
    g.fillStyle(0xffffff, 0.9);
    g.fillEllipse(S / 2, S / 2 + 30, 140, 100);
    // Four toe pads
    const toes = [
      { x: S / 2 - 85, y: S / 2 - 40, w: 55, h: 65 },
      { x: S / 2 - 30, y: S / 2 - 80, w: 55, h: 65 },
      { x: S / 2 + 30, y: S / 2 - 80, w: 55, h: 65 },
      { x: S / 2 + 85, y: S / 2 - 40, w: 55, h: 65 },
    ];
    for (const t of toes) g.fillEllipse(t.x, t.y, t.w, t.h);
    g.generateTexture('ui_paw_button', S, S);
    g.destroy();
  }

  /**
   * Procedurally draw a full OPAQUE white picket-fence hurdle at native
   * resolution (240 × 240) and register it as 'picket_fence'. GameScene
   * spawnFence() scales this to the required hurdle height each spawn.
   *
   * Design:
   *   - 3 picket slats (pointed tops) at even spacing across the width.
   *   - 2 horizontal cross-rails tying them together (classic garden fence).
   *   - Bright white fill with a dark navy outline for high contrast against
   *     the sky and background fence.
   */
  private buildPicketSlat(): void {
    const W = 240, H = 240;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    const outline = 0x24304a;
    const white = 0xffffff;
    const shadow = 0xd8dee8;
    const outlineW = 4;

    const slatCount = 3;
    const slatW = 50;
    const slatSpacing = (W - slatCount * slatW) / (slatCount + 1);
    // Rails first, so pickets render on top for authentic layered look.
    const railY1 = Math.floor(H * 0.40);
    const railY2 = Math.floor(H * 0.72);
    const railH = 20;
    // rail outlines
    g.fillStyle(outline, 1);
    g.fillRect(2, railY1 - 2, W - 4, railH + 4);
    g.fillRect(2, railY2 - 2, W - 4, railH + 4);
    g.fillStyle(white, 1);
    g.fillRect(6, railY1 + 2, W - 12, railH - 4);
    g.fillRect(6, railY2 + 2, W - 12, railH - 4);

    for (let i = 0; i < slatCount; i++) {
      const cx = slatSpacing + slatW / 2 + i * (slatW + slatSpacing);
      const left = cx - slatW / 2;
      const right = cx + slatW / 2;
      // Outline path (pointed top pentagon)
      g.fillStyle(outline, 1);
      g.beginPath();
      g.moveTo(cx, 4);
      g.lineTo(right, 30);
      g.lineTo(right, H - 4);
      g.lineTo(left, H - 4);
      g.lineTo(left, 30);
      g.closePath();
      g.fillPath();
      // Inner white fill
      g.fillStyle(white, 1);
      g.beginPath();
      g.moveTo(cx, 4 + outlineW);
      g.lineTo(right - outlineW, 32);
      g.lineTo(right - outlineW, H - 4 - outlineW);
      g.lineTo(left + outlineW, H - 4 - outlineW);
      g.lineTo(left + outlineW, 32);
      g.closePath();
      g.fillPath();
      // Right-edge shadow band for a subtle 3D effect
      g.fillStyle(shadow, 1);
      g.fillRect(right - outlineW - 6, 34, 5, H - 40 - outlineW);
    }
    // Overwrite any old 'fence' texture too, so any code that still
    // references 'fence' picks up the clean picket asset.
    for (const key of ['picket_fence', 'fence']) {
      if (this.textures.exists(key)) this.textures.remove(key);
      g.generateTexture(key, W, H);
    }
    g.destroy();
  }
}
