import Phaser from 'phaser';
import { CORGIS, CORGI_BONE_PRICE, gameState } from './GameState';
import { storage, STORAGE_KEYS as K } from './Storage';
import { PolishedButton } from '../ui/PolishedButton';
import {
  NEW_CORGI_ART_DATA_URI,
  NEW_CORGI_ART_FRAME_COUNT,
  NEW_CORGI_ART_FRAME_SIZE,
} from '../assets/NewCorgiArt';
import {
  PREMIUM_STORE_PORTRAITS_DATA_URI,
  PREMIUM_STORE_PORTRAIT_FRAME_COUNT,
  PREMIUM_STORE_PORTRAIT_FRAME_SIZE,
} from '../assets/PremiumStorePortraitsFull';

type SceneClass = { prototype: Record<string, any> };
type Pose = 'run' | 'jump' | 'fall' | 'land' | 'hit';

interface NewCorgiDef {
  id: string;
  name: string;
  price: number;
  frame: number;
  runRow: number;
  runAnimKey: string;
}

interface RuntimeCorgiDef {
  id: string;
  name: string;
  texture: string;
  textureFrame?: number;
  runFrame?: number;
  runSheetKey?: string;
  runAnimKey?: string;
  jumpFrame?: number;
  fallFrame?: number;
  landFrame?: number;
  premium: boolean;
  entitlementProducts: string[];
}

const PAGE_SIZE = 6;
const CHARACTER_SHEET = 'approved_premium_corgis_20260801';
const STORE_PORTRAIT_SHEET = 'premium_store_portraits_page2_20260801';

// Native-safe gameplay fallback for the eight newer corgis. This file already
// ships in public/assets and was built as 8 rows x 8 frames at 128x128. The
// newer full-body atlas can still replace it later in GameplayAnimationPlugin,
// but a failed embedded-atlas decode must never leave TestFlight on a one-frame
// portrait pretending to be a run animation.
const FALLBACK_RUN_SHEET = 'new_corgi_runs_v2';
const FALLBACK_RUN_FRAME_SIZE = 128;
const FALLBACK_RUN_FRAMES_PER_CORGI = 8;
const FALLBACK_RUN_FRAME_COUNT = 64;
const FALLBACK_RUN_VERSION = '20260915a';

const DEDICATED_STORE_TEXTURES: Record<string, string> = {
  blue_merle_chef: 'blue_merle_chef_store',
  black_tri_tuxedo: 'black_tri_tuxedo_store',
  red_tri_ninja: 'red_tri_ninja_store',
  brindle_viking: 'brindle_viking_store',
  heeler_lifeguard: 'heeler_lifeguard_store',
  pilot_bob: 'pilot_bob_store',
  princess_lulu: 'princess_lulu_store',
};

const NEW_CORGIS: NewCorgiDef[] = [
  { id: 'blue_merle_chef', name: 'Blue Merle Chef Corgi', price: 2800, frame: 0, runRow: 0, runAnimKey: 'blue_merle_chef_run' },
  { id: 'black_tri_tuxedo', name: 'Black Tri Tuxedo Corgi', price: 3200, frame: 1, runRow: 1, runAnimKey: 'black_tri_tuxedo_run' },
  { id: 'red_tri_ninja', name: 'Red Tri Ninja Corgi', price: 3600, frame: 2, runRow: 2, runAnimKey: 'red_tri_ninja_run' },
  { id: 'sable_aviator', name: 'Sable Aviator Corgi', price: 4000, frame: 3, runRow: 3, runAnimKey: 'sable_aviator_run' },
  { id: 'brindle_viking', name: 'Brindle Viking Cardigan', price: 4400, frame: 4, runRow: 4, runAnimKey: 'brindle_viking_run' },
  { id: 'heeler_lifeguard', name: 'Heeler Lifeguard Corgi', price: 4800, frame: 5, runRow: 5, runAnimKey: 'heeler_lifeguard_run' },
  { id: 'pilot_bob', name: 'Pilot Bob', price: 5200, frame: 6, runRow: 6, runAnimKey: 'pilot_bob_run' },
  { id: 'princess_lulu', name: 'Princess Lulu', price: 5600, frame: 7, runRow: 7, runAnimKey: 'princess_lulu_run' },
];

const NEW_CORGI_IDS = new Set(NEW_CORGIS.map((def) => def.id));
let installed = false;

function fallbackRunStart(def: NewCorgiDef): number {
  return def.runRow * FALLBACK_RUN_FRAMES_PER_CORGI;
}

