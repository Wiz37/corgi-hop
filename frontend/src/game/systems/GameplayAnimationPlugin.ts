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
  row: number;
  runAnimKey: string;
}

const ATLAS_KEY = 'corgi_gameplay_atlas_20260801';
const FRAMES_PER_CORGI = 7;
const RUN_FRAME_COUNT = 4;
const FIRST_NEW_CORGI_ROW = 6;

const ATLAS_ROWS: AtlasRow[] = [
  { id: 'classic', row: 0, runAnimKey: 'run' },
  { id: 'starter', row: 1, runAnimKey: 'starter_run' },
  { id: 'cowboy', row: 2, runAnimKey: 'cowboy_run' },
  { id: 'superhero', row: 3, runAnimKey: 'superhero_run' },
  { id: 'pirate', row: 4, runAnimKey: 'pirate_run_fixed' },
  { id: 'astronaut', row: 5, runAnimKey: 'astronaut_run' },
  { id: 'blue_merle_chef', row: 6, runAnimKey: 'blue_merle_chef_run' },
  { id: 'black_tri_tuxedo', row: 7, runAnimKey: 'black_tri_tuxedo_run' },
  { id: 'red_tri_ninja', row: 8, runAnimKey: 'red_tri_ninja_run' },
  { id: 'sable_aviator', row: 9, runAnimKey: 'sable_aviator_run' },
  { id: 'brindle_viking', row: 10, runAnimKey: 'brindle_viking_run' },
  { id: 'heeler_lifeguard', row: 11, runAnimKey: 'heeler_lifeguard_run' },
  { id: 'pilot_bob', row: 12, runAnimKey: 'pilot_bob_run' },
  { id: 'princess_lulu', row: 13, runAnimKey: 'princess_lulu_run' },
];

const ROW_BY_ID = new Map(ATLAS_ROWS.map((entry) => [entry.id, entry]));
let installed = false;
let atlasReady = false;

function firstFrame(row: number): number {
  return row * FRAMES_PER_CORGI;
}

function configureDefinitions(): void {
  const definitions = CORGIS as unknown as RuntimeCorgiDef[];

  for (const atlasRow of ATLAS_ROWS) {
    const definition = definitions.find((candidate) => candidate.id === atlasRow.id);
    if (!definition) continue;

    const base = firstFrame(atlasRow.row);

    // Preserve the high-resolution Page 1 portraits. Only the eight newer
    // store characters use the atlas portrait because their old paws were cut.
    if (atlasRow.row >= FIRST_NEW_CORGI_ROW) {
      definition.texture = ATLAS_KEY;
      definition.textureFrame = base;
    }

    definition.runFrame = base;
    definition.runSheetKey = ATLAS_KEY;
    definition.runAnimKey = atlasRow.runAnimKey;
    definition.jumpFrame = base + 4;
    definition.fallFrame = base + 5;
    definition.landFrame = base + 6;
  }
}

function registerAnimations(scene: Phaser.Scene): void {
  for (const atlasRow of ATLAS_ROWS) {
    if (scene.anims.exists(atlasRow.runAnimKey)) {
      scene.anims.remove(atlasRow.runAnimKey);
    }

    const base = firstFrame(atlasRow.row);
    scene.anims.create({
      key: atlasRow.runAnimKey,
      frames: Array.from({ length: RUN_FRAME_COUNT }, (_, offset) => ({
        key: ATLAS_KEY,
        frame: base + offset,
      })),
      frameRate: 12,
      repeat: -1,
    });
  }
}

function selectedRow(): AtlasRow | undefined {
  return ROW_BY_ID.get(String((gameState as any).selectedCorgi ?? 'classic'));
}

function frameForPose(atlasRow: AtlasRow, pose: Exclude<Pose, 'hit'>): number {
  const base = firstFrame(atlasRow.row);
  switch (pose) {
    case 'run': return base;
    case 'jump': return base + 4;
    case 'fall': return base + 5;
    case 'land': return base + 6;
  }
  return base;
}

/**
 * Installs the completed gameplay atlas without being allowed to block startup.
 *
 * The legacy preload scene is allowed to finish first. Only after its textures,
 * animations, fallbacks, and fade transition are established do we replace the
 * corgi animations. If the atlas cannot be decoded on a device, the game keeps
 * running with the previous assets instead of freezing at 100%.
 */
