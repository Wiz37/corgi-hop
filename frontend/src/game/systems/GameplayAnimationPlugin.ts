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

interface AtlasRow {
  id: string;
  sourceRow: number;
  runAnimKey: string;
}

const SOURCE_ATLAS_KEY = 'corgi_gameplay_atlas_20260801';
const SOURCE_FRAMES_PER_CORGI = 7;
const NINJA_ID = 'red_tri_ninja';
const NINJA_SHEET_KEY = 'red_tri_ninja_run_sheet';
const NINJA_ANIMATION_KEY = 'red_tri_ninja_verified_run';
const RUN_FRAME_COUNT = 8;
const GAMEPLAY_ACTOR_DEPTH = 24;

// The first six corgis already use dedicated high-resolution eight-frame
// sheets. These eight newer corgis use their full-body gameplay atlas directly.
// Avoiding a runtime-generated canvas is important on iOS: when that canvas
// failed, the game silently fell back to the cropped one-frame store portrait.
const ATLAS_ROWS: AtlasRow[] = [
  { id: 'blue_merle_chef', sourceRow: 6, runAnimKey: 'blue_merle_chef_run' },
  { id: 'black_tri_tuxedo', sourceRow: 7, runAnimKey: 'black_tri_tuxedo_run' },
  { id: 'red_tri_ninja', sourceRow: 8, runAnimKey: 'red_tri_ninja_run' },
  { id: 'sable_aviator', sourceRow: 9, runAnimKey: 'sable_aviator_run' },
  { id: 'brindle_viking', sourceRow: 10, runAnimKey: 'brindle_viking_run' },
  { id: 'heeler_lifeguard', sourceRow: 11, runAnimKey: 'heeler_lifeguard_run' },
  { id: 'pilot_bob', sourceRow: 12, runAnimKey: 'pilot_bob_run' },
  { id: 'princess_lulu', sourceRow: 13, runAnimKey: 'princess_lulu_run' },
];

const ROW_BY_ID = new Map(ATLAS_ROWS.map((entry) => [entry.id, entry]));
let installed = false;
let atlasReady = false;

function sourceBase(row: number): number {
  return row * SOURCE_FRAMES_PER_CORGI;
}

function selectedRow(): AtlasRow | undefined {
  return ROW_BY_ID.get(String((gameState as any).selectedCorgi ?? 'classic'));
}

function configureDefinitions(): void {
  const definitions = CORGIS as unknown as RuntimeCorgiDef[];

  for (const row of ATLAS_ROWS) {
    const definition = definitions.find((candidate) => candidate.id === row.id);
    if (!definition) continue;

    const base = sourceBase(row.sourceRow);
    definition.texture = SOURCE_ATLAS_KEY;
    definition.textureFrame = base;
    definition.runFrame = base;
    definition.runSheetKey = SOURCE_ATLAS_KEY;
    definition.runAnimKey = row.runAnimKey;
    // The legacy airborne slots crop paws/feet. Reuse complete full-body run
    // drawings for jump, fall, and landing so every newer corgi stays intact.
    definition.jumpFrame = base + 1;
    definition.fallFrame = base + 2;
    definition.landFrame = base + 3;
  }

  const ninja = definitions.find((candidate) => candidate.id === NINJA_ID);
  if (ninja) {
    ninja.runFrame = 0;
    ninja.runSheetKey = NINJA_SHEET_KEY;
    ninja.runAnimKey = NINJA_ANIMATION_KEY;
    ninja.jumpFrame = 1;
    ninja.fallFrame = 2;
    ninja.landFrame = 3;
  }
}

function registerAnimations(scene: Phaser.Scene): void {
  // The supplied artwork contains four distinct run drawings. Register an
  // eight-frame playback cadence directly from those full-body frames. This is
  // reliable in TestFlight and is the exact animation used by the store cards.
  const runOffsets = [0, 1, 2, 3, 0, 1, 2, 3];

  for (const row of ATLAS_ROWS) {
    if (row.id === NINJA_ID) continue;
    if (scene.anims.exists(row.runAnimKey)) scene.anims.remove(row.runAnimKey);

    const base = sourceBase(row.sourceRow);
    scene.anims.create({
      key: row.runAnimKey,
      frames: runOffsets.map((offset) => ({
        key: SOURCE_ATLAS_KEY,
        frame: base + offset,
      })),
      frameRate: 14,
      repeat: -1,
    });
  }

  if (scene.anims.exists(NINJA_ANIMATION_KEY)) scene.anims.remove(NINJA_ANIMATION_KEY);
  scene.anims.create({
    key: NINJA_ANIMATION_KEY,
    frames: Array.from({ length: RUN_FRAME_COUNT }, (_, frame) => ({
      key: NINJA_SHEET_KEY,
      frame,
    })),
    frameRate: 14,
    repeat: -1,
  });
}