function requirePremiumTexture(scene: Phaser.Scene): void {
  if (!scene.textures.exists(CHARACTER_SHEET)) {
    throw new Error('[Corgi Hop] Approved premium corgi artwork failed to load. Refusing to substitute the Classic Corgi.');
  }
}

function hasFallbackRunTexture(scene: Phaser.Scene): boolean {
  return scene.textures.exists(FALLBACK_RUN_SHEET);
}

function hasStorePortraitTexture(scene: Phaser.Scene): boolean {
  return scene.textures.exists(STORE_PORTRAIT_SHEET);
}

function applyFullBodyStorePortraits(runtimeCorgis: RuntimeCorgiDef[]): void {
  for (let frame = 0; frame < PAGE_SIZE; frame++) {
    const storeDef = NEW_CORGIS[frame];
    const runtimeDef = runtimeCorgis.find((corgi) => corgi.id === storeDef.id);
    if (!runtimeDef) continue;
    runtimeDef.texture = STORE_PORTRAIT_SHEET;
    runtimeDef.textureFrame = frame;
  }

  // Use the exact user-supplied static portraits where available. Sable
  // Aviator intentionally remains on the existing approved portrait.
  for (const [id, texture] of Object.entries(DEDICATED_STORE_TEXTURES)) {
    const runtimeDef = runtimeCorgis.find((corgi) => corgi.id === id);
    if (!runtimeDef) continue;
    runtimeDef.texture = texture;
    runtimeDef.textureFrame = 0;
  }
}

function registerAnimations(scene: Phaser.Scene): void {
  requirePremiumTexture(scene);

  if (!hasFallbackRunTexture(scene)) {
    console.error('[Corgi Hop] Native-safe new-corgi run sheet failed to load.');
    return;
  }

  for (const def of NEW_CORGIS) {
    // Never preserve the old one-frame pseudo-animation. On a fresh boot this
    // key normally does not exist, but removing it makes scene restarts safe.
    if (scene.anims.exists(def.runAnimKey)) scene.anims.remove(def.runAnimKey);

    const start = fallbackRunStart(def);
    scene.anims.create({
      key: def.runAnimKey,
      frames: scene.anims.generateFrameNumbers(FALLBACK_RUN_SHEET, {
        start,
        end: start + FALLBACK_RUN_FRAMES_PER_CORGI - 1,
      }),
      frameRate: 14,
      repeat: -1,
    });
  }
}

function selectedPremium(runtimeCorgis: RuntimeCorgiDef[]): RuntimeCorgiDef | undefined {
  const selectedId = String((gameState as any).selectedCorgi ?? 'classic');
  if (!NEW_CORGI_IDS.has(selectedId)) return undefined;
  return runtimeCorgis.find((corgi) => corgi.id === selectedId);
}

function selectedPackDefinition(): NewCorgiDef | undefined {
  const selectedId = String((gameState as any).selectedCorgi ?? 'classic');
  return NEW_CORGIS.find((candidate) => candidate.id === selectedId);
}

function applyFallbackGameplayVisual(
  scene: Phaser.Scene & Record<string, any>,
  corgi: Phaser.Physics.Arcade.Sprite,
  frame: number,
): void {
  if (corgi.texture?.key !== FALLBACK_RUN_SHEET || String(corgi.frame?.name) !== String(frame)) {
    corgi.setTexture(FALLBACK_RUN_SHEET, frame);
    if (typeof scene.sizeCorgiUniform === 'function') scene.sizeCorgiUniform();
  }
  corgi.setOrigin(0.5, 1);
  corgi.setVisible(true);
  corgi.setAlpha(1);
  corgi.setFlipX(false);
  corgi.setAngle(0);
  corgi.clearTint();
  corgi.setBlendMode(Phaser.BlendModes.NORMAL);
}

/**
 * Installs the eight approved illustrated corgis.
 *
 * Store cards remain static stock portraits. Gameplay first uses a real,
 * bundled eight-frame run sheet that is safe in the native WebView. The newer
 * full-body gameplay system is installed later and is free to replace this
 * fallback when its higher-quality atlas successfully decodes.
 */