export function installGameplayAnimation(
  PreloadSceneClass: SceneClass,
  GameSceneClass: SceneClass,
): void {
  if (installed) return;
  installed = true;

  const preloadPrototype = PreloadSceneClass.prototype;
  const previousPreload = preloadPrototype.preload;
  preloadPrototype.preload = function preloadCompletedAtlas(this: Phaser.Scene): void {
    previousPreload.call(this);
    this.load.spritesheet(ATLAS_KEY, CORGI_GAMEPLAY_ATLAS_DATA_URI, {
      frameWidth: CORGI_GAMEPLAY_FRAME_SIZE,
      frameHeight: CORGI_GAMEPLAY_FRAME_SIZE,
      startFrame: 0,
      endFrame: CORGI_GAMEPLAY_FRAME_COUNT - 1,
    });
  };

  const previousPreloadCreate = preloadPrototype.create;
  preloadPrototype.create = function createCompletedAnimations(this: Phaser.Scene): any {
    // Critical startup fix: finish every existing preload/create wrapper first.
    // The original scene schedules the menu transition before we touch global
    // animation keys, so this plugin can never trap the app on the 100% screen.
    const result = previousPreloadCreate.call(this);
    atlasReady = false;

    if (!this.textures.exists(ATLAS_KEY)) {
      console.error('[Corgi Hop] Gameplay atlas did not decode; using legacy corgi assets.');
      return result;
    }

    try {
      registerAnimations(this);
      configureDefinitions();
      atlasReady = true;
    } catch (error) {
      atlasReady = false;
      console.error('[Corgi Hop] Gameplay atlas setup failed; using legacy corgi assets.', error);
    }

    return result;
  };

  const gamePrototype = GameSceneClass.prototype;
  const previousGameCreate = gamePrototype.create;
  gamePrototype.create = function createWithCompletedCorgi(
    this: Phaser.Scene & Record<string, any>,
    ...args: any[]
  ): any {
    if (!atlasReady || !this.textures.exists(ATLAS_KEY)) {
      return previousGameCreate.apply(this, args);
    }

    configureDefinitions();
    const atlasRow = selectedRow();
    const definitions = CORGIS as unknown as RuntimeCorgiDef[];
    const selectedDefinition = atlasRow
      ? definitions.find((candidate) => candidate.id === atlasRow.id)
      : undefined;

    // NewCorgiPack's older wrapper briefly reads the original eight-frame
    // portrait sheet. Give it a safe legacy index, then restore the atlas frame
    // synchronously before the first gameplay frame renders.
    const savedRunFrame = selectedDefinition?.runFrame;
    const savedTextureFrame = selectedDefinition?.textureFrame;
    if (selectedDefinition && atlasRow && atlasRow.row >= FIRST_NEW_CORGI_ROW) {
      const legacyFrame = atlasRow.row - FIRST_NEW_CORGI_ROW;
      selectedDefinition.runFrame = legacyFrame;
      selectedDefinition.textureFrame = legacyFrame;
    }

    let result: any;
    try {
      result = previousGameCreate.apply(this, args);
    } finally {
      if (selectedDefinition && atlasRow) {
        const base = firstFrame(atlasRow.row);
        selectedDefinition.runFrame = savedRunFrame ?? base;
        selectedDefinition.textureFrame = savedTextureFrame ?? base;
      }
    }

    const corgi = this.corgi as Phaser.Physics.Arcade.Sprite | undefined;
    if (!atlasRow || !corgi) return result;

    const base = firstFrame(atlasRow.row);
    this.runTexKey = ATLAS_KEY;
    this.runAnimKey = atlasRow.runAnimKey;
    corgi.anims.stop();
    corgi.setTexture(ATLAS_KEY, base);
    corgi.setFlipX(false);
    corgi.setAngle(0);
    corgi.clearTint();
    corgi.setAlpha(1);
    if (typeof this.sizeCorgiUniform === 'function') this.sizeCorgiUniform();
    if (this.anims.exists(atlasRow.runAnimKey)) corgi.play(atlasRow.runAnimKey);
    return result;
  };

  const previousSetPose = gamePrototype.setPose;
  gamePrototype.setPose = function setCompletedPose(
    this: Phaser.Scene & Record<string, any>,
    pose: Pose,
  ): void {
    const atlasRow = selectedRow();
    const corgi = this.corgi as Phaser.Physics.Arcade.Sprite | undefined;
    if (!atlasReady || !atlasRow || !corgi || !this.textures.exists(ATLAS_KEY)) {
      previousSetPose.call(this, pose);
      return;
    }

    if (pose === 'hit') {
      previousSetPose.call(this, pose);
      return;
    }

    const frame = frameForPose(atlasRow, pose);
    const sameTexture = corgi.texture?.key === ATLAS_KEY;
    const sameFrame = String(corgi.frame?.name) === String(frame);
    if (!sameTexture || !sameFrame) {
      corgi.setTexture(ATLAS_KEY, frame);
      if (typeof this.sizeCorgiUniform === 'function') this.sizeCorgiUniform();
    }

    corgi.setFlipX(false);
    corgi.setAngle(0);
    corgi.clearTint();
    corgi.setAlpha(1);
  };
}
