import Phaser from 'phaser';
import { BootScene } from './game/scenes/BootScene';
import { PreloadScene } from './game/scenes/PreloadScene';
import { MenuScene } from './game/scenes/MenuScene';
import { GameScene } from './game/scenes/GameScene';
import { installTripleTiming } from './game/systems/TripleTimingPlugin';
import { installFunGameplay } from './game/systems/FunGameplayPlugin';
import { installObstacleVariety } from './game/systems/ObstacleVarietyPlugin';
import { installHardSafeBalance } from './game/systems/HardSafeBalancePlugin';
import { installBonkEyes } from './game/systems/BonkEyesPlugin';
import { installPitObstacles } from './game/systems/PitObstaclePlugin';
import { installVisualPolish } from './game/systems/VisualPolishPlugin';
import { HUDScene } from './game/scenes/HUDScene';
import { PauseScene } from './game/scenes/PauseScene';
import { GameOverScene } from './game/scenes/GameOverScene';
import { ShopScene } from './game/scenes/ShopScene';
import { CorgiSelectScene } from './game/scenes/CorgiSelectScene';
import { PrivacyScene } from './game/scenes/PrivacyScene';
import { HowToPlayScene } from './game/scenes/HowToPlayScene';
import { services } from './services';
import { sound } from './services/audio/SoundService';

// Design resolution — we target a portrait 9:16-ish canvas (like the reference image).
// Phaser scales this to fit the device using Phaser.Scale.FIT while preserving aspect.
export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 1280;

function boot() {
  // Install triple timing first so the fun-gameplay wrapper can skin and tag
  // both generated and injected obstacle groups consistently.
  installTripleTiming(GameScene);
  // Add skill rewards, streaks, daily missions, and collectible paths without
  // changing the existing jump physics or obstacle validation.
  installFunGameplay(GameScene);
  // Randomize ground-obstacle artwork from hurdle one and add fair airborne
  // bird hazards. Installed after FunGameplay so birds are not reskinned.
  installObstacleVariety(GameScene);
  // Apply the final speed increase and enforce whole-body, one-jump triple
  // safety after every other obstacle wrapper has finished spawning a group.
  installHardSafeBalance(GameScene);
  // Add a clear X-eyes crash reaction to every selectable corgi skin.
  installBonkEyes(GameScene);
  // Add holes only after all existing obstacle systems finish a group, so a
  // hole can replace a validated single but never a bird/double/triple/character.
  installPitObstacles(GameScene);
  // Run after the scene wrappers above so damaged tree art, run-sheet bleed,
  // and the continuous corgi trail are cleaned up after each scene is built.
  installVisualPolish(GameScene, MenuScene);
  // Wire the AudioContext unlock hook onto the FIRST user gesture — iOS
  // Safari and iOS WKWebView both suspend the audio context until then.
  sound.init();

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
        gravity: { x: 0, y: 2100 },
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
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseIfNeeded();
    else void sound.ensureUnlocked();
  });
  window.addEventListener('focus', () => { void sound.ensureUnlocked(); });
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
          else void sound.ensureUnlocked();
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