export function installNewCorgiPack(
  PreloadSceneClass: SceneClass,
  CorgiSelectSceneClass: SceneClass,
  GameSceneClass: SceneClass,
): void {
  if (installed) return;
  installed = true;

  const runtimeCorgis = CORGIS as unknown as RuntimeCorgiDef[];
  const runtimePrices = CORGI_BONE_PRICE as unknown as Record<string, number>;
  const state = gameState as any;

  for (const def of NEW_CORGIS) {
    const start = fallbackRunStart(def);
    const runtimeDef: RuntimeCorgiDef = {
      id: def.id,
      name: def.name,
      texture: CHARACTER_SHEET,
      textureFrame: def.frame,
      runFrame: start,
      runSheetKey: FALLBACK_RUN_SHEET,
      runAnimKey: def.runAnimKey,
      jumpFrame: start + 3,
      fallFrame: start + 5,
      landFrame: start + 7,
      premium: true,
      entitlementProducts: ['com.corgihop.all_corgis'],
    };

    const existing = runtimeCorgis.find((corgi) => corgi.id === def.id);
    if (existing) Object.assign(existing, runtimeDef);
    else runtimeCorgis.push(runtimeDef);

    runtimePrices[def.id] = def.price;
    if (!(def.id in state.boneUnlocks)) state.boneUnlocks[def.id] = false;
  }

  const originalLoad = state.load.bind(state);
  state.load = (): void => {
    const selectedBeforeLoad = storage.getString(K.selectedCorgi, 'classic');
    const unlocksBeforeLoad = storage.getJSON<Record<string, boolean>>(K.boneUnlocks, {});
    originalLoad();

    for (const def of NEW_CORGIS) {
      state.boneUnlocks[def.id] = !!unlocksBeforeLoad[def.id];
    }
    if (runtimeCorgis.some((corgi) => corgi.id === selectedBeforeLoad)) {
      state.selectedCorgi = selectedBeforeLoad;
    }
    state.saveBoneUnlocks();
    state.saveSelected();
  };

  const preloadProto = PreloadSceneClass.prototype;
  const originalPreload = preloadProto.preload;
  preloadProto.preload = function preloadNewCorgis(this: Phaser.Scene): void {
    originalPreload.call(this);
    this.load.spritesheet(
      CHARACTER_SHEET,
      NEW_CORGI_ART_DATA_URI,
      {
        frameWidth: NEW_CORGI_ART_FRAME_SIZE,
        frameHeight: NEW_CORGI_ART_FRAME_SIZE,
        startFrame: 0,
        endFrame: NEW_CORGI_ART_FRAME_COUNT - 1,
      },
    );
    this.load.spritesheet(
      FALLBACK_RUN_SHEET,
      `/assets/new_corgi_runs_v2.webp?v=${FALLBACK_RUN_VERSION}`,
      {
        frameWidth: FALLBACK_RUN_FRAME_SIZE,
        frameHeight: FALLBACK_RUN_FRAME_SIZE,
        startFrame: 0,
        endFrame: FALLBACK_RUN_FRAME_COUNT - 1,
      },
    );
    this.load.spritesheet(
      STORE_PORTRAIT_SHEET,
      PREMIUM_STORE_PORTRAITS_DATA_URI,
      {
        frameWidth: PREMIUM_STORE_PORTRAIT_FRAME_SIZE,
        frameHeight: PREMIUM_STORE_PORTRAIT_FRAME_SIZE,
        startFrame: 0,
        endFrame: PREMIUM_STORE_PORTRAIT_FRAME_COUNT - 1,
      },
    );
  };

  const originalPreloadCreate = preloadProto.create;
  preloadProto.create = function createNewCorgiAnimations(this: Phaser.Scene): void {
    registerAnimations(this);
    // Store portraits are optional at boot. A failed portrait decode must never
    // prevent the loader from leaving 100% and entering the menu.
    originalPreloadCreate.call(this);
  };

  const selectProto = CorgiSelectSceneClass.prototype;
  const originalSelectCreate = selectProto.create;
  selectProto.create = function createPagedCorgiStore(
    this: Phaser.Scene & { scene: Phaser.Scenes.ScenePlugin },
    data?: { characterPage?: number },
  ): void {
    requirePremiumTexture(this);
    if (hasStorePortraitTexture(this)) {
      applyFullBodyStorePortraits(runtimeCorgis);
    }

    const allCorgis = runtimeCorgis.slice();
    const pageCount = Math.max(1, Math.ceil(allCorgis.length / PAGE_SIZE));
    const requestedPage = Number(data?.characterPage ?? 0);
    const page = Phaser.Math.Clamp(
      Number.isFinite(requestedPage) ? requestedPage : 0,
      0,
      pageCount - 1,
    );
    const pageCorgis = allCorgis.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

    runtimeCorgis.splice(0, runtimeCorgis.length, ...pageCorgis);
    try {
      originalSelectCreate.call(this);
    } finally {
      runtimeCorgis.splice(0, runtimeCorgis.length, ...allCorgis);
    }

    if (pageCount <= 1) return;

    this.add.text(360, 1141, `CORGIS ${page + 1}/${pageCount}`, {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '24px',
      fontStyle: '900',
      color: '#ffffff',
      stroke: '#24304a',
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(45);

    if (page > 0) {
      new PolishedButton(this, {
        x: 145,
        y: 1140,
        w: 90,
        h: 68,
        label: '<',
        color: 0x2a3d67,
        shadowColor: 0x18223a,
        depth: 45,
        testId: 'corgi-page-prev',
        onTap: () => this.scene.restart({ characterPage: page - 1 }),
      });
    }

    if (page < pageCount - 1) {
      new PolishedButton(this, {
        x: 575,
        y: 1140,
        w: 90,
        h: 68,
        label: '>',
        color: 0x2a3d67,
        shadowColor: 0x18223a,
        depth: 45,
        testId: 'corgi-page-next',
        onTap: () => this.scene.restart({ characterPage: page + 1 }),
      });
    }
  };

  const gameProto = GameSceneClass.prototype;
  const originalGameCreate = gameProto.create;
  gameProto.create = function createWithApprovedCorgiArt(
    this: Phaser.Scene & Record<string, any>,
    ...args: any[]
  ): any {
    const result = originalGameCreate.apply(this, args);
    const selected = selectedPremium(runtimeCorgis);
    const packDef = selectedPackDefinition();
    if (!selected || !packDef) return result;

    const corgi = this.corgi as Phaser.Physics.Arcade.Sprite | undefined;
    if (!corgi) throw new Error('[Corgi Hop] Gameplay corgi sprite was not created.');

    if (hasFallbackRunTexture(this)
      && selected.runAnimKey
      && this.anims.exists(selected.runAnimKey)) {
      const start = selected.runFrame ?? fallbackRunStart(packDef);
      this.runTexKey = FALLBACK_RUN_SHEET;
      this.runAnimKey = selected.runAnimKey;
      applyFallbackGameplayVisual(this, corgi, start);
      corgi.play(selected.runAnimKey, true);
      return result;
    }

    // Last-resort visual fallback: keep the selected outfit visible rather
    // than substituting Classic. This path should only run on a true asset
    // load failure and deliberately does not masquerade as an animation.
    requirePremiumTexture(this);
    corgi.anims.stop();
    corgi.setTexture(CHARACTER_SHEET, packDef.frame);
    if (typeof this.sizeCorgiUniform === 'function') this.sizeCorgiUniform();
    corgi.setFlipX(false);
    corgi.setAngle(0);
    corgi.clearTint();
    return result;
  };

  const originalSetPose = gameProto.setPose;
  if (typeof originalSetPose === 'function') {
    gameProto.setPose = function setApprovedPremiumPose(
      this: Phaser.Scene & Record<string, any>,
      logicalPose: Pose,
    ): void {
      const selected = selectedPremium(runtimeCorgis);
      const packDef = selectedPackDefinition();
      if (!selected || !packDef) {
        originalSetPose.call(this, logicalPose);
        return;
      }

      // Keep the dedicated funny crash treatment owned by the base gameplay
      // scene / later visual-polish wrappers.
      if (logicalPose === 'hit') {
        originalSetPose.call(this, logicalPose);
        return;
      }

      const corgi = this.corgi as Phaser.Physics.Arcade.Sprite | undefined;
      if (!corgi) return;

      if (hasFallbackRunTexture(this)) {
        const start = selected.runFrame ?? fallbackRunStart(packDef);
        const frame = logicalPose === 'run'
          ? start
          : logicalPose === 'jump'
            ? (selected.jumpFrame ?? start + 3)
            : logicalPose === 'fall'
              ? (selected.fallFrame ?? start + 5)
              : (selected.landFrame ?? start + 7);

        this.runTexKey = FALLBACK_RUN_SHEET;
        if (selected.runAnimKey) this.runAnimKey = selected.runAnimKey;
        applyFallbackGameplayVisual(this, corgi, frame);

        if (logicalPose === 'run'
          && selected.runAnimKey
          && this.anims.exists(selected.runAnimKey)) {
          const wrongAnimation = corgi.anims.currentAnim?.key !== selected.runAnimKey;
          if (!corgi.anims.isPlaying || wrongAnimation) corgi.play(selected.runAnimKey, true);
        }
        return;
      }

      requirePremiumTexture(this);
      corgi.anims.stop();
      if (corgi.texture.key !== CHARACTER_SHEET || Number(corgi.frame?.name) !== packDef.frame) {
        corgi.setTexture(CHARACTER_SHEET, packDef.frame);
        if (typeof this.sizeCorgiUniform === 'function') this.sizeCorgiUniform();
      }
      corgi.setFlipX(false);
      corgi.setAngle(0);
      corgi.clearTint();
    };
  }
}
