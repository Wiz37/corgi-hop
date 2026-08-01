import Phaser from 'phaser';
import { CORGIS, gameState } from './GameState';
import {
  CORGI_GAMEPLAY_ATLAS_DATA_URI,
  CORGI_GAMEPLAY_FRAME_COUNT,
  CORGI_GAMEPLAY_FRAME_SIZE,
} from '../assets/CorgiGameplayAtlas';

type SceneClass = { prototype: Record<string, any> };
type Pose = 'run' | 'jump' | 'fall' | 'land' | 'hit';

interface RuntimeCorgiDef {
  id: string;
  texture: string;
  textureFrame?: number;
  runFrame?: number;
  runSheetKey?: string;
  runAnimKey?: string;
  jumpFrame?: number;
  fallFrame?: number;
  landFrame?: number;
}

interface SmoothRow {
  id: string;
  sourceRow: number;
  smoothRow: number;
  runAnimKey: string;
}

const SOURCE_ATLAS_KEY = 'corgi_gameplay_atlas_20260801';
const SMOOTH_ATLAS_KEY = 'corgi_smooth_8_run_20260801';
const SOURCE_FRAMES_PER_CORGI = 7;
const RUN_FRAME_COUNT = 8;
const SOURCE_RUN_FRAME_COUNT = 4;
const FIRST_NEW_CORGI_ROW = 6;

// The first six characters already ship with dedicated, high-resolution
// eight-frame sheets. These eight newer characters are expanded at preload
// time from four key poses into an eight-frame cycle with four blended
// in-betweens. This avoids a large, fragile embedded replacement asset.
const SMOOTH_ROWS: SmoothRow[] = [
  { id: 'blue_merle_chef', sourceRow: 6, smoothRow: 0, runAnimKey: 'blue_merle_chef_run' },
  { id: 'black_tri_tuxedo', sourceRow: 7, smoothRow: 1, runAnimKey: 'black_tri_tuxedo_run' },
  { id: 'red_tri_ninja', sourceRow: 8, smoothRow: 2, runAnimKey: 'red_tri_ninja_run' },
  { id: 'sable_aviator', sourceRow: 9, smoothRow: 3, runAnimKey: 'sable_aviator_run' },
  { id: 'brindle_viking', sourceRow: 10, smoothRow: 4, runAnimKey: 'brindle_viking_run' },
  { id: 'heeler_lifeguard', sourceRow: 11, smoothRow: 5, runAnimKey: 'heeler_lifeguard_run' },
  { id: 'pilot_bob', sourceRow: 12, smoothRow: 6, runAnimKey: 'pilot_bob_run' },
  { id: 'princess_lulu', sourceRow: 13, smoothRow: 7, runAnimKey: 'princess_lulu_run' },
];

const ROW_BY_ID = new Map(SMOOTH_ROWS.map((entry) => [entry.id, entry]));
let installed = false;
let atlasReady = false;

function sourceBase(row: number): number {
  return row * SOURCE_FRAMES_PER_CORGI;
}

function smoothBase(row: number): number {
  return row * RUN_FRAME_COUNT;
}

function drawSourceFrame(
  context: CanvasRenderingContext2D,
  sourceFrame: Phaser.Textures.Frame,
  destinationX: number,
  destinationY: number,
  alpha: number,
  yOffset: number,
): void {
  if (!sourceFrame?.source?.image) return;

  context.save();
  context.globalAlpha = alpha;
  context.drawImage(
    sourceFrame.source.image as CanvasImageSource,
    sourceFrame.cutX,
    sourceFrame.cutY,
    sourceFrame.cutWidth,
    sourceFrame.cutHeight,
    destinationX,
    destinationY + yOffset,
    CORGI_GAMEPLAY_FRAME_SIZE,
    CORGI_GAMEPLAY_FRAME_SIZE,
  );
  context.restore();
}

/**
 * Builds four true key poses plus four cross-dissolved in-between poses.
 * The one-pixel rise/fall curve gives the torso a restrained weight shift;
 * GameScene still controls the larger physics-safe stride bob.
 */
