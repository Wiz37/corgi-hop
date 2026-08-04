import Phaser from 'phaser';
import { BootScene } from './game/scenes/BootScene';
import { PreloadScene } from './game/scenes/PreloadScene';
import { MenuScene } from './game/scenes/MenuScene';
import { GameScene } from './game/scenes/GameScene';
import { installTripleTiming } from './game/systems/TripleTimingPlugin';
import { installFunGameplay } from './game/systems/FunGameplayPlugin';
import { installObstacleVariety } from './game/systems/ObstacleVarietyPlugin';
import { installKidObstacles } from './game/systems/KidObstaclePlugin';
import { installHawkObstacle } from './game/systems/HawkObstaclePlugin';
import { installWholeGameVariety } from './game/systems/WholeGameVarietyPlugin';
import { installKidSizeBoost } from './game/systems/KidSizeBoostPlugin';
import { installFrequentBones } from './game/systems/FrequentBonesPlugin';
import { installVariableJump } from './game/systems/VariableJumpPlugin';
import { installHardSafeBalance } from './game/systems/HardSafeBalancePlugin';
import { installLevel70Difficulty } from './game/systems/Level70DifficultyPlugin';
import { installBonkEyes } from './game/systems/BonkEyesPlugin';
import { installVisualPolish } from './game/systems/VisualPolishPlugin';
import { installPirateCorgiFix } from './game/systems/PirateCorgiFixPlugin';
import { installPirateTextureRepair } from './game/systems/PirateTextureRepairPlugin';
import { installNewCorgiPack } from './game/systems/NewCorgiPackPlugin';
import { installUniformCorgiPricing } from './game/systems/UniformCorgiPricingPlugin';
import { installGameplayAnimation } from './game/systems/GameplayAnimationPlugin';
import { installStoreFullBodyFix } from './game/systems/StoreFullBodyFixPlugin';
import { installBobLuluUpdate } from './game/systems/BobLuluUpdatePlugin';
import { HUDScene } from './game/scenes/HUDScene';
import { PauseScene } from './game/scenes/PauseScene';
import { GameOverScene } from './game/scenes/GameOverScene';
import { ShopScene } from './game/scenes/ShopScene';
import { CorgiSelectScene } from './game/scenes/CorgiSelectScene';
import { PrivacyScene } from './game/scenes/PrivacyScene';
import { HowToPlayScene } from './game/scenes/HowToPlayScene';
import { services } from './services';
import { sound } from './services/audio/SoundService';

export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 1280;

function boot() {
  installPirateTextureRepair(PreloadScene);
  installNewCorgiPack(PreloadScene, CorgiSelectScene, GameScene);
  // Classic stays free; every other corgi costs exactly 1,000 Bones.
  installUniformCorgiPricing();
  installTripleTiming(GameScene);
  installFunGameplay(GameScene);
  installObstacleVariety(GameScene);
  installVariableJump(GameScene, HUDScene);
  installHardSafeBalance(GameScene);
  // Owns the final score-based speed progression and later-game difficulty.
  installLevel70Difficulty(GameScene);
  // Applies the supplied kid artwork and fair, object-height hitboxes.
  installKidObstacles(PreloadScene, GameScene);
  // Replaces the legacy bird art with the supplied hawk and screech warning.
  installHawkObstacle(PreloadScene, GameScene);
  // Final obstacle wrapper: keeps hawks, kids, doubles, and triples randomized
  // from the first obstacle through the entire run.
  installWholeGameVariety(GameScene);
  installBonkEyes(GameScene);
  installVisualPolish(GameScene, MenuScene);
  installPirateCorgiFix(GameScene, CorgiSelectScene);
  installGameplayAnimation(PreloadScene, GameScene);
  // The six page-two corgis use their padded full-body portraits in both the
  // store and gameplay so their legs and paws can never be clipped.
  installStoreFullBodyFix(CorgiSelectScene, GameScene);
  // Installed last and intentionally limited to only Pilot Bob and Princess Lulu.
  installBobLuluUpdate(PreloadScene, CorgiSelectScene, GameScene);
  // Final spawn pass: makes boy and girl obstacles 50% larger everywhere.
  installKidSizeBoost(GameScene);
  // Fills empty obstacle groups so Bones appear in roughly 70% of groups.
  installFrequentBones(GameScene);
  sound.init();

  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#3fa7ff',
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    pixelArt: false,
    antialias: true,
    roundPixels: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: GAME_WIDTH, height: GAME_HEIGHT },
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 2100 }, debug: false } },
    input: { activePointers: 3 },
    fps: { target: 60 },
    dom: { createContainer: false },
    scene: [BootScene, PreloadScene, MenuScene, GameScene, HUDScene, PauseScene, GameOverScene, ShopScene, CorgiSelectScene, PrivacyScene, HowToPlayScene],
  };

  services.init();
  const game = new Phaser.Game(config);
  (window as any).__CORGI_HOP__ = game;

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

  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseIfNeeded(); else void sound.ensureUnlocked(); });
  window.addEventListener('focus', () => { void sound.ensureUnlocked(); });
  window.addEventListener('blur', pauseIfNeeded);
  window.addEventListener('pagehide', pauseIfNeeded);

  const w = window as any;
  const isNative = !!(w.Capacitor && w.Capacitor.isNativePlatform && w.Capacitor.isNativePlatform());
  if (isNative) {
    const modPath = '@capacitor/app';
    import(/* @vite-ignore */ modPath).then(({ App }: any) => {
      App.addListener('appStateChange', (state: { isActive: boolean }) => { if (!state.isActive) pauseIfNeeded(); else void sound.ensureUnlocked(); });
    }).catch(() => { /* optional in browser preview */ });
  }

  const hideBoot = () => { const el = document.getElementById('boot'); if (el) el.style.display = 'none'; };
  game.events.once(Phaser.Core.Events.READY, hideBoot);
  setTimeout(hideBoot, 3000);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
