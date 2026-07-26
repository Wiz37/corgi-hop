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

  // ---- Auto-pause on ANY interruption (bug 8) ----
  // Pauses gameplay whenever the app loses focus, is backgrounded, becomes
  // inactive, or is interrupted by a phone call. NEVER auto-resumes — the
  // PauseScene stays up and the player must tap RESUME manually.
  const pauseIfNeeded = (): void => {
    if (!game.scene.getScene('GameScene')) return;
    const isGameActive = game.scene.isActive('GameScene');
    const isPauseUp = game.scene.isActive('PauseScene');
    const isOver = game.scene.isActive('GameOverScene');
    if (isGameActive && !isPauseUp && !isOver) {
      game.scene.pause('GameScene');
      game.scene.pause('HUDScene');
      game.scene.run('PauseScene');
    }
  };
  // Browser visibility / focus signals
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseIfNeeded(); });
  window.addEventListener('blur', pauseIfNeeded);
  window.addEventListener('pagehide', pauseIfNeeded);
  // Capacitor App plugin (native builds) — pause when isActive becomes false.
  // Loaded dynamically so browser preview does not require the plugin.
  const w = window as any;
  const isNative = !!(w.Capacitor && w.Capacitor.isNativePlatform && w.Capacitor.isNativePlatform());
  if (isNative) {
    const modPath = '@capacitor/app';
    import(/* @vite-ignore */ modPath)
      .then(({ App }: any) => {
        App.addListener('appStateChange', (state: { isActive: boolean }) => {
          if (!state.isActive) pauseIfNeeded();
          // isActive=true → deliberately do NOT resume. PauseScene remains
          // visible until the player manually presses Resume.
        });
      })
      .catch(() => { /* @capacitor/app is optional in the browser preview */ });
  }

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
