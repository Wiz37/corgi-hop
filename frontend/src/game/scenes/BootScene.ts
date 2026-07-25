import Phaser from 'phaser';

/**
 * BootScene — earliest lightweight scene that only preloads the assets required
 * to render the polished loading bar in PreloadScene.
 */
export class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  preload(): void {
    // Just the sky so the loading screen matches the game's palette.
    this.load.image('bg_sky', '/assets/bg_sky.png');
  }

  create(): void {
    this.scene.start('PreloadScene');
  }
}