function buildSmoothRunAtlas(scene: Phaser.Scene): boolean {
  if (scene.textures.exists(SMOOTH_ATLAS_KEY)) return true;
  if (!scene.textures.exists(SOURCE_ATLAS_KEY)) return false;

  const width = RUN_FRAME_COUNT * CORGI_GAMEPLAY_FRAME_SIZE;
  const height = SMOOTH_ROWS.length * CORGI_GAMEPLAY_FRAME_SIZE;
  const smoothTexture = scene.textures.createCanvas(SMOOTH_ATLAS_KEY, width, height);
  if (!smoothTexture) return false;

  const context = smoothTexture.getContext();
  context.imageSmoothingEnabled = true;
  context.clearRect(0, 0, width, height);

  const sourceTexture = scene.textures.get(SOURCE_ATLAS_KEY);
  const verticalOffsets = [0, -1, -2, -1, 0, -1, -2, -1];

  for (const row of SMOOTH_ROWS) {
    const sourceFrames = Array.from({ length: SOURCE_RUN_FRAME_COUNT }, (_, index) =>
      sourceTexture.get(sourceBase(row.sourceRow) + index),
    );

    for (let outputFrame = 0; outputFrame < RUN_FRAME_COUNT; outputFrame++) {
      const destinationX = outputFrame * CORGI_GAMEPLAY_FRAME_SIZE;
      const destinationY = row.smoothRow * CORGI_GAMEPLAY_FRAME_SIZE;
      const keyIndex = Math.floor(outputFrame / 2);
      const nextIndex = (keyIndex + 1) % SOURCE_RUN_FRAME_COUNT;
      const yOffset = verticalOffsets[outputFrame];

      if (outputFrame % 2 === 0) {
        drawSourceFrame(
          context,
          sourceFrames[keyIndex],
          destinationX,
          destinationY,
          1,
          yOffset,
        );
      } else {
        drawSourceFrame(
          context,
          sourceFrames[keyIndex],
          destinationX,
          destinationY,
          0.55,
          yOffset,
        );
        drawSourceFrame(
          context,
          sourceFrames[nextIndex],
          destinationX,
          destinationY,
          0.45,
          yOffset,
        );
      }

      smoothTexture.add(
        smoothBase(row.smoothRow) + outputFrame,
        0,
        destinationX,
        destinationY,
        CORGI_GAMEPLAY_FRAME_SIZE,
        CORGI_GAMEPLAY_FRAME_SIZE,
      );
    }
  }

  smoothTexture.refresh();
  scene.textures.get(SMOOTH_ATLAS_KEY).setFilter(Phaser.Textures.FilterMode.LINEAR);
  return true;
}

function configureDefinitions(): void {
  const definitions = CORGIS as unknown as RuntimeCorgiDef[];

  for (const row of SMOOTH_ROWS) {
    const definition = definitions.find((candidate) => candidate.id === row.id);
    if (!definition) continue;

    const source = sourceBase(row.sourceRow);
    const smooth = smoothBase(row.smoothRow);

    // Keep the approved full-body store portrait on the original atlas.
    // Bob/Lulu's focused store plugin replaces these with isolated portraits.
    definition.texture = SOURCE_ATLAS_KEY;
    definition.textureFrame = source;

    definition.runFrame = smooth;
    definition.runSheetKey = SMOOTH_ATLAS_KEY;
    definition.runAnimKey = row.runAnimKey;
    definition.jumpFrame = source + 4;
    definition.fallFrame = source + 5;
    definition.landFrame = source + 6;
  }
}

function registerAnimations(scene: Phaser.Scene): void {
  for (const row of SMOOTH_ROWS) {
    if (scene.anims.exists(row.runAnimKey)) scene.anims.remove(row.runAnimKey);

    const base = smoothBase(row.smoothRow);
    scene.anims.create({
      key: row.runAnimKey,
      frames: Array.from({ length: RUN_FRAME_COUNT }, (_, offset) => ({
        key: SMOOTH_ATLAS_KEY,
        frame: base + offset,
      })),
      frameRate: 14,
      repeat: -1,
    });
  }
}

function selectedRow(): SmoothRow | undefined {
  return ROW_BY_ID.get(String((gameState as any).selectedCorgi ?? 'classic'));
}

function applyCleanVisualState(
  scene: Phaser.Scene & Record<string, any>,
  textureKey: string,
  frame: number,
): void {
  const corgi = scene.corgi as Phaser.Physics.Arcade.Sprite | undefined;
  if (!corgi) return;

  const alreadyShowing =
    corgi.texture?.key === textureKey && String(corgi.frame?.name) === String(frame);
  if (!alreadyShowing) {
    corgi.setTexture(textureKey, frame);
    if (typeof scene.sizeCorgiUniform === 'function') scene.sizeCorgiUniform();
  }

  corgi.setFlipX(false);
  corgi.setAngle(0);
  corgi.clearTint();
  corgi.setAlpha(1);
  corgi.setBlendMode(Phaser.BlendModes.NORMAL);
}

/**
 * Gives every character an eight-frame stride. The original six retain their
 * dedicated eight-frame sheets; the eight newer characters use a runtime-built
 * eight-frame atlas. Jump, fall, land, store portraits, and BONK remain separate.
 */
