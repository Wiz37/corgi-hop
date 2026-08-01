import Phaser from 'phaser';
import { CORGIS, CORGI_BONE_PRICE, gameState } from './GameState';
import { storage, STORAGE_KEYS as K } from './Storage';
import { PolishedButton } from '../ui/PolishedButton';

type SceneClass = { prototype: Record<string, any> };

interface NewCorgiDef {
  id: string;
  name: string;
  price: number;
  atlasFrame: number;
  texture: string;
  runSheetKey: string;
  runAnimKey: string;
}

interface RuntimeCorgiDef {
  id: string;
  name: string;
  texture: string;
  runSheetKey?: string;
  runAnimKey?: string;
  jumpFrame?: number;
  fallFrame?: number;
  landFrame?: number;
  premium: boolean;
  entitlementProducts: string[];
}

const FRAME = 192;
const PAGE_SIZE = 6;
const PACK_VERSION = '20260731a';

const NEW_CORGIS: NewCorgiDef[] = [
  { id: 'blue_merle_chef', name: 'Blue Merle Chef Corgi', price: 2800, atlasFrame: 0, texture: 'corgi_blue_merle_chef', runSheetKey: 'blue_merle_chef_run', runAnimKey: 'blue_merle_chef_run' },
  { id: 'black_tri_tuxedo', name: 'Black Tri Tuxedo Corgi', price: 3200, atlasFrame: 1, texture: 'corgi_black_tri_tuxedo', runSheetKey: 'black_tri_tuxedo_run', runAnimKey: 'black_tri_tuxedo_run' },
  { id: 'red_tri_ninja', name: 'Red Tri Ninja Corgi', price: 3600, atlasFrame: 2, texture: 'corgi_red_tri_ninja', runSheetKey: 'red_tri_ninja_run', runAnimKey: 'red_tri_ninja_run' },
  { id: 'sable_aviator', name: 'Sable Aviator Corgi', price: 4000, atlasFrame: 3, texture: 'corgi_sable_aviator', runSheetKey: 'sable_aviator_run', runAnimKey: 'sable_aviator_run' },
  { id: 'brindle_viking', name: 'Brindle Viking Cardigan', price: 4400, atlasFrame: 4, texture: 'corgi_brindle_viking', runSheetKey: 'brindle_viking_run', runAnimKey: 'brindle_viking_run' },
  { id: 'heeler_lifeguard', name: 'Heeler Lifeguard Corgi', price: 4800, atlasFrame: 5, texture: 'corgi_heeler_lifeguard', runSheetKey: 'heeler_lifeguard_run', runAnimKey: 'heeler_lifeguard_run' },
  { id: 'pilot_bob', name: 'Pilot Bob', price: 5200, atlasFrame: 6, texture: 'corgi_pilot_bob', runSheetKey: 'pilot_bob_run', runAnimKey: 'pilot_bob_run' },
  { id: 'princess_lulu', name: 'Princess Lulu', price: 5600, atlasFrame: 7, texture: 'corgi_princess_lulu', runSheetKey: 'princess_lulu_run', runAnimKey: 'princess_lulu_run' },
];

const POSES = [
  { sx: 1.00, sy: 0.96, angle: -1.4, dx: 0, dy: 4, shear: -0.015 },
  { sx: 1.02, sy: 0.99, angle: -0.5, dx: 1, dy: 1, shear: 0.010 },
  { sx: 1.00, sy: 1.03, angle: 0.6, dx: 2, dy: -2, shear: 0.018 },
  { sx: 0.99, sy: 1.00, angle: 1.2, dx: 0, dy: 0, shear: -0.010 },
  { sx: 1.00, sy: 0.96, angle: -1.0, dx: -1, dy: 4, shear: 0.015 },
  { sx: 1.02, sy: 0.99, angle: -0.2, dx: -1, dy: 1, shear: -0.010 },
  { sx: 1.00, sy: 1.03, angle: 0.8, dx: 0, dy: -2, shear: -0.018 },
  { sx: 0.99, sy: 1.00, angle: 1.0, dx: 0, dy: 0, shear: 0.010 },
];

let installed = false;

function buildCharacterTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists('new_corgi_portraits_atlas')) return;

  const atlas = scene.textures.get('new_corgi_portraits_atlas');
  for (const def of NEW_CORGIS) {
    const frame = atlas.get(def.atlasFrame);
    const source = frame.source.image as CanvasImageSource;

    if (!scene.textures.exists(def.texture)) {
      const portrait = document.createElement('canvas');
      portrait.width = FRAME;
      portrait.height = FRAME;
      const pctx = portrait.getContext('2d', { alpha: true });
      if (pctx) {
        pctx.clearRect(0, 0, FRAME, FRAME);
        pctx.drawImage(
          source,
          frame.cutX,
          frame.cutY,
          frame.cutWidth,
          frame.cutHeight,
          0,
          0,
          FRAME,
          FRAME,
        );
        scene.textures.addCanvas(def.texture, portrait);
      }
    }

    if (!scene.textures.exists(def.runSheetKey)) {
      const runCanvas = document.createElement('canvas');
      runCanvas.width = FRAME * POSES.length;
      runCanvas.height = FRAME;
      const rctx = runCanvas.getContext('2d', { alpha: true });
      if (rctx) {
        rctx.clearRect(0, 0, runCanvas.width, runCanvas.height);
        POSES.forEach((pose, index) => {
          const cellX = index * FRAME;
          rctx.save();
          rctx.beginPath();
          rctx.rect(cellX, 0, FRAME, FRAME);
          rctx.clip();
          rctx.translate(cellX + FRAME / 2 + pose.dx, FRAME - 4 + pose.dy);
          rctx.rotate(Phaser.Math.DegToRad(pose.angle));
          rctx.transform(pose.sx, pose.shear, 0, pose.sy, 0, 0);
          rctx.drawImage(
            source,
            frame.cutX,
            frame.cutY,
            frame.cutWidth,
            frame.cutHeight,
            -FRAME / 2,
            -FRAME + 4,
            FRAME,
            FRAME,
          );
          rctx.restore();
        });

        scene.textures.addSpriteSheet(def.runSheetKey, runCanvas, {
          frameWidth: FRAME,
          frameHeight: FRAME,
          startFrame: 0,
          endFrame: POSES.length - 1,
        });
      }
    }

    if (!scene.anims.exists(def.runAnimKey) && scene.textures.exists(def.runSheetKey)) {
      scene.anims.create({
        key: def.runAnimKey,
        frames: scene.anims.generateFrameNumbers(def.runSheetKey, { start: 0, end: POSES.length - 1 }),
        frameRate: 14,
        repeat: -1,
      });
    }
  }
}

/**
 * Installs eight approved illustrated characters while preserving the six
 * originals. Store portraits and gameplay frames are generated from one
 * bundled transparent atlas, so the selected outfit can never fall back to
 * Classic or disappear during a jump.
 */
export function installNewCorgiPack(
  PreloadSceneClass: SceneClass,
  CorgiSelectSceneClass: SceneClass,
): void {
  if (installed) return;
  installed = true;

  const runtimeCorgis = CORGIS as unknown as RuntimeCorgiDef[];
  const runtimePrices = CORGI_BONE_PRICE as unknown as Record<string, number>;
  const state = gameState as any;

  for (const def of NEW_CORGIS) {
    if (!runtimeCorgis.some((corgi) => corgi.id === def.id)) {
      runtimeCorgis.push({
        id: def.id,
        name: def.name,
        texture: def.texture,
        runSheetKey: def.runSheetKey,
        runAnimKey: def.runAnimKey,
        jumpFrame: 4,
        fallFrame: 6,
        landFrame: 0,
        premium: true,
        entitlementProducts: ['com.corgihop.all_corgis'],
      });
    }
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
      'new_corgi_portraits_atlas',
      `/assets/new_corgi_portraits.webp?v=${PACK_VERSION}`,
      { frameWidth: FRAME, frameHeight: FRAME },
    );
  };

  const originalPreloadCreate = preloadProto.create;
  preloadProto.create = function createNewCorgiAnimations(this: Phaser.Scene): void {
    buildCharacterTextures(this);
    originalPreloadCreate.call(this);
  };

  const selectProto = CorgiSelectSceneClass.prototype;
  const originalSelectCreate = selectProto.create;
  selectProto.create = function createPagedCorgiStore(
    this: Phaser.Scene & { scene: Phaser.Scenes.ScenePlugin },
    data?: { characterPage?: number },
  ): void {
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
}
