// Shared parallax background system used by MenuScene, GameScene, GameOverScene.
// Renders sky, clouds, mountains, hills, grass, path and foreground foliage
// as separate layered TileSprites so each can scroll at its own speed.

import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@/main';

export interface ParallaxLayers {
  sky: Phaser.GameObjects.Image;
  clouds: Phaser.GameObjects.TileSprite;
  mountains: Phaser.GameObjects.TileSprite;
  hills: Phaser.GameObjects.TileSprite;
  grass: Phaser.GameObjects.TileSprite;
  path: Phaser.GameObjects.TileSprite;
  foreground: Phaser.GameObjects.TileSprite;
  groundTop: number; // Y coordinate where the corgi's feet should rest
}

// Layout constants — tuned to match design-reference.png in portrait 720x1280.
export const GROUND_Y = 900; // top of dirt path where corgi feet sit
const HILLS_Y = 730;
const MOUNTAINS_Y = 630;
const CLOUDS_Y = 260;
const GRASS_Y = 970;
const FG_Y = 1130;

export function buildParallax(scene: Phaser.Scene): ParallaxLayers {
  const sky = scene.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'bg_sky');
  sky.setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
  sky.setDepth(0);

  const clouds = scene.add.tileSprite(GAME_WIDTH / 2, CLOUDS_Y, GAME_WIDTH, 260, 'bg_clouds');
  clouds.setDepth(1);
  clouds.setAlpha(0.95);

  const mountains = scene.add.tileSprite(GAME_WIDTH / 2, MOUNTAINS_Y, GAME_WIDTH, 240, 'bg_mountains');
  mountains.setDepth(2);

  const hills = scene.add.tileSprite(GAME_WIDTH / 2, HILLS_Y, GAME_WIDTH, 260, 'bg_hills');
  hills.setDepth(3);

  const grass = scene.add.tileSprite(GAME_WIDTH / 2, GRASS_Y, GAME_WIDTH, 220, 'bg_grass');
  grass.setDepth(4);

  const path = scene.add.tileSprite(GAME_WIDTH / 2, GROUND_Y + 30, GAME_WIDTH, 140, 'bg_path');
  path.setDepth(5);

  const foreground = scene.add.tileSprite(GAME_WIDTH / 2, FG_Y, GAME_WIDTH, 260, 'bg_foreground');
  foreground.setDepth(20); // above corgi so foliage feels close to camera

  return { sky, clouds, mountains, hills, grass, path, foreground, groundTop: GROUND_Y };
}

// Scroll speeds (pixels per second) at base game speed = 1.
export const PARALLAX_SPEEDS = {
  clouds: 12,
  mountains: 24,
  hills: 60,
  grass: 220,
  path: 420,        // matches gameSpeed
  foreground: 520,  // fastest — closest to camera
};