export function installGameplayAnimation(
  PreloadSceneClass: SceneClass,
  GameSceneClass: SceneClass,
): void {
  if (installed) return;
  installed = true;

  const preloadPrototype = PreloadSceneClass.prototype;
  const previousPreload = preloadPrototype.preload;
  preloadPrototype.preload = function preloadSourceAtlas(this: Phaser.Scene): void {
    previousPreload.call(this);
    this.load.spritesheet(SOURCE_ATLAS_KEY, CORGI_GAMEPLAY_ATLAS_DATA_URI, {
      frameWidth: CORGI_GAMEPLAY_FRAME_SIZE,
      frameHeight: CORGI_GAMEPLAY_FRAME_SIZE,
      startFrame: 0,
      endFrame: CORGI_GAMEPLAY_FRAME_COUNT - 1,
    });
  };

  const previousPreloadCreate = preloadPrototype.create;
  preloadPrototype.create = function createSmoothAnimations(this: Phaser.Scene): any {
    const result = previousPreloadCreate.call(this);
    atlasReady = false;

    try {
      if (!buildSmoothRunAtlas(this)) {
        console.error('[Corgi Hop] Smooth eight-frame atlas could not be built.');
        return result;
      }
      registerAnimations(this);
      configureDefinitions();
      atlasReady = true;
    } catch (error) {
      console.error('[Corgi Hop] Smooth running setup failed; using legacy assets.', error);
    }

    return result;
  };

  const gamePrototype = GameSceneClass.prototype;
  const previousGameCreate = gamePrototype.create;
  gamePrototype.create = function createWithSmoothRun(
    this: Phaser.Scene & Record<string, any>,
    ...args: any[]
  ): any {
    const row = selectedRow();
    if (!atlasReady || !row || !this.textures.exists(SMOOTH_ATLAS_KEY)) {
      return previousGameCreate.apply(this, args);
    }

    configureDefinitions();
    const definitions = CORGIS as unknown as RuntimeCorgiDef[];
    const selectedDefinition = definitions.find((candidate) => candidate.id === row.id);

    // NewCorgiPack's older wrapper reads its original portrait sheet during
    // create(). Give it the expected 0-7 index temporarily, then restore the
    // new eight-frame gameplay definition before anything renders.
    const savedRunFrame = selectedDefinition?.runFrame;
    const savedTextureFrame = selectedDefinition?.textureFrame;
    if (selectedDefinition) {
      const legacyFrame = row.sourceRow - FIRST_NEW_CORGI_ROW;
      selectedDefinition.runFrame = legacyFrame;
      selectedDefinition.textureFrame = legacyFrame;
    }

    let result: any;
    try {
      result = previousGameCreate.apply(this, args);
    } finally {
      if (selectedDefinition) {
        selectedDefinition.runFrame = savedRunFrame ?? smoothBase(row.smoothRow);
        selectedDefinition.textureFrame = savedTextureFrame ?? sourceBase(row.sourceRow);
      }
    }

    const corgi = this.corgi as Phaser.Physics.Arcade.Sprite | undefined;
    if (!corgi) return result;

    const base = smoothBase(row.smoothRow);
    this.runTexKey = SMOOTH_ATLAS_KEY;
    this.runAnimKey = row.runAnimKey;
    corgi.anims.stop();
    applyCleanVisualState(this, SMOOTH_ATLAS_KEY, base);
    if (this.anims.exists(row.runAnimKey)) corgi.play(row.runAnimKey);
    return result;
  };

  const previousSetPose = gamePrototype.setPose;
  gamePrototype.setPose = function setSmoothPose(
    this: Phaser.Scene & Record<string, any>,
    pose: Pose,
  ): void {
    const row = selectedRow();
    const corgi = this.corgi as Phaser.Physics.Arcade.Sprite | undefined;
    if (!atlasReady || !row || !corgi || !this.textures.exists(SMOOTH_ATLAS_KEY)) {
      previousSetPose.call(this, pose);
      return;
    }

    if (pose === 'hit') {
      previousSetPose.call(this, pose);
      return;
    }

    if (pose === 'run') {
      applyCleanVisualState(this, SMOOTH_ATLAS_KEY, smoothBase(row.smoothRow));
      return;
    }

    corgi.anims.stop();
    const source = sourceBase(row.sourceRow);
    const frame = pose === 'jump' ? source + 4 : pose === 'fall' ? source + 5 : source + 6;
    applyCleanVisualState(this, SOURCE_ATLAS_KEY, frame);
  };
}
