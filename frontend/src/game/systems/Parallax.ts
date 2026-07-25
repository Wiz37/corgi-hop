// Shared parallax background system with FULL illustrated countryside scene:
//   - blue sky gradient
//   - two cloud layers (near + far)
//   - distant mountain silhouettes
//   - rolling hills with white fence
//   - middle grass strip
//   - dirt running path with subtle shadow
//   - foreground foliage strip
// Plus scattered decorations (bushes, flowers, rocks) placed by ForegroundDecor.

import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@/main';

export interface ParallaxLayers {
  sky: Phaser.GameObjects.Rectangle;      // solid sky rectangle (top gradient handled by two rects)
  skyTop: Phaser.GameObjects.Rectangle;
  clouds: Phaser.GameObjects.TileSprite;
  cloudsFar: Phaser.GameObjects.TileSprite;
  mountains: Phaser.GameObjects.TileSprite;
  hills: Phaser.GameObjects.TileSprite;
  grass: Phaser.GameObjects.TileSprite;
  path: Phaser.GameObjects.TileSprite;
  pathShadow: Phaser.GameObjects.Rectangle;
  foreground: Phaser.GameObjects.TileSprite;
  groundTop: number;
}

// Layout constants — tuned to match design-reference.png in portrait 720×1280.
export const GROUND_Y = 920;
const HILLS_Y = 760;
const MOUNTAINS_Y = 670;
const CLOUDS_Y = 260;
const CLOUDS_FAR_Y = 170;
const GRASS_Y = 1000;
const PATH_Y = 970;
const FG_Y = 1170;

export function buildParallax(scene: Phaser.Scene): ParallaxLayers {
  // Sky gradient built from two stacked rectangles (fast + clean).
  const skyTop = scene.add.rectangle(GAME_WIDTH / 2, 200, GAME_WIDTH, 400, 0x3fa7ff).setDepth(0);
  const sky = scene.add.rectangle(GAME_WIDTH / 2, 700, GAME_WIDTH, 1000, 0xa8dcff).setDepth(0);
  // Soft gradient overlay (dark to light)
  const gradient = scene.add.graphics().setDepth(0);
  gradient.fillGradientStyle(0x3fa7ff, 0x3fa7ff, 0xd8efff, 0xd8efff, 1, 1, 1, 1);
  gradient.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT * 0.62);

  const cloudsFar = scene.add.tileSprite(GAME_WIDTH / 2, CLOUDS_FAR_Y, GAME_WIDTH, 220, 'bg_clouds');
  cloudsFar.setDepth(1);
  cloudsFar.setAlpha(0.55);
  cloudsFar.setTileScale(0.6, 0.6);
  cloudsFar.tilePositionX = 200;

  const clouds = scene.add.tileSprite(GAME_WIDTH / 2, CLOUDS_Y, GAME_WIDTH, 300, 'bg_clouds');
  clouds.setDepth(2);
  clouds.setAlpha(0.95);

  const mountains = scene.add.tileSprite(GAME_WIDTH / 2, MOUNTAINS_Y, GAME_WIDTH, 260, 'bg_mountains');
  mountains.setDepth(3);
  mountains.tilePositionY = 180; // skip transparent top of source image
  mountains.setTileScale(0.7, 0.7);

  const hills = scene.add.tileSprite(GAME_WIDTH / 2, HILLS_Y, GAME_WIDTH, 280, 'bg_hills');
  hills.setDepth(4);
  hills.tilePositionY = 60;
  hills.setTileScale(0.75, 0.75);

  const grass = scene.add.tileSprite(GAME_WIDTH / 2, GRASS_Y, GAME_WIDTH, 220, 'bg_grass');
  grass.setDepth(5);
  grass.tilePositionY = 130; // reveal the green ledge strip
  grass.setTileScale(0.8, 0.8);

  // Soft shadow strip below where the dirt path will sit — adds depth.
  const pathShadow = scene.add.rectangle(GAME_WIDTH / 2, GROUND_Y + 12, GAME_WIDTH, 30, 0x1e2b4a, 0.18).setDepth(5);

  const path = scene.add.tileSprite(GAME_WIDTH / 2, PATH_Y, GAME_WIDTH, 160, 'bg_path');
  path.setDepth(6);
  // The bg_path.png artwork has a transparent top edge; shift the tile view
  // down so the actual dirt band is visible where the corgi runs.
  path.tilePositionY = 220;
  path.tileScaleX = 0.75;
  path.tileScaleY = 0.75;

  const foreground = scene.add.tileSprite(GAME_WIDTH / 2, FG_Y, GAME_WIDTH, 280, 'bg_foreground');
  foreground.setDepth(20);
  foreground.tilePositionY = 260;
  foreground.setTileScale(0.65, 0.65);

  return {
    sky, skyTop,
    clouds, cloudsFar,
    mountains, hills, grass, path, pathShadow, foreground,
    groundTop: GROUND_Y,
  };
}

// Scroll speeds (pixels per second) at base game speed = 1.
export const PARALLAX_SPEEDS = {
  cloudsFar: 6,
  clouds: 12,
  mountains: 24,
  hills: 60,
  grass: 220,
  path: 420,
  foreground: 520,
};

/** Scatter static decorations (trees, bushes, flowers, rocks) on a menu / game-over
 * screen. Returns the created images so callers can also parallax them if desired. */
export function scatterMenuDecor(scene: Phaser.Scene, groundY: number): Phaser.GameObjects.Image[] {
  const out: Phaser.GameObjects.Image[] = [];
  const spec: Array<{ key: string; x: number; y: number; scale: number; depth: number; flip?: boolean }> = [
    { key: 'tree_left', x: 80, y: groundY - 10, scale: 0.6, depth: 8 },
    { key: 'tree_right', x: GAME_WIDTH - 80, y: groundY - 10, scale: 0.55, depth: 8, flip: true },
    { key: 'bush', x: 120, y: groundY + 80, scale: 0.35, depth: 22 },
    { key: 'bush', x: GAME_WIDTH - 120, y: groundY + 80, scale: 0.3, depth: 22 },
    { key: 'rock', x: 220, y: groundY + 60, scale: 0.3, depth: 21 },
    { key: 'rock', x: GAME_WIDTH - 220, y: groundY + 70, scale: 0.28, depth: 21, flip: true },
    { key: 'flower_yellow', x: 60, y: groundY + 40, scale: 0.35, depth: 22 },
    { key: 'flower_yellow', x: GAME_WIDTH - 40, y: groundY + 50, scale: 0.32, depth: 22 },
  ];
  for (const s of spec) {
    if (!scene.textures.exists(s.key)) continue;
    const img = scene.add.image(s.x, s.y, s.key).setOrigin(0.5, 1).setDepth(s.depth).setScale(s.scale);
    if (s.flip) img.setFlipX(true);
    out.push(img);
  }
  return out;
}