function applyFullBodyVisual(
  scene: Phaser.Scene & Record<string, any>,
  textureKey: string,
  frame: number,
): void {
  const corgi = scene.corgi as Phaser.Physics.Arcade.Sprite | undefined;
  if (!corgi) return;

  const alreadyShowing =
    corgi.texture?.key === textureKey
    && String(corgi.frame?.name) === String(frame);

  if (!alreadyShowing) {
    corgi.setTexture(textureKey, frame);
    if (typeof scene.sizeCorgiUniform === 'function') scene.sizeCorgiUniform();
  }

  corgi.clearMask();
  corgi.setOrigin(0.5, 1);
  corgi.setDepth(GAMEPLAY_ACTOR_DEPTH);
  corgi.setVisible(true);
  corgi.setAlpha(1);
  corgi.setFlipX(false);
  corgi.setAngle(0);
  corgi.clearTint();
  corgi.setBlendMode(Phaser.BlendModes.NORMAL);
}

/**
 * Uses the shipped full-body gameplay atlas directly for the eight newer
 * corgis. Store and gameplay share the exact same texture and animation keys,
 * while jump, fall, and land use the dedicated full-body pose frames.
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
    this.load.spritesheet(NINJA_SHEET_KEY, '/assets/red_tri_ninja_run_sheet.png?v=20260805a', {
      frameWidth: 300,
      frameHeight: 200,
      startFrame: 0,
      endFrame: RUN_FRAME_COUNT - 1,
    });
  };

  const previousPreloadCreate = preloadPrototype.create;
  preloadPrototype.create = function createFullBodyAnimations(this: Phaser.Scene): any {
    const result = previousPreloadCreate.call(this);
    atlasReady = false;

    if (!this.textures.exists(SOURCE_ATLAS_KEY) || !this.textures.exists(NINJA_SHEET_KEY)) {
      console.error('[Corgi Hop] Full-body gameplay assets failed to load.');
      return result;
    }

    try {
      registerAnimations(this);
      configureDefinitions();
      atlasReady = true;
    } catch (error) {
      console.error('[Corgi Hop] Full-body gameplay animation setup failed.', error);
    }

    return result;
  };

  const gamePrototype = GameSceneClass.prototype;
  const previousGameCreate = gamePrototype.create;
  gamePrototype.create = function createWithFullBodyRun(
    this: Phaser.Scene & Record<string, any>,
    ...args: any[]
  ): any {
    const row = selectedRow();
    if (atlasReady && row) configureDefinitions();

    const result = previousGameCreate.apply(this, args);
    const corgi = this.corgi as Phaser.Physics.Arcade.Sprite | undefined;
    if (!atlasReady || !row || !corgi || !this.textures.exists(SOURCE_ATLAS_KEY)) {
      return result;
    }

    const isNinja = row.id === NINJA_ID;
    const textureKey = isNinja ? NINJA_SHEET_KEY : SOURCE_ATLAS_KEY;
    const animationKey = isNinja ? NINJA_ANIMATION_KEY : row.runAnimKey;
    const base = isNinja ? 0 : sourceBase(row.sourceRow);
    this.runTexKey = textureKey;
    this.runAnimKey = animationKey;

    corgi.anims.stop();
    applyFullBodyVisual(this, textureKey, base);
    if (this.anims.exists(animationKey)) corgi.play(animationKey, true);
    return result;
  };

  const previousSetPose = gamePrototype.setPose;
  gamePrototype.setPose = function setFullBodyPose(
    this: Phaser.Scene & Record<string, any>,
    pose: Pose,
  ): void {
    const row = selectedRow();
    const corgi = this.corgi as Phaser.Physics.Arcade.Sprite | undefined;

    if (!atlasReady || !row || !corgi || !this.textures.exists(SOURCE_ATLAS_KEY)) {
      previousSetPose.call(this, pose);
      return;
    }

    if (pose === 'hit') {
      previousSetPose.call(this, pose);
      return;
    }

    const isNinja = row.id === NINJA_ID;
    const textureKey = isNinja ? NINJA_SHEET_KEY : SOURCE_ATLAS_KEY;
    const animationKey = isNinja ? NINJA_ANIMATION_KEY : row.runAnimKey;
    const base = isNinja ? 0 : sourceBase(row.sourceRow);
    this.runTexKey = textureKey;
    this.runAnimKey = animationKey;

    if (pose === 'run') {
      applyFullBodyVisual(this, textureKey, base);
      const wrongAnimation = corgi.anims.currentAnim?.key !== animationKey;
      if (this.anims.exists(animationKey)
        && (!corgi.anims.isPlaying || wrongAnimation)) {
        corgi.play(animationKey, true);
      }
      return;
    }

    corgi.anims.stop();
    const frame = pose === 'jump' ? base + 1 : pose === 'fall' ? base + 2 : base + 3;
    applyFullBodyVisual(this, textureKey, frame);
  };
}
