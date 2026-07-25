import Phaser from 'phaser';
import { BootScene } from './game/scenes/BootScene';
import { PreloadScene } from './game/scenes/PreloadScene';
import { MenuScene } from './game/scenes/MenuScene';
import { GameScene } from './game/scenes/GameScene';
import { HUDScene } from './game/scenes/HUDScene';
import { PauseScene } from './game/scenes/PauseScene';
import { GameOverScene } from './game/scenes/GameOverScene';
import { ShopScene } from './game/scenes/ShopScene';
import { CorgiSelectScene } from './game/scenes/CorgiSelectScene';
import { PrivacyScene } from './game/scenes/PrivacyScene';
import { HowToPlayScene } from './game/scenes/HowToPlayScene';
import { services } from './services';

// Design resolution — we target a portrait 9:16-ish canvas (like the reference image).
// Phaser scales this to fit the device using Phaser.Scale.FIT while preserving aspect.
export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 1280;

function boot() {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO, // WebGL preferred, Canvas fallback
    parent: 'game',
    backgroundColor: '#3fa7ff',
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    pixelArt: false,
    antialias: true,
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 2400 },
        debug: false,
      },
    },
    input: {
      activePointers: 3,
    },
    fps: {
      target: 60,
    },
    dom: { createContainer: false },
    scene: [
      BootScene,
      PreloadScene,
      MenuScene,
      GameScene,
      HUDScene,
      PauseScene,
      GameOverScene,
      ShopScene,
      CorgiSelectScene,
      PrivacyScene,
      HowToPlayScene,
    ],
  };

  // Initialise service layer *before* the game reads any state.
  services.init();

  const game = new Phaser.Game(config);
  (window as any).__CORGI_HOP__ = game;

  // Auto-pause when tab/app is backgrounded (satisfies "automatic pause when backgrounded").
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      const gs = game.scene.getScene('GameScene') as GameScene | null;
      if (gs && game.scene.isActive('GameScene') && !game.scene.isActive('PauseScene')) {
        game.scene.pause('GameScene');
        game.scene.pause('HUDScene');
        game.scene.run('PauseScene');
      }
    }
  });

  // Hide the HTML boot splash once the first scene starts rendering.
  const hideBoot = () => {
    const el = document.getElementById('boot');
    if (el) el.style.display = 'none';
  };
  game.events.once(Phaser.Core.Events.READY, hideBoot);
  setTimeout(hideBoot, 3000); // safety fallback
}

// Wait for DOM ready, then boot. Also unlock audio on first user gesture.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
