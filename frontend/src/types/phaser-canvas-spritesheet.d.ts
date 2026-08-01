import 'phaser';

declare module 'phaser' {
  namespace Textures {
    interface TextureManager {
      addSpriteSheet(
        key: string,
        source: HTMLCanvasElement,
        config: Phaser.Types.Textures.SpriteSheetConfig,
      ): Phaser.Textures.Texture | null;
    }
  }
}
